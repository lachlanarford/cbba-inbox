import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth'
import UserManager from '@/components/settings/UserManager'

export default async function AdminSettingsPage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: appUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!appUser || !isAdmin(appUser)) redirect('/settings')
  } catch {
    redirect('/login')
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">Admin Settings</h1>
        <p className="text-xs text-gray-500 mt-0.5">Manage team members and access</p>
      </div>
      <UserManager />
    </div>
  )
}
