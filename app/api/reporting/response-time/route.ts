import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const from = url.searchParams.get('from') ?? thirtyDaysAgo()
  const to = url.searchParams.get('to') ?? today()

  const supabase = createServiceClient()

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, created_at')
    .gte('created_at', from)
    .lte('created_at', to + 'T23:59:59')

  if (!conversations?.length) {
    return NextResponse.json([])
  }

  const ids = conversations.map((c) => c.id)
  const { data: firstReplies } = await supabase
    .from('messages')
    .select('conversation_id, created_at')
    .in('conversation_id', ids)
    .in('sender_type', ['staff', 'ai'])
    .order('created_at', { ascending: true })

  // Map: conversation_id -> first reply time
  const firstReplyMap = new Map<string, string>()
  for (const msg of firstReplies ?? []) {
    if (!firstReplyMap.has(msg.conversation_id)) {
      firstReplyMap.set(msg.conversation_id, msg.created_at)
    }
  }

  // Group by day, compute avg response time in hours
  const byDay = new Map<string, number[]>()
  for (const conv of conversations) {
    const day = conv.created_at.slice(0, 10)
    const replyAt = firstReplyMap.get(conv.id)
    if (!replyAt) continue
    const hours = (Date.parse(replyAt) - Date.parse(conv.created_at)) / 3_600_000
    if (hours >= 0) {
      if (!byDay.has(day)) byDay.set(day, [])
      byDay.get(day)!.push(hours)
    }
  }

  const result = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, hours]) => ({
      date,
      avg_hours: Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10,
    }))

  return NextResponse.json(result)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
function thirtyDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}
