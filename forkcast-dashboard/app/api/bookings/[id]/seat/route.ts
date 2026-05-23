import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// POST /api/bookings/[id]/seat - Direct seat booking (combines check-in and seating)
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

    // Check permissions - need both check-in and seating permissions
    const hasPermission = staff.role === 'owner' || 
                         staff.role === 'manager' ||
                         (staff.permissions?.includes('bookings.checkin') && 
                          staff.permissions?.includes('bookings.seat'))

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions to seat guests directly" },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { table_ids, notes, actual_party_size } = body

    // Validate table_ids
    if (!table_ids || !Array.isArray(table_ids) || table_ids.length === 0) {
      return NextResponse.json(
        { error: "At least one table ID is required" },
        { status: 400 }
      )
    }

    // Get current booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select(`
        *,
        booking_tables(
          table:restaurant_tables(*)
        )
      `)
      .eq('id', resolvedParams.id)
      .eq('restaurant_id', staff.restaurant_id)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      )
    }

    // Check if booking can be seated directly
    const validStatuses = ['confirmed', 'arrived']
    if (!validStatuses.includes(booking.status)) {
      return NextResponse.json(
        { error: "Only confirmed or arrived bookings can be seated directly" },
        { status: 400 }
      )
    }

    // Fetch restaurant turnover time for early-seating window
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('table_turnover_minutes')
      .eq('id', staff.restaurant_id)
      .single()

    const turnoverMinutes = booking.turn_time_minutes || restaurant?.table_turnover_minutes || 30

    // Check if booking is not too early (allow seating up to turnover time early)
    const bookingTime = new Date(booking.booking_time)
    const now = new Date()
    const earlyWindow = new Date(bookingTime.getTime() - turnoverMinutes * 60 * 1000)
    
    if (now < earlyWindow) {
      return NextResponse.json(
        { error: `Direct seating is too early. Guests can be seated up to ${turnoverMinutes} minutes before their booking time.` },
        { status: 400 }
      )
    }

    // Verify that all requested tables exist and are available
    const { data: requestedTables, error: tablesError } = await supabase
      .from('restaurant_tables')
      .select('*')
      .eq('restaurant_id', staff.restaurant_id)
      .in('id', table_ids)

    if (tablesError || !requestedTables || requestedTables.length !== table_ids.length) {
      return NextResponse.json(
        { error: "One or more tables not found or not available" },
        { status: 400 }
      )
    }

    // Check if any of the requested tables are currently occupied
    const { data: occupiedTables, error: occupiedError } = await supabase
      .from('booking_tables')
      .select(`
        table_id,
        booking:bookings!booking_tables_booking_id_fkey(
          id,
          status,
          booking_time
        )
      `)
      .in('table_id', table_ids)

    if (occupiedError) {
      return NextResponse.json(
        { error: "Failed to check table availability" },
        { status: 500 }
      )
    }

    // Filter for actually occupied tables (bookings that are physically present)
    const physicallyPresentStatuses = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment']
    const actuallyOccupied = occupiedTables?.filter((ot: any) => 
      ot.booking && 
      ot.booking.id !== booking.id && 
      physicallyPresentStatuses.includes(ot.booking.status)
    ) || []

    if (actuallyOccupied.length > 0) {
      const occupiedTableIds = actuallyOccupied.map(ot => ot.table_id)
      const occupiedTableNumbers = requestedTables
        .filter(t => occupiedTableIds.includes(t.id))
        .map(t => t.table_number)
        .join(', ')
      
      return NextResponse.json(
        { error: `Tables ${occupiedTableNumbers} are currently occupied` },
        { status: 400 }
      )
    }

    // Start a transaction to handle the direct seating process
    // Step 1: Remove any existing table assignments for this booking
    if (booking.booking_tables && booking.booking_tables.length > 0) {
      const { error: removeError } = await supabase
        .from('booking_tables')
        .delete()
        .eq('booking_id', booking.id)

      if (removeError) {
        console.error('Error removing existing table assignments:', removeError)
        return NextResponse.json(
          { error: "Failed to update table assignments" },
          { status: 500 }
        )
      }
    }

    // Step 2: Assign new tables to the booking
    const tableAssignments = table_ids.map((tableId: string) => ({
      booking_id: booking.id,
      table_id: tableId,
      assigned_at: new Date().toISOString()
    }))

    const { error: assignError } = await supabase
      .from('booking_tables')
      .insert(tableAssignments)

    if (assignError) {
      console.error('Error assigning tables:', assignError)
      return NextResponse.json(
        { error: "Failed to assign tables" },
        { status: 500 }
      )
    }

    // Step 3: Update booking status to 'seated' and set relevant timestamps
    const updateData: any = {
      status: 'seated',
      checked_in_at: booking.status === 'confirmed' ? new Date().toISOString() : booking.checked_in_at,
      seated_at: new Date().toISOString(),
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
        { error: "Failed to seat booking" },
        { status: 500 }
      )
    }

    // Step 4: Log status changes in booking history
    const statusHistory = []
    
    // If booking wasn't checked in yet, log check-in first
    if (booking.status === 'confirmed') {
      statusHistory.push({
        booking_id: resolvedParams.id,
        old_status: 'confirmed',
        new_status: 'arrived',
        changed_by: user.id,
        reason: 'Auto check-in during direct seating',
        metadata: actual_party_size ? { actual_party_size } : {}
      })
    }
    
    // Log seating
    statusHistory.push({
      booking_id: resolvedParams.id,
      old_status: booking.status === 'confirmed' ? 'arrived' : booking.status,
      new_status: 'seated',
      changed_by: user.id,
      reason: notes || 'Guest seated directly by staff',
      metadata: {
        table_ids,
        table_numbers: requestedTables.map(t => t.table_number),
        ...(actual_party_size && { actual_party_size })
      }
    })

    if (statusHistory.length > 0) {
      await supabase
        .from('booking_status_history')
        .insert(statusHistory)
    }

    // Step 5: Update customer visit statistics if this is a registered user
    if (booking.user_id) {
      // Get or create customer record
      const { data: customer, error: customerError } = await supabase
        .from('restaurant_customers')
        .select('*')
        .eq('restaurant_id', staff.restaurant_id)
        .eq('user_id', booking.user_id)
        .single()

      if (!customerError && customer) {
        // Just ensure booking is linked, trigger will handle stats
        if (booking.guest_id !== customer.id) {
            await supabase
            .from('bookings')
            .update({ guest_id: customer.id })
            .eq('id', booking.id)
        }
      } else {
        // Create new customer record
        const { data: newCustomer } = await supabase
          .from('restaurant_customers')
          .insert({
            restaurant_id: staff.restaurant_id,
            user_id: booking.user_id,
            first_visit: new Date().toISOString(),
            last_visit: new Date().toISOString(),
            total_bookings: 1,
            source: 'booking'
          })
          .select()
          .single()
          
        if (newCustomer) {
             await supabase
            .from('bookings')
            .update({ guest_id: newCustomer.id })
            .eq('id', booking.id)
        }
      }
    }

    return NextResponse.json({ 
      booking: updatedBooking,
      message: "Guest seated directly successfully",
      table_numbers: requestedTables.map(t => t.table_number)
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}