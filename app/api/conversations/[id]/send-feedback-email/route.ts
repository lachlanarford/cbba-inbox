import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { google } from 'googleapis'
import { createOAuth2Client } from '@/lib/gmail/client'
import type { GmailCredentials } from '@/lib/gmail/client'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { to: string; subject: string; body: string; channelConfigId: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { to, subject, body: emailBody, channelConfigId } = body
  if (!to || !subject || !emailBody) {
    return NextResponse.json({ error: 'to, subject, and body are required' }, { status: 400 })
  }

  if (!channelConfigId) {
    return NextResponse.json({ error: 'No Gmail channel configured for this conversation' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: channelConfig } = await service
    .from('channel_configs')
    .select('identifier, credentials, is_active')
    .eq('id', channelConfigId)
    .single()

  if (!channelConfig?.is_active) {
    return NextResponse.json({ error: 'Gmail channel is not active' }, { status: 400 })
  }

  const creds = channelConfig.credentials as unknown as GmailCredentials
  const oauth2 = createOAuth2Client()
  oauth2.setCredentials({
    access_token: creds.access_token,
    refresh_token: creds.refresh_token,
    expiry_date: creds.expiry_date,
    token_type: creds.token_type,
  })

  oauth2.on('tokens', async (tokens) => {
    const updated: Partial<GmailCredentials> = {}
    if (tokens.access_token) updated.access_token = tokens.access_token
    if (tokens.expiry_date) updated.expiry_date = tokens.expiry_date
    await service
      .from('channel_configs')
      .update({ credentials: { ...creds, ...updated } })
      .eq('id', channelConfigId)
  })

  const gmail = google.gmail({ version: 'v1', auth: oauth2 })

  const raw = [
    `From: ${channelConfig.identifier}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    emailBody,
  ].join('\r\n')

  const encoded = Buffer.from(raw).toString('base64url')

  try {
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded },
    })
  } catch (err) {
    console.error('[send-feedback-email] Gmail send failed:', err)
    return NextResponse.json({ error: 'Failed to send via Gmail' }, { status: 500 })
  }

  // Record sent_at on the feedback_request
  await service
    .from('feedback_requests')
    .update({ sent_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)

  return NextResponse.json({ ok: true })
}
