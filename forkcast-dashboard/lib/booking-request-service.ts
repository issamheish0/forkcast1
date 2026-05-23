// lib/booking-request-service.ts
import { createClient } from "@/lib/supabase/client"
import { addHours, format } from "date-fns"
import { TableAvailabilityService } from "./table-availability"
import { RestaurantAvailability } from "./restaurant-availability"
import { reverseOfferRedemption } from "./services/booking-operations"
import { getRestaurantTier, isBasicTier } from "./utils/tier"
import { notifyUserDeclinedByRestaurant } from "./services/notify-booking-declined"
import { evaluateSectionBookingType, type BookingContext } from "./table-booking-rules"
import { getSectionCurrentCovers, getSectionMaxCovers } from "./section-capacity"
import type { TableBookingRule } from "@/types"

interface AcceptanceValidation {
  valid: boolean
  reason?: string
  conflicts?: any[]
  suggestedAlternatives?: {
    tables?: string[]
    times?: Array<{ time: Date; availableTables: number }>
  }
}

interface AcceptRequestResult {
  success: boolean
  booking?: any
  error?: string
  alternatives?: AcceptanceValidation['suggestedAlternatives']
  requiresConfirmation?: boolean
}

export class BookingRequestService {
  private supabase
  private tableService: TableAvailabilityService
  private availabilityService: RestaurantAvailability
  
  constructor() {
    this.supabase = createClient()
    this.tableService = new TableAvailabilityService()
    this.availabilityService = new RestaurantAvailability()
  }

