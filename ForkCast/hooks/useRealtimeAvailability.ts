// hooks/useRealtimeAvailability.ts — No-op stub for mock mode
interface UseRealtimeAvailabilityOptions {
  enabled?: boolean;
  onUpdate?: () => void;
  debounceMs?: number;
}

export function useRealtimeAvailability(
  _restaurantId: string,
  _options: UseRealtimeAvailabilityOptions = {},
): void {
  // No-op in mock mode
}