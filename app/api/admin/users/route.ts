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
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as { email?: string; full_name?: string; role?: string; department?: string }
  const { email, full_name, role, department } = body

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
  const VALID_DEPTS = ['Reps', 'Comps', 'LTP', 'Other']
  // Insert without department first (type-safe), then patch department separately
  const { data: newUser, error: insertError } = await service
    .from('users')
    .upsert(
      { id: userId, email: email.trim().toLowerCase(), full_name: full_name?.trim() || null, role: role as 'admin' | 'staff', is_active: true },
      { onConflict: 'id' }
    )
    .select('id, email, full_name, avatar_url, role, is_active, department, created_at')
    .single()

  const deptValue = department && VALID_DEPTS.includes(department) ? department : null
  if (newUser && deptValue) {
    // @ts-expect-error department not yet in generated types (update after running supabase gen types)
    await service.from('users').update({ department: deptValue }).eq('id', (newUser as { id: string }).id)
  }

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(newUser, { status: 201 })
}
