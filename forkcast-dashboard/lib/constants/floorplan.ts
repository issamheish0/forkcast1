// lib/constants/floorplan.ts — Shared constants for floorplan components

/**
 * Booking statuses indicating a guest is physically present / dining
 */
export const SEATED_STATUSES = [
  'seated',
  'ordered',
  'appetizers',
  'main_course',
  'dessert',
  'payment',
] as const

/**
 * All statuses that count as "active" — the booking is in progress or confirmed
 */
export const ACTIVE_BOOKING_STATUSES = [
  'confirmed',
  'arrived',
  ...SEATED_STATUSES,
] as const

/**
 * Statuses that should be excluded from active views (terminal states)
 */
export const TERMINAL_BOOKING_STATUSES = [
  'cancelled_by_user',
  'cancelled_by_restaurant',
  'declined_by_restaurant',
  'auto_declined',
  'completed',
  'no_show',
] as const

/**
 * Timer color thresholds (minutes remaining until expected end)
 */
export const TIMER_THRESHOLDS = {
  /** Minutes remaining below which the timer turns red */
  RED: 15,
  /** Minutes remaining below which the timer turns yellow */
  YELLOW: 30,
} as const

/**
 * Default overstay threshold in minutes
 */
export const OVERSTAY_MINUTES = 90

/**
 * Default restaurant turnover time in minutes (fallback)
 */
export const DEFAULT_TURNOVER_MINUTES = 90

/**
 * Extract full_name from a profiles field that may be an object or array
 */
function extractProfileName(
  profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null
): string | null {
  if (!profiles) return null
  const profile = Array.isArray(profiles) ? profiles[0] : profiles
  return profile?.full_name ?? null
}

/**
 * Resolve guest display name from a booking, checking all possible fields
 */
export function resolveGuestName(booking: {
  guest_name?: string | null
  user?: { full_name?: string | null } | null
  profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null
}): string {
  return booking.guest_name
    || extractProfileName(booking.profiles)
    || booking.user?.full_name
    || 'Guest'
}

/**
 * Determine timer color based on minutes remaining until expected end
 */
export function getTimerColor(minutesRemaining: number): {
  color: 'green' | 'yellow' | 'red' | 'flashing-red'
  isFlashing: boolean
} {
  if (minutesRemaining < 0) {
    return { color: 'flashing-red', isFlashing: true }
  }
  if (minutesRemaining < TIMER_THRESHOLDS.RED) {
    return { color: 'red', isFlashing: false }
  }
  if (minutesRemaining < TIMER_THRESHOLDS.YELLOW) {
    return { color: 'yellow', isFlashing: false }
  }
  return { color: 'green', isFlashing: false }
}

/**
 * Check if a booking status means the guest is physically seated/dining
 */
export function isSeatedStatus(status: string): boolean {
  return (SEATED_STATUSES as readonly string[]).includes(status)
}

/**
 * Check if a booking status is terminal (done/cancelled)
 */
export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_BOOKING_STATUSES as readonly string[]).includes(status)
}

/**
 * Convert time string "HH:mm" to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Get initials from a name (max 2 characters)
 */
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
