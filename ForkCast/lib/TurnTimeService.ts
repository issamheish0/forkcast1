// lib/turntime/TurnTimeService.ts
import { supabase } from "@/config/supabase";

export interface TurnTimeConfig {
  restaurant_id: string;
  party_size: number;
  turn_time_minutes: number;
  day_of_week?: number; // 0-6, null for all days
}

export interface TurnTimeRule {
  minPartySize: number;
  maxPartySize: number;
  defaultMinutes: number;
  rushHourMinutes?: number;
  description: string;
}

export class TurnTimeService {
  // Default turn time rules
  private static defaultRules: TurnTimeRule[] = [
    {
      minPartySize: 1,
      maxPartySize: 2,
      defaultMinutes: 90,
      rushHourMinutes: 75,
      description: "Small party",
    },
    {
      minPartySize: 3,
      maxPartySize: 4,
      defaultMinutes: 120,
      rushHourMinutes: 105,
      description: "Medium party",
    },
    {
      minPartySize: 5,
      maxPartySize: 6,
      defaultMinutes: 150,
      rushHourMinutes: 135,
      description: "Large party",
    },
    {
      minPartySize: 7,
      maxPartySize: 12,
      defaultMinutes: 180,
      rushHourMinutes: 165,
      description: "Extra large party",
    },
    {
      minPartySize: 13,
      maxPartySize: 999,
      defaultMinutes: 240,
      rushHourMinutes: 210,
      description: "Special event",
    },
  ];

  /**
   * Get turn time for a specific booking
   */
  static async getTurnTime(
    restaurantId: string,
    partySize: number,
    bookingTime: Date,
  ): Promise<number> {
    try {
      // First, check for custom configuration
      const dayOfWeek = bookingTime.getDay();

      const { data: customTime } = await supabase
        .from("restaurant_turn_times")
        .select("turn_time_minutes")
        .eq("restaurant_id", restaurantId)
        .eq("party_size", partySize)
        .or(`day_of_week.eq.${dayOfWeek},day_of_week.is.null`)
        .order("day_of_week", { ascending: false, nullsFirst: false })
        .limit(1)
        .single();

      if (customTime) {
        return customTime.turn_time_minutes;
      }

      // Fall back to default rules
      return this.getDefaultTurnTime(partySize, bookingTime);
    } catch (error) {
      console.error("Error getting turn time:", error);
      return this.getDefaultTurnTime(partySize, bookingTime);
    }
  }

  /**
   * Get default turn time based on party size and time
   */
  static getDefaultTurnTime(partySize: number, bookingTime: Date): number {
    const rule = this.defaultRules.find(
      (r) => partySize >= r.minPartySize && partySize <= r.maxPartySize,
    );

    if (!rule) {
      // Fallback for parties outside defined ranges
      console.warn(
        `No turn time rule found for party size ${partySize}, using maximum`,
      );
      return 240; // 4 hours for very large events
    }

    // Check if it's rush hour (6-9 PM on Fri/Sat)
    const hour = bookingTime.getHours();
    const dayOfWeek = bookingTime.getDay();
    const isRushHour =
      (dayOfWeek === 5 || dayOfWeek === 6) && hour >= 18 && hour <= 21;

    return isRushHour && rule.rushHourMinutes
      ? rule.rushHourMinutes
      : rule.defaultMinutes;
  }

  /**
   * Set custom turn time for a restaurant
   */
  static async setCustomTurnTime(
    restaurantId: string,
    partySize: number,
    minutes: number,
    dayOfWeek?: number,
  ): Promise<boolean> {
    try {
      const { error } = await supabase.from("restaurant_turn_times").upsert({
        restaurant_id: restaurantId,
        party_size: partySize,
        turn_time_minutes: minutes,
        day_of_week: dayOfWeek || null,
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error setting custom turn time:", error);
      return false;
    }
  }

  /**
   * Get all turn time configurations for a restaurant
   */
  static async getRestaurantTurnTimes(
    restaurantId: string,
  ): Promise<TurnTimeConfig[]> {
    try {
      const { data, error } = await supabase
        .from("restaurant_turn_times")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("party_size", { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching restaurant turn times:", error);
      return [];
    }
  }

  /**
   * Delete custom turn time configuration
   */
  static async deleteCustomTurnTime(
    restaurantId: string,
    partySize: number,
    dayOfWeek?: number,
  ): Promise<boolean> {
    try {
      let query = supabase
        .from("restaurant_turn_times")
        .delete()
        .eq("restaurant_id", restaurantId)
        .eq("party_size", partySize);

      if (dayOfWeek !== undefined) {
        query = query.eq("day_of_week", dayOfWeek);
      } else {
        query = query.is("day_of_week", null);
      }

      const { error } = await query;
      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error deleting custom turn time:", error);
      return false;
    }
  }

  /**
   * Get turn time summary for display
   */
  static getTurnTimeSummary(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) {
      return `${mins} minutes`;
    } else if (mins === 0) {
      return `${hours} hour${hours > 1 ? "s" : ""}`;
    } else {
      return `${hours} hour${hours > 1 ? "s" : ""} ${mins} minutes`;
    }
  }

  /**
   * Calculate estimated end time
   */
  static calculateEndTime(startTime: Date, turnTimeMinutes: number): Date {
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + turnTimeMinutes);
    return endTime;
  }
}
