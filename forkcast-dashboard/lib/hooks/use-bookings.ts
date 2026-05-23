/**
 * Booking Hooks
 * 
 * React Query hooks for booking data management.
 * Replaces API routes: /api/bookings, /api/bookings/[id]
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { acceptBooking, declineBooking, checkInBooking, cancelBooking } from '@/lib/services/booking-operations'

export interface BookingFilters {
  status?: string
  date?: string
  search?: string
  limit?: number
  offset?: number
}

/**
 * Get all bookings for a restaurant with filters
 */
export function useBookings(restaurantId: string, filters: BookingFilters = {}) {
  const supabase = createClient()
  
  return useQuery({
    queryKey: ['bookings', restaurantId, filters],
    queryFn: async () => {
      let query = supabase
        .from('bookings')
        .select(`
          *,
          user:profiles!bookings_user_id_fkey(
            id,
            full_name,
            email,
            phone_number,
            avatar_url
          ),
          table:tables!bookings_table_id_fkey(
            id,
            name,
            seats,
            section
          ),
          restaurant:restaurants!bookings_restaurant_id_fkey(
            id,
            name
          )
        `)
        .eq('restaurant_id', restaurantId)
        .order('booking_time', { ascending: true })

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      if (filters.date) {
        const startOfDay = new Date(filters.date)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(filters.date)
        endOfDay.setHours(23, 59, 59, 999)
        
        query = query
          .gte('booking_time', startOfDay.toISOString())
          .lte('booking_time', endOfDay.toISOString())
      }

      if (filters.search && filters.search.trim().length >= 2) {
        // Use RPC to bypass RLS on 20k+ profiles (avoids statement timeout 57014)
        const sq = filters.search.trim()
        let profileIds: string[] = []
        try {
          const { data: profiles, error: rpcError } = await supabase.rpc('search_profiles_admin', { search_query: sq })
          if (rpcError) {
            console.error('search_profiles_admin RPC error:', rpcError)
          } else if (profiles && profiles.length > 0) {
            profileIds = profiles.map((p: { id: string }) => p.id)
          }
        } catch (_) {}

        const orSegments = [`special_requests.ilike.%${sq}%`]
        if (profileIds.length > 0) {
          orSegments.push(`user_id.in.(${profileIds.join(',')})`)
        }
        query = query.or(orSegments.join(','))
      }

      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching bookings:', error)
        throw new Error('Failed to load bookings')
      }

      return data || []
    },
    enabled: !!restaurantId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // 1 minute
  })
}

/**
 * Get a single booking by ID
 */
export function useBooking(bookingId: string) {
  const supabase = createClient()
  
  return useQuery({
    queryKey: ['booking', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          user:profiles!bookings_user_id_fkey(
            id,
            full_name,
            email,
            phone_number,
            avatar_url,
            allergies,
            dietary_restrictions,
            preferred_contact_method
          ),
          table:tables!bookings_table_id_fkey(
            id,
            name,
            seats,
            section,
            position_x,
            position_y
          ),
          restaurant:restaurants!bookings_restaurant_id_fkey(
            id,
            name,
            address,
            phone_number,
            email
          ),
          history:booking_history(
            *,
            staff:restaurant_staff!booking_history_changed_by_fkey(
              user:profiles!restaurant_staff_user_id_fkey(full_name)
            )
          )
        `)
        .eq('id', bookingId)
        .single()

      if (error) {
        console.error('Error fetching booking:', error)
        throw new Error('Failed to load booking')
      }

      return data
    },
    enabled: !!bookingId,
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Create a new booking
 */
export function useCreateBooking() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (bookingData: any) => {
      const { data, error } = await supabase
        .from('bookings')
        .insert([{
          ...bookingData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) {
        console.error('Error creating booking:', error)
        throw new Error('Failed to create booking')
      }

      return data
    },
    onSuccess: (data) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['table-availability'] })
      toast.success('Booking created successfully')
    },
    onError: (error) => {
      console.error('Error creating booking:', error)
      toast.error('Failed to create booking')
    }
  })
}

/**
 * Update an existing booking
 */
export function useUpdateBooking() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ bookingId, updates }: { bookingId: string; updates: any }) => {
      const { data, error } = await supabase
        .from('bookings')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .select()
        .single()

      if (error) {
        console.error('Error updating booking:', error)
        throw new Error('Failed to update booking')
      }

      return data
    },
    onSuccess: (data, { bookingId }) => {
      // Update specific booking in cache
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['table-availability'] })
      toast.success('Booking updated successfully')
    },
    onError: (error) => {
      console.error('Error updating booking:', error)
      toast.error('Failed to update booking')
    }
  })
}

/**
 * Accept a pending booking
 */
export function useAcceptBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ bookingId, staffId }: { bookingId: string; staffId: string }) => {
      return await acceptBooking(bookingId, staffId)
    },
    onSuccess: (result, { bookingId }) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['booking', bookingId] })
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
        queryClient.invalidateQueries({ queryKey: ['table-availability'] })
      }
    }
  })
}

/**
 * Decline a pending booking
 */
export function useDeclineBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ bookingId, staffId, reason, decline_note }: {
      bookingId: string;
      staffId: string;
      reason?: string;
      decline_note?: string;
    }) => {
      return await declineBooking(bookingId, staffId, reason, decline_note)
    },
    onSuccess: (result, { bookingId }) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['booking', bookingId] })
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
        queryClient.invalidateQueries({ queryKey: ['table-availability'] })
      }
    }
  })
}

/**
 * Check in a confirmed booking
 */
export function useCheckInBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ bookingId, staffId }: { bookingId: string; staffId: string }) => {
      return await checkInBooking(bookingId, staffId)
    },
    onSuccess: (result, { bookingId }) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['booking', bookingId] })
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
        queryClient.invalidateQueries({ queryKey: ['customers'] })
        queryClient.invalidateQueries({ queryKey: ['table-availability'] })
      }
    }
  })
}

/**
 * Cancel a booking (by restaurant)
 */
export function useCancelBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ bookingId, staffId, reason, cancellation_note }: {
      bookingId: string;
      staffId: string;
      reason?: string;
      cancellation_note?: string;
    }) => {
      return await cancelBooking(bookingId, staffId, reason, cancellation_note)
    },
    onSuccess: (result, { bookingId }) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['booking', bookingId] })
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
        queryClient.invalidateQueries({ queryKey: ['table-availability'] })
      }
    }
  })
}
