import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { AppUserProvider } from '@/contexts/AppUserContext'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import PushInit from '@/components/layout/PushInit'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  let { data: appUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  // Row missing -- upsert it (handles cases where the auth callback insert failed or row exists but wasn't visible)
  if (!appUser) {
    const { data: upsertedUser, error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          id: user.id,
          email: user.email ?? '',
          full_name: user.user_metadata?.full_name ?? null,
          avatar_url: user.user_metadata?.avatar_url ?? null,
          role: 'staff',
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )
      .select('*')
      .single()

    if (!upsertedUser) {
      // ignoreDuplicates returns null on conflict -- try fetching the existing row
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!existingUser) {
        console.error('[layout] failed to fetch/create user row', { upsertError, fetchError, userId: user.id })
        redirect('/login')
      }
      appUser = existingUser
    } else {
      appUser = upsertedUser
    }
  }

  const service = createServiceClient()
  const [{ data: brandingSettings }, { data: liveChatUsers }] = await Promise.all([
    service.from('settings').select('key, value').in('key', ['brand_accent_color', 'brand_logo_url']),
    service.from('users').select('id, full_name, avatar_url').eq('live_chat_enabled', true).eq('is_active', true),
  ])
  const brandingMap = Object.fromEntries((brandingSettings ?? []).map((s) => [s.key, s.value]))
  const accentHex: string = (brandingMap.brand_accent_color as string) ?? '#604484'
  const logoUrl: string | null = (brandingMap.brand_logo_url as string) ?? null

  function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace('#', '')
    const r = parseInt(clean.slice(0, 2), 16)
    const g = parseInt(clean.slice(2, 4), 16)
    const b = parseInt(clean.slice(4, 6), 16)
    return [isNaN(r) ? 96 : r, isNaN(g) ? 68 : g, isNaN(b) ? 132 : b]
  }
  function lighten([r, g, b]: [number, number, number], amount: number): string {
    return `${Math.min(255, r + amount)} ${Math.min(255, g + amount)} ${Math.min(255, b + amount)}`
  }
  function darken([r, g, b]: [number, number, number], amount: number): string {
    return `${Math.max(0, r - amount)} ${Math.max(0, g - amount)} ${Math.max(0, b - amount)}`
  }
  const rgb = hexToRgb(accentHex)
  const cssVars = {
    '--accent-rgb': `${rgb[0]} ${rgb[1]} ${rgb[2]}`,
    '--accent-light-rgb': lighten(rgb, 26),
    '--accent-dark-rgb': darken(rgb, 22),
  } as React.CSSProperties

  return (
    <AppUserProvider user={appUser}>
      <PushInit />
      <div className="flex h-screen overflow-hidden bg-cbba-navy" style={cssVars}>
        <Sidebar user={appUser} logoUrl={logoUrl} initialLiveChatUsers={liveChatUsers ?? []} />
        <div className="flex flex-col flex-1 min-w-0">
          <TopBar userId={appUser.id} />
          <main className="flex-1 overflow-auto p-6 relative">
            {children}
          </main>
        </div>
      </div>
    </AppUserProvider>
  )
}
