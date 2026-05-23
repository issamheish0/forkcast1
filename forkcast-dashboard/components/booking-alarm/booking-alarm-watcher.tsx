"use client"

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { bookingAlarmService } from '@/lib/services/booking-alarm-service'
import { useRestaurantContext } from '@/lib/contexts/restaurant-context'

/**
 * Silently syncs pending bookings with bookingAlarmService.
 * This ensures the BookingAlarmOverlay shows on ANY page, not just basic-dashboard.
 */
export function BookingAlarmWatcher() {
  const { currentRestaurant } = useRestaurantContext()
  const restaurantId = currentRestaurant?.restaurant?.id

  useEffect(() => {
    if (!restaurantId) return

    let cancelled = false
    const supabase = createClient()

    async function syncPendingBookings() {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const { data: bookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
        .gte('booking_time', todayStart.toISOString())

      if (cancelled) return

      const pendingIds = new Set((bookings || []).map((b: any) => b.id))

      // Start alarm for any new pending bookings
      pendingIds.forEach(id => {
        if (!bookingAlarmService.hasPending(id)) {
          bookingAlarmService.startAlarm(id)
        }
      })

      // Stop alarm for bookings no longer pending
      const currentIds = bookingAlarmService.getPendingIds()
      currentIds.forEach(id => {
        if (!id.startsWith('push-') && !pendingIds.has(id)) {
          bookingAlarmService.stopAlarm(id)
        }
      })
    }

    syncPendingBookings()

    // Poll every 30s as a fallback
    const interval = setInterval(syncPendingBookings, 30_000)

    // Real-time subscription
    const channel = supabase
      .channel(`alarm-watcher:${restaurantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => {
        syncPendingBookings()
      })
      .subscribe()

    return () => {
      cancelled = true
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [restaurantId])

  return null
}
