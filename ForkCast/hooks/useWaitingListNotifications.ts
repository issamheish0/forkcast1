// hooks/useWaitingListNotifications.ts
import { useEffect } from "react";
import { useAuth } from "@/context/supabase-provider";
import { WaitingListNotifications } from "@/lib/WaitingListNotifications";

/**
 * Hook to manage waiting list notifications for the current user
 */
export function useWaitingListNotifications() {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.id) return;

    const notificationService = WaitingListNotifications.getInstance();

    // Initialize notifications for the user
    notificationService.initialize(profile.id);

    // Cleanup on unmount
    return () => {
      notificationService.cleanup();
    };
  }, [profile?.id]);

  return {
    handleNotificationTap: WaitingListNotifications.handleNotificationTap,
    cleanupCancelledEntryNotifications:
      WaitingListNotifications.cleanupCancelledEntryNotifications,
  };
}
