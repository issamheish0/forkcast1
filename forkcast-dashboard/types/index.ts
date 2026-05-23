// types/index.ts
export interface Restaurant {
  id: string
  name: string
  address: string
  phone_number: string | null
  email: string | null
  website: string | null
  main_image_url: string | null
  description: string | null
  cuisine_type: string[] | null
  secondary_cuisines?: string[] | null
  opening_hours: {
    day: number // 0 = Sunday, 6 = Saturday
    open_time: string // HH:mm format
    close_time: string // HH:mm format
  }[]
  tier: 'basic' | 'pro'
  addons: string[]
  created_at: string
  updated_at: string
  minimum_age?: number
  // Location data - PostGIS geometry stored as WKB hex string
  location?: string; // PostGIS WKB hex format
  // Parsed location coordinates for frontend use
  coordinates?: {
    lat: number;
    lng: number;
  };
  // Legacy fields for backward compatibility
  image_urls?: string[];
  tags?: string[];
  opening_time?: string;
  closing_time?: string;
  booking_policy?: "instant" | "request";
  price_range?: number;
  average_rating?: number;
  total_reviews?: number;
  whatsapp_number?: string;
  instagram_handle?: string;
  website_url?: string;
  menu_url?: string;
  menu_menus?: { url: string; title: string }[];
  dietary_options?: string[];
  ambiance_tags?: string[];
  parking_available?: boolean;
  valet_parking?: boolean;
  outdoor_seating?: boolean;
  shisha_available?: boolean;
  live_music_schedule?: Record<string, boolean>;
  happy_hour_times?: { start: string; end: string };
  booking_window_days?: number;
  cancellation_window_hours?: number;
  table_turnover_minutes?: number;
  featured?: boolean;
}
  
  export interface RestaurantTable {
    id: string
    restaurant_id: string
    table_number: string
    table_type: "booth" | "window" | "patio" | "standard" | "bar" | "private" | "shared"
    capacity: number
    x_position: number
    y_position: number
    shape: "rectangle" | "circle" | "square" | "round" | "banquet"
    width: number
    height: number
    is_active: boolean
    features: string[] | null
    created_at: string
    min_capacity: number
    max_capacity: number
    is_combinable: boolean
    combinable_with: string[]
    priority_score: number
    // Section support
    section_id?: string | null
    section?: RestaurantSection
    // Booking type: 'request' (default, staff approves) or 'instant' (auto-confirmed)
    default_booking_type: 'instant' | 'request'
    // Optional rotation angle for table display on canvas
    rotation?: number
  }
  
  export interface Booking {
    id: string
    user_id: string | null
    restaurant_id: string
    booking_time: string
    party_size: number
    status: "pending" | "confirmed" | "cancelled_by_user" | "declined_by_restaurant" | "auto_declined" | "completed" | "no_show" | "arrived" | "seated" | "ordered" | "appetizers" | "main_course" | "dessert" | "payment" | "cancelled_by_restaurant"
    special_requests: string | null
    occasion: string | null
    dietary_notes: string[] | null
    confirmation_code: string
    table_preferences: string[] | null
    reminder_sent: boolean
    checked_in_at: string | null
    loyalty_points_earned: number
    created_at: string
    updated_at: string
    applied_offer_id: string | null
    expected_loyalty_points: number
    guest_name: string | null
    guest_email: string | null
    guest_phone: string | null
    guest_id: string | null
    assigned_table: string | null
    is_group_booking: boolean
    organizer_id: string | null
    attendees: number
    turn_time_minutes: number
    applied_loyalty_rule_id: string | null
    actual_end_time: string | null
    seated_at: string | null
    meal_progress: Record<string, any> | null
    request_expires_at: string | null
    auto_declined: boolean
    acceptance_attempted_at: string | null
    acceptance_failed_reason: string | null
    suggested_alternative_time: string | null
    suggested_alternative_tables: string[] | null
    source: string
    is_shared_booking: boolean
    decline_note: string | null
    preferred_section: string | null
    section_id: string | null
    rest_notes: string | null

    // Cancellation fields
    cancelled_at: string | null
    cancelled_by_staff: string | null
    cancellation_reason: string | null
    cancellation_note: string | null

    // Decline fields
    declined_at: string | null
    declined_by_staff: string | null
    declined_reason: string | null

    // Event booking fields
    event_occurrence_id: string | null
    is_event_booking: boolean
    payment_status?: string | null
    payment_amount?: number | null
    payment_transaction_id?: string | null

    // Relations
    user?: {
      id: string
      full_name: string
      phone_number: string | null
      email?: string
      avatar_url?: string
    } | null
    profiles?: {
      id: string
      full_name: string
      phone_number: string | null
      avatar_url?: string
    } | null
    restaurant?: {
      id: string
      name: string
      address: string
      main_image_url: string | null
    }
    tables?: RestaurantTable[]
    booking_tables?: {
      table: RestaurantTable
    }[]
    applied_promo_code_id?: string | null
    special_offers?: {
      id: string
      title: string
      description?: string
      discount_percentage: number
    } | null
    promo_codes?: {
      id: string
      code: string
      description?: string | null
      discount_type: 'percentage' | 'fixed_amount'
      discount_value: number
      max_discount_amount?: number | null
    } | null
    event_occurrence?: {
      id: string
      event_id: string
      occurrence_date: string
      start_time: string | null
      end_time: string | null
      event?: {
        id: string
        title: string
        description: string | null
        event_type: string | null
        image_url: string | null
      }
    } | null
    booking_guarantee?: BookingGuarantee | null
    
    // Modification tracking
    modifications?: {
      id: string
      old_values: Record<string, any>
      new_values: Record<string, any>
      created_at: string
      actor_type: string
    }[]
    // Alias for rest_notes in some query shapes
    restaurant_notes?: string | null
  }

  export interface BookingGuarantee {
    id: string
    booking_id: string // Although implied by relation
    status: 'pending' | 'held' | 'released' | 'charged' | 'refunded'
    payment_method_id?: string
    amount?: number
    currency?: string
    created_at?: string
    updated_at?: string
  }
  
  export interface Profile {
    id: string;
    full_name: string;
    email?: string;
    phone_number?: string;
    avatar_url?: string;
    allergies?: string[];
    favorite_cuisines?: string[];
    dietary_restrictions?: string[];
    preferred_party_size: number;
    notification_preferences: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
    loyalty_points: number;
    membership_tier: "bronze" | "silver" | "gold" | "platinum";
    created_at: string;
    updated_at: string;
    privacy_settings: {
      profile_visibility: string;
      activity_sharing: boolean;
      location_sharing: boolean;
      friend_requests_allowed: boolean;
    };
    user_rating: number;
    total_bookings: number;
    completed_bookings: number;
    cancelled_bookings: number;
    no_show_bookings: number;
    rating_last_updated: string;
    date_of_birth?: string;
  }
  
  export interface MenuItem {
    id: string
    restaurant_id: string
    category_id: string
    name: string
    description: string | null
    price: number
    image_url: string | null
    dietary_tags: string[] | null
    allergens: string[] | null
    calories: number | null
    preparation_time: number | null
    is_available: boolean
    is_featured: boolean
    display_order: number
    created_at: string
    updated_at: string
    
    // Relations
    category?: MenuCategory
  }
  
  export interface MenuCategory {
    id: string
    restaurant_id: string
    name: string
    description: string | null
    display_order: number
    is_active: boolean
    created_at: string
    updated_at: string
    // Relations
    items?: MenuItem[]
  }
  
  export interface SpecialOffer {
    id: string;
    restaurant_id: string;
    title: string;
    description?: string;
    discount_percentage: number;
    valid_from: string;
    valid_until: string;
    terms_conditions?: string[];
    minimum_party_size: number;
    applicable_days?: number[];
    created_at: string;
    img_url?: string;
  }
  
  export interface RestaurantVIPUser {
    id: string;
    restaurant_id: string;
    user_id: string;
    extended_booking_days: number;
    priority_booking: boolean;
    valid_until: string;
    created_at: string;
    // Relations
    user?: Profile;
  }
  
  export interface RestaurantLoyaltyRule {
    id: string;
    restaurant_id: string;
    rule_name: string;
    points_to_award: number;
    is_active: boolean;
    valid_from: string;
    valid_until?: string;
    applicable_days: number[];
    start_time_minutes?: number;
    end_time_minutes?: number;
    minimum_party_size: number;
    maximum_party_size?: number;
    max_uses_total?: number;
    current_uses: number;
    max_uses_per_user?: number;
    priority: number;
    created_at: string;
    updated_at: string;
  }
  
  export interface Review {
    id: string;
    booking_id: string;
    user_id: string;
    restaurant_id: string;
    rating: number;
    comment?: string;
    images?: string[];
    is_verified: boolean;
    helpful_count: number;
    created_at: string;
    updated_at: string;
    // Relations
    user?: Profile;
    booking?: Booking;
    reply?: ReviewReply;
  }

  export interface ReviewReply {
    id: string;
    review_id: string;
    restaurant_id: string;
    replied_by: string;
    reply_message: string;
    created_at: string;
    updated_at: string;
    // Relations
    staff_member?: Profile;
  }
  
  export interface FloorPlan {
    id: string
    restaurant_id: string
    name: string
    svg_layout: string | null
    width: number
    height: number
    is_default: boolean
    created_at: string
    updated_at: string
    tables?: RestaurantTable[]
  }

  // New: Restaurant Sections
