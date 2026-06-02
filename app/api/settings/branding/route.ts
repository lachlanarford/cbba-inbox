import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'

const ALLOWED_KEYS = new Set(['brand_accent_color', 'brand_logo_url'])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body: { key: string; value: string } = await request.json()
  if (!ALLOWED_KEYS.has(body.key)) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
  }

  const service = createServiceClient()
  await service.from('settings').upsert({ key: body.key, value: body.value, updated_at: new Date().toISOString() })

  return NextResponse.json({ ok: true })
}
