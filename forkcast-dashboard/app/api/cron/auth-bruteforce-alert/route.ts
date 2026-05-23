// app/api/cron/auth-bruteforce-alert/route.ts
//
// Hourly (or whatever cadence the cron is configured for) scan of
// failed_login_attempts. Emits an admin alert when an IP has crossed the
// brute-force threshold defined in fn_detect_brute_force_ips.
//
// Auth: same Bearer-token pattern as the existing cron routes.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/adminClient'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface BruteForceRow {
  ip_address: string
  attempt_count: number
  distinct_accounts: number
  first_seen: string
  last_seen: string
  sample_user_agents: string[] | null
}

function timingSafeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!expected || !timingSafeEqualString(expected, provided)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const windowMin = Number(url.searchParams.get('window') ?? '15')
  const threshold = Number(url.searchParams.get('threshold') ?? '20')

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase.rpc('fn_detect_brute_force_ips', {
    p_window_minutes: windowMin,
    p_threshold: threshold,
  })
  if (error) {
    console.error('[auth-bruteforce-alert] rpc error:', error)
    return NextResponse.json({ error: 'rpc_failed', detail: error.message }, { status: 500 })
  }

  const rows = (data as BruteForceRow[]) ?? []
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, offenders: 0 })
  }

  // Persist to security_audit_log so admins can see it in the audit view,
  // and surface to the admin notifications channel if configured.
  const auditRows = rows.map((r) => ({
    user_id: null,
    restaurant_id: null,
    activity_type: 'brute_force_detected',
    risk_score: Math.min(100, 40 + Math.floor(r.attempt_count / 10)),
    details: {
      ip: r.ip_address,
      attempt_count: r.attempt_count,
      distinct_accounts: r.distinct_accounts,
      first_seen: r.first_seen,
      last_seen: r.last_seen,
      window_minutes: windowMin,
      threshold,
      sample_user_agents: r.sample_user_agents ?? [],
    },
    ip_address: r.ip_address,
  }))

  const { error: insertError } = await supabase
    .from('security_audit_log')
    .insert(auditRows)
  if (insertError) {
    console.error('[auth-bruteforce-alert] audit insert error:', insertError)
  }

  // Optional Slack/Discord webhook for ops paging.
  const webhook = process.env.SECURITY_ALERT_WEBHOOK_URL
  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text:
            `:rotating_light: Brute-force suspected against rbs-restaurant login.\n` +
            rows
              .slice(0, 10)
              .map(
                (r) =>
                  `• \`${r.ip_address}\` — ${r.attempt_count} attempts across ${r.distinct_accounts} accounts (window: ${windowMin}m)`
              )
              .join('\n') +
            (rows.length > 10 ? `\n…and ${rows.length - 10} more.` : ''),
        }),
      })
    } catch (err) {
      console.error('[auth-bruteforce-alert] webhook error:', err)
    }
  }

  return NextResponse.json({ ok: true, offenders: rows.length, rows })
}
