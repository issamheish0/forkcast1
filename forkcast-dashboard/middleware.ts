import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Build a per-request CSP with a fresh nonce. The nonce is also forwarded
// to server components via the `x-nonce` request header so they can attach
// it to any inline scripts; Next.js picks up the `Content-Security-Policy`
// request header automatically for its own framework scripts.
function buildCspHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production'
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // Dev only: Next.js HMR / React Refresh use eval() locally.
    // 'strict-dynamic' tells modern browsers to ignore 'unsafe-eval', so
    // this has no effect in prod-capable browsers — but keeps old dev tooling
    // happy locally.
    isDev ? "'unsafe-eval'" : null,
  ]
    .filter(Boolean)
    .join(' ')

  // style-src keeps 'unsafe-inline' because Radix UI, Next.js critical-CSS
  // inlining, and CSS-in-JS libraries inject <style> elements and style
  // attributes that cannot carry a nonce. The XSS surface for style is
  // materially smaller than script; documented accepted tradeoff (W11).
  const directives: string[] = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "worker-src 'self' blob:",
    "connect-src 'self' *.supabase.co wss://*.supabase.co *.upstash.io vitals.vercel-analytics.com vercel.live maps.googleapis.com *.googleapis.com nominatim.openstreetmap.org api.pwnedpasswords.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ]
  if (!isDev) directives.push('upgrade-insecure-requests')
  return directives.join('; ') + ';'
}

function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  // Edge runtime: use btoa on a binary string; no Buffer dependency.
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

// Every middleware-handled response in this app is dynamic HTML (auth
// flow, authenticated dashboard, or a redirect). None should be cached.
// Standardise on the shortest spec-compliant directive (pentest W11).
// Static assets are excluded from middleware via `config.matcher`.
const STANDARD_NO_STORE = 'no-store, max-age=0'

