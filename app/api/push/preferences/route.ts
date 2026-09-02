import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  DEFAULT_PUSH_PREFERENCES,
  getPushPreferences,
  type PushPreferences,
} from '@/lib/push/send'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service
    .from('users')
    .select('settings')
    .eq('id', user.id)
    .single()

  const settings = (profile?.settings as Record<string, unknown>) ?? {}
  return NextResponse.json({
    pushEnabled: settings.push_enabled === true,
    preferences: getPushPreferences(settings),
  })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { preferences?: Partial<PushPreferences> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.preferences || typeof body.preferences !== 'object') {
    return NextResponse.json({ error: 'preferences required' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: existing } = await service
    .from('users')
    .select('settings')
    .eq('id', user.id)
    .single()

  const currentSettings = (existing?.settings as Record<string, unknown>) ?? {}
  const currentPrefs = getPushPreferences(currentSettings)
  const merged = { ...currentPrefs, ...body.preferences }

  await service
    .from('users')
    .update({
      settings: {
        ...currentSettings,
        push_preferences: merged,
      } as import('@/types/supabase').Json,
    })
    .eq('id', user.id)

  return NextResponse.json({ preferences: merged })
}
