// Stub: deposit payment — not implemented in ForkCastApp
export type DepositCheckResult = {
  required: boolean;
  settingId?: string;
  amount?: number;
  depositAmount: number;
  totalDeposit: number;
  currency: string;
  feeType?: "fixed" | "per_cover";
  refundPolicy?: string;
  refundWindowHours?: number;
  partialRefundPercentage?: number;
  [key: string]: any;
};

export function useDepositPayment(_bookingId?: string) {
  return {
    depositStatus: null as string | null,
    isLoading: false,
    refetch: async () => {},
    checkDepositRequired: async (..._args: any[]): Promise<DepositCheckResult> => ({ required: false, depositAmount: 0, totalDeposit: 0, currency: 'USD' }),
  };
}
