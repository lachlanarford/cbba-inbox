import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') ?? new Date(Date.now() - 7 * 86400000).toISOString()
  const to = searchParams.get('to') ?? new Date().toISOString()

  const service = createServiceClient()
  const { data: sessions } = await service
    .from('live_chat_sessions')
    .select('user_id, started_at, ended_at')
    .gte('started_at', from)
    .lte('started_at', to)
    .order('started_at', { ascending: false })

  const { data: users } = await service
    .from('users')
    .select('id, full_name, avatar_url')
    .eq('is_active', true)

  const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]))

  // Aggregate per user
  const byUser: Record<string, { total_seconds: number; session_count: number }> = {}
  for (const s of sessions ?? []) {
    const end = s.ended_at ? new Date(s.ended_at) : new Date()
    const seconds = Math.max(0, (end.getTime() - new Date(s.started_at).getTime()) / 1000)
    if (!byUser[s.user_id]) byUser[s.user_id] = { total_seconds: 0, session_count: 0 }
    byUser[s.user_id].total_seconds += seconds
    byUser[s.user_id].session_count += 1
  }

  const rows = Object.entries(byUser)
    .map(([userId, stats]) => ({
      user: userMap[userId] ?? { id: userId, full_name: 'Unknown', avatar_url: null },
      ...stats,
    }))
    .sort((a, b) => b.total_seconds - a.total_seconds)

  return NextResponse.json({ rows })
}
