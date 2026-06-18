import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { full_name, email, phone } = body as { full_name?: string; email?: string; phone?: string }
  if (!full_name?.trim() && !email?.trim()) {
    return NextResponse.json({ error: 'Name or email required' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('contacts')
    .insert({
      full_name: full_name?.trim() || null,
      email: email?.trim().toLowerCase() || null,
      phone: phone?.trim() || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
