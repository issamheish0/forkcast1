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

// POST — upsert permissions for an admin
export async function POST(req: NextRequest) {
  const caller = await requireSuperAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { admin_id, allowed_sections, booking_field_visibility, booking_actions } = body

  if (!admin_id) return NextResponse.json({ error: 'admin_id required' }, { status: 400 })

  const service = createServiceRoleClient()

  const { data, error } = await service
    .from('admin_permissions')
    .upsert({
      admin_id,
      allowed_sections: allowed_sections ?? [],
      booking_field_visibility: booking_field_visibility ?? { name: true, email: true, phone: true, notes: true },
      booking_actions: booking_actions ?? { can_accept_decline: false },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'admin_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ permissions: data })
}

// POST to /api/super-admin/permissions/restaurant-link — link admin to restaurant as staff
// We reuse this file but also handle restaurant linking in restaurant-link route below
