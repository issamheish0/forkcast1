// hooks/useBookingInvitations.ts — Mock stub
import { useState, useCallback } from "react";

export interface BookingInvitation {
  id: string;
  booking_id: string;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  message?: string;
  created_at: string;
  responded_at?: string;
  booking?: any;
  from_user?: any;
  to_user?: any;
}

export const useBookingInvitations = () => {
  const [loading] = useState(false);
  const [invitations] = useState<BookingInvitation[]>([]);

  const loadReceivedInvitations = useCallback(async () => {}, []);
  const acceptInvitation = useCallback(async (_id: string) => ({ success: true }), []);
  const declineInvitation = useCallback(async (_id: string) => ({ success: true }), []);
  const getPendingInvitations = useCallback(() => [], []);

  return {
    loading,
    invitations,
    loadReceivedInvitations,
    acceptInvitation,
    declineInvitation,
    getPendingInvitations,
  };
};
