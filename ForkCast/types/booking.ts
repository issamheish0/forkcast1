// types/booking.ts
import type { Database } from "@/types/supabase";

// Base booking type from database
export type BaseBooking = Database["public"]["Tables"]["bookings"]["Row"];

// Deposit status type for better type safety
export type DepositStatus =
  | "not_required"
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partial_refund"
  | "forfeited";

// Extended booking type with additional fields that exist in database but not in generated types
export interface Booking
  extends Omit<
    BaseBooking,
    | "dietary_notes"
    | "table_preferences"
    | "occasion"
    | "special_requests"
    | "preferred_section"
    | "decline_note"
    | "deposit_status"
  > {
  decline_note: string | null;
  occasion: string | null;
  special_requests: string | null;
  dietary_notes: string[] | null;
  table_preferences: string[] | null;
  preferred_section: string | null;

  // Deposit payment status (overridden from base to provide strict typing)
  deposit_status: DepositStatus;

  // Restaurant relation
  restaurant?: {
    id: string;
    name: string;
    cuisine_type: string;
    address: string;
    main_image_url: string | null;
    phone_number?: string | null;
    whatsapp_number?: string | null;
    location?: any;
    staticCoordinates?: { lat: number; lng: number };
    coordinates?: { latitude: number; longitude: number };
    max_party_size?: number;
    tier?: string;
    price_range?: number;
    cancellation_window_hours?: number;
  };

  // User/Profile relation
  user?: {
    id: string;
    full_name: string;
    avatar_url?: string | null;
  };

  // Table information
  tables?: {
    id: string;
    table_number: string;
    table_type: string;
  }[];
}

// Booking status enum for better type safety
export enum BookingStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  DECLINED = "declined",
  CANCELLED = "cancelled",
  COMPLETED = "completed",
  NO_SHOW = "no_show",
  CHECKED_IN = "checked_in",
  SEATED = "seated",
}

// Booking source enum
export enum BookingSource {
  APP = "app",
  WEBSITE = "website",
  PHONE = "phone",
  WALK_IN = "walk_in",
}

// Booking creation payload
export interface CreateBookingPayload {
  restaurant_id: string;
  booking_time: string;
  party_size: number;
  special_requests?: string;
  dietary_notes?: string[];
  occasion?: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  source: BookingSource;
}

// Booking update payload
export interface UpdateBookingPayload {
  booking_time?: string;
  party_size?: number;
  special_requests?: string;
  dietary_notes?: string[];
  occasion?: string;
  status?: BookingStatus;
  decline_note?: string;
}

export default Booking;
