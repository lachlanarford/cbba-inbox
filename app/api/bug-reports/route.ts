import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  const admin = appUser ? isAdmin(appUser) : false

  const service = createServiceClient()
  let query = service
    .from('bug_reports')
    .select('*, submitted_by_user:users(full_name, email)')
    .order('created_at', { ascending: false })

  if (!admin) {
    query = query.eq('submitted_by', user.id) as typeof query
  }

  const { data } = await query
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { title: string; description: string; priority?: 'low' | 'medium' | 'high' }
  if (!body.title?.trim() || !body.description?.trim()) {
    return NextResponse.json({ error: 'Title and description are required' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('bug_reports')
    .insert({
      submitted_by: user.id,
      title: body.title.trim(),
      description: body.description.trim(),
      priority: body.priority ?? 'medium',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
