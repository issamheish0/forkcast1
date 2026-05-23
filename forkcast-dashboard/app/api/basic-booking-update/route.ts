// app/api/basic-booking-update/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { reverseOfferRedemption } from '@/lib/services/booking-operations'
import { notifyUserDeclinedByRestaurant } from '@/lib/services/notify-booking-declined'

export async function POST(request: NextRequest) {
  try {
    const { bookingId, status, note } = await request.json()
    
    // Validate that status is one of the allowed booking statuses
    const allowedStatuses = [
      'confirmed',
      'declined_by_restaurant',
      'completed',
      'cancelled_by_restaurant',
      'cancelled_by_user',
      'no_show'
    ]

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({
        error: `Invalid status. Allowed statuses: ${allowedStatuses.join(', ')}`
      }, { status: 400 })
    }

    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // FIXED: First get the booking to know which restaurant it belongs to
    const { data: currentBooking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, status, restaurant_id, applied_offer_id')
      .eq('id', bookingId)
      .single()

    if (bookingError || !currentBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }


    // FIXED: Now get the specific restaurant staff record for THIS restaurant
    // This works correctly for multi-restaurant users because we filter by BOTH user_id AND restaurant_id
    const { data: staffData, error: staffError } = await supabase
      .from('restaurant_staff')
      .select(`
        restaurant_id,
        role,
        is_active,
        restaurant:restaurants(
          id,
          tier,
          name
        )
      `)
      .eq('user_id', user.id)
      .eq('restaurant_id', currentBooking.restaurant_id)
      .eq('is_active', true)
      .single()

    if (staffError || !staffData) {
      return NextResponse.json({ 
        error: 'You do not have access to this restaurant' 
      }, { status: 403 })
    }


    // Handle both array and object formats from Supabase
    const restaurant = Array.isArray(staffData.restaurant) 
      ? staffData.restaurant[0] 
      : staffData.restaurant


    // Verify this is a Basic tier restaurant
    if (restaurant?.tier !== 'basic') {
      console.warn('⚠️ [basic-booking-update] Wrong tier:', restaurant?.tier)
      return NextResponse.json({ 
        error: 'This endpoint is only for Basic tier restaurants' 
      }, { status: 403 })
    }

    // Allow status transitions based on current status
    const validTransitions: Record<string, string[]> = {
      'pending': ['confirmed', 'declined_by_restaurant'],
      'confirmed': ['completed', 'cancelled_by_restaurant', 'cancelled_by_user', 'no_show'],
      'declined_by_restaurant': [],
      'completed': [],
      'cancelled_by_restaurant': [],
      'cancelled_by_user': [],
      'no_show': []
    }

    const allowedNextStatuses = validTransitions[currentBooking.status] || []
    if (!allowedNextStatuses.includes(status)) {
      console.warn('⚠️ [basic-booking-update] Invalid transition:', currentBooking.status, '→', status)
      return NextResponse.json({
        error: `Cannot update booking from '${currentBooking.status}' to '${status}'. Allowed transitions: ${allowedNextStatuses.join(', ') || 'none'}`
      }, { status: 400 })
    }


    // Prepare update data with appropriate note fields
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }

    // Add note to appropriate field based on status
    if (status === 'declined_by_restaurant') {
      updateData.declined_at = new Date().toISOString()
      updateData.declined_by_staff = user.id
      updateData.declined_reason = 'Declined by restaurant'
      if (note) {
        updateData.decline_note = note
      }
    } else if (status === 'cancelled_by_restaurant') {
      updateData.cancelled_at = new Date().toISOString()
      updateData.cancelled_by_staff = user.id
      updateData.cancellation_reason = 'Cancelled by restaurant'
      if (note) {
        updateData.cancellation_note = note
      }
    }

    // Update the booking status
    const { error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
    }


    // Reverse offer redemption for cancellation/decline statuses (except user cancellations)
    if (['cancelled_by_restaurant', 'declined_by_restaurant'].includes(status)) {
      await reverseOfferRedemption(supabase, bookingId, currentBooking.applied_offer_id)
    }

    // Add to status history
    const { error: historyError } = await supabase
      .from('booking_status_history')
      .insert({
        booking_id: bookingId,
        old_status: currentBooking.status,
        new_status: status,
        changed_by: user.id,
        reason: `Status changed to ${status} via Basic Dashboard`,
        metadata: {
          tier: 'basic',
          endpoint: 'basic-booking-update'
        }
      })

    if (historyError) {
      console.error('Error creating status history:', historyError)
      // Don't fail the request if history creation fails
    }

    // Notify user via WhatsApp if booking was declined
    if (status === 'declined_by_restaurant') {
      notifyUserDeclinedByRestaurant(bookingId).catch(err => {
        console.error('Failed to send WhatsApp notification:', err)
        // Don't fail the operation if notification fails
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: `Booking status updated to ${status} successfully`,
      booking: {
        id: bookingId,
        status,
        updated_at: new Date().toISOString()
      }
    })

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
