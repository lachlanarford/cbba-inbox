import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchMessagesFromHistory, markAsRead } from '@/lib/gmail/client'
import { processIncomingMessage } from '@/lib/channels/processor'
import { triggerCategorise } from '@/lib/ai/categorise'
import { sendPushToAll } from '@/lib/push/send'

export async function POST(request: Request) {
  // Validate webhook secret via query param (set in Pub/Sub push subscription URL)
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  if (!secret || secret !== process.env.GMAIL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response('', { status: 200 }) // Pub/Sub requires 200 even on parse error
  }

  const message = body.message as Record<string, string> | undefined
  if (!message?.data) return new Response('', { status: 200 })

  let notification: { emailAddress: string; historyId: string }
  try {
    const decoded = Buffer.from(message.data, 'base64').toString('utf-8')
    notification = JSON.parse(decoded)
  } catch {
    console.error('[webhook/gmail] failed to decode Pub/Sub message')
    return new Response('', { status: 200 })
  }

  const { emailAddress, historyId } = notification
  if (!emailAddress || !historyId) return new Response('', { status: 200 })

  const supabase = createServiceClient()
  // Find the channel_config for this inbox
  const { data: config } = await supabase
    .from('channel_configs')
    .select('id, is_active, metadata')
    .eq('channel_type', 'gmail')
    .eq('identifier', emailAddress)
    .maybeSingle()

  if (!config) {
    console.warn(`[webhook/gmail] no config found for ${emailAddress}`)
    return new Response('', { status: 200 })
  }

  if (!config.is_active) {
    console.log(`[webhook/gmail] channel inactive for ${emailAddress}, skipping`)
    return new Response('', { status: 200 })
  }

  try {
    const metadata = (config.metadata ?? {}) as Record<string, string>
    const defaultDepartment = metadata?.default_department ?? null
    const defaultAssignedTo = metadata?.default_assigned_to ?? null
    // Use stored historyId as startHistoryId -- the notification historyId IS the
    // current state, so querying from it returns nothing. The stored id predates the
    // change and lets history.list return the new message.
    const storedHistoryId = metadata.history_id ?? null

    if (!storedHistoryId) {
      // No stored historyId yet -- save the notification's historyId for next time
      await supabase
        .from('channel_configs')
        .update({ metadata: { ...metadata, history_id: historyId } })
        .eq('id', config.id)
      return new Response('', { status: 200 })
    }

    const { messages: emails, closedThreadIds, newHistoryId } = await fetchMessagesFromHistory(
      config.id,
      storedHistoryId,
      emailAddress
    )

    for (const email of emails) {
      const result = await processIncomingMessage({
        channel: 'gmail',
        channelConfigId: config.id,
        contactFullName: email.fromName,
        contactEmail: email.from,
        contactPhone: null,
        contactSocialId: null,
        subject: email.subject,
        content: email.body,
        department: defaultDepartment,
        assignedTo: defaultAssignedTo,
        externalThreadId: email.threadId,
      })
      triggerCategorise(result.conversationId, email.body, email.subject)

      const senderName = email.fromName ?? email.from
      sendPushToAll({
        title: `New message from ${senderName}`,
        body: email.subject,
        url: `/inbox?conversation=${result.conversationId}`,
        conversationId: result.conversationId,
      }).catch(() => {})

      if (email.body.includes('<!--CBBA_ATT:')) {
        await supabase
          .from('conversations')
          // @ts-expect-error has_attachments not in generated types yet
          .update({ has_attachments: true })
          .eq('id', result.conversationId)
      }

      await markAsRead(config.id, email.messageId)
    }

    if (closedThreadIds.length > 0) {
      await supabase
        .from('conversations')
        .update({ status: 'closed' })
        .in('external_thread_id', closedThreadIds)
        .eq('channel_config_id', config.id)
        .neq('status', 'closed')
    }

    if (newHistoryId && newHistoryId !== storedHistoryId) {
      await supabase
        .from('channel_configs')
        .update({ metadata: { ...metadata, history_id: newHistoryId } })
        .eq('id', config.id)
    }
  } catch (err) {
    console.error('[webhook/gmail] processing error:', err)
  }

  return new Response('', { status: 200 })
}
