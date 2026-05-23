// app/api/auth/record-success/route.ts
//
// Called by the login page once signInWithPassword succeeds. Clears the
// rolling failed-login counter for the email so the next failed attempt
// starts from zero.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { clearFailedLogins, extractClientIp } from '@/lib/auth/lockout'
import { checkRateLimit } from '@/lib/auth/security'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({ email: z.string().email().max(254) })

export async function POST(request: NextRequest) {
  const ip = extractClientIp(request.headers)
  const rl = checkRateLimit(`record-success:${ip ?? 'unknown'}`, 30, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  // Defence-in-depth: refuse to clear unless the caller actually has a
  // valid Supabase session for the same email. This prevents an attacker
  // from racing the lockout reset between failed attempts.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || (user.email ?? '').toLowerCase() !== parsed.email.toLowerCase()) {
    return NextResponse.json({ error: 'session_mismatch' }, { status: 401 })
  }

  try {
    await clearFailedLogins(parsed.email)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[record-success] error:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
