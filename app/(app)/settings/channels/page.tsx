import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth'
import ChannelManager from '@/components/settings/ChannelManager'
import type { ChannelConfig } from '@/types/database'

export default async function ChannelsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) redirect('/settings')

  const { data: configs } = await supabase
    .from('channel_configs')
    .select('*')
    .order('channel_type')

  const formSecret = process.env.FORM_WEBHOOK_SECRET ?? ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Channel Management</h1>
        <p className="text-sm text-gray-400 mt-1">Connect and manage inbound message channels.</p>
      </div>
      <ChannelManager
        configs={(configs ?? []) as unknown as ChannelConfig[]}
        formWebhookUrl={`${appUrl}/api/webhooks/form`}
        formSecret={formSecret}
      />
    </div>
  )
}
