// Stub: event payment checkout — not implemented in ForkCastApp
export function useEventPaymentCheckout(_eventId?: string) {
  return {
    initiateCheckout: async () => {},
    openPaymentCheckout: async (..._args: any[]): Promise<boolean> => false,
    isLoading: false,
    loading: false,
    error: null as string | null,
    checkoutUrl: null as string | null,
  };
}
