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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (admin.id === params.id) {
    return NextResponse.json({ error: 'Cannot modify your own account' }, { status: 400 })
  }

  const VALID_DEPTS = ['Reps', 'Comps', 'LTP', 'Other', 'Referees']
  const body = await request.json() as { role?: string; is_active?: boolean; department?: string | null }
  const updates: { role?: 'admin' | 'staff'; is_active?: boolean; department?: string | null } = {}

  if (body.role === 'admin' || body.role === 'staff') updates.role = body.role
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active
  if ('department' in body) updates.department = body.department && VALID_DEPTS.includes(body.department) ? body.department : null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('users')
    // @ts-expect-error department not yet in generated types
    .update(updates)
    .eq('id', params.id)
    .select('id, email, full_name, avatar_url, role, is_active, department, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
