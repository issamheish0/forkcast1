// hooks/use-shared-tables.ts
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { useRealtimeHealth } from "./use-realtime-health"
import { useAdaptiveBookingConfig } from "./use-adaptive-refetch"
import type { SharedTableSummary, SharedTableAvailability, SharedTableBooking, RestaurantTable } from "@/types"

export function useSharedTablesSummary(restaurantId: string, date?: Date) {
  const supabase = createClient()
  const targetDate = date || new Date()
  const { healthStatus } = useRealtimeHealth()
  const adaptiveConfig = useAdaptiveBookingConfig(healthStatus)

  return useQuery({
    queryKey: ["shared-tables-summary", restaurantId, targetDate.toISOString().split('T')[0]],
    queryFn: async (): Promise<SharedTableSummary[]> => {
      if (!restaurantId) return []

      const { data, error } = await supabase.rpc("get_restaurant_shared_tables_summary", {
        restaurant_id_param: restaurantId,
        target_date: targetDate.toISOString().split('T')[0]
      })

      if (error) {
        console.error("Error fetching shared tables summary:", error)
        throw new Error("Failed to load shared tables")
      }

      return data || []
    },
    enabled: !!restaurantId,
    refetchInterval: adaptiveConfig.refetchInterval,
    staleTime: adaptiveConfig.staleTime,
  })
}

export function useSharedTableAvailability(tableId: string, date?: Date, time?: string) {
  const supabase = createClient()
  const bookingDateTime = time && date 
    ? new Date(`${date.toISOString().split('T')[0]}T${time}:00`)
    : date || new Date()
  const { healthStatus } = useRealtimeHealth()
  const adaptiveConfig = useAdaptiveBookingConfig(healthStatus)

  return useQuery({
    queryKey: ["shared-table-availability", tableId, bookingDateTime.toISOString()],
    queryFn: async (): Promise<SharedTableAvailability | null> => {
      if (!tableId) return null

      // Get table info
      const { data: table, error: tableError } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("id", tableId)
        .eq("table_type", "shared")
        .single()

      if (tableError || !table) {
        throw new Error("Table not found or not a shared table")
      }

      // Get available seats
      const { data: availableSeats, error: availabilityError } = await supabase.rpc(
        "get_shared_table_available_seats",
        {
          table_id_param: tableId,
          booking_time_param: bookingDateTime.toISOString(),
          turn_time_minutes_param: 120,
        }
      )

      if (availabilityError) {
        console.error("Error fetching shared table availability:", availabilityError)
        throw new Error("Failed to load table availability")
      }

      // Get current bookings
      const { data: currentBookings, error: bookingsError } = await supabase
        .from("bookings")
        .select(`
          id,
          user_id,
          party_size,
          booking_time,
          status,
          special_requests,
          checked_in_at,
          guest_name,
          profiles!bookings_user_id_fkey (
            full_name,
            privacy_settings
          ),
          booking_tables!inner (
            seats_occupied,
            table_id
          )
        `)
        .eq("booking_tables.table_id", tableId)
        .eq("is_shared_booking", true)
        .in("status", ["pending", "confirmed", "arrived", "seated"])
        .gte("booking_time", date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0])

      if (bookingsError) {
        console.error("Error fetching current bookings:", bookingsError)
      }

      const currentBookingsList: SharedTableBooking[] = (currentBookings || []).map((booking: any) => {
        const privacySettings = booking.profiles?.privacy_settings || {}
        const profileVisibility = privacySettings.profile_visibility || "private"
        const activitySharing = privacySettings.activity_sharing ?? false
        
        return {
          booking_id: booking.id,
          user_id: booking.user_id,
          user_name: profileVisibility === "public" 
            ? (booking.profiles?.full_name || "Guest")
            : "Guest",
          guest_name: booking.guest_name,
          party_size: booking.party_size,
          seats_occupied: booking.booking_tables[0]?.seats_occupied || booking.party_size,
          booking_time: booking.booking_time,
          status: booking.status,
          special_requests: booking.special_requests,
          is_social: activitySharing,
          checked_in_at: booking.checked_in_at,
        }
      })

      const occupiedSeats = currentBookingsList.reduce(
        (sum, booking) => sum + booking.seats_occupied,
        0
      )

      return {
        table_id: tableId,
        table: table as RestaurantTable,
        total_seats: table.capacity,
        available_seats: Math.max(0, availableSeats || 0),
        occupied_seats: occupiedSeats,
        current_bookings: currentBookingsList,
      }
    },
    enabled: !!tableId,
    refetchInterval: adaptiveConfig.refetchInterval,
    staleTime: adaptiveConfig.staleTime,
  })
}

