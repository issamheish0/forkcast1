// app/api/auth/login-precheck/route.ts
//
// Read-only endpoint called by the login form *before* signInWithPassword.
// Returns:
//   { locked: boolean, requires_captcha: boolean, seconds_until_unlock: number,
//     turnstile_site_key: string | null }
//
// Note: this endpoint is rate-limited at the edge (Cloudflare + middleware
// rsc guard does not apply because it lives under /api/). Even if an
// attacker skips it and hits Supabase directly, /api/auth/record-failure
// is still called by the login page on every error, so the lockout state
// stays correct — and Supabase will reject the next attempt because the
// captchaToken is also passed at sign-in time when CAPTCHA is required
// in GoTrue config.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkLoginLockout, extractClientIp } from '@/lib/auth/lockout'
import { checkRateLimit } from '@/lib/auth/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  email: z.string().email().max(254),
})

export async function POST(request: NextRequest) {
  const ip = extractClientIp(request.headers) ?? 'unknown'

  // Per-IP rate limit on the precheck itself: 30/min. Stops trivial
  // enumeration of "is this email locked?" via this endpoint.
  const rl = checkRateLimit(`login-precheck:${ip}`, 30, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  try {
    const state = await checkLoginLockout(parsed.email)
    return NextResponse.json({
      locked: state.locked,
      requires_captcha: state.requires_captcha,
      seconds_until_unlock: state.seconds_until_unlock,
      turnstile_site_key: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null,
    })
  } catch (err) {
    console.error('[login-precheck] error:', err)
    // Fail closed: if we cannot verify lockout state, do not reveal info.
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
