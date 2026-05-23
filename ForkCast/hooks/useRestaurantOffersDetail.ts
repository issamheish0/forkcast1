// hooks/useRestaurantOffersDetail.ts — Mock stub
export interface Offer {
  id: string;
  title: string;
  description: string | null;
  discount_percentage: number | null;
  valid_from: string;
  valid_until: string;
  minimum_party_size: number | null;
  applicable_days: number[] | null;
  img_url: string | null;
}

export interface OfferWithUsageStatus extends Offer {
  isUsed: boolean;
  usedAt: string | null;
  userOfferId: string | null;
}

export function useRestaurantOffersDetail(_restaurantId: string) {
  return {
    offers: [] as OfferWithUsageStatus[],
    loading: false,
    error: null as string | null,
  };
}