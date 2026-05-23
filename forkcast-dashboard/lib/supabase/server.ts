import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Pentest W08: enforce Secure + SameSite=Lax on every server-side
// Supabase cookie write. `httpOnly` is intentionally NOT forced because
// the browser client needs to read the session cookie for autoRefresh /
// onAuthStateChange / realtime token hand-off. See lib/supabase/client.ts
// and lib/supabase/middleware.ts for the sibling hardening + rationale.
const IS_PROD = process.env.NODE_ENV === 'production'
function hardenCookieOptions(options: CookieOptions): CookieOptions {
  return {
    ...options,
    secure: IS_PROD,
    sameSite: options.sameSite ?? 'lax',
  }
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          return cookieStore.get(name)?.value
        },
        async set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...hardenCookieOptions(options) })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...hardenCookieOptions(options) })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      db: {
        schema: 'public'
      },
      auth: {
        persistSession: false, // Server-side doesn't need session persistence
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          'x-client-info': 'rbs-restaurant-server-optimized'
        }
      }
    }
  )
}