// lib/services/booking-conflict-service.ts

import { createClient } from '@/lib/supabase/client'
import { format, differenceInMinutes, addMinutes } from 'date-fns'

export interface BookingConflict {
  id: string
  walkInBookingId: string
  upcomingBookingId: string
  tableIds: string[]
  walkInGuestName: string
  upcomingGuestName: string
  arrivalTime: Date
  seatedTime: Date
  mustVacateBy: Date
  urgencyLevel: 'critical' | 'warning' | 'info'
  resolved: boolean
  createdAt: Date
}

export interface ConflictNotification {
  id: string
  conflictId: string
  type: 'walk_in_seated' | 'time_warning' | 'urgent_warning' | 'overdue_warning'
  title: string
  message: string
  actionRequired: boolean
  dismissed: boolean
  createdAt: Date
}

export class BookingConflictService {
  private supabase = createClient()

  /**
   * Create a booking conflict when a walk-in is seated at a table with upcoming reservations
   */
  async createConflict(
    walkInBookingId: string,
    upcomingBookingIds: string[],
    tableIds: string[]
  ): Promise<BookingConflict[]> {
    const conflicts: BookingConflict[] = []
    
    // Get booking details
    const { data: walkInBooking } = await this.supabase
      .from('bookings')
      .select(`
        id,
        guest_name,
        guest_phone,
        party_size,
        seated_at,
        booking_time,
        user:profiles!bookings_user_id_fkey(full_name)
      `)
      .eq('id', walkInBookingId)
      .single()

    if (!walkInBooking) return conflicts

    for (const upcomingBookingId of upcomingBookingIds) {
      const { data: upcomingBooking } = await this.supabase
        .from('bookings')
        .select(`
          id,
          guest_name,
          guest_phone,
          party_size,
          booking_time,
          turn_time_minutes,
          user:profiles!bookings_user_id_fkey(full_name)
        `)
        .eq('id', upcomingBookingId)
        .single()

      if (!upcomingBooking) continue

      const arrivalTime = new Date(upcomingBooking.booking_time)
      const seatedTime = new Date(walkInBooking.seated_at || walkInBooking.booking_time)
      // Walk-in should vacate 15 minutes before the next booking arrives
      const mustVacateBy = addMinutes(arrivalTime, -15)

      const minutesToArrival = differenceInMinutes(arrivalTime, new Date())
      let urgencyLevel: 'critical' | 'warning' | 'info'
      
      if (minutesToArrival <= 30) urgencyLevel = 'critical'
      else if (minutesToArrival <= 60) urgencyLevel = 'warning'
      else urgencyLevel = 'info'

      const conflict: BookingConflict = {
        id: `${walkInBookingId}-${upcomingBookingId}`,
        walkInBookingId,
        upcomingBookingId,
        tableIds,
        walkInGuestName: (walkInBooking.user as any)?.full_name || walkInBooking.guest_name || 'Walk-in Guest',
        upcomingGuestName: (upcomingBooking.user as any)?.full_name || upcomingBooking.guest_name || 'Guest',
        arrivalTime,
        seatedTime,
        mustVacateBy,
        urgencyLevel,
        resolved: false,
        createdAt: new Date()
      }

      conflicts.push(conflict)

      // Create initial notification
      await this.createConflictNotification(conflict, 'walk_in_seated')
    }

    return conflicts
  }

  /**
   * Create a notification for a booking conflict
   */
  private async createConflictNotification(
    conflict: BookingConflict,
    type: ConflictNotification['type']
  ): Promise<ConflictNotification> {
    const tableNumbers = await this.getTableNumbers(conflict.tableIds)
    const minutesToArrival = differenceInMinutes(conflict.arrivalTime, new Date())
    
    let title: string
    let message: string
    let actionRequired = false

    switch (type) {
      case 'walk_in_seated':
        title = '⚠️ Booking Conflict Created'
        message = `${conflict.walkInGuestName} seated at Table ${tableNumbers} with upcoming reservation for ${conflict.upcomingGuestName} at ${format(conflict.arrivalTime, 'h:mm a')}`
        actionRequired = true
        break
      
      case 'time_warning':
        title = '🕒 Walk-in Time Warning'
        message = `Table ${tableNumbers} must be vacated in ${minutesToArrival} minutes for ${conflict.upcomingGuestName}`
        actionRequired = true
        break
      
      case 'urgent_warning':
        title = '🚨 URGENT: Table Needed Soon'
        message = `${conflict.upcomingGuestName} arriving in ${minutesToArrival} minutes at Table ${tableNumbers}. Walk-in must leave NOW!`
        actionRequired = true
        break
      
      case 'overdue_warning':
        title = '⏰ OVERDUE: Guest Has Arrived'
        message = `${conflict.upcomingGuestName} should have arrived. Walk-in at Table ${tableNumbers} may need immediate relocation!`
        actionRequired = true
        break
    }

    const notification: ConflictNotification = {
      id: `${conflict.id}-${type}-${Date.now()}`,
      conflictId: conflict.id,
      type,
      title,
      message,
      actionRequired,
      dismissed: false,
      createdAt: new Date()
    }

    // Store in localStorage for persistence across sessions
    const existingNotifications = this.getStoredNotifications()
    existingNotifications.push(notification)
    localStorage.setItem('booking-conflict-notifications', JSON.stringify(existingNotifications))

    return notification
  }

