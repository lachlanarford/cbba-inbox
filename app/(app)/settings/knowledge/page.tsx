import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'
import KnowledgeManager from '@/components/settings/KnowledgeManager'
import type { KnowledgeEntryWithOwner } from '@/types/database'

export default async function KnowledgePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) redirect('/settings')

  const service = createServiceClient()
  const [{ data: entries }, { data: driveSettings }] = await Promise.all([
    service
      .from('knowledge_base')
      .select('*, created_by_user:users!created_by(id, full_name, avatar_url)')
      .order('created_at', { ascending: false }),
    service
      .from('settings')
      .select('key, value')
      .in('key', ['drive_folder_id', 'drive_service_account']),
  ])

  const driveMap = Object.fromEntries((driveSettings ?? []).map((s) => [s.key, s.value as string]))

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
        <p className="text-gray-400 text-sm mt-1">
          Content used to inform AI replies and the chat widget. Add URLs to scrape, create manual entries, or sync from Google Drive.
        </p>
      </div>
      <KnowledgeManager
        initialEntries={(entries ?? []) as unknown as KnowledgeEntryWithOwner[]}
        driveFolderId={driveMap['drive_folder_id'] ?? ''}
        driveHasServiceAccount={!!driveMap['drive_service_account']}
      />
    </div>
  )
}
