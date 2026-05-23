// components/rating/BookingRestrictionAlert.tsx
import React from "react";
import { View, Text, Alert } from "react-native";
import { Button } from "@/components/ui/button";
import { useUserRating } from "@/hooks/useUserRating";

interface BookingRestrictionAlertProps {
  restaurantId: string;
  onContinue?: () => void;
  onCancel?: () => void;
  showAsModal?: boolean;
}

export function BookingRestrictionAlert({
  restaurantId,
  onContinue,
  onCancel,
  showAsModal = false,
}: BookingRestrictionAlertProps) {
  const { checkBookingEligibility, tier, currentRating } = useUserRating();
  const [eligibility, setEligibility] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const checkEligibility = async () => {
      try {
        const result = await checkBookingEligibility(restaurantId);
        setEligibility(result);
      } catch (error) {
        console.error("Error checking eligibility:", error);
      } finally {
        setLoading(false);
      }
    };

    checkEligibility();
  }, [restaurantId, checkBookingEligibility]);

  // Don't show anything if user can book normally
  if (
    !loading &&
    eligibility &&
    eligibility.can_book &&
    eligibility.can_instant_book
  ) {
    return null;
  }

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  if (loading) {
    return (
      <View className="bg-gray-50 p-4 rounded-lg">
        <Text className="text-gray-600 text-center">
          Checking booking eligibility...
        </Text>
      </View>
    );
  }

  if (!eligibility) {
    return null;
  }

  // If user is completely blocked
  if (!eligibility.can_book) {
    if (showAsModal) {
      Alert.alert(
        "Booking Restricted",
        eligibility.reason ||
          "You cannot book at this restaurant due to your current rating.",
        [{ text: "OK", onPress: handleCancel }],
      );
      return null;
    }

    return (
      <View className="bg-red-50 border border-red-200 p-4 rounded-lg mb-4">
        <View className="flex-row items-center mb-3">
          <View className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center mr-3">
            <Text className="text-white text-xs font-bold">!</Text>
          </View>
          <Text className="text-red-800 font-bold text-lg">
            Booking Restricted
          </Text>
        </View>

        <Text className="text-red-700 mb-4">
          {eligibility.reason ||
            "You cannot book at this restaurant due to your current rating."}
        </Text>

        <View className="bg-red-100 p-3 rounded-lg mb-4">
          <Text className="text-red-800 font-medium mb-1">
            Your Current Rating
          </Text>
          <Text className="text-red-700">
            {currentRating.toFixed(1)}/5.0 -{" "}
            {tier?.tier
              .replace("_", " ")
              .replace(/\b\w/g, (l) => l.toUpperCase())}
          </Text>
        </View>

        <Button
          onPress={handleCancel}
          variant="outline"
          className="border-red-300"
        >
          <Text className="text-red-700">View Rating Details</Text>
        </Button>
      </View>
    );
  }

  // If user can only make request bookings
  if (!eligibility.can_instant_book) {
    if (showAsModal) {
      Alert.alert(
        "Booking Policy Changed",
        eligibility.instant_book_reason ||
          "Due to your current rating, this booking will be submitted as a request for restaurant approval.",
        [
          { text: "Continue as Request", onPress: handleContinue },
          { text: "Cancel", style: "cancel", onPress: handleCancel },
        ],
      );
      return null;
    }

    return (
      <View className="bg-amber-50 border border-amber-200 p-4 rounded-lg mb-4">
        <View className="flex-row items-center mb-3">
          <View className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center mr-3">
            <Text className="text-white text-xs font-bold">⚠</Text>
          </View>
          <Text className="text-amber-800 font-bold text-lg">
            Request Booking Only
          </Text>
        </View>

        <Text className="text-amber-700 mb-4">
          {eligibility.instant_book_reason ||
            "Due to your current rating, this booking will be submitted as a request for restaurant approval."}
        </Text>

        <View className="bg-amber-100 p-3 rounded-lg mb-4">
          <Text className="text-amber-800 font-medium mb-1">
            Your Current Rating
          </Text>
          <Text className="text-amber-700">
            {currentRating.toFixed(1)}/5.0 -{" "}
            {tier?.tier
              .replace("_", " ")
              .replace(/\b\w/g, (l) => l.toUpperCase())}
          </Text>
        </View>

        <Text className="text-amber-700 text-sm mb-4">
          The restaurant will review your request and respond within 24 hours.
          You can improve your rating by completing bookings and avoiding
          cancellations.
        </Text>

        <View className="flex-row space-x-3">
          <Button onPress={handleContinue} className="bg-amber-600 flex-1">
            <Text className="text-white">Continue as Request</Text>
          </Button>
          <Button
            onPress={handleCancel}
            variant="outline"
            className="border-amber-300 flex-1"
          >
            <Text className="text-amber-700">Cancel</Text>
          </Button>
        </View>
      </View>
    );
  }

  return null;
}
