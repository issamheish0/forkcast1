/**
 * Lebanon Timezone Utilities
 *
 * All booking-related date/time operations MUST use these functions
 * to ensure consistency with Lebanon timezone (Asia/Beirut).
 *
 * Why hardcoded Lebanon timezone?
 * - App is Lebanon-market only
 * - Simplifies logic and reduces bugs
 * - User device timezone is ignored for booking operations
 *
 * Key Concepts:
 * - Database stores UTC timestamps (timestamp with time zone)
 * - This utility ensures all date/time logic uses Lebanon local time
 * - DST (Daylight Saving Time) is handled automatically
 */

import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";
import { format } from "date-fns";

/**
 * Lebanon timezone constant (IANA timezone identifier)
 * UTC+2 in winter, UTC+3 in summer (DST)
 */
export const LEBANON_TZ = "Asia/Beirut";

/**
 * Get current time in Lebanon timezone
 *
 * USE THIS instead of: new Date()
 *
 * @returns Current Date object in Lebanon timezone
 *
 * @example
 * const now = getCurrentLebanonTime();
 * // If actual UTC time is 10:00 AM
 * // In Lebanon (UTC+2): returns 12:00 PM
 * // In Lebanon (UTC+3 DST): returns 1:00 PM
 */
export function getCurrentLebanonTime(): Date {
  return toZonedTime(new Date(), LEBANON_TZ);
}

/**
 * Create a Lebanon datetime from date string (YYYY-MM-DD) and time (HH:mm)
 * Returns UTC Date that represents this Lebanon local time
 *
 * This is the PRIMARY function for booking time creation.
 *
 * @param dateStr - Date in YYYY-MM-DD format (e.g., "2025-11-15")
 * @param timeStr - Time in HH:mm format (e.g., "19:00")
 * @returns Date object representing that Lebanon local time (stored as UTC internally)
 *
 * @example
 * const bookingTime = createLebanonDateTime('2025-11-15', '19:00');
 * // Creates: Nov 15, 2025 7:00 PM Lebanon time
 * // Database stores: 2025-11-15T17:00:00Z (UTC, accounting for UTC+2)
 * // No matter where the user is located, this represents 7 PM in Lebanon
 */
export function createLebanonDateTime(dateStr: string, timeStr: string): Date {
  try {
    // Construct Lebanon time string in ISO 8601 format
    const lebanonTimeString = `${dateStr}T${timeStr}:00`;

    // Convert Lebanon local time to UTC for database storage
    // zonedTimeToUtc interprets the string as being in LEBANON_TZ
    return fromZonedTime(lebanonTimeString, LEBANON_TZ);
  } catch (error) {
    console.error("[lebanonTime] Error creating Lebanon datetime:", {
      dateStr,
      timeStr,
      error,
    });
    throw error;
  }
}

/**
 * Convert a Date object to ISO string for database storage
 *
 * USE THIS instead of: date.toISOString()
 *
 * @param date - Date object to convert
 * @returns ISO 8601 string suitable for database timestamp with time zone column
 *
 * @example
 * const date = createLebanonDateTime('2025-11-15', '19:00');
 * const dbValue = toLebanonISOString(date);
 * // Returns: "2025-11-15T17:00:00.000Z" (UTC representation)
 */
export function toLebanonISOString(date: Date): string {
  try {
    return date.toISOString();
  } catch (error) {
    console.error("[lebanonTime] Error converting to ISO string:", {
      date,
      error,
    });
    throw error;
  }
}

/**
 * Parse database timestamptz to Lebanon timezone Date
 *
 * USE THIS when reading booking_time from database
 *
 * @param isoString - ISO 8601 timestamp from database
 * @returns Date object representing the same moment in Lebanon timezone
 *
 * @example
 * const dbValue = "2025-11-15T17:00:00.000Z"; // UTC from database
 * const lebanonTime = parseFromLebanonTZ(dbValue);
 * // Returns Date representing 7:00 PM Lebanon time
 */
export function parseFromLebanonTZ(isoString: string): Date {
  try {
    return new Date(isoString);
  } catch (error) {
    console.error("[lebanonTime] Error parsing ISO string:", {
      isoString,
      error,
    });
    throw error;
  }
}

/**
 * Check if a Lebanon date/time is in the future
 *
 * USE THIS for "isUpcoming" booking checks
 *
 * @param dateStr - Date in YYYY-MM-DD format
 * @param timeStr - Time in HH:mm format
 * @returns true if the specified Lebanon time is in the future
 *
 * @example
 * // Current time: Nov 14, 2025 2:00 PM Lebanon time
 * isLebanonTimeInFuture('2025-11-14', '20:00') // true (8 PM is later)
 * isLebanonTimeInFuture('2025-11-14', '10:00') // false (10 AM is earlier)
 */
export function isLebanonTimeInFuture(
  dateStr: string,
  timeStr: string,
): boolean {
  try {
    const targetTime = createLebanonDateTime(dateStr, timeStr);
    const nowInLebanon = getCurrentLebanonTime();
    return targetTime > nowInLebanon;
  } catch (error) {
    console.error("[lebanonTime] Error checking if time is in future:", {
      dateStr,
      timeStr,
      error,
    });
    return false;
  }
}

/**
 * Format a Date to time string (HH:mm) in Lebanon timezone
 *
 * @param date - Date object to format
 * @returns Time string in HH:mm format (24-hour)
 *
 * @example
 * const date = parseFromLebanonTZ('2025-11-15T17:00:00.000Z');
 * const time = formatLebanonTime(date);
 * // Returns: "19:00"
 */
