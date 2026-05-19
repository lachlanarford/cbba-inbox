import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { id: conversationId } = params
  const supabase = createServiceClient()

  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', conversationId)
    .select('*, contact:contacts(full_name, email)')
    .single()

  if (convError || !conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const contact = conv.contact as unknown as { full_name: string | null; email: string | null } | null

  // Create feedback request record (idempotent — unique constraint on conversation_id)
  const { data: feedbackRow } = await supabase
    .from('feedback_requests')
    .insert({
      conversation_id: conversationId,
      contact_email: contact?.email ?? null,
      contact_name: contact?.full_name ?? null,
    })
    .select('token')
    .single()

  return NextResponse.json({
    ok: true,
    feedbackToken: feedbackRow?.token ?? null,
    contactEmail: contact?.email ?? null,
    contactName: contact?.full_name ?? null,
    subject: conv.subject ?? null,
  })
}