export async function middleware(request: NextRequest) {
  const nonce = generateNonce()
  const cspHeader = buildCspHeader(nonce)

  // Forward pathname + nonce + CSP to server components via request headers
  // (consumed in app/(dashboard)/layout.tsx via next/headers, and used by
  // Next.js internals to nonce framework scripts). Setting x-pathname on
  // response headers would leak it to the client (pentest W12).
  const forwardedHeaders = new Headers(request.headers)
  forwardedHeaders.set('x-pathname', request.nextUrl.pathname)
  forwardedHeaders.set('x-nonce', nonce)
  forwardedHeaders.set('Content-Security-Policy', cspHeader)

  const pathname = request.nextUrl.pathname

  // Applies per-request security headers to any NextResponse before it is
  // returned. Call this at every return site so redirects and early-exits
  // also carry the headers.
  const withSecurity = (res: NextResponse): NextResponse => {
    res.headers.set('Content-Security-Policy', cspHeader)
    res.headers.set('Cache-Control', STANDARD_NO_STORE)
    return res
  }

  // -------------------------------------------------------------------------
  // RSC / Server Action cross-origin guard (defense-in-depth)
  // -------------------------------------------------------------------------
  // Mitigates the "React2Shell" / Server-Action smuggling family of issues
  // (e.g. CVE-2025-55182, CVE-2025-66478) where an attacker triggers a POST
  // against an RSC page route carrying a forged `Next-Action` / `RSC` header
  // from a cross-origin context. Next.js performs an internal same-origin
  // check, but it has been bypassed in the past — and our Cloudflare WAF
  // rules are likewise bypassable. We re-enforce the invariant here so the
  // request is rejected before any handler code runs.
  //
  // Scope: only applied to non-`/api/*` POSTs (real APIs handle their own
  // auth + CSRF). API routes are deliberately excluded so legitimate
  // cross-origin webhook / mobile clients are unaffected.
  if (
    request.method === 'POST' &&
    !pathname.startsWith('/api/') &&
    (request.headers.has('next-action') ||
      request.headers.get('rsc') === '1' ||
      request.headers.get('accept')?.includes('text/x-component'))
  ) {
    const origin = request.headers.get('origin')
    const referer = request.headers.get('referer')
    const host = request.headers.get('host')
    const forwardedHost = request.headers.get('x-forwarded-host') ?? host

    const isSameOrigin = (value: string | null): boolean => {
      if (!value) return false
      try {
        const url = new URL(value)
        return url.host === host || url.host === forwardedHost
      } catch {
        return false
      }
    }

    // Require *either* an Origin or a Referer header, and require it to
    // match our host. Browsers always send one of these on POST; absence
    // is a strong signal of a non-browser / smuggled request.
    if (!isSameOrigin(origin) && !isSameOrigin(referer)) {
      return withSecurity(
        new NextResponse('Forbidden', {
          status: 403,
          headers: { 'X-Blocked-By': 'rsc-origin-guard' },
        })
      )
    }
  }

  // /api/health is a tablet heartbeat hit every 30s plus on every
  // visibility/focus event (see components/pwa/keep-alive-manager.tsx). It
  // doesn't read or write authenticated data — the only reason to gate it
  // through the supabase client was the boilerplate `getUser()` in
  // updateSession, which we've now removed. Short-circuit before
  // constructing a supabase client at all so a fleet of tablets can't
  // saturate edge function concurrency on heartbeats alone.
  if (pathname === '/api/health') {
    return withSecurity(NextResponse.next({ request: { headers: forwardedHeaders } }))
  }

  // update session and get supabase client. We need this up-front because
  // /logout below uses the authenticated supabase client to revoke the
  // server-side refresh token.
  const { response, supabase } = await updateSession(request, forwardedHeaders)

  // /logout — terminate the session server-side and tell the browser to
  // wipe all site data (pentest W11). We don't require auth to hit this
  // endpoint: an unauthenticated hit is a no-op signOut and still clears
  // any residual client-side storage, which is what we want.
  if (pathname === '/logout') {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      // Never block the logout flow on a transient Supabase error; the
      // Clear-Site-Data header below still wipes the client.
      console.error('[middleware] supabase.auth.signOut failed:', err)
    }
    const redirect = NextResponse.redirect(new URL('/login', request.url))
    redirect.headers.set('Clear-Site-Data', '"cache", "cookies", "storage"')
    return withSecurity(redirect)
  }

  // Local JWT validation (signature + expiry against cached JWKS) — no
  // round-trip to the Supabase auth server, no token refresh attempt.
  // Replaced the previous `auth.getSession()` (which itself had been
  // preceded by `auth.getUser()` in updateSession). Together those were
  // producing the refresh-stampede 409s + 504s seen in the Vercel logs
  // for /dashboard, /, /api/health, /api/basic-auto-decline-elapsed.
  // The browser client (lib/supabase/client.ts, processLock) owns the
  // refresh lifecycle for this PWA; the server only needs to read the
  // current claims.
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  const session = userId ? { user: { id: userId } } : null

  // Admin routes are handled by their own layout - skip middleware checks
  if (pathname.startsWith('/admin')) {
    return withSecurity(response)
  }

  // Protect dashboard routes (including floorplan routes within the (dashboard) group)
  const protectedPrefixes = [
    '/bookings', '/customers', '/vip', '/menu',
    '/floorplan', '/floorplans', '/floorsections', '/sections',
    '/analytics', '/waitlist', '/reviews', '/loyalty',
    '/staff', '/orders', '/kitchen', '/notifications',
    '/migration', '/tables',
    '/offers', '/special-offers',
    '/settings', '/profile', '/help', '/deposits',
    '/debug', '/schedules', '/events', '/guarantees',
    '/super-admin',
  ]
  const isProtectedRoute = protectedPrefixes.some(prefix => pathname.startsWith(prefix))


  if (isProtectedRoute) {
    if (!session) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('redirectTo', pathname)
      return withSecurity(NextResponse.redirect(redirectUrl))
    }

    // Check if user is an RBS admin — admins bypass restaurant access checks
    const { data: adminData } = await supabase
      .from('rbs_admins')
      .select('id, role')
      .eq('user_id', session.user.id)
      .maybeSingle()

    const userIsAdmin = !!adminData

    if (userIsAdmin) {
      // Admins can access all protected routes — skip restaurant/tier checks
      return withSecurity(response)
    }

    // Run the two access lookups in parallel — neither depends on the
    // other and both are needed before the route guard can decide.
    // Previously this added ~1 round-trip of latency to every protected
    // page hit; trivial in isolation, painful when the auth server is
    // already under refresh-stampede pressure.
    const [staffResult, createdResult] = await Promise.all([
      supabase
        .from('restaurant_staff')
        .select('id, role, is_active, restaurant_id')
        .eq('user_id', session.user.id)
        .eq('is_active', true),
      supabase
        .from('restaurants')
        .select('id')
        .eq('created_by', session.user.id),
    ])
    const staffData = staffResult.data
    const createdRestaurants = createdResult.data

    const hasStaffAccess = staffData && staffData.length > 0
    const hasCreatorAccess = createdRestaurants && createdRestaurants.length > 0

    if (!hasStaffAccess && !hasCreatorAccess) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('error', 'no_access')
      return withSecurity(NextResponse.redirect(redirectUrl))
    }

    // Handle restaurant-specific route validation
    const restaurantId = request.nextUrl.searchParams.get('restaurant')
    if (restaurantId) {
      // Verify user has access to this specific restaurant (as staff or creator)
      const hasStaffAccess = staffData?.some(staff => staff.restaurant_id === restaurantId)
      const isCreator = createdRestaurants?.some(rest => rest.id === restaurantId)
      if (!hasStaffAccess && !isCreator) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/bookings'
        redirectUrl.search = ''
        return withSecurity(NextResponse.redirect(redirectUrl))
      }
    }

  }

  // Pass current pathname to server components via header (for layout-level tier checks)
  response.headers.set('x-pathname', request.nextUrl.pathname)

  // Redirect authenticated users away from auth pages, but allow if they have specific redirectTo or error params
  if ((pathname === '/login' || pathname === '/register') && session) {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo')
    const error = request.nextUrl.searchParams.get('error')

    // Allow login page if there's a redirectTo (like /admin) or error
    if (redirectTo || error) {
      return withSecurity(response)
    }

    // Default redirect for authenticated users
    return withSecurity(NextResponse.redirect(new URL('/bookings', request.url)))
  }

  return withSecurity(response)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.(?:json|webmanifest)|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav)$).*)',
  ],
}
