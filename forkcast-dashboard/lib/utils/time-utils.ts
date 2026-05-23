// lib/utils/time-utils.ts

import { format, parseISO } from 'date-fns'

// 12-hour format time utilities
export interface Time12Hour {
  hours: number
  minutes: number
  period: 'AM' | 'PM'
}

export interface Time12HourString {
  time: string
  period: 'AM' | 'PM'
}

/**
 * Parse PostgreSQL tstzrange format and return formatted time range
 * Format: ["2024-08-07 18:00:00+00","2024-08-07 20:00:00+00")
 */
export function formatTimeRange(timeRange: string): string {
  try {
    // Try to match PostgreSQL tstzrange format
    const match = timeRange.match(/\["([^"]+)","([^"]+)"\)/)
    if (match) {
      const startTime = format(parseISO(match[1]), 'HH:mm')
      const endTime = format(parseISO(match[2]), 'HH:mm')
      return `${startTime} - ${endTime}`
    }

    // If no match, try to parse as JSON array
    try {
      const parsed = JSON.parse(timeRange)
      if (Array.isArray(parsed) && parsed.length === 2) {
        const startTime = format(parseISO(parsed[0]), 'HH:mm')
        const endTime = format(parseISO(parsed[1]), 'HH:mm')
        return `${startTime} - ${endTime}`
      }
    } catch {
      // If JSON parsing fails, fall through to return original
    }

    return timeRange
  } catch (error) {
    console.warn('Error parsing time range:', error)
    return timeRange
  }
}

/**
 * Convert 24-hour time format to 12-hour format
 * @param time24 - Time in 24-hour format (e.g., "14:30")
 * @returns Object with formatted time and period
 */
export function convertTo12Hour(time24: string): Time12HourString {
  if (!time24 || !time24.includes(':')) {
    return { time: '12:00', period: 'AM' }
  }

  const [hours, minutes] = time24.split(':').map(Number)

  if (hours === 0) {
    return { time: `12:${minutes.toString().padStart(2, '0')}`, period: 'AM' }
  } else if (hours < 12) {
    return { time: `${hours}:${minutes.toString().padStart(2, '0')}`, period: 'AM' }
  } else if (hours === 12) {
    return { time: `12:${minutes.toString().padStart(2, '0')}`, period: 'PM' }
  } else {
    return { time: `${hours - 12}:${minutes.toString().padStart(2, '0')}`, period: 'PM' }
  }
}

/**
 * Convert 12-hour time format to 24-hour format
 * @param hours - Hours (1-12)
 * @param minutes - Minutes (0-59)
 * @param period - AM or PM
 * @returns Time in 24-hour format (e.g., "14:30")
 */
