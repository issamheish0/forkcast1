import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/supabase-provider";

export type MissingField =
  | "first_name"
  | "last_name"
  | "phone_number"
  | "date_of_birth";

// Define the order in which fields should be prompted
// Note: phone_number will be filtered out if feature is disabled
const FIELD_ORDER: MissingField[] = [
  "first_name",
  "last_name",
  "date_of_birth",
  "phone_number",
];

interface ProfileCompletionState {
  shouldPrompt: boolean;
  showPrompt: () => void;
  hidePrompt: () => void;
  isVisible: boolean;
  missingFields: MissingField[];
  isProfileComplete: boolean;
  currentField?: MissingField;
  moveToNextField: (completedField?: MissingField) => void;
  getBestAvailableName: () => string;
  getAppleName: () => string | null;
  splitName: (fullName: string) => { first_name: string; last_name: string };
  shouldShowBothNames: () => boolean;
}

export function useProfileCompletion(): ProfileCompletionState {
  const { profile, isGuest, user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  // Track the last field we showed to handle updates correctly
  const [lastShownField, setLastShownField] = useState<MissingField | null>(
    null,
  );

  const splitName = useCallback((fullName: string) => {
    const nameParts = (fullName || "").trim().split(/\s+/);
    return {
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" ") || "",
    };
  }, []);

  const getAppleName = useCallback(() => {
    // Try to get the name from Apple login metadata
    if (user?.user_metadata) {
      return user.user_metadata.full_name || user.user_metadata.name || null;
    }
    return null;
  }, [user]);

  const getBestAvailableName = useCallback(() => {
    // First try Apple login name
    const appleName = getAppleName();
    if (appleName && appleName !== "User") {
      return appleName;
    }

    // Fall back to profile full_name if it's not just "User"
    if (profile?.full_name && profile.full_name !== "User") {
      return profile.full_name;
    }

    // If we have Apple name, use it even if it's "User"
    if (appleName) {
      return appleName;
    }

    // Final fallback
    return profile?.full_name || "";
  }, [profile?.full_name, getAppleName]);

  const missingFields = useCallback((): MissingField[] => {
    if (!profile) return [];

    const missing: MissingField[] = [];

    // Use direct database fields if available, otherwise fall back to splitting full_name
    const firstName =
      profile.first_name || splitName(getBestAvailableName()).first_name;
    const lastName =
      profile.last_name || splitName(getBestAvailableName()).last_name;

    // Check if first name is missing or is the generic "User" fallback
    if (!firstName?.trim() || firstName.trim() === "User") {
      missing.push("first_name");
    }

    // Check if last name is missing
    if (!lastName?.trim()) {
      missing.push("last_name");
    }

    // Check if date of birth is missing
    if (!profile.date_of_birth) {
      missing.push("date_of_birth");
    }

    // Check if phone number is missing
    if (!profile.phone_number?.trim()) {
      missing.push("phone_number");
    }

    // Return fields in the defined order
    return FIELD_ORDER.filter((field) => missing.includes(field));
  }, [profile, splitName, getBestAvailableName]);

  const currentMissingFields = missingFields();
  const isProfileComplete = currentMissingFields.length === 0;
  const shouldPrompt = !isGuest && !isProfileComplete;
  const currentField = currentMissingFields[currentFieldIndex];

  // Update lastShownField when currentField changes
  useEffect(() => {
    if (currentField) {
      setLastShownField(currentField);
    }
  }, [currentField]);

  const showPrompt = useCallback(() => {
    if (shouldPrompt && currentMissingFields.length > 0) {
      setIsVisible(true);
      setCurrentFieldIndex(0);
    }
  }, [shouldPrompt, currentMissingFields.length]);

  const hidePrompt = useCallback(() => {
    setIsVisible(false);
  }, []);

  const moveToNextField = useCallback(
    (completedField?: MissingField) => {
      // Small delay to allow profile state to propagate from context
      setTimeout(() => {
        // Always recalculate missing fields fresh
        const freshMissingFields = missingFields();

        // If no more fields are missing, hide the prompt
        if (freshMissingFields.length === 0) {
          setIsVisible(false);
          return;
        }

        // Determine which field we just completed
        let fieldWeCompletedPosition: number;

        if (completedField) {
          // Explicitly told which field was completed (e.g., when both names submitted)
          fieldWeCompletedPosition = FIELD_ORDER.indexOf(completedField);
        } else {
          // Use the last shown field
          const currentlyShownField =
            lastShownField || currentMissingFields[currentFieldIndex];
          fieldWeCompletedPosition = currentlyShownField
            ? FIELD_ORDER.indexOf(currentlyShownField)
            : -1;
        }

        // Find the next field in FIELD_ORDER that is still missing
        let nextField: MissingField | undefined;
        for (
          let i = fieldWeCompletedPosition + 1;
          i < FIELD_ORDER.length;
          i++
        ) {
          const candidateField = FIELD_ORDER[i];
          if (freshMissingFields.includes(candidateField)) {
            nextField = candidateField;
            break;
          }
        }

        if (nextField) {
          // Find the index of this field in the fresh missing fields array
          const nextIndex = freshMissingFields.indexOf(nextField);
          setCurrentFieldIndex(nextIndex);
        } else {
          // No more fields to process, hide the prompt
          setIsVisible(false);
        }
      }, 100); // 100ms delay to allow state to propagate
    },
    [missingFields, lastShownField, currentMissingFields, currentFieldIndex],
  );

  // Auto-hide the prompt when profile is complete
  useEffect(() => {
    if (isProfileComplete && isVisible) {
      setIsVisible(false);
    }
  }, [isProfileComplete, isVisible]);

  // Reset field index when missing fields change
  useEffect(() => {
    if (
      currentFieldIndex >= currentMissingFields.length &&
      currentMissingFields.length > 0
    ) {
      setCurrentFieldIndex(0);
    }
  }, [currentMissingFields.length, currentFieldIndex]);

  // Helper to check if we should show both name fields together
  const shouldShowBothNames = useCallback(() => {
    return (
      currentField &&
      (currentField === "first_name" || currentField === "last_name") &&
      (currentMissingFields.includes("first_name") ||
        currentMissingFields.includes("last_name"))
    );
  }, [currentField, currentMissingFields]);

  return {
    shouldPrompt,
    showPrompt,
    hidePrompt,
    isVisible,
    missingFields: currentMissingFields,
    isProfileComplete,
    currentField,
    moveToNextField,
    getBestAvailableName,
    getAppleName,
    splitName,
    shouldShowBothNames,
  };
}

// Hook for triggering profile completion prompt when needed for bookings
export function useBookingProfileCompletion() {
  const profileCompletion = useProfileCompletion();
  const { profile } = useAuth();

  const promptForBooking = useCallback(
    (onComplete?: () => void) => {
      if (!profileCompletion.isProfileComplete) {
        profileCompletion.showPrompt();
        return false; // Booking should not proceed
      }
      onComplete?.();
      return true; // Booking can proceed
    },
    [profileCompletion],
  );

  return {
    ...profileCompletion,
    promptForBooking,
  };
}
