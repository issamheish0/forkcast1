// lib/table-status.ts
import { createClient } from "@/lib/supabase/client"
import { addMinutes, differenceInMinutes, format } from "date-fns"
import { RestaurantAvailability } from "./restaurant-availability"
import { notifyUserDeclinedByRestaurant } from "./services/notify-booking-declined"

export type DiningStatus = 
  | 'pending'
  | 'confirmed'
  | 'arrived'
  | 'seated'
  | 'ordered'
  | 'appetizers'
  | 'main_course'
  | 'dessert'
  | 'payment'
  | 'completed'
  | 'no_show'
  | 'cancelled_by_user'
  | 'cancelled_by_restaurant'
  | 'declined_by_restaurant'

export interface TableStatus {
  tableId: string
  tableNumber: string
  currentBooking?: {
    id: string
    status: DiningStatus
    mealProgress?: string
    seatedAt?: Date
    progress: number // 0-100
    estimatedCompletion: Date
  }
  nextBooking?: {
    id: string
    time: Date
    partySize: number
    guestName: string
  }
  isOccupied: boolean
  canAcceptWalkIn: boolean
  minutesUntilClose?: number
}

export interface StatusTransition {
  from: DiningStatus
  to: DiningStatus
  label: string
  icon?: string
  color?: string
  requiresConfirmation?: boolean
}

export class TableStatusService {
  private supabase = createClient()
  private restaurantAvailability = new RestaurantAvailability()

  // Define valid status transitions
  static STATUS_TRANSITIONS: any = [
    { from: 'pending', to: 'confirmed', label: 'Confirm', icon: '✅', color: 'green' },
    { from: 'confirmed', to: 'arrived', label: 'Guest Arrived', icon: '👋', color: 'blue' },
    { from: 'arrived', to: 'seated', label: 'Seat Guest', icon: '🪑', color: 'indigo' },
    { from: 'seated', to: 'ordered', label: 'Order Taken', icon: '📝', color: 'purple' },
    { from: 'ordered', to: 'appetizers', label: 'Appetizers Served', icon: '🥗', color: 'green' },
    { from: 'appetizers', to: 'main_course', label: 'Main Course Served', icon: '🍽️', color: 'blue' },
    { from: 'main_course', to: 'dessert', label: 'Dessert Served', icon: '🍰', color: 'pink' },
    { from: 'main_course', to: 'payment', label: 'Request Bill', icon: '💳', color: 'yellow' },
    { from: 'dessert', to: 'payment', label: 'Request Bill', icon: '💳', color: 'yellow' },
    { from: 'payment', to: 'completed', label: 'Complete', icon: '✅', color: 'green' },
    { from: 'confirmed', to: 'no_show', label: 'Mark No Show', icon: '❌', color: 'red', requiresConfirmation: true },
    { from: 'arrived', to: 'cancelled_by_restaurant', label: 'Cancel', icon: '🚫', color: 'red', requiresConfirmation: true }
  ]

  // Get dining progress percentage
  static getDiningProgress(status: DiningStatus): number {
    const progressMap:any= {
      'pending': 0,
      'confirmed': 5,
      'arrived': 10,
      'seated': 20,
      'ordered': 30,
      'appetizers': 50,
      'main_course': 70,
      'dessert': 85,
      'payment': 95,
      'completed': 100,
      'no_show': 100,
      'cancelled_by_user': 100,
      'cancelled_by_restaurant': 100,
      'declined_by_restaurant': 100
    }
    return progressMap[status] || 0
  }

  // Static map to track in-flight status updates to prevent race conditions
  private static statusUpdateLocks = new Map<string, Promise<any>>()

  // Update booking status with history tracking
  async updateBookingStatus(
    bookingId: string,
    newStatus: DiningStatus,
    userId: string,
    metadata?: Record<string, any>
  ) {
    // Check if there's already an update in progress for this booking
    if (TableStatusService.statusUpdateLocks.has(bookingId)) {
      console.log(`Status update already in progress for booking ${bookingId}, waiting...`)
      await TableStatusService.statusUpdateLocks.get(bookingId)
      
      // After waiting, check if the status is now what we wanted
      const { data: currentBooking } = await this.supabase
        .from('bookings')
        .select('status')
        .eq('id', bookingId)
        .single()
      
      if (currentBooking?.status === newStatus) {
        console.log(`Status already updated to ${newStatus} by concurrent call`)
        return { success: true, noChange: true }
      }
    }

    // Create a promise for this update operation
    const updatePromise = this.performStatusUpdate(bookingId, newStatus, userId, metadata)
    
    // Store the promise to prevent concurrent updates
    TableStatusService.statusUpdateLocks.set(bookingId, updatePromise)
    
    try {
      const result = await updatePromise
      return result
    } finally {
      // Always clean up the lock
      TableStatusService.statusUpdateLocks.delete(bookingId)
    }
  }

