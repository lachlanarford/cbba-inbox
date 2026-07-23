import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNewEmail } from '@/lib/gmail/client'

async function findOrCreateContact(
  service: ReturnType<typeof createServiceClient>,
  email: string,
  contactId?: string
): Promise<string | null> {
  if (contactId) return contactId

  const normalised = email.trim().toLowerCase()
  const { data: existing } = await service
    .from('contacts')
    .select('id')
    .ilike('email', normalised)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created, error } = await service
    .from('contacts')
    .insert({
      full_name: normalised.split('@')[0] || normalised,
      email: normalised,
      channel: 'gmail',
    })
    .select('id')
    .single()

  if (!created) {
    console.error('[compose] contact create failed:', error)
    return null
  }
  return created.id
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'User not found' }, { status: 401 })

  let body: {
    to: string
    recipients?: string[]
    bcc?: string[]
    subject: string
    content: string
    contactId?: string
    channelConfigId?: string
    department?: string | null
    priority?: string | null
    assignedTo?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { to, recipients, bcc, subject, content, contactId, channelConfigId, department, priority, assignedTo } = body
  // recipients is the new bulk path; bcc kept for backwards compatibility with older clients
  const bulkList = (recipients && recipients.length > 0)
    ? recipients
    : (bcc && bcc.length > 0 && !to?.trim() ? bcc : null)
  const isBulk = !!bulkList && bulkList.length > 0

  if (!isBulk && !to?.trim()) return NextResponse.json({ error: 'to required' }, { status: 400 })
  if (!subject?.trim()) return NextResponse.json({ error: 'subject required' }, { status: 400 })
  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 })
  if (!channelConfigId?.trim()) {
    return NextResponse.json({ error: 'channelConfigId required — select a From address' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: channelConfig } = await service
    .from('channel_configs')
    .select('id, identifier, is_active')
    .eq('id', channelConfigId)
    .eq('channel_type', 'gmail')
    .single()

  if (!channelConfig) {
    return NextResponse.json({ error: 'Gmail channel not found' }, { status: 400 })
  }
  if (!channelConfig.is_active) {
    return NextResponse.json({ error: 'Gmail channel is not active' }, { status: 400 })
  }

  const signature = (appUser.settings as Record<string, unknown>)?.signature as string | undefined
  const bodyWithSig = signature?.trim()
    ? `${content.trim()}\n\n--\n${signature.trim()}`
    : content.trim()

  // Bulk: one separate email + conversation per recipient (avoids shared-thread collisions)
  if (isBulk && bulkList) {
    const uniqueEmails = Array.from(new Set(
      bulkList.map((e) => e.trim().toLowerCase()).filter(Boolean)
    ))

    const conversationIds: string[] = []
    const failed: Array<{ email: string; error: string }> = []

    for (const email of uniqueEmails) {
      try {
        const recipientContactId = await findOrCreateContact(service, email)
        if (!recipientContactId) {
          failed.push({ email, error: 'Failed to create contact' })
          continue
        }

        const result = await sendNewEmail(channelConfig.id, {
          to: email,
          from: channelConfig.identifier,
          subject: subject.trim(),
          body: bodyWithSig,
        })
        const threadId = result.threadId || result.messageId

        const { data: conversation, error: convError } = await service
          .from('conversations')
          .insert({
            channel: 'gmail',
            channel_config_id: channelConfig.id,
            contact_id: recipientContactId,
            subject: subject.trim(),
            status: 'open',
            external_thread_id: threadId,
            last_message_at: new Date().toISOString(),
            is_read: true,
            department: (department ?? null) as unknown as string,
            priority: (priority ?? 'low') as unknown as string,
            assigned_to: (assignedTo ?? null) as unknown as string,
          })
          .select('id')
          .single()

        if (!conversation) {
          console.error('[compose] bulk conversation insert failed:', convError)
          failed.push({ email, error: 'Email sent but failed to create conversation' })
          continue
        }

        await service.from('messages').insert({
          conversation_id: conversation.id,
          sender_type: 'staff',
          sender_id: user.id,
          content: bodyWithSig,
          is_internal_note: false,
          external_message_id: result.messageId,
          from_address: channelConfig.identifier,
        })

        conversationIds.push(conversation.id)
      } catch (err) {
        console.error('[compose] bulk send failed for', email, err)
        failed.push({ email, error: 'Failed to send email' })
      }
    }

    if (conversationIds.length === 0) {
      return NextResponse.json({
        error: failed[0]?.error ?? 'Failed to send any emails',
        sent: 0,
        failed,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      conversationId: conversationIds[0],
      conversationIds,
      sent: conversationIds.length,
      failed,
    })
  }

  // Single recipient
  let threadId: string
  let gmailMessageId: string
  try {
    const result = await sendNewEmail(channelConfig.id, {
      to: to.trim(),
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

  const resolvedContactId = await findOrCreateContact(service, to.trim(), contactId)
  if (!resolvedContactId) {
    return NextResponse.json({ error: 'Email sent but failed to create contact' }, { status: 500 })
  }

  const { data: conversation, error: convError } = await service
    .from('conversations')
    .insert({
      channel: 'gmail',
      channel_config_id: channelConfig.id,
      contact_id: resolvedContactId,
      subject: subject.trim(),
      status: 'open',
      external_thread_id: threadId,
      last_message_at: new Date().toISOString(),
      is_read: true,
      department: (department ?? null) as unknown as string,
      priority: (priority ?? 'low') as unknown as string,
      assigned_to: (assignedTo ?? null) as unknown as string,
    })
    .select('id')
    .single()

  if (!conversation) {
    console.error('[compose] conversation insert failed:', convError)
    return NextResponse.json({ error: 'Email sent but failed to create conversation record' }, { status: 500 })
  }

  await service.from('messages').insert({
    conversation_id: conversation.id,
    sender_type: 'staff',
    sender_id: user.id,
    content: bodyWithSig,
    is_internal_note: false,
    external_message_id: gmailMessageId,
    from_address: channelConfig.identifier,
  })

  return NextResponse.json({ success: true, conversationId: conversation.id })
}
