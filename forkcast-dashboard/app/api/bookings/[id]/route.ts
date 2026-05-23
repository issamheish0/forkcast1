import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { reverseOfferRedemption } from "@/lib/services/booking-operations"

// GET /api/bookings/[id] - Get booking details
export async function GET(
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

    // Get booking with related data
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        profiles!bookings_user_id_fkey(
          id,
          full_name,
          phone_number,
          avatar_url,
          allergies,
          dietary_restrictions
        ),
        restaurant:restaurants!bookings_restaurant_id_fkey(
          id,
          name,
          address,
          phone_number,
          main_image_url
        ),
        booking_tables(
          table:restaurant_tables(*)
        ),
        booking_status_history(
          *,
          changed_by_profile:profiles!booking_status_history_changed_by_fkey(
            full_name,
            avatar_url
          )
        )
      `)
      .eq('id', resolvedParams.id)
      .eq('restaurant_id', staff.restaurant_id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: "Booking not found" },
          { status: 404 }
        )
      }
      console.error('Database error:', error)
      return NextResponse.json(
        { error: "Failed to fetch booking" },
        { status: 500 }
      )
    }

    return NextResponse.json({ booking })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PATCH /api/bookings/[id] - Update booking
export async function PATCH(
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
                         staff.permissions?.includes('bookings.edit')

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions to update bookings" },
        { status: 403 }
      )
    }

    // Get current booking
    const { data: currentBooking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', resolvedParams.id)
      .eq('restaurant_id', staff.restaurant_id)
      .single()

    if (fetchError || !currentBooking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { 
      booking_time,
      party_size,
      status,
      special_requests,
      occasion,
      dietary_notes,
      guest_name,
      guest_email,
      guest_phone
    } = body

    // Build update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (booking_time !== undefined) updateData.booking_time = booking_time
    if (party_size !== undefined) {
      if (party_size < 1 || party_size > 20) {
        return NextResponse.json(
          { error: "Party size must be between 1 and 20" },
          { status: 400 }
        )
      }
      updateData.party_size = party_size
    }
    if (status !== undefined) updateData.status = status
    if (special_requests !== undefined) updateData.special_requests = special_requests
    if (occasion !== undefined) updateData.occasion = occasion
    if (dietary_notes !== undefined) updateData.dietary_notes = dietary_notes
    if (guest_name !== undefined) updateData.guest_name = guest_name
    if (guest_email !== undefined) updateData.guest_email = guest_email
    if (guest_phone !== undefined) updateData.guest_phone = guest_phone

    // Update booking
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', resolvedParams.id)
      .eq('restaurant_id', staff.restaurant_id)
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
          address
        ),
        booking_tables(
          table:restaurant_tables(*)
        )
      `)
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: "Failed to update booking" },
        { status: 500 }
      )
    }

    // Log status change if status was updated
    if (status !== undefined && status !== currentBooking.status) {
      await supabase
        .from('booking_status_history')
        .insert({
          booking_id: resolvedParams.id,
          old_status: currentBooking.status,
          new_status: status,
          changed_by: user.id,
          reason: 'Status updated by staff'
        })
    }

    return NextResponse.json({ 
      booking: updatedBooking,
      message: "Booking updated successfully" 
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE /api/bookings/[id] - Cancel booking
export async function DELETE(
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
                         staff.permissions?.includes('bookings.delete')

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions to cancel bookings" },
        { status: 403 }
      )
    }

    const { reason } = await request.json().catch(() => ({ reason: null }))

    // First get the booking to check for applied offers
    const { data: bookingToCancel, error: fetchError } = await supabase
      .from('bookings')
      .select('applied_offer_id')
      .eq('id', resolvedParams.id)
      .eq('restaurant_id', staff.restaurant_id)
      .single()

    if (fetchError || !bookingToCancel) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      )
    }

    // Update booking status to cancelled
    const { data: cancelledBooking, error } = await supabase
      .from('bookings')
      .update({ 
        status: 'cancelled_by_restaurant',
        updated_at: new Date().toISOString()
      })
      .eq('id', resolvedParams.id)
      .eq('restaurant_id', staff.restaurant_id)
      .select('*')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: "Booking not found" },
          { status: 404 }
        )
      }
      console.error('Update error:', error)
      return NextResponse.json(
        { error: "Failed to cancel booking" },
        { status: 500 }
      )
    }

    // Reverse offer redemption if applicable
    await reverseOfferRedemption(supabase, resolvedParams.id, bookingToCancel.applied_offer_id)

    // Log cancellation
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: resolvedParams.id,
        old_status: cancelledBooking.status,
        new_status: 'cancelled_by_restaurant',
        changed_by: user.id,
        reason: reason || 'Cancelled by restaurant staff'
      })

    return NextResponse.json({ 
      message: "Booking cancelled successfully" 
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}