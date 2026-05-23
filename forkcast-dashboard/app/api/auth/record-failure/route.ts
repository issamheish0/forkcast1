// app/api/auth/record-failure/route.ts
//
// Called by the login page on a failed signInWithPassword attempt.
// We optionally verify a CAPTCHA token here, but the canonical CAPTCHA
// enforcement lives in the Supabase GoTrue config (see lockout audit doc).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  recordFailedLogin,
  verifyTurnstile,
  extractClientIp,
} from '@/lib/auth/lockout'
import { checkRateLimit } from '@/lib/auth/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  email: z.string().email().max(254),
  reason: z.string().max(120).optional(),
  captcha_token: z.string().max(4096).optional().nullable(),
})

export async function POST(request: NextRequest) {
  const ip = extractClientIp(request.headers)
  const userAgent = request.headers.get('user-agent') ?? null

  const rl = checkRateLimit(`record-failure:${ip ?? 'unknown'}`, 30, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  // If Turnstile is configured AND a token was provided, verify it.
  // We don't *require* it here — see comment in login-precheck route.
  if (parsed.captcha_token && process.env.TURNSTILE_SECRET_KEY) {
    const result = await verifyTurnstile(parsed.captcha_token, ip)
    if (!result.success) {
      return NextResponse.json(
        { error: 'captcha_failed', detail: result.error ?? null },
        { status: 400 }
      )
    }
  }

  try {
    const state = await recordFailedLogin({
      email: parsed.email,
      ip,
      userAgent,
      reason: parsed.reason,
    })
    return NextResponse.json({
      fail_count: state.fail_count,
      lock_duration_seconds: state.lock_duration_seconds,
      locked_until: state.locked_until,
    })
  } catch (err) {
    console.error('[record-failure] error:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
