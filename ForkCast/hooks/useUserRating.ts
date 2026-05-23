// hooks/useUserRating.ts — Mock stub
export function useUserRating(_userId?: string) {
  return {
    stats: null,
    history: [] as any[],
    eligibility: null,
    tier: null,
    loading: false,
    error: null,
    refresh: async () => {},
    refreshRating: async () => {},
    checkBookingEligibility: async () => ({ eligible: true }),
    getUserRatingTier: async () => null,
    currentRating: 5.0,
    isExcellent: true,
    isGood: true,
    isRestricted: false,
    isBlocked: false,
    canBookInstant: true,
    hasRestrictions: false,
  };
}