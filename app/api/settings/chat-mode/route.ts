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
  await service
    .from('settings')
    .upsert({ key: 'chat_mode', value: mode, updated_at: new Date().toISOString() })

  return NextResponse.json({ mode })
}
