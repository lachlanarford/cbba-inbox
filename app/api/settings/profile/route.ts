import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { full_name?: string; signature?: string }

  const service = createServiceClient()
  const { data: existing } = await service
    .from('users')
    .select('settings')
    .eq('id', user.id)
    .single()

  const currentSettings = (existing?.settings as Record<string, unknown>) ?? {}
  const newSettings = { ...currentSettings }
  if (typeof body.signature === 'string') newSettings.signature = body.signature

  const updates: { full_name?: string | null; settings?: import('@/types/supabase').Json } = {
    settings: newSettings as import('@/types/supabase').Json,
  }
  if (typeof body.full_name === 'string') {
    updates.full_name = body.full_name.trim() || null
  }

  const { data, error } = await service
    .from('users')
    .update(updates)
    .eq('id', user.id)
    .select('id, email, full_name, avatar_url, role, settings')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
