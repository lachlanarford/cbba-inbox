import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  let body: { session_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS_HEADERS })
  }

  const { session_id } = body
  if (!session_id) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400, headers: CORS_HEADERS })
  }

  const supabase = createServiceClient()

  // Find the conversation for this session
  const { data: sessionMsg } = await supabase
    .from('chat_messages')
    .select('conversation_id')
    .eq('session_id', session_id)
    .not('conversation_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!sessionMsg?.conversation_id) {
    return NextResponse.json({ ok: true, feedbackToken: null }, { headers: CORS_HEADERS })
  }

  const conversationId = sessionMsg.conversation_id

  // Close the conversation
  const { data: conv } = await supabase
    .from('conversations')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', conversationId)
    .select('*, contact:contacts(full_name, email)')
    .single()

  const contact = conv?.contact as unknown as { full_name: string | null; email: string | null } | null

  // Create feedback request (ignore conflict if already exists)
  const { data: feedbackRow } = await supabase
    .from('feedback_requests')
    .upsert({
      conversation_id: conversationId,
      contact_email: contact?.email ?? null,
      contact_name: contact?.full_name ?? null,
    }, { onConflict: 'conversation_id', ignoreDuplicates: true })
    .select('token')
    .single()

  // If upsert returned nothing (duplicate), fetch the existing token
  let token = feedbackRow?.token ?? null
  if (!token) {
    const { data: existing } = await supabase
      .from('feedback_requests')
      .select('token')
      .eq('conversation_id', conversationId)
      .single()
    token = existing?.token ?? null
  }

  return NextResponse.json({ ok: true, feedbackToken: token }, { headers: CORS_HEADERS })
}
