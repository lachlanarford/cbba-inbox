import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { syncGmailInbox } from '@/lib/gmail/sync-inbox'

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  if (!secret || secret !== process.env.GMAIL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response('', { status: 200 })
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
    const storedHistoryId = metadata.history_id ?? null

    if (!storedHistoryId) {
      await supabase
        .from('channel_configs')
        .update({ metadata: { ...metadata, history_id: historyId } })
        .eq('id', config.id)
      return new Response('', { status: 200 })
    }

    await syncGmailInbox({
      configId: config.id,
      email: emailAddress,
      metadata,
      storedHistoryId,
      notify: true,
    })
  } catch (err) {
    console.error('[webhook/gmail] processing error:', err)
  }

  return new Response('', { status: 200 })
}
