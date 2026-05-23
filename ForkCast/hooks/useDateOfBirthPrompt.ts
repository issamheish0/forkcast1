import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/supabase-provider";

interface DOBPromptState {
  shouldPrompt: boolean;
  showPrompt: () => void;
  hidePrompt: () => void;
  isVisible: boolean;
  hasDateOfBirth: boolean;
}

export function useDateOfBirthPrompt(): DOBPromptState {
  const { profile, isGuest } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  const hasDateOfBirth = Boolean(profile?.date_of_birth);
  const shouldPrompt = !isGuest && !hasDateOfBirth;

  const showPrompt = useCallback(() => {
    if (shouldPrompt) {
      setIsVisible(true);
    }
  }, [shouldPrompt]);

  const hidePrompt = useCallback(() => {
    setIsVisible(false);
  }, []);

  // Auto-hide the prompt when date of birth is set
  useEffect(() => {
    if (hasDateOfBirth && isVisible) {
      setIsVisible(false);
    }
  }, [hasDateOfBirth, isVisible]);

  return {
    shouldPrompt,
    showPrompt,
    hidePrompt,
    isVisible,
    hasDateOfBirth,
  };
}

// Hook for triggering DOB prompt when needed for bookings
export function useBookingDOBPrompt() {
  const dobPrompt = useDateOfBirthPrompt();
  const { profile } = useAuth();

  const promptForBooking = useCallback(
    (onComplete?: () => void) => {
      if (!profile?.date_of_birth) {
        dobPrompt.showPrompt();
        return false; // Booking should not proceed
      }
      onComplete?.();
      return true; // Booking can proceed
    },
    [profile?.date_of_birth, dobPrompt],
  );

  return {
    ...dobPrompt,
    promptForBooking,
  };
}
