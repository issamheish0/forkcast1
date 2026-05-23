// Stub: deposit checkout — not implemented in ForkCastApp
export function useDepositCheckout(_bookingId?: string) {
  return {
    initiateCheckout: async (..._args: any[]): Promise<boolean> => false,
    initiatePayment: async (..._args: any[]): Promise<boolean> => false,
    openPaymentCheckout: async (..._args: any[]): Promise<boolean> => false,
    checkDepositRequired: async (..._args: any[]): Promise<boolean> => false,
    isLoading: false,
    loading: false,
    error: null as string | null,
    checkoutUrl: null as string | null,
  };
}
