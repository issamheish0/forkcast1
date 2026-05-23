// Additional type definitions for database functions and custom types

export interface BookingEligibilityResult {
  can_book: boolean;
  forced_policy: string;
  restriction_reason: string;
  user_tier: string;
  user_rating: number;
}

export interface UserRatingTierResult {
  tier: string;
  booking_policy: string;
  max_party_size: number | null;
  description: string;
}

export interface SpecialOffer {
  id: string;
  title: string;
  description: string | null;
  discount_percentage: number | null;
  restaurant_id: string;
  valid_from: string;
  valid_until: string;
  applicable_days: number[] | null;
  minimum_party_size: number | null;
  terms_conditions: string[] | null;
  img_url: string | null;
  created_at: string | null;
  // Computed properties
  used?: boolean;
  isExpired?: boolean;
  claimed?: boolean;
  canUse?: boolean;
}

export interface RestaurantWithCoordinates {
  id: string;
  name: string;
  description?: string;
  address: string;
  main_image_url?: string;
  image_urls?: string[];
  cuisine_type: string;
  tags?: string[];
  opening_time?: string;
  closing_time?: string;
  booking_policy?: string;
  price_range?: number;
  average_rating?: number;
  total_reviews?: number;
  phone_number?: string;
  whatsapp_number?: string;
  instagram_handle?: string;
  menu_url?: string;
  dietary_options?: string[];
  ambiance_tags?: string[];
  parking_available?: boolean;
  valet_parking?: boolean;
  outdoor_seating?: boolean;
  shisha_available?: boolean;
  live_music_schedule?: any;
  happy_hour_times?: any;
  booking_window_days?: number;
  cancellation_window_hours?: number;
  table_turnover_minutes?: number;
  created_at?: string;
  updated_at?: string;
  featured?: boolean;
  website_url?: string;
  review_summary?: any;
  ai_featured?: boolean;
  status?: string;
  request_expiry_hours?: number;
  auto_decline_enabled?: boolean;
  max_party_size?: number;
  min_party_size?: number;
  tier?: string;
  latitude?: number;
  longitude?: number;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}
