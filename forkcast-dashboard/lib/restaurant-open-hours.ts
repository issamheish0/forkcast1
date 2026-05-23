// lib/restaurant-open-hours.ts
import { createClient } from '@/lib/supabase/client'
import { format, addDays, isSameDay } from 'date-fns'
import type { RestaurantOpenHours, RestaurantStatus } from '@/types'

export class RestaurantOpenHoursManager {
  private supabase = createClient()
  private cache = new Map<string, { data: any; timestamp: number }>()
  private cacheTimeout = 5 * 60 * 1000 // 5 minutes

  /**
   * Check if a restaurant is physically open right now
   */
  async isRestaurantPhysicallyOpen(
    restaurantId: string,
    checkTime?: Date
  ): Promise<{
    isOpen: boolean
    reason?: string
    currentService?: RestaurantOpenHours
    acceptsWalkins?: boolean
  }> {
    try {
      const now = checkTime || new Date()
      const dateStr = format(now, 'yyyy-MM-dd')
      const dayOfWeek = format(now, 'EEEE').toLowerCase()
      const timeStr = format(now, 'HH:mm')

      const cacheKey = `physical-${restaurantId}-${dateStr}-${timeStr}`

      // Check cache
      const cached = this.cache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data
      }

      // Check for closures first
      const { data: closures } = await this.supabase
        .from('restaurant_closures')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .lte('start_date', dateStr)
        .gte('end_date', dateStr)
        .maybeSingle()

      if (closures) {
        // If closure has time fields, check if current time falls within closure hours
        if (closures.start_time && closures.end_time) {
          const isWithinClosureHours = this.isTimeWithinRange(
            timeStr,
            closures.start_time,
            closures.end_time
          )

          if (isWithinClosureHours) {
            const result = {
              isOpen: false,
              reason: closures.reason || 'Temporarily closed',
              acceptsWalkins: false
            }
            this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
            return result
          }
        } else {
          // Full-day closure (original behavior)
          const result = {
            isOpen: false,
            reason: closures.reason || 'Temporarily closed',
            acceptsWalkins: false
          }
          this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
          return result
        }
      }

      // Get open hours for today
      const { data: openHours } = await this.supabase
        .from('restaurant_open_hours')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_open', true)
        .order('open_time')

      if (!openHours || openHours.length === 0) {
        const result = {
          isOpen: false,
          reason: 'Closed today',
          acceptsWalkins: false
        }
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
        return result
      }

      // Check if current time falls within any open hours
      for (const service of openHours) {
        if (service.open_time && service.close_time) {
          const isWithinHours = this.isTimeWithinRange(
            timeStr,
            service.open_time,
            service.close_time
          )

          if (isWithinHours) {
            const result = {
              isOpen: true,
              currentService: service,
              acceptsWalkins: service.accepts_walkins
            }
            this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
            return result
          }
        }
      }

      const result = {
        isOpen: false,
        reason: 'Closed at this time',
        acceptsWalkins: false
      }
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
      return result
    } catch (error) {
      console.error('Error checking if restaurant is physically open:', error)
      return {
        isOpen: false,
        reason: 'Unable to verify status',
        acceptsWalkins: false
      }
    }
  }

  /**
   * Get comprehensive restaurant status including both open hours and booking availability
   */
  async getRestaurantStatus(restaurantId: string, checkTime?: Date): Promise<RestaurantStatus> {
    try {
      const now = checkTime || new Date()

      // Get physical open status
      const openStatus = await this.isRestaurantPhysicallyOpen(restaurantId, now)

      // Get booking availability status using existing availability system
      const { RestaurantAvailability } = await import('./restaurant-availability')
      const availabilityManager = new RestaurantAvailability()
      const bookingStatus = await availabilityManager.isRestaurantOpen(restaurantId, now, format(now, 'HH:mm'))

      // Get next opening information
      const nextOpening = await this.getNextOpening(restaurantId, now)
      const nextBookingAvailability = bookingStatus.isOpen ? null : await this.getNextBookingAvailability(restaurantId, now)

      // Generate status message
      let statusMessage = ''
      if (openStatus.isOpen && bookingStatus.isOpen) {
        statusMessage = `Open • ${openStatus.currentService?.name || 'Service available'}`
        if (openStatus.acceptsWalkins) {
          statusMessage += ' • Walk-ins welcome'
        }
      } else if (openStatus.isOpen && !bookingStatus.isOpen) {
        statusMessage = `Open for walk-ins only • ${openStatus.currentService?.name || 'No online bookings'}`
      } else if (!openStatus.isOpen && bookingStatus.isOpen) {
        statusMessage = 'Closed • Online bookings only'
      } else {
        statusMessage = openStatus.reason || 'Closed'
      }

      return {
        restaurant_id: restaurantId,
        is_open: openStatus.isOpen,
        is_accepting_bookings: bookingStatus.isOpen,
        current_service_type: openStatus.currentService?.service_type || null,
        accepts_walkins_now: openStatus.acceptsWalkins || false,
        next_opening: nextOpening,
        next_booking_availability: nextBookingAvailability,
        status_message: statusMessage
      }
    } catch (error) {
      console.error('Error getting restaurant status:', error)
      return {
        restaurant_id: restaurantId,
        is_open: false,
        is_accepting_bookings: false,
        current_service_type: null,
        accepts_walkins_now: false,
        next_opening: null,
        next_booking_availability: null,
        status_message: 'Status unavailable'
      }
    }
  }

  /**
   * Get the next opening time for the restaurant
   */
  async getNextOpening(restaurantId: string, fromTime?: Date): Promise<{
    day: string
    time: string
    service_type: string
  } | null> {
    try {
      const startTime = fromTime || new Date()

      // Check the next 7 days
      for (let i = 0; i < 7; i++) {
        const checkDate = addDays(startTime, i)
        const dayOfWeek = format(checkDate, 'EEEE').toLowerCase()
        const dateStr = format(checkDate, 'yyyy-MM-dd')

        // Check for closures
        const { data: closures } = await this.supabase
          .from('restaurant_closures')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .lte('start_date', dateStr)
          .gte('end_date', dateStr)
          .maybeSingle()

        // Skip days that are fully closed
        if (closures && !closures.start_time && !closures.end_time) {
          continue // Full-day closure
        }

        // Get open hours for this day
        const { data: openHours } = await this.supabase
          .from('restaurant_open_hours')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('day_of_week', dayOfWeek)
          .eq('is_open', true)
          .order('open_time')

        if (openHours && openHours.length > 0) {
          const currentTimeStr = format(startTime, 'HH:mm')

          for (const service of openHours) {
            if (service.open_time) {
              // If it's today, check if the opening time is in the future
              if (isSameDay(checkDate, startTime)) {
                if (service.open_time > currentTimeStr) {
                  return {
                    day: format(checkDate, 'EEEE'),
                    time: service.open_time,
                    service_type: service.service_type
                  }
                }
              } else {
                // For future days, return the first opening time
                return {
                  day: format(checkDate, 'EEEE'),
                  time: service.open_time,
                  service_type: service.service_type
                }
              }
            }
          }
        }
      }

      return null
    } catch (error) {
      console.error('Error getting next opening:', error)
      return null
    }
  }

  /**
   * Get the next booking availability
   */
  private async getNextBookingAvailability(restaurantId: string, fromTime: Date): Promise<{
    day: string
    time: string
  } | null> {
    try {
      const { RestaurantAvailability } = await import('./restaurant-availability')
      const availabilityManager = new RestaurantAvailability()

      // Check the next 7 days
      for (let i = 0; i < 7; i++) {
        const checkDate = addDays(fromTime, i)
        const slots = await availabilityManager.getAvailableTimeSlots(restaurantId, checkDate, 2)

        if (slots.length > 0) {
          return {
            day: format(checkDate, 'EEEE'),
            time: slots[0]
          }
        }
      }

      return null
    } catch (error) {
      console.error('Error getting next booking availability:', error)
      return null
    }
  }

  /**
   * Get open hours for a specific day
   */
  async getDayOpenHours(restaurantId: string, date: Date): Promise<RestaurantOpenHours[]> {
    const dayOfWeek = format(date, 'EEEE').toLowerCase()

    const { data, error } = await this.supabase
      .from('restaurant_open_hours')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('day_of_week', dayOfWeek)
      .order('open_time')

    if (error) {
      console.error('Error fetching day open hours:', error)
      return []
    }

    return data || []
  }

  /**
   * Get all open hours for a restaurant
   */
  async getWeeklyOpenHours(restaurantId: string): Promise<RestaurantOpenHours[]> {
    const { data, error } = await this.supabase
      .from('restaurant_open_hours')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('day_of_week')
      .order('open_time')

    if (error) {
      console.error('Error fetching weekly open hours:', error)
      return []
    }

    return data || []
  }

  /**
   * Get open hours grouped by day and service type
   */
  async getGroupedOpenHours(restaurantId: string): Promise<Record<string, Record<string, RestaurantOpenHours[]>>> {
    const hours = await this.getWeeklyOpenHours(restaurantId)
    const grouped: Record<string, Record<string, RestaurantOpenHours[]>> = {}

    for (const hour of hours) {
      if (!grouped[hour.day_of_week]) {
        grouped[hour.day_of_week] = {}
      }
      if (!grouped[hour.day_of_week][hour.service_type]) {
        grouped[hour.day_of_week][hour.service_type] = []
      }
      grouped[hour.day_of_week][hour.service_type].push(hour)
    }

    return grouped
  }

  /**
   * Check if walk-ins are currently accepted
   */
  async acceptsWalkinsNow(restaurantId: string, checkTime?: Date): Promise<boolean> {
    const status = await this.isRestaurantPhysicallyOpen(restaurantId, checkTime)
    return status.acceptsWalkins || false
  }

  /**
   * Get service types available today
   */
  async getTodayServiceTypes(restaurantId: string): Promise<string[]> {
    const today = new Date()
    const hours = await this.getDayOpenHours(restaurantId, today)
    const currentTime = format(today, 'HH:mm')

    const activeServices = hours
      .filter(h => h.is_open && h.open_time && h.close_time)
      .filter(h => this.isTimeWithinRange(currentTime, h.open_time!, h.close_time!))
      .map(h => h.service_type)

    return [...new Set(activeServices)]
  }

  /**
   * Clear cache for specific restaurant
   */
  clearCache(restaurantId?: string) {
    if (restaurantId) {
      Array.from(this.cache.keys())
        .filter(key => key.includes(restaurantId))
        .forEach(key => this.cache.delete(key))
    } else {
      this.cache.clear()
    }
  }

  /**
   * Helper function to check if a time is within a range
   */
  private isTimeWithinRange(time: string, openTime: string, closeTime: string): boolean {
    const [hour, minute] = time.split(':').map(Number)
    const [openHour, openMinute] = openTime.split(':').map(Number)
    const [closeHour, closeMinute] = closeTime.split(':').map(Number)

    const currentMinutes = hour * 60 + minute
    const openMinutes = openHour * 60 + openMinute
    const closeMinutes = closeHour * 60 + closeMinute

    // Handle cases where closing time is after midnight
    if (closeMinutes < openMinutes) {
      return currentMinutes >= openMinutes || currentMinutes < closeMinutes
    }

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes
  }

  /**
   * Format time for display
   */
  formatTimeDisplay(time: string): string {
    const [hour, minute] = time.split(':').map(Number)
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
  }

  /**
   * Format service hours for display
   */
  formatServiceDisplay(service: RestaurantOpenHours): string {
    if (!service.is_open) return 'Closed'
    if (!service.open_time || !service.close_time) return 'Open'

    const openTime = this.formatTimeDisplay(service.open_time)
    const closeTime = this.formatTimeDisplay(service.close_time)
    const serviceName = service.name || service.service_type

    return `${serviceName}: ${openTime} - ${closeTime}`
  }
}

// Export singleton instance
export const restaurantOpenHours = new RestaurantOpenHoursManager()

// Export utility functions for direct use
export const isRestaurantPhysicallyOpen = (restaurantId: string, checkTime?: Date) =>
  restaurantOpenHours.isRestaurantPhysicallyOpen(restaurantId, checkTime)

export const getRestaurantStatus = (restaurantId: string, checkTime?: Date) =>
  restaurantOpenHours.getRestaurantStatus(restaurantId, checkTime)

export const acceptsWalkinsNow = (restaurantId: string, checkTime?: Date) =>
  restaurantOpenHours.acceptsWalkinsNow(restaurantId, checkTime)

export const getTodayServiceTypes = (restaurantId: string) =>
  restaurantOpenHours.getTodayServiceTypes(restaurantId)