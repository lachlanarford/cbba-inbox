import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'
import { createOAuth2Client, watchInbox } from '@/lib/gmail/client'

const INBOX_DEPARTMENTS: Record<string, string> = {
  'info@blacktownbasketball.com': 'Other',
  'competitions@blacktownbasketball.com': 'Comps',
  'reps@blacktownbasketball.com': 'Reps',
  'learntoplay@blacktownbasketball.com': 'LTP',
  'referees@blacktownbasketball.com': 'Referees',
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) {
    return NextResponse.redirect(new URL('/settings', request.url))
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // encoded email address
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(new URL('/settings/channels?error=gmail_auth', request.url))
  }

  const email = decodeURIComponent(state)

  try {
    const oauth2 = createOAuth2Client()
    const { tokens } = await oauth2.getToken(code)

    const serviceClient = createServiceClient()

    // Upsert the channel_config for this Gmail inbox
    const { data: existing } = await serviceClient
      .from('channel_configs')
      .select('id')
      .eq('channel_type', 'gmail')
      .eq('identifier', email)
      .maybeSingle()

    let configId: string

    if (existing) {
      await serviceClient
        .from('channel_configs')
        .update({ credentials: tokens as unknown as import('@/types/supabase').Json })
        .eq('id', existing.id)
      configId = existing.id
    } else {
      const department = INBOX_DEPARTMENTS[email.toLowerCase()] ?? 'Other'
      const { data: created } = await serviceClient
        .from('channel_configs')
        .insert({
          channel_type: 'gmail',
          display_name: email,
          identifier: email,
          credentials: tokens as unknown as import('@/types/supabase').Json,
          is_active: false,
          metadata: { default_department: department },
        })
        .select('id')
        .single()
      if (!created) throw new Error('Failed to create channel config')
      configId = created.id
    }

    // Register Pub/Sub watch for this inbox
    if (process.env.GMAIL_PUBSUB_TOPIC) {
      await watchInbox(configId)
    }

    return NextResponse.redirect(new URL('/settings/channels?connected=gmail', request.url))
  } catch (err) {
    console.error('[gmail/auth/callback]', err)
    return NextResponse.redirect(new URL('/settings/channels?error=gmail_auth', request.url))
  }
}
