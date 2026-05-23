'use server'

import { cookies } from 'next/headers'

/**
 * Server-side setter for the `selected-restaurant-id` cookie.
 *
 * Moving this out of `document.cookie` (pentest W08) so the cookie can
 * carry HttpOnly + Secure + SameSite=Lax. The client still writes the
 * same value to localStorage for its own reads — server-side code reads
 * from this HttpOnly cookie via `next/headers`.
 */

const COOKIE_NAME = 'selected-restaurant-id'
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 days

// Lightweight restaurant-id shape: UUID v4 or compact alphanumeric IDs.
// Reject anything else defensively — this value goes straight into a
// Set-Cookie header and is later used in SQL-bound equality checks.
const RESTAURANT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/

export async function setSelectedRestaurantCookie(
  restaurantId: string,
): Promise<void> {
  if (!restaurantId || !RESTAURANT_ID_RE.test(restaurantId)) return
  const jar = await cookies()
  jar.set({
    name: COOKIE_NAME,
    value: restaurantId,
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })
}

export async function clearSelectedRestaurantCookie(): Promise<void> {
  const jar = await cookies()
  jar.set({
    name: COOKIE_NAME,
    value: '',
    path: '/',
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })
}
