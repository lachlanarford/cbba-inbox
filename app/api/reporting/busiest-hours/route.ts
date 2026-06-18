import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const from = url.searchParams.get('from') ?? thirtyDaysAgo()
  const to = url.searchParams.get('to') ?? today()
  const channel = url.searchParams.get('channel') ?? ''
  const department = url.searchParams.get('department') ?? ''
  const tz = url.searchParams.get('tz') ?? 'Australia/Sydney'

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
    const hour = getLocalHour(conv.created_at, tz)
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

function getLocalHour(isoString: string, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: tz, hour: 'numeric', hour12: false }).formatToParts(new Date(isoString))
    const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
    return h === 24 ? 0 : h
  } catch {
    return new Date(isoString).getUTCHours()
  }
}
