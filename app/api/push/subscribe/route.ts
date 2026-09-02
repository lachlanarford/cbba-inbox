import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function setPushEnabled(userId: string, enabled: boolean) {
  const service = createServiceClient()
  const { data: existing } = await service
    .from('users')
    .select('settings')
    .eq('id', userId)
    .single()

  const currentSettings = (existing?.settings as Record<string, unknown>) ?? {}
  await service
    .from('users')
    .update({
      settings: { ...currentSettings, push_enabled: enabled } as import('@/types/supabase').Json,
    })
    .eq('id', userId)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const [{ data: profile }, { data: subs }] = await Promise.all([
    service.from('users').select('settings').eq('id', user.id).single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).from('push_subscriptions').select('id').eq('user_id', user.id).limit(1),
  ])

  const settings = (profile?.settings as Record<string, unknown>) ?? {}
  return NextResponse.json({
    supported: true,
    pushEnabled: settings.push_enabled === true,
    subscribed: (subs?.length ?? 0) > 0,
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let subscription: PushSubscriptionJSON
  try {
    subscription = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!subscription.endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  await db
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, endpoint: subscription.endpoint, subscription, updated_at: new Date().toISOString() },
      { onConflict: 'endpoint' }
    )

  await setPushEnabled(user.id, true)

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  let endpoint: string | undefined
  try {
    const body = await request.json() as { endpoint?: string }
    endpoint = body.endpoint
  } catch {
    // No body: remove all subscriptions for this user
  }

  if (endpoint) {
    await db.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id)
  } else {
    await db.from('push_subscriptions').delete().eq('user_id', user.id)
  }

  await setPushEnabled(user.id, false)

  return NextResponse.json({ ok: true })
}
