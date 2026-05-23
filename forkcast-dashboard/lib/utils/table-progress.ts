// lib/utils/table-progress.ts
// Computes progress-bar state for a booked table.
// Shows elapsed time from check-in → expected end (start + turnover).

import type { Booking } from '@/types'
import { isSeatedStatus } from '@/lib/constants/floorplan'

export type TableProgressState = 'pre_start' | 'on_track' | 'ending_soon' | 'overstay'

export interface TableProgress {
  startMin: number   // minutes since midnight (start of seating)
  endMin: number     // expected end
  percent: number    // clamped to [0, 100] — for width rendering
  rawPercent: number // unclamped — for ARIA valuenow and overstay reporting
  isOverstay: boolean
  state: TableProgressState
  minutesRemaining: number // can be negative
  minutesElapsed: number
}

/**
 * Compute the progress bar state for a booking at a given time.
 * Only returns a value for bookings where the guest is physically present
 * (seated/arrived statuses). For confirmed-not-arrived, returns null.
 *
 * All times are minutes-since-midnight, local to the selectedDate.
 */
export function computeTableProgress(
  booking: Booking,
  selectedDate: Date,
  selectedTimeMin: number,
  fallbackTurnoverMinutes: number
): TableProgress | null {
  if (!isSeatedStatus(booking.status) && booking.status !== 'arrived') return null

  // Prefer actual seat-down timestamp, then check-in, then the booking time itself
  const startSource =
    booking.seated_at ||
    booking.checked_in_at ||
    booking.booking_time
  if (!startSource) return null

  const startDate = new Date(startSource)
  // Guard: only show progress when the seating falls on the same local date as selectedDate.
  // Prevents stale multi-day bookings rendering a wrong bar (e.g. seated yesterday, viewing today).
  if (startDate.toDateString() !== selectedDate.toDateString()) return null

  const startMin = startDate.getHours() * 60 + startDate.getMinutes()
  const turnover = booking.turn_time_minutes || fallbackTurnoverMinutes
  // Guard: turnover must be positive — otherwise percent becomes NaN/Infinity
  if (!turnover || turnover <= 0) return null
  const endMin = startMin + turnover

  const minutesElapsed = selectedTimeMin - startMin
  const minutesRemaining = endMin - selectedTimeMin
  const rawPercent = ((selectedTimeMin - startMin) / (endMin - startMin)) * 100
  const isOverstay = rawPercent > 100

  let state: TableProgressState
  if (rawPercent < 0) state = 'pre_start'
  else if (rawPercent >= 100) state = 'overstay'
  else if (rawPercent >= 80) state = 'ending_soon'
  else state = 'on_track'

  // Hide bar when pre-start — the bar is about elapsed time. A 0% bar on a
  // red table is visually indistinguishable from "no bar" and just adds noise.
  if (state === 'pre_start') return null

  return {
    startMin,
    endMin,
    percent: Math.max(0, Math.min(100, rawPercent)),
    rawPercent,
    isOverstay,
    state,
    minutesRemaining,
    minutesElapsed,
  }
}
