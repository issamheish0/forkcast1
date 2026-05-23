// hooks/useRestaurantsWithOffers.ts — Mock version
import { useState } from "react";
import { MOCK_RESTAURANTS_WITH_OFFERS } from "@/lib/mockData";

interface RestaurantWithOffer {
  id: string;
  name: string;
  main_image_url: string | null;
  cuisine_type: string | null;
  secondary_cuisines: string[] | null;
  price_range?: number;
  average_rating?: number | null;
  total_reviews?: number | null;
  location?: unknown;
  discount: number;
}

interface UseRestaurantsWithOffersReturn {
  restaurants: RestaurantWithOffer[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRestaurantsWithOffers(): UseRestaurantsWithOffersReturn {
  return {
    restaurants: MOCK_RESTAURANTS_WITH_OFFERS as RestaurantWithOffer[],
    loading: false,
    error: null,
    refresh: async () => {},
  };
}