  async createBookingRequest(data: {
    restaurantId: string
    userId: string
    bookingTime: Date
    partySize: number
    specialRequests?: string
    occasion?: string
    guestName?: string
    guestEmail?: string
    guestPhone?: string
    turnTimeMinutes?: number
    preApproved?: boolean
    isWalkIn?: boolean
    preferredSection?: string
  }) {
    try {
      // Get restaurant settings with retry logic
      const { data: restaurant, error: restaurantError } = await this.supabase
        .from("restaurants")
        .select(`
          id,
          booking_policy,
          request_expiry_hours,
          auto_decline_enabled,
          booking_window_days,
          max_party_size,
          min_party_size,
          table_turnover_minutes,
          status,
          tier
        `)
        .eq("id", data.restaurantId)
        .single()

      if (restaurantError || !restaurant) {
        throw new Error("Restaurant not found or unavailable")
      }

      // Validate restaurant is active
      if (restaurant.status !== 'active') {
        throw new Error("Restaurant is currently not accepting bookings")
      }

      // Validate party size (will be used in future validation)
      // const minSize = restaurant.min_party_size || 1
      // const maxSize = restaurant.max_party_size || 20
      


      // Validate booking window
      const bookingWindowDays = restaurant.booking_window_days || 30
      const maxBookingDate = addHours(new Date(), bookingWindowDays * 24)
      
      if (data.bookingTime > maxBookingDate) {
        throw new Error(`Bookings can only be made up to ${bookingWindowDays} days in advance`)
      }

      // Validate booking is in the future (except for walk-ins)
      if (!data.isWalkIn && data.bookingTime <= new Date()) {
        throw new Error("Booking time must be in the future")
      }

      // Validate restaurant availability (operating hours, special hours, closures)
      const availability = await this.availabilityService.isRestaurantOpen(
        data.restaurantId,
        data.bookingTime,
        format(data.bookingTime, 'HH:mm')
      )
      
      if (!availability.isOpen) {
        throw new Error(availability.reason || "Restaurant is not available at this time")
      }

      // Check if this should be a waitlist entry for basic tier restaurants
      const restaurantTier = getRestaurantTier(restaurant)
      if (isBasicTier(restaurantTier) && !data.preApproved && !data.isWalkIn) {
        // Check if booking time falls within waitlist schedule
        const { data: isWaitlistTime } = await this.supabase
          .rpc('is_waitlist_time', {
            restaurant_id_param: data.restaurantId,
            booking_time_param: data.bookingTime.toISOString()
          })

        if (isWaitlistTime) {
          // Create waitlist entry instead of booking
          return await this.createWaitlistEntry(data)
        }
      }

      // Determine booking type: check table defaults + rules in the section
      // If any available table in the section is 'instant', booking is auto-confirmed
      // Otherwise falls to 'request' (default)
      let isRequestBooking = !data.preApproved

      if (!data.preApproved) {
        const bookingType = await this.evaluateBookingType(
          data.restaurantId,
          data.bookingTime,
          data.partySize,
          data.preferredSection
        )
        isRequestBooking = bookingType === 'request'
      }

      // Check section capacity before proceeding (if a section is specified)
      if (data.preferredSection) {
        try {
          const { data: section } = await this.supabase
            .from('restaurant_sections')
            .select('id, name, max_covers')
            .eq('id', data.preferredSection)
            .single()

          if (section) {
            const { data: sectionTables } = await this.supabase
              .from('restaurant_tables')
              .select('id, max_capacity, capacity, section_id, is_active')
              .eq('section_id', data.preferredSection)
              .eq('restaurant_id', data.restaurantId)
              .eq('is_active', true)

            const { maxCovers } = getSectionMaxCovers(
              section as any,
              (sectionTables || []) as any[]
            )

            if (maxCovers > 0) {
              const { totalCovers: currentCovers } = await getSectionCurrentCovers(
                data.preferredSection,
                data.restaurantId,
                data.bookingTime,
                format(data.bookingTime, 'HH:mm')
              )

              if (currentCovers + data.partySize > maxCovers) {
                throw new Error(
                  `Section "${section.name}" is at capacity (${currentCovers}/${maxCovers} covers). Please choose a different section or time.`
                )
              }
            }
          }
        } catch (capacityError: any) {
          // Re-throw capacity errors, but silently continue for other errors
          if (capacityError.message?.includes('at capacity')) throw capacityError
          console.error('Section capacity check failed (non-blocking):', capacityError)
        }
      }

      const requestExpiresAt = isRequestBooking && restaurant.auto_decline_enabled
        ? addHours(new Date(), restaurant.request_expiry_hours || 24)
        : null

      // Determine initial status
      const bookingStatus = isRequestBooking ? 'pending' : 'confirmed'
      
      // Generate unique confirmation code
      const confirmationCode = await this.generateUniqueConfirmationCode(data.restaurantId)

      // Create booking
      const { data: booking, error } = await this.supabase
        .from("bookings")
        .insert({
          restaurant_id: data.restaurantId,
          user_id: data.userId,
          booking_time: data.bookingTime.toISOString(),
          party_size: data.partySize,
          status: bookingStatus,
          special_requests: data.specialRequests,
          occasion: data.occasion,
          guest_name: data.guestName,
          guest_email: data.guestEmail,
          guest_phone: data.guestPhone,
          confirmation_code: confirmationCode,
          request_expires_at: requestExpiresAt?.toISOString(),
          turn_time_minutes: data.turnTimeMinutes || restaurant.table_turnover_minutes || 120,
          preferred_section: data.preferredSection || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          source:'manual'
        })
        .select()
        .single()

      if (error) {
        console.error("Booking creation error:", error)
        throw new Error("Failed to create booking")
      }

      // Log initial status
      await this.supabase
        .from("booking_status_history")
        .insert({
          booking_id: booking.id,
          new_status: bookingStatus,
          changed_by: data.userId,
          changed_at: new Date().toISOString(),
          metadata: {
            source: 'customer_request',
            booking_policy: restaurant.booking_policy,
            expires_at: requestExpiresAt?.toISOString(),
            pre_approved: data.preApproved || false
          }
        })

      // Auto-assign best available table for instant bookings
      let assignedTableId: string | null = null
      if (!isRequestBooking && data.preferredSection) {
        try {
          assignedTableId = await this.autoAssignTable(
            data.restaurantId,
            booking.id,
            data.bookingTime,
            data.partySize,
            data.turnTimeMinutes || restaurant.table_turnover_minutes || 120,
            data.preferredSection
          )
        } catch (autoAssignError) {
          // Non-blocking: booking is still confirmed even if table assignment fails
          console.error('Auto-assign table failed (non-blocking):', autoAssignError)
        }
      }

      return {
        booking,
        isRequest: isRequestBooking,
        expiresAt: requestExpiresAt,
        confirmationCode,
        assignedTableId,
      }
    } catch (error) {
      console.error("Create booking request error:", error)
      throw error
    }
  }

