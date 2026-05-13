import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Server-side only -- never import this in client components.
// Used by webhook endpoints that have no authenticated user session.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service role credentials')
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
