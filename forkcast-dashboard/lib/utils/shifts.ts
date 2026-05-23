// lib/utils/shifts.ts
// Pure utility functions for restaurant shift logic.
// Shifts are named operational time windows (breakfast/lunch/dinner/walkin/custom)
// used to scope the floorplan view.

import type { RestaurantShift, Booking } from '@/types'

/**
 * Parse a time string (HH:mm or HH:mm:ss) into minutes since midnight.
 * Returns NaN for invalid input.
 */
export function parseTimeToMinutes(time: string | null | undefined): number {
  if (!time) return NaN
  const parts = time.split(':')
  if (parts.length < 2) return NaN
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN
  return h * 60 + m
}

/**
 * Convert minutes since midnight to HH:mm string.
 * Clamps to [0, 1439] range.
 */
export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.round(minutes)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Get the day-of-week index for a date, using JS Date.getDay() convention.
 * 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
 */
export function getDayOfWeekIndex(date: Date): number {
  return date.getDay()
}

/**
 * Filter shifts to those applicable on the given date (based on applicable_days + is_active).
 * Preserves display_order sorting.
 */
export function getShiftsForDate(
  shifts: RestaurantShift[] | undefined | null,
  date: Date
): RestaurantShift[] {
  if (!shifts || shifts.length === 0) return []
  const dayIndex = getDayOfWeekIndex(date)
  return shifts
    .filter((s) => s.is_active && s.applicable_days.includes(dayIndex))
    .sort((a, b) => a.display_order - b.display_order)
}

/**
 * Get the shift window in minutes since midnight.
 * Returns null if invalid times.
 */
export function getShiftWindow(
  shift: RestaurantShift | null | undefined
): { start: number; end: number } | null {
  if (!shift) return null
  const start = parseTimeToMinutes(shift.start_time)
  const end = parseTimeToMinutes(shift.end_time)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null
  return { start, end }
}

/**
 * Clamp a time to the shift window. If outside, returns the nearest boundary (start if before, end-1 if after).
 */
export function clampTimeToShift(time: string, shift: RestaurantShift): string {
  const t = parseTimeToMinutes(time)
  const window = getShiftWindow(shift)
  if (!window) return time
  if (Number.isNaN(t)) return minutesToTime(window.start)
  if (t < window.start) return minutesToTime(window.start)
  if (t >= window.end) return minutesToTime(Math.max(window.start, window.end - 1))
  return time
}

/**
 * Classify how a booking fits within a shift window.
 * Uses the booking's turnover (turn_time_minutes || fallback) as occupancy window.
 */
export type BookingShiftClassification =
  | 'outside'       // no overlap
  | 'fully_in'      // entirely within shift
  | 'spans_before'  // starts before shift, ends inside
  | 'spans_after'   // starts inside shift, ends after
  | 'spans_both'    // starts before shift, ends after shift

export function classifyBookingInShift(
  booking: Booking,
  shift: RestaurantShift,
  fallbackTurnoverMinutes: number
): BookingShiftClassification {
  const window = getShiftWindow(shift)
  if (!window) return 'outside'

  const bTime = new Date(booking.booking_time)
  const startMin = bTime.getHours() * 60 + bTime.getMinutes()
  const turnover = booking.turn_time_minutes || fallbackTurnoverMinutes
  const endMin = startMin + turnover

  // No overlap
  if (endMin <= window.start || startMin >= window.end) return 'outside'

  const startsBefore = startMin < window.start
  const endsAfter = endMin > window.end

  if (startsBefore && endsAfter) return 'spans_both'
  if (startsBefore) return 'spans_before'
  if (endsAfter) return 'spans_after'
  return 'fully_in'
}

/**
 * Default color for a shift type (Tailwind-friendly hex).
 */
export function getDefaultShiftColor(shiftType: RestaurantShift['shift_type']): string {
  switch (shiftType) {
    case 'breakfast': return '#f59e0b' // amber
    case 'lunch':     return '#10b981' // emerald
    case 'dinner':    return '#8b5cf6' // violet
    case 'walkin':    return '#3b82f6' // blue
    default:          return '#6366f1' // indigo
  }
}

/**
 * Format a shift window as "7:00 AM – 11:00 AM"
 */
export function formatShiftRange(shift: RestaurantShift): string {
  return `${formatTime12Hour(shift.start_time)} – ${formatTime12Hour(shift.end_time)}`
}

function formatTime12Hour(time: string): string {
  const [hStr, mStr] = time.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (Number.isNaN(h) || Number.isNaN(m)) return time
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  const ampm = h < 12 ? 'AM' : 'PM'
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
}
