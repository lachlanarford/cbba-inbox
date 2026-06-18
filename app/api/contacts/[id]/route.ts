import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const allowed = ['full_name', 'email', 'phone'] as const
  type AllowedKey = (typeof allowed)[number]
  const parsed = body as Record<string, unknown>
  const updates: Partial<Record<AllowedKey, string | null>> = {}
  for (const key of allowed) {
    if (key in parsed) {
      const v = parsed[key]
      updates[key] = typeof v === 'string' ? (v.trim() || null) : null
    }
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('contacts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
