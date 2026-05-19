import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) return null
  return appUser
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, avatar_url, role, is_active, created_at')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as { email?: string; full_name?: string; role?: string }
  const { email, full_name, role } = body

  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }
  if (role !== 'admin' && role !== 'staff') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: inviteData, error: inviteError } = await service.auth.admin.inviteUserByEmail(
    email.trim().toLowerCase()
  )

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 })
  }

  const userId = inviteData.user.id

  // Pre-insert the user row with the desired role before they accept the invite
  const { data: newUser, error: insertError } = await service
    .from('users')
    .upsert(
      {
        id: userId,
        email: email.trim().toLowerCase(),
        full_name: full_name?.trim() || null,
        role,
        is_active: true,
      },
      { onConflict: 'id' }
    )
    .select('id, email, full_name, avatar_url, role, is_active, created_at')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(newUser, { status: 201 })
}
