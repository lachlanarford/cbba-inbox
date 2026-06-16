import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'

const ALLOWED_KEYS = new Set(['drive_folder_id', 'drive_service_account'])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  let body: { key: string; value: string }
  try {
    body = await request.json() as { key: string; value: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!ALLOWED_KEYS.has(body.key)) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('settings')
    .upsert({ key: body.key, value: body.value }, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
