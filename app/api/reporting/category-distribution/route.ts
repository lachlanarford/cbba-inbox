import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const from = url.searchParams.get('from') ?? thirtyDaysAgo()
  const to = url.searchParams.get('to') ?? today()

  const supabase = createServiceClient()

  const { data: conversations } = await supabase
    .from('conversations')
    .select('department')
    .gte('created_at', from)
    .lte('created_at', to + 'T23:59:59')

  const counts = new Map<string, number>()
  for (const conv of conversations ?? []) {
    const dept = conv.department ?? 'Unassigned'
    counts.set(dept, (counts.get(dept) ?? 0) + 1)
  }

  const result = Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

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
