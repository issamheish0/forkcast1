// Stub: VIP service — not implemented in ForkCastApp
export const VIPService = {
  isVIP: (_userId: string) => false,
  getVIPLevel: (_userId: string): string | null => null,
  applyVIPBenefits: (bookingData: any) => bookingData,
  getMaxBookingDays: (_userId: string, _restaurantId: string, defaultDays: number) => defaultDays,
};
