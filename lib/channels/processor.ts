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
}

export interface ProcessResult {
  contactId: string
  conversationId: string
  messageId: string
}

export async function processIncomingMessage(msg: IncomingMessage): Promise<ProcessResult> {
  const supabase = createServiceClient()

  // 1. Find or create contact
  let contactId: string

  if (msg.contactEmail) {
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', msg.contactEmail)
      .maybeSingle()

    if (existing) {
      contactId = existing.id
    } else {
      const { data: created, error } = await supabase
        .from('contacts')
        .insert({
          full_name: msg.contactFullName,
          email: msg.contactEmail,
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
      .select('id')
      .eq('phone', msg.contactPhone)
      .maybeSingle()

    if (existing) {
      contactId = existing.id
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
    const { data: existing } = await supabase
      .from('conversations')
      .select('id, status')
      .eq('external_thread_id', msg.externalThreadId)
      .maybeSingle()

    if (existing) {
      conversationId = existing.id
      await supabase
        .from('conversations')
        .update({ is_read: false, ...(existing.status === 'closed' ? { status: 'open' } : {}) })
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

  // 3. Create message
  const { data: message, error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'contact',
      sender_id: null,
      content: msg.content,
      is_internal_note: false,
    })
    .select('id')
    .single()
  if (!message) throw new Error(`Failed to create message: ${msgError?.message}`)

  return { contactId, conversationId, messageId: message.id }
}
