/**
 * Time format utilities
 * Detects and respects user's device 12h/24h time format preference
 */

/**
 * Detects if the user's device uses 12-hour or 24-hour time format
 * @returns true if device uses 12-hour format, false for 24-hour format
 */
export const uses12HourFormat = (): boolean => {
  try {
    // Create a date and format it with the device's locale settings
    const testDate = new Date(2024, 0, 1, 13, 0, 0); // 1 PM / 13:00
    const timeString = testDate.toLocaleTimeString();

    // If the formatted time includes "PM" or "AM", it's 12-hour format
    return (
      timeString.includes("PM") ||
      timeString.includes("AM") ||
      timeString.includes("pm") ||
      timeString.includes("am")
    );
  } catch (error) {
    // Default to 12-hour format if detection fails
    console.warn("Failed to detect time format preference:", error);
    return true;
  }
};

/**
 * Formats a time string (HH:mm or HH:mm:ss) according to device settings
 * @param timeString - Time in 24-hour format (e.g., "14:30" or "14:30:00")
 * @returns Formatted time string respecting device's 12h/24h preference
 */
export const formatTime = (timeString: string): string => {
  try {
    const [hours, minutes] = timeString.split(":").map(Number);

    if (isNaN(hours) || isNaN(minutes)) {
      return timeString;
    }

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    const use12Hour = uses12HourFormat();

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: use12Hour,
    });
  } catch (error) {
    console.warn("Error formatting time:", timeString, error);
    return timeString;
  }
};

/**
 * Formats a Date object to time string according to device settings
 * @param date - Date object to format
 * @returns Formatted time string respecting device's 12h/24h preference
 */
export const formatTimeFromDate = (date: Date): string => {
  try {
    const use12Hour = uses12HourFormat();

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: use12Hour,
    });
  } catch (error) {
    console.warn("Error formatting time from date:", error);
    return date.toLocaleTimeString();
  }
};

/**
 * Formats a time string with full options (hour, minute, optional second)
 * @param timeString - Time in 24-hour format
 * @param includeSeconds - Whether to include seconds in output
 * @returns Formatted time string
 */
export const formatTimeDetailed = (
  timeString: string,
  includeSeconds: boolean = false,
): string => {
  try {
    const parts = timeString.split(":").map(Number);
    const [hours, minutes, seconds = 0] = parts;

    if (isNaN(hours) || isNaN(minutes)) {
      return timeString;
    }

    const date = new Date();
    date.setHours(hours, minutes, seconds, 0);

    const use12Hour = uses12HourFormat();

    const options: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      hour12: use12Hour,
    };

    if (includeSeconds) {
      options.second = "2-digit";
    }

    return date.toLocaleTimeString([], options);
  } catch (error) {
    console.warn("Error formatting detailed time:", timeString, error);
    return timeString;
  }
};

/**
 * Gets the time format pattern for display purposes
 * @returns Example time format string (e.g., "2:30 PM" or "14:30")
 */
export const getTimeFormatExample = (): string => {
  const use12Hour = uses12HourFormat();
  return use12Hour ? "2:30 PM" : "14:30";
};
