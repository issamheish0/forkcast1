import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 15

/**
 * POST /api/basic-auto-decline-elapsed
 *
 * Marks pending bookings as auto_declined when:
 * - request_expires_at has passed (request expired), or
 * - booking_time has passed (booking date elapsed) without being confirmed.
 *
 * Basic tier only. Call before fetching bookings so the list reflects updates.
 *
 * Uses bulk SQL operations: a single UPDATE filters expired pendings via the
 * server, a single DELETE clears their offer redemptions, and a single bulk
 * INSERT writes status-history rows. Earlier per-row loop produced ~5
 * sequential round trips per booking and exceeded the Vercel function
 * timeout for any restaurant that accumulated more than a handful of
 * elapsed pendings — surfacing as Cloudflare 504s on the basic dashboard.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { restaurantId } = body as { restaurantId?: string }

    if (!restaurantId || typeof restaurantId !== 'string') {
      return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: staffData, error: staffError } = await supabase
      .from('restaurant_staff')
      .select(`
        restaurant_id,
        is_active,
        restaurant:restaurants(id, tier)
      `)
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .single()

    if (staffError || !staffData) {
      return NextResponse.json({ error: 'You do not have access to this restaurant' }, { status: 403 })
    }

    const restaurant = Array.isArray(staffData.restaurant) ? staffData.restaurant[0] : staffData.restaurant
    if (restaurant?.tier !== 'basic') {
      return NextResponse.json({ error: 'This endpoint is only for Basic tier restaurants' }, { status: 403 })
    }

    const nowMs = Date.now()
    const nowIso = new Date(nowMs).toISOString()
    const declineReason = 'Elapsed without confirmation (auto-declined)'

    // Pre-fetch pending rows for this restaurant, filter elapsed in JS, then
    // bulk-update by id list. We previously combined the two elapsed
    // conditions with `.or('request_expires_at.lt.<iso>,booking_time.lt.<iso>')`,
    // but PostgREST's filter parser is fragile with timestamps that contain
    // `.` and `+` (e.g. `2026-05-04T15:08:03.683+00:00`) inside an `or()`
    // group, and that produced 500s for every call. The pending set per
    // restaurant is tiny in practice (usually 0–2), so the extra SELECT is
    // cheap and the syntax is robust.
    const { data: pendingRows, error: fetchError } = await supabase
      .from('bookings')
      .select('id, applied_offer_id, booking_time, request_expires_at')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'pending')

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch pending bookings' }, { status: 500 })
    }

    const declinedRows = (pendingRows ?? []).filter((b) => {
      const expiresAt = b.request_expires_at ? Date.parse(b.request_expires_at) : 0
      const bookingTime = b.booking_time ? Date.parse(b.booking_time) : 0
      return (expiresAt > 0 && expiresAt < nowMs) || (bookingTime > 0 && bookingTime < nowMs)
    })
    const declinedIds = declinedRows.map((b) => b.id)

    if (declinedIds.length > 0) {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'auto_declined',
          auto_declined: true,
          updated_at: nowIso,
          declined_at: nowIso,
          declined_by_staff: null,
          declined_reason: declineReason,
        })
        .in('id', declinedIds)

      if (updateError) {
        console.error('[auto-decline] bulk update failed:', updateError)
        return NextResponse.json({ error: 'Failed to auto-decline bookings' }, { status: 500 })
      }

      // Bulk-reverse offer redemptions for the bookings that actually had
      // one, then null out applied_offer_id on those bookings.
      const idsWithOffers = declinedRows.filter((b) => b.applied_offer_id).map((b) => b.id)
      if (idsWithOffers.length > 0) {
        await supabase.from('user_offers').delete().in('booking_id', idsWithOffers)
        await supabase
          .from('bookings')
          .update({ applied_offer_id: null })
          .in('id', idsWithOffers)
      }

      // One INSERT for all status-history rows.
      await supabase.from('booking_status_history').insert(
        declinedIds.map((id) => ({
          booking_id: id,
          old_status: 'pending',
          new_status: 'auto_declined',
          changed_by: null,
          reason: declineReason,
          metadata: { action: 'auto_decline_elapsed', endpoint: 'basic-auto-decline-elapsed' },
        }))
      )
    }

    return NextResponse.json({ success: true, declinedCount: declinedIds.length })
  } catch (e) {
    console.error('[auto-decline] unhandled error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
