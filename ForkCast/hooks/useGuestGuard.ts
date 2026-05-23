// hooks/useGuestGuard.ts
import { useState, useCallback } from "react";
import { useAuth } from "@/context/supabase-provider";
import * as Haptics from "expo-haptics";

export function useGuestGuard() {
  const { isGuest, convertGuestToUser, user } = useAuth();
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [promptedFeature, setPromptedFeature] = useState("");

  const runProtectedAction = useCallback(
    (action: () => void | Promise<void>, featureName: string) => {
      if (isGuest) {
        // Guest user - show prompt
        setPromptedFeature(featureName);
        setShowGuestPrompt(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (user) {
        // Authenticated user - run action
        action();
      } else {
        // No user and not guest - redirect to auth
        convertGuestToUser();
      }
    },
    [isGuest, user, convertGuestToUser],
  );

  const handleClosePrompt = useCallback(() => {
    setShowGuestPrompt(false);
    setPromptedFeature("");
  }, []);

  const handleSignUpFromPrompt = useCallback(() => {
    setShowGuestPrompt(false);
    void convertGuestToUser();
  }, [convertGuestToUser]);

  return {
    isGuest,
    showGuestPrompt,
    promptedFeature,
    runProtectedAction,
    handleClosePrompt,
    handleSignUpFromPrompt,
  };
}