  async acceptRequest(
    bookingId: string, 
    userId: string, 
    tableIds?: string[],
    options?: {
      forceAccept?: boolean
      suggestAlternatives?: boolean
      skipTableAssignment?: boolean
    }
  ): Promise<AcceptRequestResult> {
    try {
      // Fetch booking directly instead of using missing RPC
      const { data: booking, error: fetchError } = await this.supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single()

      if (fetchError || !booking) {
        return { 
          success: false, 
          error: "Booking not found or being processed" 
        }
      }

      // Validate booking status
      if (booking.status !== 'pending') {
        return { 
          success: false, 
          error: `Booking is already ${booking.status}` 
        }
      }

      // Check expiry
      if (booking.request_expires_at && new Date(booking.request_expires_at) < new Date()) {
        // Auto-decline expired booking
        await this.updateBookingStatus(bookingId, 'auto_declined', userId, {
          reason: "Request expired before acceptance"
        })
        
        return { 
          success: false, 
          error: "This request has expired and cannot be accepted" 
        }
      }

      // Skip validation if force accepting
      if (!options?.forceAccept && !options?.skipTableAssignment) {
        // Validate table assignment if provided
        if (tableIds && tableIds.length > 0) {
          const validation = await this.validateAcceptance(booking, tableIds)
          
          if (!validation.valid) {
            // Record failed attempt
            await this.supabase
              .from("bookings")
              .update({
                acceptance_attempted_at: new Date().toISOString(),
                acceptance_failed_reason: validation.reason
              })
              .eq("id", bookingId)

            // Get alternatives if requested
            if (options?.suggestAlternatives) {
              const alternatives = await this.findAlternatives(booking)
              
              return {
                success: false,
                error: validation.reason || "Cannot accept with selected tables",
                alternatives,
                requiresConfirmation: true
              }
            }

            return {
              success: false,
              error: validation.reason || "Cannot accept booking with selected tables"
            }
          }
        } else if (!options?.skipTableAssignment) {
          // No tables selected - find available tables
          const availableTables = await this.tableService.getOptimalTableAssignment(
            booking.restaurant_id,
            new Date(booking.booking_time),
            booking.party_size,
            booking.turn_time_minutes || 120
          )

          if (!availableTables) {
            return {
              success: false,
              error: "No suitable tables available for this booking"
            }
          }

          tableIds = availableTables.tableIds
        }
      }

      // Proceed with acceptance
      const { data: updatedBooking, error: updateError } = await this.supabase
        .from("bookings")
        .update({
          status: "confirmed",
          updated_at: new Date().toISOString(),
          acceptance_attempted_at: new Date().toISOString(),
          acceptance_failed_reason: null
        })
        .eq("id", bookingId)
        .select()
        .single()

      if (updateError) {
        console.error("Update booking error:", updateError)
        throw new Error("Failed to update booking status")
      }

      if (!updatedBooking) {
        throw new Error("No booking found with this ID")
      }

      // Assign tables if provided
      if (tableIds && tableIds.length > 0 && !options?.skipTableAssignment) {
        // First, clear any existing table assignments for this booking
        const { error: deleteError } = await this.supabase
          .from("booking_tables")
          .delete()
          .eq("booking_id", bookingId)

        if (deleteError) {
          console.warn("Warning: Failed to clear existing table assignments:", deleteError)
        }

        // Then insert new table assignments
        const tableAssignments = tableIds.map(tableId => ({
          booking_id: bookingId,
          table_id: tableId
        }))

        const { error: tableError } = await this.supabase
          .from("booking_tables")
          .insert(tableAssignments)

        if (tableError) {
          console.error("Table assignment error:", tableError)
          
          // Rollback on table assignment failure
          await this.supabase
            .from("bookings")
            .update({ status: "pending" })
            .eq("id", bookingId)
            
          throw new Error(`Failed to assign tables: ${tableError.message || 'Unknown error'}`)
        }
      }

      // Log status change
      await this.supabase
        .from("booking_status_history")
        .insert({
          booking_id: bookingId,
          old_status: "pending",
          new_status: "confirmed",
          changed_by: userId,
          changed_at: new Date().toISOString(),
          metadata: { 
            action: "request_accepted",
            tables_assigned: tableIds || [],
            force_accepted: options?.forceAccept || false,
            skip_table_assignment: options?.skipTableAssignment || false
          }
        })

      return { 
        success: true, 
        booking: { ...updatedBooking, status: 'confirmed', tables: tableIds } 
      }

    } catch (error) {
      console.error("Accept request error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to accept booking request"
      }
    }
  }

