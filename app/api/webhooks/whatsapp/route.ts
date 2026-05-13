import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateTwilioSignature } from '@/lib/whatsapp/client'
import { processIncomingMessage } from '@/lib/channels/processor'

export async function POST(request: Request) {
  const supabase = createServiceClient()

  const { data: config } = await supabase
    .from('channel_configs')
    .select('id, is_active, credentials')
    .eq('channel_type', 'whatsapp')
    .maybeSingle()

  if (!config?.is_active) {
    // Return 200 to avoid Twilio retries; channel not yet active
    return new Response('', { status: 200 })
  }

  // Validate Twilio signature
  const creds = config.credentials as Record<string, string>
  const signature = request.headers.get('x-twilio-signature') ?? ''
  const body = await request.text()
  const params = Object.fromEntries(new URLSearchParams(body))
  const url = request.url

  if (!validateTwilioSignature(creds.authToken, signature, url, params)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const from = params['From']?.replace('whatsapp:', '') ?? ''
  const messageBody = params['Body'] ?? ''
  const profileName = params['ProfileName'] ?? null

  if (!from || !messageBody) return new Response('', { status: 200 })

  try {
    await processIncomingMessage({
      channel: 'whatsapp',
      channelConfigId: config.id,
      contactFullName: profileName,
      contactEmail: null,
      contactPhone: from,
      contactSocialId: null,
      subject: `WhatsApp from ${from}`,
      content: messageBody,
      externalThreadId: from, // Group by phone number (one conversation per contact)
    })
  } catch (err) {
    console.error('[webhook/whatsapp]', err)
  }

  // TwiML empty response
  return new Response('<Response></Response>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}
