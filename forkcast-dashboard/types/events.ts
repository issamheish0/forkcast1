// types/events.ts
// TypeScript types for Restaurant Events feature

export interface RestaurantEvent {
  id: string
  restaurant_id: string

  // Basic Information
  title: string
  description: string | null
  event_type: string | null
  image_url: string | null

  // Constraints
  minimum_age: number | null
  minimum_party_size: number
  maximum_party_size: number | null

  // Pricing and Offers
  special_pricing: Record<string, any>
  price_per_person?: number // Direct pricing support
  service_charge_percentage?: number | null

  // Requirements and Notes
  special_requirements: string | null
  terms_and_conditions: string[] | null

  // Special Menu
  special_menu_url?: string | null  // URL to PDF in storage

  // Recurrence
  is_recurring: boolean
  recurrence_pattern: Record<string, any> | null

  // Status
  is_active: boolean
  requires_in_app_payment: boolean

  // Metadata
  created_at: string
  updated_at: string
  created_by: string | null

  // Relations
  occurrences?: EventOccurrence[]
  restaurant?: {
    id: string
    name: string
    address: string
    main_image_url: string | null
  }
}

export interface EventOccurrence {
  id: string
  event_id: string

  // Date and Time
  occurrence_date: string // DATE format
  end_date: string | null // DATE format
  start_time: string | null // TIME format
  end_time: string | null // TIME format

  // Capacity Management
  max_capacity: number | null
  current_bookings: number

  // Status
  status: 'scheduled' | 'cancelled' | 'completed' | 'full'

  // Additional Information
  special_notes: string | null
  override_price: number | null

  // Metadata
  created_at: string
  updated_at: string

  // Relations
  event?: RestaurantEvent
}

export interface EventOccurrenceWithDetails extends EventOccurrence {
  event_title: string
  event_description: string | null
  event_type: string | null
  event_image_url: string | null
  minimum_age: number | null
  minimum_party_size: number
  maximum_party_size: number | null
  restaurant_id: string
  available_spots: number | null
}

export interface CreateEventInput {
  restaurant_id: string
  title: string
  description?: string
  event_type?: string
  image_url?: string
  minimum_age?: number | null
  minimum_party_size?: number
  maximum_party_size?: number | null
  special_pricing?: Record<string, any>
  special_menu_url?: string | null
  price_per_person?: number
  service_charge_percentage?: number | null
  special_requirements?: string
  terms_and_conditions?: string[]
  is_recurring?: boolean
  recurrence_pattern?: Record<string, any>
  requires_in_app_payment?: boolean
}

export interface CreateEventOccurrenceInput {
  event_id: string
  occurrence_date: string
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  max_capacity?: number | null
  special_notes?: string
  override_price?: number | null
}

export interface UpdateEventInput {
  title?: string
  description?: string
  event_type?: string
  image_url?: string
  minimum_age?: number | null
  minimum_party_size?: number
  maximum_party_size?: number | null
  special_pricing?: Record<string, any>
  special_menu_url?: string | null
  price_per_person?: number
  service_charge_percentage?: number | null
  special_requirements?: string
  terms_and_conditions?: string[]
  is_recurring?: boolean
  recurrence_pattern?: Record<string, any>
  is_active?: boolean
  requires_in_app_payment?: boolean
}

export interface UpdateEventOccurrenceInput {
  occurrence_date?: string
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  max_capacity?: number | null
  status?: 'scheduled' | 'cancelled' | 'completed' | 'full'
  special_notes?: string
  override_price?: number | null
}

export interface EventBookingInput {
  event_occurrence_id: string
  party_size: number
  special_requests?: string
  occasion?: string
  dietary_notes?: string[]
  user_id?: string
  guest_name?: string
  guest_email?: string
  guest_phone?: string
}

export interface EventFilters {
  event_type?: string
  date_from?: string
  date_to?: string
  status?: 'scheduled' | 'cancelled' | 'completed' | 'full'
  search?: string
}

// Event Type options for categorization
export const EVENT_TYPES = [
  { value: 'brunch', label: 'Brunch' },
  { value: 'live_music', label: 'Live Music' },
  { value: 'happy_hour', label: 'Happy Hour' },
  { value: 'special_menu', label: 'Special Menu' },
  { value: 'wine_tasting', label: 'Wine Tasting' },
  { value: 'trivia_night', label: 'Trivia Night' },
  { value: 'karaoke', label: 'Karaoke' },
  { value: 'sports_viewing', label: 'Sports Viewing' },
  { value: 'theme_night', label: 'Theme Night' },
  { value: 'holiday_special', label: 'Holiday Special' },
  { value: 'ramadan_iftar', label: 'Ramadan Iftar' },
  { value: 'ramadan_suhoor', label: 'Ramadan Suhoor' },
  { value: 'other', label: 'Other' },
] as const

// EVENT_MENU_CATEGORIES removed - menu is now a PDF upload

export type EventType = typeof EVENT_TYPES[number]['value']

// Helper function to format event date and time
export function formatEventDateTime(occurrence: EventOccurrence): string {
  const date = new Date(occurrence.occurrence_date)
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })

  if (!occurrence.start_time) {
    return `${dateStr} (All Day)`
  }

  const timeStr = occurrence.end_time
    ? `${occurrence.start_time} - ${occurrence.end_time}`
    : `from ${occurrence.start_time}`

  return `${dateStr}, ${timeStr}`
}

// Helper function to check if event occurrence is available for booking
export function isEventOccurrenceAvailable(occurrence: EventOccurrence): boolean {
  if (occurrence.status !== 'scheduled') return false

  const occurrenceDate = new Date(occurrence.occurrence_date)
  if (occurrenceDate < new Date()) return false

  if (occurrence.max_capacity === null) return true

  return occurrence.current_bookings < occurrence.max_capacity
}

// Helper function to get available spots
export function getAvailableSpots(occurrence: EventOccurrence): number | null {
  if (occurrence.max_capacity === null) return null
  return Math.max(0, occurrence.max_capacity - occurrence.current_bookings)
}

// Helper function to calculate capacity percentage
export function getCapacityPercentage(occurrence: EventOccurrence): number {
  if (occurrence.max_capacity === null) return 0
  if (occurrence.max_capacity === 0) return 0
  return Math.round((occurrence.current_bookings / occurrence.max_capacity) * 100)
}

// Helper function to get status badge color
export function getEventStatusColor(status: EventOccurrence['status']): string {
  switch (status) {
    case 'scheduled':
      return 'bg-green-500'
    case 'full':
      return 'bg-yellow-500'
    case 'cancelled':
      return 'bg-red-500'
    case 'completed':
      return 'bg-gray-500'
    default:
      return 'bg-gray-500'
  }
}
