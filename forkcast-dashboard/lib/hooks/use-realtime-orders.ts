// lib/hooks/use-realtime-orders.ts
"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { toast } from "react-hot-toast"

const supabase = createClient()

/**
 * Real-time subscription hook for orders
 * Provides live updates for kitchen displays and order management
 */
export function useRealtimeOrders(restaurantId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!restaurantId) return

    console.log('🔄 Setting up real-time orders subscription for restaurant:', restaurantId)

    // Create subscription channel
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        (payload) => {
          console.log('📦 Order update received:', payload)
          
          // Invalidate all order-related queries
          queryClient.invalidateQueries({ queryKey: ['orders'] })
          queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] })
          
          // Show notification for new orders
          if (payload.eventType === 'INSERT') {
            toast.success('New order received!')
          }
          
          // Update specific order if available
          if (payload.new && 'id' in payload.new && payload.new.id) {
            queryClient.invalidateQueries({ queryKey: ['order', payload.new.id] })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items'
        },
        (payload) => {
          console.log('🍽️ Order items update:', payload)
          
          // Invalidate orders when items change
          queryClient.invalidateQueries({ queryKey: ['orders'] })
          queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] })
          
          if (payload.new && 'order_id' in payload.new && payload.new.order_id) {
            queryClient.invalidateQueries({ queryKey: ['order', payload.new.order_id] })
          }
        }
      )
      .subscribe((status) => {
        console.log('🔗 Orders subscription status:', status)
        
        if (status === 'SUBSCRIBED') {
          toast.success('🔄 Real-time orders connected')
        } else if (status === 'CHANNEL_ERROR') {
          toast.error('❌ Real-time connection error')
        }
      })

    // Cleanup subscription
    return () => {
      console.log('🔌 Cleaning up orders subscription')
      supabase.removeChannel(channel)
    }
  }, [restaurantId, queryClient])

  return { connected: true }
}

/**
 * Real-time subscription hook for bookings
 * Provides live updates for booking management
 */
export function useRealtimeBookings(restaurantId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!restaurantId) return

    console.log('🔄 Setting up real-time bookings subscription for restaurant:', restaurantId)

    const channel = supabase
      .channel('bookings-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        (payload) => {
          console.log('📅 Booking update received:', payload)
          
          // Invalidate booking queries
          queryClient.invalidateQueries({ queryKey: ['bookings'] })
          
          // Show notifications for booking changes
          if (payload.eventType === 'INSERT') {
            toast.success('📅 New booking received!')
          } else if (payload.eventType === 'UPDATE' && payload.new?.status) {
            const status = payload.new.status
            if (status === 'confirmed') {
              toast.success('✅ Booking confirmed')
            } else if (status === 'arrived') {
              toast('👋 Guest has arrived', { icon: '👋' })
            }
          }
          
          if (payload.new && 'id' in payload.new && payload.new.id) {
            queryClient.invalidateQueries({ queryKey: ['booking', payload.new.id] })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_status_history'
        },
        (payload) => {
          console.log('📋 Booking status history update:', payload)
          
          queryClient.invalidateQueries({ queryKey: ['bookings'] })
          
          if (payload.new && 'booking_id' in payload.new && payload.new.booking_id) {
            queryClient.invalidateQueries({ queryKey: ['booking', payload.new.booking_id] })
          }
        }
      )
      .subscribe((status) => {
        console.log('🔗 Bookings subscription status:', status)
      })

    return () => {
      console.log('🔌 Cleaning up bookings subscription')
      supabase.removeChannel(channel)
    }
  }, [restaurantId, queryClient])

  return { connected: true }
}

/**
 * Real-time subscription hook for table status
 * Provides live updates for table management
 */
export function useRealtimeTables(restaurantId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!restaurantId) return

    console.log('🔄 Setting up real-time tables subscription for restaurant:', restaurantId)

    const channel = supabase
      .channel('tables-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_tables',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        (payload) => {
          console.log('🪑 Table update received:', payload)
          
          // Invalidate table-related queries
          queryClient.invalidateQueries({ queryKey: ['tables'] })
          queryClient.invalidateQueries({ queryKey: ['table-statuses'] })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_tables'
        },
        (payload) => {
          console.log('🔗 Table assignment update:', payload)
          
          queryClient.invalidateQueries({ queryKey: ['tables'] })
          queryClient.invalidateQueries({ queryKey: ['table-statuses'] })
          queryClient.invalidateQueries({ queryKey: ['bookings'] })
        }
      )
      .subscribe((status) => {
        console.log('🔗 Tables subscription status:', status)
      })

    return () => {
      console.log('🔌 Cleaning up tables subscription')
      supabase.removeChannel(channel)
    }
  }, [restaurantId, queryClient])

  return { connected: true }
}
