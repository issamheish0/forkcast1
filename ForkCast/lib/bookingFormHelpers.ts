import { UseFormGetValues, UseFormSetValue } from "react-hook-form";

interface BookingFormData {
  specialRequests?: string;
  occasion?: string;
  dietaryRestrictions: string[];
  tablePreferences: string[];
  acceptTerms: boolean;
}

/**
 * Helper function to toggle dietary restrictions in form
 */
export const createToggleDietaryRestriction = (
  getValues: UseFormGetValues<BookingFormData>,
  setValue: UseFormSetValue<BookingFormData>,
) => {
  return (restriction: string) => {
    const current = getValues("dietaryRestrictions");
    if (current.includes(restriction)) {
      setValue(
        "dietaryRestrictions",
        current.filter((r) => r !== restriction),
      );
    } else {
      setValue("dietaryRestrictions", [...current, restriction]);
    }
  };
};

/**
 * Helper function to toggle table preferences in form
 */
export const createToggleTablePreference = (
  getValues: UseFormGetValues<BookingFormData>,
  setValue: UseFormSetValue<BookingFormData>,
) => {
  return (preference: string) => {
    const current = getValues("tablePreferences");
    if (current.includes(preference)) {
      setValue(
        "tablePreferences",
        current.filter((p) => p !== preference),
      );
    } else {
      setValue("tablePreferences", [...current, preference]);
    }
  };
};

/**
 * Get default form values based on user profile
 */
export const getDefaultFormValues = (
  profile: any,
): Partial<BookingFormData> => ({
  specialRequests: "",
  occasion: "none",
  dietaryRestrictions: profile?.dietary_restrictions || [],
  tablePreferences: [],
  acceptTerms: false,
});
