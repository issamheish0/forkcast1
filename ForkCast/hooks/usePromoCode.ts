// hooks/usePromoCode.ts — Mock stub
export interface AppliedPromo {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  max_discount_amount: number | null;
  description: string | null;
}

interface UsePromoCodeOptions {
  restaurantId: string;
  userId: string;
  partySize?: number;
}

export function usePromoCode(_options: UsePromoCodeOptions) {
  return {
    validateCode: async (_code: string) => false,
    clearPromoCode: () => {},
    loading: false,
    error: null as string | null,
    appliedPromo: null as AppliedPromo | null,
  };
}