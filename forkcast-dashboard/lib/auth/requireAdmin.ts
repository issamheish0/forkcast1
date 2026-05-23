import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/adminClient'

type AdminRole = 'super_admin' | 'admin' | 'support'

export interface RequireAdminResult {
  adminUser: {
    id: number
    user_id: string
    role: AdminRole
  }
  role: AdminRole
  /**
   * Optional allowed sections from admin_permissions.allowed_sections.
   * `['*']` means full access.
   */
  allowedSections?: string[]
}

interface RequireAdminOptions {
  /**
   * Section key to enforce against admin_permissions.allowed_sections.
   * If omitted, no section-level check is applied (only admin existence).
   */
  requiredSectionKey?: string

  /**
   * Optional redirect path when access is denied.
   * Defaults to the main login page with an admin error flag.
   */
  redirectTo?: string
}

/**
 * Server-safe admin guard.
 *
 * - Verifies there is an authenticated Supabase user
 * - Ensures the user exists in rbs_admins
 * - Optionally enforces admin_permissions.allowed_sections includes the
 *   given section key OR the admin is a super_admin
 *
 * On failure, this will redirect to the login page and never return.
 */
export async function requireAdmin(
  options: RequireAdminOptions = {}
): Promise<RequireAdminResult> {
  const {
    requiredSectionKey,
    redirectTo = '/login?error=admin_access_required',
  } = options

  const supabase = await createAdminClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect(redirectTo)
  }

  // Look up admin row for this user
  const { data: admin, error: adminError } = await supabase
    .from('rbs_admins')
    .select('id, user_id, role')
    .eq('user_id', user.id)
    .single()

  if (adminError || !admin) {
    redirect(redirectTo)
  }

  const role = admin.role as AdminRole

  // Super admins always pass section checks
  if (role === 'super_admin') {
    return {
      adminUser: {
        id: admin.id,
        user_id: admin.user_id,
        role,
      },
      role,
      allowedSections: ['*'],
    }
  }

  let allowedSections: string[] | undefined

  if (requiredSectionKey) {
    // If admin_permissions exists, enforce it
    const { data: perms, error: permsError } = await supabase
      .from('admin_permissions')
      .select('allowed_sections')
      .eq('admin_id', admin.id)
      .single()

    if (!permsError && perms && Array.isArray(perms.allowed_sections)) {
      allowedSections = perms.allowed_sections as string[]
      const hasAccess =
        allowedSections.includes('*') || allowedSections.includes(requiredSectionKey)

      if (!hasAccess) {
        redirect(redirectTo)
      }
    }
  }

  return {
    adminUser: {
      id: admin.id,
      user_id: admin.user_id,
      role,
    },
    role,
    allowedSections,
  }
}

