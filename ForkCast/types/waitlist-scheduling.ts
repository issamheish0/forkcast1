// types/waitlist-scheduling.ts
import { Database } from "./supabase";

// Restaurant waitlist schedule types from Database schema
export type RestaurantWaitlistSchedule = {
  id: string;
  restaurant_id: string;
  waitlist_date: string;
  start_time: string;
  end_time: string;
  name?: string;
  max_entries_per_hour?: number;
  notes?: string;
  is_active: boolean;
  created_at: string;
};

export type RestaurantWaitlistScheduleInsert = {
  id?: string;
  restaurant_id: string;
  waitlist_date: string;
  start_time: string;
  end_time: string;
  name?: string;
  max_entries_per_hour?: number;
  notes?: string;
  is_active?: boolean;
  created_at?: string;
};

export type RestaurantWaitlistScheduleUpdate = {
  id?: string;
  restaurant_id?: string;
  waitlist_date?: string;
  start_time?: string;
  end_time?: string;
  name?: string;
  max_entries_per_hour?: number;
  notes?: string;
  is_active?: boolean;
  created_at?: string;
};

// Enhanced time slot with waitlist information
export interface TimeSlotWithWaitlist {
  time: string;
  available: boolean;
  isWaitlistTime?: boolean;
  waitlistSchedule?: {
    id: string;
    name?: string;
    notes?: string;
    max_entries_per_hour?: number;
  };
}

// Extended time range result including waitlist slots
export interface TimeRangeResultWithWaitlist {
  timeSlot: string;
  tables: any[];
  tableOptions: any[];
  allTableTypes: string[];
  totalCapacity: number;
  requiresCombination: boolean;
  isWaitlistTime?: boolean;
  waitlistSchedule?: {
    id: string;
    name?: string;
    notes?: string;
  };
}

// Waitlist schedule management
export interface WaitlistScheduleForm {
  waitlist_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string; // HH:MM:SS
  name?: string;
  notes?: string;
  max_entries_per_hour?: number;
  is_active?: boolean;
}

// Waitlist time check result
export interface WaitlistTimeCheck {
  isWaitlistTime: boolean;
  schedule?: RestaurantWaitlistSchedule;
}

// Restaurant tier enum
export type RestaurantTier = "basic" | "pro";

// Enhanced availability service result
export interface AvailabilityResult {
  timeSlots: TimeSlotWithWaitlist[];
  waitlistSchedules?: RestaurantWaitlistSchedule[];
  restaurantTier: RestaurantTier;
}
