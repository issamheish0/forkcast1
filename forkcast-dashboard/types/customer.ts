// types/customer.ts

export interface RestaurantCustomer {
  id: string
  restaurant_id: string
  user_id?: string
  guest_email?: string
  guest_phone?: string
  guest_name?: string
  total_bookings: number
  total_spent: number
  average_party_size: number
  last_visit?: string
  first_visit?: string
  no_show_count: number
  cancelled_count: number
  vip_status: boolean
  blacklisted: boolean
  blacklist_reason?: string
  preferred_table_types?: string[]
  preferred_time_slots?: string[]
  created_at: string
  updated_at: string
  
  // Additional fields for enhanced display
  email?: string
  email_confirmed?: boolean
  auth_phone?: string
  
  // Relations
  profile?: {
    id: string
    full_name: string
    email?: string
    phone_number?: string
    avatar_url?: string
    allergies?: string[]
    dietary_restrictions?: string[]
    favorite_cuisines?: string[]
    preferred_party_size?: number
    loyalty_points?: number
    membership_tier?: string
    notification_preferences?: {
      sms?: boolean
      push?: boolean
      email?: boolean
    }
    total_bookings?: number
    completed_bookings?: number
    cancelled_bookings?: number
    no_show_bookings?: number
    user_rating?: number
    date_of_birth?: string
  }
  tags?: CustomerTag[]
  notes?: CustomerNote[]
  customer_notes?: CustomerNote[] // Alias for consistency if needed
  relationships?: CustomerRelationship[]
  bookings?: any[]
  source?: 'manual' | 'booking' | 'import' | 'migration'
  notes_text?: string // Mapped from 'notes' column
}

export interface CustomerTag {
  id: string
  restaurant_id: string
  name: string
  color: string
  description?: string
  created_at: string
  // System (auto) tag metadata - set for entries seeded by
  // ensure_system_tags_for_restaurant(). Safe to treat as undefined on legacy rows.
  is_system?: boolean
  system_key?: string | null
  icon?: string | null
  category?: string | null
  priority?: number
  // Assignment-level flag propagated from customer_tag_assignments.is_auto so
  // list/detail renderers know whether a tag was placed manually or by the
  // refresh function.
  is_auto?: boolean
}

export interface CustomerTagAssignment {
  id: string
  customer_id: string
  tag_id: string
  assigned_by: string
  assigned_at: string
  is_auto?: boolean
  last_auto_refreshed_at?: string | null
  tag?: CustomerTag
}

export interface CustomerNote {
  id: string
  customer_id: string
  note: string
  category: 'dietary' | 'preference' | 'behavior' | 'special_occasion' | 'general'
  is_important: boolean
  created_by: string
  created_at: string
  updated_at: string
  created_by_profile?: {
    full_name: string
    avatar_url?: string
  }
}

export interface CustomerRelationship {
  id: string
  customer_id: string
  related_customer_id: string
  relationship_type: 'spouse' | 'parent' | 'child' | 'sibling' | 'friend' | 'colleague' | 'partner' | 'other'
  relationship_details?: string
  created_by: string
  created_at: string
  related_customer?: RestaurantCustomer
  customer?: RestaurantCustomer
}

export interface CustomerPreference {
  id: string
  customer_id: string
  preference_type: 'seating' | 'ambiance' | 'service' | 'menu' | 'timing'
  preference_value: any
  created_at: string
  updated_at: string
}

export interface CustomerFilters {
  search?: string
  tags?: string[]
  vip_only?: boolean
  blacklisted?: boolean
  min_bookings?: number
  max_bookings?: number
  last_visit_days?: number
  sort_by?: 'name' | 'last_visit' | 'total_bookings' | 'total_spent'
  sort_order?: 'asc' | 'desc'
}