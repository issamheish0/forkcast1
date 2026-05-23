// types/restaurant.ts
import type { Database } from "@/types/supabase";

// Base restaurant type from database
export type BaseRestaurant = Database["public"]["Tables"]["restaurants"]["Row"];

// Extended restaurant type with computed fields
export interface Restaurant extends BaseRestaurant {
  // Distance calculation
  distance?: number | null;
  coordinates?: { latitude: number; longitude: number } | null;
  staticCoordinates?: { lat: number; lng: number };

  // Availability and features
  isAvailable?: boolean;

  // Restaurant hours (from joined table)
  restaurant_hours?: {
    day_of_week: string;
    is_open: boolean;
    open_time: string | null;
    close_time: string | null;
  }[];

  // Computed fields for search and display
  searchScore?: number;
  matchedCategories?: string[];

  // Social features
  isInUserPlaylists?: boolean;
  playlistCount?: number;
}

// Restaurant with location coordinates (for map display)
export interface RestaurantWithCoordinates extends Restaurant {
  coordinates: { latitude: number; longitude: number };
}

// Restaurant filters and search types
export interface RestaurantFilters {
  cuisines: string[];
  priceRange: [number, number];
  rating: number;
  distance: number;
  features: string[];
  availability: boolean;
}

// Restaurant hours type
export interface RestaurantHours {
  day_of_week: string;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

// Restaurant review summary
export interface RestaurantReviewSummary {
  average_rating: number | null;
  total_reviews: number | null;
  rating_distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

// Restaurant availability info
export interface RestaurantAvailability {
  restaurant_id: string;
  available_slots: {
    time: string;
    available_tables: number;
    table_types: string[];
  }[];
  is_open: boolean;
  next_available_slot?: string;
}

// Table types enum
export enum TableType {
  STANDARD = "standard",
  BOOTH = "booth",
  BAR = "bar",
  PATIO = "patio",
  WINDOW = "window",
  PRIVATE = "private",
}

// Restaurant card display variants
export type RestaurantCardVariant =
  | "default"
  | "compact"
  | "featured"
  | "list"
  | "search";

export default Restaurant;
