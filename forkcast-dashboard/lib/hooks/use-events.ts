/**
 * Events Hooks
 *
 * React Query hooks for restaurant events data management.
 * Handles events and event occurrences with their bookings.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type {
  RestaurantEvent,
  EventOccurrence,
  EventOccurrenceWithDetails,
  CreateEventInput,
  CreateEventOccurrenceInput,
  UpdateEventInput,
  UpdateEventOccurrenceInput,
  EventFilters
} from '@/types/events'

/**
 * Get all events for a restaurant with their upcoming occurrences
 */
export function useRestaurantEvents(restaurantId: string, filters: EventFilters = {}) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['restaurant-events', restaurantId, filters],
    queryFn: async () => {
      if (!restaurantId) return []

      let query = supabase
        .from('restaurant_events')
        .select(`
          *,
          restaurant:restaurants!restaurant_events_restaurant_id_fkey(
            id,
            name,
            address,
            main_image_url
          )
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters.event_type) {
        query = query.eq('event_type', filters.event_type)
      }

      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
      }

      const { data: events, error } = await query

      if (error) {
        console.error('Error fetching restaurant events:', error)
        throw new Error('Failed to load events')
      }

      // Fetch upcoming occurrences for each event
      const eventsWithOccurrences = await Promise.all(
        (events || []).map(async (event) => {
          let occQuery = supabase
            .from('event_occurrences')
            .select('*')
            .eq('event_id', event.id)
            .gte('occurrence_date', new Date().toISOString().split('T')[0])
            .order('occurrence_date', { ascending: true })
            .order('start_time', { ascending: true })

          if (filters.date_from) {
            occQuery = occQuery.gte('occurrence_date', filters.date_from)
          }

          if (filters.date_to) {
            occQuery = occQuery.lte('occurrence_date', filters.date_to)
          }

          if (filters.status) {
            occQuery = occQuery.eq('status', filters.status)
          }

          const { data: occurrences } = await occQuery

          return {
            ...event,
            occurrences: occurrences || []
          } as RestaurantEvent
        })
      )

      return eventsWithOccurrences
    },
    enabled: !!restaurantId,
    staleTime: 60 * 1000, // 1 minute
  })
}

/**
 * Get a single event with all its occurrences and details
 */
export function useEvent(eventId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const { data: event, error: eventError } = await supabase
        .from('restaurant_events')
        .select(`
          *,
          restaurant:restaurants!restaurant_events_restaurant_id_fkey(
            id,
            name,
            address,
            main_image_url,
            phone_number,
            email
          )
        `)
        .eq('id', eventId)
        .single()

      if (eventError) {
        console.error('Error fetching event:', eventError)
        throw new Error('Failed to load event')
      }

      // Fetch all occurrences
      const { data: occurrences, error: occError } = await supabase
        .from('event_occurrences')
        .select('*')
        .eq('event_id', eventId)
        .gte('occurrence_date', new Date().toISOString().split('T')[0])
        .order('occurrence_date', { ascending: true })
        .order('start_time', { ascending: true })

      if (occError) {
        console.error('Error fetching event occurrences:', occError)
      }

      return {
        ...event,
        occurrences: occurrences || []
      } as RestaurantEvent
    },
    enabled: !!eventId,
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Get upcoming event occurrences for a restaurant
 */
export function useUpcomingEventOccurrences(restaurantId: string, daysAhead: number = 30) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['upcoming-event-occurrences', restaurantId, daysAhead],
    queryFn: async () => {
      if (!restaurantId) return []

      const today = new Date().toISOString().split('T')[0]
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + daysAhead)
      const futureDateStr = futureDate.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('event_occurrences')
        .select(`
          *,
          event:restaurant_events!event_occurrences_event_id_fkey(
            id,
            title,
            description,
            event_type,
            image_url,
            restaurant_id,
            minimum_age,
            minimum_party_size,
            maximum_party_size
          )
        `)
        .gte('occurrence_date', today)
        .lte('occurrence_date', futureDateStr)
        .in('status', ['scheduled', 'full'])
        .order('occurrence_date', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) {
        console.error('Error fetching upcoming event occurrences:', error)
        throw new Error('Failed to load upcoming events')
      }

      // Filter by restaurant_id from the joined event
      const filtered = (data || []).filter(
        (occ: any) => occ.event?.restaurant_id === restaurantId
      )

      // Transform to include event details at the top level
      const transformed = filtered.map((occ: any) => ({
        ...occ,
        event_title: occ.event?.title,
        event_description: occ.event?.description,
        event_type: occ.event?.event_type,
        event_image_url: occ.event?.image_url,
        minimum_age: occ.event?.minimum_age,
        minimum_party_size: occ.event?.minimum_party_size,
        maximum_party_size: occ.event?.maximum_party_size,
        restaurant_id: occ.event?.restaurant_id,
        available_spots: occ.max_capacity ? occ.max_capacity - occ.current_bookings : null
      })) as EventOccurrenceWithDetails[]

      return transformed
    },
    enabled: !!restaurantId,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 120 * 1000, // 2 minutes
  })
}

/**
 * Get event occurrences for a specific event
 */
export function useEventOccurrences(eventId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['event-occurrences', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_occurrences')
        .select('*')
        .eq('event_id', eventId)
        .gte('occurrence_date', new Date().toISOString().split('T')[0])
        .order('occurrence_date', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) {
        console.error('Error fetching event occurrences:', error)
        throw new Error('Failed to load event occurrences')
      }

      return (data || []) as EventOccurrence[]
    },
    enabled: !!eventId,
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Create a new restaurant event
 */
export function useCreateEvent() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (eventData: CreateEventInput) => {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('You must be logged in to create an event')
      }

      const { data, error } = await supabase
        .from('restaurant_events')
        .insert([{
          ...eventData,
          created_by: user.id,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) {
        console.error('Error creating event:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          fullError: error
        })
        throw new Error(error.message || 'Failed to create event')
      }

      return data as RestaurantEvent
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-events', data.restaurant_id] })
      toast.success('Event created successfully')
    },
    onError: (error) => {
      console.error('Error creating event:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create event')
    }
  })
}

/**
 * Update an existing event
 */
export function useUpdateEvent() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ eventId, updates }: { eventId: string; updates: UpdateEventInput }) => {
      console.log('Updating event with:', { eventId, updates })
      
      const { data, error } = await supabase
        .from('restaurant_events')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId)
        .select()
        .single()

      if (error) {
        console.error('Error updating event:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        throw new Error(error.message || 'Failed to update event')
      }

      return data as RestaurantEvent
    },
    onSuccess: (data, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] })
      queryClient.invalidateQueries({ queryKey: ['restaurant-events', data.restaurant_id] })
      toast.success('Event updated successfully')
    },
    onError: (error) => {
      console.error('Error updating event:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update event')
    }
  })
}

/**
 * Delete an event permanently
 */
export function useDeleteEvent() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (eventId: string) => {
      // Fetch restaurant_id before deleting so we can invalidate the right query
      const { data: event, error: fetchError } = await supabase
        .from('restaurant_events')
        .select('restaurant_id')
        .eq('id', eventId)
        .single()

      if (fetchError) {
        console.error('Error fetching event:', fetchError)
        throw new Error('Failed to find event')
      }

      const restaurantId = event.restaurant_id

      const { error } = await supabase
        .from('restaurant_events')
        .delete()
        .eq('id', eventId)

      if (error) {
        console.error('Error deleting event:', error)
        throw new Error('Failed to delete event')
      }

      return { restaurant_id: restaurantId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-events', data.restaurant_id] })
      toast.success('Event deleted successfully')
    },
    onError: (error) => {
      console.error('Error deleting event:', error)
      toast.error('Failed to delete event')
    }
  })
}

/**
 * Create a new event occurrence
 */
export function useCreateEventOccurrence() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (occurrenceData: CreateEventOccurrenceInput) => {
      const { data, error } = await supabase
        .from('event_occurrences')
        .insert([{
          ...occurrenceData,
          status: 'scheduled',
          current_bookings: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) {
        console.error('Error creating event occurrence:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          fullError: error
        })
        throw new Error(error.message || 'Failed to create event occurrence')
      }

      return data as EventOccurrence
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event-occurrences', data.event_id] })
      queryClient.invalidateQueries({ queryKey: ['event', data.event_id] })
      queryClient.invalidateQueries({ queryKey: ['upcoming-event-occurrences'] })
      toast.success('Event date added successfully')
    },
    onError: (error) => {
      console.error('Error creating event occurrence:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add event date')
    }
  })
}

/**
 * Create multiple event occurrences at once (bulk creation)
 */
export function useCreateEventOccurrences() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (occurrencesData: CreateEventOccurrenceInput[]) => {
      if (!occurrencesData.length) {
        throw new Error('No dates provided')
      }

      // Limit check for safety (max 50 to prevent abuse)
      if (occurrencesData.length > 50) {
        throw new Error('Cannot create more than 50 occurrences at once')
      }

      const occurrencesToCreate = occurrencesData.map(occ => ({
        ...occ,
        status: 'scheduled',
        current_bookings: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))

      const { data, error } = await supabase
        .from('event_occurrences')
        .insert(occurrencesToCreate)
        .select()

      if (error) {
        console.error('Error creating event occurrences:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          fullError: error
        })
        throw new Error(error.message || 'Failed to create event occurrences')
      }

      return data as EventOccurrence[]
    },
    onSuccess: (data) => {
      if (data.length > 0) {
        const eventId = data[0].event_id
        queryClient.invalidateQueries({ queryKey: ['event-occurrences', eventId] })
        queryClient.invalidateQueries({ queryKey: ['event', eventId] })
        queryClient.invalidateQueries({ queryKey: ['upcoming-event-occurrences'] })
        toast.success(`${data.length} event date${data.length > 1 ? 's' : ''} added successfully`)
      }
    },
    onError: (error) => {
      console.error('Error creating event occurrences:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add event dates')
    }
  })
}

/**
 * Update an event occurrence
 */
export function useUpdateEventOccurrence() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ occurrenceId, updates }: { occurrenceId: string; updates: UpdateEventOccurrenceInput }) => {
      const { data, error } = await supabase
        .from('event_occurrences')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', occurrenceId)
        .select()
        .single()

      if (error) {
        console.error('Error updating event occurrence:', error)
        throw new Error('Failed to update event occurrence')
      }

      return data as EventOccurrence
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event-occurrences', data.event_id] })
      queryClient.invalidateQueries({ queryKey: ['event', data.event_id] })
      queryClient.invalidateQueries({ queryKey: ['upcoming-event-occurrences'] })
      toast.success('Event date updated successfully')
    },
    onError: (error) => {
      console.error('Error updating event occurrence:', error)
      toast.error('Failed to update event date')
    }
  })
}

/**
 * Delete an event occurrence
 */
export function useDeleteEventOccurrence() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (occurrenceId: string) => {
      // First get the event_id before deleting
      const { data: occurrence } = await supabase
        .from('event_occurrences')
        .select('event_id')
        .eq('id', occurrenceId)
        .single()

      const { error } = await supabase
        .from('event_occurrences')
        .delete()
        .eq('id', occurrenceId)

      if (error) {
        console.error('Error deleting event occurrence:', error)
        throw new Error('Failed to delete event occurrence')
      }

      return occurrence?.event_id
    },
    onSuccess: (eventId) => {
      if (eventId) {
        queryClient.invalidateQueries({ queryKey: ['event-occurrences', eventId] })
        queryClient.invalidateQueries({ queryKey: ['event', eventId] })
      }
      queryClient.invalidateQueries({ queryKey: ['upcoming-event-occurrences'] })
      toast.success('Event date deleted successfully')
    },
    onError: (error) => {
      console.error('Error deleting event occurrence:', error)
      toast.error('Failed to delete event date')
    }
  })
}

/**
 * Get bookings for a specific event occurrence
 */
export function useEventOccurrenceBookings(occurrenceId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['event-occurrence-bookings', occurrenceId],
    queryFn: async () => {
      if (!occurrenceId) return []

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          booking_time,
          party_size,
          status,
          special_requests,
          occasion,
          dietary_notes,
          guest_name,
          guest_email,
          guest_phone,
          created_at,
          confirmation_code,
          user_id,
          profiles!bookings_user_id_fkey (
            id,
            full_name,
            phone_number,
            email,
            user_rating
          )
        `)
        .eq('event_occurrence_id', occurrenceId)
        .eq('is_event_booking', true)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        console.error('Error fetching event occurrence bookings:', error)
        throw new Error('Failed to load event bookings')
      }

      return data || []
    },
    enabled: !!occurrenceId,
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Get all bookings for an event (across all occurrences)
 */