  /**
   * Get active conflict notifications
   */
  getActiveNotifications(): ConflictNotification[] {
    return this.getStoredNotifications().filter(n => !n.dismissed)
  }

  /**
   * Dismiss a notification
   */
  dismissNotification(notificationId: string): void {
    const notifications = this.getStoredNotifications()
    const updated = notifications.map(n => 
      n.id === notificationId ? { ...n, dismissed: true } : n
    )
    localStorage.setItem('booking-conflict-notifications', JSON.stringify(updated))
  }

  /**
   * Mark a conflict as resolved
   */
  resolveConflict(conflictId: string): void {
    const notifications = this.getStoredNotifications()
    const updated = notifications.map(n => 
      n.conflictId === conflictId ? { ...n, dismissed: true } : n
    )
    localStorage.setItem('booking-conflict-notifications', JSON.stringify(updated))
  }

  /**
   * Check for time-based notifications that need to be sent
   */
  async checkForTimeWarnings(activeBookings: any[]): Promise<ConflictNotification[]> {
    const newNotifications: ConflictNotification[] = []
    const existingNotifications = this.getStoredNotifications()
    
    // Find walk-ins with upcoming conflicts
    const walkIns = activeBookings.filter(booking => {
      const isSeatedWalkIn = booking.status === 'seated' && 
        new Date(booking.booking_time) <= new Date() &&
        differenceInMinutes(new Date(), new Date(booking.booking_time)) < 60 // Seated recently
      return isSeatedWalkIn && booking.tables && booking.tables.length > 0
    })

    for (const walkIn of walkIns) {
      if (!walkIn.tables) continue

      const tableIds = walkIn.tables.map((t: any) => t.id)
      const upcomingBookings = activeBookings.filter(booking => {
        if (booking.id === walkIn.id || booking.status !== 'confirmed') return false
        
        const bookingTime = new Date(booking.booking_time)
        const timeDiff = differenceInMinutes(bookingTime, new Date())
        
        return timeDiff > 0 && 
               timeDiff <= 180 && // Within next 3 hours
               booking.tables?.some((t: any) => tableIds.includes(t.id))
      })

      for (const upcomingBooking of upcomingBookings) {
        const conflictId = `${walkIn.id}-${upcomingBooking.id}`
        const minutesToArrival = differenceInMinutes(new Date(upcomingBooking.booking_time), new Date())
        
        // Check if we should send warnings
        const shouldSend60MinWarning = minutesToArrival <= 60 && minutesToArrival > 30
        const shouldSend30MinWarning = minutesToArrival <= 30 && minutesToArrival > 0
        const shouldSendOverdueWarning = minutesToArrival <= 0

        // Check if notifications already sent
        const hasTimeWarning = existingNotifications.some(n => 
          n.conflictId === conflictId && n.type === 'time_warning' && !n.dismissed
        )
        const hasUrgentWarning = existingNotifications.some(n => 
          n.conflictId === conflictId && n.type === 'urgent_warning' && !n.dismissed
        )
        const hasOverdueWarning = existingNotifications.some(n => 
          n.conflictId === conflictId && n.type === 'overdue_warning' && !n.dismissed
        )

        const conflict: BookingConflict = {
          id: conflictId,
          walkInBookingId: walkIn.id,
          upcomingBookingId: upcomingBooking.id,
          tableIds,
          walkInGuestName: walkIn.user?.full_name || walkIn.guest_name || 'Walk-in',
          upcomingGuestName: upcomingBooking.user?.full_name || upcomingBooking.guest_name || 'Guest',
          arrivalTime: new Date(upcomingBooking.booking_time),
          seatedTime: new Date(walkIn.seated_at || walkIn.booking_time),
          mustVacateBy: addMinutes(new Date(upcomingBooking.booking_time), -15),
          urgencyLevel: shouldSend30MinWarning ? 'critical' : shouldSend60MinWarning ? 'warning' : 'info',
          resolved: false,
          createdAt: new Date()
        }

        if (shouldSendOverdueWarning && !hasOverdueWarning) {
          const notification = await this.createConflictNotification(conflict, 'overdue_warning')
          newNotifications.push(notification)
        } else if (shouldSend30MinWarning && !hasUrgentWarning) {
          const notification = await this.createConflictNotification(conflict, 'urgent_warning')
          newNotifications.push(notification)
        } else if (shouldSend60MinWarning && !hasTimeWarning) {
          const notification = await this.createConflictNotification(conflict, 'time_warning')
          newNotifications.push(notification)
        }
      }
    }

    return newNotifications
  }

  /**
   * Get table numbers for display
   */
  private async getTableNumbers(tableIds: string[]): Promise<string> {
    const { data: tables } = await this.supabase
      .from('restaurant_tables')
      .select('table_number')
      .in('id', tableIds)
    
    return tables?.map(t => t.table_number).join(', ') || 'Unknown'
  }

  /**
   * Get stored notifications from localStorage
   */
  private getStoredNotifications(): ConflictNotification[] {
    if (typeof localStorage === 'undefined') return []
    
    try {
      const stored = localStorage.getItem('booking-conflict-notifications')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  /**
   * Clean up old dismissed notifications (older than 24 hours)
   */
  cleanupOldNotifications(): void {
    const notifications = this.getStoredNotifications()
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)
    
    const active = notifications.filter(n => 
      !n.dismissed || new Date(n.createdAt) > oneDayAgo
    )
    
    localStorage.setItem('booking-conflict-notifications', JSON.stringify(active))
  }
}