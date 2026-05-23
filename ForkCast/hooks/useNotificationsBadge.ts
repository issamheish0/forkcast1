// hooks/useNotificationsBadge.ts — Mock stub
export function useNotificationsBadge() {
  return {
    unreadCount: 0,
    refreshCount: async () => {},
    markAllAsRead: async () => {},
  };
}