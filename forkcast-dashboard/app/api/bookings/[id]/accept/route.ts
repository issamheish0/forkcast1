import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// POST /api/bookings/[id]/accept - Accept booking request
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
        { error: "Insufficient permissions to accept bookings" },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { table_ids, notes } = body

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
        { error: "Only pending bookings can be accepted" },
        { status: 400 }
      )
    }

    // Update booking status to confirmed
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({ 
        status: 'confirmed',
        updated_at: new Date().toISOString(),
        acceptance_attempted_at: new Date().toISOString()
      })
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
        { error: "Failed to accept booking" },
        { status: 500 }
      )
    }

    // Assign tables if provided
    if (table_ids && Array.isArray(table_ids) && table_ids.length > 0) {
      // First verify all tables belong to the restaurant
      const { data: tables, error: tablesError } = await supabase
        .from('restaurant_tables')
        .select('id')
        .eq('restaurant_id', staff.restaurant_id)
        .in('id', table_ids)

      if (tablesError || tables.length !== table_ids.length) {
        return NextResponse.json(
          { error: "Invalid table selection" },
          { status: 400 }
        )
      }

      // Remove existing table assignments
      await supabase
        .from('booking_tables')
        .delete()
        .eq('booking_id', resolvedParams.id)

      // Add new table assignments
      const tableAssignments = table_ids.map((tableId: string) => ({
        booking_id: resolvedParams.id,
        table_id: tableId
      }))

      const { error: assignError } = await supabase
        .from('booking_tables')
        .insert(tableAssignments)

      if (assignError) {
        console.error('Table assignment error:', assignError)
        // Continue - table assignment is not critical for acceptance
      }
    }

    // Log status change
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: resolvedParams.id,
        old_status: 'pending',
        new_status: 'confirmed',
        changed_by: user.id,
        reason: notes || 'Booking accepted by staff',
        metadata: table_ids ? { assigned_tables: table_ids } : {}
      })

    return NextResponse.json({ 
      booking: updatedBooking,
      message: "Booking accepted successfully" 
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}