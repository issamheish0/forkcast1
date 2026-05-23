// types/search.ts - Updated with location types and search functionality
import { Region } from "react-native-maps";
import type { Restaurant } from "@/types/restaurant";

// Search suggestion (used by server-side search_suggestions RPC)
export interface SearchSuggestion {
  type: "restaurant" | "cuisine" | "tag" | "location";
  value: string;
  label: string;
  score?: number;
  restaurantId?: string | null;
}

// RPC result types for server-side search
export interface SearchRestaurantResult {
  id: string;
  name: string;
  main_image_url: string | null;
  cuisine_type: string;
  secondary_cuisines: string[] | null;
  price_range: number;
  average_rating: number | null;
  total_reviews: number;
  address: string;
  latitude: number;
  longitude: number;
  booking_policy: string;
  status: string;
  featured: boolean;
  featured_order: number | null;
  outdoor_seating: boolean;
  valet_parking: boolean;
  parking_available: boolean;
  shisha_available: boolean;
  scratch_card_enabled: boolean;
  ambiance_tags: string[] | null;
  tier: string;
  has_active_offer: boolean;
  distance_km: number | null;
  relevance_score: number;
}

export interface SearchSuggestionResult {
  suggestion_type: string;
  value: string;
  label: string;
  score: number;
  restaurant_id: string | null;
}

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationData extends LocationCoordinates {
  city: string;
  district: string;
  country: string;
}

export interface UserLocation extends LocationCoordinates {}

export type ViewMode = "list" | "map";

export interface BookingFilters {
  date: Date | null;
  time: string | null;
  partySize: number | null;
  availableOnly: boolean;
}

export interface GeneralFilters {
  sortBy: "recommended" | "rating" | "distance" | "name";
  cuisines: string[];
  features: string[];
  priceRange: number[];
  bookingPolicy: "all" | "instant" | "request";
  minRating: number;
  maxDistance: number | null;
  hasSpecialOffer: "all" | "yes" | "no";
  scratchCardOnly: boolean;
}

// Re-export Restaurant from restaurant.ts to avoid duplication
export type { Restaurant } from "@/types/restaurant";

export interface SearchState {
  restaurants: Restaurant[];
  favorites: Set<string>;
  loading: boolean;
  refreshing: boolean;
  userLocation: LocationData | null;
  viewMode: ViewMode;
  searchQuery: string;
  bookingFilters: BookingFilters;
  generalFilters: GeneralFilters;
}

export interface SearchActions {
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  updateBookingFilters: (updates: Partial<BookingFilters>) => void;
  updateGeneralFilters: (filters: GeneralFilters) => void;
  toggleFavorite: (restaurantId: string) => Promise<void>;
  clearAllFilters: () => void;
  handleRefresh: () => void;
}

export interface SearchHandlers {
  handleRestaurantPress: (restaurantId: string) => void;
  openDirections: (restaurant: Restaurant) => Promise<void>;
  toggleAvailableOnly: () => void;
}

export interface SearchComputed {
  activeFilterCount: number;
  dateOptions: Date[];
}

export interface LocationUtilities {
  formatDistance: (distance: number | null) => string;
  calculateDistance: (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => number;
  displayName: string;
}

export interface UseSearchReturn {
  searchState: SearchState;
  actions: SearchActions;
  handlers: SearchHandlers;
  computed: SearchComputed;
  location: LocationUtilities;
}
