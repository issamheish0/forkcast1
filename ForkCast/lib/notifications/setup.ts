// lib/notifications/setup.ts — MOCK STUB (Expo Go: no native modules)

export type NotificationData = {
  category?: string;
  type?: string;
  deeplink?: string;
  outbox_id?: string;
  [key: string]: any;
};

/** No-op in Expo Go — OneSignal native module unavailable */
export function initializeNotificationHandlers(
  _onOpenDeeplink?: (deeplink: string, data?: any) => void,
): void {}

/** No-op stub */
export function cleanupNotificationHandlers(): void {}
