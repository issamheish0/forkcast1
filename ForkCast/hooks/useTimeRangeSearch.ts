// hooks/useTimeRangeSearch.ts — Mock stub
import type { TimeRangeSearchParams, TimeRangeResult } from "@/components/booking/TimeRangeSelector";

export function useTimeRangeSearch() {
  return {
    searchTimeRange: async (_params: TimeRangeSearchParams): Promise<TimeRangeResult[]> => [],
    createSearchFunction: (_restaurantId: string) =>
      async (_params: TimeRangeSearchParams): Promise<TimeRangeResult[]> => [],
    loading: false,
    error: null as string | null,
  };
}