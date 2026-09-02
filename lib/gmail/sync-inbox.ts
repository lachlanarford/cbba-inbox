import { createServiceClient } from '@/lib/supabase/service'
import { fetchMessagesFromHistory, getCurrentHistoryId, listRecentInboxMessages, markAsRead } from '@/lib/gmail/client'
import type { ParsedEmail } from '@/lib/gmail/client'
import { processIncomingMessage, processStaffGmailReply } from '@/lib/channels/processor'
import { triggerCategorise } from '@/lib/ai/categorise'
import { notifyInboundMessage } from '@/lib/conversations/inbound-notify'

export type GmailSyncResult = {
  processed: number
  sentProcessed: number
  closedThreads: number
  newHistoryId: string | null
}

const CATCHUP_STALE_MS = 14 * 24 * 60 * 60 * 1000
const CATCHUP_LOOKBACK_MS = 40 * 24 * 60 * 60 * 1000

async function ingestInboxEmail(opts: {
  configId: string
  email: ParsedEmail
  defaultDepartment: string | null
  defaultAssignedTo: string | null
  notify?: boolean
}): Promise<boolean> {
  const supabase = createServiceClient()

  if (opts.email.messageId) {
    const { data: existing } = await supabase
      .from('messages')
      .select('id')
      .eq('external_message_id', opts.email.messageId)
      .maybeSingle()
    if (existing) return false
  }

  const result = await processIncomingMessage({
    channel: 'gmail',
    channelConfigId: opts.configId,
    contactFullName: opts.email.fromName,
    contactEmail: opts.email.from,
    contactPhone: null,
    contactSocialId: null,
    subject: opts.email.subject,
    content: opts.email.body,
    department: opts.defaultDepartment,
    assignedTo: opts.defaultAssignedTo,
    externalThreadId: opts.email.threadId,
    externalMessageId: opts.email.messageId,
    ccAddresses: opts.email.cc.length > 0 ? opts.email.cc : undefined,
    rfcMessageId: opts.email.rfcMessageId,
  })
  triggerCategorise(result.conversationId, opts.email.body, opts.email.subject)

  if (opts.notify) {
    const senderName = opts.email.fromName ?? opts.email.from
    await notifyInboundMessage({
      conversationId: result.conversationId,
      senderName,
      subject: opts.email.subject,
    })
  }

  if (opts.email.body.includes('<!--CBBA_ATT:')) {
    await supabase
      .from('conversations')
      // @ts-expect-error has_attachments not in generated types yet
      .update({ has_attachments: true })
      .eq('id', result.conversationId)
  }

  await markAsRead(opts.configId, opts.email.messageId)
  return true
}

/** Shared Gmail history processing for webhook + cron poll. */
export async function syncGmailInbox(opts: {
  configId: string
  email: string
  metadata: Record<string, string>
  storedHistoryId: string
  notify?: boolean
}): Promise<GmailSyncResult> {
  const supabase = createServiceClient()
  const defaultDepartment = opts.metadata.default_department ?? null
  const defaultAssignedTo = opts.metadata.default_assigned_to ?? null

  const { messages, sentMessages, closedThreadIds, newHistoryId } = await fetchMessagesFromHistory(
    opts.configId,
    opts.storedHistoryId,
    opts.email
  )

  for (const email of sentMessages) {
    await processStaffGmailReply({
      channelConfigId: opts.configId,
      externalThreadId: email.threadId,
      externalMessageId: email.messageId,
      content: email.body,
      fromAddress: opts.email,
    }).catch((err) => console.error('[gmail/sync] sent message error:', err))
  }

  let processed = 0
  for (const email of messages) {
    try {
      const ingested = await ingestInboxEmail({
        configId: opts.configId,
        email,
        defaultDepartment,
        defaultAssignedTo,
        notify: opts.notify,
      })
      if (ingested) processed++
    } catch (err) {
      console.error(`[gmail/sync] inbox message error for ${opts.email}:`, email.messageId, err)
    }
  }

  if (closedThreadIds.length > 0) {
    await supabase
      .from('conversations')
      .update({ status: 'closed' })
      .in('external_thread_id', closedThreadIds)
      .eq('channel_config_id', opts.configId)
      .neq('status', 'closed')
  }

  if (newHistoryId && newHistoryId !== opts.storedHistoryId) {
    await supabase
      .from('channel_configs')
      .update({ metadata: { ...opts.metadata, history_id: newHistoryId } })
      .eq('id', opts.configId)
  }

  return {
    processed,
    sentProcessed: sentMessages.length,
    closedThreads: closedThreadIds.length,
    newHistoryId,
  }
}

/** Import inbox mail from Gmail when history sync missed messages (e.g. a constraint blocked ingest). */
export async function catchUpGmailInbox(opts: {
  configId: string
  email: string
  metadata: Record<string, string>
  afterDate: Date
}): Promise<{ processed: number; scanned: number }> {
  const defaultDepartment = opts.metadata.default_department ?? null
  const defaultAssignedTo = opts.metadata.default_assigned_to ?? null
  const messages = await listRecentInboxMessages(opts.configId, opts.afterDate)

  let processed = 0
  for (const email of messages) {
    try {
      const ingested = await ingestInboxEmail({
        configId: opts.configId,
        email,
        defaultDepartment,
        defaultAssignedTo,
        notify: false,
      })
      if (ingested) processed++
    } catch (err) {
      console.error(`[gmail/catch-up] message error for ${opts.email}:`, email.messageId, err)
    }
  }

  const supabase = createServiceClient()
  const historyId = await getCurrentHistoryId(opts.configId).catch(() => '')
  const metadata: Record<string, string> = {
    ...opts.metadata,
    last_catchup_at: new Date().toISOString(),
  }
  if (historyId) metadata.history_id = historyId
  delete metadata.needs_catchup

  await supabase
    .from('channel_configs')
    .update({ metadata })
    .eq('id', opts.configId)

  return { processed, scanned: messages.length }
}

export async function inboxNeedsCatchUp(
  configId: string,
  metadata: Record<string, string>
): Promise<{ needed: boolean; afterDate: Date }> {
  if (metadata.needs_catchup === 'true') {
    return { needed: true, afterDate: new Date(Date.now() - CATCHUP_LOOKBACK_MS) }
  }

  const lastCatchup = metadata.last_catchup_at ? new Date(metadata.last_catchup_at).getTime() : 0
  if (lastCatchup && Date.now() - lastCatchup < CATCHUP_STALE_MS) {
    return { needed: false, afterDate: new Date() }
  }

  const supabase = createServiceClient()
  const { data: latest } = await supabase
    .from('conversations')
    .select('last_message_at')
    .eq('channel_config_id', configId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastMessageAt = latest?.last_message_at ? new Date(latest.last_message_at).getTime() : 0
  const stale = !lastMessageAt || Date.now() - lastMessageAt > CATCHUP_STALE_MS
  if (!stale) return { needed: false, afterDate: new Date() }

  const afterMs = lastMessageAt
    ? Math.max(lastMessageAt - 24 * 60 * 60 * 1000, Date.now() - CATCHUP_LOOKBACK_MS)
    : Date.now() - CATCHUP_LOOKBACK_MS
  return { needed: true, afterDate: new Date(afterMs) }
}
