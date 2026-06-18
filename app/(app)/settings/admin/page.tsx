import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'
import UserManager from '@/components/settings/UserManager'
import BugReportsAdmin from '@/components/settings/BugReportsAdmin'
import BrandingSettings from '@/components/settings/BrandingSettings'
import OfficeHoursSettings from '@/components/settings/OfficeHoursSettings'
import BroadcastNotification from '@/components/settings/BroadcastNotification'

export default async function AdminSettingsPage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
    if (!appUser || !isAdmin(appUser)) redirect('/settings')
  } catch {
    redirect('/login')
  }

  const service = createServiceClient()
  const [{ data: brandingRows }, { data: officeHoursRows }] = await Promise.all([
    service.from('settings').select('key, value').in('key', ['brand_accent_color', 'brand_logo_url']),
    service.from('settings').select('key, value').in('key', ['office_hours_enabled', 'office_hours_start', 'office_hours_end', 'office_hours_days', 'office_hours_timezone']),
  ])

  const branding = Object.fromEntries((brandingRows ?? []).map((s) => [s.key, s.value as string]))
  const oh = Object.fromEntries((officeHoursRows ?? []).map((s) => [s.key, s.value as string]))

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-white">Admin Settings</h1>
        <p className="text-xs text-gray-500 mt-0.5">Manage team members, branding, and workspace settings</p>
      </div>

      {/* Team members */}
      <UserManager />

      {/* Branding */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-4">Branding</h2>
        <BrandingSettings
          initialAccentColor={branding.brand_accent_color ?? '#604484'}
          initialLogoUrl={branding.brand_logo_url ?? ''}
        />
      </div>

      {/* Office hours */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-1">Office hours</h2>
        <p className="text-xs text-gray-500 mb-4">The chat widget uses AI mode outside these hours even if a staff member has live chat on</p>
        <div className="bg-cbba-navy-dark border border-white/10 rounded-xl p-6">
          <OfficeHoursSettings
            initialEnabled={oh.office_hours_enabled === 'true'}
            initialStart={oh.office_hours_start ?? '09:00'}
            initialEnd={oh.office_hours_end ?? '17:00'}
            initialDays={oh.office_hours_days ?? '1,2,3,4,5'}
            initialTimezone={oh.office_hours_timezone ?? 'Australia/Sydney'}
          />
        </div>
      </div>

      {/* Bug reports */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-4">Bug Reports</h2>
        <BugReportsAdmin />
      </div>

      {/* Broadcast notification */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-1">Staff notifications</h2>
        <p className="text-xs text-gray-500 mb-4">Send in-app and push notifications to all staff</p>
        <BroadcastNotification />
      </div>
    </div>
  )
}
