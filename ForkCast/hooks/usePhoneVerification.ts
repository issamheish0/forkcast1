import { useState, useCallback } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";

export function usePhoneVerification() {
  const { profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const sendCode = useCallback(async (phone: string): Promise<{ success: boolean }> => {
    setLoading(true);
    setError(null);
    try {
      // updateUser adds the phone to the currently authenticated user and sends
      // a verification SMS. This does NOT require phone auth to be enabled as a
      // standalone provider in Supabase — it works for any authenticated user.
      const { error: otpError } = await supabase.auth.updateUser({ phone });
      if (otpError) {
        setError(otpError.message);
        return { success: false };
      }
      return { success: true };
    } catch (e: any) {
      setError(e?.message ?? "Failed to send SMS code.");
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyCode = useCallback(
    async (code: string, phone: string): Promise<{ success: boolean; needsResend?: boolean }> => {
      setLoading(true);
      setError(null);
      try {
        // Verify the OTP — type "phone_change" matches the token sent by updateUser({ phone })
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          phone,
          token: code,
          type: "phone_change",
        });

        if (verifyError) {
          // Token already consumed — caller should ask user to resend
          if (
            verifyError.message.toLowerCase().includes("expired") ||
            verifyError.message.toLowerCase().includes("invalid") ||
            verifyError.message.toLowerCase().includes("token has already been used")
          ) {
            setError(verifyError.message);
            return { success: false, needsResend: true };
          }
          setError(verifyError.message);
          return { success: false };
        }

        if (!data?.session && !profile?.id) {
          setError("Verification succeeded but could not update profile.");
          return { success: false };
        }

        // Use the currently logged-in user's profile ID (not the phone-OTP session)
        const userId = profile?.id ?? data?.session?.user?.id;
        if (userId) {
          const { error: updateError } = await supabase
            .from("profiles")
            .update({
              phone,
              phone_verified: true,
              phone_verified_at: new Date().toISOString(),
            })
            .eq("id", userId);

          if (updateError) {
            console.warn("Phone verified but failed to update profile:", updateError.message);
          }
        }

        await refreshProfile?.();
        return { success: true };
      } catch (e: any) {
        setError(e?.message ?? "Verification failed.");
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [refreshProfile],
  );

  return {
    sendCode,
    verifyCode,
    clearError,
    loading,
    error,
    isVerified: profile?.phone_verified ?? false,
    phoneNumber: profile?.phone ?? null,
  };
}