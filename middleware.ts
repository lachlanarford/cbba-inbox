import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Run on app pages and APIs that need session refresh.
     * Skip Next internals, static assets, and webhook/cron endpoints that never use cookies.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/webhooks|api/gmail/poll|api/gmail/watch/renew|api/knowledge/drive-sync|api/chat|api/feedback|widget).*)',
  ],
}
