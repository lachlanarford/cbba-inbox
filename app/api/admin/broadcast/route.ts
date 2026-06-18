import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'
import { sendPushToAll } from '@/lib/push/send'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()

  // Get all active staff
  const { data: users } = await service
    .from('users')
    .select('id')
    .eq('is_active', true)

  if (!users || users.length === 0) return NextResponse.json({ sent: 0 })

  // Insert in-app notification for each user
  await service.from('notifications').insert(
    users.map((u) => ({
      user_id: u.id,
      type: 'app_update',
      title: "What's new in CBBA Inbox",
      body: 'Mobile layout, email contacts, email all lists, and more. Tap to see all updates.',
      read: false,
    }))
  )

  // Send push notification to all subscribed devices
  await sendPushToAll({
    title: "What's new in CBBA Inbox",
    body: 'Mobile layout, email contacts, email all lists, and more.',
    url: '/changelog',
  })

  return NextResponse.json({ sent: users.length })
}
