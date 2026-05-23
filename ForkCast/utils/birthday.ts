// Birthday and age-related utility functions

/**
 * Convert date from DD-MM-YYYY format to YYYY-MM-DD format (for database storage)
 */
export function convertDDMMYYYYToYYYYMMDD(dateString: string): string {
  if (!dateString) return "";

  // Handle DD-MM-YYYY format
  const ddmmyyyyRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
  const match = dateString.match(ddmmyyyyRegex);

  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }

  // If already in YYYY-MM-DD format, return as is
  const yyyymmddRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (yyyymmddRegex.test(dateString)) {
    return dateString;
  }

  return dateString; // Return original if format is unrecognized
}

/**
 * Convert date from YYYY-MM-DD format to DD-MM-YYYY format (for display)
 */
export function convertYYYYMMDDToDDMMYYYY(dateString: string): string {
  if (!dateString) return "";

  // Handle YYYY-MM-DD format
  const yyyymmddRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = dateString.match(yyyymmddRegex);

  if (match) {
    const [, year, month, day] = match;
    return `${day}-${month}-${year}`;
  }

  // If already in DD-MM-YYYY format, return as is
  const ddmmyyyyRegex = /^\d{2}-\d{2}-\d{4}$/;
  if (ddmmyyyyRegex.test(dateString)) {
    return dateString;
  }

  return dateString; // Return original if format is unrecognized
}

/**
 * Format date input with automatic dashes for DD-MM-YYYY format
 */
export function formatDDMMYYYYInput(value: string): string {
  // Remove all non-numeric characters
  const numbers = value.replace(/\D/g, "");

  // Apply formatting based on length
  if (numbers.length <= 2) {
    return numbers;
  } else if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
  } else {
    return `${numbers.slice(0, 2)}-${numbers.slice(2, 4)}-${numbers.slice(4, 8)}`;
  }
}

/**
 * Validate DD-MM-YYYY date format
 */
export function isValidDDMMYYYYFormat(dateString: string): boolean {
  const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
  const match = dateString.match(dateRegex);

  if (!match) return false;

  const [, day, month, year] = match;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  return (
    date instanceof Date &&
    !isNaN(date.getTime()) &&
    date.getDate() === parseInt(day) &&
    date.getMonth() === parseInt(month) - 1 &&
    date.getFullYear() === parseInt(year)
  );
}

/**
 * Calculate age from date of birth (handles both DD-MM-YYYY and YYYY-MM-DD formats)
 */
export function calculateAge(dateOfBirth: string): number {
  if (!dateOfBirth) return 0;

  const today = new Date();
  let birthDate: Date;

  // Convert DD-MM-YYYY to YYYY-MM-DD if needed for Date constructor
  const yyyymmddFormat = convertDDMMYYYYToYYYYMMDD(dateOfBirth);
  birthDate = new Date(yyyymmddFormat);

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}

/**
 * Check if today is the user's birthday (handles both DD-MM-YYYY and YYYY-MM-DD formats)
 */
export function isBirthday(dateOfBirth: string): boolean {
  if (!dateOfBirth) return false;

  const today = new Date();

  // Convert DD-MM-YYYY to YYYY-MM-DD if needed for Date constructor
  const yyyymmddFormat = convertDDMMYYYYToYYYYMMDD(dateOfBirth);
  const birthDate = new Date(yyyymmddFormat);

  return (
    today.getMonth() === birthDate.getMonth() &&
    today.getDate() === birthDate.getDate()
  );
}

/**
 * Check if user's birthday is within the next N days (handles both DD-MM-YYYY and YYYY-MM-DD formats)
 */
export function isBirthdayUpcoming(
  dateOfBirth: string,
  daysAhead: number = 7,
): boolean {
  if (!dateOfBirth) return false;

  const today = new Date();
  const thisYear = today.getFullYear();

  // Convert DD-MM-YYYY to YYYY-MM-DD if needed for Date constructor
  const yyyymmddFormat = convertDDMMYYYYToYYYYMMDD(dateOfBirth);
  const birthDate = new Date(yyyymmddFormat);

  // Create birthday date for this year
  const thisBirthday = new Date(
    thisYear,
    birthDate.getMonth(),
    birthDate.getDate(),
  );

  // If birthday already passed this year, check next year
  if (thisBirthday < today) {
    thisBirthday.setFullYear(thisYear + 1);
  }

  const diffTime = thisBirthday.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays >= 0 && diffDays <= daysAhead;
}

/**
 * Format birthday message
 */
export function getBirthdayMessage(name: string): string {
  const messages = [
    `🎉 Happy Birthday, ${name}! Hope you have a wonderful day!`,
    `🎂 It's your special day, ${name}! Enjoy every moment!`,
    `🎈 Wishing you a fantastic birthday, ${name}!`,
    `🥳 Happy Birthday, ${name}! May all your wishes come true!`,
  ];

  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Get age group for targeted offers
 */
export function getAgeGroup(dateOfBirth: string): string {
  const age = calculateAge(dateOfBirth);

  if (age < 18) return "teen";
  if (age < 25) return "young_adult";
  if (age < 35) return "adult";
  if (age < 50) return "middle_age";
  if (age < 65) return "mature";
  return "senior";
}

/**
 * Format a Date object to DD/MM/YYYY string
 */
export function formatDateToDDMMYYYY(date: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return "";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Format a Date object to DD/MM/YYYY with day name (e.g., "Monday, 15/03/2024")
 */
export function formatDateWithDayName(date: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return "";
  }

  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const dayName = dayNames[date.getDay()];
  const formatted = formatDateToDDMMYYYY(date);

  return `${dayName}, ${formatted}`;
}

/**
 * Format a Date object to short format with day name (e.g., "Mon, 15/03")
 */
export function formatDateShort(date: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return "";
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayName = dayNames[date.getDay()];
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${dayName}, ${day}/${month}`;
}

/**
 * Format a Date object to long format (e.g., "Monday, 15 March 2024")
 */
export function formatDateLong(date: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return "";
  }

  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayName = dayNames[date.getDay()];
  const day = date.getDate();
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  return `${dayName}, ${day} ${month} ${year}`;
}

/**
 * Format a Date object to medium format (e.g., "15 March 2024")
 */
export function formatDateMedium(date: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return "";
  }

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const day = date.getDate();
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * Format a date string (YYYY-MM-DD) to DD/MM/YYYY
 */
export function formatISODateToDDMMYYYY(isoDateString: string): string {
  if (!isoDateString) return "";

  try {
    const date = new Date(isoDateString);
    return formatDateToDDMMYYYY(date);
  } catch (error) {
    console.warn("Error formatting ISO date:", isoDateString, error);
    return isoDateString;
  }
}

/**
 * Parse DD/MM/YYYY string to Date object
 */
export function parseDDMMYYYYToDate(dateString: string): Date | null {
  if (!dateString) return null;

  const parts = dateString.split("/");
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const year = parseInt(parts[2], 10);

  const date = new Date(year, month, day);

  // Validate the date
  if (
    date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day
  ) {
    return date;
  }

  return null;
}
