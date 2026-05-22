'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { StaffUser } from '@/types/database'

export function useUsers() {
  const [users, setUsers] = useState<StaffUser[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('users')
      .select('id, full_name, avatar_url, email, department')
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => setUsers((data ?? []) as unknown as StaffUser[]))
  }, [])

  return users
}
