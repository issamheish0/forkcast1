// lib/WaitingListNotifications.ts — No-op stub for mock mode
export class WaitingListNotifications {
  private static instance: WaitingListNotifications;
  static getInstance(): WaitingListNotifications {
    if (!WaitingListNotifications.instance) {
      WaitingListNotifications.instance = new WaitingListNotifications();
    }
    return WaitingListNotifications.instance;
  }
  initialize(_userId: string): void {}
  cleanup(): void {}
  static handleNotificationTap(_notification: any): void {}
  static cleanupCancelledEntryNotifications(_entryId: string): void {}
}