  async declineRequest(
    bookingId: string, 
    userId: string, 
    reason?: string,
    suggestAlternatives?: boolean,
    decline_note?: string
  ): Promise<{
    success: boolean
    error?: string
    alternatives?: AcceptanceValidation['suggestedAlternatives']
  }> {
    try {
      const { data: booking, error: fetchError } = await this.supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .eq("status", "pending")
        .single()

      if (fetchError || !booking) {
        return { 
          success: false, 
          error: "Booking not found or already processed" 
        }
      }

      // Find alternatives before declining if requested
      let alternatives: AcceptanceValidation['suggestedAlternatives'] | undefined
      if (suggestAlternatives) {
        alternatives = await this.findAlternatives(booking)
      }

      // Update booking status
      const { error } = await this.supabase
        .from("bookings")
        .update({
          status: "declined_by_restaurant",
          updated_at: new Date().toISOString(),
          suggested_alternative_time: alternatives?.times?.[0]?.time.toISOString(),
          suggested_alternative_tables: alternatives?.tables,
          decline_note
        })
        .eq("id", bookingId)

      if (error) {
        throw new Error("Failed to decline request")
      }

      // Reverse offer redemption if applicable
      await reverseOfferRedemption(this.supabase, bookingId, booking.applied_offer_id)

      // Log status change
      await this.supabase
        .from("booking_status_history")
        .insert({
          booking_id: bookingId,
          old_status: "pending",
          new_status: "declined_by_restaurant",
          changed_by: userId,
          changed_at: new Date().toISOString(),
          reason: reason,
          metadata: { 
            action: "request_declined",
            alternatives_suggested: !!alternatives,
            alternative_times: alternatives?.times?.length || 0
          }
        })

      // Notify user via WhatsApp
      notifyUserDeclinedByRestaurant(bookingId).catch(err => {
        console.error('Failed to send WhatsApp notification:', err)
        // Don't fail the operation if notification fails
      })

      return { 
        success: true, 
        alternatives 
      }
    } catch (error) {
      console.error("Decline request error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to decline request"
      }
    }
  }

