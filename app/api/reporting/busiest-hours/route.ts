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
    .select('created_at')
    .gte('created_at', from)
    .lte('created_at', to + 'T23:59:59')
  if (channel) query = query.eq('channel', channel)
  if (department) query = query.eq('department', department)

  const { data } = await query

  const counts = new Array(24).fill(0) as number[]
  for (const conv of data ?? []) {
    const hour = new Date(conv.created_at).getUTCHours()
    counts[hour]++
  }

  return NextResponse.json(
    counts.map((count, hour) => ({
      hour: `${String(hour).padStart(2, '0')}:00`,
      count,
    }))
  )
}

function today(): string { return new Date().toISOString().slice(0, 10) }
function thirtyDaysAgo(): string {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
}
