import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const from = url.searchParams.get('from') ?? thirtyDaysAgo()
  const to = url.searchParams.get('to') ?? today()

  const supabase = createServiceClient()

  const { data: conversations } = await supabase
    .from('conversations')
    .select('channel, created_at')
    .gte('created_at', from)
    .lte('created_at', to + 'T23:59:59')

  // Group by day + channel
  const byDay = new Map<string, Map<string, number>>()
  const channels = new Set<string>()

  for (const conv of conversations ?? []) {
    const day = conv.created_at.slice(0, 10)
    const ch = conv.channel ?? 'unknown'
    channels.add(ch)
    if (!byDay.has(day)) byDay.set(day, new Map())
    const dayMap = byDay.get(day)!
    dayMap.set(ch, (dayMap.get(ch) ?? 0) + 1)
  }

  const channelList = Array.from(channels).sort()
  const result = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, chMap]) => {
      const row: Record<string, string | number> = { date }
      for (const ch of channelList) {
        row[ch] = chMap.get(ch) ?? 0
      }
      return row
    })

  return NextResponse.json({ data: result, channels: channelList })
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
function thirtyDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}
