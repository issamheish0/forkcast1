import React from "react";
import { View, Pressable } from "react-native";
import { CheckCircle } from "lucide-react-native";
import { Control, Controller, FieldErrors } from "react-hook-form";
import { Text } from "@/components/ui/text";

interface BookingFormData {
  specialRequests?: string;
  occasion?: string;
  dietaryRestrictions: string[];
  tablePreferences: string[];
  acceptTerms: boolean;
}

interface TermsAcceptanceProps {
  control: Control<BookingFormData>;
  errors: FieldErrors<BookingFormData>;
  invitedFriendsCount?: number;
  className?: string;
}

export const TermsAcceptance: React.FC<TermsAcceptanceProps> = ({
  control,
  errors,
  invitedFriendsCount = 0,
  className = "",
}) => {
  return (
    <View
      className={`bg-card border border-border rounded-xl p-4 ${className}`}
    >
      <Controller
        control={control}
        name="acceptTerms"
        render={({ field: { onChange, value } }) => (
          <Pressable
            onPress={() => onChange(!value)}
            className="flex-row items-start gap-3"
          >
            <View
              className={`w-5 h-5 rounded border-2 items-center justify-center mt-0.5 ${
                value ? "bg-primary border-primary" : "border-border"
              }`}
            >
              {value && <CheckCircle size={14} color="white" />}
            </View>
            <Text className="flex-1 text-sm">
              I agree to the{" "}
              <Text className="text-primary underline">booking terms</Text> and
              understand the cancellation policy
              {invitedFriendsCount > 0 &&
                " and sending invitations to selected friends"}
              .
            </Text>
          </Pressable>
        )}
      />
      {errors.acceptTerms && (
        <Text className="text-sm text-red-500 mt-2">
          {errors.acceptTerms.message}
        </Text>
      )}
    </View>
  );
};
