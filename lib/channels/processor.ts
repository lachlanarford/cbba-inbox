import { createServiceClient } from '@/lib/supabase/service'
import type { Channel } from '@/types/database'

export interface IncomingMessage {
  channel: Channel
  channelConfigId: string | null
  contactFullName: string | null
  contactEmail: string | null
  contactPhone: string | null
  contactSocialId: string | null
  subject: string
  content: string
  department?: string | null
  assignedTo?: string | null
  externalThreadId?: string | null
  externalMessageId?: string | null
  ccAddresses?: string[]
  rfcMessageId?: string | null
}

export interface ProcessResult {
  contactId: string
  conversationId: string
  messageId: string
}

export async function processStaffGmailReply(opts: {
  channelConfigId: string
  externalThreadId: string
  externalMessageId: string
  content: string
  fromAddress?: string | null
}): Promise<void> {
  const supabase = createServiceClient()

  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('external_thread_id', opts.externalThreadId)
    .eq('channel_config_id', opts.channelConfigId)
    .maybeSingle()

  if (!conv) return

  const { data: existing } = await supabase
    .from('messages')
    .select('id')
    .eq('external_message_id', opts.externalMessageId)
    .maybeSingle()

  if (existing) return

  await supabase.from('messages').insert({
    conversation_id: conv.id,
    sender_type: 'staff',
    sender_id: null,
    content: opts.content,
    is_internal_note: false,
    external_message_id: opts.externalMessageId,
    ...(opts.fromAddress ? { from_address: opts.fromAddress } : {}),
  })

  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString(), is_read: true })
    .eq('id', conv.id)
}

