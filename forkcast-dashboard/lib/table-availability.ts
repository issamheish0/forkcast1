// lib/table-availability.ts
import { createClient } from "@/lib/supabase/client"
import { addMinutes, format, parse } from "date-fns"
import { RestaurantAvailability } from "./restaurant-availability"

export interface TableAvailability {
  tableId: string
  tableNumber: string
  capacity: number
  minCapacity: number
  maxCapacity: number
  isAvailable: boolean
  conflictingBookings?: {
    id: string
    time: string
    partySize: number
  }[]
}

export interface TableCombination {
  tables: string[]
  totalCapacity: number
  totalMinCapacity: number
  isValid: boolean
}

export class TableAvailabilityService {
  private supabase = createClient()
  private restaurantAvailability = new RestaurantAvailability()

  /**
   * Check if tables are available for a specific time slot
   * Enhanced to check restaurant operating hours
   */
  async checkTableAvailability(
    restaurantId: string,
    tableIds: string[],
    bookingTime: Date,
    turnTimeMinutes: number = 120,
    excludeBookingId?: string
  ): Promise<{
    available: boolean
    conflicts: any[]
    tables: TableAvailability[]
    restaurantOpen: boolean
    restaurantMessage?: string
  }> {
    // First check if restaurant is open at this time
    const restaurantStatus = await this.restaurantAvailability.isRestaurantOpen(
      restaurantId,
      bookingTime,
      format(bookingTime, 'HH:mm')
    )

    if (!restaurantStatus.isOpen) {
      return {
        available: false,
        conflicts: [],
        tables: [],
        restaurantOpen: false,
        restaurantMessage: restaurantStatus.reason || 'Restaurant is closed at this time'
      }
    }

    // Check if the booking end time is within operating hours
    const endTime = addMinutes(bookingTime, turnTimeMinutes)
    const endTimeStr = format(endTime, 'HH:mm')
    const endTimeStatus = await this.restaurantAvailability.isRestaurantOpen(
      restaurantId,
      bookingTime, // Same date
      endTimeStr
    )

    if (!endTimeStatus.isOpen) {
      return {
        available: false,
        conflicts: [],
        tables: [],
        restaurantOpen: false,
        restaurantMessage: `Restaurant closes at ${restaurantStatus.hours?.close}. Please select an earlier time.`
      }
    }

    // Get table details
    const { data: tables, error: tablesError } = await this.supabase
      .from("restaurant_tables")
      .select("*")
      .in("id", tableIds)
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)

    if (tablesError || !tables) {
      throw new Error("Failed to fetch table details")
    }

    // Check for booking conflicts using the existing RPC function
    const { data: conflictingBookingId, error: conflictError } = await this.supabase
      .rpc("check_booking_overlap", {
        p_table_ids: tableIds,
        p_start_time: bookingTime.toISOString(),
        p_end_time: endTime.toISOString(),
        p_exclude_booking_id: excludeBookingId || null,
        p_exclude_user_id: null
      })

    if (conflictError) {
      console.error("Error checking conflicts:", conflictError)
      throw conflictError
    }

    // Get detailed conflict information if there are conflicts
    let conflicts: any[] = []
    const hasConflict = conflictingBookingId !== null

    if (hasConflict) {
      // Get all conflicting bookings (not just the first one)
      const { data: conflictingBookings } = await this.supabase
        .from("bookings")
        .select(`
          *,
          profiles!bookings_user_id_fkey(full_name),
          booking_tables!inner(table_id)
        `)
        .in("booking_tables.table_id", tableIds)
        .in("status", ["confirmed", "pending"])
        .neq("id", excludeBookingId || "00000000-0000-0000-0000-000000000000")

      if (conflictingBookings) {
        // Filter to only actual overlapping bookings
        conflicts = conflictingBookings
          .filter(booking => {
            const bookingStart = new Date(booking.booking_time)
            const bookingEnd = addMinutes(bookingStart, booking.turn_time_minutes || 120)
            
            // Check for time overlap
            return (bookingTime < bookingEnd && endTime > bookingStart)
          })
          .map(booking => ({
            id: booking.id,
            booking_time: booking.booking_time,
            turn_time_minutes: booking.turn_time_minutes,
            party_size: booking.party_size,
            status: booking.status,
            guestName: booking.profiles?.full_name || booking.guest_name || "Guest",
            tableIds: booking.booking_tables?.map((bt: any) => bt.table_id) || []
          }))
      }
    }

