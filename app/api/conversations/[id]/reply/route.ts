import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendReply as sendGmailReply } from '@/lib/gmail/client'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'User not found' }, { status: 401 })

  let body: { content: string; isNote: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { content, isNote } = body
  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 })

  // Fetch conversation to determine channel and thread context
  const { data: conversation } = await supabase
    .from('conversations')
    .select('*, contact:contacts(email, full_name)')
    .eq('id', conversationId)
    .single()

  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  // For non-internal replies on Gmail conversations, send via Gmail API
  if (conversation.channel === 'gmail' && !isNote && conversation.channel_config_id && conversation.external_thread_id) {
    const { data: channelConfig } = await supabase
      .from('channel_configs')
      .select('identifier, is_active')
      .eq('id', conversation.channel_config_id)
      .single()

    if (channelConfig?.is_active) {
      const contact = conversation.contact as unknown as { email: string | null; full_name: string | null } | null
      const contactEmail = contact?.email
      if (contactEmail) {
        try {
          await sendGmailReply(conversation.channel_config_id, {
            threadId: conversation.external_thread_id,
            to: contactEmail,
            from: channelConfig.identifier,
            subject: conversation.subject ?? '(no subject)',
            body: content.trim(),
          })
        } catch (err) {
          console.error('[reply] Gmail send failed:', err)
          return NextResponse.json({ error: 'Failed to send via Gmail' }, { status: 500 })
        }
      }
    }
  }

  // Write message to database
  const { data: message, error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'staff',
      sender_id: user.id,
      content: content.trim(),
      is_internal_note: isNote,
    })
    .select('id')
    .single()

  if (!message) {
    console.error('[reply] message insert failed:', msgError)
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
  }

  // Advance status if this is a real reply on an open conversation
  if (!isNote && conversation.status === 'open') {
    await supabase
      .from('conversations')
      .update({ status: 'in_progress', is_read: true })
      .eq('id', conversationId)
  }

  return NextResponse.json({ success: true, message_id: message.id })
}
