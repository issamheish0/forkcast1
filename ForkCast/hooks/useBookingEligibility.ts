import { useMemo } from "react";
import { useAuth } from "@/context/supabase-provider";
import {
  verifyAgeForBooking,
  AgeVerificationResult,
} from "@/utils/ageVerification";
import { Database } from "@/types/supabase";
import { isPhoneVerificationRequired } from "@/config/features";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

export interface BookingEligibility extends AgeVerificationResult {
  isEligible: boolean;
  blockedReason?: string;
  actionRequired?:
    | "sign_up"
    | "add_date_of_birth"
    | "age_restriction"
    | "verify_phone"
    | null;
  actionText?: string;
}

export function useBookingEligibility(
  restaurant: Restaurant,
): BookingEligibility {
  const { profile, isGuest } = useAuth();

  return useMemo(() => {
    // Guest users need to sign up
    if (isGuest) {
      return {
        isEligible: false,
        canBook: false,
        userAge: null,
        requiredAge: restaurant.minimum_age,
        blockedReason: restaurant.minimum_age
          ? "Sign up required for age verification"
          : "Sign up to make a reservation",
        actionRequired: "sign_up",
        actionText: "Sign Up to Continue",
      };
    }

    // Phone verification required for booking (existing email/Google/Apple users)
    if (isPhoneVerificationRequired() && profile && !profile.phone_verified) {
      return {
        isEligible: false,
        canBook: false,
        userAge: null,
        requiredAge: restaurant.minimum_age ?? null,
        blockedReason:
          "Verify your phone number to make a booking. Restaurants may need to reach you.",
        actionRequired: "verify_phone",
        actionText: "Verify Phone",
      };
    }

    // Perform age verification for authenticated users
    const ageVerification = verifyAgeForBooking(restaurant, profile);

    if (ageVerification.canBook) {
      return {
        ...ageVerification,
        isEligible: true,
        actionRequired: null,
      };
    }

    // User needs to add date of birth
    if (ageVerification.requiresDateOfBirth) {
      return {
        ...ageVerification,
        isEligible: false,
        blockedReason: "Date of birth required for booking",
        actionRequired: "add_date_of_birth",
        actionText: "Add Date of Birth",
      };
    }

    // User is too young
    return {
      ...ageVerification,
      isEligible: false,
      blockedReason: ageVerification.reason || "Age restriction applies",
      actionRequired: "age_restriction",
      actionText: restaurant.minimum_age
        ? `${restaurant.minimum_age}+ Only`
        : "Age Restricted",
    };
  }, [restaurant, profile, isGuest]);
}

/**
 * Simple hook to check if user can book (eligible)
 */
export function useCanBook(restaurant: Restaurant): boolean {
  const eligibility = useBookingEligibility(restaurant);
  return eligibility.isEligible;
}
