// lib/utils/tier.ts

export type RestaurantTier = 'basic' | 'pro'

/**
 * Check if a restaurant has Pro tier features
 */
export function isProTier(tier: RestaurantTier): boolean {
  return tier === 'pro'
}

/**
 * Check if a restaurant has Basic tier features
 */
export function isBasicTier(tier: RestaurantTier): boolean {
  return tier === 'basic'
}

/**
 * Get the tier from a restaurant object, defaulting to 'pro' for backward compatibility
 */
export function getRestaurantTier(restaurant: { tier?: RestaurantTier }): RestaurantTier {
  return restaurant.tier ?? 'pro'
}

/**
 * Feature flags based on tier
 */
export const TIER_FEATURES = {
  basic: {
    // Core booking features (only in dashboard)
    booking_management: true,
    booking_accept_decline: true,
    booking_history: true,
    booking_analytics: true,
    
    // Basic restaurant features
    review_management: true,
    profile_management: true,
    settings_basic: true,
    section_management: true, // Basic section management for organizing bookings
    
    // Disabled features
    bookings_advanced: false, // No separate bookings page
    table_management: false,
    floor_plan: false, // Only enabled via floorplan addon
    table_assignment: false,
    customer_management: false,
    staff_management: false, // Disabled staff management for basic tier
    advanced_analytics: false,
    waitlist: true, // Enable waitlist for basic tier
    loyalty_management: false,
    offers_management: false,
    schedules_management: false, // Disabled schedules management for basic tier
    complex_booking_status: false,
    manual_booking_creation: false,
    notifications_advanced: false,
  },
  pro: {
    // All features enabled for Pro tier
    booking_management: true,
    bookings_advanced: true, // Separate bookings page
    booking_accept_decline: true,
    booking_history: true,
    booking_analytics: true,
    table_management: true,
    floor_plan: false, // Only enabled via floorplan addon
    table_assignment: true,
    customer_management: true,
    staff_management: true,
    advanced_analytics: true,
    waitlist: true,
    loyalty_management: true,
    offers_management: true,
    schedules_management: true,
    complex_booking_status: true,
    manual_booking_creation: true,
    review_management: true,
    profile_management: true,
    settings_basic: true,
    section_management: false, // Pro tier uses advanced section management via tables page
    notifications_advanced: true,
  }
} as const

export const GUEST_CRM_ADDON = 'guest_crm'
export const FLOOR_PLAN_ADDON = 'floor_plan'

/**
 * Check if a feature is enabled — all features are enabled for all restaurants.
 */
export function hasFeature(
  tier: RestaurantTier,
  feature: keyof typeof TIER_FEATURES.basic,
  addons: string[] = []
): boolean {
  return true
}

/**
 * Returns all route prefixes — tier and addon restrictions are removed.
 * All authenticated staff can access all routes.
 */
export function getAllowedRoutePrefixes(_tier: RestaurantTier, _addons: string[]): string[] {
  return [
    '/bookings', '/customers', '/vip', '/menu',
    '/floorplan', '/floorplans', '/floorsections', '/sections',
    '/analytics', '/waitlist', '/reviews', '/loyalty',
    '/staff', '/orders', '/kitchen', '/notifications',
    '/migration', '/tables', '/offers', '/special-offers',
    '/settings', '/profile', '/help', '/deposits',
    '/debug', '/schedules', '/events', '/guarantees',
    '/super-admin',
  ]
}

/**
 * Get simplified booking statuses for Basic tier
 */
export const BASIC_TIER_BOOKING_STATUSES = ['pending', 'confirmed', 'declined_by_restaurant'] as const
export const PRO_TIER_BOOKING_STATUSES = [
  'pending', 'confirmed', 'cancelled_by_user', 'declined_by_restaurant', 
  'auto_declined', 'completed', 'no_show', 'arrived', 'seated', 
  'ordered', 'appetizers', 'main_course', 'dessert', 'payment', 
  'cancelled_by_restaurant'
] as const

export type BasicTierBookingStatus = typeof BASIC_TIER_BOOKING_STATUSES[number]
export type ProTierBookingStatus = typeof PRO_TIER_BOOKING_STATUSES[number]

/**
 * Get allowed booking statuses based on tier
 */
export function getAllowedBookingStatuses(tier: RestaurantTier) {
  return isBasicTier(tier) ? BASIC_TIER_BOOKING_STATUSES : PRO_TIER_BOOKING_STATUSES
}

/**
 * Check if a booking status is valid for the given tier
 */
export function isValidBookingStatus(tier: RestaurantTier, status: string): boolean {
  const allowedStatuses = getAllowedBookingStatuses(tier)
  return allowedStatuses.includes(status as any)
}

/**
 * Get navigation items based on tier and addons
 */
export function getNavigationItems(tier: RestaurantTier, addons: string[] = []) {
  const baseItems = [
    { href: '/bookings', label: 'Bookings', feature: 'booking_management' },
    { href: '/menu', label: 'Menu', feature: 'menu_management' },
    { href: '/waitlist', label: 'Waiting List', feature: 'waitlist' },
    { href: '/reviews', label: 'Reviews', feature: 'review_management' },
    { href: '/staff', label: 'Staff', feature: 'staff_management' },
    { href: '/schedules', label: 'Schedules', feature: 'schedules_management' },
    { href: '/profile', label: 'Profile', feature: 'profile_management' },
    { href: '/settings', label: 'Settings', feature: 'settings_basic' },
  ]

  const basicOnlyItems = [
    { href: '/sections', label: 'Sections', feature: 'section_management' },
  ]

  const addonItems = [
    { href: '/customers', label: 'Customers', feature: 'customer_management' },
    { href: '/vip', label: 'VIP Customers', feature: 'customer_management' },
    { href: '/floorsections', label: 'Floor Plans', feature: 'floor_plan' },
  ]

  const proOnlyItems = [
    ...addonItems,
    { href: '/analytics', label: 'Analytics', feature: 'advanced_analytics' },
    { href: '/loyalty', label: 'Loyalty', feature: 'loyalty_management' },
    { href: '/offers', label: 'Offers', feature: 'offers_management' },
    { href: '/orders', label: 'Orders', feature: 'orders_management' },
    { href: '/kitchen', label: 'Kitchen', feature: 'kitchen_management' },
    { href: '/notifications', label: 'Notifications', feature: 'notifications_advanced' },
  ]

  // Filter items based on tier features
  // For basic tier, include addon-gated items alongside basic-only items
  const tierSpecificItems = tier === 'basic' ? [...basicOnlyItems, ...addonItems] : proOnlyItems
  const allItems = [...baseItems, ...tierSpecificItems]
  return allItems.filter(item => {
    if (!hasFeature(tier, item.feature as keyof typeof TIER_FEATURES.basic, addons)) {
      return false
    }
    // Hide Sections when floor_plan is available (managed via Floor Plans page instead)
    if (item.feature === 'section_management' && hasFeature(tier, 'floor_plan', addons)) {
      return false
    }
    return true
  })
}
