import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('contact_lists')
    .select('*, contact_list_members(count)')
    .order('created_at', { ascending: false })

  const lists = (data ?? []).map((l) => ({
    ...l,
    member_count: (l.contact_list_members as unknown as { count: number }[])[0]?.count ?? 0,
  }))

  return NextResponse.json({ lists })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { name: string; description?: string }
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('contact_lists')
    .insert({ name: body.name.trim(), description: body.description?.trim() || null, created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ list: data })
}
