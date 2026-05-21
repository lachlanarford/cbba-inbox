import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  const since = searchParams.get('since')

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400, headers: CORS_HEADERS })
  }

  const supabase = createServiceClient()

  // Find the conversation linked to this chat session
  const { data: sessionMsg } = await supabase
    .from('chat_messages')
    .select('conversation_id')
    .eq('session_id', sessionId)
    .not('conversation_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!sessionMsg?.conversation_id) {
    return NextResponse.json({ messages: [], closed: false, feedbackToken: null }, { headers: CORS_HEADERS })
  }

  const conversationId = sessionMsg.conversation_id

  // Check conversation status and fetch feedback token in parallel
  const [convResult, feedbackResult] = await Promise.all([
    supabase
      .from('conversations')
      .select('status')
      .eq('id', conversationId)
      .single(),
    supabase
      .from('feedback_requests')
      .select('token')
      .eq('conversation_id', conversationId)
      .maybeSingle(),
  ])

  const isClosed = convResult.data?.status === 'closed'
  const feedbackToken = feedbackResult.data?.token ?? null

  // Fetch all staff replies for this conversation (client deduplicates by ID)
  const { data: messages } = await supabase
    .from('messages')
    .select('id, content, created_at')
    .eq('conversation_id', conversationId)
    .eq('sender_type', 'staff')
    .eq('is_internal_note', false)
    .order('created_at', { ascending: true })

  function stripHtml(html: string) {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
  }

  return NextResponse.json({
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      content: stripHtml(m.content),
      created_at: m.created_at,
    })),
    closed: isClosed,
    feedbackToken,
  }, { headers: CORS_HEADERS })
}
