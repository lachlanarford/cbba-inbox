import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { mode: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { mode } = body
  if (mode !== 'ai' && mode !== 'live') {
    return NextResponse.json({ error: 'mode must be ai or live' }, { status: 400 })
  }

  const service = createServiceClient()
  const liveEnabled = mode === 'live'

  await service.from('users').update({ live_chat_enabled: liveEnabled }).eq('id', user.id)

  if (liveEnabled) {
    await service.from('live_chat_sessions').insert({ user_id: user.id })
  } else {
    await service
      .from('live_chat_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('ended_at', null)
  }

  return NextResponse.json({ mode })
}
