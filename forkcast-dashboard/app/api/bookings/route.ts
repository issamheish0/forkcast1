import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

// GET /api/bookings - List bookings with filters
export async function GET(request: NextRequest) {
  try {
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('bookings')
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
        table:restaurant_tables!bookings_table_id_fkey(
          id,
          table_number,
          table_type,
          capacity
        )
      `)
      .eq('restaurant_id', staff.restaurant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (date) {
      const startDate = new Date(date)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(date)
      endDate.setHours(23, 59, 59, 999)
      
      query = query
        .gte('booking_time', startDate.toISOString())
        .lte('booking_time', endDate.toISOString())
    }

    if (status && status !== 'all') {
      // Support multiple statuses separated by commas
      const statuses = status.split(',').map(s => s.trim())
      if (statuses.length === 1) {
        query = query.eq('status', statuses[0])
      } else {
        query = query.in('status', statuses)
      }
    }

    const { data: bookings, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: "Failed to fetch bookings" },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      bookings: bookings || [],
      total: bookings?.length || 0 
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/bookings - Create new booking
export async function POST(request: NextRequest) {
  try {
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
                         staff.permissions?.includes('bookings.create')

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions to create bookings" },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate required fields
    const { 
      booking_time, 
      party_size, 
      guest_name, 
      guest_email, 
      guest_phone,
      special_requests,
      occasion,
      dietary_notes,
      user_id,
      guest_id
    } = body

    if (!booking_time || !party_size || !guest_name) {
      return NextResponse.json(
        { error: "Missing required fields: booking_time, party_size, guest_name" },
        { status: 400 }
      )
    }

    // Validate party size
    if (party_size < 1 || party_size > 20) {
      return NextResponse.json(
        { error: "Party size must be between 1 and 20" },
        { status: 400 }
      )
    }

    // Generate confirmation code
    const confirmationCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    // Find or create guest
    let finalGuestId = guest_id

    if (!finalGuestId) {
      // Try to find existing guest by email or phone
      let query = supabase
        .from('restaurant_customers')
        .select('id')
        .eq('restaurant_id', staff.restaurant_id)
      
      const conditions = []
      if (guest_email) conditions.push(`guest_email.eq.${guest_email}`)
      if (guest_phone) conditions.push(`guest_phone.eq.${guest_phone}`)
      
      if (conditions.length > 0) {
        const { data: existingGuests } = await query.or(conditions.join(','))
        if (existingGuests && existingGuests.length > 0) {
          finalGuestId = existingGuests[0].id
        }
      }

      // If still no guest, create one
      if (!finalGuestId) {
        const { data: newGuest, error: createGuestError } = await supabase
          .from('restaurant_customers')
          .insert({
            restaurant_id: staff.restaurant_id,
            guest_name,
            guest_email: guest_email || null,
            guest_phone: guest_phone || null,
            source: 'booking',
            total_bookings: 0,
            user_id: user_id || null // Link to user if provided
          })
          .select('id')
          .single()

        if (!createGuestError && newGuest) {
          finalGuestId = newGuest.id
        }
      }
    }

    // Create booking
    const bookingData = {
      restaurant_id: staff.restaurant_id,
      user_id: user_id || null,
      guest_id: finalGuestId,
      booking_time,
      party_size,
      status: 'pending',
      guest_name,
      guest_email: guest_email || null,
      guest_phone: guest_phone || null,
      special_requests: special_requests || null,
      occasion: occasion || null,
      dietary_notes: dietary_notes || null,
      confirmation_code: confirmationCode,
      source:'manual',
      turn_time_minutes: 120, // Default 2 hours
      request_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
    }

    const { data: booking, error: insertError } = await supabase
      .from('bookings')
      .insert(bookingData)
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
        )
      `)
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json(
        { error: "Failed to create booking" },
        { status: 500 }
      )
    }

    // Log booking creation
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: booking.id,
        old_status: null,
        new_status: 'pending',
        changed_by: user.id,
        reason: 'Booking created by staff'
      })

    return NextResponse.json({ 
      booking,
      message: "Booking created successfully" 
    }, { status: 201 })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}