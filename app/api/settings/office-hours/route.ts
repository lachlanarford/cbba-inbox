import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'

const OFFICE_HOURS_KEYS = ['office_hours_enabled', 'office_hours_start', 'office_hours_end', 'office_hours_days', 'office_hours_timezone'] as const

export async function GET() {
  const service = createServiceClient()
  const { data } = await service.from('settings').select('key, value').in('key', OFFICE_HOURS_KEYS as unknown as string[])
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value as string]))
  return NextResponse.json({
    enabled: map.office_hours_enabled === 'true',
    start: map.office_hours_start ?? '09:00',
    end: map.office_hours_end ?? '17:00',
    days: map.office_hours_days ?? '1,2,3,4,5',
    timezone: map.office_hours_timezone ?? 'Australia/Sydney',
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await request.json() as { enabled: boolean; start: string; end: string; days: string; timezone: string }

  const service = createServiceClient()
  await service.from('settings').upsert([
    { key: 'office_hours_enabled', value: String(body.enabled) },
    { key: 'office_hours_start', value: body.start },
    { key: 'office_hours_end', value: body.end },
    { key: 'office_hours_days', value: body.days },
    { key: 'office_hours_timezone', value: body.timezone },
  ], { onConflict: 'key' })

  return NextResponse.json({ ok: true })
}
