// hooks/useRestaurantVisitCount.ts — Mock stub
export function useRestaurantVisitCount(_restaurantId: string | null | undefined) {
  return {
    visitCount: 0,
    loading: false,
    error: null as Error | null,
  };
}