// hooks/useRestaurantAvailability.ts — Mock stub
export function useRestaurantAvailability(_restaurantId: string) {
  return {
    loading: false,
    checkAvailability: (_date?: Date, _time?: string) => ({
      isOpen: true,
      reason: undefined,
      hours: [],
    }),
    getAvailableTimeSlots: (_date?: Date, _partySize?: number) => [],
    formatOperatingHours: () => "Open",
    getWeeklySchedule: () => [],
    specialHours: [] as any[],
    closures: [] as any[],
    regularHours: [] as any[],
    refreshAvailability: async () => {},
  };
}