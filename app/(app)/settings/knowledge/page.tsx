import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'
import KnowledgeManager from '@/components/settings/KnowledgeManager'
import type { KnowledgeBaseEntry } from '@/types/database'

export default async function KnowledgePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) redirect('/settings')

  const service = createServiceClient()
  const { data: entries } = await service
    .from('knowledge_base')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
        <p className="text-gray-400 text-sm mt-1">
          Content used to inform AI replies and the chat widget. Add URLs to scrape or create manual entries.
        </p>
      </div>
      <KnowledgeManager initialEntries={(entries ?? []) as unknown as KnowledgeBaseEntry[]} />
    </div>
  )
}
