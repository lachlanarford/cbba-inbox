import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'

const VALID_DEPTS = ['Reps', 'Comps', 'LTP', 'Other', 'Referees']

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  const { data: entries } = await service
    .from('knowledge_base')
    .select('*, created_by_user:users!created_by(id, full_name, avatar_url)')
    .order('created_at', { ascending: false })

  return NextResponse.json({ entries: entries ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, content, department, category } = body
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'title and content are required' }, { status: 400 })
  }

  const service = createServiceClient()
  const deptValue = department && VALID_DEPTS.includes(department) ? department : null
  const categoryValue = category?.trim() || null

  // Insert base entry (type-safe), then patch new columns separately
  const { data, error } = await service
    .from('knowledge_base')
    .insert({ title: title.trim(), content: content.trim(), source_type: 'manual' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // @ts-expect-error department/category/created_by not yet in generated types
  await service.from('knowledge_base').update({ created_by: user.id, department: deptValue, category: categoryValue }).eq('id', (data as { id: string }).id)

  const { data: full, error: fetchErr } = await service
    .from('knowledge_base')
    .select('*, created_by_user:users!created_by(id, full_name, avatar_url)')
    .eq('id', (data as { id: string }).id)
    .single()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  return NextResponse.json({ entry: full })
}
