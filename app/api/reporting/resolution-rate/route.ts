import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const from = url.searchParams.get('from') ?? thirtyDaysAgo()
  const to = url.searchParams.get('to') ?? today()
  const channel = url.searchParams.get('channel') ?? ''
  const department = url.searchParams.get('department') ?? ''

  const supabase = createServiceClient()

  let query = supabase
    .from('conversations')
    .select('status')
    .gte('created_at', from)
    .lte('created_at', to + 'T23:59:59')
  if (channel) query = query.eq('channel', channel)
  if (department) query = query.eq('department', department)

  const { data: conversations } = await query

  let open = 0
  let closed = 0

  for (const conv of conversations ?? []) {
    if (conv.status === 'closed') closed++
    else open++
  }

  const total = open + closed
  const closedRate = total > 0 ? Math.round((closed / total) * 100) : 0

  return NextResponse.json({
    counts: { open, closed },
    total,
    closed_rate: closedRate,
    breakdown: [
      { name: 'Open', value: open, color: '#60a5fa' },
      { name: 'Closed', value: closed, color: '#4ade80' },
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
