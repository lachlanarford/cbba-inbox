import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'
import BrandingSettings from '@/components/settings/BrandingSettings'

export default async function BrandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) redirect('/settings')

  const service = createServiceClient()
  const { data: settings } = await service
    .from('settings')
    .select('key, value')
    .in('key', ['brand_accent_color', 'brand_logo_url'])

  const brandingMap = Object.fromEntries((settings ?? []).map((s) => [s.key, s.value as string]))

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">Branding</h1>
        <p className="text-xs text-gray-500 mt-0.5">Customise the logo and accent colour</p>
      </div>
      <BrandingSettings
        initialAccentColor={brandingMap.brand_accent_color ?? '#604484'}
        initialLogoUrl={brandingMap.brand_logo_url ?? ''}
      />
    </div>
  )
}
