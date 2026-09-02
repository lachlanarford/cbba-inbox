import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  sendReply as sendGmailReply,
  formatGmailError,
  fetchAttachmentData,
  type OutboundAttachment,
} from '@/lib/gmail/client'
import { parseAttachmentMarker } from '@/lib/email/forward-quote'
import { sendMetaMessage } from '@/lib/channels/meta'
import { sendMessage as sendWhatsAppMessage } from '@/lib/whatsapp/client'
import { notifyMentionedUsers, autoAddStaffCollaborators } from '@/lib/conversations/collaborators'

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
    isForward?: boolean
    mentionedUserIds?: string[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { content, isNote, isAiSuggested, attachments, to, cc, bcc, channelConfigId: overrideConfigId, isForward, mentionedUserIds } = body
  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const { data: conversation } = await supabase
    .from('conversations')
    .select('*, contact:contacts(email, full_name, social_id, phone)')
    .eq('id', conversationId)
    .single()

  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  if (isForward && conversation.channel === 'gmail' && !to?.trim()) {
    return NextResponse.json({ error: 'Enter a recipient to forward to' }, { status: 400 })
  }

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

      const recipientEmail = isForward
        ? to?.trim()
        : contact?.email?.trim() ?? null
      if (!recipientEmail) {
        return NextResponse.json(
          { error: isForward ? 'Enter a recipient to forward to' : 'Contact has no email address' },
          { status: 400 }
        )
      }

      try {
        const sendingFromOtherInbox = !!(
          overrideConfigId &&
          conversation.channel_config_id &&
          overrideConfigId !== conversation.channel_config_id
        )

        const { data: lastInbound } = await service
          .from('messages')
          .select('rfc_message_id, content')
          .eq('conversation_id', conversationId)
          .eq('sender_type', 'contact')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        const inReplyTo = isForward
          ? null
          : ((lastInbound as { rfc_message_id?: string | null } | null)?.rfc_message_id ?? null)

        const canUseThread = !isForward && !!conversation.external_thread_id && !sendingFromOtherInbox

        const outboundAttachments: OutboundAttachment[] = [...(attachments ?? [])]
        if (isForward && lastInbound?.content) {
          const marker = parseAttachmentMarker(lastInbound.content)
          if (marker && conversation.channel_config_id) {
            let total = outboundAttachments.reduce((sum, a) => sum + (a.data.length * 3) / 4, 0)
            for (const item of marker.items) {
              if (total + item.size > 25 * 1024 * 1024) break
              try {
                const data = await fetchAttachmentData(conversation.channel_config_id, marker.msgId, item.id)
                if (!data) continue
                outboundAttachments.push({
                  name: item.name,
                  mimeType: item.mimeType,
                  data,
                })
                total += item.size
              } catch (err) {
                console.error('[reply] forward attachment skipped:', item.name, err)
              }
            }
          }
        }

        const sent = await sendGmailReply(channelConfig.id, {
          threadId: canUseThread ? conversation.external_thread_id : null,
          inReplyTo,
          to: recipientEmail,
          from: channelConfig.identifier,
          subject: conversation.subject ?? '(no subject)',
          body: bodyWithSig,
          attachments: outboundAttachments,
          cc: cc ?? [],
          bcc: bcc ?? [],
          isForward: !!isForward,
        })

        sentFromAddress = channelConfig.identifier
        externalMessageId = sent.messageId

        if (!isNote) {
          const excludeEmails = [
            contact?.email,
            channelConfig.identifier,
            recipientEmail,
          ].filter((e): e is string => !!e)

          await autoAddStaffCollaborators({
            conversationId,
            emails: [...(cc ?? []), ...(bcc ?? [])],
            addedBy: user.id,
            subject: conversation.subject,
            excludeEmails,
          })
        }

        // Keep the original Gmail thread on this conversation. A forward is a new
        // outbound message; replies to it will arrive as a separate conversation.
        if (!isForward) {
          const convPatch: { channel_config_id?: string; external_thread_id?: string } = {}
          if (sendingFromOtherInbox || !conversation.external_thread_id) {
            convPatch.channel_config_id = channelConfig.id
            convPatch.external_thread_id = sent.threadId
          }
          if (Object.keys(convPatch).length > 0) {
            await service.from('conversations').update(convPatch).eq('id', conversationId)
          }
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

  const outboundCc = !isNote && conversation.channel === 'gmail' && cc && cc.length > 0 ? cc : null

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
      ...(outboundCc ? { cc_addresses: outboundCc } : {}),
    })
    .select('id')
    .single()

  if (!message) {
    console.error('[reply] message insert failed:', msgError)
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
  }

  if (isNote && mentionedUserIds?.length) {
    const authorName = appUser.full_name?.trim() || appUser.email
    const service = createServiceClient()
    await notifyMentionedUsers({
      userIds: mentionedUserIds,
      authorId: user.id,
      authorName,
      conversationId,
      subject: conversation.subject,
      excerpt: content.trim(),
    })
  }

  const convUpdate: Record<string, unknown> = {}
  if (!isNote) {
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
