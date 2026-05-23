import React, { useState, useCallback } from "react";
import {
  View,
  Alert,
  Modal,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import {
  User,
  AlertTriangle,
  Shield,
  Phone,
  Calendar,
  CheckCircle,
} from "lucide-react-native";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from "expo-router";

import { Text } from "@/components/ui/text";
import { H2, P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { MissingField } from "@/hooks/useProfileCompletion";
import {
  InternationalPhoneInput,
  isValidPhoneNumber,
  type ICountry,
} from "@/components/ui/international-phone-input";
import parsePhoneNumberFromString, {
  type CountryCode,
} from "libphonenumber-js";

// Utility function to format date input with automatic dashes (DD-MM-YYYY)
const formatDateInput = (value: string): string => {
  const numbers = value.replace(/\D/g, "");

  if (numbers.length <= 2) {
    return numbers;
  } else if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
  } else {
    return `${numbers.slice(0, 2)}-${numbers.slice(2, 4)}-${numbers.slice(4, 8)}`;
  }
};

// Utility function to convert DD-MM-YYYY to YYYY-MM-DD for database storage
const convertToDbFormat = (dateString: string): string => {
  const ddMmYyyyRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
  const match = dateString.match(ddMmYyyyRegex);

  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }

  return dateString;
};

// Utility function to convert YYYY-MM-DD to DD-MM-YYYY for display
const convertToDisplayFormat = (dateString: string): string => {
  const yyyyMmDdRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = dateString.match(yyyyMmDdRegex);

  if (match) {
    const [, year, month, day] = match;
    return `${day}-${month}-${year}`;
  }

  return dateString;
};

// Utility function to validate date format
const isValidDateFormat = (dateString: string): boolean => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;

  const date = new Date(dateString);
  return (
    date instanceof Date &&
    !isNaN(date.getTime()) &&
    dateString === date.toISOString().split("T")[0]
  );
};

// Schema for both name fields together
const combinedNamesSchema = z.object({
  first_name: z
    .string()
    .min(1, "First name is required")
    .max(25, "First name must be less than 25 characters")
    .regex(/^[a-zA-Z\s\u0600-\u06FF]+$/, "Please enter a valid first name"),
  last_name: z
    .string()
    .min(1, "Last name is required")
    .max(25, "Last name must be less than 25 characters")
    .regex(/^[a-zA-Z\s\u0600-\u06FF]+$/, "Please enter a valid last name"),
});

// Dynamic schema based on current field
const createFieldSchema = (field: MissingField) => {
  switch (field) {
    case "first_name":
      return z.object({
        value: z
          .string()
          .min(1, "First name is required")
          .max(25, "First name must be less than 25 characters")
          .regex(
            /^[a-zA-Z\s\u0600-\u06FF]+$/,
            "Please enter a valid first name",
          ),
      });

    case "last_name":
      return z.object({
        value: z
          .string()
          .min(1, "Last name is required")
          .max(25, "Last name must be less than 25 characters")
          .regex(
            /^[a-zA-Z\s\u0600-\u06FF]+$/,
            "Please enter a valid last name",
          ),
      });

    case "phone_number":
      return z.object({
        value: z.string().min(1, "Phone number is required"),
      });

    case "date_of_birth":
      return z.object({
        value: z
          .string()
          .min(1, "Please enter your date of birth.")
          .refine((date) => {
            // Check if it's in DD-MM-YYYY format
            const ddMmYyyyRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
            return ddMmYyyyRegex.test(date);
          }, "Please enter a valid date in DD-MM-YYYY format.")
          .refine((date) => {
            // Convert to YYYY-MM-DD for validation
            const dbFormat = convertToDbFormat(date);
            return isValidDateFormat(dbFormat);
          }, "Please enter a valid date.")
          .refine((date) => {
            const dbFormat = convertToDbFormat(date);
            const parsedDate = new Date(dbFormat);
            const today = new Date();
            const age = today.getFullYear() - parsedDate.getFullYear();
            const monthDiff = today.getMonth() - parsedDate.getMonth();
            const dayDiff = today.getDate() - parsedDate.getDate();

            return (
              age > 13 ||
              (age === 13 &&
                (monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0)))
            );
          }, "You must be at least 13 years old.")
          .refine((date) => {
            const dbFormat = convertToDbFormat(date);
            const parsedDate = new Date(dbFormat);
            const today = new Date();
            return parsedDate <= today;
          }, "Date of birth cannot be in the future."),
      });

    default:
      return z.object({ value: z.string() });
  }
};

