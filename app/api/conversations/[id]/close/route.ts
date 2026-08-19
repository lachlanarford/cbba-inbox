import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { closeConversation } from '@/lib/conversations/close'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: conversationId } = await params
  const service = createServiceClient()
  const result = await closeConversation(service, conversationId)

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Close failed' }, { status: 404 })
  }

  const { data: conv } = await service
    .from('conversations')
    .select('*, contact:contacts(full_name, email)')
    .eq('id', conversationId)
    .single()

  const contact = conv?.contact as unknown as { full_name: string | null; email: string | null } | null

  const { data: feedbackRow } = await service
    .from('feedback_requests')
    .select('token')
    .eq('conversation_id', conversationId)
    .maybeSingle()

  return NextResponse.json({
    ok: true,
    feedbackToken: feedbackRow?.token ?? null,
    contactEmail: contact?.email ?? null,
    contactName: contact?.full_name ?? null,
    subject: conv?.subject ?? null,
  })
}
