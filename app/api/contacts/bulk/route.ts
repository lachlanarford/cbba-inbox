import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { ids: string[]; action: 'delete' | 'archive' | 'unarchive' }
  const { ids, action } = body

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids is required' }, { status: 400 })
  }
  if (!['delete', 'archive', 'unarchive'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const service = createServiceClient()

  if (action === 'delete') {
    const { error } = await service.from('contacts').delete().in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await service
      .from('contacts')
      // @ts-expect-error is_archived not yet in generated types
      .update({ is_archived: action === 'archive' })
      .in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, count: ids.length })
}
