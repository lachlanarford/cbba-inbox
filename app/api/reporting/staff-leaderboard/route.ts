import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const from = url.searchParams.get('from') ?? thirtyDaysAgo()
  const to = url.searchParams.get('to') ?? today()
  const channel = url.searchParams.get('channel') ?? ''
  const department = url.searchParams.get('department') ?? ''

  const supabase = createServiceClient()

  // Get conversations in range
  let convQuery = supabase
    .from('conversations')
    .select('id, status, assigned_to, created_at')
    .gte('created_at', from)
    .lte('created_at', to + 'T23:59:59')
  if (channel) convQuery = convQuery.eq('channel', channel)
  if (department) convQuery = convQuery.eq('department', department)
  const { data: conversations } = await convQuery

  const convIds = (conversations ?? []).map((c) => c.id)
  if (!convIds.length) return NextResponse.json([])

  // Get staff messages in those conversations
  const { data: messages } = await supabase
    .from('messages')
    .select('sender_id, conversation_id')
    .in('conversation_id', convIds)
    .eq('sender_type', 'staff')
    .eq('is_internal_note', false)

  // Get all staff users
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, avatar_url')
    .eq('is_active', true)

  const userMap = new Map((users ?? []).map((u) => [u.id, u]))

  // Build per-staff stats
  const stats = new Map<string, { total: number; closed: number; messages: number }>()

  for (const conv of conversations ?? []) {
    if (!conv.assigned_to) continue
    const s = stats.get(conv.assigned_to) ?? { total: 0, closed: 0, messages: 0 }
    s.total++
    if (conv.status === 'closed') s.closed++
    stats.set(conv.assigned_to, s)
  }

  for (const msg of messages ?? []) {
    if (!msg.sender_id) continue
    const s = stats.get(msg.sender_id) ?? { total: 0, closed: 0, messages: 0 }
    s.messages++
    stats.set(msg.sender_id, s)
  }

  const { data: chatSessions } = await supabase
    .from('live_chat_sessions')
    .select('user_id, started_at, ended_at')
    .gte('started_at', from)
    .lte('started_at', to + 'T23:59:59')

  const chatMinutes = new Map<string, number>()
  for (const s of chatSessions ?? []) {
    const end = s.ended_at ? new Date(s.ended_at) : new Date()
    const mins = Math.max(0, (end.getTime() - new Date(s.started_at).getTime()) / 60000)
    chatMinutes.set(s.user_id, (chatMinutes.get(s.user_id) ?? 0) + mins)
  }

  const result = Array.from(stats.entries())
    .map(([id, s]) => ({
      id,
      name: userMap.get(id)?.full_name ?? 'Unknown',
      avatar_url: userMap.get(id)?.avatar_url ?? null,
      total: s.total,
      closed: s.closed,
      messages: s.messages,
      chatMins: Math.round(chatMinutes.get(id) ?? 0),
    }))
    .filter((r) => r.total > 0 || r.messages > 0)
    .sort((a, b) => b.total - a.total || b.messages - a.messages)

  return NextResponse.json(result)
}

function today(): string { return new Date().toISOString().slice(0, 10) }
function thirtyDaysAgo(): string {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
}