  private async validateAcceptance(
    booking: any, 
    tableIds: string[]
  ): Promise<AcceptanceValidation> {
    try {
      // Direct validation instead of missing RPC function
      // 1. Check that booking is pending
      if (booking.status !== 'pending') {
        return {
          valid: false,
          reason: `Booking is already ${booking.status}`
        }
      }

      // 2. Check that all tables belong to the restaurant and are active
      const { data: tables, error: tablesError } = await this.supabase
        .from('restaurant_tables')
        .select('id, is_active, restaurant_id')
        .in('id', tableIds)

      if (tablesError || !tables || tables.length !== tableIds.length) {
        return {
          valid: false,
          reason: "One or more tables not found"
        }
      }

      // Check all tables belong to the same restaurant as the booking
      const invalidTables = tables.filter(table => 
        table.restaurant_id !== booking.restaurant_id || !table.is_active
      )

      if (invalidTables.length > 0) {
        return {
          valid: false,
          reason: "One or more tables are not available or don't belong to this restaurant"
        }
      }

      // 3. Check for time conflicts with other confirmed bookings
      const bookingStart = new Date(booking.booking_time)
      const bookingEnd = new Date(bookingStart.getTime() + (booking.turn_time_minutes || 120) * 60000)

      const { data: conflicts } = await this.supabase
        .from('bookings')
        .select(`
          id,
          booking_time,
          turn_time_minutes,
          booking_tables!inner(table_id)
        `)
        .in('booking_tables.table_id', tableIds)
        .in('status', ['confirmed', 'seated', 'ordering', 'appetizers', 'main_course', 'dessert'])
        .neq('id', booking.id)

      if (conflicts && conflicts.length > 0) {
        // Check each conflict for actual time overlap
        const hasConflict = conflicts.some(conflict => {
          const conflictStart = new Date(conflict.booking_time)
          const conflictEnd = new Date(conflictStart.getTime() + (conflict.turn_time_minutes || 120) * 60000)
          
          return (bookingStart < conflictEnd && bookingEnd > conflictStart)
        })

        if (hasConflict) {
          return {
            valid: false,
            reason: "Time conflict with existing bookings on selected tables"
          }
        }
      }

      // Additional client-side validation
      const availability = await this.tableService.checkTableAvailability(
        booking.restaurant_id,
        tableIds,
        new Date(booking.booking_time),
        booking.turn_time_minutes || 120,
        booking.id
      )

      if (!availability.available) {
        return {
          valid: false,
          reason: "Selected tables have scheduling conflicts",
          conflicts: availability.conflicts
        }
      }

      // Validate total capacity
      const { data: capacityTables } = await this.supabase
        .from("restaurant_tables")
        .select("id, capacity, table_number")
        .in("id", tableIds)

      if (!capacityTables || capacityTables.length !== tableIds.length) {
        return {
          valid: false,
          reason: "One or more selected tables not found"
        }
      }

      const totalCapacity = capacityTables.reduce((sum, t) => sum + t.capacity, 0)
      
      if (totalCapacity < booking.party_size) {
        return {
          valid: false,
          reason: `Insufficient capacity: ${totalCapacity} seats available but ${booking.party_size} guests in party`
        }
      }

      return { valid: true }
    } catch (error) {
      console.error("Validation error:", error)
      return {
        valid: false,
        reason: "Validation failed due to system error"
      }
    }
  }

  private async findAlternatives(booking: any): Promise<AcceptanceValidation['suggestedAlternatives']> {
    const alternatives: AcceptanceValidation['suggestedAlternatives'] = {
      tables: [],
      times: []
    }

    try {
      // Find alternative tables for the same time
      const optimalTables = await this.tableService.getOptimalTableAssignment(
        booking.restaurant_id,
        new Date(booking.booking_time),
        booking.party_size,
        booking.turn_time_minutes || 120
      )

      if (optimalTables) {
        alternatives.tables = optimalTables.tableIds
      }

      // Find alternative time slots using database function
      const { data: altSlots, error } = await this.supabase
        .rpc('find_alternative_slots', {
          p_restaurant_id: booking.restaurant_id,
          p_original_time: booking.booking_time,
          p_party_size: booking.party_size,
          p_duration_minutes: booking.turn_time_minutes || 120
        })

      if (!error && altSlots) {
        alternatives.times = altSlots.map((slot: any) => ({
          time: new Date(slot.suggested_time),
          availableTables: slot.available_tables
        }))
      }

    } catch (error) {
      console.error("Error finding alternatives:", error)
    }

    return alternatives
  }


