import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchMessagesFromHistory, markAsRead } from '@/lib/gmail/client'
import { processIncomingMessage } from '@/lib/channels/processor'

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

  // Respond immediately -- Pub/Sub requires acknowledgement within 10s
  // Processing happens synchronously here (small volume expected)
  try {
    const metadata = config.metadata as Record<string, string>
    const defaultDepartment = metadata?.default_department ?? null

    const emails = await fetchMessagesFromHistory(config.id, historyId, emailAddress)

    for (const email of emails) {
      await processIncomingMessage({
        channel: 'gmail',
        channelConfigId: config.id,
        contactFullName: email.fromName,
        contactEmail: email.from,
        contactPhone: null,
        contactSocialId: null,
        subject: email.subject,
        content: email.body,
        department: defaultDepartment,
        externalThreadId: email.threadId,
      })

      await markAsRead(config.id, email.messageId)
    }
  } catch (err) {
    console.error('[webhook/gmail] processing error:', err)
  }

  return new Response('', { status: 200 })
}
