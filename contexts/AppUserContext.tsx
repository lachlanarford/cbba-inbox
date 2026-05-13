'use client'

import { createContext, useContext } from 'react'
import type { AppUser } from '@/types/supabase'

const AppUserContext = createContext<AppUser | null>(null)

export function AppUserProvider({
  user,
  children,
}: {
  user: AppUser
  children: React.ReactNode
}) {
  return <AppUserContext.Provider value={user}>{children}</AppUserContext.Provider>
}

export function useAppUser(): AppUser {
  const user = useContext(AppUserContext)
  if (!user) throw new Error('useAppUser must be used within AppUserProvider')
  return user
}
