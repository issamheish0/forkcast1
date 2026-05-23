import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// POST /api/bookings/[id]/check-in - Check in booking
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
                         staff.permissions?.includes('bookings.checkin')

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions to check in bookings" },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { notes, actual_party_size } = body

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

    // Check if booking can be checked in
    const validStatuses = ['confirmed', 'arrived']
    if (!validStatuses.includes(booking.status)) {
      return NextResponse.json(
        { error: "Only confirmed or arrived bookings can be checked in" },
        { status: 400 }
      )
    }

    // Fetch restaurant turnover time for early check-in window
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('table_turnover_minutes')
      .eq('id', staff.restaurant_id)
      .single()

    const turnoverMinutes = booking.turn_time_minutes || restaurant?.table_turnover_minutes || 30

    // Check if booking is not too early (allow check-in up to turnover time early)
    const bookingTime = new Date(booking.booking_time)
    const now = new Date()
    const earlyWindow = new Date(bookingTime.getTime() - turnoverMinutes * 60 * 1000)
    
    if (now < earlyWindow) {
      return NextResponse.json(
        { error: `Check-in is too early. Guests can check in up to ${turnoverMinutes} minutes before their booking time.` },
        { status: 400 }
      )
    }

    // Update booking status and check-in time
    const updateData: any = {
      status: 'arrived',
      checked_in_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Update party size if provided
    if (actual_party_size && actual_party_size !== booking.party_size) {
      updateData.party_size = actual_party_size
    }

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
        { error: "Failed to check in booking" },
        { status: 500 }
      )
    }

    // Log status change
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: resolvedParams.id,
        old_status: booking.status,
        new_status: 'arrived',
        changed_by: user.id,
        reason: notes || 'Guest checked in by staff',
        metadata: actual_party_size ? { actual_party_size } : {}
      })

    // Update customer visit statistics
    let customerIdToUpdate = booking.guest_id

    // If no guest_id, try to find or create one (Backfill logic on check-in)
    if (!customerIdToUpdate) {
      if (booking.user_id) {
         const { data: existingCustomer } = await supabase
          .from('restaurant_customers')
          .select('id')
          .eq('restaurant_id', staff.restaurant_id)
          .eq('user_id', booking.user_id)
          .single()
        
        if (existingCustomer) {
          customerIdToUpdate = existingCustomer.id
        }
      }
      
      // If still no customer, try matching by email/phone or create new
      if (!customerIdToUpdate) {
         // Simplified for check-in: just try to find by email if available
         if (booking.guest_email) {
            const { data: existingGuest } = await supabase
              .from('restaurant_customers')
              .select('id')
              .eq('restaurant_id', staff.restaurant_id)
              .eq('guest_email', booking.guest_email)
              .single()
            
            if (existingGuest) customerIdToUpdate = existingGuest.id
         }
      }

      // If found/created, update the booking to link it for future
      // The trigger will fire on this update and recalculate stats!
      if (customerIdToUpdate) {
        await supabase
          .from('bookings')
          .update({ guest_id: customerIdToUpdate })
          .eq('id', booking.id)
      } else if (booking.user_id) {
        // Create new customer record if needed
        // This insert will NOT trigger the booking trigger (as it's on bookings table), 
        // but the booking update above (if we had customerId) would.
        // If we create a NEW customer here, we should link it to the booking.
        
        const { data: newCustomer, error: createError } = await supabase
          .from('restaurant_customers')
          .insert({
            restaurant_id: staff.restaurant_id,
            user_id: booking.user_id,
            first_visit: new Date().toISOString(),
            last_visit: new Date().toISOString(),
            total_bookings: 1,
            source: 'booking'
          })
          .select('id')
          .single()
          
        if (!createError && newCustomer) {
             await supabase
              .from('bookings')
              .update({ guest_id: newCustomer.id })
              .eq('id', booking.id)
        }
      }
    }

    return NextResponse.json({ 
      booking: updatedBooking,
      message: "Booking checked in successfully" 
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}