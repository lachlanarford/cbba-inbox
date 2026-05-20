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

  const body = await request.json() as { status?: 'open' | 'in_progress' | 'resolved'; priority?: 'low' | 'medium' | 'high' }
  const updates: { updated_at: string; status?: 'open' | 'in_progress' | 'resolved'; priority?: 'low' | 'medium' | 'high' } = { updated_at: new Date().toISOString() }
  if (body.status) updates.status = body.status
  if (body.priority) updates.priority = body.priority

  const service = createServiceClient()
  const { data, error } = await service
    .from('bug_reports')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
