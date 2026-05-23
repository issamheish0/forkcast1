// Keep localStorage (client-side context) and the `selected-restaurant-id`
// cookie (server-side middleware) in lockstep. Drifting previously caused
// the post-login redirect to route users to an abandoned restaurant.
//
// Pentest W08: the cookie is now set via a Server Action so it carries
// HttpOnly + Secure + SameSite=Lax. Client-side reads still go through
// localStorage (unchanged), so nothing downstream needs to know.

import {
  setSelectedRestaurantCookie,
  clearSelectedRestaurantCookie,
} from '@/app/actions/restaurant-selection'

export const RESTAURANT_ID_KEY = 'selected-restaurant-id'
export const RESTAURANT_TIER_KEY = 'restaurant-tier'

export function persistRestaurantSelection(
  restaurantId: string,
  tier?: string | null,
): void {
  if (typeof window === 'undefined' || !restaurantId) return

  localStorage.setItem(RESTAURANT_ID_KEY, restaurantId)
  if (tier) {
    localStorage.setItem(RESTAURANT_TIER_KEY, tier)
  }

  // Fire-and-forget: the Server Action writes the HttpOnly cookie. We
  // don't block on it — worst case the server-side read sees the previous
  // value until the next request, which still matches the freshly-written
  // localStorage value via the middleware's cookie-vs-staff validation.
  void setSelectedRestaurantCookie(restaurantId).catch(() => {})
}

export function clearRestaurantSelection(): void {
  if (typeof window === 'undefined') return

  localStorage.removeItem(RESTAURANT_ID_KEY)
  localStorage.removeItem(RESTAURANT_TIER_KEY)
  void clearSelectedRestaurantCookie().catch(() => {})
}
