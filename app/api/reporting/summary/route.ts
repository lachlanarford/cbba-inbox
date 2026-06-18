import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const from = url.searchParams.get('from') ?? thirtyDaysAgo()
  const to = url.searchParams.get('to') ?? today()
  const channel = url.searchParams.get('channel') ?? ''
  const department = url.searchParams.get('department') ?? ''

  const supabase = createServiceClient()

  let convQuery = supabase
    .from('conversations')
    .select('id, status, created_at')
    .gte('created_at', from)
    .lte('created_at', to + 'T23:59:59')
  if (channel) convQuery = convQuery.eq('channel', channel)
  if (department) convQuery = convQuery.eq('department', department)

  const { data: conversations } = await convQuery
  const total = (conversations ?? []).length
  const closed = (conversations ?? []).filter((c) => c.status === 'closed').length
  const closedRate = total > 0 ? Math.round((closed / total) * 100) : 0

  // Avg first response time
  let avgResponseHours: number | null = null
  if (conversations?.length) {
    const ids = conversations.map((c) => c.id)
    const { data: firstReplies } = await supabase
      .from('messages')
      .select('conversation_id, created_at')
      .in('conversation_id', ids)
      .in('sender_type', ['staff', 'ai'])
      .order('created_at', { ascending: true })

    const firstReplyMap = new Map<string, string>()
    for (const msg of firstReplies ?? []) {
      if (!firstReplyMap.has(msg.conversation_id)) {
        firstReplyMap.set(msg.conversation_id, msg.created_at)
      }
    }

    const responseTimes: number[] = []
    for (const conv of conversations) {
      const replyAt = firstReplyMap.get(conv.id)
      if (!replyAt) continue
      const hours = (Date.parse(replyAt) - Date.parse(conv.created_at)) / 3_600_000
      if (hours >= 0) responseTimes.push(hours)
    }

    if (responseTimes.length > 0) {
      avgResponseHours =
        Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10
    }
  }

  // Avg feedback rating
  const convIds = (conversations ?? []).map((c) => c.id)
  let avgRating: number | null = null
  if (convIds.length) {
    const { data: feedback } = await supabase
      .from('feedback_requests')
      .select('rating')
      .in('conversation_id', convIds)
      .not('rating', 'is', null)

    const ratings = (feedback ?? []).map((f) => f.rating).filter(Boolean) as number[]
    if (ratings.length > 0) {
      avgRating = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    }
  }

  // App-initiated: conversations where the first message is from staff
  let appInitiated = 0
  if (convIds.length) {
    const { data: allFirstMsgs } = await supabase
      .from('messages')
      .select('conversation_id, sender_type, created_at')
      .in('conversation_id', convIds)
      .eq('is_internal_note', false)
      .order('created_at', { ascending: true })

    const firstMsgBySender = new Map<string, string>()
    for (const m of allFirstMsgs ?? []) {
      if (!firstMsgBySender.has(m.conversation_id)) {
        firstMsgBySender.set(m.conversation_id, m.sender_type)
      }
    }
    appInitiated = Array.from(firstMsgBySender.values()).filter((t) => t === 'staff').length
  }

  return NextResponse.json({ total, closed, closedRate, avgResponseHours, avgRating, appInitiated })
}

function today(): string { return new Date().toISOString().slice(0, 10) }
function thirtyDaysAgo(): string {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
}
