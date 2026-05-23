// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import { processLock, type SupabaseClient } from '@supabase/supabase-js'

let clientInstance: SupabaseClient<any, 'public', any> | null = null

// PWA-specific Supabase client configuration
export const createClient = () => {
  // Return existing instance if available (singleton pattern for PWA)
  if (clientInstance) {
    return clientInstance
  }

  clientInstance = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Pentest W08: force Secure + SameSite=Lax on every cookie the
      // browser client writes via document.cookie. `httpOnly` cannot be
      // applied by client-side JS (the browser silently drops that
      // attribute from document.cookie writes); it is an architectural
      // limitation of running session detection in the browser — the
      // cookie MUST be readable by the browser client for autoRefresh,
      // onAuthStateChange, and realtime token hand-off. Defence-in-depth
      // against XSS is provided by the strict nonce-based CSP (W11).
      cookieOptions: {
        secure:
          typeof window !== 'undefined' &&
          window.location?.protocol === 'https:',
        sameSite: 'lax',
        path: '/',
      },
      db: {
        schema: 'public'
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PWA-specific: More aggressive refresh for better reliability
        flowType: 'pkce',
        // Bug-fix: the default `navigatorLock` (Web Locks API) can orphan
        // when a holder is aborted mid-flight (React 19 strict-mode unmount,
        // navigation, abort signal). All subsequent auth calls then queue
        // behind the dead lock and hang forever — surfacing as random slow
        // logins and stalled `getUser()` calls after sign-in. `processLock`
        // sequences within this page only (no cross-tab guarantee), which
        // is fine for a single-tab tablet PWA. See supabase-js#2111 / #2013.
        lock: processLock,
      },
      global: {
        headers: {
          'x-client-info': 'rbs-restaurant-pwa-optimized'
        }
      },
      // Enhanced real-time configuration for PWA
      realtime: {
        worker:true,
        heartbeatIntervalMs: 15000, // 15 seconds heartbeat
        params: {
          eventsPerSecond: 50, // Increased from 10 for better responsiveness
        },
        // PWA-specific settings
        timeout: 200000, 
        // Enable logging for debugging
        logger: (level: string, message: string, data?: any) => {
          if (level === 'error') {
            console.error('Supabase Realtime Error:', message, data)
          } else if (level === 'info') {
            console.log('Supabase Realtime:', message, data)
          }
        }
      }
    }
  )

  // Add PWA-specific event listeners
  if (typeof window !== 'undefined' && clientInstance) {
    setupPWAConnectionHandling(clientInstance)
  }

  return clientInstance
}

// PWA Connection & Auth Session Handling
function setupPWAConnectionHandling(client: SupabaseClient<any, 'public', any>) {
  // ─── AUTH SESSION KEEPER ───────────────────────────────────────────
  // The built-in auto-refresh stops when document.visibilityState === 'hidden'.
  // For a restaurant tablet PWA that stays open 8+ hours, we need continuous refresh.
  // startAutoRefresh() removes the visibility-change callback and runs the
  // refresh ticker unconditionally.
  client.auth.startAutoRefresh()

  // Push fresh tokens to realtime channels when they're refreshed.
  // Without this, realtime subscriptions die when the old JWT expires
  // because the realtime client doesn't automatically pick up new tokens.
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED' && session?.access_token) {
      console.log('[Auth] Token refreshed — pushing to realtime')
      client.realtime.setAuth(session.access_token)
    }
    if (event === 'SIGNED_OUT') {
      console.log('[Auth] Signed out — redirecting to login')
      window.location.href = '/login'
    }
  })

  // Safety-net: force refresh every 6 hours (JWT expiry is now 24h).
  // This catches edge cases where the built-in ticker stalls (known issue #41968).
  const SESSION_REFRESH_INTERVAL = 6 * 60 * 60 * 1000
  setInterval(async () => {
    try {
      const { data, error } = await client.auth.refreshSession()
      if (error) {
        console.warn('[Auth] Safety-net refresh failed:', error.message)
        // If refresh fails, the session is truly dead — redirect to login.
        // Check error.code (machine-readable) not error.message (human-readable).
        const code = (error as any).code
        if (code === 'refresh_token_not_found' ||
            code === 'refresh_token_already_used' ||
            code === 'session_not_found' ||
            error.name === 'AuthSessionMissingError') {
          console.error('[Auth] Session expired — redirecting to login')
          window.location.href = '/login?error=session_expired'
        }
      } else if (data.session) {
        console.log('[Auth] Safety-net refresh succeeded')
        client.realtime.setAuth(data.session.access_token)
      }
    } catch {
      console.warn('[Auth] Safety-net refresh error')
    }
  }, SESSION_REFRESH_INTERVAL)

  // ─── NETWORK & VISIBILITY HANDLING ─────────────────────────────────
  window.addEventListener('online', () => {
    console.log('[Network] Online — reconnecting realtime')
    if (client.realtime) {
      client.realtime.disconnect()
      setTimeout(() => client.realtime.connect(), 1000)
    }
    // Also force a session refresh after coming back online
    client.auth.refreshSession().then(({ data }) => {
      if (data.session) client.realtime.setAuth(data.session.access_token)
    }).catch(() => {})
  })

  window.addEventListener('offline', () => {
    console.log('[Network] Offline — realtime will pause')
  })

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      console.log('[Visibility] App visible — checking connection')
      // Refresh session when tab becomes visible (catches long background periods)
      client.auth.refreshSession().then(({ data }) => {
        if (data.session) client.realtime.setAuth(data.session.access_token)
      }).catch(() => {})

      setTimeout(() => {
        if (client.realtime && client.realtime.isConnected() === false) {
          console.log('[Visibility] Reconnecting realtime')
          client.realtime.connect()
        }
      }, 500)
    }
  })

  window.addEventListener('beforeunload', () => {
    if (client.realtime) client.realtime.disconnect()
  })

  window.addEventListener('focus', () => {
    setTimeout(() => {
      if (client.realtime && client.realtime.isConnected() === false) {
        console.log('[Focus] Reconnecting realtime')
        client.realtime.connect()
      }
    }, 500)
  })

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_APP_VISIBLE') {
        setTimeout(() => {
          if (client.realtime && client.realtime.isConnected() === false) {
            client.realtime.connect()
          }
        }, 1000)
      }
    })
  }
}

// Reset client instance (useful for testing or manual reconnection)
export const resetClientInstance = () => {
  if (clientInstance?.realtime) {
    clientInstance.realtime.disconnect()
  }
  clientInstance = null
}
