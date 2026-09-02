import { createServiceClient } from '@/lib/supabase/service'
import { getConversationWatcherIds, notifyConversationWatchers } from '@/lib/conversations/collaborators'
import { notifyNewMessage } from '@/lib/push/send'

/** Notify assignee/collaborators (or all push-enabled staff if unassigned) about an inbound message. */
export async function notifyInboundMessage(opts: {
  conversationId: string
  senderName: string
  subject: string | null
}): Promise<void> {
  const targetUserIds = await getConversationWatcherIds(opts.conversationId)

  if (targetUserIds.length === 0) {
    const supabase = createServiceClient()
    const { data: staff } = await supabase
      .from('users')
      .select('id, settings')
      .eq('is_active', true)
    const fallbackIds = (staff ?? [])
      .filter((u) => (u.settings as Record<string, unknown>)?.push_enabled === true)
      .map((u) => u.id)
    notifyNewMessage(
      fallbackIds,
      opts.senderName,
      opts.subject,
      opts.conversationId
    ).catch(() => {})
    return
  }

  await notifyConversationWatchers({
    conversationId: opts.conversationId,
    type: 'message',
    title: `New message from ${opts.senderName}`,
    body: opts.subject ?? 'No subject',
    senderName: opts.senderName,
    subject: opts.subject,
  })
}
