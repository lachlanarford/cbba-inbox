import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  sendReply as sendGmailReply,
  formatGmailError,
  type OutboundAttachment,
} from '@/lib/gmail/client'
import { sendMetaMessage } from '@/lib/channels/meta'
import { sendMessage as sendWhatsAppMessage } from '@/lib/whatsapp/client'

type ContactRow = {
  email: string | null
  full_name: string | null
  social_id: string | null
  phone: string | null
}

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

  let body: {
    content: string
    isNote: boolean
    isAiSuggested?: boolean
    attachments?: OutboundAttachment[]
    to?: string
    cc?: string[]
    bcc?: string[]
    channelConfigId?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { content, isNote, isAiSuggested, attachments, to, cc, bcc, channelConfigId: overrideConfigId } = body
  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const { data: conversation } = await supabase
    .from('conversations')
    .select('*, contact:contacts(email, full_name, social_id, phone)')
    .eq('id', conversationId)
    .single()

  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  const signature = (appUser.settings as Record<string, unknown>)?.signature as string | undefined
  const bodyWithSig = !isNote && conversation.channel === 'gmail' && signature?.trim()
    ? `${content.trim()}\n\n--\n${signature.trim()}`
    : content.trim()

  const contact = conversation.contact as unknown as ContactRow | null
  let sentFromAddress: string | null = null
  let externalMessageId: string | null = null

  if (!isNote) {
    if (conversation.channel === 'gmail') {
      const service = createServiceClient()
      const sendConfigId = overrideConfigId || conversation.channel_config_id
      if (!sendConfigId) {
        return NextResponse.json({ error: 'Gmail channel not configured' }, { status: 500 })
      }

      const { data: channelConfig } = await service
        .from('channel_configs')
        .select('id, identifier, is_active')
        .eq('id', sendConfigId)
        .eq('channel_type', 'gmail')
        .single()

      if (!channelConfig) {
        return NextResponse.json({ error: 'Gmail channel not configured' }, { status: 500 })
      }
      if (!channelConfig.is_active) {
        return NextResponse.json({ error: 'Gmail channel is not active' }, { status: 400 })
      }

      const contactEmail = to?.trim() || contact?.email
      if (!contactEmail) {
        return NextResponse.json({ error: 'Contact has no email address' }, { status: 400 })
      }

      try {
        const sendingFromOtherInbox = !!(
          overrideConfigId &&
          conversation.channel_config_id &&
          overrideConfigId !== conversation.channel_config_id
        )

        const { data: lastInbound } = await service
          .from('messages')
          .select('rfc_message_id')
          .eq('conversation_id', conversationId)
          .eq('sender_type', 'contact')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        const inReplyTo = (lastInbound as { rfc_message_id?: string | null } | null)?.rfc_message_id ?? null

        const canUseThread = !!conversation.external_thread_id && !sendingFromOtherInbox

        const sent = await sendGmailReply(channelConfig.id, {
          threadId: canUseThread ? conversation.external_thread_id : null,
          inReplyTo,
          to: contactEmail,
          from: channelConfig.identifier,
          subject: conversation.subject ?? '(no subject)',
          body: bodyWithSig,
          attachments: attachments ?? [],
          cc: cc ?? [],
          bcc: bcc ?? [],
        })

        sentFromAddress = channelConfig.identifier
        externalMessageId = sent.messageId

        const convPatch: { channel_config_id?: string; external_thread_id?: string } = {}
        if (sendingFromOtherInbox || !conversation.external_thread_id) {
          convPatch.channel_config_id = channelConfig.id
          convPatch.external_thread_id = sent.threadId
        }
        if (Object.keys(convPatch).length > 0) {
          await service.from('conversations').update(convPatch).eq('id', conversationId)
        }
      } catch (err) {
        console.error('[reply] Gmail send failed:', err)
        return NextResponse.json(
          { error: `Failed to send via Gmail: ${formatGmailError(err)}` },
          { status: 500 }
        )
      }
    } else if (conversation.channel === 'facebook' || conversation.channel === 'instagram') {
      if (!conversation.channel_config_id) {
        return NextResponse.json({ error: 'Channel not configured' }, { status: 400 })
      }

      const metaService = createServiceClient()
      const { data: channelConfig } = await metaService
        .from('channel_configs')
        .select('credentials, is_active')
        .eq('id', conversation.channel_config_id)
        .single()

      if (!channelConfig?.is_active) {
        return NextResponse.json({ error: 'Channel is not active' }, { status: 400 })
      }

      const creds = channelConfig.credentials as Record<string, string>
      const accessToken = conversation.channel === 'facebook' ? creds.pageAccessToken : creds.access_token
      const recipientId = contact?.social_id

      if (!accessToken || !recipientId) {
        return NextResponse.json({ error: 'Cannot send: missing channel credentials or contact social ID' }, { status: 400 })
      }

      try {
        await sendMetaMessage({ recipientId, text: content.trim(), accessToken })
      } catch (err) {
        console.error('[reply] Meta send failed:', err)
        return NextResponse.json({ error: 'Failed to send via Meta' }, { status: 500 })
      }
    } else if (conversation.channel === 'whatsapp') {
      if (!conversation.channel_config_id) {
        return NextResponse.json({ error: 'WhatsApp channel not configured' }, { status: 400 })
      }

      const service = createServiceClient()
      const { data: channelConfig } = await service
        .from('channel_configs')
        .select('credentials, is_active')
        .eq('id', conversation.channel_config_id)
        .single()

      if (!channelConfig?.is_active) {
        return NextResponse.json({ error: 'WhatsApp channel is not active' }, { status: 400 })
      }

      const creds = channelConfig.credentials as Record<string, string>
      const phone = contact?.phone
      if (!phone) {
        return NextResponse.json({ error: 'Contact has no phone number' }, { status: 400 })
      }
      if (!creds.accountSid || !creds.authToken || !creds.whatsappNumber) {
        return NextResponse.json({ error: 'WhatsApp channel credentials incomplete' }, { status: 500 })
      }

      try {
        await sendWhatsAppMessage(phone, content.trim(), {
          accountSid: creds.accountSid,
          authToken: creds.authToken,
          whatsappNumber: creds.whatsappNumber,
        })
      } catch (err) {
        console.error('[reply] WhatsApp send failed:', err)
        return NextResponse.json({ error: 'Failed to send via WhatsApp' }, { status: 500 })
      }
    }
  }

  const { data: message, error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'staff',
      sender_id: user.id,
      content: bodyWithSig,
      is_internal_note: isNote,
      is_ai_suggested: isAiSuggested ?? false,
      ...(sentFromAddress ? { from_address: sentFromAddress } : {}),
      ...(externalMessageId ? { external_message_id: externalMessageId } : {}),
    })
    .select('id')
    .single()

  if (!message) {
    console.error('[reply] message insert failed:', msgError)
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
  }

  const convUpdate: Record<string, unknown> = {}
  if (!isNote && conversation.status === 'open') {
    convUpdate.status = 'in_progress'
    convUpdate.is_read = true
  }
  if (!isNote && attachments && attachments.length > 0) {
    convUpdate.has_attachments = true
  }
  if (Object.keys(convUpdate).length > 0) {
    // @ts-expect-error has_attachments not in generated types yet
    await supabase.from('conversations').update(convUpdate).eq('id', conversationId)
  }

  return NextResponse.json({ success: true, message_id: message.id })
}
