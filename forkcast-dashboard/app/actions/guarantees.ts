'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Fetch guarantee details for a booking
 */
export async function getGuaranteeDetails(bookingId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('get_booking_guarantee_details', {
    p_booking_id: bookingId
  })

  if (error) {
    console.error('Error fetching guarantee details:', error)
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

/**
 * Cancel a booking as Staff (No Show / Customer Cancelled)
 * Returns penalty eligibility info
 */
export async function staffCancelBooking(bookingId: string, reason: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('staff_cancel_booking_with_guarantee', {
    p_booking_id: bookingId,
    p_cancellation_reason: reason
  })

  if (error) {
    console.error('Error cancelling booking:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/bookings')
  revalidatePath(`/bookings/${bookingId}`)
  
  return { success: true, data }
}

/**
 * Charge or Waive Penalty via Edge Function
 * Uses Supabase functions.invoke for proper authentication
 */
export async function processPenalty({
  guaranteeId,
  reason,
  action, // 'charge' | 'waive'
  waiverReason,
  amount
}: {
  guaranteeId: string
  reason: 'no_show' | 'late_cancellation'
  action: 'charge' | 'waive'
  waiverReason?: string
  amount?: number
}) {
  const supabase = await createClient()
  
  // Get current user for audit
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const payload = {
    booking_guarantee_id: guaranteeId,
    reason,
    waive: action === 'waive',
    waiver_reason: waiverReason,
    amount,
    initiated_by: user.id
  }
  
  try {
    // Use supabase.functions.invoke which properly handles authentication
    // This passes the user's JWT in the Authorization header
    const { data, error } = await supabase.functions.invoke('charge-penalty', {
      body: payload
    })

    if (error) {
      console.error('Edge function error:', error)
      throw new Error(error.message || 'Failed to process penalty')
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Failed to process penalty')
    }

    revalidatePath('/bookings')
    
    return { success: true, data }
  } catch (error: any) {
    console.error('Error processing penalty:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Save Restaurant Guarantee Settings
 */
export async function saveGuaranteeSettings(restaurantId: string, settings: any) {
    const supabase = await createClient()

    // Verify authentication and permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Unauthorized' }
    }

    const { data: staffAccess } = await supabase
        .from('restaurant_staff')
        .select('id, role')
        .eq('user_id', user.id)
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .single()

    if (!staffAccess || !['owner', 'manager'].includes(staffAccess.role)) {
        return { success: false, error: 'Only owners or managers can update guarantee settings' }
    }

    // Whitelist allowed settings fields
    const allowedFields = ['is_enabled', 'guarantee_type', 'amount', 'currency', 'hold_duration_hours', 'cancellation_policy', 'no_show_charge_percentage', 'late_cancellation_charge_percentage', 'late_cancellation_hours']
    const safeSettings: Record<string, any> = {}
    for (const key of allowedFields) {
        if (key in settings) {
            safeSettings[key] = settings[key]
        }
    }

    // We'll use upsert for simplicity
    const { error } = await supabase
        .from('card_guarantee_settings')
        .upsert({
            restaurant_id: restaurantId,
            ...safeSettings,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'restaurant_id'
        })
    
    if (error) {
        console.error('Error saving guarantee settings:', error)
        return { success: false, error: error.message }
    }
    
    revalidatePath('/settings/guarantees') // Future path
    return { success: true }
}