type FormData = z.infer<ReturnType<typeof createFieldSchema>>;

interface FieldConfig {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  placeholder: string;
  keyboardType?: "default" | "phone-pad" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  maxLength?: number;
  autoComplete?: string;
  isDateField?: boolean;
  canSkip?: boolean;
}

// Special config for when showing both names together
const combinedNamesConfig: FieldConfig = {
  title: "Add Your Name",
  description:
    "Enter your full name to personalize your experience and help restaurants identify you.",
  icon: User,
  placeholder: "John",
  autoCapitalize: "words",
  canSkip: false,
};

const fieldConfigs: Record<MissingField, FieldConfig> = {
  first_name: {
    title: "Add Your First Name",
    description:
      "Enter your first name to personalize your experience and help restaurants identify you.",
    icon: User,
    placeholder: "John",
    autoCapitalize: "words",
    autoComplete: "given-name",
    canSkip: false,
  },
  last_name: {
    title: "Add Your Last Name",
    description:
      "Enter your last name to complete your profile and ensure proper identification.",
    icon: User,
    placeholder: "Doe",
    autoCapitalize: "words",
    autoComplete: "family-name",
    canSkip: false,
  },
  phone_number: {
    title: "Add Your Phone Number",
    description:
      "We need your phone number in order for you to book. You will be redirected to profile in order to add and verify your phone number.",
    icon: Phone,
    placeholder: "03 123 456",
    keyboardType: "phone-pad",
    autoComplete: "tel",
    canSkip: false,
  },
  date_of_birth: {
    title: "Add Your Date of Birth",
    description:
      "We need your date of birth for age verification at certain venues. This information can only be set once for security purposes.",
    icon: Calendar,
    placeholder: "DD-MM-YYYY",
    keyboardType: "numeric",
    maxLength: 10,
    isDateField: true,
    canSkip: true,
  },
};

interface ProfileCompletionPromptProps {
  visible: boolean;
  currentField?: MissingField;
  missingFields: MissingField[];
  onComplete: () => void;
  onNext: (completedField?: MissingField) => void;
  onSkip?: () => void;
  mandatory?: boolean;
  getBestAvailableName?: () => string;
  splitName?: (fullName: string) => { first_name: string; last_name: string };
}

type CombinedNamesFormData = z.infer<typeof combinedNamesSchema>;

export const ProfileCompletionPrompt: React.FC<
  ProfileCompletionPromptProps
