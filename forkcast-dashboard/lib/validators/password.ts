import * as z from 'zod'

/**
 * Password policy — two tiers.
 *
 * This Supabase project is shared between the staff web app (this repo)
 * and the customer-facing mobile app. Supabase's native password policy
 * (supabase/config.toml → minimum_password_length + password_requirements)
 * is project-wide, so it must accommodate BOTH audiences. The "backend
 * minimum" below mirrors that configured floor exactly.
 *
 *   BACKEND (Supabase, both audiences) → BACKEND_MIN_LENGTH + classes
 *                                        (lower, upper, digit)
 *
 *   STAFF WEB UI (this repo)           → STAFF_MIN_LENGTH + classes
 *                                        (lower, upper, digit, symbol)
 *
 * Staff forms use the stricter `strongPasswordSchema`; anything staff
 * enter will also clear the backend floor (it's a superset). Admin
 * routes that may set passwords on non-staff accounts use the backend
 * minimum so customer-grade passwords remain settable.
 *
 * Pentest sample "test1234" fails both: the backend minimum rejects it
 * for lacking an uppercase letter; the staff bar additionally rejects
 * it for length and missing symbol.
 */

// --- backend minimum — MUST match supabase/config.toml ---------------------
export const BACKEND_MIN_LENGTH = 8
// bcrypt hashes 72 bytes max; Supabase truncates silently above that.
export const PASSWORD_MAX_LENGTH = 72

// --- staff web UI bar ------------------------------------------------------
export const STAFF_MIN_LENGTH = 12

export const BACKEND_REQUIREMENTS: readonly string[] = [
  `At least ${BACKEND_MIN_LENGTH} characters`,
  'At least one lowercase letter',
  'At least one uppercase letter',
  'At least one digit',
]

export const STAFF_REQUIREMENTS: readonly string[] = [
  `At least ${STAFF_MIN_LENGTH} characters`,
  'At least one lowercase letter',
  'At least one uppercase letter',
  'At least one digit',
  'At least one symbol',
]

const HAS_LOWER = /[a-z]/
const HAS_UPPER = /[A-Z]/
const HAS_DIGIT = /\d/
// Any non-alphanumeric char counts as a "symbol". Matches Supabase's
// `lower_upper_letters_digits_symbols` definition.
const HAS_SYMBOL = /[^A-Za-z0-9]/

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; reason: string }

// --- imperative validators (for server actions + route handlers) -----------

/**
 * Enforces the backend minimum — mirrors supabase/config.toml. Use on
 * server-side write paths that may legitimately set a customer-grade
 * password (admin tools, account resets performed by platform admins).
 */
export function validateBackendMinimum(pw: unknown): PasswordPolicyResult {
  if (typeof pw !== 'string') return { ok: false, reason: 'Password is required' }
  if (pw.length < BACKEND_MIN_LENGTH)
    return { ok: false, reason: `Password must be at least ${BACKEND_MIN_LENGTH} characters` }
  if (pw.length > PASSWORD_MAX_LENGTH)
    return { ok: false, reason: `Password must be at most ${PASSWORD_MAX_LENGTH} characters` }
  if (!HAS_LOWER.test(pw)) return { ok: false, reason: 'Password must contain at least one lowercase letter' }
  if (!HAS_UPPER.test(pw)) return { ok: false, reason: 'Password must contain at least one uppercase letter' }
  if (!HAS_DIGIT.test(pw)) return { ok: false, reason: 'Password must contain at least one digit' }
  return { ok: true }
}

/**
 * Enforces the staff web app bar — min 12 + all four character classes.
 * Use on staff-only write paths (staff signup, staff profile password
 * change). Guarantees both the staff bar AND the backend minimum
 * (staff bar is a strict superset).
 */
export function validateStaffPassword(pw: unknown): PasswordPolicyResult {
  if (typeof pw !== 'string') return { ok: false, reason: 'Password is required' }
  if (pw.length < STAFF_MIN_LENGTH)
    return { ok: false, reason: `Password must be at least ${STAFF_MIN_LENGTH} characters` }
  if (pw.length > PASSWORD_MAX_LENGTH)
    return { ok: false, reason: `Password must be at most ${PASSWORD_MAX_LENGTH} characters` }
  if (!HAS_LOWER.test(pw)) return { ok: false, reason: 'Password must contain at least one lowercase letter' }
  if (!HAS_UPPER.test(pw)) return { ok: false, reason: 'Password must contain at least one uppercase letter' }
  if (!HAS_DIGIT.test(pw)) return { ok: false, reason: 'Password must contain at least one digit' }
  if (!HAS_SYMBOL.test(pw)) return { ok: false, reason: 'Password must contain at least one symbol' }
  return { ok: true }
}

// --- Zod schemas (for react-hook-form / client-side validation) ------------

/**
 * Matches the Supabase backend floor exactly — drop this into the
 * customer mobile app so its UI errors match what the server will
 * actually reject.
 */
export const backendMinimumSchema = z
  .string()
  .min(BACKEND_MIN_LENGTH, `Password must be at least ${BACKEND_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  .refine((v) => HAS_LOWER.test(v), 'Password must contain at least one lowercase letter')
  .refine((v) => HAS_UPPER.test(v), 'Password must contain at least one uppercase letter')
  .refine((v) => HAS_DIGIT.test(v), 'Password must contain at least one digit')

/**
 * Staff-facing UI schema — min 12 + symbol, stricter than the backend
 * floor. Used by every staff password field in this repo.
 */
export const strongPasswordSchema = z
  .string()
  .min(STAFF_MIN_LENGTH, `Password must be at least ${STAFF_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  .refine((v) => HAS_LOWER.test(v), 'Password must contain at least one lowercase letter')
  .refine((v) => HAS_UPPER.test(v), 'Password must contain at least one uppercase letter')
  .refine((v) => HAS_DIGIT.test(v), 'Password must contain at least one digit')
  .refine((v) => HAS_SYMBOL.test(v), 'Password must contain at least one symbol')