export function formatLebanonTime(date: Date): string {
  try {
    return formatInTimeZone(date, LEBANON_TZ, "HH:mm");
  } catch (error) {
    console.error("[lebanonTime] Error formatting time:", { date, error });
    return "00:00";
  }
}

/**
 * Format a Date to date string (YYYY-MM-DD) in Lebanon timezone
 *
 * @param date - Date object to format
 * @returns Date string in YYYY-MM-DD format
 *
 * @example
 * const date = parseFromLebanonTZ('2025-11-15T22:00:00.000Z');
 * const dateStr = formatLebanonDate(date);
 * // Returns: "2025-11-16" (next day in Lebanon due to timezone)
 */
export function formatLebanonDate(date: Date): string {
  try {
    return formatInTimeZone(date, LEBANON_TZ, "yyyy-MM-dd");
  } catch (error) {
    console.error("[lebanonTime] Error formatting date:", { date, error });
    return format(new Date(), "yyyy-MM-dd");
  }
}

/**
 * Get day of week in Lebanon timezone
 *
 * @param date - Date object
 * @returns Day of week in lowercase (e.g., "monday", "tuesday")
 *
 * @example
 * const date = parseFromLebanonTZ('2025-11-15T22:00:00.000Z');
 * const day = getLebanonDayOfWeek(date);
 * // Returns: "sunday" (in Lebanon timezone)
 */
export function getLebanonDayOfWeek(date: Date): string {
  try {
    return formatInTimeZone(date, LEBANON_TZ, "EEEE").toLowerCase();
  } catch (error) {
    console.error("[lebanonTime] Error getting day of week:", { date, error });
    return "monday";
  }
}

/**
 * Check if a Date is today in Lebanon timezone
 *
 * @param date - Date to check
 * @returns true if the date is today in Lebanon
 */
export function isLebanonToday(date: Date): boolean {
  try {
    const dateDayStr = formatInTimeZone(date, LEBANON_TZ, "yyyy-MM-dd");
    const todayStr = formatInTimeZone(new Date(), LEBANON_TZ, "yyyy-MM-dd");
    return dateDayStr === todayStr;
  } catch (error) {
    console.error("[lebanonTime] Error checking if today:", { date, error });
    return false;
  }
}

/**
 * Check if a Date is tomorrow in Lebanon timezone
 *
 * @param date - Date to check
 * @returns true if the date is tomorrow in Lebanon
 */
export function isLebanonTomorrow(date: Date): boolean {
  try {
    const dateDayStr = formatInTimeZone(date, LEBANON_TZ, "yyyy-MM-dd");
    const nowInLebanon = toZonedTime(new Date(), LEBANON_TZ);
    const tomorrowInLebanon = new Date(nowInLebanon);
    tomorrowInLebanon.setDate(tomorrowInLebanon.getDate() + 1);
    const tomorrowStr = formatInTimeZone(tomorrowInLebanon, LEBANON_TZ, "yyyy-MM-dd");
    return dateDayStr === tomorrowStr;
  } catch (error) {
    console.error("[lebanonTime] Error checking if tomorrow:", { date, error });
    return false;
  }
}

/**
 * Parse a date string (YYYY-MM-DD) to Lebanon timezone Date at start of day
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object representing midnight in Lebanon timezone
 */
export function parseDateInLebanon(dateStr: string): Date {
  try {
    return createLebanonDateTime(dateStr, "00:00");
  } catch (error) {
    console.error("[lebanonTime] Error parsing date:", { dateStr, error });
    throw error;
  }
}

/**
 * Get the time difference in minutes between booking time and now (Lebanon timezone)
 *
 * @param dateStr - Booking date in YYYY-MM-DD format
 * @param timeStr - Booking time in HH:mm format
 * @returns Minutes until booking (negative if in past)
 */
export function getMinutesUntilLebanonTime(
  dateStr: string,
  timeStr: string,
): number {
  try {
    const bookingTime = createLebanonDateTime(dateStr, timeStr);
    const nowInLebanon = getCurrentLebanonTime();
    return Math.floor(
      (bookingTime.getTime() - nowInLebanon.getTime()) / (1000 * 60),
    );
  } catch (error) {
    console.error("[lebanonTime] Error calculating minutes until:", {
      dateStr,
      timeStr,
      error,
    });
    return 0;
  }
}

/**
 * Format a Date to long date string (e.g., "Monday, November 20, 2025") in Lebanon timezone
 */
export function formatLebanonDateLong(date: Date): string {
  try {
    return formatInTimeZone(date, LEBANON_TZ, "EEEE, MMMM d, yyyy");
  } catch (error) {
    console.error("[lebanonTime] Error formatting long date:", { date, error });
    return format(new Date(), "EEEE, MMMM d, yyyy");
  }
}

/**
 * Format a Date to short date string (e.g., "Mon, 20/11") in Lebanon timezone
 */
export function formatLebanonDateShort(date: Date): string {
  try {
    return formatInTimeZone(date, LEBANON_TZ, "EEE, dd/MM");
  } catch (error) {
    console.error("[lebanonTime] Error formatting short date:", {
      date,
      error,
    });
    return format(new Date(), "EEE, dd/MM");
  }
}

/**
 * Format a Date to detailed time string (e.g., "19:00:00") in Lebanon timezone
 */
export function formatLebanonTimeDetailed(date: Date): string {
  try {
    return formatInTimeZone(date, LEBANON_TZ, "HH:mm:ss");
  } catch (error) {
    console.error("[lebanonTime] Error formatting detailed time:", {
      date,
      error,
    });
    return "00:00:00";
  }
}
