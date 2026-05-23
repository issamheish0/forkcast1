// hooks/usePostBookingReview.ts — Mock stub
export function usePostBookingReview(_userId?: string, _isAuthenticated?: boolean) {
  return {
    eligibleBooking: null as any,
    loading: false,
    error: null as string | null,
    isVisible: false,
    handleWriteReview: () => {},
    handleSkip: () => {},
    checkForEligibleBooking: async () => {},
  };
}