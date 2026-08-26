import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'
import KnowledgeManager from '@/components/settings/KnowledgeManager'

export default async function KnowledgePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) redirect('/settings')

  const service = createServiceClient()
  const [{ data: driveSettingsRows }, { data: gmailConfigs }] = await Promise.all([
    service
      .from('settings')
      .select('key, value')
      .in('key', ['drive_folder_id', 'drive_channel_config_id']),
    service
      .from('channel_configs')
      .select('id, identifier')
      .eq('channel_type', 'gmail')
      .order('identifier'),
  ])

  const driveSettings = Object.fromEntries((driveSettingsRows ?? []).map((s) => [s.key, s.value as string]))

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
        <p className="text-gray-400 text-sm mt-1">
          Documents synced from Google Drive, plus curated website FAQs, are used by the AI when answering questions in the chat widget.
        </p>
      </div>
      <KnowledgeManager
        driveFolderId={driveSettings['drive_folder_id'] ?? ''}
        driveChannelConfigId={driveSettings['drive_channel_config_id'] ?? ''}
        gmailAccounts={(gmailConfigs ?? []).map((c) => ({ id: c.id, email: c.identifier }))}
      />
    </div>
  )
}
