import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'
import { watchInbox } from '@/lib/gmail/client'

async function handleRenew(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isCron) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
    if (!appUser || !isAdmin(appUser)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  if (!process.env.GMAIL_PUBSUB_TOPIC) {
    return NextResponse.json({ error: 'GMAIL_PUBSUB_TOPIC not configured' }, { status: 500 })
  }

  const serviceClient = createServiceClient()
  const { data: configs, error } = await serviceClient
    .from('channel_configs')
    .select('id, identifier, metadata')
    .eq('channel_type', 'gmail')
    .eq('is_active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: { email: string; status: string }[] = []

  for (const config of configs ?? []) {
    try {
      const historyId = await watchInbox(config.id)
      const metadata = (config.metadata ?? {}) as Record<string, string>
      await serviceClient
        .from('channel_configs')
        .update({ metadata: { ...metadata, history_id: historyId } })
        .eq('id', config.id)
      results.push({ email: config.identifier, status: 'ok' })
    } catch (err) {
      results.push({ email: config.identifier, status: String(err) })
    }
  }

  return NextResponse.json({ results })
}

export async function GET(request: Request) {
  return handleRenew(request)
}

export async function POST(request: Request) {
  return handleRenew(request)
}
