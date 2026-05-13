import type { AppUser } from '@/types/supabase'

export function isAdmin(user: AppUser): boolean {
  return user.role === 'admin'
}