export async function processIncomingMessage(msg: IncomingMessage): Promise<ProcessResult> {
  const supabase = createServiceClient()

  // 1. Find or create contact
  let contactId: string

  if (msg.contactEmail) {
    const email = msg.contactEmail.trim().toLowerCase()
    const { data: existingRows } = await supabase
      .from('contacts')
      .select('id, full_name')
      .ilike('email', email)
      .limit(1)

    const existing = existingRows?.[0]
    if (existing) {
      contactId = existing.id
      if (msg.contactFullName && !existing.full_name) {
        await supabase.from('contacts').update({ full_name: msg.contactFullName }).eq('id', existing.id)
      }
    } else {
      const { data: created, error } = await supabase
        .from('contacts')
        .insert({
          full_name: msg.contactFullName,
          email,
          phone: msg.contactPhone ?? null,
          channel: msg.channel,
        })
        .select('id')
        .single()
      if (!created) throw new Error(`Failed to create contact: ${error?.message}`)
      contactId = created.id
    }
  } else if (msg.contactPhone) {
    const { data: existing } = await supabase
      .from('contacts')
      .select('id, full_name')
      .eq('phone', msg.contactPhone)
      .maybeSingle()

    if (existing) {
      contactId = existing.id
      if (msg.contactFullName && !existing.full_name) {
        await supabase.from('contacts').update({ full_name: msg.contactFullName }).eq('id', existing.id)
      }
    } else {
      const { data: created, error } = await supabase
        .from('contacts')
        .insert({
          full_name: msg.contactFullName,
          phone: msg.contactPhone,
          social_id: msg.contactSocialId ?? null,
          channel: msg.channel,
        })
        .select('id')
        .single()
      if (!created) throw new Error(`Failed to create contact: ${error?.message}`)
      contactId = created.id
    }
  } else if (msg.contactSocialId) {
    const { data: existing } = await supabase
      .from('contacts')
      .select('id, full_name')
      .eq('social_id', msg.contactSocialId)
      .maybeSingle()

    if (existing) {
      contactId = existing.id
      if (msg.contactFullName && !existing.full_name) {
        await supabase.from('contacts').update({ full_name: msg.contactFullName }).eq('id', existing.id)
      }
    } else {
      const { data: created, error } = await supabase
        .from('contacts')
        .insert({
          full_name: msg.contactFullName,
          social_id: msg.contactSocialId,
          channel: msg.channel,
        })
        .select('id')
        .single()
      if (!created) throw new Error(`Failed to create contact: ${error?.message}`)
      contactId = created.id
    }
  } else {
    throw new Error('Contact must have email, phone, or social_id')
  }

  // 2. Find or create conversation (thread-aware for Gmail)
  let conversationId: string

  if (msg.externalThreadId) {
    let existingQuery = supabase
      .from('conversations')
      .select('id, status, contact_id')
      .eq('external_thread_id', msg.externalThreadId)

    if (msg.channelConfigId) {
      existingQuery = existingQuery.eq('channel_config_id', msg.channelConfigId)
    }

    const { data: existing } = await existingQuery.maybeSingle()

    if (existing) {
      conversationId = existing.id
      const convUpdate: {
        is_read: boolean
        status?: string
        contact_id?: string
      } = {
        is_read: false,
        ...(existing.status === 'closed' ? { status: 'open' } : {}),
      }
      // CC (or another party) replied: retarget the conversation to the actual sender.
      // Stamp the original contact onto older messages that have no stored sender
      // so their cards keep showing the right person.
      if (existing.contact_id !== contactId) {
        const { data: previousContact } = await supabase
          .from('contacts')
          .select('full_name, email')
          .eq('id', existing.contact_id)
          .maybeSingle()
        if (previousContact) {
          await supabase
            .from('messages')
            .update({
              from_name: previousContact.full_name,
              from_address: previousContact.email,
            })
            .eq('conversation_id', conversationId)
            .eq('sender_type', 'contact')
            .is('from_address', null)
        }
        convUpdate.contact_id = contactId
      }
      await supabase
        .from('conversations')
        .update(convUpdate)
        .eq('id', conversationId)
    } else {
      const { data: created, error } = await supabase
        .from('conversations')
        .insert({
          contact_id: contactId,
          channel: msg.channel,
          channel_config_id: msg.channelConfigId,
          status: 'open',
          department: msg.department ?? null,
          assigned_to: msg.assignedTo ?? null,
          priority: 'medium',
          subject: msg.subject,
          is_read: false,
          external_thread_id: msg.externalThreadId,
        })
        .select('id')
        .single()
      if (!created) throw new Error(`Failed to create conversation: ${error?.message}`)
      conversationId = created.id
    }
  } else {
    const { data: created, error } = await supabase
      .from('conversations')
      .insert({
        contact_id: contactId,
        channel: msg.channel,
        channel_config_id: msg.channelConfigId,
        status: 'open',
        department: msg.department ?? null,
        assigned_to: msg.assignedTo ?? null,
        priority: 'medium',
        subject: msg.subject,
        is_read: false,
      })
      .select('id')
      .single()
    if (!created) throw new Error(`Failed to create conversation: ${error?.message}`)
    conversationId = created.id
  }

  // 3. Create message — skip if we've already stored this external message
  if (msg.externalMessageId) {
    const { data: existing } = await supabase
      .from('messages')
      .select('id')
      .eq('external_message_id', msg.externalMessageId)
      .maybeSingle()
    if (existing) return { contactId, conversationId, messageId: existing.id }
  }

  const { data: message, error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'contact',
      sender_id: null,
      content: msg.content,
      is_internal_note: false,
      ...(msg.externalMessageId ? { external_message_id: msg.externalMessageId } : {}),
      ...(msg.ccAddresses && msg.ccAddresses.length > 0 ? { cc_addresses: msg.ccAddresses } : {}),
      ...(msg.contactEmail ? { from_address: msg.contactEmail.trim().toLowerCase() } : {}),
      ...(msg.contactFullName ? { from_name: msg.contactFullName } : {}),
      ...(msg.rfcMessageId ? { rfc_message_id: msg.rfcMessageId } : {}),
    })
    .select('id')
    .single()
  if (!message) throw new Error(`Failed to create message: ${msgError?.message}`)

  return { contactId, conversationId, messageId: message.id }
}
