// lib/hoursFormatter.ts
// Shared hours formatter utility for shift-based hours

export type Shift = { open: string; close: string };

export function formatShiftHours(
  shifts?: Shift[],
  emptyText = "Not available",
): string {
  if (!shifts || shifts.length === 0) return emptyText;
  return shifts.map((s) => `${s.open}-${s.close}`).join(", ");
}

export function formatTodayHoursFromAvailability(
  formatOperatingHours: () => string,
): string {
  // Thin wrapper to keep a common API
  return formatOperatingHours();
}
