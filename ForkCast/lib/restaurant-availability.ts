// lib/restaurant-availability.ts
import { supabase } from "@/config/supabase";
import { format } from "date-fns";
import { formatTime } from "@/utils/timeFormat";

export interface RestaurantHours {
  id: string;
  restaurant_id: string;
  day_of_week: string;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

export interface SpecialHours {
  id: string;
  restaurant_id: string;
  date: string;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
  reason: string | null;
}

export interface Closure {
  id: string;
  restaurant_id: string;
  start_date: string;
  end_date: string;
  reason: string;
}

export class RestaurantAvailability {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Check if a restaurant is open at a specific date and time (MULTIPLE SHIFTS SUPPORT)
   */
  async isRestaurantOpen(
    restaurantId: string,
    date: Date,
    time?: string, // Format: "HH:mm"
  ): Promise<{
    isOpen: boolean;
    reason?: string;
    hours?: { open: string; close: string }[]; // UPDATED: Array for multiple shifts
  }> {
    try {
      const {
        formatLebanonDate,
        getLebanonDayOfWeek,
        getCurrentLebanonTime,
      } = require("@/utils/lebanonTime");
      const dateStr = formatLebanonDate(date);
      const dayOfWeek = getLebanonDayOfWeek(date);
      const cacheKey = `${restaurantId}-${dateStr}-${time || "all"}`;

      // Check cache
      const cached = this.cache.get(cacheKey);
      const nowInLebanon = getCurrentLebanonTime();
      if (
        cached &&
        nowInLebanon.getTime() - cached.timestamp < this.cacheTimeout
      ) {
        return cached.data;
      }

      // Check for closures first
      const { data: closures, error: closureError } = await supabase
        .from("restaurant_closures")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .lte("start_date", dateStr)
        .gte("end_date", dateStr)
        .maybeSingle(); // Still use maybeSingle for closures

      if (closureError && closureError.code !== "PGRST116") {
        console.error("Error checking closures:", closureError);
        throw new Error("Failed to check restaurant availability");
      }

      if (closures) {
        // Check if it's a full day closure or partial closure
        if (!closures.start_time && !closures.end_time) {
          // Full day closure
          const result = {
            isOpen: false,
            reason: closures.reason || "Temporarily closed",
          };
          this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
          return result;
        } else if (closures.start_time && closures.end_time && time) {
          // Partial closure - check if the requested time falls within closure hours
          if (
            this.isTimeWithinRange(time, closures.start_time, closures.end_time)
          ) {
            const result = {
              isOpen: false,
              reason: `${closures.reason || "Temporarily closed"} (${this.formatTimeInternal(closures.start_time)} - ${this.formatTimeInternal(closures.end_time)})`,
            };
            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
          }
          // If time is outside closure hours, continue with normal availability check
        }
      }

      // Check for special hours
      const { data: specialHours, error: specialError } = await supabase
        .from("restaurant_special_hours")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("date", dateStr)
        .maybeSingle(); // Still use maybeSingle for special hours (one per date)

      if (specialError && specialError.code !== "PGRST116") {
        console.error("Error checking special hours:", specialError);
        throw new Error("Failed to check restaurant availability");
      }

      if (specialHours) {
        if (specialHours.is_closed) {
          const result = {
            isOpen: false,
            reason: specialHours.reason || "Closed for special occasion",
          };
          this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
          return result;
        }

        // If time is provided, check if it's within special hours
        if (time && specialHours.open_time && specialHours.close_time) {
          const isWithinHours = this.isTimeWithinRange(
            time,
            specialHours.open_time,
            specialHours.close_time,
          );
          const result = {
            isOpen: isWithinHours,
            hours: [
              {
                open: specialHours.open_time,
                close: specialHours.close_time,
              },
            ],
          };
          this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
          return result;
        }

        const result = {
          isOpen: true,
          hours:
            specialHours.open_time && specialHours.close_time
              ? [
                  {
                    open: specialHours.open_time,
                    close: specialHours.close_time,
                  },
                ]
              : undefined,
        };
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      }

      // UPDATED: Check ALL regular hour shifts for the day
      const { data: regularHours, error: regularError } = await supabase
        .from("restaurant_hours")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("day_of_week", dayOfWeek)
        .eq("is_open", true)
        .order("open_time", { ascending: true }); // Order by opening time

      if (regularError) {
        console.error("Error checking regular hours:", regularError);
        throw new Error("Failed to check restaurant availability");
      }

      if (!regularHours || regularHours.length === 0) {
        const result = {
          isOpen: false,
          reason: "Closed today",
        };
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      }

      // UPDATED: Collect all shifts
      const shifts = regularHours
        .filter((shift) => shift.open_time && shift.close_time)
        .map((shift) => ({
          open: shift.open_time!,
          close: shift.close_time!,
        }));

      // If time is provided, check if it's within ANY shift
      if (time) {
        let isWithinAnyShift = false;
        let currentShift = null;

        for (const shift of shifts) {
          if (this.isTimeWithinRange(time, shift.open, shift.close)) {
            isWithinAnyShift = true;
            currentShift = shift;
            break;
          }
        }

        const result = {
          isOpen: isWithinAnyShift,
          hours: currentShift ? [currentShift] : shifts,
          reason: !isWithinAnyShift
            ? "Restaurant is closed at this time"
            : undefined,
        };
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      }

      // If no specific time, return all shifts
      const result = {
        isOpen: true,
        hours: shifts,
      };
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.error("Error in isRestaurantOpen:", error);
      // Fallback to basic availability
      return {
        isOpen: true,
        reason: "Unable to verify hours",
      };
    }
  }

