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
    .select('priority')
    .gte('created_at', from)
    .lte('created_at', to + 'T23:59:59')
  if (channel) query = query.eq('channel', channel)
  if (department) query = query.eq('department', department)

  const { data } = await query

  const counts: Record<string, number> = { low: 0, medium: 0, high: 0, urgent: 0 }
  for (const conv of data ?? []) {
    const p = conv.priority ?? 'medium'
    counts[p] = (counts[p] ?? 0) + 1
  }

  return NextResponse.json([
    { name: 'Low',    value: counts.low,    color: '#60a5fa' },
    { name: 'Medium', value: counts.medium, color: '#FBB33F' },
    { name: 'High',   value: counts.high,   color: '#F58945' },
    { name: 'Urgent', value: counts.urgent, color: '#f87171' },
  ])
}

function today(): string { return new Date().toISOString().slice(0, 10) }
function thirtyDaysAgo(): string {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
}
