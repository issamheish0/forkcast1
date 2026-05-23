// Stub: card guarantee — not implemented in ForkCastApp
export type GuaranteeCheckResult = {
  required: boolean;
  settingId?: string;
  amount?: number;
  currency: string;
  feeType?: "fixed" | "per_cover";
  noShowFee: number;
  lateCancelFee: number;
  totalNoShowFee: number;
  totalLateCancelFee: number;
  serviceFeePercentage?: number;
  serviceFeeAmount?: number;
  totalWithServiceFee?: number;
  [key: string]: any;
};

export function useCardGuarantee(_restaurantId?: string) {
  return {
    guaranteeRequired: false,
    guaranteeAmount: 0,
    isLoading: false,
    loading: false,
    checkGuaranteeRequired: async (..._args: any[]): Promise<GuaranteeCheckResult> => ({ required: false, currency: 'USD', noShowFee: 0, lateCancelFee: 0, totalNoShowFee: 0, totalLateCancelFee: 0 }),
  };
}