> = ({
  visible,
  currentField,
  missingFields,
  onComplete,
  onNext,
  onSkip,
  mandatory = false,
  getBestAvailableName,
  splitName: propSplitName,
}) => {
  const { profile, updateProfile } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enteredValues, setEnteredValues] = useState<Record<string, string>>(
    {},
  );
  const [selectedPhoneCountry, setSelectedPhoneCountry] =
    useState<ICountry | null>(null);

  // Check if we should show both name fields together
  const isNameField =
    currentField === "first_name" || currentField === "last_name";
  const shouldShowBothNames =
    isNameField &&
    (missingFields.includes("first_name") ||
      missingFields.includes("last_name"));

  const fieldConfig = shouldShowBothNames
    ? combinedNamesConfig
    : currentField
      ? fieldConfigs[currentField]
      : null;

  // Calculate progress considering name fields as one step
  const calculateVisualSteps = () => {
    const steps: string[] = [];
    let i = 0;
    while (i < missingFields.length) {
      const field = missingFields[i];
      if (field === "first_name" || field === "last_name") {
        // Group consecutive name fields as one step
        steps.push("names");
        // Skip any additional name fields
        while (
          i < missingFields.length &&
          (missingFields[i] === "first_name" ||
            missingFields[i] === "last_name")
        ) {
          i++;
        }
      } else {
        steps.push(field);
        i++;
      }
    }
    return steps;
  };

  const visualSteps = calculateVisualSteps();
  const currentVisualStepIndex = shouldShowBothNames
    ? visualSteps.indexOf("names")
    : visualSteps.findIndex((step) => step === currentField);
  const totalVisualSteps = visualSteps.length;
  const isLastField = currentVisualStepIndex === totalVisualSteps - 1;

  const splitName = useCallback((fullName: string) => {
    const nameParts = (fullName || "").trim().split(/\s+/);
    return {
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" ") || "",
    };
  }, []);

  const getDefaultValue = useCallback(() => {
    if (!currentField) return "";

    if (currentField === "first_name" || currentField === "last_name") {
      // Use the provided functions if available, otherwise use local splitName
      const useSplitName = propSplitName || splitName;
      const useGetBestName =
        getBestAvailableName || (() => profile?.full_name || "");

      const bestName = useGetBestName();
      const { first_name, last_name } = useSplitName(bestName);

      if (currentField === "first_name") {
        // Use entered value if available
        const enteredFirstName = enteredValues.first_name;
        if (enteredFirstName) return enteredFirstName;

        // Use database field if available
        if (profile?.first_name) {
          return profile.first_name === "User" ? "" : profile.first_name;
        }

        // Fall back to splitting full_name
        const firstName = useSplitName(bestName).first_name;
        return firstName === "User" ? "" : firstName;
      } else {
        // Use entered value if available
        const enteredLastName = enteredValues.last_name;
        if (enteredLastName) return enteredLastName;

        // Use database field if available
        if (profile?.last_name) {
          return profile.last_name;
        }

        // Fall back to splitting full_name
        return useSplitName(bestName).last_name;
      }
    }

    if (currentField === "phone_number") {
      return profile?.phone_number || "";
    }

    if (currentField === "date_of_birth") {
      const dbDate = profile?.date_of_birth || "";
      // Convert from YYYY-MM-DD to DD-MM-YYYY for display
      return dbDate ? convertToDisplayFormat(dbDate) : "";
    }

    return "";
  }, [
    currentField,
    propSplitName,
    splitName,
    getBestAvailableName,
    profile,
    enteredValues,
  ]);

  // Form for combined names
  const combinedNamesForm = useForm<CombinedNamesFormData>({
    resolver: zodResolver(combinedNamesSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
    },
  });

  // Form for single fields
  const form = useForm<FormData>({
    resolver:
      fieldConfig && !shouldShowBothNames
        ? zodResolver(createFieldSchema(currentField!))
        : undefined,
    defaultValues: {
      value: getDefaultValue(),
    },
  });

  // Update form when field changes
  React.useEffect(() => {
    if (shouldShowBothNames) {
      // Get default values for both name fields
      const useSplitName = propSplitName || splitName;
      const useGetBestName =
        getBestAvailableName || (() => profile?.full_name || "");
      const bestName = useGetBestName();
      const { first_name, last_name } = useSplitName(bestName);

      combinedNamesForm.reset({
        first_name:
          enteredValues.first_name ||
          profile?.first_name ||
          (first_name === "User" ? "" : first_name),
        last_name: enteredValues.last_name || profile?.last_name || last_name,
      });
    } else {
      const defaultValue = getDefaultValue();
      form.reset({ value: defaultValue });
    }
  }, [
    currentField,
    shouldShowBothNames,
    getDefaultValue,
    form,
    combinedNamesForm,
    propSplitName,
    splitName,
    getBestAvailableName,
    profile,
    enteredValues,
  ]);

  // Clear entered values when modal is closed
  React.useEffect(() => {
    if (!visible) {
      setEnteredValues({});
    }
  }, [visible]);

  const handleCombinedNamesSubmit = async (data: CombinedNamesFormData) => {
    Keyboard.dismiss();
    setIsSubmitting(true);

    try {
      const updateData = {
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        full_name: `${data.first_name.trim()} ${data.last_name.trim()}`.trim(),
      };

      // Update profile in database
      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profile?.id);

      if (error) {
        throw error;
      }

      // Update local profile state
      await updateProfile(updateData);

      // Reset form
      combinedNamesForm.reset({ first_name: "", last_name: "" });

      // Clear entered values
      setEnteredValues({});

      // Move to next field - explicitly tell it we completed last_name
      // (since we did both first_name AND last_name, pass last_name as the completed field)
      onNext("last_name");

      // If this was the last step, show completion message
      if (isLastField) {
        setTimeout(() => {
          Alert.alert(
            "Profile Complete!",
            "Your profile has been successfully updated with all required information.",
          );
        }, 100);
        onComplete();
      }
    } catch (error: any) {
      console.error("Error setting names:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to set names. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (data: FormData) => {
    if (!currentField || !fieldConfig) return;

    Keyboard.dismiss();

    // Validate phone number if this is the phone number field
    if (currentField === "phone_number") {
      if (!selectedPhoneCountry) {
        Alert.alert("Country Required", "Please select your country code.", [
          { text: "OK" },
        ]);
        return;
      }

      if (!isValidPhoneNumber(data.value, selectedPhoneCountry)) {
        Alert.alert(
          "Invalid Phone Number",
          "Please enter a valid phone number for the selected country.",
          [{ text: "OK" }],
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let updateData: any = {};

      if (currentField === "first_name" || currentField === "last_name") {
        // For name fields, update both individual fields AND computed full_name
        // Get current values from database or entered values
        const currentFirstName =
          profile?.first_name || enteredValues.first_name || "";
        const currentLastName =
          profile?.last_name || enteredValues.last_name || "";

        // Use entered values if available, otherwise fall back to current values
        const firstName =
          currentField === "first_name" ? data.value.trim() : currentFirstName;
        const lastName =
          currentField === "last_name" ? data.value.trim() : currentLastName;

        // Update both the individual field and the computed full_name
        updateData[currentField] = data.value.trim();
        updateData.full_name = `${firstName} ${lastName}`.trim();

        // Store the entered value for future reference
        setEnteredValues((prev) => ({
          ...prev,
          [currentField]: data.value.trim(),
        }));
      } else if (currentField === "date_of_birth") {
        // For date of birth, convert from DD-MM-YYYY to YYYY-MM-DD before saving
        updateData[currentField] = convertToDbFormat(data.value);
      } else if (currentField === "phone_number") {
        // For phone number, create E.164 format with country code using libphonenumber-js
        if (selectedPhoneCountry) {
          const national = data.value.replace(/^0+/, "").replace(/\s/g, "");
          const parsedPhone = parsePhoneNumberFromString(
            national,
            selectedPhoneCountry.cca2 as CountryCode,
          );
          const phoneE164 = parsedPhone?.format("E.164") ?? "";
          if (!phoneE164) {
            Alert.alert(
              "Invalid Phone Number",
              "Could not format your phone number. Please check and try again.",
              [{ text: "OK" }],
            );
            return;
          }
          updateData[currentField] = phoneE164;
        } else {
          updateData[currentField] = data.value;
        }
      } else {
        // For other fields, update directly
        updateData[currentField] = data.value;
      }

      // Update profile in database
      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profile?.id);

      if (error) {
        throw error;
      }

      // Update local profile state
      await updateProfile(updateData);

      // Reset form
      form.reset({ value: "" });

      // Move to next field or complete
      if (isLastField) {
        // Clear entered values when completing
        setEnteredValues({});
        onComplete();
        setTimeout(() => {
          Alert.alert(
            "Profile Complete!",
            "Your profile has been successfully updated with all required information.",
          );
        }, 100);
      } else {
        onNext();
      }
    } catch (error: any) {
      console.error(`Error setting ${currentField}:`, error);

      // Handle phone number uniqueness error
      if (
        currentField === "phone_number" &&
        error?.code === "23505" &&
        error?.message?.includes("idx_profiles_phone_unique")
      ) {
        Alert.alert(
          "Phone Number Already Exists",
          "An account already exists with this phone number. Please use a different phone number.",
          [{ text: "OK" }],
        );
      } else {
        Alert.alert(
          "Error",
          error.message || `Failed to set ${currentField}. Please try again.`,
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhoneNumberRedirect = () => {
    // This function is no longer needed since we handle phone input directly
    // The phone number field will be handled by the regular form submission
  };

  const handleSkip = () => {
    if (!fieldConfig?.canSkip && mandatory) {
      Alert.alert(
        "Required Information",
        `${fieldConfig?.title || "This field"} is required to continue.`,
        [{ text: "OK" }],
      );
      return;
    }

    Alert.alert(
      "Skip Field",
      `You can add this information later in your profile settings.`,
      [
        { text: "Add Now", style: "default" },
        {
          text: "Skip",
          style: "cancel",
          onPress: () => {
            if (isLastField) {
              // Clear entered values when completing
              setEnteredValues({});
              onComplete();
            } else {
              onNext();
            }
            onSkip?.();
          },
        },
      ],
    );
  };

  if (!visible || !currentField || !fieldConfig) return null;

  const IconComponent = fieldConfig.icon;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <TouchableWithoutFeedback onPress={() => {}}>
            <View className="bg-background w-full max-w-md rounded-xl p-6 shadow-lg">
              {/* Header */}
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <H2 className="flex-1">{fieldConfig.title}</H2>
                </View>
              </View>

              {/* Progress indicator */}
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row gap-1">
                  {visualSteps.map((_, index) => (
                    <View
                      key={index}
                      className={`w-2 h-2 rounded-full ${
                        index <= currentVisualStepIndex
                          ? "bg-primary"
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </View>
              </View>

              {/* Description */}
              <P className="text-muted-foreground mb-6 leading-relaxed">
                {fieldConfig.description}
              </P>

              {/* Warning for DOB */}
              {currentField === "date_of_birth" && (
                <View className="flex-row items-start bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg mb-6 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle
                    size={20}
                    className="text-amber-600 dark:text-amber-400 mt-0.5 mr-3"
                  />
                  <View className="flex-1">
                    <Text className="font-medium text-amber-700 dark:text-amber-300 mb-1">
                      One-Time Setting
                    </Text>
                    <Text className="text-sm text-amber-600 dark:text-amber-400">
                      Your date of birth can only be set once and cannot be
                      changed afterward for security and verification purposes.
                    </Text>
                  </View>
                </View>
              )}

              {/* Form - Show combined names or single field */}
              {shouldShowBothNames ? (
                <Form {...combinedNamesForm}>
                  <View className="gap-4">
                    <FormField
                      control={combinedNamesForm.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormInput
                          {...field}
                          label="First Name"
                          placeholder="John"
                          autoCapitalize="words"
                          autoCorrect={false}
                          autoComplete="given-name"
                          returnKeyType="next"
                        />
                      )}
                    />
                    <FormField
                      control={combinedNamesForm.control}
                      name="last_name"
                      render={({ field }) => (
                        <FormInput
                          {...field}
                          label="Last Name"
                          placeholder="Doe"
                          autoCapitalize="words"
                          autoCorrect={false}
                          autoComplete="family-name"
                          returnKeyType="done"
                          onSubmitEditing={Keyboard.dismiss}
                        />
                      )}
                    />
                  </View>
                </Form>
              ) : (
                <Form {...form}>
                  <FormField
                    control={form.control}
                    name="value"
                    render={({ field }) =>
                      currentField === "phone_number" ? (
                        <InternationalPhoneInput
                          value={field.value}
                          onChangePhoneNumber={field.onChange}
                          selectedCountry={selectedPhoneCountry}
                          onChangeSelectedCountry={setSelectedPhoneCountry}
                          label="Phone Number"
                          description="Enter your phone number (country code will be added automatically)"
                          defaultCountry="LB"
                          error={form.formState.errors.value?.message}
                        />
                      ) : (
                        <FormInput
                          {...field}
                          label={fieldConfig.title.replace("Add Your ", "")}
                          placeholder={fieldConfig.placeholder}
                          description={
                            fieldConfig.isDateField
                              ? "Enter your birth day, month, and year (dashes added automatically)"
                              : undefined
                          }
                          autoCapitalize={fieldConfig.autoCapitalize}
                          autoCorrect={false}
                          keyboardType={fieldConfig.keyboardType || "default"}
                          maxLength={fieldConfig.maxLength}
                          autoComplete={fieldConfig.autoComplete as any}
                          returnKeyType="done"
                          onSubmitEditing={Keyboard.dismiss}
                          onChangeText={(text: string) => {
                            const formatted = fieldConfig.isDateField
                              ? formatDateInput(text)
                              : text;
                            field.onChange(formatted);
                          }}
                        />
                      )
                    }
                  />
                </Form>
              )}

              {/* Security Note for DOB */}
              {currentField === "date_of_birth" && (
                <View className="flex-row items-center mt-4 mb-6">
                  <Shield
                    size={16}
                    className="text-green-600 dark:text-green-400 mr-2"
                  />
                  <Text className="text-xs text-muted-foreground flex-1">
                    Your date of birth is used only for age verification and is
                    kept secure
                  </Text>
                </View>
              )}

              {/* Actions */}
              <View className="flex-row gap-3 mt-6">
                <Button
                  className="flex-1"
                  onPress={
                    shouldShowBothNames
                      ? combinedNamesForm.handleSubmit(
                          handleCombinedNamesSubmit,
                        )
                      : form.handleSubmit(handleSubmit)
                  }
                  disabled={isSubmitting}
                >
                  {isLastField ? (
                    <CheckCircle size={16} className="text-white mr-2" />
                  ) : (
                    <IconComponent size={16} className="text-white mr-2" />
                  )}
                  <Text className="text-white font-medium">
                    {isSubmitting
                      ? "Saving..."
                      : isLastField
                        ? "Complete Profile"
                        : "Next"}
                  </Text>
                </Button>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
