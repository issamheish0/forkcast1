/**
 * Configuration for restaurants that should be excluded from admin views
 * These are typically test/development restaurants
 */

export const EXCLUDED_RESTAURANT_IDS = [
  '48176058-02a7-40f4-a6da-4b7cc50dfb59', // Test restaurant for development
] as const

/**
 * Check if a restaurant ID should be excluded from admin views
 */
export function isRestaurantExcluded(restaurantId: string | null | undefined): boolean {
  if (!restaurantId) return false
  return EXCLUDED_RESTAURANT_IDS.includes(restaurantId as any)
}

/**
 * Get SQL filter condition to exclude test restaurants
 * Use in Supabase queries: .not('restaurant_id', 'in', `(${getExcludedRestaurantsFilter()})`)
 */
export function getExcludedRestaurantsFilter(): string {
  return EXCLUDED_RESTAURANT_IDS.join(',')
}