  /**
   * Determine booking type by evaluating tables in the preferred section.
   * Flow: get available tables in section → check rules + defaults → if ANY is instant, return 'instant'
   * Default is 'request' (tables default to request unless explicitly set to instant).
   */
  private async evaluateBookingType(
    restaurantId: string,
    bookingTime: Date,
    partySize: number,
    preferredSection?: string
  ): Promise<'instant' | 'request'> {
    try {
      // First try: tables that are an ideal fit (min <= partySize <= max)
      let tablesQuery = this.supabase
        .from('restaurant_tables')
        .select('id, default_booking_type, min_capacity, max_capacity, section_id')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .lte('min_capacity', partySize)
        .gte('max_capacity', partySize)

      if (preferredSection) {
        tablesQuery = tablesQuery.eq('section_id', preferredSection)
      }

      let { data: availableTables } = await tablesQuery

      // Fallback: if no exact fit, try tables where party is smaller than min but can still fit
      if (!availableTables || availableTables.length === 0) {
        let fallbackQuery = this.supabase
          .from('restaurant_tables')
          .select('id, default_booking_type, min_capacity, max_capacity, section_id')
          .eq('restaurant_id', restaurantId)
          .eq('is_active', true)
          .gt('min_capacity', partySize)
          .gte('max_capacity', partySize)
          .order('min_capacity', { ascending: true })

        if (preferredSection) {
          fallbackQuery = fallbackQuery.eq('section_id', preferredSection)
        }

        const { data: fallbackTables } = await fallbackQuery
        availableTables = fallbackTables
      }

      if (!availableTables || availableTables.length === 0) return 'request'

      // Fetch active rules for these tables
      const tableIds = availableTables.map(t => t.id)
      const { data: rules } = await this.supabase
        .from('table_booking_rules')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .in('table_id', tableIds)

      // Group rules by table
      const rulesMap = new Map<string, TableBookingRule[]>()
      if (rules) {
        for (const rule of rules) {
          const existing = rulesMap.get(rule.table_id) || []
          existing.push(rule as TableBookingRule)
          rulesMap.set(rule.table_id, existing)
        }
      }

      const context: BookingContext = {
        partySize,
        date: format(bookingTime, 'yyyy-MM-dd'),
        time: format(bookingTime, 'HH:mm'),
        dayOfWeek: bookingTime.getDay(),
      }

      // Evaluate: if ANY table in the section resolves to 'instant', booking is instant
      return evaluateSectionBookingType(
        availableTables.map(t => ({
          id: t.id,
          default_booking_type: (t.default_booking_type as 'instant' | 'request') || 'request'
        })),
        rulesMap,
        context
      )
    } catch (error) {
      console.error('Error evaluating booking type:', error)
      return 'request' // Default to request on error (safer)
    }
  }

  /**
   * Auto-assign the best available table for an instant booking.
   * Picks the smallest table that fits the party and has no time conflicts.
   * If no exact fit, falls back to the table with lowest min_capacity that can still accommodate the party.
   * Returns the assigned table ID, or null if no table is available.
   */
  private async autoAssignTable(
    restaurantId: string,
    bookingId: string,
    bookingTime: Date,
    partySize: number,
    turnTimeMinutes: number,
    sectionId: string
  ): Promise<string | null> {
    // First try: tables where min <= partySize <= max (ideal fit)
    let { data: sectionTables } = await this.supabase
      .from('restaurant_tables')
      .select('id, table_number, min_capacity, max_capacity')
      .eq('restaurant_id', restaurantId)
      .eq('section_id', sectionId)
      .eq('is_active', true)
      .lte('min_capacity', partySize)
      .gte('max_capacity', partySize)
      .order('max_capacity', { ascending: true }) // Prefer smallest fitting table

    // Fallback: if no exact fit, find tables where partySize < min but partySize <= max
    // (party is smaller than recommended but table can still fit them)
    // Pick the one with lowest min_capacity to minimize waste
    if (!sectionTables || sectionTables.length === 0) {
      const { data: fallbackTables } = await this.supabase
        .from('restaurant_tables')
        .select('id, table_number, min_capacity, max_capacity')
        .eq('restaurant_id', restaurantId)
        .eq('section_id', sectionId)
        .eq('is_active', true)
        .gt('min_capacity', partySize) // Party smaller than min
        .gte('max_capacity', partySize) // But can still fit
        .order('min_capacity', { ascending: true }) // Prefer lowest min (closest to party size)
      
      sectionTables = fallbackTables
    }

    if (!sectionTables || sectionTables.length === 0) return null

    // Check time conflicts for each table
    const bookingStart = bookingTime.getTime()
    const bookingEnd = addHours(bookingTime, turnTimeMinutes / 60).getTime()

    // Get existing bookings that overlap with this time window
    const { data: existingBookings } = await this.supabase
      .from('booking_tables')
      .select('table_id, booking:bookings!inner(id, booking_time, turn_time_minutes, status)')
      .in('table_id', sectionTables.map(t => t.id))

    // Build a set of occupied table IDs
    const occupiedTableIds = new Set<string>()
    if (existingBookings) {
      for (const bt of existingBookings) {
        const b = bt.booking as any
        if (!b || ['cancelled_by_user', 'declined_by_restaurant', 'auto_declined', 'completed', 'no_show'].includes(b.status)) continue
        if (b.id === bookingId) continue

        const bStart = new Date(b.booking_time).getTime()
        const bEnd = bStart + (b.turn_time_minutes || 90) * 60_000
        // Check time overlap
        if (bookingStart < bEnd && bookingEnd > bStart) {
          occupiedTableIds.add(bt.table_id)
        }
      }
    }

    // Pick the first (smallest) available table
    const bestTable = sectionTables.find(t => !occupiedTableIds.has(t.id))
    if (!bestTable) return null

    // Assign the table
    const { error } = await this.supabase
      .from('booking_tables')
      .insert({ booking_id: bookingId, table_id: bestTable.id })

    if (error) {
      console.error('Failed to auto-assign table:', error)
      return null
    }

    return bestTable.id
  }

