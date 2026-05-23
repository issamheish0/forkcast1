import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { notifyUserDeclinedByRestaurant } from "@/lib/services/notify-booking-declined"

// POST /api/bookings/[id]/decline - Decline booking request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const supabase = await createClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get staff data to verify restaurant access
    const { data: staff, error: staffError } = await supabase
      .from('restaurant_staff')
      .select('restaurant_id, role, permissions')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (staffError || !staff) {
      return NextResponse.json(
        { error: "Access denied. Staff member not found." },
        { status: 403 }
      )
    }

    // Check permissions
    const hasPermission = staff.role === 'owner' || 
                         staff.role === 'manager' ||
                         staff.permissions?.includes('bookings.manage')

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions to decline bookings" },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { reason, suggested_alternative_time, suggested_alternative_tables } = body

    // Get current booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', resolvedParams.id)
      .eq('restaurant_id', staff.restaurant_id)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      )
    }

    // Check if booking is in pending status
    if (booking.status !== 'pending') {
      return NextResponse.json(
        { error: "Only pending bookings can be declined" },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: any = { 
      status: 'declined_by_restaurant',
      updated_at: new Date().toISOString(),
      acceptance_attempted_at: new Date().toISOString(),
      acceptance_failed_reason: reason || 'Declined by restaurant'
    }

    // Add suggested alternatives if provided
    if (suggested_alternative_time) {
      updateData.suggested_alternative_time = suggested_alternative_time
    }
    if (suggested_alternative_tables && Array.isArray(suggested_alternative_tables)) {
      updateData.suggested_alternative_tables = suggested_alternative_tables
    }

    // Update booking status to declined
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', resolvedParams.id)
      .select(`
        *,
        profiles!bookings_user_id_fkey(
          id,
          full_name,
          phone_number,
          avatar_url
        ),
        restaurant:restaurants!bookings_restaurant_id_fkey(
          id,
          name,
          address,
          phone_number
        )
      `)
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: "Failed to decline booking" },
        { status: 500 }
      )
    }

    // Log status change
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: resolvedParams.id,
        old_status: 'pending',
        new_status: 'declined_by_restaurant',
        changed_by: user.id,
        reason: reason || 'Booking declined by staff',
        metadata: {
          suggested_alternative_time,
          suggested_alternative_tables
        }
      })

    // Notify user via WhatsApp
    notifyUserDeclinedByRestaurant(resolvedParams.id).catch(err => {
      console.error('Failed to send WhatsApp notification:', err)
      // Don't fail the operation if notification fails
    })

    return NextResponse.json({ 
      booking: updatedBooking,
      message: "Booking declined successfully" 
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}