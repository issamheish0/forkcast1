// Stub: pending checkouts — returns empty until Supabase is configured
export function usePendingCheckouts(_userId?: string) {
  return {
    pendingCheckouts: [] as any[],
    isLoading: false,
    refetch: async () => {},
    dismissCheckout: async (_id: string) => {},
    refresh: async () => {},
  };
}
