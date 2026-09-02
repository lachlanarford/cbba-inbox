import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { processIncomingMessage } from '@/lib/channels/processor'
import { triggerCategorise } from '@/lib/ai/categorise'
import { getMetaUserName } from '@/lib/channels/meta'
import { notifyInboundMessage } from '@/lib/conversations/inbound-notify'

// Webhook verification challenge (Meta requires GET handler)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const supabase = createServiceClient()
  const { data: config } = await supabase
    .from('channel_configs')
    .select('credentials')
    .eq('channel_type', 'facebook')
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
      case 'image':    return '[Image]'
      case 'video':    return '[Video]'
      case 'audio':    return '[Voice message]'
      case 'file':     return '[File]'
      case 'sticker':  return '[Sticker]'
      case 'story_mention': return '[Story mention]'
      case 'share': {
        const payload = att.payload as Record<string, unknown> | undefined
        const url = payload?.url as string | undefined
        return url ? `[Shared link: ${url}]` : '[Shared content]'
      }
      default:         return `[${type}]`
    }
  })
  return parts.join(' ')
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const { data: config } = await supabase
    .from('channel_configs')
    .select('id, is_active, credentials')
    .eq('channel_type', 'facebook')
    .maybeSingle()

  if (!config?.is_active) return new Response('', { status: 200 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response('', { status: 200 })
  }

  if (body.object !== 'page') return new Response('', { status: 200 })

  const entries = (body.entry as Record<string, unknown>[]) ?? []

  for (const entry of entries) {
    const messaging = (entry.messaging as Record<string, unknown>[]) ?? []
    for (const event of messaging) {
      const sender = (event.sender as Record<string, string>)?.id
      const messageObj = event.message as Record<string, unknown> | undefined

      if (!sender || !messageObj) continue

      // Skip echoes — messages sent by the page itself (staff replies from native FB app)
      if (messageObj.is_echo) continue

      const mid = messageObj.mid as string | undefined
      const text = messageObj.text as string | undefined
      const attachments = (messageObj.attachments as Record<string, unknown>[] | undefined)

      // Build content: text, attachment description, or both
      const attachmentText = attachments?.length ? describeAttachments(attachments) : ''
      const content = [text, attachmentText].filter(Boolean).join('\n')

      if (!content) continue

      try {
        const accessToken = (config.credentials as Record<string, string>)?.pageAccessToken
        const senderName = accessToken ? await getMetaUserName(sender, accessToken) : null

        const result = await processIncomingMessage({
          channel: 'facebook',
          channelConfigId: config.id,
          contactFullName: senderName,
          contactEmail: null,
          contactPhone: null,
          contactSocialId: sender,
          subject: senderName ? `Facebook message from ${senderName}` : `Facebook message from ${sender}`,
          content,
          externalThreadId: sender,
          externalMessageId: mid,
        })
        triggerCategorise(result.conversationId, content)
        const displayName = senderName ?? sender
        await notifyInboundMessage({
          conversationId: result.conversationId,
          senderName: displayName,
          subject: `Facebook message from ${displayName}`,
        })
      } catch (err) {
        console.error('[webhook/facebook]', err)
      }
    }
  }

  return new Response('', { status: 200 })
}
