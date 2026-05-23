import React, { useState, useEffect } from "react";
import { View } from "react-native";
import { ProfileCompletionPrompt } from "@/components/auth/ProfileCompletionPrompt";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { useAuth } from "@/context/supabase-provider";

interface ProfileCompletionOnboardingProps {
  autoShow?: boolean;
  onComplete?: () => void;
  delay?: number; // Delay before showing prompt (in ms)
}

export const ProfileCompletionOnboarding: React.FC<
  ProfileCompletionOnboardingProps
> = ({ autoShow = true, onComplete, delay = 1000 }) => {
  const { isGuest } = useAuth();
  const profileCompletion = useProfileCompletion();
  const [hasShownOnce, setHasShownOnce] = useState(false);

  useEffect(() => {
    if (
      autoShow &&
      profileCompletion.shouldPrompt &&
      !hasShownOnce &&
      !isGuest
    ) {
      const timer = setTimeout(() => {
        profileCompletion.showPrompt();
        setHasShownOnce(true);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [
    autoShow,
    profileCompletion.shouldPrompt,
    hasShownOnce,
    isGuest,
    delay,
    profileCompletion,
  ]);

  const handleComplete = () => {
    profileCompletion.hidePrompt();
    onComplete?.();
  };

  const handleNext = (completedField?: any) => {
    profileCompletion.moveToNextField(completedField);
  };

  const handleSkip = () => {
    // Move to next field or complete if it's the last field
    profileCompletion.moveToNextField();
    setHasShownOnce(true); // Don't auto-show again this session
  };

  return (
    <ProfileCompletionPrompt
      visible={profileCompletion.isVisible}
      currentField={profileCompletion.currentField}
      missingFields={profileCompletion.missingFields}
      onComplete={handleComplete}
      onNext={handleNext}
      onSkip={handleSkip}
      mandatory={false}
      getBestAvailableName={profileCompletion.getBestAvailableName}
      splitName={profileCompletion.splitName}
    />
  );
};
