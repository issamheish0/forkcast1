// hooks/useAvailableNowRestaurants.ts — Mock version
import { MOCK_AVAILABLE_NOW } from "@/lib/mockData";

export function useAvailableNowRestaurants(_limit?: number) {
  return {
    restaurants: MOCK_AVAILABLE_NOW,
    loading: false,
    refresh: async (_force?: boolean) => {},
  };
}
