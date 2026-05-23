// Types for Restaurant Events Feature
// These types represent the new database tables for events

import { Database } from "./supabase";

// Base database types (will be generated after migration)
export type RestaurantEvent = {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  event_type: string | null;
  image_url: string | null;
  minimum_age: number | null;
  minimum_party_size: number;
  maximum_party_size: number | null;
  special_pricing: Record<string, any>;
  special_requirements: string | null;
  terms_and_conditions: string[] | null;
  is_recurring: boolean;
  recurrence_pattern: Record<string, any> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Payment fields for paid events
  price_per_person: number | null;
  service_charge_percentage: number | null; // For Card/MontyPay payments
  service_charge_percentage_whish: number | null; // For Whish Money payments
  requires_in_app_payment: boolean; // If true, payment collected in-app; if false, payment at venue
  // Special menu and timeline for event details
  special_menu: EventMenuItem[] | null;
  timeline: EventTimelineItem[] | null;
  special_menu_url: string | null;
};

// Menu item for special event menus
export type EventMenuItem = {
  name: string;
  description?: string;
  price?: number;
  category?: string; // e.g., "Appetizer", "Main Course", "Dessert"
};

// Timeline item for event schedule
export type EventTimelineItem = {
  time: string; // e.g., "7:00 PM", "19:00"
  title: string;
  description?: string;
};

export type EventOccurrence = {
  id: string;
  event_id: string;
  occurrence_date: string; // DATE (start date)
  start_time: string | null; // TIME
  end_date: string | null; // DATE (end date, null means same as occurrence_date)
  end_time: string | null; // TIME
  max_capacity: number | null;
  current_bookings: number;
  status: "scheduled" | "cancelled" | "completed" | "full";
  special_notes: string | null;
  override_price: number | null;
  created_at: string;
  updated_at: string;
};

// Enhanced types with joined data
export type RestaurantEventWithOccurrences = RestaurantEvent & {
  occurrences: EventOccurrence[];
  restaurant?: {
    id: string;
    name: string;
    main_image_url: string | null;
    [key: string]: any;
  };
};

export type EventOccurrenceWithEvent = EventOccurrence & {
  event: RestaurantEvent;
};

export type EventOccurrenceWithDetails = EventOccurrence & {
  event_title: string;
  event_description: string | null;
  event_type: string | null;
  event_image_url: string | null;
  minimum_age: number | null;
  minimum_party_size: number;
  maximum_party_size: number | null;
};

// Event booking type - extends regular booking with event data
export type EventBooking = Database["public"]["Tables"]["bookings"]["Row"] & {
  is_event_booking: true;
  event_occurrence_id: string;
  event_occurrence?: EventOccurrenceWithEvent;
};

// Helper type for event eligibility checking
export interface EventEligibility {
  isEligible: boolean;
  canBook: boolean;
  reason?: string;
  requirements: {
    meetsAgeRequirement: boolean;
    meetsPartySizeRequirement: boolean;
    hasAvailableCapacity: boolean;
  };
  actionRequired?:
    | "sign_up"
    | "add_date_of_birth"
    | "age_restriction"
    | "adjust_party_size"
    | "event_full"
    | null;
  actionText?: string;
}

// Helper type for event occurrence with availability info
export type EventOccurrenceWithAvailability = EventOccurrence & {
  isAvailable: boolean;
  remainingCapacity: number | null; // null means unlimited
  isFull: boolean;
};