export function useEventBookings(eventId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['event-bookings', eventId],
    queryFn: async () => {
      if (!eventId) return []

      // First get all occurrence IDs for this event
      const { data: occurrences, error: occError } = await supabase
        .from('event_occurrences')
        .select('id')
        .eq('event_id', eventId)

      if (occError) {
        console.error('Error fetching event occurrences:', occError)
        throw new Error('Failed to load event occurrences')
      }

      if (!occurrences || occurrences.length === 0) return []

      const occurrenceIds = occurrences.map(o => o.id)

      // Get all bookings for these occurrences
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          booking_time,
          party_size,
          status,
          special_requests,
          occasion,
          dietary_notes,
          guest_name,
          guest_email,
          guest_phone,
          created_at,
          confirmation_code,
          user_id,
          event_occurrence_id,
          profiles!bookings_user_id_fkey (
            id,
            full_name,
            phone_number,
            email,
            user_rating
          ),
          event_occurrences!bookings_event_occurrence_id_fkey (
            id,
            occurrence_date,
            start_time,
            end_time
          )
        `)
        .in('event_occurrence_id', occurrenceIds)
        .eq('is_event_booking', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching event bookings:', error)
        throw new Error('Failed to load event bookings')
      }

      return data || []
    },
    enabled: !!eventId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // 1 minute
  })
}

/**
 * Check event capacity before booking
 */
export async function checkEventCapacity(
  occurrenceId: string,
  requestedPartySize: number = 1
): Promise<boolean> {
  const supabase = createClient()

  const { data, error } = await supabase
    .rpc('check_event_capacity', {
      p_occurrence_id: occurrenceId,
      p_requested_party_size: requestedPartySize
    })

  if (error) {
    console.error('Error checking event capacity:', error)
    return false
  }

  return data as boolean
}
