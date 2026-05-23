// hooks/useRestaurantEvents.ts — Mock stub
import { useState } from "react";

export function useRestaurantEvents(
  _restaurantId: string | undefined,
  _daysAhead: number = 30,
) {
  return {
    events: [] as any[],
    upcomingOccurrences: [] as any[],
    loading: false,
    error: null as Error | null,
    refetch: async () => {},
    hasEvents: false,
  };
}

export function useEventDetails(_eventId: string | undefined) {
  return {
    event: null as any,
    loading: false,
    error: null as Error | null,
    refetch: async () => {},
  };
}