// Event type options for filtering
export const EVENT_TYPES = {
  BRUNCH: "brunch",
  LIVE_MUSIC: "live_music",
  HAPPY_HOUR: "happy_hour",
  SPECIAL_MENU: "special_menu",
  WINE_TASTING: "wine_tasting",
  TRIVIA_NIGHT: "trivia_night",
  KARAOKE: "karaoke",
  SPORTS_VIEWING: "sports_viewing",
  THEME_NIGHT: "theme_night",
  HOLIDAY_SPECIAL: "holiday_special",
  RAMADAN_IFTAR: "ramadan_iftar",
  RAMADAN_SUHOOR: "ramadan_suhoor",
  OTHER: "other",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

// Event type display labels
export const EVENT_TYPE_LABELS: Record<EventType | "other", string> = {
  brunch: "Brunch",
  live_music: "Live Music",
  happy_hour: "Happy Hour",
  special_menu: "Special Menu",
  wine_tasting: "Wine Tasting",
  trivia_night: "Trivia Night",
  karaoke: "Karaoke",
  sports_viewing: "Sports Viewing",
  theme_night: "Theme Night",
  holiday_special: "Holiday Special",
  ramadan_iftar: "Ramadan Iftar",
  ramadan_suhoor: "Ramadan Suhoor",
  other: "Other",
};

// Event occurrence status display labels
export const EVENT_STATUS_LABELS: Record<EventOccurrence["status"], string> = {
  scheduled: "Scheduled",
  cancelled: "Cancelled",
  completed: "Completed",
  full: "Fully Booked",
};

// Helper to convert 24-hour time to 12-hour format
function format12Hour(time: string): string {
  try {
    const [hours, minutes] = time.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return time;
  }
}

// Helper function to format event time range
export function formatEventTimeRange(
  startTime: string | null,
  endTime: string | null,
): string {
  if (!startTime && !endTime) {
    return "All Day";
  }

  if (startTime && !endTime) {
    return `From ${format12Hour(startTime)}`;
  }
  if (startTime && endTime) {
    return `${format12Hour(startTime)} - ${format12Hour(endTime)}`;
  }
  return "Time TBD";
}

// Helper function to format event date range (handles multi-day events)
export function formatEventDateRange(
  startDate: string,
  endDate: string | null,
  formatFn: (date: Date, fmt: string) => string,
): string {
  if (!endDate || endDate === startDate) {
    return formatFn(new Date(startDate), "EEE, MMM d");
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  // Same month: "Mon, Mar 14 - Wed, Mar 16"
  return `${formatFn(start, "EEE, MMM d")} - ${formatFn(end, "EEE, MMM d")}`;
}

// Helper function to format a full occurrence range: "Mar 1, 8:00 PM → Mar 2, 2:00 AM"
export function formatOccurrenceRange(
  occurrence: EventOccurrence,
  formatFn: (date: Date, fmt: string) => string,
): string {
  const startDate = new Date(occurrence.occurrence_date);
  const endDateVal = occurrence.end_date ? new Date(occurrence.end_date) : null;
  const isMultiDay = endDateVal && occurrence.end_date !== occurrence.occurrence_date;

  const startDateStr = formatFn(startDate, "MMM d");
  const startTimeStr = occurrence.start_time ? `, ${format12Hour(occurrence.start_time)}` : "";

  if (isMultiDay) {
    const endDateStr = formatFn(endDateVal, "MMM d");
    const endTimeStr = occurrence.end_time ? `, ${format12Hour(occurrence.end_time)}` : "";
    return `${startDateStr}${startTimeStr} → ${endDateStr}${endTimeStr}`;
  }

  // Same day
  if (occurrence.start_time && occurrence.end_time) {
    return `${startDateStr}, ${format12Hour(occurrence.start_time)} - ${format12Hour(occurrence.end_time)}`;
  }
  if (occurrence.start_time) {
    return `${startDateStr}, from ${format12Hour(occurrence.start_time)}`;
  }
  return `${startDateStr}, All Day`;
}

// Helper function to check if event occurrence is in the past
export function isEventOccurrencePast(occurrence: EventOccurrence): boolean {
  const now = new Date();
  // Use end_date if available, otherwise fall back to occurrence_date (start date)
  const relevantDate = new Date(occurrence.end_date || occurrence.occurrence_date);

  if (occurrence.end_time) {
    // If we have an end time, compare with end of event
    const [hours, minutes] = occurrence.end_time.split(":");
    relevantDate.setHours(parseInt(hours), parseInt(minutes));
    return relevantDate < now;
  } else if (!occurrence.end_date && occurrence.start_time) {
    // Single-day event with only start time, compare with start of event
    const [hours, minutes] = occurrence.start_time.split(":");
    relevantDate.setHours(parseInt(hours), parseInt(minutes));
    return relevantDate < now;
  } else {
    // All-day event or multi-day event without end time, compare end of day
    relevantDate.setHours(23, 59, 59);
    return relevantDate < now;
  }
}

// Helper function to get remaining capacity
export function getRemainingCapacity(
  occurrence: EventOccurrence,
): number | null {
  if (occurrence.max_capacity === null) {
    return null; // Unlimited
  }
  return Math.max(0, occurrence.max_capacity - occurrence.current_bookings);
}

// Helper function to check if occurrence is available for booking
export function isOccurrenceAvailable(
  occurrence: EventOccurrence,
  partySize: number = 1,
): boolean {
  // Check if occurrence is in the past
  if (isEventOccurrencePast(occurrence)) {
    return false;
  }

  // Check status
  if (occurrence.status !== "scheduled") {
    return false;
  }

  // Check capacity
  if (occurrence.max_capacity !== null) {
    const remaining = getRemainingCapacity(occurrence);
    if (remaining !== null && remaining < partySize) {
      return false;
    }
  }

  return true;
}

// Payment method types for event payments
export type EventPaymentMethod = "card" | "whish";

// Helper type for event pricing calculation
export interface EventPricing {
  pricePerPerson: number;
  partySize: number;
  subtotal: number;
  serviceChargePercentage: number;
  serviceChargeAmount: number;
  total: number;
  currency: string;
  paymentMethod: EventPaymentMethod;
}

// Helper function to check if event requires payment
export function isEventPaid(event: RestaurantEvent): boolean {
  return (
    event.price_per_person !== null &&
    event.price_per_person !== undefined &&
    event.price_per_person > 0
  );
}

// Helper function to calculate event pricing
export function calculateEventPricing(
  event: RestaurantEvent,
  partySize: number,
  paymentMethod: EventPaymentMethod = "card",
): EventPricing | null {
  if (!isEventPaid(event)) {
    return null;
  }

  const pricePerPerson = event.price_per_person!;
  const subtotal = pricePerPerson * partySize;

  // Use the appropriate service charge based on payment method
  const serviceChargePercentage =
    paymentMethod === "whish"
      ? (event.service_charge_percentage_whish ?? 3.0)
      : (event.service_charge_percentage ?? 3.0);

  const serviceChargeAmount = subtotal * (serviceChargePercentage / 100);
  const total = subtotal + serviceChargeAmount;

  return {
    pricePerPerson,
    partySize,
    subtotal,
    serviceChargePercentage,
    serviceChargeAmount,
    total,
    currency: "USD",
    paymentMethod,
  };
}
