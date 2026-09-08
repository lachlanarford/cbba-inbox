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
import {
  appendReplyHistory,
  buildReplyHistoryHtml,
  extractEmails,
  type HistoryMessage,
} from '@/lib/email/reply-history'
import { sendMetaMessage } from '@/lib/channels/meta'
import { sendMessage as sendWhatsAppMessage } from '@/lib/whatsapp/client'
import { notifyMentionedUsers, autoAddStaffCollaborators, notifyConversationWatchers, ensureReplierIsCollaborator } from '@/lib/conversations/collaborators'
import { isFormRelaySender, parseFormSubmissionContact, extractEmailAddress, isDirtyContactEmail } from '@/lib/email/form-submission'

type ContactRow = {
  id?: string
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
    .select('*, contact:contacts(id, email, full_name, social_id, phone)')
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
  let sentFromName: string | null = appUser.full_name?.trim() || null
  let externalMessageId: string | null = null
  let rfcMessageId: string | null = null
  let storedCc: string[] | null = null

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

      const { data: threadMessages } = await service
        .from('messages')
        .select('content, from_address, from_name, created_at, sender_type, sender_id, cc_addresses, rfc_message_id')
        .eq('conversation_id', conversationId)
        .eq('is_internal_note', false)
        .order('created_at', { ascending: true })

      const historyRows = threadMessages ?? []
      const lastInbound = [...historyRows].reverse().find((m) => m.sender_type === 'contact') ?? null

      // Existing Squarespace threads stored the form relay as the contact email,
      // or polluted the email field with form metadata like "accepts marketing: false".
      const toEmails = extractEmails(to)
      let recipientEmail = isForward
        ? (toEmails[0] ?? to?.trim() ?? null)
        : (toEmails[0] ?? contact?.email?.trim() ?? null)
      let toHeader = (to?.trim().replace(/,\s*$/, '') || recipientEmail || '')

      if (!isForward && (isFormRelaySender(recipientEmail) || isDirtyContactEmail(recipientEmail))) {
        const formContact = parseFormSubmissionContact(lastInbound?.content ?? '', {
          fromEmail: lastInbound?.from_address ?? recipientEmail,
          subject: conversation.subject,
        })
        const cleaned = formContact?.email ?? extractEmailAddress(recipientEmail)
        if (cleaned) {
          recipientEmail = cleaned
          toHeader = cleaned
          if (contact?.id && cleaned !== contact.email?.trim().toLowerCase()) {
            await service
              .from('contacts')
              .update({
                email: cleaned,
                ...(formContact?.fullName && !contact.full_name
                  ? { full_name: formContact.fullName }
                  : {}),
              })
              .eq('id', contact.id)
          }
        }
      }

      if (!recipientEmail || !toHeader) {
        return NextResponse.json(
          { error: isForward ? 'Enter a recipient to forward to' : 'Contact has no email address' },
          { status: 400 }
        )
      }

      if (!isForward && isFormRelaySender(recipientEmail)) {
        return NextResponse.json(
          { error: 'This form email has no submitter address to reply to. Check the form body for an Email field.' },
          { status: 400 }
        )
      }

      try {
        const sendingFromOtherInbox = !!(
          overrideConfigId &&
          conversation.channel_config_id &&
          overrideConfigId !== conversation.channel_config_id
        )

        const rfcIds = historyRows
          .map((m) => m.rfc_message_id)
          .filter((id): id is string => !!id?.trim())
        const inReplyTo = isForward ? null : (rfcIds[rfcIds.length - 1] ?? null)

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

        let outboundBody = bodyWithSig
        if (!isForward && historyRows.length > 0) {
          const staffIds = Array.from(new Set(
            historyRows
              .map((m) => m.sender_id)
              .filter((id): id is string => !!id)
          ))
          const staffMap = new Map<string, { full_name: string | null; email: string | null }>()
          if (staffIds.length > 0) {
            const { data: staffUsers } = await service
              .from('users')
              .select('id, full_name, email')
              .in('id', staffIds)
            for (const u of staffUsers ?? []) {
              staffMap.set(u.id, { full_name: u.full_name, email: u.email })
            }
          }

          const history: HistoryMessage[] = historyRows.map((m) => {
            const staff = m.sender_id ? staffMap.get(m.sender_id) : undefined
            return {
              content: m.content,
              fromName:
                m.from_name
                || (m.sender_type === 'staff' ? staff?.full_name ?? null : contact?.full_name ?? null),
              fromAddress:
                m.from_address
                || (m.sender_type === 'staff' ? staff?.email ?? channelConfig.identifier : contact?.email ?? null),
              createdAt: m.created_at,
              to: m.sender_type === 'contact' ? channelConfig.identifier : (contact?.email ?? null),
              cc: m.cc_addresses,
            }
          })
          outboundBody = appendReplyHistory(bodyWithSig, buildReplyHistoryHtml(history))
        }

        const sent = await sendGmailReply(channelConfig.id, {
          threadId: canUseThread ? conversation.external_thread_id : null,
          inReplyTo,
          references: isForward ? null : rfcIds,
          to: toHeader,
          from: channelConfig.identifier,
          subject: conversation.subject ?? '(no subject)',
          body: outboundBody,
          attachments: outboundAttachments,
          cc: cc ?? [],
          bcc: bcc ?? [],
          isForward: !!isForward,
        })

        sentFromAddress = channelConfig.identifier
        externalMessageId = sent.messageId
        rfcMessageId = sent.rfcMessageId

        const existingCc = (cc ?? []).map((e) => e.trim()).filter(Boolean)
        const existingCcLower = new Set(existingCc.map((e) => e.toLowerCase()))
        const extraTo = extractEmails(toHeader).filter((e) => {
          const lower = e.toLowerCase()
          return (
            lower !== (contact?.email?.trim().toLowerCase() ?? '') &&
            lower !== channelConfig.identifier.toLowerCase() &&
            !existingCcLower.has(lower)
          )
        })
        const mergedCc = [...existingCc, ...extraTo]
        storedCc = mergedCc.length > 0 ? mergedCc : null

        if (!isNote) {
          const excludeEmails = [
            contact?.email,
            channelConfig.identifier,
            ...extractEmails(toHeader),
            recipientEmail,
          ].filter((e): e is string => !!e)

          await autoAddStaffCollaborators({
            conversationId,
            emails: [...extractEmails(toHeader), ...(cc ?? []), ...(bcc ?? [])],
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

  const outboundCc = storedCc ?? (
    !isNote && conversation.channel === 'gmail' && cc && cc.length > 0 ? cc : null
  )

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
      ...(sentFromName ? { from_name: sentFromName } : {}),
      ...(externalMessageId ? { external_message_id: externalMessageId } : {}),
      ...(rfcMessageId ? { rfc_message_id: rfcMessageId } : {}),
      ...(outboundCc ? { cc_addresses: outboundCc } : {}),
    })
    .select('id')
    .single()

  if (!message) {
    console.error('[reply] message insert failed:', msgError)
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
  }

  // Anyone who replies/notes on a conversation they do not own becomes a collaborator
  // so it appears in their My Inbox alongside the assignee.
  await ensureReplierIsCollaborator({
    conversationId,
    userId: user.id,
    assignedTo: conversation.assigned_to,
    channelConfigId: conversation.channel_config_id,
    subject: conversation.subject,
  })

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

  const authorName = appUser.full_name?.trim() || appUser.email
  if (isNote) {
    const exclude = [user.id, ...(mentionedUserIds ?? [])]
    await notifyConversationWatchers({
      conversationId,
      excludeUserIds: exclude,
      type: 'note',
      title: `${authorName} added an internal note`,
      body: content.trim().slice(0, 120),
      subject: conversation.subject,
      pushAuthorName: authorName,
    })
  } else {
    await notifyConversationWatchers({
      conversationId,
      excludeUserIds: [user.id],
      type: 'message',
      title: `Reply sent by ${authorName}`,
      body: conversation.subject ?? 'No subject',
      subject: conversation.subject,
      pushAuthorName: authorName,
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