export function convertTo24Hour(hours: number, minutes: number, period: 'AM' | 'PM'): string {
  let hour24 = hours

  if (period === 'AM' && hours === 12) {
    hour24 = 0
  } else if (period === 'PM' && hours !== 12) {
    hour24 = hours + 12
  }

  return `${hour24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

/**
 * Parse a 12-hour time string
 * @param timeString - Time string like "2:30 PM" or "02:30PM"
 * @returns Parsed time object
 */
export function parseTime12Hour(timeString: string): Time12Hour | null {
  if (!timeString) return null

  const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  const match = timeString.trim().match(timeRegex)

  if (!match) return null

  const hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const period = match[3].toUpperCase() as 'AM' | 'PM'

  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    return null
  }

  return { hours, minutes, period }
}


/**
 * Check if start time is strictly before end time (no overnight)
 * @param startTime - Start time in 24-hour format
 * @param endTime - End time in 24-hour format
 * @returns True if start is before end on same day
 */
export function isStartBeforeEnd(startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false

  // Validate time format
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return false
  }

  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)

  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin

  return startMinutes < endMinutes
}

/**
 * Check if a time range is valid (allowing overnight shifts)
 * @param startTime - Start time in 24-hour format
 * @param endTime - End time in 24-hour format
 * @param allowOvernight - Whether to allow overnight shifts (default: true)
 * @returns True if time range is valid
 */
export function isValidTimeRange(startTime: string, endTime: string, allowOvernight: boolean = true): boolean {
  if (!startTime || !endTime) return false

  // Validate time format
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return false
  }

  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)

  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin

  // Same time is invalid
  if (startMinutes === endMinutes) {
    return false
  }

  // If overnight shifts are allowed and end is earlier than start, it's valid
  if (allowOvernight && endMinutes < startMinutes) {
    return true
  }

  // Otherwise, start must be before end
  return startMinutes < endMinutes
}

/**
 * Get validation error message for invalid time ranges
 * @param startTime - Start time in 24-hour format
 * @param endTime - End time in 24-hour format
 * @param allowOvernight - Whether overnight shifts are allowed
 * @returns Error message or null if valid
 */
export function getTimeRangeError(startTime: string, endTime: string, allowOvernight: boolean = true): string | null {
  // Return null if either time is missing - this is handled elsewhere
  if (!startTime || !endTime) {
    return null
  }

  // Trim whitespace and validate format
  const cleanStartTime = startTime.trim()
  const cleanEndTime = endTime.trim()

  // More flexible regex that accepts both "9:00" and "09:00" formats
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/

  if (!timeRegex.test(cleanStartTime)) {
    return `Invalid start time format: "${startTime}"`
  }
  if (!timeRegex.test(cleanEndTime)) {
    return `Invalid end time format: "${endTime}"`
  }

  const [startHour, startMin] = cleanStartTime.split(':').map(Number)
  const [endHour, endMin] = cleanEndTime.split(':').map(Number)

  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin

  if (startMinutes === endMinutes) {
    return "Start and end times cannot be the same"
  }

  if (!allowOvernight && startMinutes > endMinutes) {
    return "Start time must be before end time"
  }

  return null
}

/**
 * Format time range in 12-hour format
 * @param startTime - Start time in 24-hour format
 * @param endTime - End time in 24-hour format
 * @returns Formatted time range (e.g., "2:30 PM - 10:00 PM")
 */
export function formatTimeRange12Hour(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return ''

  const start = convertTo12Hour(startTime)
  const end = convertTo12Hour(endTime)

  return `${start.time} ${start.period} - ${end.time} ${end.period}`
}

/**
 * Check if two time ranges overlap
 * @param start1 - Start time of first range (24-hour format)
 * @param end1 - End time of first range (24-hour format)
 * @param start2 - Start time of second range (24-hour format)
 * @param end2 - End time of second range (24-hour format)
 * @returns True if the time ranges overlap
 */
export function timeRangesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  if (!start1 || !end1 || !start2 || !end2) return false

  const [start1Hour, start1Min] = start1.split(':').map(Number)
  const [end1Hour, end1Min] = end1.split(':').map(Number)
  const [start2Hour, start2Min] = start2.split(':').map(Number)
  const [end2Hour, end2Min] = end2.split(':').map(Number)

  const start1Minutes = start1Hour * 60 + start1Min
  const end1Minutes = end1Hour * 60 + end1Min
  const start2Minutes = start2Hour * 60 + start2Min
  const end2Minutes = end2Hour * 60 + end2Min

  // Handle overnight shifts by adding 24 hours (1440 minutes) to end time if it's earlier than start
  const adjustedEnd1 = end1Minutes < start1Minutes ? end1Minutes + 1440 : end1Minutes
  const adjustedEnd2 = end2Minutes < start2Minutes ? end2Minutes + 1440 : end2Minutes

  // Check for overlap: ranges overlap if one starts before the other ends
  return (start1Minutes < adjustedEnd2) && (start2Minutes < adjustedEnd1)
}

/**
 * Detect overlapping shifts for a given day
 * @param shifts - Array of shifts for a day
 * @returns Array of indices of overlapping shifts
 */
export function detectOverlappingShifts(shifts: Array<{
  is_open: boolean
  open_time?: string
  close_time?: string
}>): number[] {
  const overlappingIndices: number[] = []
  const openShifts = shifts
    .map((shift, index) => ({ ...shift, originalIndex: index }))
    .filter(shift => shift.is_open && shift.open_time && shift.close_time)

  for (let i = 0; i < openShifts.length; i++) {
    for (let j = i + 1; j < openShifts.length; j++) {
      const shift1 = openShifts[i]
      const shift2 = openShifts[j]

      if (timeRangesOverlap(
        shift1.open_time!, shift1.close_time!,
        shift2.open_time!, shift2.close_time!
      )) {
        if (!overlappingIndices.includes(shift1.originalIndex)) {
          overlappingIndices.push(shift1.originalIndex)
        }
        if (!overlappingIndices.includes(shift2.originalIndex)) {
          overlappingIndices.push(shift2.originalIndex)
        }
      }
    }
  }

  return overlappingIndices.sort()
}

/**
 * Get display name for table type
 */
export function getTableTypeDisplay(tableType: string): string {
  switch (tableType) {
    case 'any':
      return 'Any Table'
    case 'booth':
      return 'Booth'
    case 'window':
      return 'Window'
    case 'patio':
      return 'Patio'
    case 'standard':
      return 'Standard'
    case 'bar':
      return 'Bar'
    case 'private':
      return 'Private Room'
    default:
      return tableType.charAt(0).toUpperCase() + tableType.slice(1)
  }
}

/**
 * Get status badge color classes
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'notified':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'booked':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'expired':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}
