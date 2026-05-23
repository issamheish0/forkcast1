/**
 * Booking Operations Service
 * 
 * Direct Supabase operations for booking management.
 * Replaces API routes: /api/bookings/[id]/accept, /api/bookings/[id]/decline, /api/bookings/[id]/check-in
 */

import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { notifyUserDeclinedByRestaurant } from './notify-booking-declined'

export interface BookingActionResult {
  success: boolean
  error?: string
  data?: any
}

/**
 * Accept a pending booking
 */
export async function acceptBooking(bookingId: string, staffId: string): Promise<BookingActionResult> {
  try {
    const supabase = createClient()

    // Update booking status to confirmed
    const { data: booking, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmed_by_staff: staffId,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .eq('status', 'pending') // Only accept pending bookings
      .select()
      .single()

    if (updateError) {
      console.error('Error accepting booking:', updateError)
      return { success: false, error: 'Failed to accept booking' }
    }

    if (!booking) {
      return { success: false, error: 'Booking not found or already processed' }
    }

    // Create booking history record
    await supabase
      .from('booking_history')
      .insert({
        booking_id: bookingId,
        previous_status: 'pending',
        new_status: 'confirmed',
        changed_by: staffId,
        changed_at: new Date().toISOString(),
        notes: 'Booking accepted by staff'
      })

    toast.success('Booking accepted successfully')
    return { success: true, data: booking }

  } catch (error) {
    console.error('Error in acceptBooking:', error)
    return { success: false, error: 'Unexpected error accepting booking' }
  }
}

/**
 * Decline a pending booking
 */
export async function declineBooking(bookingId: string, staffId: string, reason?: string, decline_note?: string): Promise<BookingActionResult> {
  try {
    const supabase = createClient()

    // Update booking status to declined
    const { data: booking, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'declined_by_restaurant',
        declined_at: new Date().toISOString(),
        declined_by_staff: staffId,
        declined_reason: reason || 'Declined by restaurant',
        decline_note,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .eq('status', 'pending') // Only decline pending bookings
      .select()
      .single()

    if (updateError) {
      console.error('Error declining booking:', updateError)
      return { success: false, error: 'Failed to decline booking' }
    }

    if (!booking) {
      return { success: false, error: 'Booking not found or already processed' }
    }

    // Reverse offer redemption if applicable
    await reverseOfferRedemption(supabase, bookingId, booking.applied_offer_id)

    // Create booking history record
    await supabase
      .from('booking_history')
      .insert({
        booking_id: bookingId,
        previous_status: 'pending',
        new_status: 'declined',
        changed_by: staffId,
        changed_at: new Date().toISOString(),
        notes: reason || 'Booking declined by staff'
      })

    // Notify user via WhatsApp
    notifyUserDeclinedByRestaurant(bookingId).catch(err => {
      console.error('Failed to send WhatsApp notification:', err)
      // Don't fail the operation if notification fails
    })

    toast.success('Booking declined')
    return { success: true, data: booking }

  } catch (error) {
    console.error('Error in declineBooking:', error)
    return { success: false, error: 'Unexpected error declining booking' }
  }
}

/**
 * Check in a confirmed booking
 */
export async function checkInBooking(bookingId: string, staffId: string): Promise<BookingActionResult> {
  try {
    const supabase = createClient()

    // Get booking details first
    const { data: existingBooking, error: fetchError } = await supabase
      .from('bookings')
      .select(`
        *,
        user:profiles!bookings_user_id_fkey(*)
      `)
      .eq('id', bookingId)
      .single()

    if (fetchError || !existingBooking) {
      return { success: false, error: 'Booking not found' }
    }

    if (existingBooking.status !== 'confirmed') {
      return { success: false, error: 'Only confirmed bookings can be checked in' }
    }

    // Update booking status to arrived
    const { data: booking, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'arrived',
        checked_in_at: new Date().toISOString(),
        checked_in_by_staff: staffId,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select()
      .single()

    if (updateError) {
      console.error('Error checking in booking:', updateError)
      return { success: false, error: 'Failed to check in booking' }
    }

    // Create or update restaurant customer record
    if (existingBooking.user_id && existingBooking.restaurant_id) {
      await supabase
        .from('restaurant_customers')
        .upsert({
          user_id: existingBooking.user_id,
          restaurant_id: existingBooking.restaurant_id,
          first_visit: new Date().toISOString(),
          last_visit: new Date().toISOString(),
          visit_count: 1,
          total_spent: 0,
          notes: `First visit via booking ${bookingId}`,
          is_vip: false,
          is_banned: false,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,restaurant_id',
          ignoreDuplicates: false
        })
        .select()
        .then(({ data: customerData, error: customerError }) => {
          if (!customerError && customerData?.[0]) {
            // Update visit count and last visit for existing customers
            return supabase
              .from('restaurant_customers')
              .update({
                last_visit: new Date().toISOString(),
                visit_count: (customerData[0].visit_count || 0) + 1,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', existingBooking.user_id)
              .eq('restaurant_id', existingBooking.restaurant_id)
          }
        })
    }

    // Create booking history record
    await supabase
      .from('booking_history')
      .insert({
        booking_id: bookingId,
        previous_status: 'confirmed',
        new_status: 'arrived',
        changed_by: staffId,
        changed_at: new Date().toISOString(),
        notes: 'Customer checked in'
      })

    toast.success('Customer checked in successfully')
    return { success: true, data: booking }

  } catch (error) {
    console.error('Error in checkInBooking:', error)
    return { success: false, error: 'Unexpected error checking in booking' }
  }
}

/**
 * Reverse offer redemption when a booking is cancelled/declined
 * Completely deletes the user_offers record instead of marking as cancelled
 */
export async function reverseOfferRedemption(supabase: any, bookingId: string, appliedOfferId?: string): Promise<void> {
  try {
    // If applied offer ID is not provided, get it from the booking
    let offerId = appliedOfferId
    if (!offerId) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('applied_offer_id')
        .eq('id', bookingId)
        .single()

      offerId = booking?.applied_offer_id
    }

    // If no offer was applied, nothing to reverse
    if (!offerId) {
      return
    }

    // Completely delete the user_offers entry instead of marking as cancelled
    const { error: deleteError } = await supabase
      .from('user_offers')
      .delete()
      .eq('booking_id', bookingId)
      .eq('offer_id', offerId)

    if (deleteError) {
      console.error('Error deleting user offer record:', deleteError)
      // Don't throw here to avoid breaking the booking cancellation
    } else {
      console.log(`User offer record completely deleted for booking ${bookingId}, offer ${offerId}`)
    }

    // Clear the applied_offer_id from the booking
    await supabase
      .from('bookings')
      .update({
        applied_offer_id: null
      })
      .eq('id', bookingId)

    console.log(`Offer redemption reversed for booking ${bookingId}, offer ${offerId}`)
  } catch (error) {
    console.error('Error in reverseOfferRedemption:', error)
    // Don't throw to avoid breaking the main operation
  }
}

/**
 * Cancel a booking (by restaurant)
 */
export async function cancelBooking(bookingId: string, staffId: string, reason?: string, cancellation_note?: string): Promise<BookingActionResult> {
  try {
    const supabase = createClient()

    const { data: booking, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled_by_restaurant',
        cancelled_at: new Date().toISOString(),
        cancelled_by_staff: staffId,
        cancellation_reason: reason || 'Cancelled by restaurant',
        cancellation_note,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .neq('status', 'completed') // Don't cancel completed bookings
      .neq('status', 'no_show') // Don't cancel no-shows
      .select()
      .single()

    if (updateError) {
      console.error('Error cancelling booking:', updateError)
      return { success: false, error: 'Failed to cancel booking' }
    }

    if (!booking) {
      return { success: false, error: 'Booking not found or cannot be cancelled' }
    }

    // Reverse offer redemption if applicable
    await reverseOfferRedemption(supabase, bookingId, booking.applied_offer_id)

    // Create booking history record
    await supabase
      .from('booking_history')
      .insert({
        booking_id: bookingId,
        previous_status: booking.status,
        new_status: 'cancelled_by_restaurant',
        changed_by: staffId,
        changed_at: new Date().toISOString(),
        notes: reason || 'Booking cancelled by restaurant'
      })

    toast.success('Booking cancelled')
    return { success: true, data: booking }

  } catch (error) {
    console.error('Error in cancelBooking:', error)
    return { success: false, error: 'Unexpected error cancelling booking' }
  }
}

/**
 * Mark a booking as no-show
 */
export async function markAsNoShow(bookingId: string, staffId: string): Promise<BookingActionResult> {
  try {
    const supabase = createClient()

    // Get booking details first
    const { data: existingBooking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (fetchError || !existingBooking) {
      return { success: false, error: 'Booking not found' }
    }

    // Update booking status
    const { data: booking, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'no_show',
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select()
      .single()

    if (updateError) {
      console.error('Error marking no-show:', updateError)
      return { success: false, error: 'Failed to mark as no-show' }
    }

    // Reverse offer redemption if applicable
    // Customer didn't show up, so they shouldn't keep the special offer
    await reverseOfferRedemption(supabase, bookingId, existingBooking.applied_offer_id)

    // Update customer stats (increment no_show_count)
    if (existingBooking.user_id && existingBooking.restaurant_id) {
      const { data: customerData, error: customerError } = await supabase
        .from('restaurant_customers')
        .select('id, no_show_count')
        .eq('user_id', existingBooking.user_id)
        .eq('restaurant_id', existingBooking.restaurant_id)
        .single()

      if (!customerError && customerData) {
        await supabase
          .from('restaurant_customers')
          .update({
            no_show_count: (customerData.no_show_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', customerData.id)
      }
    }

    // Create booking history record
    await supabase
      .from('booking_history')
      .insert({
        booking_id: bookingId,
        previous_status: existingBooking.status,
        new_status: 'no_show',
        changed_by: staffId,
        changed_at: new Date().toISOString(),
        notes: 'Marked as no-show by staff'
      })

    toast.success('Booking marked as no-show')
    return { success: true, data: booking }

  } catch (error) {
    console.error('Error in markAsNoShow:', error)
    return { success: false, error: 'Unexpected error marking no-show' }
  }
}
