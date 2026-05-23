import React from "react";
import { View, Pressable } from "react-native";
import { Utensils } from "lucide-react-native";
import { Control, Controller, FieldErrors } from "react-hook-form";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import {
  OCCASIONS,
  DIETARY_RESTRICTIONS,
  TABLE_PREFERENCES,
} from "@/lib/bookingUtils";

interface BookingFormData {
  specialRequests?: string;
  occasion?: string;
  dietaryRestrictions: string[];
  tablePreferences: string[];
  acceptTerms: boolean;
}

interface SpecialRequirementsFormProps {
  control: Control<BookingFormData>;
  errors: FieldErrors<BookingFormData>;
  watchedValues: Partial<BookingFormData>;
  onToggleDietaryRestriction: (restriction: string) => void;
  onToggleTablePreference: (preference: string) => void;
  onSetOccasion: (occasionId: string) => void;
  className?: string;
}

export const SpecialRequirementsForm: React.FC<
  SpecialRequirementsFormProps
> = ({
  control,
  errors,
  watchedValues,
  onToggleDietaryRestriction,
  onToggleTablePreference,
  onSetOccasion,
  className = "",
}) => {
  return (
    <View
      className={`bg-card border border-border rounded-xl p-4 ${className}`}
    >
      <View className="flex-row items-center gap-3 mb-4">
        <Utensils size={20} color="#3b82f6" />
        <Text className="font-bold text-lg">Special Requirements</Text>
      </View>

      {/* Occasion Selection */}
      <View className="mb-4">
        <Text className="font-medium mb-2">Special Occasion</Text>
        <View className="flex-row flex-wrap gap-2">
          {OCCASIONS.slice(0, 4).map((occasion) => (
            <Pressable
              key={occasion.id}
              onPress={() => onSetOccasion(occasion.id)}
              className={`px-3 py-2 rounded-lg border flex-row items-center gap-2 ${
                watchedValues.occasion === occasion.id
                  ? "bg-primary border-primary"
                  : "bg-background border-border"
              }`}
            >
              {occasion.icon && <Text>{occasion.icon}</Text>}
              <Text
                className={
                  watchedValues.occasion === occasion.id
                    ? "text-primary-foreground text-sm"
                    : "text-sm"
                }
              >
                {occasion.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Dietary Restrictions */}
      <View className="mb-4">
        <Text className="font-medium mb-2">Dietary Restrictions</Text>
        <View className="flex-row flex-wrap gap-2">
          {DIETARY_RESTRICTIONS.slice(0, 8).map((restriction) => {
            const isSelected =
              watchedValues.dietaryRestrictions?.includes(restriction) || false;

            return (
              <Pressable
                key={restriction}
                onPress={() => onToggleDietaryRestriction(restriction)}
                className={`px-3 py-2 rounded-lg border ${
                  isSelected
                    ? "bg-green-100 dark:bg-green-900/20 border-green-500"
                    : "bg-background border-border"
                }`}
              >
                <Text
                  className={
                    isSelected
                      ? "text-green-800 dark:text-green-200 text-sm"
                      : "text-sm"
                  }
                >
                  {restriction}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Table Preferences */}
      <View className="mb-4">
        <Text className="font-medium mb-2">Table Preferences</Text>
        <View className="flex-row flex-wrap gap-2">
          {TABLE_PREFERENCES.slice(0, 6).map((preference) => {
            const isSelected =
              watchedValues.tablePreferences?.includes(preference) || false;

            return (
              <Pressable
                key={preference}
                onPress={() => onToggleTablePreference(preference)}
                className={`px-3 py-2 rounded-lg border ${
                  isSelected
                    ? "bg-blue-100 dark:bg-blue-900/20 border-blue-500"
                    : "bg-background border-border"
                }`}
              >
                <Text
                  className={
                    isSelected
                      ? "text-blue-800 dark:text-blue-200 text-sm"
                      : "text-sm"
                  }
                >
                  {preference}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Special Requests */}
      <Controller
        control={control}
        name="specialRequests"
        render={({ field: { onChange, value } }) => (
          <Textarea
            label="Special Requests"
            value={value || ""}
            onChangeText={onChange}
            placeholder="Any other special requests or notes..."
            description="Optional - Let us know if you have any specific needs"
            numberOfLines={3}
            maxLength={500}
            error={errors.specialRequests?.message}
          />
        )}
      />
    </View>
  );
};
