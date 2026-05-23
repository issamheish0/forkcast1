// lib/hooks/use-open-hours.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { RestaurantOpenHours, RestaurantStatus } from "@/types"
import { restaurantOpenHours, getRestaurantStatus } from "@/lib/restaurant-open-hours"
import { toast } from "react-hot-toast"

const supabase = createClient()

/**
 * Hook to fetch open hours for a restaurant
 */
export function useOpenHours(restaurantId: string, enabled = true) {
  return useQuery({
    queryKey: ["open-hours", restaurantId],
    queryFn: async (): Promise<RestaurantOpenHours[]> => {
      if (!restaurantId) return []

      const { data, error } = await supabase
        .from("restaurant_open_hours")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("day_of_week")
        .order("open_time")

      if (error) {
        console.error("Error fetching open hours:", error)
        throw error
      }

      return data || []
    },
    enabled: enabled && !!restaurantId,
  })
}

/**
 * Hook to get open hours grouped by day of week
 */
export function useGroupedOpenHours(restaurantId: string, enabled = true) {
  return useQuery({
    queryKey: ["grouped-open-hours", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return {}
      return await restaurantOpenHours.getGroupedOpenHours(restaurantId)
    },
    enabled: enabled && !!restaurantId,
  })
}

/**
 * Hook to get current restaurant status (open, accepting bookings, etc.)
 */
export function useRestaurantStatus(restaurantId: string, enabled = true) {
  return useQuery({
    queryKey: ["restaurant-status", restaurantId],
    queryFn: async (): Promise<RestaurantStatus | null> => {
      if (!restaurantId) return null
      return await getRestaurantStatus(restaurantId)
    },
    enabled: enabled && !!restaurantId,
    refetchInterval: 60000, // Refresh every minute for real-time status
    staleTime: 30000, // Consider data stale after 30 seconds
  })
}

/**
 * Hook to check if restaurant is physically open right now
 */
export function useIsRestaurantOpen(restaurantId: string, enabled = true) {
  return useQuery({
    queryKey: ["is-restaurant-open", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return { isOpen: false, acceptsWalkins: false }
      return await restaurantOpenHours.isRestaurantPhysicallyOpen(restaurantId)
    },
    enabled: enabled && !!restaurantId,
    refetchInterval: 60000, // Check every minute
  })
}

/**
 * Hook to get today's service types
 */
export function useTodayServiceTypes(restaurantId: string, enabled = true) {
  return useQuery({
    queryKey: ["today-service-types", restaurantId],
    queryFn: async (): Promise<string[]> => {
      if (!restaurantId) return []
      return await restaurantOpenHours.getTodayServiceTypes(restaurantId)
    },
    enabled: enabled && !!restaurantId,
    refetchInterval: 300000, // Refresh every 5 minutes
  })
}

/**
 * Mutation to create open hours
 */
export function useCreateOpenHours() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (openHours: Omit<RestaurantOpenHours, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data, error } = await supabase
        .from("restaurant_open_hours")
        .insert(openHours)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["open-hours", data.restaurant_id] })
      queryClient.invalidateQueries({ queryKey: ["grouped-open-hours", data.restaurant_id] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-status", data.restaurant_id] })
      toast.success("Open hours created successfully")
    },
    onError: (error: any) => {
      toast.error(`Failed to create open hours: ${error.message}`)
    },
  })
}

/**
 * Mutation to update open hours
 */
export function useUpdateOpenHours() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates
    }: {
      id: string
      updates: Partial<Omit<RestaurantOpenHours, 'id' | 'created_at' | 'updated_at'>>
    }) => {
      const { data, error } = await supabase
        .from("restaurant_open_hours")
        .update(updates)
        .eq("id", id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["open-hours", data.restaurant_id] })
      queryClient.invalidateQueries({ queryKey: ["grouped-open-hours", data.restaurant_id] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-status", data.restaurant_id] })
      toast.success("Open hours updated successfully")
    },
    onError: (error: any) => {
      toast.error(`Failed to update open hours: ${error.message}`)
    },
  })
}

/**
 * Mutation to delete open hours
 */
