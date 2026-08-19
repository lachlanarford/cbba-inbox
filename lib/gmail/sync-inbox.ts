import { createServiceClient } from '@/lib/supabase/service'
import { fetchMessagesFromHistory, markAsRead } from '@/lib/gmail/client'
import { processIncomingMessage, processStaffGmailReply } from '@/lib/channels/processor'
import { triggerCategorise } from '@/lib/ai/categorise'
import { sendPushToAll } from '@/lib/push/send'

export type GmailSyncResult = {
  processed: number
  sentProcessed: number
  closedThreads: number
  newHistoryId: string | null
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

  for (const email of messages) {
    const result = await processIncomingMessage({
      channel: 'gmail',
      channelConfigId: opts.configId,
      contactFullName: email.fromName,
      contactEmail: email.from,
      contactPhone: null,
      contactSocialId: null,
      subject: email.subject,
      content: email.body,
      department: defaultDepartment,
      assignedTo: defaultAssignedTo,
      externalThreadId: email.threadId,
      externalMessageId: email.messageId,
      ccAddresses: email.cc.length > 0 ? email.cc : undefined,
      rfcMessageId: email.rfcMessageId,
    })
    triggerCategorise(result.conversationId, email.body, email.subject)

    if (opts.notify) {
      const senderName = email.fromName ?? email.from
      sendPushToAll({
        title: `New message from ${senderName}`,
        body: email.subject,
        url: `/inbox?conversation=${result.conversationId}`,
        conversationId: result.conversationId,
      }).catch(() => {})
    }

    if (email.body.includes('<!--CBBA_ATT:')) {
      await supabase
        .from('conversations')
        // @ts-expect-error has_attachments not in generated types yet
        .update({ has_attachments: true })
        .eq('id', result.conversationId)
    }

    await markAsRead(opts.configId, email.messageId)
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
    processed: messages.length,
    sentProcessed: sentMessages.length,
    closedThreads: closedThreadIds.length,
    newHistoryId,
  }
}