  private async generateUniqueConfirmationCode(restaurantId: string): Promise<string> {
    let attempts = 0
    const maxAttempts = 10
    
    while (attempts < maxAttempts) {
      const code = `${restaurantId.slice(0, 4).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      
      const { data: existing } = await this.supabase
        .from("bookings")
        .select("id")
        .eq("confirmation_code", code)
        .single()
      
      if (!existing) {
        return code
      }
      
      attempts++
    }
    
    // Fallback with timestamp
    return `${restaurantId.slice(0, 4).toUpperCase()}${Date.now().toString(36).toUpperCase()}`
  }

  private async updateBookingStatus(
    bookingId: string,
    status: string,
    userId: string,
    metadata?: any
  ): Promise<void> {
    // Get booking data for offer reversal if needed AND to get old status
    const { data: booking } = await this.supabase
      .from("bookings")
      .select('status, applied_offer_id')
      .eq("id", bookingId)
      .single()
    
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`)
    }
    
    const oldStatus = booking.status
    const appliedOfferId = booking.applied_offer_id

    await this.supabase
      .from("bookings")
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq("id", bookingId)

    // Reverse offer redemption for cancellation/decline statuses (except user cancellations)
    if (['auto_declined', 'cancelled_by_restaurant', 'declined_by_restaurant'].includes(status)) {
      await reverseOfferRedemption(this.supabase, bookingId, appliedOfferId)
    }