    // Build availability info for each table
    const tableAvailability: TableAvailability[] = tables.map(table => {
      const tableConflicts = conflicts.filter(conflict => 
        conflict.tableIds.includes(table.id)
      )

      return {
        tableId: table.id,
        tableNumber: table.table_number,
        capacity: table.capacity,
        minCapacity: table.min_capacity || 1,
        maxCapacity: table.max_capacity || table.capacity,
        isAvailable: !tableConflicts.length,
        conflictingBookings: tableConflicts.map(conflict => ({
          id: conflict.id,
          time: format(new Date(conflict.booking_time), "h:mm a"),
          partySize: conflict.party_size
        }))
      }
    })

    return {
      available: !hasConflict,
      conflicts,
      tables: tableAvailability,
      restaurantOpen: true
    }
  }

  /**
   * Get available tables for a time slot
   * Enhanced to respect operating hours
   */
  async getAvailableTablesForSlot(
    restaurantId: string,
    bookingTime: Date,
    partySize: number,
    turnTimeMinutes: number = 120
  ): Promise<{
    singleTables: any[]
    combinations: TableCombination[]
    restaurantOpen: boolean
    restaurantMessage?: string
  }> {
    // Check restaurant availability first
    const restaurantStatus = await this.restaurantAvailability.isRestaurantOpen(
      restaurantId,
      bookingTime,
      format(bookingTime, 'HH:mm')
    )

    if (!restaurantStatus.isOpen) {
      return {
        singleTables: [],
        combinations: [],
        restaurantOpen: false,
        restaurantMessage: restaurantStatus.reason
      }
    }

    // Check if booking would end within operating hours
    const endTime = addMinutes(bookingTime, turnTimeMinutes)
    const endTimeStr = format(endTime, 'HH:mm')
    
    if (restaurantStatus.hours) {
      const [closeHour, closeMin] = restaurantStatus.hours.close.split(':').map(Number)
      const [endHour, endMin] = endTimeStr.split(':').map(Number)
      
      const closeMinutes = closeHour * 60 + closeMin
      const endMinutes = endHour * 60 + endMin
      
      // Handle overnight hours (restaurant closes after midnight, e.g. 2:00 AM)
      if (closeHour < 6 && endMinutes > closeMinutes) {
        // Overnight restaurant: only reject if end time exceeds the post-midnight close
        // e.g. close=2:00AM (120min), end=2:30AM (150min) → reject
        return {
          singleTables: [],
          combinations: [],
          restaurantOpen: false,
          restaurantMessage: `Restaurant closes at ${restaurantStatus.hours.close}. This booking would end at ${endTimeStr}.`
        }
      } else if (closeHour >= 6 && endMinutes > closeMinutes) {
        return {
          singleTables: [],
          combinations: [],
          restaurantOpen: false,
          restaurantMessage: `Restaurant closes at ${restaurantStatus.hours.close}. This booking would end at ${endTimeStr}.`
        }
      }
    }

    // Get all active tables for the restaurant
    const { data: allTables, error: tablesError } = await this.supabase
      .from("restaurant_tables")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("priority_score", { ascending: false })
      .order("capacity", { ascending: true })

    if (tablesError || !allTables) {
      throw new Error("Failed to fetch tables")
    }

    // Check each table for availability
    const availableTables: any[] = []
    const availableForCombination: any[] = []

    for (const table of allTables) {
      const { data: conflictId } = await this.supabase
        .rpc("check_booking_overlap", {
          p_table_ids: [table.id],
          p_start_time: bookingTime.toISOString(),
          p_end_time: endTime.toISOString(),
          p_exclude_booking_id: null,
          p_exclude_user_id: null
        })

      if (conflictId === null) {
        // Table is available - check if it fits the party
        const minCap = table.min_capacity || 1
        const isExactFit = table.capacity >= partySize && minCap <= partySize
        const canAccommodate = table.capacity >= partySize // Can physically fit, even if party < min
        
        if (isExactFit) {
          availableTables.push({ ...table, _isExactFit: true })
        } else if (canAccommodate) {
          availableTables.push({ ...table, _isExactFit: false })
        }
        if (table.is_combinable) {
          availableForCombination.push(table)
        }
      }
    }

    // Sort: prefer exact fits first, then by min_capacity (lowest first for fallback)
    availableTables.sort((a, b) => {
      if (a._isExactFit && !b._isExactFit) return -1
      if (!a._isExactFit && b._isExactFit) return 1
      // For non-exact fits, prefer lowest min_capacity
      if (!a._isExactFit && !b._isExactFit) {
        return (a.min_capacity || 1) - (b.min_capacity || 1)
      }
      return 0
    })

    // Generate valid combinations
    const combinations = this.generateTableCombinations(
      availableForCombination,
      partySize,
      2, // Max 2 tables for now
    )

    return {
      singleTables: availableTables,
      combinations,
      restaurantOpen: true
    }
  }

  /**
   * Generate valid table combinations
   */
  private generateTableCombinations(
    tables: any[],
    requiredCapacity: number,
    maxTables: number = 2
  ): TableCombination[] {
    const combinations: TableCombination[] = []

    // Generate combinations of 2 tables
    for (let i = 0; i < tables.length; i++) {
      for (let j = i + 1; j < tables.length; j++) {
        const table1 = tables[i]
        const table2 = tables[j]

        // Check if tables can be combined
        const canCombine = 
          table1.is_combinable && 
          table2.is_combinable &&
          (
            table1.combinable_with.length === 0 ||
            table1.combinable_with.includes(table2.id)
          ) &&
          (
            table2.combinable_with.length === 0 ||
            table2.combinable_with.includes(table1.id)
          )

        if (canCombine) {
          const totalCapacity = table1.capacity + table2.capacity
          const totalMinCapacity = (table1.min_capacity || 1) + (table2.min_capacity || 1)

          if (totalCapacity >= requiredCapacity && totalMinCapacity <= requiredCapacity) {
            combinations.push({
              tables: [table1.id, table2.id],
              totalCapacity,
              totalMinCapacity,
              isValid: true
            })
          }
        }
      }
    }

    // Sort combinations by total capacity (prefer smaller combinations)
    combinations.sort((a, b) => a.totalCapacity - b.totalCapacity)

    return combinations
  }

  /**
   * Validate if a party size fits within table capacity constraints
   */
  validateCapacity(
    tables: any[],
    partySize: number
  ): {
    valid: boolean
    totalCapacity: number
    totalMinCapacity: number
    message?: string
  } {
    const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0)
    const totalMinCapacity = tables.reduce((sum, t) => sum + (t.min_capacity || 1), 0)

    if (partySize > totalCapacity) {
      return {
        valid: false,
        totalCapacity,
        totalMinCapacity,
        message: `Selected tables can only accommodate up to ${totalCapacity} guests`
      }
    }

    if (partySize < totalMinCapacity) {
      return {
        valid: false,
        totalCapacity,
        totalMinCapacity,
        message: `Selected tables require a minimum of ${totalMinCapacity} guests`
      }
    }

    return {
      valid: true,
      totalCapacity,
      totalMinCapacity
    }
  }

  /**
   * Get optimal table assignment for a party
   * Enhanced with operating hours check
   */
  async getOptimalTableAssignment(
    restaurantId: string,
    bookingTime: Date,
    partySize: number,
    turnTimeMinutes: number = 120
  ): Promise<{
    tableIds: string[]
    requiresCombination: boolean
    totalCapacity: number
    restaurantOpen: boolean
    restaurantMessage?: string
  } | null> {
    const { singleTables, combinations, restaurantOpen, restaurantMessage } = 
      await this.getAvailableTablesForSlot(
        restaurantId,
        bookingTime,
        partySize,
        turnTimeMinutes
      )

    if (!restaurantOpen) {
      return {
        tableIds: [],
        requiresCombination: false,
        totalCapacity: 0,
        restaurantOpen: false,
        restaurantMessage
      }
    }

    // First, try to find a single table (exact fit: min <= partySize <= max)
    let optimalSingleTable = singleTables
      .filter(t => t.capacity >= partySize && (t.min_capacity || 1) <= partySize)
      .sort((a, b) => {
        // Prefer tables closer to party size
        const aDiff = Math.abs(a.capacity - partySize)
        const bDiff = Math.abs(b.capacity - partySize)
        if (aDiff !== bDiff) return aDiff - bDiff
        // Then by priority score
        return (b.priority_score || 0) - (a.priority_score || 0)
      })[0]

    // Fallback: if no exact fit, find tables where party < min but can still fit
    // Pick the one with lowest min_capacity (least waste)
    if (!optimalSingleTable) {
      optimalSingleTable = singleTables
        .filter(t => t.capacity >= partySize && (t.min_capacity || 1) > partySize)
        .sort((a, b) => {
          // Prefer lowest min_capacity (closest to party size)
          const aMin = a.min_capacity || 1
          const bMin = b.min_capacity || 1
          if (aMin !== bMin) return aMin - bMin
          // Then by priority score
          return (b.priority_score || 0) - (a.priority_score || 0)
        })[0]
    }

    if (optimalSingleTable) {
      return {
        tableIds: [optimalSingleTable.id],
        requiresCombination: false,
        totalCapacity: optimalSingleTable.capacity,
        restaurantOpen: true
      }
    }

    // If no single table, try combinations
    const optimalCombination = combinations[0] // Already sorted by capacity

    if (optimalCombination) {
      return {
        tableIds: optimalCombination.tables,
        requiresCombination: true,
        totalCapacity: optimalCombination.totalCapacity,
        restaurantOpen: true
      }
    }

    return null
  }

  /**
   * Quick check if specific tables are available (using the RPC function)
   * Enhanced to check operating hours
   */
  async quickAvailabilityCheck(
    restaurantId: string,
    tableIds: string[],
    bookingTime: Date,
    turnTimeMinutes: number = 120,
    excludeBookingId?: string
  ): Promise<boolean> {
    // Check restaurant hours first
    const restaurantStatus = await this.restaurantAvailability.isRestaurantOpen(
      restaurantId,
      bookingTime,
      format(bookingTime, 'HH:mm')
    )

    if (!restaurantStatus.isOpen) {
      return false
    }

    // Check if booking ends within operating hours
    const endTime = addMinutes(bookingTime, turnTimeMinutes)
    const endTimeStatus = await this.restaurantAvailability.isRestaurantOpen(
      restaurantId,
      bookingTime,
      format(endTime, 'HH:mm')
    )

    if (!endTimeStatus.isOpen) {
      return false
    }
    
    const { data: conflictingBookingId, error } = await this.supabase
      .rpc("check_booking_overlap", {
        p_table_ids: tableIds,
        p_start_time: bookingTime.toISOString(),
        p_end_time: endTime.toISOString(),
        p_exclude_booking_id: excludeBookingId || null,
        p_exclude_user_id: null
      })

    if (error) {
      console.error("Error checking availability:", error)
      return false
    }

    // If conflictingBookingId is null, tables are available
    return conflictingBookingId === null
  }

  /**
   * Get available time slots for specific tables
   * Respects restaurant operating hours
   */
  async getTableTimeSlots(
    restaurantId: string,
    tableIds: string[],
    date: Date,
    slotDuration: number = 30
  ): Promise<string[]> {
    // Get restaurant hours for the date
    const availableSlots = await this.restaurantAvailability.getAvailableTimeSlots(
      restaurantId,
      date,
      1, // Min party size
      slotDuration
    )

    // Filter slots based on table availability
    const validSlots: string[] = []

    for (const slot of availableSlots) {
      const [hour, minute] = slot.split(':').map(Number)
      const slotTime = new Date(date)
      slotTime.setHours(hour, minute, 0, 0)

      const isAvailable = await this.quickAvailabilityCheck(
        restaurantId,
        tableIds,
        slotTime
      )

      if (isAvailable) {
        validSlots.push(slot)
      }
    }

    return validSlots
  }
}