import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** Keep well under Vercel's ~25s middleware limit so Auth blips return a redirect, not a 504. */
const AUTH_FETCH_TIMEOUT_MS = 4_000

function isConfigured(): boolean {
  return (
    !!supabaseUrl &&
    !!supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('placeholder')
  )
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/webhooks/') ||
    pathname.startsWith('/api/gmail/auth/') ||
    pathname === '/api/gmail/poll' ||
    pathname === '/api/gmail/watch/renew' ||
    pathname === '/api/knowledge/drive-sync' ||
    pathname.startsWith('/api/chat') ||
    pathname.startsWith('/widget') ||
    pathname.startsWith('/api/feedback/')
  )
}

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(AUTH_FETCH_TIMEOUT_MS)
  const callerSignal = init?.signal
  const signal =
    callerSignal && typeof AbortSignal.any === 'function'
      ? AbortSignal.any([callerSignal, timeoutSignal])
      : timeoutSignal

  return fetch(input, { ...init, signal })
}

export async function updateSession(request: NextRequest) {
  // If Supabase is not yet configured, allow all requests through
  if (!isConfigured()) {
    return NextResponse.next({ request })
  }

  const pathname = request.nextUrl.pathname

  // Webhooks / cron / widget do not need session refresh — skip Auth entirely
  if (isPublicPath(pathname) && pathname !== '/login') {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: fetchWithTimeout,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user: { id: string } | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    // Auth hung or timed out — fail closed for protected routes instead of a 504
    console.error('[middleware] auth.getUser failed:', err instanceof Error ? err.message : err)
    user = null
  }

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated users hitting /login get sent to /inbox
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/inbox'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
