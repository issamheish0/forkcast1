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

// GET — list all restaurants linked to a given admin (via restaurant_staff)
export async function GET(request: NextRequest) {
  const caller = await requireSuperAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const adminUserId = searchParams.get('user_id')
  if (!adminUserId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const service = createServiceRoleClient()

  const { data, error } = await service
    .from('restaurant_staff')
    .select('id, restaurant_id, role, is_active, restaurants(id, name)')
    .eq('user_id', adminUserId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ links: data ?? [] })
}

// POST — link an admin user to a restaurant as staff
export async function POST(request: NextRequest) {
  const caller = await requireSuperAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { user_id, restaurant_id, role = 'manager' } = body

  const validRoles = ['owner', 'manager', 'staff', 'viewer']
  if (!user_id || !restaurant_id || !validRoles.includes(role)) {
    return NextResponse.json({ error: 'user_id, restaurant_id, and valid role are required' }, { status: 400 })
  }

  const service = createServiceRoleClient()

  // Upsert to avoid duplicates
  const { data, error } = await service
    .from('restaurant_staff')
    .upsert(
      { user_id, restaurant_id, role, is_active: true, permissions: [] },
      { onConflict: 'user_id,restaurant_id', ignoreDuplicates: false }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ link: data }, { status: 201 })
}

// DELETE — unlink an admin user from a restaurant
export async function DELETE(request: NextRequest) {
  const caller = await requireSuperAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { staff_id } = body
  if (!staff_id) return NextResponse.json({ error: 'staff_id required' }, { status: 400 })

  const service = createServiceRoleClient()

  const { error } = await service
    .from('restaurant_staff')
    .delete()
    .eq('id', staff_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}