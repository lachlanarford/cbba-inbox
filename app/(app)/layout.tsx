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
  const { data: chatModeSetting } = await service
    .from('settings')
    .select('value')
    .eq('key', 'chat_mode')
    .single()
  const chatMode = chatModeSetting?.value ?? 'ai'

  return (
    <AppUserProvider user={appUser}>
      <PushInit />
      <div className="flex h-screen overflow-hidden bg-cbba-navy">
        <Sidebar user={appUser} chatMode={chatMode} />
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