export function useDeleteOpenHours() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // First get the restaurant_id before deleting
      const { data: openHours } = await supabase
        .from("restaurant_open_hours")
        .select("restaurant_id")
        .eq("id", id)
        .single()

      const { error } = await supabase
        .from("restaurant_open_hours")
        .delete()
        .eq("id", id)

      if (error) throw error
      return { restaurantId: openHours?.restaurant_id }
    },
    onSuccess: (data) => {
      if (data.restaurantId) {
        queryClient.invalidateQueries({ queryKey: ["open-hours", data.restaurantId] })
        queryClient.invalidateQueries({ queryKey: ["grouped-open-hours", data.restaurantId] })
        queryClient.invalidateQueries({ queryKey: ["restaurant-status", data.restaurantId] })
      }
      toast.success("Open hours deleted successfully")
    },
    onError: (error: any) => {
      toast.error(`Failed to delete open hours: ${error.message}`)
    },
  })
}

/**
 * Mutation to bulk update open hours for a restaurant
 */
export function useBulkUpdateOpenHours() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      restaurantId,
      openHoursData
    }: {
      restaurantId: string
      openHoursData: Omit<RestaurantOpenHours, 'id' | 'created_at' | 'updated_at'>[]
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Delete existing open hours for this restaurant
      const { error: deleteError } = await supabase
        .from("restaurant_open_hours")
        .delete()
        .eq("restaurant_id", restaurantId)

      if (deleteError) throw deleteError

      // Insert new open hours
      if (openHoursData.length > 0) {
        const { data, error: insertError } = await supabase
          .from("restaurant_open_hours")
          .insert(openHoursData)
          .select()

        if (insertError) throw insertError
        return data
      }

      return []
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["open-hours", variables.restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["grouped-open-hours", variables.restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-status", variables.restaurantId] })
      // Clear cache in utility class
      restaurantOpenHours.clearCache(variables.restaurantId)
      toast.success("Open hours updated successfully")
    },
    onError: (error: any) => {
      toast.error(`Failed to update open hours: ${error.message}`)
    },
  })
}

/**
 * Hook to get next opening information
 */
export function useNextOpening(restaurantId: string, enabled = true) {
  return useQuery({
    queryKey: ["next-opening", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null
      return await restaurantOpenHours.getNextOpening(restaurantId)
    },
    enabled: enabled && !!restaurantId,
    refetchInterval: 300000, // Refresh every 5 minutes
  })
}

/**
 * Hook to check walk-in availability
 */
export function useWalkinAvailability(restaurantId: string, enabled = true) {
  return useQuery({
    queryKey: ["walkin-availability", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return false
      return await restaurantOpenHours.acceptsWalkinsNow(restaurantId)
    },
    enabled: enabled && !!restaurantId,
    refetchInterval: 60000, // Check every minute
  })
}

/**
 * Hook to get open hours for a specific day
 */
export function useDayOpenHours(restaurantId: string, date: Date, enabled = true) {
  return useQuery({
    queryKey: ["day-open-hours", restaurantId, date.toISOString().split('T')[0]],
    queryFn: async (): Promise<RestaurantOpenHours[]> => {
      if (!restaurantId) return []
      return await restaurantOpenHours.getDayOpenHours(restaurantId, date)
    },
    enabled: enabled && !!restaurantId,
  })
}

/**
 * Combined hook for restaurant operating status dashboard
 */
export function useRestaurantOperatingStatus(restaurantId: string, enabled = true) {
  const status = useRestaurantStatus(restaurantId, enabled)
  const isOpen = useIsRestaurantOpen(restaurantId, enabled)
  const serviceTypes = useTodayServiceTypes(restaurantId, enabled)
  const nextOpening = useNextOpening(restaurantId, enabled)
  const walkinAvailability = useWalkinAvailability(restaurantId, enabled)

  return {
    status: status.data,
    isOpen: isOpen.data,
    serviceTypes: serviceTypes.data || [],
    nextOpening: nextOpening.data,
    acceptsWalkins: walkinAvailability.data || false,
    isLoading: status.isLoading || isOpen.isLoading || serviceTypes.isLoading || nextOpening.isLoading || walkinAvailability.isLoading,
    error: status.error || isOpen.error || serviceTypes.error || nextOpening.error || walkinAvailability.error,
  }
}