import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let channelConfigId: string | null = null
  let department: string | null = null
  try {
    const body = await request.json() as { channelConfigId?: string; department?: string }
    channelConfigId = body.channelConfigId ?? null
    department = body.department ?? null
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!channelConfigId || !department) {
    return NextResponse.json({ error: 'channelConfigId and department required' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('conversations')
    .update({ department })
    .eq('channel_config_id', channelConfigId)
    .select('id')

  if (error) {
    console.error('[backfill-departments]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: data?.length ?? 0 })
}
