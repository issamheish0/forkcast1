import { NextRequest, NextResponse } from 'next/server'
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

// GET — list all admins with their permissions + restaurant links
export async function GET() {
  const caller = await requireSuperAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceRoleClient()

  const { data: admins, error } = await service
    .from('rbs_admins')
    .select(`
      id, user_id, role, created_at,
      admin_permissions(*)
    `)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with auth user emails
  const { data: authUsers } = await service.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map(authUsers?.users.map((u) => [u.id, u.email]) ?? [])

  const enriched = (admins || []).map((a: any) => ({
    ...a,
    email: emailMap.get(a.user_id) ?? null,
    permissions: Array.isArray(a.admin_permissions)
      ? a.admin_permissions[0] ?? null
      : a.admin_permissions ?? null,
  }))

  return NextResponse.json({ admins: enriched })
}

// POST — add a user as admin
export async function POST(req: NextRequest) {
  const caller = await requireSuperAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { user_id, role = 'admin' } = body

  if (!user_id || !['super_admin', 'admin', 'support'].includes(role)) {
    return NextResponse.json({ error: 'Invalid user_id or role' }, { status: 400 })
  }

  const service = createServiceRoleClient()

  const { data, error } = await service
    .from('rbs_admins')
    .insert({ user_id, role })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ admin: data }, { status: 201 })
}

// PATCH — update role
export async function PATCH(req: NextRequest) {
  const caller = await requireSuperAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { admin_id, role } = body

  if (!admin_id || !['super_admin', 'admin', 'support'].includes(role)) {
    return NextResponse.json({ error: 'Invalid admin_id or role' }, { status: 400 })
  }

  const service = createServiceRoleClient()

  const { data, error } = await service
    .from('rbs_admins')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', admin_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ admin: data })
}

// DELETE — remove admin
export async function DELETE(req: NextRequest) {
  const caller = await requireSuperAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { admin_id } = await req.json()
  if (!admin_id) return NextResponse.json({ error: 'admin_id required' }, { status: 400 })

  // Prevent removing yourself
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const service = createServiceRoleClient()

  const { data: target } = await service
    .from('rbs_admins')
    .select('user_id')
    .eq('id', admin_id)
    .single()

  if (target?.user_id === user?.id) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
  }

  const { error } = await service.from('rbs_admins').delete().eq('id', admin_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
