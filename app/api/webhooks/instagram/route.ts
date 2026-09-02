import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { processIncomingMessage } from '@/lib/channels/processor'
import { triggerCategorise } from '@/lib/ai/categorise'
import { getMetaUserName } from '@/lib/channels/meta'
import { notifyInboundMessage } from '@/lib/conversations/inbound-notify'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const supabase = createServiceClient()
  const { data: config } = await supabase
    .from('channel_configs')
    .select('credentials')
    .eq('channel_type', 'instagram')
    .maybeSingle()

  const verifyToken = (config?.credentials as Record<string, string>)?.verify_token

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

function describeAttachments(attachments: Record<string, unknown>[]): string {
  const parts = attachments.map((att) => {
    const type = (att.type as string) ?? 'file'
    switch (type) {
      case 'image':         return '[Image]'
      case 'video':         return '[Video]'
      case 'audio':         return '[Voice message]'
      case 'file':          return '[File]'
      case 'sticker':       return '[Sticker]'
      case 'story_mention': return '[Story mention]'
      case 'reel':          return '[Reel]'
      case 'share': {
        const payload = att.payload as Record<string, unknown> | undefined
        const url = payload?.url as string | undefined
        return url ? `[Shared: ${url}]` : '[Shared content]'
      }
      default:              return `[${type}]`
    }
  })
  return parts.join(' ')
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const { data: config } = await supabase
    .from('channel_configs')
    .select('id, is_active, credentials')
    .eq('channel_type', 'instagram')
    .maybeSingle()

  if (!config?.is_active) return new Response('', { status: 200 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response('', { status: 200 })
  }

  if (body.object !== 'instagram') return new Response('', { status: 200 })

  const accessToken = (config.credentials as Record<string, string>)?.access_token
  const entries = (body.entry as Record<string, unknown>[]) ?? []

  for (const entry of entries) {
    // --- Standard DMs via entry.messaging ---
    const messaging = (entry.messaging as Record<string, unknown>[]) ?? []
    for (const event of messaging) {
      const sender = (event.sender as Record<string, string>)?.id
      const messageObj = event.message as Record<string, unknown> | undefined

      if (!sender || !messageObj) continue

      // Skip echoes — messages sent by the page itself
      if (messageObj.is_echo) continue

      const mid = messageObj.mid as string | undefined
      const text = messageObj.text as string | undefined
      const attachments = (messageObj.attachments as Record<string, unknown>[] | undefined)

      // Detect story replies (reply_to.story is set when someone replies to an Instagram story)
      const replyTo = event.reply_to as Record<string, unknown> | undefined
      const storyReplyNote = replyTo?.story ? '[Story reply] ' : ''

      const attachmentText = attachments?.length ? describeAttachments(attachments) : ''
      const content = [storyReplyNote + (text ?? ''), attachmentText].filter(Boolean).join('\n').trim()

      if (!content) continue

      try {
        const senderName = accessToken ? await getMetaUserName(sender, accessToken) : null

        const result = await processIncomingMessage({
          channel: 'instagram',
          channelConfigId: config.id,
          contactFullName: senderName,
          contactEmail: null,
          contactPhone: null,
          contactSocialId: sender,
          subject: senderName ? `Instagram message from ${senderName}` : `Instagram message from ${sender}`,
          content,
          externalThreadId: sender,
          externalMessageId: mid,
        })
        triggerCategorise(result.conversationId, content)
        const displayName = senderName ?? sender
        await notifyInboundMessage({
          conversationId: result.conversationId,
          senderName: displayName,
          subject: senderName ? `Instagram message from ${senderName}` : `Instagram message from ${sender}`,
        })
      } catch (err) {
        console.error('[webhook/instagram] messaging event error:', err)
      }
    }

    // --- Story mentions via entry.changes ---
    // Instagram sends story mentions as changes, not messaging events
    const changes = (entry.changes as Record<string, unknown>[]) ?? []
    for (const change of changes) {
      if (change.field !== 'mentions') continue

      const value = change.value as Record<string, unknown> | undefined
      const senderId = value?.sender_id as string | undefined
      const mediaId = value?.media_id as string | undefined

      if (!senderId) continue

      const content = mediaId ? `[Story mention — media: ${mediaId}]` : '[Story mention]'
      // Use a synthetic mid so we don't duplicate if the webhook fires twice
      const mid = `story_mention_${senderId}_${mediaId ?? Date.now()}`

      try {
        const senderName = accessToken ? await getMetaUserName(senderId, accessToken) : null

        const result = await processIncomingMessage({
          channel: 'instagram',
          channelConfigId: config.id,
          contactFullName: senderName,
          contactEmail: null,
          contactPhone: null,
          contactSocialId: senderId,
          subject: senderName ? `Instagram story mention from ${senderName}` : `Instagram story mention`,
          content,
          externalThreadId: senderId,
          externalMessageId: mid,
        })
        triggerCategorise(result.conversationId, content)
        const displayName = senderName ?? senderId
        await notifyInboundMessage({
          conversationId: result.conversationId,
          senderName: displayName,
          subject: senderName ? `Instagram story mention from ${senderName}` : 'Instagram story mention',
        })
      } catch (err) {
        console.error('[webhook/instagram] story mention error:', err)
      }
    }
  }

  return new Response('', { status: 200 })
}
