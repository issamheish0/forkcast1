// lib/auth/lockout.ts
//
// Server-side helpers for account lockout, CAPTCHA enforcement, and
// brute-force tracking. All writes go through SECURITY DEFINER RPCs that
// are EXECUTE-restricted to the service_role.

import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/adminClient'

export interface LockoutCheckResult {
  locked: boolean
  fail_count: number
  requires_captcha: boolean
  locked_until: string | null
  seconds_until_unlock: number
}

const normaliseEmail = (email: string) => email.trim().toLowerCase()

/**
 * Read-only lockout check. Safe to call from the login pre-flight endpoint.
 */
export async function checkLoginLockout(email: string): Promise<LockoutCheckResult> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('fn_check_login_lockout', {
    p_email: normaliseEmail(email),
  })

  if (error) {
    // Fail closed for the lock decision but open for everything else — i.e.
    // surface the error to the caller, do not silently allow login.
    throw new Error(`fn_check_login_lockout failed: ${error.message}`)
  }

  return {
    locked: !!data?.locked,
    fail_count: data?.fail_count ?? 0,
    requires_captcha: !!data?.requires_captcha,
    locked_until: data?.locked_until ?? null,
    seconds_until_unlock: data?.seconds_until_unlock ?? 0,
  }
}

/**
 * Record a failed login. Increments the rolling counter and (re)applies
 * the exponential-backoff lockout. Returns the updated state.
 */
export async function recordFailedLogin(args: {
  email: string
  ip: string | null
  userAgent: string | null
  reason?: string
}): Promise<{ fail_count: number; lock_duration_seconds: number; locked_until: string | null }> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('fn_record_failed_login', {
    p_email: normaliseEmail(args.email),
    p_ip: args.ip,
    p_user_agent: args.userAgent,
    p_reason: args.reason ?? 'invalid_credentials',
  })

  if (error) {
    throw new Error(`fn_record_failed_login failed: ${error.message}`)
  }

  return {
    fail_count: data?.fail_count ?? 0,
    lock_duration_seconds: data?.lock_duration_seconds ?? 0,
    locked_until: data?.locked_until ?? null,
  }
}

/**
 * Clear the failed-login counter. Call on confirmed successful authentication.
 */
export async function clearFailedLogins(email: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.rpc('fn_clear_failed_logins', {
    p_email: normaliseEmail(email),
  })
  if (error) throw new Error(`fn_clear_failed_logins failed: ${error.message}`)
}

/**
 * Verify a Cloudflare Turnstile token server-side.
 * Returns `{ success }`. If TURNSTILE_SECRET_KEY is unset, returns `{ success: false, configured: false }`
 * so the caller can decide how to handle dev/test environments.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string | null
): Promise<{ success: boolean; configured: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return { success: false, configured: false }

  if (!token) return { success: false, configured: true, error: 'missing_token' }

  const body = new URLSearchParams({ secret, response: token })
  if (ip) body.set('remoteip', ip)

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    })
    const json = (await res.json()) as { success: boolean; 'error-codes'?: string[] }
    return {
      success: !!json.success,
      configured: true,
      error: json.success ? undefined : (json['error-codes'] || []).join(','),
    }
  } catch (err) {
    return { success: false, configured: true, error: 'verify_request_failed' }
  }
}

/**
 * Best-effort IP extraction. Trusts X-Forwarded-For only because we sit
 * behind Cloudflare + Vercel — both rewrite/append it. Returns the
 * left-most (client) IP.
 */
export function extractClientIp(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip') || headers.get('cf-connecting-ip') || null
}
