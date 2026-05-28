import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendReply as sendGmailReply } from '@/lib/gmail/client'
import { sendMetaMessage } from '@/lib/channels/meta'

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

  let body: { content: string; isNote: boolean; isAiSuggested?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { content, isNote, isAiSuggested } = body
  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 })

  // Fetch conversation to determine channel and thread context
  const { data: conversation } = await supabase
    .from('conversations')
    .select('*, contact:contacts(email, full_name, social_id)')
    .eq('id', conversationId)
    .single()

  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  // For non-internal replies on Gmail conversations, send via Gmail API
  if (conversation.channel === 'gmail' && !isNote && conversation.channel_config_id && conversation.external_thread_id) {
    const service = createServiceClient()
    const { data: channelConfig } = await service
      .from('channel_configs')
      .select('identifier, is_active')
      .eq('id', conversation.channel_config_id)
      .single()

    if (!channelConfig) {
      console.error('[reply] Gmail channel config not found:', conversation.channel_config_id)
      return NextResponse.json({ error: 'Gmail channel not configured' }, { status: 500 })
    }
    if (!channelConfig.is_active) {
      console.warn('[reply] Gmail channel is inactive, skipping send')
      return NextResponse.json({ error: 'Gmail channel is not active' }, { status: 400 })
    }

    const contact = conversation.contact as unknown as { email: string | null; full_name: string | null } | null
    const contactEmail = contact?.email
    if (!contactEmail) {
      console.error('[reply] No contact email for Gmail conversation:', conversationId)
      return NextResponse.json({ error: 'Contact has no email address' }, { status: 400 })
    }

    const signature = (appUser.settings as Record<string, unknown>)?.signature as string | undefined
    const bodyWithSig = signature?.trim()
      ? `${content.trim()}\n\n--\n${signature.trim()}`
      : content.trim()

    try {
      await sendGmailReply(conversation.channel_config_id, {
        threadId: conversation.external_thread_id,
        to: contactEmail,
        from: channelConfig.identifier,
        subject: conversation.subject ?? '(no subject)',
        body: bodyWithSig,
      })
    } catch (err) {
      console.error('[reply] Gmail send failed:', err)
      return NextResponse.json({ error: 'Failed to send via Gmail' }, { status: 500 })
    }
  }

  // For non-internal replies on Facebook/Instagram, send via Meta Graph API
  if ((conversation.channel === 'facebook' || conversation.channel === 'instagram') && !isNote && conversation.channel_config_id) {
    const { data: channelConfig } = await supabase
      .from('channel_configs')
      .select('credentials, is_active')
      .eq('id', conversation.channel_config_id)
      .single()

    if (channelConfig?.is_active) {
      const creds = channelConfig.credentials as Record<string, string>
      const accessToken = conversation.channel === 'facebook' ? creds.pageAccessToken : creds.access_token
      const contact = conversation.contact as unknown as { email: string | null; full_name: string | null; social_id: string | null } | null
      const recipientId = contact?.social_id

      if (accessToken && recipientId) {
        try {
          await sendMetaMessage({ recipientId, text: content.trim(), accessToken })
        } catch (err) {
          console.error('[reply] Meta send failed:', err)
          return NextResponse.json({ error: 'Failed to send via Meta' }, { status: 500 })
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
      is_ai_suggested: isAiSuggested ?? false,
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
