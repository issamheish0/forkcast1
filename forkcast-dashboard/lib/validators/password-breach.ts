/**
 * Common-password / breached-password blocklist using HaveIBeenPwned's
 * Pwned Passwords v3 API with k-anonymity.
 *
 * Only the first 5 hex chars of the SHA-1 hash leave the runtime — HIBP
 * returns ~500 hash suffixes that share that prefix, and we match
 * locally. The plaintext password and full hash are never transmitted.
 *
 * Runs in both the browser and Node 18+ via the Web Crypto API
 * (globalThis.crypto.subtle), so a single helper covers client forms
 * (signup, reset, profile change) and server paths (admin actions /
 * route handlers).
 *
 * Fail-open policy: on hash failures, network errors, or HIBP outages
 * we return ok. The repo already enforces strong complexity rules in
 * `validateStaffPassword` / `validateBackendMinimum`, and a transient
 * HIBP problem must not block legitimate users from signing up or
 * resetting their password. Failures are logged to console.
 */

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/'
const HIBP_TIMEOUT_MS = 5000

export type PasswordBreachResult =
  | { ok: true }
  | { ok: false; reason: string; count: number }

async function sha1Hex(input: string): Promise<string> {
  const subtle = (globalThis as unknown as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle
  if (!subtle) throw new Error('Web Crypto SubtleCrypto unavailable in this runtime')
  const bytes = new TextEncoder().encode(input)
  const digest = await subtle.digest('SHA-1', bytes)
  let hex = ''
  const view = new Uint8Array(digest)
  for (let i = 0; i < view.length; i++) {
    hex += view[i].toString(16).padStart(2, '0')
  }
  return hex.toUpperCase()
}

/**
 * Returns `{ ok: false }` when the password appears in HIBP's breach
 * corpus, otherwise `{ ok: true }` (including on lookup failure — see
 * fail-open note above).
 */
export async function checkPasswordBreach(
  password: unknown
): Promise<PasswordBreachResult> {
  if (typeof password !== 'string' || password.length === 0) {
    return { ok: true }
  }

  let prefix: string
  let suffix: string
  try {
    const hash = await sha1Hex(password)
    prefix = hash.slice(0, 5)
    suffix = hash.slice(5)
  } catch (err) {
    console.warn('[password-breach] SHA-1 unavailable, skipping HIBP check:', err)
    return { ok: true }
  }

  // Server-side: HIBP requires a User-Agent. In browsers, User-Agent is a
  // forbidden header name and the fetch API will throw if we set it, so
  // we only add it off-DOM.
  const headers: Record<string, string> = { 'Add-Padding': 'true' }
  if (typeof window === 'undefined') {
    headers['User-Agent'] = 'rbs-restaurant'
  }

  // Bound the HIBP call so a slow / hung endpoint can't lock the user
  // inside a submitting form. AbortController fires through to fetch.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS)

  let body: string
  try {
    const res = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) {
      console.warn('[password-breach] HIBP returned status', res.status, '— failing open')
      return { ok: true }
    }
    body = await res.text()
  } catch (err) {
    console.warn('[password-breach] HIBP unreachable / timed out — failing open:', err)
    return { ok: true }
  } finally {
    clearTimeout(timer)
  }

  for (const line of body.split('\n')) {
    const sep = line.indexOf(':')
    if (sep === -1) continue
    const hashSuffix = line.slice(0, sep).trim().toUpperCase()
    if (hashSuffix !== suffix) continue
    const count = parseInt(line.slice(sep + 1).trim(), 10)
    // HIBP pads its responses with synthetic zero-count entries to
    // defeat traffic-analysis side-channels. Treat those as not-pwned.
    if (!Number.isFinite(count) || count <= 0) return { ok: true }
    return {
      ok: false,
      count,
      reason:
        'This password has appeared in a known data breach. Please choose a different one.',
    }
  }

  return { ok: true }
}
