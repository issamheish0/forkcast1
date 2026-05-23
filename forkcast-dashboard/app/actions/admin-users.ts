'use server'

import { createServiceRoleClient } from '@/lib/supabase/adminClient'
import { createAdminClient } from '@/lib/supabase/adminClient'

async function requireSuperAdmin() {
  const supabase = await createAdminClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Not authenticated')

  const { data: admin, error: adminError } = await supabase
    .from('rbs_admins')
    .select('id, role')
    .eq('user_id', user.id)
    .single()

  if (adminError || !admin) throw new Error('Not an admin')
  if (admin.role !== 'super_admin') throw new Error('Super admin required')
}

export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireSuperAdmin()

    const serviceClient = createServiceRoleClient()
    const { error } = await serviceClient.auth.admin.deleteUser(userId)

    if (error) throw error

    return { success: true }
  } catch (err: any) {
    console.error('Error deleting user:', err)
    return { success: false, error: err.message || 'Failed to delete user' }
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function deleteUsers(userIds: string[]): Promise<{ success: boolean; deleted: number; errors: string[] }> {
  try {
    await requireSuperAdmin()

    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > 100) {
      return { success: false, deleted: 0, errors: ['Invalid or too many user IDs (max 100)'] }
    }
    const invalidIds = userIds.filter(id => !UUID_RE.test(id))
    if (invalidIds.length > 0) {
      return { success: false, deleted: 0, errors: ['Invalid user ID format'] }
    }

    const serviceClient = createServiceRoleClient()
    const errors: string[] = []
    let deleted = 0

    for (const userId of userIds) {
      const { error } = await serviceClient.auth.admin.deleteUser(userId)
      if (error) {
        errors.push(`${userId}: ${error.message}`)
      } else {
        deleted++
      }
    }

    return { success: true, deleted, errors }
  } catch (err: any) {
    console.error('Error deleting users:', err)
    return { success: false, deleted: 0, errors: [err.message || 'Failed to delete users'] }
  }
}

export async function searchUsers(query: string, limit = 30): Promise<{
  users: Array<{
    id: string
    email: string
    full_name: string
    phone_number: string | null
    membership_tier: string
    total_bookings: number
    created_at: string
  }>
  error?: string
}> {
  try {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 2) {
      return { users: [], error: 'Enter at least 2 characters to search' }
    }

    const supabase = await createAdminClient()

    // Auth check
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Not authenticated')

    const { data: admin, error: adminError } = await supabase
      .from('rbs_admins')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (adminError || !admin) throw new Error('Not an admin')
    if (admin.role !== 'super_admin') throw new Error('Super admin required')

    const sanitized = trimmed.replace(/[,()\\"']/g, '')
    if (!sanitized) return { users: [], error: 'Invalid search query' }

    // Use SECURITY DEFINER RPC to bypass RLS (avoids expensive per-row policy checks)
    const { data, error } = await supabase.rpc('search_profiles_admin', {
      search_query: sanitized
    })

    if (error) throw error

    return { users: (data || []).slice(0, Math.min(limit, 100)) }
  } catch (err: any) {
    console.error('Error searching users:', err)
    return { users: [], error: err.message }
  }
}
