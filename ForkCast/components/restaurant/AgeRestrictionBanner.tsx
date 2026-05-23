import React from "react";
import { View, Pressable } from "react-native";
import {
  AlertTriangle,
  UserX,
  Calendar,
  ArrowRight,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { AgeVerificationResult } from "@/utils/ageVerification";

interface AgeRestrictionBannerProps {
  ageVerification: AgeVerificationResult;
  isGuest?: boolean;
  onSignUp?: () => void;
  onUpdateProfile?: () => void;
}

export const AgeRestrictionBanner: React.FC<AgeRestrictionBannerProps> = ({
  ageVerification,
  isGuest,
  onSignUp,
  onUpdateProfile,
}) => {
  const { canBook, userAge, requiredAge, reason, requiresDateOfBirth } =
    ageVerification;

  // Don't render if user can book
  if (canBook) return null;

  // Guest user banner
  if (isGuest) {
    return (
      <View className="mx-4 mb-4 p-4 bg-orange-50 dark:bg-orange-900/30 rounded-xl border border-orange-200 dark:border-orange-800">
        <View className="flex-row items-start">
          <UserX
            size={24}
            className="text-orange-600 dark:text-orange-400 mt-1"
          />
          <View className="flex-1 ml-3">
            <Text className="font-bold text-orange-700 dark:text-orange-300 mb-1">
              Age Verification Required
            </Text>
            <P className="text-orange-600 dark:text-orange-400 mb-3">
              This venue requires age verification. Please sign up to provide
              your date of birth.
            </P>
            {requiredAge && (
              <Text className="text-sm text-orange-600 dark:text-orange-400 mb-3">
                Minimum age: {requiredAge} years
              </Text>
            )}
            {onSignUp && (
              <Button onPress={onSignUp} size="sm" className="self-start">
                <ArrowRight size={16} className="text-white mr-1" />
                <Text className="text-white font-medium">
                  Sign Up to Continue
                </Text>
              </Button>
            )}
          </View>
        </View>
      </View>
    );
  }

  // User needs to add date of birth
  if (requiresDateOfBirth) {
    return (
      <View className="mx-4 mb-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-800">
        <View className="flex-row items-start">
          <Calendar
            size={24}
            className="text-blue-600 dark:text-blue-400 mt-1"
          />
          <View className="flex-1 ml-3">
            <Text className="font-bold text-blue-700 dark:text-blue-300 mb-1">
              Date of Birth Required
            </Text>
            <P className="text-blue-600 dark:text-blue-400 mb-3">
              {reason ||
                "Please add your date of birth to your profile to book this venue."}
            </P>
            {requiredAge && (
              <Text className="text-sm text-blue-600 dark:text-blue-400 mb-3">
                Minimum age: {requiredAge} years
              </Text>
            )}
            {onUpdateProfile && (
              <Button
                onPress={onUpdateProfile}
                size="sm"
                className="self-start"
              >
                <Calendar size={16} className="text-white mr-1" />
                <Text className="text-white font-medium">Update Profile</Text>
              </Button>
            )}
          </View>
        </View>
      </View>
    );
  }

  // User is too young
  return (
    <View className="mx-4 mb-4 p-4 bg-red-50 dark:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-800">
      <View className="flex-row items-start">
        <AlertTriangle
          size={24}
          className="text-red-600 dark:text-red-400 mt-1"
        />
        <View className="flex-1 ml-3">
          <Text className="font-bold text-red-700 dark:text-red-300 mb-1">
            Age Restriction
          </Text>
          <P className="text-red-600 dark:text-red-400 mb-2">{reason}</P>
          {userAge !== null && requiredAge && (
            <Text className="text-sm text-red-600 dark:text-red-400">
              You are {userAge} years old. This venue requires guests to be at
              least {requiredAge} years old.
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};
