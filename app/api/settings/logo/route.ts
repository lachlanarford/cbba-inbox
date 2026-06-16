import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('logo') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'File must be under 2MB' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'svg']
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: 'Only JPG, PNG, WebP or SVG allowed' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const path = `logo.${ext}`

  const service = createServiceClient()
  const { error: uploadError } = await service.storage
    .from('branding')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = service.storage.from('branding').getPublicUrl(path)

  // Cache-bust with a timestamp so browsers pick up the new logo
  const urlWithBust = `${publicUrl}?t=${Date.now()}`

  await service.from('settings').upsert(
    { key: 'brand_logo_url', value: urlWithBust, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )

  return NextResponse.json({ logo_url: urlWithBust })
}
