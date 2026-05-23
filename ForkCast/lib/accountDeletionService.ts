// Stub: account deletion service — not implemented in ForkCastApp
export async function deleteUserAccount(_userId: string): Promise<{ error: string | null }> {
  return { error: "Account deletion requires Supabase configuration." };
}

export function useAccountDeletion() {
  return {
    deleteAccount: async (): Promise<{ error: string | null; success?: boolean; message?: string }> => ({ error: "Not implemented", success: false, message: "Not implemented" }),
    softDeleteAccount: async (): Promise<{ error: string | null; success?: boolean; message?: string }> => ({ error: "Not implemented", success: false, message: "Not implemented" }),
    validateDeletion: async (): Promise<{
      valid: boolean;
      canDelete: boolean;
      reason?: string;
      restrictions: string[];
      warnings: string[];
    }> => ({ valid: false, canDelete: false, restrictions: [], warnings: [] }),
    isLoading: false,
    error: null as string | null,
  };
}
