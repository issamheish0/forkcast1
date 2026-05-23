// lib/hooks/use-restaurant-shifts.ts
// React Query hooks for restaurant_shifts CRUD operations.
// Shifts are named operational time windows used to filter the floorplan view.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import type { RestaurantShift } from '@/types'

// Module-scope client matches the pattern in `lib/hooks/use-open-hours.ts` etc.
const supabase = createClient()

type ShiftInput = Omit<RestaurantShift, 'id' | 'created_at' | 'updated_at'>

/**
 * Fetch all shifts for a restaurant, ordered by display_order.
 */
export function useRestaurantShifts(restaurantId: string, enabled = true) {
  return useQuery({
    queryKey: ['restaurant-shifts', restaurantId],
    queryFn: async (): Promise<RestaurantShift[]> => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from('restaurant_shifts')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('display_order', { ascending: true })
      if (error) {
        console.error('Error fetching shifts:', error)
        throw error
      }
      return (data || []) as RestaurantShift[]
    },
    enabled: enabled && !!restaurantId,
    staleTime: 60_000,
  })
}

/**
 * Fetch only active shifts (cached separately from the full list).
 */
export function useActiveRestaurantShifts(restaurantId: string, enabled = true) {
  return useQuery({
    queryKey: ['restaurant-shifts', restaurantId, 'active'],
    queryFn: async (): Promise<RestaurantShift[]> => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from('restaurant_shifts')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      if (error) {
        console.error('Error fetching active shifts:', error)
        throw error
      }
      return (data || []) as RestaurantShift[]
    },
    enabled: enabled && !!restaurantId,
    staleTime: 60_000,
  })
}

export function useCreateShift() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (shift: ShiftInput) => {
      const { data, error } = await supabase
        .from('restaurant_shifts')
        .insert(shift)
        .select()
      if (error) throw error
      return (data?.[0] ?? null) as RestaurantShift | null
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['restaurant-shifts', data.restaurant_id] })
        toast.success('Shift created')
      }
    },
    onError: (err: any) => {
      toast.error(`Failed to create shift: ${err.message}`)
    },
  })
}

export function useUpdateShift() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      restaurantId,
      updates,
    }: {
      id: string
      restaurantId: string
      updates: Partial<Omit<RestaurantShift, 'id' | 'restaurant_id' | 'created_at' | 'updated_at'>>
    }) => {
      if (!restaurantId) throw new Error('restaurantId required')
      const { data, error } = await supabase
        .from('restaurant_shifts')
        .update(updates)
        .eq('id', id)
        .eq('restaurant_id', restaurantId) // defense-in-depth multi-tenant filter
        .select()
      if (error) throw error
      return (data?.[0] ?? null) as RestaurantShift | null
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-shifts', variables.restaurantId] })
      if (data) toast.success('Shift updated')
    },
    onError: (err: any) => {
      toast.error(`Failed to update shift: ${err.message}`)
    },
  })
}

export function useDeleteShift() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, restaurantId }: { id: string; restaurantId: string }) => {
      if (!restaurantId) throw new Error('restaurantId required')
      const { error } = await supabase
        .from('restaurant_shifts')
        .delete()
        .eq('id', id)
        .eq('restaurant_id', restaurantId)
      if (error) throw error
      return { id, restaurantId }
    },
    onSuccess: ({ restaurantId }) => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-shifts', restaurantId] })
      toast.success('Shift deleted')
    },
    onError: (err: any) => {
      toast.error(`Failed to delete shift: ${err.message}`)
    },
  })
}

/**
 * Bulk replace via RPC: atomic delete + insert so a failed insert can't leave
 * the restaurant with zero shifts. Falls back to client-side best-effort if
 * the RPC isn't installed (for dev).
 */
export function useBulkSaveShifts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      restaurantId,
      shifts,
    }: {
      restaurantId: string
      shifts: ShiftInput[]
    }) => {
      if (!restaurantId) throw new Error('restaurantId required')
      // Validate before any mutation
      for (const s of shifts) {
        if (!s.name || !s.name.trim()) throw new Error('Shift name required')
        if (!s.start_time || !s.end_time) throw new Error('Shift times required')
        if (s.end_time <= s.start_time) throw new Error(`Shift "${s.name}" has invalid times`)
        if (s.restaurant_id !== restaurantId) throw new Error('Shift restaurant_id mismatch')
      }

      // Try atomic RPC first (if installed), fall back to sequential delete+insert
      try {
        const { data, error } = await supabase.rpc('bulk_replace_restaurant_shifts', {
          p_restaurant_id: restaurantId,
          p_shifts: shifts,
        })
        if (!error) return (data || []) as RestaurantShift[]
        // Only fall back if RPC isn't installed — other errors should bubble up
        const notFound =
          error.code === '42883' || // undefined_function
          /could not find function|does not exist/i.test(error.message)
        if (!notFound) throw error
      } catch (rpcErr: any) {
        const notFound =
          rpcErr?.code === '42883' ||
          /could not find function|does not exist/i.test(rpcErr?.message || '')
        if (!notFound) throw rpcErr
      }

      // Fallback: validated delete + insert in sequence
      const { error: deleteError } = await supabase
        .from('restaurant_shifts')
        .delete()
        .eq('restaurant_id', restaurantId)
      if (deleteError) throw deleteError

      if (shifts.length === 0) return []

      const { data, error: insertError } = await supabase
        .from('restaurant_shifts')
        .insert(shifts)
        .select()
      if (insertError) throw insertError
      return (data || []) as RestaurantShift[]
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-shifts', variables.restaurantId] })
      toast.success('Shifts saved')
    },
    onError: (err: any) => {
      toast.error(`Failed to save shifts: ${err.message}`)
    },
  })
}

