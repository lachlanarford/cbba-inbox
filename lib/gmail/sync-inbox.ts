import { createServiceClient } from '@/lib/supabase/service'
import { fetchMessagesFromHistory, getParsedMessage, listMailboxMessageIds, markAsRead } from '@/lib/gmail/client'
import type { ParsedEmail } from '@/lib/gmail/client'
import { processIncomingMessage, processStaffGmailReply } from '@/lib/channels/processor'
import { triggerCategorise } from '@/lib/ai/categorise'
import { notifyInboundMessage } from '@/lib/conversations/inbound-notify'
import { parseFormSubmissionContact } from '@/lib/email/form-submission'
import { isBounceOrDsnEmail } from '@/lib/email/bounce'

export type GmailSyncResult = {
  processed: number
  sentProcessed: number
  closedThreads: number
  newHistoryId: string | null
}

const CATCHUP_STALE_MS = 6 * 60 * 60 * 1000
const CATCHUP_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000
const CATCHUP_RECENT_MS = 2 * 24 * 60 * 60 * 1000
const CATCHUP_MAX_INGEST = 20

async function unstoredMailboxIds(gmailIds: string[]): Promise<string[]> {
  const supabase = createServiceClient()
  const stored = new Set<string>()
  for (let i = 0; i < gmailIds.length; i += 100) {
    const chunk = gmailIds.slice(i, i + 100)
    const { data, error } = await supabase
      .from('messages')
      .select('external_message_id')
      .in('external_message_id', chunk)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      if (row.external_message_id) stored.add(row.external_message_id)
    }
  }
  return gmailIds.filter((id) => !stored.has(id))
}

export async function ingestInboxEmail(opts: {
  configId: string
  email: ParsedEmail
  defaultDepartment: string | null
  defaultAssignedTo: string | null
  notify?: boolean
  categorise?: boolean
}): Promise<boolean> {
  const supabase = createServiceClient()

  if (opts.email.messageId) {
    const { data: existing } = await supabase
      .from('messages')
      .select('id')
      .eq('external_message_id', opts.email.messageId)
      .limit(1)
    if (existing && existing.length > 0) return false
  }

  // Bounce / DSN messages create noise and steal Gmail thread IDs from real replies.
  if (isBounceOrDsnEmail({
    fromEmail: opts.email.from,
    fromName: opts.email.fromName,
    subject: opts.email.subject,
  })) {
    await markAsRead(opts.configId, opts.email.messageId)
    return false
  }

  // Squarespace (and similar) form notifications arrive from a noreply relay.
  // Prefer the submitter Name/Email embedded in the body for contact + replies.
  const formContact = parseFormSubmissionContact(opts.email.body, {
    fromEmail: opts.email.from,
    subject: opts.email.subject,
  })
  const contactEmail = formContact?.email ?? opts.email.from
  const contactFullName = formContact?.fullName ?? opts.email.fromName

  const result = await processIncomingMessage({
    channel: 'gmail',
    channelConfigId: opts.configId,
    contactFullName,
    contactEmail,
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
    ...(formContact
      ? {
          envelopeFrom: opts.email.from,
          envelopeFromName: opts.email.fromName,
        }
      : {}),
  })
  if (opts.categorise !== false) {
    triggerCategorise(result.conversationId, opts.email.body, opts.email.subject)
  }

  if (opts.notify) {
    const senderName = contactFullName ?? contactEmail
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
  maxIngest?: number
}): Promise<{ processed: number; scanned: number; missing: number }> {
  const defaultDepartment = opts.metadata.default_department ?? null
  const defaultAssignedTo = opts.metadata.default_assigned_to ?? null
  const gmailIds = await listMailboxMessageIds(opts.configId, opts.afterDate)
  const missing = await unstoredMailboxIds(gmailIds)
  const cap = opts.maxIngest ?? CATCHUP_MAX_INGEST

  let processed = 0
  for (const messageId of missing.slice(0, cap)) {
    try {
      const email = await getParsedMessage(opts.configId, messageId)
      if (!email) continue
      const ingested = await ingestInboxEmail({
        configId: opts.configId,
        email,
        defaultDepartment,
        defaultAssignedTo,
        notify: false,
      })
      if (ingested) processed++
    } catch (err) {
      console.error(`[gmail/catch-up] message error for ${opts.email}:`, messageId, err)
    }
  }

  const supabase = createServiceClient()
  const metadata: Record<string, string> = {
    ...opts.metadata,
    last_catchup_at: new Date().toISOString(),
  }
  delete metadata.needs_catchup

  await supabase
    .from('channel_configs')
    .update({ metadata })
    .eq('id', opts.configId)

  return { processed, scanned: gmailIds.length, missing: missing.length }
}

export async function inboxNeedsCatchUp(
  _configId: string,
  metadata: Record<string, string>
): Promise<{ needed: boolean; afterDate: Date; deep: boolean }> {
  if (metadata.needs_catchup === 'true') {
    return { needed: true, afterDate: new Date(Date.now() - CATCHUP_LOOKBACK_MS), deep: true }
  }

  const lastCatchup = metadata.last_catchup_at ? new Date(metadata.last_catchup_at).getTime() : 0
  const deep = !lastCatchup || Date.now() - lastCatchup >= CATCHUP_STALE_MS
  const lookbackMs = deep ? CATCHUP_LOOKBACK_MS : CATCHUP_RECENT_MS
  return { needed: true, afterDate: new Date(Date.now() - lookbackMs), deep }
}
