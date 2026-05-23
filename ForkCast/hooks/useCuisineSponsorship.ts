// hooks/useCuisineSponsorship.ts — Mock stub
export function useCuisineSponsorship(_cuisine: string) {
  return {
    sponsoredIds: new Map<string, { priority: number; sponsorshipId: string }>(),
    loading: false,
    error: null as string | null,
    trackImpression: async (_sponsorshipId: string) => {},
    trackClick: async (_sponsorshipId: string) => {},
    sortWithSponsored: <T extends { id: string }>(restaurants: T[]) => restaurants,
    isSponsored: (_restaurantId: string) => false,
    getSponsorshipId: (_restaurantId: string) => null,
  };
}