  // Separated method to perform the actual status update
  private async performStatusUpdate(
    bookingId: string,
    newStatus: DiningStatus,
    userId: string,
    metadata?: Record<string, any>
  ) {
    // Use a transaction-like approach: read and update atomically
    const { data: booking, error: fetchError } = await this.supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (fetchError) throw fetchError

    // Check if status is actually changing
    if (booking.status === newStatus) {
      console.log(`Status is already ${newStatus}, skipping update`)
      return { success: true, noChange: true }
    }

    const oldStatus = booking.status

    // Update booking with conditional update to prevent race conditions
    const updates: any = { 
      status: newStatus,
      updated_at: new Date().toISOString()
    }

    // Add specific timestamps based on status
    if (newStatus === 'arrived') {
      updates.checked_in_at = new Date().toISOString()
    }

    if (metadata?.tableId && newStatus === 'seated') {
      // Store seated time in metadata
      metadata.seated_at = new Date().toISOString()
    }

    // Update only if the status hasn't changed since we read it
    const { data: updateResult, error: updateError } = await this.supabase
      .from('bookings')
      .update(updates)
      .eq('id', bookingId)
      .eq('status', oldStatus) // This ensures atomic update
      .select('status')

    if (updateError) throw updateError

    // If no rows were updated, it means the status changed between read and write
    if (!updateResult || updateResult.length === 0) {
      console.log(`Concurrent update detected for booking ${bookingId}, status changed during update`)
      return { success: false, noChange: true, reason: 'concurrent_update' }
    }

    // Only log status change in history if we successfully updated
    const { error: historyError } = await this.supabase
      .from('booking_status_history')
      .insert({
        booking_id: bookingId,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: userId,
        reason: `Status changed from ${oldStatus} to ${newStatus}`,
        metadata: metadata || {}
      })

    if (historyError) {
      console.error('Failed to insert status history:', historyError)
      // Don't throw here as the booking was updated successfully
    }

    // Handle side effects (stats and notifications)
    try {
      // 1. Handle No-Show Stats
      if (newStatus === 'no_show' && booking.user_id && booking.restaurant_id) {
        const { data: customerData } = await this.supabase
          .from('restaurant_customers')
          .select('id, no_show_count')
          .eq('user_id', booking.user_id)
          .eq('restaurant_id', booking.restaurant_id)
          .single()

        if (customerData) {
          await this.supabase
            .from('restaurant_customers')
            .update({
              no_show_count: (customerData.no_show_count || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', customerData.id)
        }
      }

      // 2. Notify user via WhatsApp if booking was declined
      if (newStatus === 'declined_by_restaurant') {
        notifyUserDeclinedByRestaurant(bookingId).catch(err => {
          console.error('Failed to send WhatsApp notification:', err)
          // Don't fail the operation if notification fails
        })
      }
    } catch (sideEffectError) {
      console.error('Error handling status update side effects:', sideEffectError)
      // Don't fail the operation if side effects fail
    }

    return { success: true }
  }

  // Check in a booking and assign table
  async checkInBooking(
    bookingId: string,
    tableIds: string[],
    userId: string
  ) {
    // Start transaction-like operation
    try {
      // Update status to arrived
      await this.updateBookingStatus(bookingId, 'arrived', userId)

      // Assign tables if not already assigned
      const { data: existingTables } = await this.supabase
        .from('booking_tables')
        .select('table_id')
        .eq('booking_id', bookingId)

      if (!existingTables || existingTables.length === 0) {
        const tableAssignments = tableIds.map(tableId => ({
          booking_id: bookingId,
          table_id: tableId
        }))

        const { error: tableError } = await this.supabase
          .from('booking_tables')
          .insert(tableAssignments)

        if (tableError) throw tableError
      }

      // Progress to seated immediately after check-in
      await this.updateBookingStatus(bookingId, 'seated', userId, { 
        table_ids: tableIds 
      })

      return { success: true }
    } catch (error) {
      console.error('Check-in error:', error)
      throw error
    }
  }

  // Switch tables for a booking
  async switchTables(
    bookingId: string,
    newTableIds: string[],
    userId: string,
    reason?: string
  ) {
    try {
      // Delete existing table assignments
      await this.supabase
        .from('booking_tables')
        .delete()
        .eq('booking_id', bookingId)

      // Add new table assignments
      const tableAssignments = newTableIds.map(tableId => ({
        booking_id: bookingId,
        table_id: tableId
      }))

      const { error } = await this.supabase
        .from('booking_tables')
        .insert(tableAssignments)

      if (error) throw error

      // Log the change
      await this.supabase
        .from('booking_status_history')
        .insert({
          booking_id: bookingId,
          old_status: 'table_switch',
          new_status: 'table_switch',
          changed_by: userId,
          reason,
          metadata: { new_table_ids: newTableIds }
        })

      return { success: true }
    } catch (error) {
      console.error('Table switch error:', error)
      throw error
    }
  }

  // Get table status with current and next bookings
  // Enhanced to consider restaurant hours
  async getTableStatuses(
    restaurantId: string,
    currentTime: Date
  ): Promise<Map<string, TableStatus>> {
    // Check if restaurant is currently open
    const restaurantStatus = await this.restaurantAvailability.isRestaurantOpen(
      restaurantId,
      currentTime,
      format(currentTime, 'HH:mm')
    )

    // Calculate minutes until close if open
    let minutesUntilClose: number | undefined
    if (restaurantStatus.isOpen && restaurantStatus.hours) {
      const [closeHour, closeMin] = restaurantStatus.hours.close.split(':').map(Number)
      const closeTime = new Date(currentTime)
      closeTime.setHours(closeHour, closeMin, 0, 0)
      
      // Handle overnight hours
      if (closeTime < currentTime) {
        closeTime.setDate(closeTime.getDate() + 1)
      }
      
      minutesUntilClose = differenceInMinutes(closeTime, currentTime)
    }

    // Fetch all tables
    const { data: tables } = await this.supabase
      .from('restaurant_tables')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)

    if (!tables) return new Map()

    // Fetch today's bookings with table assignments
    const startOfToday = new Date(currentTime)
    startOfToday.setHours(0, 0, 0, 0)
    const endOfToday = new Date(currentTime)
    endOfToday.setHours(23, 59, 59, 999)

    const { data: bookings } = await this.supabase
      .from('bookings')
      .select(`
        *,
        profiles!bookings_user_id_fkey(full_name),
        booking_tables(table_id),
        booking_status_history(
          new_status,
          changed_at,
          metadata
        )
      `)
      .eq('restaurant_id', restaurantId)
      .gte('booking_time', startOfToday.toISOString())
      .lte('booking_time', endOfToday.toISOString())
      .in('status', ['confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'])
      .order('booking_time')

    const tableStatusMap = new Map<string, TableStatus>()

    // Initialize all tables
    tables.forEach(table => {
      tableStatusMap.set(table.id, {
        tableId: table.id,
        tableNumber: table.table_number,
        isOccupied: false,
        canAcceptWalkIn: restaurantStatus.isOpen,
        minutesUntilClose
      })
    })

    // If restaurant is closed, no walk-ins
    if (!restaurantStatus.isOpen) {
      tableStatusMap.forEach(status => {
        status.canAcceptWalkIn = false
      })
      return tableStatusMap
    }

    // Process bookings
    if (bookings) {
      for (const booking of bookings) {
        const bookingTables = booking.booking_tables || []
        const bookingStart = new Date(booking.booking_time)
        const bookingEnd = addMinutes(bookingStart, booking.turn_time_minutes || 120)

        // Check if booking time is within operating hours
        const bookingTimeStatus = await this.restaurantAvailability.isRestaurantOpen(
          restaurantId,
          bookingStart,
          format(bookingStart, 'HH:mm')
        )

        if (!bookingTimeStatus.isOpen) {
          // Skip bookings outside operating hours
          continue
        }

        for (const { table_id } of bookingTables) {
          const tableStatus = tableStatusMap.get(table_id)
          if (!tableStatus) continue

          // Check if currently occupied
          if (currentTime >= bookingStart && currentTime <= bookingEnd) {
            const seatedHistory = booking.booking_status_history?.find(
              (h: any) => h.new_status === 'seated'
            )

            tableStatus.isOccupied = true
            tableStatus.canAcceptWalkIn = false
            tableStatus.currentBooking = {
              id: booking.id,
              status: booking.status as DiningStatus,
              seatedAt: seatedHistory?.changed_at ? new Date(seatedHistory.changed_at) : undefined,
              progress: TableStatusService.getDiningProgress(booking.status as DiningStatus),
              estimatedCompletion: bookingEnd,
              mealProgress: booking.status
            }
          } 
          // Check for next booking
          else if (bookingStart > currentTime && !tableStatus.nextBooking) {
            tableStatus.nextBooking = {
              id: booking.id,
              time: bookingStart,
              partySize: booking.party_size,
              guestName: booking.profiles?.full_name || booking.guest_name || 'Guest'
            }

            // Check if we can accept walk-ins before next booking
            const minutesUntilNext = differenceInMinutes(bookingStart, currentTime)
            const requiredBuffer = 90 // 1.5 hours buffer
            
            // Also check if walk-in would finish before closing
            if (minutesUntilClose && minutesUntilClose < requiredBuffer) {
              tableStatus.canAcceptWalkIn = false
            } else {
              tableStatus.canAcceptWalkIn = minutesUntilNext > requiredBuffer
            }
          }
        }
      }
    }

    // Final check for walk-in availability based on closing time
    tableStatusMap.forEach(status => {
      if (!status.isOccupied && !status.nextBooking && minutesUntilClose) {
        // Need at least 90 minutes before closing for walk-ins
        status.canAcceptWalkIn = minutesUntilClose >= 90
      }
    })

    return tableStatusMap
  }

  // Get valid status transitions for a booking
  getValidTransitions(currentStatus: DiningStatus): StatusTransition[] {
    return TableStatusService.STATUS_TRANSITIONS.filter((t: { from: string }) => t.from === currentStatus)
  }

  // Get all available statuses that can be reached from current status
  getAllAvailableStatuses(currentStatus: DiningStatus): StatusTransition[] {
    // Define all possible statuses
    const allStatuses: DiningStatus[] = [
      'pending', 'confirmed', 'arrived', 'seated', 'ordered', 
      'appetizers', 'main_course', 'dessert', 'payment', 'completed',
      'no_show', 'cancelled_by_user', 'cancelled_by_restaurant'
    ]

    // Filter out the current status and create transitions
    return allStatuses
      .filter(status => status !== currentStatus)
      .map(status => ({
        from: currentStatus,
        to: status,
        label: status === 'appetizers' || status === 'main_course' ? 
          status.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') :
          status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
        requiresConfirmation: ['no_show', 'cancelled_by_user', 'cancelled_by_restaurant'].includes(status)
      }))
  }

  // Estimate remaining dining time
  estimateRemainingTime(status: DiningStatus, turnTimeMinutes: number): number {
    const progress = TableStatusService.getDiningProgress(status)
    const elapsed = (progress / 100) * turnTimeMinutes
    return Math.max(0, turnTimeMinutes - elapsed)
  }

  // Check if restaurant will close before estimated completion
  async willCloseBeforeCompletion(
    restaurantId: string,
    currentTime: Date,
    estimatedMinutesRemaining: number
  ): Promise<{
    willClose: boolean
    closingTime?: string
    minutesUntilClose?: number
  }> {
    const restaurantStatus = await this.restaurantAvailability.isRestaurantOpen(
      restaurantId,
      currentTime,
      format(currentTime, 'HH:mm')
    )

    if (!restaurantStatus.isOpen || !restaurantStatus.hours) {
      return { willClose: true }
    }

    const [closeHour, closeMin] = restaurantStatus.hours.close.split(':').map(Number)
    const closeTime = new Date(currentTime)
    closeTime.setHours(closeHour, closeMin, 0, 0)
    
    // Handle overnight hours
    if (closeTime < currentTime) {
      closeTime.setDate(closeTime.getDate() + 1)
    }
    
    const minutesUntilClose = differenceInMinutes(closeTime, currentTime)
    
    return {
      willClose: minutesUntilClose < estimatedMinutesRemaining,
      closingTime: restaurantStatus.hours.close,
      minutesUntilClose
    }
  }

  // Get walk-in availability considering restaurant hours
  async getWalkInAvailability(
    restaurantId: string,
    currentTime: Date = new Date()
  ): Promise<{
    available: boolean
    reason?: string
    availableTables?: number
    closingTime?: string
  }> {
    // Check if restaurant is open
    const restaurantStatus = await this.restaurantAvailability.isRestaurantOpen(
      restaurantId,
      currentTime,
      format(currentTime, 'HH:mm')
    )

    if (!restaurantStatus.isOpen) {
      return {
        available: false,
        reason: restaurantStatus.reason || 'Restaurant is closed'
      }
    }

    // Get table statuses
    const tableStatuses = await this.getTableStatuses(restaurantId, currentTime)
    
    // Count available tables for walk-ins
    const availableTablesForWalkIn = Array.from(tableStatuses.values())
      .filter(status => status.canAcceptWalkIn)
    
    if (availableTablesForWalkIn.length === 0) {
      // Check why no tables are available
      const allOccupied = Array.from(tableStatuses.values())
        .every(status => status.isOccupied)
      
      if (allOccupied) {
        return {
          available: false,
          reason: 'All tables are currently occupied'
        }
      }
      
      // Must be closing soon
      return {
        available: false,
        reason: 'Kitchen closing soon - no walk-ins accepted',
        closingTime: restaurantStatus.hours?.close
      }
    }

    return {
      available: true,
      availableTables: availableTablesForWalkIn.length,
      closingTime: restaurantStatus.hours?.close
    }
  }
}