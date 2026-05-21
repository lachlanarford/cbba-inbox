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
  if (sessionId) {
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('id, role, conversation_id, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(5)
    sessionInfo = msgs
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
  }, { headers: CORS_HEADERS })
}
