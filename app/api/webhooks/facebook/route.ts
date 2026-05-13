import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { processIncomingMessage } from '@/lib/channels/processor'

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
      const messageObj = event.message as Record<string, string> | undefined
      const text = messageObj?.text

      if (!sender || !text) continue

      try {
        await processIncomingMessage({
          channel: 'facebook',
          channelConfigId: config.id,
          contactFullName: null,
          contactEmail: null,
          contactPhone: null,
          contactSocialId: sender,
          subject: `Facebook message from ${sender}`,
          content: text,
          externalThreadId: sender,
        })
      } catch (err) {
        console.error('[webhook/facebook]', err)
      }
    }
  }

  return new Response('', { status: 200 })
}
