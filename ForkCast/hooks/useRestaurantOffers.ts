// hooks/useRestaurantOffers.ts — Mock version
import { MOCK_OFFERS_MAP } from "@/lib/mockData";

interface RestaurantOfferInfo {
  restaurantId: string;
  offerCount: number;
  maxDiscount: number;
  hasActiveOffer: boolean;
}

export function useRestaurantOffers() {
  const offersMap = MOCK_OFFERS_MAP as Map<string, RestaurantOfferInfo>;

  return {
    offersMap,
    loading: false,
    error: null as string | null,
    getOfferInfo: (restaurantId: string) => offersMap.get(restaurantId),
    hasActiveOffer: (restaurantId: string) => offersMap.has(restaurantId),
    getMaxDiscount: (restaurantId: string) => offersMap.get(restaurantId)?.maxDiscount ?? 0,
    refresh: async () => {},
  };
}
