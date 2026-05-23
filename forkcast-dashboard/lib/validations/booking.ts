import { z } from 'zod'

// Base booking validation schema
export const createBookingSchema = z.object({
  booking_time: z.string().datetime("Invalid booking time format"),
  party_size: z.number()
    .int("Party size must be a whole number")
    .min(1, "Party size must be at least 1")
    .max(20, "Party size cannot exceed 20"),
  guest_name: z.string()
    .min(1, "Guest name is required")
    .max(100, "Guest name must be less than 100 characters"),
  guest_email: z.string().email("Invalid email format").optional().nullable(),
  guest_phone: z.string()
    .regex(/^[\d\s\-\+\(\)]+$/, "Invalid phone number format")
    .optional()
    .nullable(),
  special_requests: z.string()
    .max(500, "Special requests must be less than 500 characters")
    .optional()
    .nullable(),
  occasion: z.string()
    .max(100, "Occasion must be less than 100 characters")
    .optional()
    .nullable(),
  dietary_notes: z.array(z.string()).optional().nullable(),
  table_preferences: z.array(z.string()).optional().nullable(),
  user_id: z.string().uuid("Invalid user ID").optional().nullable()
}).strict()

// Update booking schema - all fields optional except those that shouldn't be changed
export const updateBookingSchema = z.object({
  booking_time: z.string().datetime("Invalid booking time format").optional(),
  party_size: z.number()
    .int("Party size must be a whole number")
    .min(1, "Party size must be at least 1")
    .max(20, "Party size cannot exceed 20")
    .optional(),
  status: z.enum([
    "pending",
    "confirmed", 
    "cancelled_by_user",
    "declined_by_restaurant",
    "auto_declined",
    "completed",
    "no_show",
    "arrived",
    "seated",
    "ordered",
    "appetizers",
    "main_course",
    "dessert",
    "payment",
    "cancelled_by_restaurant"
  ]).optional(),
  special_requests: z.string()
    .max(500, "Special requests must be less than 500 characters")
    .optional()
    .nullable(),
  occasion: z.string()
    .max(100, "Occasion must be less than 100 characters")
    .optional()
    .nullable(),
  dietary_notes: z.array(z.string()).optional().nullable(),
  guest_name: z.string()
    .min(1, "Guest name is required")
    .max(100, "Guest name must be less than 100 characters")
    .optional(),
  guest_email: z.string().email("Invalid email format").optional().nullable(),
  guest_phone: z.string()
    .regex(/^[\d\s\-\+\(\)]+$/, "Invalid phone number format")
    .optional()
    .nullable()
}).strict()

// Accept booking schema
export const acceptBookingSchema = z.object({
  table_ids: z.array(z.string().uuid("Invalid table ID")).optional(),
  notes: z.string()
    .max(200, "Notes must be less than 200 characters")
    .optional()
}).strict()

// Decline booking schema
export const declineBookingSchema = z.object({
  reason: z.string()
    .min(1, "Decline reason is required")
    .max(500, "Reason must be less than 500 characters"),
  suggested_alternative_time: z.string().datetime("Invalid alternative time format").optional(),
  suggested_alternative_tables: z.array(z.string().uuid("Invalid table ID")).optional()
}).strict()

// Check-in booking schema
export const checkInBookingSchema = z.object({
  notes: z.string()
    .max(200, "Notes must be less than 200 characters")
    .optional(),
  actual_party_size: z.number()
    .int("Party size must be a whole number")
    .min(1, "Party size must be at least 1")
    .max(20, "Party size cannot exceed 20")
    .optional()
}).strict()

// Query parameters schema for GET /api/bookings
export const getBookingsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  status: z.string().optional(),
  limit: z.string().regex(/^\d+$/, "Limit must be a number").transform(Number).optional(),
  offset: z.string().regex(/^\d+$/, "Offset must be a number").transform(Number).optional(),
  search: z.string().max(100, "Search term must be less than 100 characters").optional()
}).strict()

// Booking time validation helpers
export const validateBookingTime = (bookingTime: string, restaurantId: string) => {
  const bookingDate = new Date(bookingTime)
  const now = new Date()
  
  // Check if booking is in the future (at least 30 minutes from now)
  const minimumTime = new Date(now.getTime() + 30 * 60 * 1000) // 30 minutes from now
  if (bookingDate < minimumTime) {
    throw new Error("Booking must be at least 30 minutes in the future")
  }
  
  // Check if booking is not too far in the future (e.g., 90 days)
  const maxTime = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000) // 90 days from now
  if (bookingDate > maxTime) {
    throw new Error("Booking cannot be more than 90 days in advance")
  }
  
  return true
}

// Party size validation based on restaurant settings
export const validatePartySize = (partySize: number, restaurantMinSize?: number, restaurantMaxSize?: number) => {
  const minSize = restaurantMinSize || 1
  const maxSize = restaurantMaxSize || 20
  
  if (partySize < minSize) {
    throw new Error(`Party size must be at least ${minSize}`)
  }
  
  if (partySize > maxSize) {
    throw new Error(`Party size cannot exceed ${maxSize}`)
  }
  
  return true
}

// Status transition validation
export const validateStatusTransition = (currentStatus: string, newStatus: string) => {
  const validTransitions: Record<string, string[]> = {
    'pending': ['confirmed', 'declined_by_restaurant', 'auto_declined', 'cancelled_by_user'],
    'confirmed': ['arrived', 'seated', 'no_show', 'cancelled_by_user', 'cancelled_by_restaurant'],
    'arrived': ['seated', 'no_show'],
    'seated': ['ordered', 'cancelled_by_restaurant'],
    'ordered': ['appetizers', 'completed', 'cancelled_by_restaurant'],
    'appetizers': ['main_course', 'completed', 'cancelled_by_restaurant'],
    'main_course': ['dessert', 'payment', 'completed', 'cancelled_by_restaurant'],
    'dessert': ['payment', 'completed', 'cancelled_by_restaurant'],
    'payment': ['completed'],
    'completed': [], // Final state
    'cancelled_by_user': [], // Final state
    'cancelled_by_restaurant': [], // Final state
    'declined_by_restaurant': [], // Final state
    'auto_declined': [], // Final state
    'no_show': [] // Final state
  }
  
  const allowedTransitions = validTransitions[currentStatus] || []
  if (!allowedTransitions.includes(newStatus)) {
    throw new Error(`Cannot change status from ${currentStatus} to ${newStatus}`)
  }
  
  return true
}