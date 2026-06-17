import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Contact } from '@/types/database'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('contact_list_members')
    .select('contact_id, added_at, contacts(*)')
    .eq('list_id', params.id)
    .order('added_at', { ascending: false })

  const members = (data ?? []).map((r) => ({
    ...(r.contacts as unknown as Contact),
    added_at: r.added_at,
  }))

  return NextResponse.json({ members })
}

// Add contacts to list
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { contact_ids: string[] }
  if (!body.contact_ids?.length) return NextResponse.json({ error: 'No contacts provided' }, { status: 400 })

  const rows = body.contact_ids.map((contact_id) => ({ list_id: params.id, contact_id }))
  const { error } = await supabase.from('contact_list_members').upsert(rows, { onConflict: 'list_id,contact_id', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, added: rows.length })
}

// Remove contacts from list
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { contact_ids: string[] }
  if (!body.contact_ids?.length) return NextResponse.json({ error: 'No contacts provided' }, { status: 400 })

  const { error } = await supabase
    .from('contact_list_members')
    .delete()
    .eq('list_id', params.id)
    .in('contact_id', body.contact_ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
