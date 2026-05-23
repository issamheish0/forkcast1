"use client"

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useNotifications } from '@/lib/contexts/notification-context'
import { bookingAlarmService } from '@/lib/services/booking-alarm-service'
import { RealtimeChannel } from '@supabase/supabase-js'
import { Booking } from '@/types'
import { getBookingDisplayName, getFirstName } from '@/lib/utils'
import { usePathname, useSearchParams } from 'next/navigation'

export function useGlobalLayoutNotifications() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { addNotification, requestPushPermission, isPushEnabled } = useNotifications()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const pushSetupRef = useRef<boolean>(false)
 

  // Extract restaurant ID from URL or search params
  const getRestaurantId = async () => {
    
    // Check if we're on a dashboard page with restaurant param
    if (pathname.startsWith('/bookings')) {
      const restaurantId = searchParams.get('restaurant')
      if (restaurantId) {
        return restaurantId
      }
    }
    
    // Check if we're on a specific restaurant page
    const pathParts = pathname.split('/')
    if (pathParts.includes('bookings')) {
      // Try to get from localStorage or other sources
      if (typeof window !== 'undefined') {
        const storedRestaurantId = localStorage.getItem('selected-restaurant-id')
        if (storedRestaurantId) return storedRestaurantId
      }
      
      // For basic dashboard, try to get from database
      if (pathname.startsWith('/bookings')) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: staffData } = await supabase
              .from("restaurant_staff")
              .select("restaurant_id")
              .eq("user_id", user.id)
              .single()
            
            if (staffData) {
             
              return staffData.restaurant_id
            }
          }
        } catch (error) {
         
        }
      }
    }
    
    // Try to get restaurant ID from localStorage regardless of page
    if (typeof window !== 'undefined') {
      const storedRestaurantId = localStorage.getItem('selected-restaurant-id')
      if (storedRestaurantId) return storedRestaurantId
    }
    
    return null
  }

  const getDisplayGuestName = (booking: Booking): string => getBookingDisplayName(booking)

  // Prefer guest_name, else fetch profile full_name by user_id as needed
  const resolveGuestName = async (booking: Booking): Promise<string> => {
    const local = getDisplayGuestName(booking)
    if (local && local !== 'Guest') return local
    const userId = (booking as any)?.user_id
    if (userId) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, phone_number')
          .eq('id', userId)
          .single()
        const name = getBookingDisplayName({ user: data })
        return name || 'Guest'
      } catch {
        return 'Guest'
      }
    }
    return 'Guest'
  }

  // Resolve restaurant ID once and store it
  const restaurantIdRef = useRef<string | null>(null)

  // Resolve restaurant ID effect
  useEffect(() => {
    if (pathname.startsWith('/admin') || pathname.startsWith('/bookings')) return

    let cancelled = false
    getRestaurantId().then(id => {
      if (!cancelled) restaurantIdRef.current = id
    })
    return () => { cancelled = true }
  }, [pathname, searchParams])

  // Push notification setup (once per session)
  useEffect(() => {
    if (pushSetupRef.current || isPushEnabled) return
    if (pathname.startsWith('/admin') || pathname.startsWith('/bookings')) return

    let cancelled = false
    const setup = async () => {
      const restaurantId = await getRestaurantId()
      if (!restaurantId || cancelled) return

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const { data: staffData } = await supabase
          .from('restaurant_staff')
          .select('id')
          .eq('user_id', user.id)
          .eq('restaurant_id', restaurantId)
          .eq('is_active', true)
          .single()

        if (staffData && !cancelled) {
          console.log('🔔 Setting up push notifications for authenticated staff member...')
          setTimeout(async () => {
            if (cancelled) return
            const granted = await requestPushPermission()
            console.log(granted ? '✅ Push notifications enabled' : '❌ Push notifications not enabled')
          }, 2000)
        }
      } catch (error) {
        console.error('Failed to set up push notifications:', error)
      }
      pushSetupRef.current = true
    }
    setup()
    return () => { cancelled = true }
  }, [pathname, isPushEnabled])

  // Realtime subscription effect — cleanup is synchronous so useEffect can use it
  useEffect(() => {
    if (pathname.startsWith('/admin') || pathname.startsWith('/bookings')) return

    let channel: RealtimeChannel | null = null
    let cancelled = false

    const setupChannel = async () => {
      const restaurantId = await getRestaurantId()
      if (!restaurantId || cancelled) return

      channel = supabase
        .channel(`global-layout-bookings:restaurant:${restaurantId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'bookings',
            filter: `restaurant_id=eq.${restaurantId}`
          },
          async (payload) => {
            const newBooking = payload.new as Booking
            if (!newBooking || newBooking.restaurant_id !== restaurantId) return

            // Update query cache for global bookings
            queryClient.setQueryData(
              ['bookings', restaurantId],
              (oldData: { bookings: Booking[] } | undefined) => {
                if (!oldData) return { bookings: [newBooking] }
                return {
                  ...oldData,
                  bookings: [newBooking, ...oldData.bookings]
                }
              }
            )

            queryClient.setQueryData(
              ['all-bookings', restaurantId],
              (oldData: Booking[] | undefined) => {
                if (!oldData) return [newBooking]
                const exists = oldData.some(b => b.id === newBooking.id)
                if (exists) return oldData
                return [...oldData, newBooking].sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
              }
            )

            const today = new Date()
            queryClient.setQueryData(
              ['displayed-bookings', restaurantId, today, 'all', 'all', 'today', 'upcoming'],
              (oldData: Booking[] | undefined) => {
                if (!oldData) return [newBooking]
                const exists = oldData.some(b => b.id === newBooking.id)
                if (exists) return oldData
                return [...oldData, newBooking].sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
              }
            )

            queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })

            const guestName = getFirstName(await resolveGuestName(newBooking))
            addNotification({
              type: 'booking',
              title: 'New Booking',
              message: `New booking from ${guestName} for ${newBooking.party_size} guests`,
              data: newBooking
            })
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'bookings',
            filter: `restaurant_id=eq.${restaurantId}`
          },
          async (payload) => {
            const updatedBooking = payload.new as Booking

            // Update query cache for global bookings
            queryClient.setQueryData(
              ['bookings', restaurantId],
              (oldData: { bookings: Booking[] } | undefined) => {
                if (!oldData) return { bookings: [updatedBooking] }
                return {
                  ...oldData,
                  bookings: oldData.bookings.map(booking =>
                    booking.id === updatedBooking.id ? updatedBooking : booking
                  )
                }
              }
            )

            queryClient.setQueryData(
              ['all-bookings', restaurantId],
              (oldData: Booking[] | undefined) => {
                if (!oldData) return [updatedBooking]
                return oldData.map(booking =>
                  booking.id === updatedBooking.id ? updatedBooking : booking
                ).sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
              }
            )

            const today = new Date()
            const commonFilters = [
              [restaurantId, today, 'all', 'all', 'today', 'upcoming'],
              [restaurantId, today, 'pending', 'all', 'today', 'upcoming'],
              [restaurantId, today, 'confirmed', 'all', 'today', 'upcoming'],
              [restaurantId, today, 'cancelled_by_user', 'all', 'today', 'upcoming'],
              [restaurantId, today, 'declined_by_restaurant', 'all', 'today', 'upcoming']
            ]

            commonFilters.forEach(filterKey => {
              queryClient.setQueryData(
                ['displayed-bookings', ...filterKey],
                (oldData: Booking[] | undefined) => {
                  if (!oldData) return [updatedBooking]
                  return oldData.map(booking =>
                    booking.id === updatedBooking.id ? updatedBooking : booking
                  ).sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
                }
              )
            })

            queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })

            // Stop alarm if booking is no longer pending.
            // NOTE: We don't rely on payload.old.status because the bookings table
            // uses DEFAULT replica identity (primary key only). Instead, we just
            // stop the alarm for this booking ID — stopAlarm is a no-op if the
            // booking wasn't in the pending set.
            if (updatedBooking.status !== 'pending') {
              bookingAlarmService.stopAlarm(updatedBooking.id)
            }

            // Detect status change by checking if the booking was in our alarm set
            // or by comparing old vs new (old may only have id with DEFAULT replica identity)
            const previousBooking = payload.old as Partial<Booking>
            const oldStatus = previousBooking.status
            const newStatus = updatedBooking.status as string
            // Only show notification if we can detect a status change
            if ((oldStatus && oldStatus !== newStatus) || (!oldStatus && newStatus !== 'pending')) {
              const guestName = getFirstName(await resolveGuestName(updatedBooking))
              const statusMap: Record<string, { title: string; message: string }> = {
                confirmed: { title: 'Booking Confirmed', message: `Booking for ${guestName} confirmed` },
                declined_by_restaurant: { title: 'Booking Declined', message: `Booking for ${guestName} declined by restaurant` },
                cancelled_by_user: { title: 'Booking Cancelled', message: `Booking for ${guestName} cancelled by customer` },
                cancelled_by_restaurant: { title: 'Booking Cancelled', message: `Booking for ${guestName} cancelled by restaurant` },
                arrived: { title: 'Guest Arrived', message: `${guestName} has checked in` },
                seated: { title: 'Guest Seated', message: `${guestName} has been seated` },
                completed: { title: 'Booking Completed', message: `${guestName}'s booking completed` },
                no_show: { title: 'No-show', message: `${guestName} marked as no-show` }
              }

              const statusInfo = statusMap[newStatus]
              if (statusInfo) {
                addNotification({
                  type: 'booking',
                  title: statusInfo.title,
                  message: statusInfo.message,
                  data: updatedBooking,
                  variant: ['cancelled_by_user', 'cancelled_by_restaurant', 'declined_by_restaurant'].includes(newStatus)
                    ? 'error'
                    : newStatus === 'confirmed'
                    ? 'success'
                    : undefined
                })
              }
            }
          }
        )
        .subscribe()

      channelRef.current = channel
    }

    setupChannel()

    // Synchronous cleanup — uses local closure variable to catch the race
    // where channel is created but not yet assigned to channelRef.current
    return () => {
      cancelled = true
      if (channel) {
        supabase.removeChannel(channel)
      }
      if (channelRef.current && channelRef.current !== channel) {
        supabase.removeChannel(channelRef.current)
      }
      channelRef.current = null
    }
  }, [pathname, searchParams, queryClient, addNotification])

  return {
    isConnected: channelRef.current?.state === 'joined'
  }
}
