'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { unsubscribeFromPush } from '@/lib/push/client'

export default function SignOutButton() {
  const supabase = createClient()
  const router = useRouter()

  async function handleSignOut() {
    await unsubscribeFromPush().catch(() => {})
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={() => { void handleSignOut() }}
      className="text-xs text-gray-400 hover:text-white transition-colors duration-150"
    >
      Sign out
    </button>
  )
}
