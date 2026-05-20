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
    return NextResponse.json({ messages: [] }, { headers: CORS_HEADERS })
  }

  // Fetch staff replies since the given timestamp
  let query = supabase
    .from('messages')
    .select('id, content, created_at, sender_type')
    .eq('conversation_id', sessionMsg.conversation_id)
    .eq('sender_type', 'staff')
    .eq('is_internal_note', false)
    .order('created_at', { ascending: true })

  if (since) {
    query = query.gt('created_at', since)
  }

  const { data: messages } = await query

  return NextResponse.json({
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      content: m.content,
      created_at: m.created_at,
    })),
  }, { headers: CORS_HEADERS })
}
