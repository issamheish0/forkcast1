// Stub: useBlockUser — not implemented in ForkCastApp
export function useBlockUser(_options?: { onBlockSuccess?: () => void; onUnblockSuccess?: () => void }) {
  return {
    isBlocked: false,
    isUserBlocked: (_userId: string) => false,
    blockUser: async () => {},
    unblockUser: async () => {},
    blockUserWithConfirmation: async (_userId: string, _userName?: string) => {},
    unblockUserWithConfirmation: async (_userId: string, _userName?: string) => {},
    blockingUser: null as string | null,
    isLoading: false,
  };
}
