/**
 * Event Booking Hook
 *
 * React Query hook for creating bookings for events
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { EventBookingInput } from '@/types/events'
import { checkEventCapacity } from './use-events'

/**
 * Create a booking for an event
 */
export function useCreateEventBooking() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (bookingData: EventBookingInput) => {
      // First, check capacity
      const hasCapacity = await checkEventCapacity(
        bookingData.event_occurrence_id,
        bookingData.party_size
      )

      if (!hasCapacity) {
        throw new Error('This event is fully booked')
      }

      // Get event occurrence details
      const { data: occurrence, error: occError } = await supabase
        .from('event_occurrences')
        .select(`
          *,
          event:restaurant_events!event_occurrences_event_id_fkey(
            restaurant_id,
            minimum_party_size,
            maximum_party_size
          )
        `)
        .eq('id', bookingData.event_occurrence_id)
        .single()

      if (occError || !occurrence) {
        throw new Error('Event not found')
      }

      // Validate party size
      const minSize = occurrence.event?.minimum_party_size || 1
      const maxSize = occurrence.event?.maximum_party_size

      if (bookingData.party_size < minSize) {
        throw new Error(`Minimum party size is ${minSize}`)
      }

      if (maxSize && bookingData.party_size > maxSize) {
        throw new Error(`Maximum party size is ${maxSize}`)
      }

      // Create the booking time from occurrence date and start time
      let bookingTime: string
      if (occurrence.start_time) {
        bookingTime = `${occurrence.occurrence_date}T${occurrence.start_time}`
      } else {
        // Default to 12:00 for all-day events
        bookingTime = `${occurrence.occurrence_date}T12:00:00`
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()

      // Create booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert([{
          restaurant_id: occurrence.event?.restaurant_id,
          event_occurrence_id: bookingData.event_occurrence_id,
          is_event_booking: true,
          booking_time: bookingTime,
          party_size: bookingData.party_size,
          status: 'pending',
          special_requests: bookingData.special_requests || null,
          occasion: bookingData.occasion || null,
          dietary_notes: bookingData.dietary_notes || null,
          user_id: user?.id || bookingData.user_id || null,
          guest_name: bookingData.guest_name || null,
          guest_email: bookingData.guest_email || null,
          guest_phone: bookingData.guest_phone || null,
          source: 'event_booking',
          confirmation_code: generateConfirmationCode(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select(`
          *,
          event_occurrence:event_occurrences!bookings_event_occurrence_id_fkey(
            *,
            event:restaurant_events!event_occurrences_event_id_fkey(
              id,
              title,
              description,
              event_type,
              image_url
            )
          )
        `)
        .single()

      if (bookingError) {
        console.error('Error creating event booking:', bookingError)
        throw new Error('Failed to create event booking')
      }

      return booking
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['upcoming-event-occurrences'] })
      queryClient.invalidateQueries({ queryKey: ['event-occurrences'] })

      toast.success('Event booking created successfully!', {
        description: `Confirmation code: ${data.confirmation_code}`
      })
    },
    onError: (error: any) => {
      console.error('Error creating event booking:', error)
      toast.error(error.message || 'Failed to create event booking')
    }
  })
}

// Helper function to generate confirmation code
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Get event bookings for an event occurrence
 */
export function useEventOccurrenceBookings(occurrenceId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['event-occurrence-bookings', occurrenceId],
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
            avatar_url
          )
        `)
        .eq('event_occurrence_id', occurrenceId)
        .eq('is_event_booking', true)
        .in('status', ['pending', 'confirmed'])
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching event bookings:', error)
        throw new Error('Failed to load event bookings')
      }

      return data || []
    },
    enabled: !!occurrenceId,
    staleTime: 30 * 1000, // 30 seconds
  })
}
