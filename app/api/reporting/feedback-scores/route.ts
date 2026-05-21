import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const from = url.searchParams.get('from') ?? thirtyDaysAgo()
  const to = url.searchParams.get('to') ?? today()
  const channel = url.searchParams.get('channel') ?? ''
  const department = url.searchParams.get('department') ?? ''

  const supabase = createServiceClient()

  let feedbackQuery = supabase
    .from('feedback_requests')
    .select('rating, responded_at')
    .not('rating', 'is', null)
    .gte('responded_at', from)
    .lte('responded_at', to + 'T23:59:59')

  if (channel || department) {
    let convQuery = supabase.from('conversations').select('id')
    if (channel) convQuery = convQuery.eq('channel', channel)
    if (department) convQuery = convQuery.eq('department', department)
    const { data: convs } = await convQuery
    const ids = (convs ?? []).map((c) => c.id)
    if (!ids.length) return NextResponse.json({ weekly: [], overall: null, total: 0 })
    feedbackQuery = feedbackQuery.in('conversation_id', ids)
  }

  const { data: rows } = await feedbackQuery

  // Group by week (Monday)
  const byWeek = new Map<string, number[]>()
  for (const row of rows ?? []) {
    if (!row.responded_at || !row.rating) continue
    const week = getMonday(row.responded_at)
    if (!byWeek.has(week)) byWeek.set(week, [])
    byWeek.get(week)!.push(row.rating)
  }

  const result = Array.from(byWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, ratings]) => ({
      week,
      avg: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10,
      count: ratings.length,
    }))

  const allRatings = (rows ?? []).map((r) => r.rating).filter(Boolean) as number[]
  const overall =
    allRatings.length > 0
      ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10
      : null

  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of allRatings) {
    const star = Math.min(5, Math.max(1, Math.round(r)))
    dist[star]++
  }

  return NextResponse.json({ weekly: result, overall, total: allRatings.length, distribution: dist })
}

function getMonday(isoDate: string): string {
  const d = new Date(isoDate)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
function thirtyDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}
