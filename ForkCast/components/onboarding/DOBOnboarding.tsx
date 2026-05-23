import React, { useState, useEffect } from "react";
import { View } from "react-native";
import { DateOfBirthPrompt } from "@/components/auth/DateOfBirthPrompt";
import { useDateOfBirthPrompt } from "@/hooks/useDateOfBirthPrompt";
import { useAuth } from "@/context/supabase-provider";

interface DOBOnboardingProps {
  autoShow?: boolean;
  onComplete?: () => void;
  delay?: number; // Delay before showing prompt (in ms)
}

export const DOBOnboarding: React.FC<DOBOnboardingProps> = ({
  autoShow = true,
  onComplete,
  delay = 1000,
}) => {
  const { isGuest, profile } = useAuth();
  const dobPrompt = useDateOfBirthPrompt();
  const [hasShownOnce, setHasShownOnce] = useState(false);

  useEffect(() => {
    if (autoShow && dobPrompt.shouldPrompt && !hasShownOnce && !isGuest) {
      const timer = setTimeout(() => {
        dobPrompt.showPrompt();
        setHasShownOnce(true);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [
    autoShow,
    dobPrompt.shouldPrompt,
    hasShownOnce,
    isGuest,
    delay,
    dobPrompt,
  ]);

  const handleComplete = () => {
    dobPrompt.hidePrompt();
    onComplete?.();
  };

  const handleSkip = () => {
    dobPrompt.hidePrompt();
    setHasShownOnce(true); // Don't auto-show again this session
  };

  return (
    <DateOfBirthPrompt
      visible={dobPrompt.isVisible}
      onComplete={handleComplete}
      onSkip={handleSkip}
      mandatory={false}
      title="Complete Your Profile"
      description="Add your date of birth to unlock age-restricted venues and get birthday offers. This can only be set once for security purposes."
    />
  );
};
