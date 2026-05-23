// lib/restaurant-availability.ts
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

export interface RestaurantHours {
  id: string
  restaurant_id: string
  day_of_week: string
  is_open: boolean
  open_time: string | null
  close_time: string | null
}

export interface SpecialHours {
  id: string
  restaurant_id: string
  date: string
  is_closed: boolean
  open_time: string | null
  close_time: string | null
  reason: string | null
}

export interface Closure {
  id: string
  restaurant_id: string
  start_date: string
  end_date: string
  reason: string
  start_time?: string | null
  end_time?: string | null
}

export class RestaurantAvailability {
  private supabase = createClient()
  private cache = new Map<string, { data: any; timestamp: number }>()
  private cacheTimeout = 5 * 60 * 1000 // 5 minutes

  /**
   * Check if a restaurant is open at a specific date and time
   */
  async isRestaurantOpen(
    restaurantId: string,
    date: Date,
    time?: string // Format: "HH:mm"
  ): Promise<{
    isOpen: boolean
    reason?: string
    hours?: { open: string; close: string }
  }> {
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const dayOfWeek = format(date, 'EEEE').toLowerCase()
      const cacheKey = `${restaurantId}-${dateStr}-${time || 'all'}`

      // Check cache
      const cached = this.cache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data
      }

      // Check for closures first
      const { data: closures, error: closureError } = await this.supabase
        .from('restaurant_closures')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .lte('start_date', dateStr)
        .gte('end_date', dateStr)
        .maybeSingle()

      if (closureError && closureError.code !== 'PGRST116') {
        console.error('Error checking closures:', closureError)
        throw new Error('Failed to check restaurant availability')
      }

      if (closures) {
        // If closure has time fields, check if current time falls within closure hours
        if (closures.start_time && closures.end_time && time) {
          const isWithinClosureHours = this.isTimeWithinRange(
            time,
            closures.start_time,
            closures.end_time
          )

          if (isWithinClosureHours) {
            const result = {
              isOpen: false,
              reason: closures.reason || 'Temporarily closed'
            }
            this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
            return result
          }
        } else if (!closures.start_time && !closures.end_time) {
          // Full-day closure (original behavior)
          const result = {
            isOpen: false,
            reason: closures.reason || 'Temporarily closed'
          }
          this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
          return result
        }
      }

      // Check for special hours
      const { data: specialHours, error: specialError } = await this.supabase
        .from('restaurant_special_hours')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('date', dateStr)
        .maybeSingle()

      if (specialError && specialError.code !== 'PGRST116') {
        console.error('Error checking special hours:', specialError)
        throw new Error('Failed to check restaurant availability')
      }

      if (specialHours) {
        if (specialHours.is_closed) {
          const result = {
            isOpen: false,
            reason: specialHours.reason || 'Closed for special occasion'
          }
          this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
          return result
        }

        // If time is provided, check if it's within special hours
        if (time && specialHours.open_time && specialHours.close_time) {
          const isWithinHours = this.isTimeWithinRange(
            time,
            specialHours.open_time,
            specialHours.close_time
          )
          const result = {
            isOpen: isWithinHours,
            hours: {
              open: specialHours.open_time,
              close: specialHours.close_time
            }
          }
          this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
          return result
        }

        const result = {
          isOpen: true,
          hours: specialHours.open_time && specialHours.close_time ? {
            open: specialHours.open_time,
            close: specialHours.close_time
          } : undefined
        }
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
        return result
      }

      // Check regular hours (support multiple shifts per day)
      const { data: regularHours, error: regularError } = await this.supabase
        .from('restaurant_hours')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_open', true)
        .order('open_time')

      if (regularError) {
        console.error('Error checking regular hours:', regularError)
        throw new Error('Failed to check restaurant availability')
      }

      if (!regularHours || regularHours.length === 0) {
        const result = {
          isOpen: false,
          reason: 'Closed today'
        }
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
        return result
      }

      // If time is provided, check if it's within any of the shifts
      if (time) {
        for (const shift of regularHours) {
          if (shift.open_time && shift.close_time) {
            const isWithinHours = this.isTimeWithinRange(
              time,
              shift.open_time,
              shift.close_time
            )
            if (isWithinHours) {
              const result = {
                isOpen: true,
                hours: {
                  open: shift.open_time,
                  close: shift.close_time
                }
              }
              this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
              return result
            }
          }
        }
        
        // Time doesn't fall within any shift
        const result = {
          isOpen: false,
          reason: 'Restaurant is closed at this time'
        }
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
        return result
      }

