import { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { Booking } from '@/types'
import { RealtimeChannel } from '@supabase/supabase-js'
import { emitRealtimeTelemetry } from '@/lib/realtime-telemetry'

 

interface UseRealtimeBookingsOptions {
  restaurantId: string
  onBookingCreated?: (booking: Booking) => void
  onBookingUpdated?: (booking: Booking, previousBooking?: Booking) => void
  onBookingDeleted?: (bookingId: string) => void
  enableToasts?: boolean
  enableSound?: boolean
}

interface RealtimeBookingsState {
  isConnected: boolean
  lastUpdate: Date | null
  connectionErrors: number
}

export function useRealtimeBookings(options: UseRealtimeBookingsOptions) {
  const {
    restaurantId,
    onBookingCreated,
    onBookingUpdated,
    onBookingDeleted,
    enableToasts = false
  } = options

  const supabase = createClient()
  const queryClient = useQueryClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryAttemptRef = useRef(0)
  const subscriptionGenerationRef = useRef(0)
  const dedupeWindowRef = useRef<Map<string, number>>(new Map())
  const callbacksRef = useRef({
    onBookingCreated,
    onBookingUpdated,
    onBookingDeleted
  })

  useEffect(() => {
    callbacksRef.current = {
      onBookingCreated,
      onBookingUpdated,
      onBookingDeleted
    }
  }, [onBookingCreated, onBookingUpdated, onBookingDeleted])

  const isDuplicateEvent = useCallback((payload: any): boolean => {
    const record = payload?.new || payload?.old || {}
    const eventType = String(payload?.eventType || 'UNKNOWN')
    const id = String(record?.id || 'unknown-id')
    const commitTimestamp = String(payload?.commit_timestamp || payload?.commitTimestamp || '')
    const key = `${eventType}:${id}:${commitTimestamp}`
    const now = Date.now()
    const DEDUPE_WINDOW_MS = 45000

    const previous = dedupeWindowRef.current.get(key)
    dedupeWindowRef.current.set(key, now)

    if (dedupeWindowRef.current.size > 400) {
      for (const [existingKey, ts] of dedupeWindowRef.current.entries()) {
        if (now - ts > DEDUPE_WINDOW_MS) {
          dedupeWindowRef.current.delete(existingKey)
        }
      }
    }

    if (previous && now - previous < DEDUPE_WINDOW_MS) {
      emitRealtimeTelemetry({
        type: 'duplicate_event_ignored',
        source: 'use-realtime-bookings',
        channel: `bookings:restaurant:${restaurantId}`,
        restaurantId,
        level: 'warn',
        details: { key }
      })
      return true
    }

    return false
  }, [restaurantId])

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  const teardownChannel = useCallback(() => {
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [supabase])

  const scheduleReconnect = useCallback((status: string) => {
    retryAttemptRef.current += 1
    const delay = Math.min(1000 * Math.pow(2, retryAttemptRef.current - 1), 30000)

    emitRealtimeTelemetry({
      type: 'subscription_dropped',
      source: 'use-realtime-bookings',
      channel: `bookings:restaurant:${restaurantId}`,
      restaurantId,
      status,
      level: 'warn',
      details: {
        retryAttempt: retryAttemptRef.current,
        reconnectInMs: delay
      }
    })

    setState(prev => ({
      ...prev,
      isConnected: false,
      connectionErrors: prev.connectionErrors + 1
    }))

    clearReconnectTimeout()
    reconnectTimeoutRef.current = setTimeout(() => {
      setupSubscription()
    }, delay)
  }, [clearReconnectTimeout, restaurantId])

  const setupSubscription = useCallback(() => {
    if (!restaurantId) {
      return
    }

    teardownChannel()
    const generation = ++subscriptionGenerationRef.current
    const channelName = `bookings:restaurant:${restaurantId}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings'
        },
        (payload) => {
          if (generation !== subscriptionGenerationRef.current || isDuplicateEvent(payload)) {
            return
          }

          const newBooking = payload.new as Booking
          if (!newBooking || newBooking.restaurant_id !== restaurantId) return

          queryClient.setQueryData(
            ['bookings', restaurantId],
            (oldData: { bookings: Booking[] } | undefined) => {
              if (!oldData) return { bookings: [newBooking] }

              const exists = oldData.bookings.some(booking => booking.id === newBooking.id)
              if (exists) {
                emitRealtimeTelemetry({
                  type: 'stale_update_ignored',
                  source: 'use-realtime-bookings',
                  channel: channelName,
                  restaurantId,
                  level: 'warn',
                  details: { bookingId: newBooking.id, eventType: 'INSERT' }
                })
                return oldData
              }

              return {
                ...oldData,
                bookings: [newBooking, ...oldData.bookings]
              }
            }
          )

          callbacksRef.current.onBookingCreated?.(newBooking)

          setState(prev => ({
            ...prev,
            lastUpdate: new Date()
          }))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings'
        },
        (payload) => {
          if (generation !== subscriptionGenerationRef.current || isDuplicateEvent(payload)) {
            return
          }

          const updatedBooking = payload.new as Booking
          if (!updatedBooking || updatedBooking.restaurant_id !== restaurantId) return
          const previousBooking = payload.old as Booking

          queryClient.setQueryData(
            ['bookings', restaurantId],
            (oldData: { bookings: Booking[] } | undefined) => {
              if (!oldData) return { bookings: [updatedBooking] }

              const exists = oldData.bookings.some(booking => booking.id === updatedBooking.id)
              if (!exists) {
                return {
                  ...oldData,
                  bookings: [updatedBooking, ...oldData.bookings]
                }
              }

              return {
                ...oldData,
                bookings: oldData.bookings.map(booking =>
                  booking.id === updatedBooking.id ? updatedBooking : booking
                )
              }
            }
          )

          callbacksRef.current.onBookingUpdated?.(updatedBooking, previousBooking)

          setState(prev => ({
            ...prev,
            lastUpdate: new Date()
          }))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'bookings'
        },
        (payload) => {
          if (generation !== subscriptionGenerationRef.current || isDuplicateEvent(payload)) {
            return
          }

          const deleted = payload.old as Booking
          if (!deleted || deleted.restaurant_id !== restaurantId) return
          const deletedBookingId = deleted.id as string

          queryClient.setQueryData(
            ['bookings', restaurantId],
            (oldData: { bookings: Booking[] } | undefined) => {
              if (!oldData) return { bookings: [] }

              const exists = oldData.bookings.some(booking => booking.id === deletedBookingId)
              if (!exists) {
                emitRealtimeTelemetry({
                  type: 'stale_update_ignored',
                  source: 'use-realtime-bookings',
                  channel: channelName,
                  restaurantId,
                  level: 'warn',
                  details: { bookingId: deletedBookingId, eventType: 'DELETE' }
                })
                return oldData
              }

              return {
                ...oldData,
                bookings: oldData.bookings.filter(booking => booking.id !== deletedBookingId)
              }
            }
          )

          callbacksRef.current.onBookingDeleted?.(deletedBookingId)

          if (enableToasts) {
            toast.error('Booking deleted', {
              duration: 3000,
              position: 'top-right'
            })
          }

          setState(prev => ({
            ...prev,
            lastUpdate: new Date()
          }))
        }
      )
      .subscribe((status) => {
        if (generation !== subscriptionGenerationRef.current) {
          return
        }

        emitRealtimeTelemetry({
          type: 'subscription_status',
          source: 'use-realtime-bookings',
          channel: channelName,
          restaurantId,
          status,
          level: status === 'SUBSCRIBED' ? 'info' : 'warn'
        })

        if (status === 'SUBSCRIBED') {
          retryAttemptRef.current = 0
          clearReconnectTimeout()
          setState(prev => ({
            ...prev,
            isConnected: true
          }))
          return
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          scheduleReconnect(status)
        }
      })

    channelRef.current = channel
  }, [
    clearReconnectTimeout,
    enableToasts,
    isDuplicateEvent,
    queryClient,
    restaurantId,
    scheduleReconnect,
    supabase,
    teardownChannel
  ])
  
  const [state, setState] = useState<RealtimeBookingsState>({
    isConnected: false,
    lastUpdate: null,
    connectionErrors: 0
  })

  useEffect(() => {
    if (!restaurantId) {
      return
    }

    setupSubscription()

    // Cleanup function
    return () => {
      subscriptionGenerationRef.current += 1
      clearReconnectTimeout()
      teardownChannel()
      
      setState(prev => ({
        ...prev,
        isConnected: false
      }))
    }
  }, [clearReconnectTimeout, restaurantId, setupSubscription, teardownChannel])

  // Method to manually reconnect
  const reconnect = () => {
    retryAttemptRef.current = 0
    clearReconnectTimeout()
    setupSubscription()
    
    setState(prev => ({
      ...prev,
      connectionErrors: 0
    }))
  }

  // Method to check connection status
  const getConnectionStatus = () => ({
    ...state,
    channelState: channelRef.current?.state || 'closed'
  })

  return {
    ...state,
    reconnect,
    getConnectionStatus
  }
}

// Helper hook for booking status changes specifically
export function useBookingStatusUpdates(
  restaurantId: string,
  onStatusChange?: (booking: Booking, previousStatus: string) => void
) {
  return useRealtimeBookings({
    restaurantId,
    onBookingUpdated: (updatedBooking, previousBooking) => {
      if (previousBooking && previousBooking.status !== updatedBooking.status) {
        onStatusChange?.(updatedBooking, previousBooking.status)
      }
    },
    enableToasts: false // Let the parent component handle toasts
  })
}

// Helper hook for urgent booking notifications
export function useUrgentBookingNotifications(
  restaurantId: string,
  urgentStatuses: string[] = ['pending', 'arrived', 'no_show']
) {
  const [urgentCount, setUrgentCount] = useState(0)
  
  const { isConnected } = useRealtimeBookings({
    restaurantId,
    onBookingCreated: (booking) => {
      if (urgentStatuses.includes(booking.status)) {
        setUrgentCount(prev => prev + 1)
      }
    },
    onBookingUpdated: (updatedBooking, previousBooking) => {
      const wasUrgent = previousBooking && urgentStatuses.includes(previousBooking.status)
      const isUrgent = urgentStatuses.includes(updatedBooking.status)
      
      if (isUrgent && !wasUrgent) {
        setUrgentCount(prev => prev + 1)
      } else if (!isUrgent && wasUrgent) {
        setUrgentCount(prev => Math.max(0, prev - 1))
      }
    },
    enableToasts: true,
    enableSound: true
  })

  const clearUrgentCount = () => setUrgentCount(0)

  return {
    urgentCount,
    isConnected,
    clearUrgentCount
  }
}
