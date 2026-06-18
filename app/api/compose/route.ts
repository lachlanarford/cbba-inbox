import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNewEmail } from '@/lib/gmail/client'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'User not found' }, { status: 401 })

  let body: { to: string; bcc?: string[]; subject: string; content: string; contactId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { to, bcc, subject, content, contactId } = body
  const isBulk = (!to?.trim()) && bcc && bcc.length > 0
  if (!isBulk && !to?.trim()) return NextResponse.json({ error: 'to required' }, { status: 400 })
  if (!subject?.trim()) return NextResponse.json({ error: 'subject required' }, { status: 400 })
  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const service = createServiceClient()

  // Find the active Gmail channel config
  const { data: channelConfig } = await service
    .from('channel_configs')
    .select('id, identifier')
    .eq('channel_type', 'gmail')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!channelConfig) {
    return NextResponse.json({ error: 'No active Gmail channel configured' }, { status: 400 })
  }

  // Append signature if set
  const signature = (appUser.settings as Record<string, unknown>)?.signature as string | undefined
  const bodyWithSig = signature?.trim()
    ? `${content.trim()}\n\n--\n${signature.trim()}`
    : content.trim()

  let threadId: string
  let gmailMessageId: string
  try {
    // For bulk sends, use the sending address in To and put all recipients in BCC
    const toAddress = isBulk ? channelConfig.identifier : to.trim()
    const result = await sendNewEmail(channelConfig.id, {
      to: toAddress,
      from: channelConfig.identifier,
      subject: subject.trim(),
      body: bodyWithSig,
      bcc: bcc && bcc.length > 0 ? bcc : undefined,
    })
    threadId = result.threadId || result.messageId
    gmailMessageId = result.messageId
  } catch (err) {
    console.error('[compose] Gmail send failed:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  // Create conversation record
  const { data: conversation, error: convError } = await service
    .from('conversations')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      channel: 'gmail',
      channel_config_id: channelConfig.id,
      contact_id: (contactId ?? null) as unknown as string,
      subject: subject.trim(),
      status: 'open',
      external_thread_id: threadId,
      last_message_at: new Date().toISOString(),
      is_read: true,
    })
    .select('id')
    .single()

  if (!conversation) {
    console.error('[compose] conversation insert failed:', convError)
    return NextResponse.json({ error: 'Email sent but failed to create conversation record' }, { status: 500 })
  }

  // Create message record
  await service.from('messages').insert({
    conversation_id: conversation.id,
    sender_type: 'staff',
    sender_id: user.id,
    content: bodyWithSig,
    is_internal_note: false,
    external_message_id: gmailMessageId,
  })

  return NextResponse.json({ success: true, conversationId: conversation.id })
}