    // Create status history entry with both old and new status
    await this.supabase
      .from("booking_status_history")
      .insert({
        booking_id: bookingId,
        old_status: oldStatus,
        new_status: status,
        changed_by: userId,
        changed_at: new Date().toISOString(),
        reason: `Status changed from ${oldStatus} to ${status}`,
        metadata
      })
  }

  async getTimeUntilExpiry(booking: any): Promise<{ 
    hours: number
    minutes: number
    expired: boolean
    percentage: number 
  }> {
    if (!booking.request_expires_at) {
      return { hours: 0, minutes: 0, expired: false, percentage: 100 }
    }

    const now = new Date()
    const expiresAt = new Date(booking.request_expires_at)
    const createdAt = new Date(booking.created_at)
    
    const totalMs = expiresAt.getTime() - createdAt.getTime()
    const remainingMs = expiresAt.getTime() - now.getTime()

    if (remainingMs <= 0) {
      return { hours: 0, minutes: 0, expired: true, percentage: 0 }
    }

    const hours = Math.floor(remainingMs / (1000 * 60 * 60))
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60))
    const percentage = Math.max(0, Math.min(100, Math.round((remainingMs / totalMs) * 100)))

    return { hours, minutes, expired: false, percentage }
  }

  async autoDeclineExpiredRequests(restaurantId: string, userId: string): Promise<{
    declinedCount: number
    declinedBookings: any[]
    errors: any[]
  }> {
    const result = {
      declinedCount: 0,
      declinedBookings: [] as any[],
      errors: [] as any[]
    }

    try {
      // Find expired pending requests for this restaurant
      const { data: expiredRequests, error: fetchError } = await this.supabase
        .from("bookings")
        .select(`
          *,
          user:profiles!bookings_user_id_fkey(*),
          restaurant:restaurants(*)
        `)
        .eq("restaurant_id", restaurantId)
        .eq("status", "pending")
        .not("request_expires_at", "is", null)
        .lt("request_expires_at", new Date().toISOString())

      if (fetchError) {
        console.error("Error fetching expired requests:", fetchError)
        result.errors.push({ type: "fetch", error: fetchError })
        return result
      }

      if (!expiredRequests || expiredRequests.length === 0) {
        return result // No expired requests found
      }

      // Process each expired request
      for (const booking of expiredRequests) {
        try {
          // Update booking status to auto_declined
          const { error: updateError } = await this.supabase
            .from("bookings")
            .update({
              status: "auto_declined",
              updated_at: new Date().toISOString(),
              decline_reason: "Request expired automatically"
            })
            .eq("id", booking.id)

          if (updateError) {
            console.error(`Failed to auto-decline booking ${booking.id}:`, updateError)
            result.errors.push({ bookingId: booking.id, error: updateError })
            continue
          }

          // Reverse offer redemption if applicable
          await reverseOfferRedemption(this.supabase, booking.id, booking.applied_offer_id)

          // Log status change in history
          await this.supabase
            .from("booking_status_history")
            .insert({
              booking_id: booking.id,
              old_status: "pending",
              new_status: "auto_declined",
              changed_by: userId || "system",
              changed_at: new Date().toISOString(),
              reason: "Request expired automatically",
              metadata: {
                action: "auto_decline_expired",
                expired_at: booking.request_expires_at,
                auto_processed: true
              }
            })

          result.declinedCount++
          result.declinedBookings.push(booking)
          
          console.log(`Auto-declined expired booking request: ${booking.id}`)
        } catch (error) {
          console.error(`Error processing expired booking ${booking.id}:`, error)
          result.errors.push({ bookingId: booking.id, error })
        }
      }

      return result
    } catch (error) {
      console.error("Error in autoDeclineExpiredRequests:", error)
      result.errors.push({ type: "general", error })
      return result
    }
  }

  async findExpiredRequests(restaurantId: string): Promise<any[]> {
    try {
      const { data: expiredRequests, error } = await this.supabase
        .from("bookings")
        .select(`
          id,
          guest_name,
          booking_time,
          party_size,
          request_expires_at,
          created_at,
          user:profiles!bookings_user_id_fkey(full_name)
        `)
        .eq("restaurant_id", restaurantId)
        .eq("status", "pending")
        .not("request_expires_at", "is", null)
        .lt("request_expires_at", new Date().toISOString())
        .order("request_expires_at", { ascending: true })

      if (error) {
        console.error("Error finding expired requests:", error)
        return []
      }

      return expiredRequests || []
    } catch (error) {
      console.error("Error in findExpiredRequests:", error)
      return []
    }
  }

  /**
   * Create waitlist entry instead of booking for basic tier restaurants
   * during scheduled waitlist times
   */
  private async createWaitlistEntry(data: {
    restaurantId: string
    userId: string
    bookingTime: Date
    partySize: number
    specialRequests?: string
    occasion?: string
    guestName?: string
    guestEmail?: string
    guestPhone?: string
  }) {
    try {
      // Create waitlist entry
      const { data: waitlistEntry, error } = await this.supabase
        .from("waitlist")
        .insert({
          restaurant_id: data.restaurantId,
          user_id: data.userId,
          guest_name: data.guestName,
          guest_email: data.guestEmail,
          guest_phone: data.guestPhone,
          desired_date: format(data.bookingTime, 'yyyy-MM-dd'),
          desired_time_range: `${format(data.bookingTime, 'HH:mm')}-${format(addHours(data.bookingTime, 2), 'HH:mm')}`,
          party_size: data.partySize,
          table_type: 'any',
          special_requests: data.specialRequests,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error("Waitlist entry creation error:", error)
        throw new Error("Failed to create waitlist entry")
      }

      return {
        waitlistEntry,
        isWaitlist: true,
        message: "Your request has been added to the waitlist. The restaurant will contact you when a table becomes available."
      }
    } catch (error) {
      console.error("Create waitlist entry error:", error)
      throw error
    }
  }
}