  /**
   * Clear cache for a specific restaurant
   */
  clearCache(restaurantId?: string) {
    if (restaurantId) {
      // Clear specific restaurant cache
      Array.from(this.cache.keys())
        .filter((key) => key.startsWith(restaurantId))
        .forEach((key) => this.cache.delete(key));
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }

  /**
   * Get available time slots for a specific date (MULTIPLE SHIFTS SUPPORT with PARTIAL CLOSURE filtering)
   */
  async getAvailableTimeSlots(
    restaurantId: string,
    date: Date,
    partySize: number,
    slotDuration: number = 30, // minutes
  ): Promise<string[]> {
    const availability = await this.isRestaurantOpen(restaurantId, date);

    if (!availability.isOpen || !availability.hours) {
      return [];
    }

    // Get closures for this date to filter out partial closures
    const { formatLebanonDate } = require("@/utils/lebanonTime");
    const dateStr = formatLebanonDate(date);
    const { data: closures } = await supabase
      .from("restaurant_closures")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .lte("start_date", dateStr)
      .gte("end_date", dateStr);

    const partialClosure = closures?.find(
      (closure) => closure.start_time && closure.end_time,
    );

    const slots: string[] = [];
    const mealDuration = 90; // Assume 90 minutes for a meal

    // UPDATED: Generate slots for ALL shifts
    for (const shift of availability.hours) {
      const [openHour, openMin] = shift.open.split(":").map(Number);
      const [closeHour, closeMin] = shift.close.split(":").map(Number);

      const startMinutes = openHour * 60 + openMin;
      const endMinutes = closeHour * 60 + closeMin;

      // Generate slots for this shift
      for (
        let minutes = startMinutes;
        minutes < endMinutes;
        minutes += slotDuration
      ) {
        const hour = Math.floor(minutes / 60);
        const min = minutes % 60;
        const timeStr = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;

        // Check if there's enough time before closing for a typical meal
        if (minutes + mealDuration <= endMinutes) {
          // Check if this slot conflicts with any partial closure
          let isSlotAvailable = true;

          if (
            partialClosure &&
            partialClosure.start_time &&
            partialClosure.end_time
          ) {
            // Check if the slot (and meal duration) overlaps with partial closure
            const slotEndTime = `${Math.floor((minutes + mealDuration) / 60)
              .toString()
              .padStart(
                2,
                "0",
              )}:${((minutes + mealDuration) % 60).toString().padStart(2, "0")}`;

            // Slot conflicts if it starts during closure or ends during closure
            if (
              this.isTimeWithinRange(
                timeStr,
                partialClosure.start_time,
                partialClosure.end_time,
              ) ||
              this.isTimeWithinRange(
                slotEndTime,
                partialClosure.start_time,
                partialClosure.end_time,
              ) ||
              (this.isTimeWithinRange(
                partialClosure.start_time,
                timeStr,
                slotEndTime,
              ) &&
                this.isTimeWithinRange(
                  partialClosure.end_time,
                  timeStr,
                  slotEndTime,
                ))
            ) {
              isSlotAvailable = false;
            }
          }

          if (isSlotAvailable) {
            slots.push(timeStr);
          }
        }
      }
    }

    // Remove duplicates and sort
    return [...new Set(slots)].sort();
  }

  /**
   * Get restaurant hours for a week (MULTIPLE SHIFTS SUPPORT)
   */
  async getWeeklyHours(restaurantId: string): Promise<RestaurantHours[]> {
    const { data, error } = await supabase
      .from("restaurant_hours")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("day_of_week")
      .order("open_time"); // UPDATED: Also order by open time for multiple shifts

    if (error) {
      console.error("Error fetching weekly hours:", error);
      return [];
    }

    return data || [];
  }

  /**
   * Get restaurant shifts grouped by day
   */
  async getWeeklyShifts(
    restaurantId: string,
  ): Promise<Record<string, RestaurantHours[]>> {
    const hours = await this.getWeeklyHours(restaurantId);
    const shiftsByDay: Record<string, RestaurantHours[]> = {};

    for (const hour of hours) {
      if (!shiftsByDay[hour.day_of_week]) {
        shiftsByDay[hour.day_of_week] = [];
      }
      shiftsByDay[hour.day_of_week].push(hour);
    }

    return shiftsByDay;
  }

  /**
   * Get upcoming special hours and closures
   */
  async getUpcomingSpecialSchedule(restaurantId: string) {
    const {
      getCurrentLebanonTime,
      formatLebanonDate,
    } = require("@/utils/lebanonTime");
    const today = formatLebanonDate(getCurrentLebanonTime());

    const [specialHours, closures] = await Promise.all([
      supabase
        .from("restaurant_special_hours")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .gte("date", today)
        .order("date", { ascending: true }),
      supabase
        .from("restaurant_closures")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .gte("end_date", today)
        .order("start_date", { ascending: true }),
    ]);

    return {
      specialHours: specialHours.data || [],
      closures: closures.data || [],
    };
  }

  /**
   * Helper function to check if a time is within a range
   */
  private isTimeWithinRange(
    time: string,
    openTime: string,
    closeTime: string,
  ): boolean {
    const [hour, minute] = time.split(":").map(Number);
    const [openHour, openMinute] = openTime.split(":").map(Number);
    const [closeHour, closeMinute] = closeTime.split(":").map(Number);

    const currentMinutes = hour * 60 + minute;
    const openMinutes = openHour * 60 + openMinute;
    const closeMinutes = closeHour * 60 + closeMinute;

    // Handle cases where closing time is after midnight
    if (closeMinutes < openMinutes) {
      // Restaurant closes after midnight
      return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    }

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  }

  /**
   * Format a time string into a readable format
   */
  private formatTimeInternal(time: string): string {
    return formatTime(time);
  }

  /**
   * Format hours for display (MULTIPLE SHIFTS SUPPORT)
   */
  formatHoursDisplay(
    hours: { open: string; close: string } | { open: string; close: string }[],
  ): string {
    // Handle single shift (backward compatibility)
    if (!Array.isArray(hours)) {
      return `${this.formatTimeInternal(hours.open)} - ${this.formatTimeInternal(hours.close)}`;
    }

    // Handle multiple shifts
    if (hours.length === 0) return "Closed";

    if (hours.length === 1) {
      return `${this.formatTimeInternal(hours[0].open)} - ${this.formatTimeInternal(hours[0].close)}`;
    }

    // Multiple shifts format
    return hours
      .map(
        (shift) =>
          `${this.formatTimeInternal(shift.open)} - ${this.formatTimeInternal(shift.close)}`,
      )
      .join(", ");
  }
}
