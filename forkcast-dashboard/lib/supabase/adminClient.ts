import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Session-aware admin client (uses anon key + user cookies).
 * Used by requireAdmin() and other server code that needs the caller's session.
 */
export async function createAdminClient() {
  const supabase = await createServerClient()
  return supabase
}

/**
 * Service-role client — bypasses RLS and has full auth.admin access.
 *
 * ONLY use in server actions that have already verified the caller
 * is an rbs_admin. Never expose to the client.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
