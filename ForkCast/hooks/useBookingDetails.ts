// hooks/useBookingDetails.ts — Mock stub
import { MOCK_UPCOMING_BOOKINGS, MOCK_PAST_BOOKINGS } from "@/lib/mockData";

export type GuaranteeInfo = {
  hasGuarantee: boolean;
  guaranteeId: string | null;
  lateCancelFee: number;
  noShowFee: number;
  feeType: "per_cover" | "fixed";
  currency: string;
  totalLateCancelFee: number;
  totalNoShowFee: number;
  serviceFeePercentage: number;
  serviceFeeAmount: number;
  totalWithServiceFee: number;
};

export type DepositInfo = {
  hasDeposit: boolean;
  depositId: string | null;
  depositSettingId: string | null;
  amount: number;
  serviceFee: number;
  totalAmount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "refunded" | "partial_refund" | "forfeited";
  paymentProvider: string | null;
  refundPolicy: string;
  refundWindowHours: number;
  partialRefundPercentage: number;
  paidAt: string | null;
  partySize: number | null;
};

export const useBookingDetails = (bookingId: string) => {
  const allBookings = [...MOCK_UPCOMING_BOOKINGS, ...MOCK_PAST_BOOKINGS];
  const booking = allBookings.find((b) => b.id === bookingId) ?? null;

  return {
    booking,
    loading: false,
    processing: false,
    hasReview: false,
    appliedOfferDetails: null,
    appliedPromoDetails: null,
    assignedTables: [] as any[],
    guaranteeInfo: null as GuaranteeInfo | null,
    depositInfo: null as DepositInfo | null,
    isUpcoming: booking?.status === "confirmed",
    isToday: false,
    isTomorrow: false,
    cancelBooking: async () => {},
    copyOfferCode: async () => {},
    refresh: async () => {},
  };
};