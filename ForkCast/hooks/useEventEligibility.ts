import { useMemo } from "react";
import { useAuth } from "@/context/supabase-provider";
import { verifyAgeForBooking } from "@/utils/ageVerification";
import type {
  RestaurantEvent,
  EventOccurrence,
  EventEligibility,
} from "@/types/events";
import { isOccurrenceAvailable } from "@/types/events";

/**
 * Hook to check if a user can book a specific event occurrence
 * @param event - The restaurant event
 * @param occurrence - The specific event occurrence
 * @param partySize - The requested party size
 */
export function useEventEligibility(
  event: RestaurantEvent | null | undefined,
  occurrence: EventOccurrence | null | undefined,
  partySize: number = 1,
): EventEligibility {
  const { profile, isGuest } = useAuth();

  return useMemo(() => {
    // Default ineligible state
    const ineligible: EventEligibility = {
      isEligible: false,
      canBook: false,
      requirements: {
        meetsAgeRequirement: false,
        meetsPartySizeRequirement: false,
        hasAvailableCapacity: false,
      },
    };

    // If event or occurrence is not provided, return ineligible
    if (!event || !occurrence) {
      return {
        ...ineligible,
        reason: "Event information is not available",
      };
    }

    // Guest users need to sign up
    if (isGuest) {
      return {
        ...ineligible,
        reason: event.minimum_age
          ? "Sign up required for age verification"
          : "Sign up to book this event",
        actionRequired: "sign_up",
        actionText: "Sign Up to Continue",
      };
    }

    // Check age requirements if applicable
    let meetsAgeRequirement = true;
    let ageMessage: string | undefined;
    let ageActionRequired: "add_date_of_birth" | "age_restriction" | null =
      null;

    if (event.minimum_age) {
      // Create a temporary restaurant-like object for age verification
      const restaurantForAgeCheck = {
        minimum_age: event.minimum_age,
      } as any;

      const ageVerification = verifyAgeForBooking(
        restaurantForAgeCheck,
        profile,
      );

      meetsAgeRequirement = ageVerification.canBook;

      if (!ageVerification.canBook) {
        if (ageVerification.requiresDateOfBirth) {
          ageMessage = "Date of birth required for this event";
          ageActionRequired = "add_date_of_birth";
        } else {
          ageMessage =
            ageVerification.reason ||
            `This event requires guests to be ${event.minimum_age}+ years old`;
          ageActionRequired = "age_restriction";
        }
      }
    }

    // Check party size requirements
    let meetsPartySizeRequirement = true;
    let partySizeMessage: string | undefined;

    if (partySize < event.minimum_party_size) {
      meetsPartySizeRequirement = false;
      partySizeMessage = `Minimum party size is ${event.minimum_party_size}`;
    }

    if (event.maximum_party_size && partySize > event.maximum_party_size) {
      meetsPartySizeRequirement = false;
      partySizeMessage = `Maximum party size is ${event.maximum_party_size}`;
    }

    // Check availability and capacity
    const hasAvailableCapacity = isOccurrenceAvailable(occurrence, partySize);
    let capacityMessage: string | undefined;

    if (!hasAvailableCapacity) {
      if (occurrence.status === "full") {
        capacityMessage = "This event is fully booked";
      } else if (occurrence.status === "cancelled") {
        capacityMessage = "This event has been cancelled";
      } else if (occurrence.status === "completed") {
        capacityMessage = "This event has already taken place";
      } else {
        capacityMessage = "This event is no longer available";
      }
    }

    // Determine overall eligibility
    const isEligible =
      meetsAgeRequirement && meetsPartySizeRequirement && hasAvailableCapacity;

    // Build the result
    const result: EventEligibility = {
      isEligible,
      canBook: isEligible,
      requirements: {
        meetsAgeRequirement,
        meetsPartySizeRequirement,
        hasAvailableCapacity,
      },
    };

    // Set reason and action based on first failing requirement
    if (!meetsAgeRequirement && ageMessage) {
      result.reason = ageMessage;
      result.actionRequired = ageActionRequired || "age_restriction";
      result.actionText =
        ageActionRequired === "add_date_of_birth"
          ? "Add Date of Birth"
          : event.minimum_age
            ? `${event.minimum_age}+ Only`
            : "Age Restricted";
    } else if (!meetsPartySizeRequirement && partySizeMessage) {
      result.reason = partySizeMessage;
      result.actionRequired = "adjust_party_size";
      result.actionText = "Adjust Party Size";
    } else if (!hasAvailableCapacity && capacityMessage) {
      result.reason = capacityMessage;
      result.actionRequired = "event_full";
      result.actionText = "Event Full";
    }

    return result;
  }, [event, occurrence, partySize, profile, isGuest]);
}

/**
 * Simple hook to check if user can book an event occurrence
 */
export function useCanBookEvent(
  event: RestaurantEvent | null | undefined,
  occurrence: EventOccurrence | null | undefined,
  partySize: number = 1,
): boolean {
  const eligibility = useEventEligibility(event, occurrence, partySize);
  return eligibility.isEligible;
}
