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

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ exists: false }, { headers: CORS_HEADERS })
  }

  const supabase = createServiceClient()

  const { data: sessionMsg } = await supabase
    .from('chat_messages')
    .select('conversation_id')
    .eq('session_id', sessionId)
    .not('conversation_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!sessionMsg?.conversation_id) {
    return NextResponse.json({ exists: false }, { headers: CORS_HEADERS })
  }

  const conversationId = sessionMsg.conversation_id

  const { data: conv } = await supabase
    .from('conversations')
    .select('id, status, subject, contact:contacts(full_name)')
    .eq('id', conversationId)
    .single()

  if (!conv) {
    return NextResponse.json({ exists: false }, { headers: CORS_HEADERS })
  }

  const isLive = (conv.subject ?? '').startsWith('Live Chat')
  const mode = isLive ? 'live' : 'ai'
  const isClosed = conv.status === 'closed'
  const contact = conv.contact as unknown as { full_name: string | null } | null
  const contactName = contact?.full_name ?? null

  let messages: { id: string | null; role: 'user' | 'ai'; content: string }[] = []

  if (isLive) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, sender_type, content')
      .eq('conversation_id', conversationId)
      .eq('is_internal_note', false)
      .order('created_at', { ascending: true })
      .limit(50)

    messages = (msgs ?? []).map((m) => ({
      id: m.id,
      role: (m.sender_type === 'contact' ? 'user' : 'ai') as 'user' | 'ai',
      content: m.sender_type === 'staff' ? stripHtml(m.content) : m.content,
    }))
  } else {
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('id, role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(50)

    messages = (msgs ?? []).map((m) => ({
      id: m.id,
      role: (m.role === 'user' ? 'user' : 'ai') as 'user' | 'ai',
      content: m.content,
    }))
  }

  let feedbackToken: string | null = null
  if (isClosed) {
    const { data: fb } = await supabase
      .from('feedback_requests')
      .select('token')
      .eq('conversation_id', conversationId)
      .maybeSingle()
    feedbackToken = fb?.token ?? null
  }

  return NextResponse.json({
    exists: true,
    mode,
    closed: isClosed,
    contactName,
    messages,
    feedbackToken,
  }, { headers: CORS_HEADERS })
}
