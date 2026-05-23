// lib/hooks/use-waitlist-status.ts
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { getRestaurantTier, isBasicTier } from '@/lib/utils/tier'

interface WaitlistStatusResult {
  isWaitlistTime: boolean
  isBasicTier: boolean
  loading: boolean
  message?: string
  schedules?: WaitlistSchedule[]
}

interface WaitlistSchedule {
  id: string
  waitlist_date: string // ISO date format (YYYY-MM-DD)
  start_time: string
  end_time: string
  name?: string
  is_active: boolean
}

export function useWaitlistStatus(
  restaurantId: string | undefined,
  bookingTime: Date | undefined,
  tier?: string
) {
  const [result, setResult] = useState<WaitlistStatusResult>({
    isWaitlistTime: false,
    isBasicTier: false,
    loading: false
  })

  const supabase = createClient()

  // Fetch restaurant tier if not provided
  const { data: restaurant, isLoading: restaurantLoading } = useQuery({
    queryKey: ['restaurant-tier', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null
      const { data, error } = await supabase
        .from('restaurants')
        .select('tier')
        .eq('id', restaurantId)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!restaurantId && !tier
  })

  // Fetch waitlist schedules for basic tier restaurants
  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['waitlist-schedules-check', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from('restaurant_waitlist_schedules')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('waitlist_date', { ascending: false })
        .order('start_time')

      if (error) throw error
      return data as WaitlistSchedule[]
    },
    enabled: !!restaurantId
  })

  // Check waitlist time using database function
  const { data: isWaitlistTime, isLoading: waitlistTimeLoading } = useQuery({
    queryKey: ['is-waitlist-time', restaurantId, bookingTime?.toISOString()],
    queryFn: async () => {
      if (!restaurantId || !bookingTime) return false

      const { data, error } = await supabase
        .rpc('is_waitlist_time', {
          restaurant_id_param: restaurantId,
          booking_time_param: bookingTime.toISOString()
        })

      if (error) {
        console.error('Error checking waitlist time:', error)
        return false
      }

      return data || false
    },
    enabled: !!restaurantId && !!bookingTime
  })

  useEffect(() => {
    const currentTier = tier || (restaurant ? getRestaurantTier(restaurant) : 'pro')
    const isBasic = isBasicTier(currentTier as any)
    const loading = restaurantLoading || schedulesLoading || waitlistTimeLoading

    if (loading) {
      setResult({
        isWaitlistTime: false,
        isBasicTier: isBasic,
        loading: true
      })
      return
    }

    if (!isBasic) {
      setResult({
        isWaitlistTime: false,
        isBasicTier: false,
        loading: false,
        message: 'Booking will be confirmed instantly'
      })
      return
    }

    const willBeWaitlisted = isWaitlistTime || false

    let message = ''
    if (willBeWaitlisted) {
      // Find matching schedule for more specific message
      if (schedules && schedules.length > 0 && bookingTime) {
        const bookingDate = bookingTime.toISOString().split('T')[0] // YYYY-MM-DD format
        const timeString = bookingTime.toTimeString().slice(0, 8) // HH:MM:SS to match database format

        const matchingSchedule = schedules.find(schedule => {
          // Ensure both times are in HH:MM:SS format for comparison
          const scheduleStart = schedule.start_time.length === 5 ? `${schedule.start_time}:00` : schedule.start_time
          const scheduleEnd = schedule.end_time.length === 5 ? `${schedule.end_time}:00` : schedule.end_time
          
          return schedule.waitlist_date === bookingDate &&
                 timeString >= scheduleStart &&
                 timeString < scheduleEnd
        })

        if (matchingSchedule) {
          const scheduleName = matchingSchedule.name || 'Busy Period'
          message = `This booking will join the waitlist (${scheduleName}). You'll be contacted when a table becomes available.`
        } else {
          message = 'This booking will join the waitlist. You\'ll be contacted when a table becomes available.'
        }
      } else {
        message = 'This booking will join the waitlist. You\'ll be contacted when a table becomes available.'
      }
    } else {
      message = 'This booking will be confirmed instantly.'
    }

    setResult({
      isWaitlistTime: willBeWaitlisted,
      isBasicTier: isBasic,
      loading: false,
      message,
      schedules: schedules || []
    })
  }, [restaurant, schedules, isWaitlistTime, tier, restaurantLoading, schedulesLoading, waitlistTimeLoading, bookingTime])

  return result
}

// Helper hook for getting active waitlist schedules
export function useWaitlistSchedules(restaurantId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['waitlist-schedules', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []

      const { data, error } = await supabase
        .from('restaurant_waitlist_schedules')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('waitlist_date', { ascending: false })
        .order('start_time')

      if (error) throw error
      return data as WaitlistSchedule[]
    },
    enabled: !!restaurantId
  })
}

// Helper function to format schedule for display
export function formatScheduleDisplay(schedule: WaitlistSchedule): string {
  // Format date in Lebanon timezone
  const date = new Date(schedule.waitlist_date + 'T00:00:00')
  const dayName = date.toLocaleDateString('en', { weekday: 'long', timeZone: 'Asia/Beirut' })
  const dateFormatted = date.toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Beirut'
  })

  // Handle both HH:MM and HH:MM:SS formats
  const startTimeFormatted = schedule.start_time.length === 5
    ? `${schedule.start_time}:00`
    : schedule.start_time
  const endTimeFormatted = schedule.end_time.length === 5
    ? `${schedule.end_time}:00`
    : schedule.end_time

  const startTime = new Date(`2000-01-01T${startTimeFormatted}`).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
  const endTime = new Date(`2000-01-01T${endTimeFormatted}`).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })

  const timeRange = `${startTime} - ${endTime} (Lebanon time)`
  const name = schedule.name ? ` (${schedule.name})` : ''

  return `${dayName}, ${dateFormatted} ${timeRange}${name}`
}