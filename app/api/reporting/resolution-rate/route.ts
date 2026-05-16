import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const from = url.searchParams.get('from') ?? thirtyDaysAgo()
  const to = url.searchParams.get('to') ?? today()

  const supabase = createServiceClient()

  const { data: conversations } = await supabase
    .from('conversations')
    .select('status')
    .gte('created_at', from)
    .lte('created_at', to + 'T23:59:59')

  const counts: Record<string, number> = {
    open: 0,
    in_progress: 0,
    waiting: 0,
    closed: 0,
  }

  for (const conv of conversations ?? []) {
    const s = conv.status ?? 'open'
    counts[s] = (counts[s] ?? 0) + 1
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const closedRate = total > 0 ? Math.round((counts.closed / total) * 100) : 0

  return NextResponse.json({
    counts,
    total,
    closed_rate: closedRate,
    breakdown: [
      { name: 'Open', value: counts.open, color: '#60a5fa' },
      { name: 'In Progress', value: counts.in_progress, color: '#FBB33F' },
      { name: 'Waiting', value: counts.waiting, color: '#a78bfa' },
      { name: 'Closed', value: counts.closed, color: '#4ade80' },
    ],
  })
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
function thirtyDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}
