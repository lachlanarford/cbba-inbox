import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth'
import CannedResponsesManager from '@/components/settings/CannedResponsesManager'

export default async function CannedResponsesPage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
    if (!appUser || !isAdmin(appUser)) redirect('/settings')
  } catch {
    redirect('/login')
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <CannedResponsesManager />
    </div>
  )
}
