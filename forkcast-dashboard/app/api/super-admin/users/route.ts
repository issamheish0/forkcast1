import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/adminClient'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('rbs_admins')
    .select('id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data || data.role !== 'super_admin') return null
  return user
}

// GET /api/super-admin/users?email=... — search auth users by email (for Add Admin flow)
export async function GET(request: Request) {
  const caller = await requireSuperAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')?.trim().toLowerCase()

  if (!email || email.length < 3) {
    return NextResponse.json({ users: [] })
  }

  const service = createServiceRoleClient()

  const { data: authUsers, error } = await service.auth.admin.listUsers({ perPage: 1000 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const matched = authUsers.users.filter(u => u.email?.toLowerCase().includes(email)).slice(0, 10)

  // Cross-reference with existing admins so we can mark already-admins
  const { data: admins } = await service
    .from('rbs_admins')
    .select('id, user_id, role')

  const adminMap = new Map((admins || []).map((a: any) => [a.user_id, a]))

  const users = matched.map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    admin: adminMap.get(u.id) || null,
  }))

  return NextResponse.json({ users })
}