      // If no specific time, return first shift hours
      const firstShift = regularHours[0]
      const result = {
        isOpen: true,
        hours: firstShift.open_time && firstShift.close_time ? {
          open: firstShift.open_time,
          close: firstShift.close_time
        } : undefined
      }
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
      return result
    } catch (error) {
      console.error('Error in isRestaurantOpen:', error)
      // Fallback to basic availability
      return {
        isOpen: true,
        reason: 'Unable to verify hours'
      }
    }
  }

  /**
   * Clear cache for a specific restaurant
   */
  clearCache(restaurantId?: string) {
    if (restaurantId) {
      // Clear specific restaurant cache
      Array.from(this.cache.keys())
        .filter(key => key.startsWith(restaurantId))
        .forEach(key => this.cache.delete(key))
    } else {
      // Clear all cache
      this.cache.clear()
    }
  }

  /**
   * Get available time slots for a specific date (supports multiple shifts)
   */
  async getAvailableTimeSlots(
    restaurantId: string,
    date: Date,
    partySize: number,
    slotDuration: number = 30 // minutes
  ): Promise<string[]> {
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayOfWeek = format(date, 'EEEE').toLowerCase()

    try {
      // Check for closures and special hours first
      const [closures, specialHours] = await Promise.all([
        this.supabase
          .from('restaurant_closures')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .lte('start_date', dateStr)
          .gte('end_date', dateStr)
          .maybeSingle(),
        this.supabase
          .from('restaurant_special_hours')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('date', dateStr)
          .maybeSingle()
      ])

      if (closures.data) return []
      if (specialHours.data?.is_closed) return []

      let shifts: Array<{ open_time: string; close_time: string }> = []

      if (specialHours.data && !specialHours.data.is_closed && specialHours.data.open_time && specialHours.data.close_time) {
        // Use special hours
        shifts = [{ open_time: specialHours.data.open_time, close_time: specialHours.data.close_time }]
      } else {
        // Get all regular hour shifts for this day
        const { data: regularHours } = await this.supabase
          .from('restaurant_hours')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('day_of_week', dayOfWeek)
          .eq('is_open', true)
          .order('open_time')

        shifts = regularHours?.filter(h => h.open_time && h.close_time)
          .map(h => ({ open_time: h.open_time!, close_time: h.close_time! })) || []
      }

      if (shifts.length === 0) return []

      const slots: string[] = []
      const mealDuration = 90 // Assume 90 minutes for a meal

      // Generate slots for all shifts
      for (const shift of shifts) {
        const [openHour, openMin] = shift.open_time.split(':').map(Number)
        const [closeHour, closeMin] = shift.close_time.split(':').map(Number)

        const startMinutes = openHour * 60 + openMin
        const endMinutes = closeHour * 60 + closeMin

        for (let minutes = startMinutes; minutes < endMinutes; minutes += slotDuration) {
          if (minutes + mealDuration <= endMinutes) {
            const hour = Math.floor(minutes / 60)
            const min = minutes % 60
            const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
            slots.push(timeStr)
          }
        }
      }

      return [...new Set(slots)].sort() // Remove duplicates and sort
    } catch (error) {
      console.error('Error getting available time slots:', error)
      return []
    }
  }

  /**
   * Get restaurant hours for a week (supports multiple shifts per day)
   */
  async getWeeklyHours(restaurantId: string): Promise<RestaurantHours[]> {
    const { data, error } = await this.supabase
      .from('restaurant_hours')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('day_of_week', { ascending: true })
      .order('open_time', { ascending: true })

    if (error) {
      console.error('Error fetching weekly hours:', error)
      return []
    }

    return data || []
  }

  /**
   * Get restaurant shifts grouped by day
   */
  async getWeeklyShifts(restaurantId: string): Promise<Record<string, RestaurantHours[]>> {
    const hours = await this.getWeeklyHours(restaurantId)
    const shiftsByDay: Record<string, RestaurantHours[]> = {}

    for (const hour of hours) {
      if (!shiftsByDay[hour.day_of_week]) {
        shiftsByDay[hour.day_of_week] = []
      }
      shiftsByDay[hour.day_of_week].push(hour)
    }

    return shiftsByDay
  }

  /**
   * Get upcoming special hours and closures
   */
  async getUpcomingSpecialSchedule(restaurantId: string) {
    const today = format(new Date(), 'yyyy-MM-dd')

    const [specialHours, closures] = await Promise.all([
      this.supabase
        .from('restaurant_special_hours')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .gte('date', today)
        .order('date', { ascending: true }),
      this.supabase
        .from('restaurant_closures')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .gte('end_date', today)
        .order('start_date', { ascending: true })
    ])

    return {
      specialHours: specialHours.data || [],
      closures: closures.data || []
    }
  }

  /**
   * Helper function to check if a time is within a range
   */
  private isTimeWithinRange(
    time: string,
    openTime: string,
    closeTime: string
  ): boolean {
    const [hour, minute] = time.split(':').map(Number)
    const [openHour, openMinute] = openTime.split(':').map(Number)
    const [closeHour, closeMinute] = closeTime.split(':').map(Number)

    const currentMinutes = hour * 60 + minute
    const openMinutes = openHour * 60 + openMinute
    const closeMinutes = closeHour * 60 + closeMinute

    // Handle cases where closing time is after midnight
    if (closeMinutes < openMinutes) {
      // Restaurant closes after midnight
      return currentMinutes >= openMinutes || currentMinutes < closeMinutes
    }

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes
  }

  /**
   * Format hours for display
   */
  formatHoursDisplay(hours: { open: string; close: string }): string {
    const formatTime = (time: string) => {
      const [hour, minute] = time.split(':').map(Number)
      const period = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
    }

    return `${formatTime(hours.open)} - ${formatTime(hours.close)}`
  }
}