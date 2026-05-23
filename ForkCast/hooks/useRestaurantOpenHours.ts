// hooks/useRestaurantOpenHours.ts — Mock stub
export function useRestaurantOpenHours(_restaurantId: string) {
  return {
    loading: false,
    openHours: [] as any[],
    checkAvailability: (_date?: Date, time?: string) => ({
      isOpen: true,
      hours: [],
    }),
    formatDisplayHours: (_hours: any) => "",
    getWeeklySchedule: () => [],
    findNextOpenTime: (_fromDate?: Date) => null,
    refreshOpenHours: async () => {},
  };
}