export function useSharedTableBookings(restaurantId: string, date?: Date) {
  const supabase = createClient()
  const targetDate = date || new Date()
  const { healthStatus } = useRealtimeHealth()
  const adaptiveConfig = useAdaptiveBookingConfig(healthStatus)

  return useQuery({
    queryKey: ["shared-table-bookings", restaurantId, targetDate.toISOString().split('T')[0]],
    queryFn: async () => {
      if (!restaurantId) return []

      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          profiles!bookings_user_id_fkey (
            full_name,
            privacy_settings
          ),
          booking_tables!inner (
            seats_occupied,
            restaurant_tables (
              table_number,
              table_type,
              capacity
            )
          )
        `)
        .eq("restaurant_id", restaurantId)
        .neq("status", "payment_pending")
        .eq("is_shared_booking", true)
        .gte("booking_time", targetDate.toISOString().split('T')[0])
        .lt("booking_time", new Date(targetDate.getTime() + 24 * 60 * 60 * 1000).toISOString())
        .order("booking_time", { ascending: true })
        .limit(100)

      if (error) {
        throw error
      }

      return data || []
    },
    enabled: !!restaurantId,
    refetchInterval: adaptiveConfig.refetchInterval,
    staleTime: adaptiveConfig.staleTime,
  })
}

export function useUpdateBookingStatus(restaurantId: string) {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ bookingId, status, reason }: {
      bookingId: string
      status: string
      reason?: string
    }) => {
      // Fetch current status before update for accurate history logging
      const { data: currentBooking, error: fetchError } = await supabase
        .from("bookings")
        .select("status")
        .eq("id", bookingId)
        .single()

      if (fetchError) throw fetchError
      const oldStatus = currentBooking.status

      const { data, error } = await supabase
        .from("bookings")
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq("id", bookingId)
        .select()
        .single()

      if (error) throw error

      // Log status change
      await supabase.from("booking_status_history").insert({
        booking_id: bookingId,
        old_status: oldStatus,
        new_status: status,
        reason: reason || `Status updated by restaurant staff`,
        changed_by: (await supabase.auth.getUser()).data.user?.id,
      })

      return data
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ 
        queryKey: ["shared-tables-summary", restaurantId] 
      })
      queryClient.invalidateQueries({ 
        queryKey: ["shared-table-bookings", restaurantId] 
      })
      queryClient.invalidateQueries({ 
        queryKey: ["shared-table-availability"] 
      })
    },
  })
}

export function useSharedTableStats(restaurantId: string, days: number = 7) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["shared-table-stats", restaurantId, days],
    queryFn: async () => {
      if (!restaurantId) return null

      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      // Get shared table bookings for the period
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select(`
          id,
          booking_time,
          party_size,
          status,
          booking_tables!inner (
            seats_occupied,
            restaurant_tables!inner (
              table_type,
              capacity
            )
          )
        `)
        .eq("restaurant_id", restaurantId)
        .neq("status", "payment_pending")
        .eq("is_shared_booking", true)
        .eq("booking_tables.restaurant_tables.table_type", "shared")
        .gte("booking_time", startDate.toISOString())
        .order("booking_time", { ascending: true })

      if (error) throw error

      const stats = {
        total_bookings: bookings?.length || 0,
        completed_bookings: bookings?.filter(b => b.status === 'completed').length || 0,
        total_guests: bookings?.reduce((sum, b) => sum + b.party_size, 0) || 0,
        average_party_size: 0,
        peak_hours: {} as Record<string, number>,
        daily_bookings: {} as Record<string, number>,
        occupancy_rate: 0,
      }

      if (stats.total_bookings > 0) {
        stats.average_party_size = stats.total_guests / stats.total_bookings

        // Calculate peak hours
        bookings?.forEach(booking => {
          const hour = new Date(booking.booking_time).getHours()
          stats.peak_hours[hour] = (stats.peak_hours[hour] || 0) + 1
        })

        // Calculate daily bookings
        bookings?.forEach(booking => {
          const date = booking.booking_time.split('T')[0]
          stats.daily_bookings[date] = (stats.daily_bookings[date] || 0) + 1
        })

        // Calculate approximate occupancy rate
        const totalPossibleSeats = bookings?.reduce((sum, b) => {
          const table = b.booking_tables[0]?.restaurant_tables as any
          return sum + (table?.capacity || 0)
        }, 0) || 0
        
        const totalUsedSeats = bookings?.reduce((sum, b) => {
          return sum + (b.booking_tables[0]?.seats_occupied || 0)
        }, 0) || 0

        stats.occupancy_rate = totalPossibleSeats > 0 ? (totalUsedSeats / totalPossibleSeats) * 100 : 0
      }

      return stats
    },
    enabled: !!restaurantId,
  })
}

export function useCreateSharedTable() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      restaurantId,
      tableNumber,
      capacity,
      sectionId,
      features,
      xPosition,
      yPosition,
      width,
      height,
      shape
    }: {
      restaurantId: string
      tableNumber: string
      capacity: number
      sectionId?: string
      features?: string[]
      xPosition?: number
      yPosition?: number
      width?: number
      height?: number
      shape?: 'rectangle' | 'circle' | 'square'
    }) => {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .insert({
          restaurant_id: restaurantId,
          table_number: tableNumber,
          table_type: "shared",
          capacity,
          section_id: sectionId,
          features: features || [],
          x_position: xPosition || 50,
          y_position: yPosition || 50,
          width: width || 120,
          height: height || 80,
          shape: shape || 'rectangle',
          min_capacity: 1,
          max_capacity: capacity,
          is_active: true,
          is_combinable: false
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data, variables) => {
      // Invalidate shared table specific queries
      queryClient.invalidateQueries({ queryKey: ["shared-tables-summary", variables.restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-tables", variables.restaurantId] })

      // Invalidate main tables page queries to refresh floor plan and other views
      queryClient.invalidateQueries({ queryKey: ["tables-with-sections", variables.restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections-with-counts", variables.restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections-active", variables.restaurantId] })

      toast.success(`Shared table ${variables.tableNumber} created successfully`)
    },
    onError: (error: any) => {
      console.error("Error creating shared table:", error)
      toast.error("Failed to create shared table")
    },
  })
}
