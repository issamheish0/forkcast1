// hooks/useNotifications.ts — Mock stub
export const useNotifications = () => {
  return {
    notifications: [] as any[],
    unreadCount: 0,
    loading: false,
    loadNotifications: async () => {},
    markAsRead: async (_id: string) => {},
    markAllAsRead: async () => {},
    deleteNotification: async (_id: string) => {},
    getNotificationsByType: (_type: string) => [],
    getRecentNotifications: (_limit?: number) => [],
    hasUnread: false,
    isEmpty: true,
  };
};