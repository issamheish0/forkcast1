// lib/RealtimeSubscriptionService.ts — No-op stub for mock/frontend-only mode
// All methods are no-ops; no WebSocket connections are made.

class RealtimeSubscriptionService {
  initialize(): void {}

  subscribeToUser(_config: any): () => void {
    return () => {};
  }

  subscribeToRestaurant(_config: any): () => void {
    return () => {};
  }

  subscribe(_channelId: string, _configs: any[]): () => void {
    return () => {};
  }

  unsubscribe(_channelId: string): void {}

  unsubscribeAll(): void {}

  cleanup(): void {}
}

export const realtimeService = new RealtimeSubscriptionService();
// Named alias used by some hooks
export const realtimeSubscriptionService = realtimeService;
export default realtimeService;