export interface RestaurantSection {
  id: string
  restaurant_id: string
  name: string
  description?: string
  display_order: number
  is_active: boolean
  color: string
  icon: string
  created_at: string
  updated_at: string
  decor_items?: any[]
  max_covers?: number | null
  min_party_size?: number | null
  max_party_size?: number | null
  // Virtual field for UI
  table_count?: number
}

// Table Booking Rules
export type TableBookingConditionType = 'party_size' | 'day_of_week' | 'time_range' | 'date_range'

export interface PartySizeCondition {
  type: 'party_size'
  operator: 'gte' | 'lte' | 'eq'
  value: number
}

export interface DayOfWeekCondition {
  type: 'day_of_week'
  days: number[] // 0=Sun, 1=Mon, ..., 6=Sat
}

export interface TimeRangeCondition {
  type: 'time_range'
  start: string // "HH:mm"
  end: string   // "HH:mm"
}

export interface DateRangeCondition {
  type: 'date_range'
  start: string // "YYYY-MM-DD"
  end: string   // "YYYY-MM-DD"
}

export type TableBookingCondition =
  | PartySizeCondition
  | DayOfWeekCondition
  | TimeRangeCondition
  | DateRangeCondition

export interface TableBookingRule {
  id: string
  table_id: string
  restaurant_id: string
  name: string
  booking_type: 'instant' | 'request'
  priority: number
  conditions: TableBookingCondition[]
  is_active: boolean
  created_at: string
  updated_at: string
}
  
  export interface RestaurantStaff {
    id: string;
    restaurant_id: string;
    user_id: string;
    role: "owner" | "manager" | "staff" | "viewer";
    permissions: string[];
    is_active: boolean;
    created_at: string;
    // Relations
    user?: {
      id: string
      full_name: string
      phone_number?: string | null
      email?: string | null
      avatar_url?: string | null
    };
  }

  export interface RestaurantTableCombination {
    id: string
    primary_table_id: string
    secondary_table_id: string
    combined_capacity: number
    created_at: string
    updated_at: string
    
    // Relations
    primary_table?: RestaurantTable
    secondary_table?: RestaurantTable
  }

  export interface RestaurantTableCombinationWithTables {
    id: string
    primary_table: RestaurantTable
    secondary_table: RestaurantTable
    combined_capacity: number
    created_at: string
    updated_at: string
  }

  // Restaurant Availability Types
  export interface RestaurantHours {
    id: string
    restaurant_id: string
    day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
    name: string | null
    is_open: boolean
    open_time: string | null
    close_time: string | null
    created_at: string
    updated_at: string
  }

  export interface RestaurantSpecialHours {
    id: string
    restaurant_id: string
    date: string
    is_closed: boolean
    open_time: string | null
    close_time: string | null
    reason: string | null
    created_at: string
    created_by: string
    // Relations
    created_by_user?: Profile
  }

  export interface RestaurantClosure {
    id: string
    restaurant_id: string
    start_date: string
    end_date: string
    reason: string
    start_time?: string | null
    end_time?: string | null
    created_at: string
    created_by: string
    // Relations
    created_by_user?: Profile
  }

  // Restaurant Shift - Named operational time window for floorplan filtering
  // Separate from RestaurantOpenHours (physical open hours) and RestaurantHours (booking windows)
  export interface RestaurantShift {
    id: string
    restaurant_id: string
    name: string
    shift_type: 'breakfast' | 'lunch' | 'dinner' | 'walkin' | 'custom'
    start_time: string // HH:mm or HH:mm:ss
    end_time: string
    is_active: boolean
    display_order: number
    color: string | null
    applicable_days: number[] // JS getDay(): 0=Sun..6=Sat
    created_at: string
    updated_at: string
  }

  // Restaurant Open Hours - Physical operating hours (different from booking hours)
  export interface RestaurantOpenHours {
    id: string
    restaurant_id: string
    day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
    service_type: 'breakfast' | 'lunch' | 'dinner' | 'general' | 'bar' | 'kitchen'
    is_open: boolean
    open_time: string | null // HH:mm format
    close_time: string | null // HH:mm format
    name: string | null // e.g., "Kitchen Hours", "Bar Service"
    accepts_walkins: boolean // Whether walk-ins are accepted during these hours
    notes: string | null // Additional information about service
    created_at: string
    updated_at: string
  }

  // Restaurant Status Information - computed from open hours and operating hours
  export interface RestaurantStatus {
    restaurant_id: string
    is_open: boolean // Currently physically open
    is_accepting_bookings: boolean // Currently accepting online bookings
    current_service_type: string | null // Current service being offered
    accepts_walkins_now: boolean // Currently accepting walk-ins
    next_opening: {
      day: string
      time: string
      service_type: string
    } | null
    next_booking_availability: {
      day: string
      time: string
    } | null
    status_message: string // Human-readable status
  }

  export interface WaitlistEntry {
    id: string
    user_id: string
    restaurant_id: string
    desired_date: string
    desired_time_range: string
    party_size: number
    created_at: string
    status: 'active' | 'notified' | 'booked' | 'expired'
    table_type: 'any' | 'booth' | 'window' | 'patio' | 'standard' | 'bar' | 'private'
    // Relations
    user?: Profile
    restaurant?: Restaurant
  }

  // Missing interfaces from database schema
  export interface BookingStatusHistory {
    id: string
    booking_id: string
    old_status: string | null
    new_status: string
    changed_by: string | null
    changed_at: string
    reason: string | null
    metadata: Record<string, any>
    // Relations
    changed_by_profile?: Profile
  }

  export interface CustomerNote {
    id: string
    customer_id: string
    note: string
    category: 'dietary' | 'preference' | 'behavior' | 'special_occasion' | 'general' | null
    is_important: boolean
    created_by: string
    created_at: string
    updated_at: string
    // Relations
    created_by_profile?: Profile
  }

  export interface CustomerPreference {
    id: string
    customer_id: string
    preference_type: 'seating' | 'ambiance' | 'service' | 'menu' | 'timing'
    preference_value: Record<string, any>
    created_at: string
    updated_at: string
  }

  export interface CustomerTagAssignment {
    id: string
    customer_id: string
    tag_id: string
    assigned_by: string
    assigned_at: string
    is_auto?: boolean
    last_auto_refreshed_at?: string | null
    // Relations
    tag?: CustomerTag
    assigned_by_profile?: Profile
  }

  export interface CustomerTag {
    id: string
    restaurant_id: string
    name: string
    color: string
    description: string | null
    created_at: string
    is_system?: boolean
    system_key?: string | null
    icon?: string | null
    category?: string | null
    priority?: number
    is_auto?: boolean
  }

  export interface RestaurantCustomer {
    id: string
    restaurant_id: string
    user_id: string | null
    guest_email: string | null
    guest_phone: string | null
    guest_name: string | null
    total_bookings: number
    total_spent: number
    average_party_size: number
    last_visit: string | null
    first_visit: string | null
    no_show_count: number
    cancelled_count: number
    vip_status: boolean
    blacklisted: boolean
    blacklist_reason: string | null
    preferred_table_types: string[] | null
    preferred_time_slots: string[] | null
    source: 'manual' | 'booking' | 'import' | 'migration'
    notes: string | null
    created_at: string
    updated_at: string
    // Relations
    profile?: Profile
    tags?: CustomerTagAssignment[]
    customer_notes?: CustomerNote[]
    preferences?: CustomerPreference[]
  }

  export interface RestaurantLoyaltyBalance {
    id: string
    restaurant_id: string
    total_purchased: number
    current_balance: number
    last_purchase_at: string | null
    created_at: string
    updated_at: string
  }

  export interface RestaurantLoyaltyTransaction {
    id: string
    restaurant_id: string
    transaction_type: 'purchase' | 'deduction' | 'refund' | 'adjustment'
    points: number
    balance_before: number
    balance_after: number
    description: string | null
    booking_id: string | null
    user_id: string | null
    created_at: string
    metadata: Record<string, any>
    // Relations
    booking?: Booking
    user?: Profile
  }

  export interface RestaurantTurnTime {
    id: string
    restaurant_id: string
    party_size: number
    turn_time_minutes: number
    day_of_week: number | null
    created_at: string
  }

  export interface TableAvailability {
    id: string
    table_id: string
    date: string
    time_slot: string
    is_available: boolean
    booking_id: string | null
    // Relations
    table?: RestaurantTable
    booking?: Booking
  }

  export interface BookingTable {
    id: string
    booking_id: string
    table_id: string
    created_at: string
    // Relations
    table?: RestaurantTable
  }

  // Staff Scheduling Types
  export interface StaffSchedule {
    id: string
    restaurant_id: string
    staff_id: string
    name: string
    description?: string
    schedule_type: 'weekly' | 'monthly' | 'one_time'
    start_date: string
    end_date?: string
    is_active: boolean
    created_by: string
    created_at: string
    updated_at: string
    // Relations
    staff?: RestaurantStaff
    created_by_user?: Profile
    shifts?: StaffShift[]
  }

  export interface StaffShift {
    id: string
    restaurant_id: string
    staff_id: string
    schedule_id?: string
    shift_date: string
    start_time: string
    end_time: string
    break_duration_minutes: number
    role?: string
    station?: string
    notes?: string
    status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
    hourly_rate?: number
    created_by: string
    created_at: string
    updated_at: string
    // Relations
    staff?: RestaurantStaff
    schedule?: StaffSchedule
    created_by_user?: Profile
    time_clock_entries?: TimeClockEntry[]
  }

  export interface TimeClockEntry {
    id: string
    restaurant_id: string
    staff_id: string
    shift_id?: string
    clock_in_time: string
    clock_out_time?: string
    break_start_time?: string
    break_end_time?: string
    total_hours?: number
    total_break_minutes: number
    overtime_hours: number
    gross_pay?: number
    notes?: string
    location_clock_in?: Record<string, any>
    location_clock_out?: Record<string, any>
    approved_by?: string
    approved_at?: string
    status: 'active' | 'completed' | 'approved' | 'disputed'
    created_at: string
    updated_at: string
    // Relations
    staff?: RestaurantStaff
    shift?: StaffShift
    approved_by_user?: Profile
  }

  export interface StaffAvailability {
    id: string
    restaurant_id: string
    staff_id: string
    day_of_week: number // 0 = Sunday, 6 = Saturday
    start_time: string
    end_time: string
    availability_type: 'available' | 'preferred' | 'unavailable'
    recurring: boolean
    specific_date?: string
    created_at: string
    updated_at: string
    // Relations
    staff?: RestaurantStaff
  }

  export interface TimeOffRequest {
    id: string
    restaurant_id: string
    staff_id: string
    start_date: string
    end_date: string
    start_time?: string
    end_time?: string
    reason?: string
    request_type: 'vacation' | 'sick' | 'personal' | 'emergency' | 'other'
    status: 'pending' | 'approved' | 'denied' | 'cancelled'
    approved_by?: string
    approved_at?: string
    denial_reason?: string
    created_at: string
    updated_at: string
    // Relations
    staff?: RestaurantStaff
    approved_by_user?: Profile
  }

  export interface StaffPosition {
    id: string
    restaurant_id: string
    name: string
    description?: string
    hourly_rate_min?: number
    hourly_rate_max?: number
    color: string
    is_active: boolean
    created_at: string
    updated_at: string
    // Virtual fields
    staff_count?: number
  }

  export interface StaffPositionAssignment {
    id: string
    staff_id: string
    position_id: string
    hourly_rate?: number
    is_primary: boolean
    created_at: string
    // Relations
    staff?: RestaurantStaff
    position?: StaffPosition
  }

  // Shared Tables Types
  export interface SharedTableSummary {
    table_id: string
    table_number: string
    capacity: number
    section_name: string
    current_occupancy: number
    total_bookings_today: number
    revenue_today: number
    peak_occupancy_time: string | null
  }

  export interface SharedTableBooking {
    booking_id: string
    user_id: string
    user_name: string
    guest_name?: string
    party_size: number
    seats_occupied: number
    booking_time: string
    status: string
    special_requests?: string
    is_social: boolean
    checked_in_at?: string
  }

  export interface SharedTableAvailability {
    table_id: string
    table: RestaurantTable
    total_seats: number
    available_seats: number
    occupied_seats: number
    current_bookings: SharedTableBooking[]
  }

  export interface SharedTableSettings {
    restaurant_id: string
    max_party_size_per_booking: number
    allow_social_features: boolean
    auto_assign_shared_tables: boolean
    shared_table_turn_time_minutes: number
    require_approval_for_shared_bookings: boolean
    social_dining_discount_percentage?: number
  }

    // Waitlist Schedule for Basic Tier Date-Based Scheduling
  export interface RestaurantWaitlistSchedule {
    id: string
    restaurant_id: string
    waitlist_date: string // ISO date format (YYYY-MM-DD)
    start_time: string    // HH:MM:SS format
    end_time: string      // HH:MM:SS format
    is_active: boolean
    name?: string         // Optional field (defaults to empty string in DB)
    notes?: string        // Optional notes
    max_entries_per_hour?: number // Optional entry limit
    created_by?: string   // UUID of staff who created schedule
    created_at: string
    updated_at: string
  }

  // Cuisine Sponsorship Types
  export type SponsorshipStatus = 'active' | 'paused' | 'expired' | 'cancelled'

  export interface CuisineSponsorship {
    id: string
    restaurant_id: string
    cuisine: string
    priority: number
    start_date?: string | null
    end_date?: string | null
    status: SponsorshipStatus
    price_paid: number
    currency: string
    notes?: string | null
    created_at: string
    updated_at: string
    created_by?: string | null
    // Joined fields
    restaurant?: {
      id: string
      name: string
      main_image_url?: string | null
    }
  }

  export interface PromoCode {
    id: string
    code: string
    description: string | null
    restaurant_id: string | null
    discount_type: 'percentage' | 'fixed_amount'
    discount_value: number
    max_discount_amount: number | null
    max_uses: number | null
    max_uses_per_user: number
    current_uses: number
    valid_from: string
    valid_until: string
    status: 'active' | 'inactive' | 'expired'
    conditions: {
      min_completed_bookings?: number
      membership_tiers?: string[]
      first_booking_only?: boolean
      min_party_size?: number
      applicable_days?: number[]
    }
    created_at: string
    updated_at: string
  }