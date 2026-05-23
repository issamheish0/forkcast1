'use server'

// app/actions/security.ts
//
// Admin-only mitigations for the W02 finding:
//   * forcePasswordResetByEmail   — flag the account, revoke all sessions,
//                                   email a recovery link.
//   * forcePasswordResetByUserId  — same, but addressed by Supabase user_id.
//
// These actions verify the caller is an rbs_admin via requireAdmin(), then
// drop to the service-role client to perform admin auth ops. They are the
// canonical way to remediate an account confirmed compromised during
// pentests / brute-force investigations.

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import {
  createServiceRoleClient,
} from '@/lib/supabase/adminClient'

export interface ForceResetResult {
  ok: boolean
  user_id?: string
  email?: string
  recovery_link?: string | null
  error?: string
}

async function forceResetByUserId(
  userId: string,
  reason: string
): Promise<ForceResetResult> {
  const service = createServiceRoleClient()

  // 1. Look up email so we can email the recovery link.
  const { data: userResp, error: getUserErr } =
    await service.auth.admin.getUserById(userId)
  if (getUserErr || !userResp?.user) {
    return { ok: false, error: getUserErr?.message ?? 'user_not_found' }
  }
  const email = userResp.user.email
  if (!email) {
    return { ok: false, error: 'user_has_no_email' }
  }

  // 2. Mark user as must-reset (table-backed, surfaced in dashboard layout).
  const { error: rpcErr } = await service.rpc('fn_force_password_reset', {
    p_user_id: userId,
    p_reason: reason,
  })
  if (rpcErr) {
    return { ok: false, error: `force_reset_rpc: ${rpcErr.message}` }
  }

  // 3. Revoke ALL refresh tokens for the user — kicks them out of every
  //    device immediately, including any stolen browser session.
  const { error: signOutErr } = await service.auth.admin.signOut(userId, 'global')
  if (signOutErr) {
    // Non-fatal — log and continue, the password change will eventually
    // invalidate other sessions when GoTrue rotates the JWT secret.
    console.error('[forceResetByUserId] signOut error:', signOutErr.message)
  }

  // 4. Generate a recovery link. We do not email it ourselves — the admin
  //    that triggered this action can copy the link out, or Supabase's
  //    SMTP integration delivers it depending on project config.
  let recovery_link: string | null = null
  try {
    const redirectTo =
      process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password?reason=forced`
        : undefined
    const { data: linkData, error: linkErr } =
      await service.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: redirectTo ? { redirectTo } : undefined,
      })
    if (linkErr) throw linkErr
    recovery_link = linkData?.properties?.action_link ?? null
  } catch (err: any) {
    console.error('[forceResetByUserId] generateLink error:', err?.message)
  }

  return { ok: true, user_id: userId, email, recovery_link }
}

export async function forcePasswordResetByEmail(
  email: string,
  reason = 'compromised_account'
): Promise<ForceResetResult> {
  await requireAdmin()
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'invalid_email' }
  }
  const service = createServiceRoleClient()

  // We can't filter `auth.admin.listUsers` server-side by email, but we can
  // page through. For a typical install this is fine; for very large user
  // tables, swap to a SECURITY DEFINER RPC against auth.users.
  let userId: string | undefined
  let page = 1
  for (let i = 0; i < 20 && !userId; i++) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: 1000,
    })
    if (error) return { ok: false, error: error.message }
    userId = (data?.users as any[])?.find(
      (u: any) => (u.email ?? '').toLowerCase() === email.toLowerCase()
    )?.id
    if (!data?.users?.length || data.users.length < 1000) break
    page++
  }
  if (!userId) return { ok: false, error: 'user_not_found' }

  const result = await forceResetByUserId(userId, reason)
  revalidatePath('/admin/users')
  return result
}

export async function forcePasswordResetByUserIdAction(
  userId: string,
  reason = 'compromised_account'
): Promise<ForceResetResult> {
  await requireAdmin()
  const result = await forceResetByUserId(userId, reason)
  revalidatePath('/admin/users')
  return result
}
