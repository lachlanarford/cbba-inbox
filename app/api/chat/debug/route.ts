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

  const supabase = createServiceClient()

  const { data: setting, error: settingError } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'chat_mode')
    .single()

  const chatMode = setting?.value ?? 'ai'

  let sessionInfo = null
  let pollSimulation: Record<string, unknown> = {}

  if (sessionId) {
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('id, role, conversation_id, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(10)
    sessionInfo = msgs

    // Simulate what the poll endpoint would do
    const { data: sessionMsg, error: sessionMsgError } = await supabase
      .from('chat_messages')
      .select('conversation_id')
      .eq('session_id', sessionId)
      .not('conversation_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    pollSimulation = { sessionMsgLookup: sessionMsg, sessionMsgError: sessionMsgError?.message ?? null }

    if (sessionMsg?.conversation_id) {
      const convId = sessionMsg.conversation_id

      const [convResult, staffMsgs] = await Promise.all([
        supabase.from('conversations').select('id, status, subject').eq('id', convId).single(),
        supabase.from('messages')
          .select('id, sender_type, is_internal_note, content, created_at')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      pollSimulation = {
        ...pollSimulation,
        conversationId: convId,
        conversation: convResult.data,
        allRecentMessages: staffMsgs.data ?? [],
        staffRepliesForPoll: (staffMsgs.data ?? []).filter(
          (m) => m.sender_type === 'staff' && m.is_internal_note === false
        ),
      }
    }
  }

  const { data: recentConvs } = await supabase
    .from('conversations')
    .select('id, subject, status, channel, created_at')
    .eq('channel', 'chat')
    .order('created_at', { ascending: false })
    .limit(5)

  return NextResponse.json({
    chatMode,
    settingError: settingError?.message ?? null,
    recentChatConversations: recentConvs ?? [],
    sessionChatMessages: sessionInfo,
    pollSimulation,
  }, { headers: CORS_HEADERS })
}
