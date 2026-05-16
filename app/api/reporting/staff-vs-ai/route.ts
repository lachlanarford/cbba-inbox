import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const from = url.searchParams.get('from') ?? thirtyDaysAgo()
  const to = url.searchParams.get('to') ?? today()

  const supabase = createServiceClient()

  const { data: messages } = await supabase
    .from('messages')
    .select('sender_type')
    .gte('created_at', from)
    .lte('created_at', to + 'T23:59:59')
    .in('sender_type', ['staff', 'ai'])

  const counts = { staff: 0, ai: 0 }
  for (const msg of messages ?? []) {
    if (msg.sender_type === 'staff') counts.staff++
    else if (msg.sender_type === 'ai') counts.ai++
  }

  return NextResponse.json([
    { name: 'Staff', value: counts.staff },
    { name: 'AI', value: counts.ai },
  ])
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
function thirtyDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}
