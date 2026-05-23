// hooks/use-table-booking-rules.ts — CRUD hooks for table booking rules
"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { toast } from "react-hot-toast"
import type { TableBookingRule, TableBookingCondition } from "@/types"

/**
 * Fetch all booking rules for a specific table
 */
export function useTableBookingRules(tableId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["table-booking-rules", tableId],
    queryFn: async (): Promise<TableBookingRule[]> => {
      if (!tableId) return []

      const { data, error } = await supabase
        .from("table_booking_rules")
        .select("*")
        .eq("table_id", tableId)
        .order("priority", { ascending: false })

      if (error) throw error
      return data as TableBookingRule[]
    },
    enabled: !!tableId,
  })
}

/**
 * Fetch all booking rules for all tables in a restaurant
 */
export function useRestaurantBookingRules(restaurantId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["restaurant-booking-rules", restaurantId],
    queryFn: async (): Promise<TableBookingRule[]> => {
      if (!restaurantId) return []

      const { data, error } = await supabase
        .from("table_booking_rules")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("priority", { ascending: false })

      if (error) throw error
      return data as TableBookingRule[]
    },
    enabled: !!restaurantId,
  })
}

/**
 * Create a new booking rule
 */
export function useCreateBookingRule() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (rule: {
      table_id: string
      restaurant_id: string
      name: string
      booking_type: "instant" | "request"
      priority: number
      conditions: TableBookingCondition[]
    }) => {
      const { data, error } = await supabase
        .from("table_booking_rules")
        .insert({
          table_id: rule.table_id,
          restaurant_id: rule.restaurant_id,
          name: rule.name,
          booking_type: rule.booking_type,
          priority: rule.priority,
          conditions: rule.conditions as any,
          is_active: true,
        })
        .select()
        .single()

      if (error) throw error
      return data as TableBookingRule
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["table-booking-rules", data.table_id] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-booking-rules", data.restaurant_id] })
      toast.success("Booking rule created")
    },
    onError: () => {
      toast.error("Failed to create booking rule")
    },
  })
}

/**
 * Update an existing booking rule
 */
export function useUpdateBookingRule() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<TableBookingRule> & { id: string }) => {
      const { data, error } = await supabase
        .from("table_booking_rules")
        .update({
          ...updates,
          conditions: updates.conditions as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single()

      if (error) throw error
      return data as TableBookingRule
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["table-booking-rules", data.table_id] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-booking-rules", data.restaurant_id] })
      toast.success("Booking rule updated")
    },
    onError: () => {
      toast.error("Failed to update booking rule")
    },
  })
}

/**
 * Delete a booking rule
 */
export function useDeleteBookingRule() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, tableId, restaurantId }: { id: string; tableId: string; restaurantId: string }) => {
      const { error } = await supabase
        .from("table_booking_rules")
        .delete()
        .eq("id", id)

      if (error) throw error
      return { tableId, restaurantId }
    },
    onSuccess: ({ tableId, restaurantId }) => {
      queryClient.invalidateQueries({ queryKey: ["table-booking-rules", tableId] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-booking-rules", restaurantId] })
      toast.success("Booking rule deleted")
    },
    onError: () => {
      toast.error("Failed to delete booking rule")
    },
  })
}
