// hooks/useWaitlist.ts — Mock stub
import type { TableType } from "@/types/waitlist";

export interface WaitlistEntry {
  userId: string;
  restaurantId: string;
  desiredDate: string;
  desiredTimeRange: string;
  partySize: number;
  table_type: TableType;
  special_requests?: string;
}

export const getWaitlistEntryMessage = (_entry: any) => ({
  title: "Waitlist Entry",
  description: "You are on the waitlist.",
  badgeText: "Manual",
});

export const useWaitlist = () => {
  const noop = async (..._args: any[]) => ({ success: false, error: "Not implemented" });
  return {
    joinWaitlist: noop,
    getMyWaitlist: async () => [],
    leaveWaitlist: noop,
    cancelWaitlist: noop,
    canJoinWaitlist: async () => ({ canJoin: false, reason: "Mock mode" }),
    convertWaitlistToBooking: noop,
    myWaitlist: [] as any[],
    loading: false,
    isAuthenticated: true,
    getUserWaitlistEntries: async () => [],
    removeFromWaitlist: noop,
    updateWaitlistStatus: noop,
  };
};