import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth'

export default async function AdminSettingsPage() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: appUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!appUser || !isAdmin(appUser)) {
      redirect('/settings')
    }
  } catch {
    redirect('/login')
  }

  return (
    <div className="flex items-center justify-center h-full text-gray-400">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-white">Admin Settings</h2>
        <p className="text-sm">User management and system configuration will be added in Phase 5.</p>
      </div>
    </div>
  )
}
