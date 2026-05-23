import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { RestaurantTable, Booking } from '@/types'
import { RealtimeChannel } from '@supabase/supabase-js'
import { emitRealtimeTelemetry } from '@/lib/realtime-telemetry'

interface UseRealtimeTablesOptions {
  restaurantId: string
  onTableUpdated?: (table: RestaurantTable) => void
  onTableOccupancyChanged?: (tableId: string, isOccupied: boolean, booking?: Booking) => void
}

interface TableStatus {
  id: string
  table_number: string
  is_occupied: boolean
  current_booking?: Booking
  next_booking?: Booking
  last_updated: Date
}

interface RealtimeTablesState {
  isConnected: boolean
  tableStatuses: Record<string, TableStatus>
  lastUpdate: Date | null
}

export function useRealtimeTables(options: UseRealtimeTablesOptions) {
  const { restaurantId, onTableUpdated, onTableOccupancyChanged } = options
  
  const supabase = createClient()
  const queryClient = useQueryClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryAttemptRef = useRef(0)
  const subscriptionGenerationRef = useRef(0)
  const dedupeWindowRef = useRef<Map<string, number>>(new Map())
  const tableUpdateVersionRef = useRef<Map<string, number>>(new Map())
  
  const [state, setState] = useState<RealtimeTablesState>({
    isConnected: false,
    tableStatuses: {},
    lastUpdate: null
  })

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

  const isDuplicateEvent = useCallback((payload: any): boolean => {
    const record = payload?.new || payload?.old || {}
    const eventType = String(payload?.eventType || 'UNKNOWN')
    const id = String(record?.id || record?.table_id || record?.booking_id || 'unknown-id')
    const commitTimestamp = String(payload?.commit_timestamp || payload?.commitTimestamp || '')
    const key = `${eventType}:${id}:${commitTimestamp}`
    const now = Date.now()
    const DEDUPE_WINDOW_MS = 45000

    const previous = dedupeWindowRef.current.get(key)
    dedupeWindowRef.current.set(key, now)

    if (dedupeWindowRef.current.size > 500) {
      for (const [existingKey, ts] of dedupeWindowRef.current.entries()) {
        if (now - ts > DEDUPE_WINDOW_MS) {
          dedupeWindowRef.current.delete(existingKey)
        }
      }
    }

    if (previous && now - previous < DEDUPE_WINDOW_MS) {
      emitRealtimeTelemetry({
        type: 'duplicate_event_ignored',
        source: 'use-realtime-tables',
        channel: `table-status:restaurant:${restaurantId}`,
        restaurantId,
        level: 'warn',
        details: { key }
      })
      return true
    }

    return false
  }, [restaurantId])

  // Helper function to determine if a table is occupied
  const isTableOccupied = useCallback(async (tableId: string): Promise<{
    isOccupied: boolean
    currentBooking?: Booking
    nextBooking?: Booking
  }> => {
    const now = new Date()
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
    const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000)
    
    // Check for current and upcoming bookings for this table
    const { data: bookings } = await supabase
      .from('bookings')
      .select(`
        *,
        profiles!bookings_user_id_fkey(
          id,
          full_name,
          phone_number
        ),
        booking_tables!inner(
          table_id
        )
      `)
      .eq('booking_tables.table_id', tableId)
      .in('status', ['confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert'])
      .gte('booking_time', twoHoursAgo.toISOString())
      .lte('booking_time', fourHoursFromNow.toISOString())
      .order('booking_time', { ascending: true })
    
    if (!bookings || bookings.length === 0) {
      return { isOccupied: false }
    }
    
    // Find current booking (should be within service window)
    const currentBooking = bookings.find(booking => {
      const bookingTime = new Date(booking.booking_time)
      const estimatedEndTime = new Date(bookingTime.getTime() + booking.turn_time_minutes * 60 * 1000)
      
      return bookingTime <= now && estimatedEndTime >= now && 
             ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert'].includes(booking.status)
    })
    
    // Find next booking
    const nextBooking = bookings.find(booking => 
      new Date(booking.booking_time) > now && booking.status === 'confirmed'
    )
    
    return {
      isOccupied: !!currentBooking,
      currentBooking,
      nextBooking
    }
  }, [supabase])

  // Update table status
  const updateTableStatus = useCallback(async (tableId: string) => {
    try {
      const nextVersion = (tableUpdateVersionRef.current.get(tableId) || 0) + 1
      tableUpdateVersionRef.current.set(tableId, nextVersion)

      const { isOccupied, currentBooking, nextBooking } = await isTableOccupied(tableId)
      if (tableUpdateVersionRef.current.get(tableId) !== nextVersion) {
        emitRealtimeTelemetry({
          type: 'stale_update_ignored',
          source: 'use-realtime-tables',
          channel: `table-status:restaurant:${restaurantId}`,
          restaurantId,
          level: 'warn',
          details: { tableId, phase: 'occupancy' }
        })
        return
      }
      
      // Get table info
      const { data: table } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('id', tableId)
        .single()

      if (tableUpdateVersionRef.current.get(tableId) !== nextVersion) {
        emitRealtimeTelemetry({
          type: 'stale_update_ignored',
          source: 'use-realtime-tables',
          channel: `table-status:restaurant:${restaurantId}`,
          restaurantId,
          level: 'warn',
          details: { tableId, phase: 'table-info' }
        })
        return
      }
      
      if (!table) return
      
      const newStatus: TableStatus = {
        id: tableId,
        table_number: table.table_number,
        is_occupied: isOccupied,
        current_booking: currentBooking,
        next_booking: nextBooking,
        last_updated: new Date()
      }
      
      setState(prev => {
        const wasOccupied = prev.tableStatuses[tableId]?.is_occupied || false
        
        // Trigger callback if occupancy changed
        if (wasOccupied !== isOccupied) {
          onTableOccupancyChanged?.(tableId, isOccupied, currentBooking)
        }
        
        return {
          ...prev,
          tableStatuses: {
            ...prev.tableStatuses,
            [tableId]: newStatus
          },
          lastUpdate: new Date()
        }
      })
      
      // Update React Query cache
      queryClient.setQueryData(['table-status', restaurantId], (oldData: any) => {
        if (!oldData) return { [tableId]: newStatus }
        return {
          ...oldData,
          [tableId]: newStatus
        }
      })
      
    } catch (error) {
      console.error('Error updating table status:', error)
    }
  }, [isTableOccupied, onTableOccupancyChanged, queryClient, restaurantId, supabase])

  const scheduleReconnect = useCallback((status: string) => {
    retryAttemptRef.current += 1
    const delay = Math.min(1000 * Math.pow(2, retryAttemptRef.current - 1), 30000)

    emitRealtimeTelemetry({
      type: 'subscription_dropped',
      source: 'use-realtime-tables',
      channel: `table-status:restaurant:${restaurantId}`,
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
      isConnected: false
    }))

    clearReconnectTimeout()
    reconnectTimeoutRef.current = setTimeout(() => {
      setupSubscription()
    }, delay)
  }, [clearReconnectTimeout, restaurantId])

  const loadInitialTableStatuses = useCallback(async () => {
    try {
      const { data: tables } = await supabase
        .from('restaurant_tables')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)

      if (tables) {
        for (const table of tables) {
          await updateTableStatus(table.id)
        }
      }
    } catch (error) {
      console.error('Error loading initial table statuses:', error)
    }
  }, [restaurantId, supabase, updateTableStatus])

  const setupSubscription = useCallback(() => {
    if (!restaurantId) {
      return
    }

    teardownChannel()
    const generation = ++subscriptionGenerationRef.current
    const channelName = `table-status:restaurant:${restaurantId}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        async (payload) => {
          if (generation !== subscriptionGenerationRef.current || isDuplicateEvent(payload)) {
            return
          }

          const booking = (payload.new || payload.old) as any
          if (!booking?.id) return

          const { data: bookingTables } = await supabase
            .from('booking_tables')
            .select('table_id')
            .eq('booking_id', booking.id)

          if (bookingTables) {
            await Promise.all(bookingTables.map(bt => updateTableStatus(bt.table_id)))
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_tables'
        },
        async (payload) => {
          if (generation !== subscriptionGenerationRef.current || isDuplicateEvent(payload)) {
            return
          }

          const assignment = (payload.new || payload.old) as any
          if (!assignment?.table_id || !assignment?.booking_id) return

          const { data: booking } = await supabase
            .from('bookings')
            .select('restaurant_id')
            .eq('id', assignment.booking_id)
            .maybeSingle()

          if (!booking || booking.restaurant_id !== restaurantId) {
            return
          }

          await updateTableStatus(assignment.table_id)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_tables',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        async (payload) => {
          if (generation !== subscriptionGenerationRef.current || isDuplicateEvent(payload)) {
            return
          }

          const table = (payload.new || payload.old) as any
          if (!table?.id) return

          if (payload.new) {
            onTableUpdated?.(payload.new as RestaurantTable)
          }

          await updateTableStatus(table.id)
          void queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] })
        }
      )
      .subscribe((status) => {
        if (generation !== subscriptionGenerationRef.current) {
          return
        }

        emitRealtimeTelemetry({
          type: 'subscription_status',
          source: 'use-realtime-tables',
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
    void loadInitialTableStatuses()
  }, [
    clearReconnectTimeout,
    isDuplicateEvent,
    loadInitialTableStatuses,
    onTableUpdated,
    queryClient,
    restaurantId,
    scheduleReconnect,
    supabase,
    teardownChannel,
    updateTableStatus
  ])

  useEffect(() => {
    if (!restaurantId) {
      return
    }

    setupSubscription()

    // Cleanup
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

  // Get status for a specific table
  const getTableStatus = (tableId: string): TableStatus | null => {
    return state.tableStatuses[tableId] || null
  }

  // Get all occupied tables
  const getOccupiedTables = (): TableStatus[] => {
    return Object.values(state.tableStatuses).filter(status => status.is_occupied)
  }

  // Get available tables
  const getAvailableTables = (): TableStatus[] => {
    return Object.values(state.tableStatuses).filter(status => !status.is_occupied)
  }

  // Get tables with upcoming reservations
  const getTablesWithUpcomingBookings = (): TableStatus[] => {
    return Object.values(state.tableStatuses).filter(status => status.next_booking)
  }

  // Manual refresh of all table statuses
  const refreshAllTableStatuses = async () => {
    const { data: tables } = await supabase
      .from('restaurant_tables')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
    
    if (tables) {
      const promises = tables.map(table => updateTableStatus(table.id))
      await Promise.all(promises)
    }
  }

  return {
    ...state,
    getTableStatus,
    getOccupiedTables,
    getAvailableTables,
    getTablesWithUpcomingBookings,
    refreshAllTableStatuses,
    totalTables: Object.keys(state.tableStatuses).length,
    occupiedCount: Object.values(state.tableStatuses).filter(s => s.is_occupied).length,
    availableCount: Object.values(state.tableStatuses).filter(s => !s.is_occupied).length
  }
}

// Simplified hook for just getting table occupancy counts
export function useTableOccupancyCount(restaurantId: string) {
  const { occupiedCount, availableCount, totalTables, isConnected } = useRealtimeTables({
    restaurantId
  })

  return {
    occupiedCount,
    availableCount, 
    totalTables,
    isConnected,
    occupancyRate: totalTables > 0 ? (occupiedCount / totalTables) * 100 : 0
  }
}
