// Age verification utilities for restaurant bookings

import { calculateAge } from "./birthday";
import { Database } from "@/types/supabase";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type Profile = {
  date_of_birth?: string | null;
  full_name: string;
};

export interface AgeVerificationResult {
  canBook: boolean;
  userAge: number | null;
  requiredAge: number | null;
  reason?: string;
  requiresDateOfBirth?: boolean;
}

/**
 * Check if user meets minimum age requirement for restaurant booking
 */
export function verifyAgeForBooking(
  restaurant: Restaurant,
  profile: Profile | null,
): AgeVerificationResult {
  // If restaurant has no age restriction, anyone can book
  if (!restaurant.minimum_age) {
    return {
      canBook: true,
      userAge: profile?.date_of_birth
        ? calculateAge(profile.date_of_birth)
        : null,
      requiredAge: null,
    };
  }

  // If user has no profile or no date of birth
  if (!profile || !profile.date_of_birth) {
    return {
      canBook: false,
      userAge: null,
      requiredAge: restaurant.minimum_age,
      reason: "Date of birth required for age-restricted venues",
      requiresDateOfBirth: true,
    };
  }

  const userAge = calculateAge(profile.date_of_birth);
  const canBook = userAge >= restaurant.minimum_age;

  return {
    canBook,
    userAge,
    requiredAge: restaurant.minimum_age,
    reason: canBook
      ? undefined
      : `You must be at least ${restaurant.minimum_age} years old to book this restaurant`,
  };
}

/**
 * Get age restriction message for UI display
 */
export function getAgeRestrictionMessage(
  restaurant: Restaurant,
): string | null {
  if (!restaurant.minimum_age) {
    return null;
  }

  // Show the exact configured minimum age instead of bucketing at 18/21
  const age = restaurant.minimum_age;
  if (age >= 18) {
    return `${age}+ venue - Valid ID required`;
  }
  return `${age}+ age requirement`;
}

/**
 * Check if restaurant is age-restricted
 */
export function isAgeRestricted(restaurant: Restaurant): boolean {
  return restaurant.minimum_age !== null && restaurant.minimum_age > 0;
}

/**
 * Get age restriction level for styling/badges
 */
export function getAgeRestrictionLevel(
  restaurant: Restaurant,
): "none" | "minor" | "adult" | "strict" {
  if (!restaurant.minimum_age) return "none";

  if (restaurant.minimum_age >= 21) return "strict";
  if (restaurant.minimum_age >= 18) return "adult";
  if (restaurant.minimum_age >= 13) return "minor";
  return "none";
}

/**
 * Format age restriction for display
 */
export function formatAgeRestriction(minimum_age: number | null): string {
  if (!minimum_age) return "All ages welcome";
  return `${minimum_age}+ only`;
}
