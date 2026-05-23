// lib/RealtimeAvailability.ts — No-op stub for mock mode
export class RealtimeAvailability {
  subscribeToRestaurant(_restaurantId: string, _onUpdate: () => void): () => void {
    return () => {};
  }
  cleanup(): void {}
  private static instance: RealtimeAvailability;
  static getInstance(): RealtimeAvailability {
    if (!RealtimeAvailability.instance) {
      RealtimeAvailability.instance = new RealtimeAvailability();
    }
    return RealtimeAvailability.instance;
  }
}
export const realtimeAvailability = new RealtimeAvailability();
export default realtimeAvailability;
