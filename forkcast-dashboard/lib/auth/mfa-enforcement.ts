// lib/auth/mfa-enforcement.ts
//
// Centralised MFA enforcement helpers used from server components / route
// handlers. Two enforcement modes:
//
//   - Admins: ALWAYS required (handled in app/admin/layout.tsx, hardened
//     to render only the enrollment dialog when not yet enrolled).
//
//   - Staff:  required when env `ENFORCE_STAFF_MFA=true`. We gate behind
//     an env flag so the requirement can be rolled out gradually rather
//     than locking out every existing staff account on deploy.
//
// In both cases, a user with a verified TOTP factor on an AAL1 session is
// already redirected to the login MFA prompt by the layout-level checks
// that existed before this file. This helper handles the *enrollment*
// half of the requirement.

import 'server-only'
import { createClient } from '@/lib/supabase/server'

export interface MfaState {
  hasVerifiedFactor: boolean
  currentLevel: 'aal1' | 'aal2' | null
  nextLevel: 'aal1' | 'aal2' | null
}

export async function getMfaState(): Promise<MfaState> {
  const supabase = await createClient()
  const [{ data: factors }, { data: aal }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ])
  const hasVerifiedFactor =
    factors?.totp?.some((f: any) => f.status === 'verified') === true
  return {
    hasVerifiedFactor,
    currentLevel: (aal?.currentLevel as MfaState['currentLevel']) ?? null,
    nextLevel: (aal?.nextLevel as MfaState['nextLevel']) ?? null,
  }
}

export function isStaffMfaEnforced(): boolean {
  // Default: off (rolling rollout). Set ENFORCE_STAFF_MFA=true to require
  // every restaurant_staff member to enroll TOTP before accessing /dashboard.
  return process.env.ENFORCE_STAFF_MFA === 'true'
}
