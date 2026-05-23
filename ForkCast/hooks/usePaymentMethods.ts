// Stub: payment methods — returns empty list until Supabase is configured
export type PaymentMethod = {
  id: string;
  type: string;
  last4?: string;
  brand?: string;
  expMonth?: number;
  expYear?: number;
  isDefault?: boolean;
  is_default?: boolean;
  name?: string;
  [key: string]: any;
};

export const CARD_BRANDS: Record<string, { name: string; color: string; icon?: string }> = {
  visa: { name: "Visa", color: "#1A1F71" },
  mastercard: { name: "Mastercard", color: "#EB001B" },
  amex: { name: "American Express", color: "#2E77BC" },
  discover: { name: "Discover", color: "#FF6600" },
  unknown: { name: "Card", color: "#6B7280" },
};

export function usePaymentMethods() {
  return {
    paymentMethods: [] as PaymentMethod[],
    isLoading: false,
    loading: false,
    refreshing: false,
    error: null,
    refetch: async () => {},
    fetchPaymentMethods: async () => {},
    deletePaymentMethod: async (_id: string) => {},
    setDefaultPaymentMethod: async (_id: string): Promise<boolean> => false,
    openCheckout: async (..._args: any[]): Promise<boolean> => false,
    isCardExpiringSoon: (_card: PaymentMethod) => false,
    updatePaymentMethodName: async (_id: string, _name: string | null): Promise<boolean> => false,
  };
}
