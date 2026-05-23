// hooks/useAvailability.ts — Supabase-backed time slot availability
import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { supabase } from "@/config/supabase";
import { createLebanonDateTime, LEBANON_TZ } from "@/utils/lebanonTime";
import type { SlotTableOptions, TableOption } from "@/lib/AvailabilityService";
export type { SlotTableOptions, TableOption } from "@/lib/AvailabilityService";

export interface TimeSlot {
  time: string;        // "19:00"
  label: string;       // "7:00 PM"
  available: boolean;
  totalCapacity: number;
  bookedCount: number;  // sum of party_size of overlapping bookings
  isPopular?: boolean;
}

export interface UseAvailabilityOptions {
  restaurantId: string;
  date: Date;
  partySize: number;
  enableRealtime?: boolean;
  mode?: "time-first" | "full";
  preloadNext?: boolean;
}

const DAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const SLOT_INTERVAL_MIN = 30;

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function useAvailability({ restaurantId, date, partySize }: UseAvailabilityOptions) {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [timeSlotsLoading, setTimeSlotsLoading] = useState(true);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedSlotOptions, setSelectedSlotOptions] = useState<SlotTableOptions | null>(null);
  const [slotOptionsLoading, setSlotOptionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restaurantTier, setRestaurantTier] = useState<string | null>(null);
  const lastUpdate = useRef(0);

  const loadSlots = useCallback(async () => {
    if (!restaurantId) return;
    setTimeSlotsLoading(true);
    setError(null);

    try {
      const dayName = DAYS[date.getDay()];
      const dateStr = format(date, "yyyy-MM-dd");

      // 1. Fetch restaurant meta + open hours for the day
      const [restRes, hoursRes, tablesRes] = await Promise.all([
        supabase
          .from("restaurants")
          .select("table_turnover_minutes, tier, status, booking_policy")
          .eq("id", restaurantId)
          .single(),
        supabase
          .from("restaurant_open_hours")
          .select("open_time, close_time, is_open, service_type")
          .eq("restaurant_id", restaurantId)
          .eq("day_of_week", dayName)
          .eq("is_open", true),
        supabase
          .from("restaurant_tables")
          .select("capacity")
          .eq("restaurant_id", restaurantId)
          .eq("is_active", true),
      ]);

      if (restRes.error) throw restRes.error;
      const rest = restRes.data;
      setRestaurantTier(rest?.tier ?? null);

      const turnover = rest?.table_turnover_minutes ?? 120;
      const totalCapacity = (tablesRes.data ?? []).reduce(
        (sum, t) => sum + (t.capacity ?? 0),
        0,
      );

      // Use first open hours entry (prefer 'general' or 'dinner')
      const hours = (hoursRes.data ?? []).sort((a, b) => {
        const order = ["general", "dinner", "lunch", "breakfast", "bar", "kitchen"];
        return order.indexOf(a.service_type) - order.indexOf(b.service_type);
      })[0];

      if (!hours) {
        setTimeSlots([]);
        setTimeSlotsLoading(false);
        return;
      }

      const openMin = toMinutes(hours.open_time);
      const closeMin = toMinutes(hours.close_time);
      // Last slot: guests must finish by closing → last booking = close - turnover
      const lastSlotMin = closeMin - turnover;

      // 2. Fetch bookings for this restaurant on this date
      const dayStart = createLebanonDateTime(dateStr, "00:00").toISOString();
      const dayEnd = createLebanonDateTime(dateStr, "23:59").toISOString();

      const { data: bookings } = await supabase
        .from("bookings")
        .select("booking_time, party_size, status")
        .eq("restaurant_id", restaurantId)
        .in("status", ["pending", "confirmed", "seated"])
        .gte("booking_time", dayStart)
        .lte("booking_time", dayEnd);

      // 3. Generate slots
      const slots: TimeSlot[] = [];
      for (let m = openMin; m <= lastSlotMin; m += SLOT_INTERVAL_MIN) {
        const slotTime = fromMinutes(m);
        const slotStart = m;
        const slotEnd = m + turnover;

        // Count bookings whose window overlaps this slot
        let bookedCount = 0;
        for (const bk of bookings ?? []) {
          const bkLocal = toZonedTime(new Date(bk.booking_time), LEBANON_TZ);
          const bkMin = bkLocal.getHours() * 60 + bkLocal.getMinutes();
          const bkEnd = bkMin + turnover;
          // Overlap if not (bkEnd <= slotStart || bkMin >= slotEnd)
          if (!(bkEnd <= slotStart || bkMin >= slotEnd)) {
            bookedCount += bk.party_size ?? 1;
          }
        }

        const available = totalCapacity === 0
          ? true  // no tables configured yet → allow
          : bookedCount + partySize <= totalCapacity;

        slots.push({
          time: slotTime,
          label: formatLabel(slotTime),
          available,
          totalCapacity,
          bookedCount,
          isPopular: m >= 19 * 60 && m <= 21 * 60, // 7–9 PM popular
        });
      }

      lastUpdate.current = Date.now();
      setTimeSlots(slots);
    } catch (e: any) {
      setError(e.message ?? "Failed to load availability");
    } finally {
      setTimeSlotsLoading(false);
    }
  }, [restaurantId, date, partySize]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const fetchSlotOptions = useCallback(
    async (time: string) => {
      setSelectedTime(time);
      setSlotOptionsLoading(true);
      try {
        const { data } = await supabase
          .from("restaurant_tables")
          .select(`
            id, table_number, table_type, capacity, features,
            section:restaurant_sections(name)
          `)
          .eq("restaurant_id", restaurantId)
          .eq("is_active", true)
          .gte("capacity", partySize)
          .order("priority_score", { ascending: false });

        const EXPERIENCE_MAP: Record<string, { title: string; desc: string }> = {
          booth:    { title: "Cozy Booth",       desc: "Intimate, semi-private seating perfect for relaxed dining" },
          window:   { title: "Window Table",    desc: "Enjoy natural light and views while you dine" },
          patio:    { title: "Outdoor Patio",   desc: "Al fresco dining in the open air" },
          bar:      { title: "Bar Seating",     desc: "Lively atmosphere at the bar" },
          private:  { title: "Private Room",    desc: "Exclusive, fully private dining experience" },
          standard: { title: "Standard Table",  desc: "Classic comfortable table seating" },
        };

        const options: TableOption[] = (data ?? []).map((t: any) => {
          const exp = EXPERIENCE_MAP[t.table_type] ?? EXPERIENCE_MAP.standard;
          return {
            id: t.id,
            experienceTitle: exp.title,
            experienceDescription: exp.desc,
            tableTypes: [t.table_type ?? "standard"],
            requiresCombination: false,
            totalCapacity: t.capacity ?? partySize,
            isPerfectFit: (t.capacity ?? partySize) === partySize,
            tables: [{ id: t.id, table_number: t.table_number, capacity: t.capacity, table_type: t.table_type }],
          };
        });

        setSelectedSlotOptions(
          options.length > 0
            ? { time, options, primaryOption: options[0] }
            : null,
        );
      } catch {
        setSelectedSlotOptions(null);
      } finally {
        setSlotOptionsLoading(false);
      }
    },
    [restaurantId, partySize],
  );

  const clearSelectedSlot = useCallback(() => {
    setSelectedTime(null);
    setSelectedSlotOptions(null);
  }, []);

  const findSlot = useCallback(
    (time: string) => timeSlots.find((s) => s.time === time) ?? null,
    [timeSlots],
  );

  const hasAvailability = timeSlots.some((s) => s.available);
  const isBasicTier = restaurantTier === "basic" || restaurantTier === null;

  return {
    timeSlots,
    timeSlotsLoading,
    selectedSlotOptions,
    selectedTime,
    slotOptionsLoading,
    error,
    lastUpdate: lastUpdate.current,
    fetchSlotOptions,
    clearSelectedSlot,
    refresh: loadSlots,
    findSlot,
    restaurantTier,
    hasAvailability,
    nextAvailableDate: null,
    // Aliases expected by availability.tsx
    isLoading: timeSlotsLoading,
    hasTimeSlots: timeSlots.length > 0,
    hasSelectedSlot: selectedSlotOptions !== null,
    experienceCount: selectedSlotOptions?.options.length ?? 0,
    isBasicTier,
  };
}

export function useAvailabilityLegacy(options: Omit<UseAvailabilityOptions, "mode">) {
  const { timeSlots, timeSlotsLoading, error, refresh } = useAvailability(options);
  return {
    slots: timeSlots,
    loading: timeSlotsLoading,
    error,
    refresh,
    isEmpty: timeSlots.length === 0,
    hasSlots: timeSlots.length > 0,
  };
}

export function useSlotAvailability({
  restaurantId,
  date,
  time,
  partySize,
}: {
  restaurantId: string;
  date: Date;
  time: string;
  partySize: number;
}) {
  const { findSlot, timeSlotsLoading, refresh } = useAvailability({
    restaurantId,
    date,
    partySize,
  });
  const slot = findSlot(time);
  return {
    isAvailable: slot?.available ?? false,
    checking: timeSlotsLoading,
    refresh,
  };
}

export function useAvailabilityPreloader() {
  return {
    preloadRestaurant: (_restaurantId: string, _partySizes?: number[]) => {},
  };
}
