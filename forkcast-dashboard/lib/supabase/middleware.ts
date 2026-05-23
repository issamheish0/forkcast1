import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Pentest W08: force Secure + SameSite=Lax on every server-side write to
// the Supabase auth cookie. `httpOnly` is intentionally NOT forced here
// because the Supabase browser client reads this cookie via document.cookie
// for session detection, autoRefresh, onAuthStateChange, and realtime
// token hand-off — making it HttpOnly would silently break client-side
// auth. Defense in depth is provided by the strict nonce-based CSP (W11).
const IS_PROD = process.env.NODE_ENV === 'production'
function hardenCookieOptions(options: CookieOptions): CookieOptions {
  return {
    ...options,
    secure: IS_PROD,
    sameSite: options.sameSite ?? 'lax',
  }
}

export async function updateSession(request: NextRequest, extraRequestHeaders?: Headers) {
  const requestHeaders = extraRequestHeaders ?? request.headers
  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          })
          response.cookies.set({
            name,
            value,
            ...hardenCookieOptions(options),
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...hardenCookieOptions(options),
          })
        },
      },
      auth: {
        // Server runtime never needs to refresh tokens — the browser client
        // owns the refresh lifecycle (with `processLock`, see
        // lib/supabase/client.ts). Leaving these on caused parallel
        // middleware invocations from the same tablet (page nav +
        // /api/health heartbeat + /api/basic-auto-decline-elapsed +
        // notification poll) to all stampede the auth server with the same
        // refresh_token, producing 409 "Too many concurrent token refresh
        // requests" → retry storm → AuthRetryableFetchError 504 → 25s
        // middleware timeout → Cloudflare 504. Disabling them on the server
        // is the documented fix for this class of issue.
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  )

  // Intentionally NOT calling `supabase.auth.getUser()` here. `getUser()`
  // makes a synchronous round-trip to the Supabase auth server on every
  // hit, and on near-expiry tokens it triggers the refresh stampede above.
  // Callers that need the user id should use `supabase.auth.getClaims()`
  // (local JWKS-verified JWT decode, no network call) — already done in
  // `middleware.ts` and the dashboard layout.
  return { response, supabase }
}