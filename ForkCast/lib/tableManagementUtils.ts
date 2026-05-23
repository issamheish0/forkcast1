// lib/tableManagementUtils.ts
import { supabase } from "@/config/supabase";
import { TurnTimeService } from "@/lib/TurnTimeService";
import { VIPService } from "@/lib/VIPService";

export interface TableAssignment {
  tableIds: string[];
  requiresCombination: boolean;
  totalCapacity: number;
  turnTimeMinutes: number;
}

export interface BookingTimeWindow {
  startTime: Date;
  endTime: Date;
  turnTimeMinutes: number;
}

/**
 * Helper to validate table assignment for a booking
 */
export async function validateTableAssignment(
  tableIds: string[],
  partySize: number,
  startTime: Date,
  endTime: Date,
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Check if tables are available
    const { data: conflict } = await supabase.rpc("check_booking_overlap", {
      p_table_ids: tableIds,
      p_start_time: startTime.toISOString(),
      p_end_time: endTime.toISOString(),
    });

    if (conflict) {
      return {
        valid: false,
        error: "Tables are no longer available for this time slot",
      };
    }

    // Verify total capacity
    const { data: tables } = await supabase
      .from("restaurant_tables")
      .select("capacity")
      .in("id", tableIds);

    const totalCapacity = tables?.reduce((sum, t) => sum + t.capacity, 0) || 0;

    if (totalCapacity < partySize) {
      return {
        valid: false,
        error: "Selected tables do not have enough capacity",
      };
    }

    return { valid: true };
  } catch (error) {
    console.error("Error validating table assignment:", error);
    return { valid: false, error: "Failed to validate table assignment" };
  }
}

/**
 * Calculate booking time window including turn time
 */
export async function calculateBookingWindow(
  restaurantId: string,
  bookingDate: Date,
  bookingTime: string,
  partySize: number,
): Promise<BookingTimeWindow> {
  const [hours, minutes] = bookingTime.split(":").map(Number);
  const startTime = new Date(bookingDate);
  startTime.setHours(hours, minutes, 0, 0);

  const turnTimeMinutes = await TurnTimeService.getTurnTime(
    restaurantId,
    partySize,
    startTime,
  );

  const endTime = TurnTimeService.calculateEndTime(startTime, turnTimeMinutes);

  return {
    startTime,
    endTime,
    turnTimeMinutes,
  };
}

/**
 * Format table assignment for display
 */
export function formatTableAssignment(tables: any[]): string {
  if (tables.length === 0) return "No table assigned";

  if (tables.length === 1) {
    return `Table ${tables[0].table_number}`;
  }

  const tableNumbers = tables.map((t) => t.table_number).join(" + ");
  return `Tables ${tableNumbers} (Combined)`;
}

/**
 * Check if user can book extended dates (VIP)
 */
export async function getMaxBookingWindow(
  userId: string,
  restaurantId: string,
  defaultDays: number,
): Promise<number> {
  return VIPService.getMaxBookingDays(userId, restaurantId, defaultDays);
}

/**
 * Check if a booking requires table combination
 */
export function requiresTableCombination(partySize: number): boolean {
  // Generally, parties larger than 4 might need combined tables
  return partySize > 4;
}

/**
 * Get table type display name
 */
export function getTableTypeDisplayName(tableType: string): string {
  if (!tableType) return "Table";

  const displayNames: Record<string, string> = {
    booth: "Booth",
    window: "Window Table",
    patio: "Patio",
    standard: "Standard Table",
    bar: "Bar Seating",
    private: "Private Room",
    any: "Any Table",
  };

  return displayNames[tableType] || tableType;
}

/**
 * Check if a time slot is during peak hours
 */
export function isPeakHour(date: Date): boolean {
  const hour = date.getHours();
  const dayOfWeek = date.getDay();

  // Friday and Saturday 6-9 PM
  if ((dayOfWeek === 5 || dayOfWeek === 6) && hour >= 18 && hour <= 21) {
    return true;
  }

  // Any day 12-2 PM (lunch rush)
  if (hour >= 12 && hour <= 14) {
    return true;
  }

  return false;
}

/**
 * Get suggested party sizes for table combinations
 */
export function getSuggestedPartySizes(maxCapacity: number): number[] {
  const sizes = [];
  for (let i = 1; i <= Math.min(maxCapacity, 12); i++) {
    sizes.push(i);
  }
  return sizes;
}

/**
 * Cleanup old availability data (for maintenance)
 */
export async function cleanupOldBookings(
  daysToKeep: number = 90,
): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { data, error } = await supabase
      .from("bookings")
      .delete()
      .lt("booking_time", cutoffDate.toISOString())
      .in("status", [
        "completed",
        "cancelled_by_user",
        "declined_by_restaurant",
        "no_show",
      ])
      .select("id");

    if (error) throw error;
    return data?.length || 0;
  } catch (error) {
    console.error("Error cleaning up old bookings:", error);
    return 0;
  }
}
