// components/rating/UserRatingDashboard.tsx
import React from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { CircularProgress } from "react-native-circular-progress";
import { useUserRating } from "@/hooks/useUserRating";
import { Button } from "@/components/ui/button";
import { formatDateToDDMMYYYY } from "@/utils/birthday";

interface UserRatingDashboardProps {
  userId?: string;
  isOwnProfile?: boolean;
}

export function UserRatingDashboard({
  userId,
  isOwnProfile = true,
}: UserRatingDashboardProps) {
  const {
    stats,
    tier,
    history,
    loading,
    error,
    currentRating,
    isExcellent,
    isGood,
    isRestricted,
    isBlocked,
    canBookInstant,
    hasRestrictions,
    refresh,
  } = useUserRating(userId);

  // Update tier logic for new simplified system
  const isUnrestricted = tier?.tier === "unrestricted";
  const isRequestOnly = tier?.tier === "request_only";
  const isUserBlocked = tier?.tier === "blocked";

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <Text className="text-gray-600">Loading rating information...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <Text className="text-red-600 mb-4">
          Failed to load rating information
        </Text>
        <Button onPress={refresh} variant="outline">
          <Text>Retry</Text>
        </Button>
      </View>
    );
  }

  const getRatingColor = () => {
    if (isUnrestricted) return "#22c55e"; // green
    if (isRequestOnly) return "#f59e0b"; // amber
    if (isUserBlocked) return "#ef4444"; // red
    return "#6b7280"; // gray
  };

  const getRatingLabel = () => {
    if (isUnrestricted) return "Unrestricted";
    if (isRequestOnly) return "Request Only";
    if (isUserBlocked) return "Blocked";
    return "Unknown";
  };

  const getRestrictionMessage = () => {
    if (isUserBlocked) {
      return "You are currently unable to make bookings due to your rating. Please contact support.";
    }
    if (isRequestOnly) {
      return "All your bookings will be submitted as requests for restaurant approval.";
    }
    if (isUnrestricted) {
      return "No restrictions - follows restaurant booking policy (instant or request as set by restaurant).";
    }
    return "";
  };

  const getImprovementTips = () => {
    const tips = [];

    if (stats?.no_show_count && stats.no_show_count > 0) {
      tips.push("• Avoid no-shows - they significantly impact your rating");
    }

    if (stats?.late_cancellation_count && stats.late_cancellation_count > 0) {
      tips.push("• Try to cancel reservations at least 2 hours in advance");
    }

    if (stats?.completed_bookings && stats.completed_bookings < 5) {
      tips.push("• Complete more bookings to improve your rating");
    }

    tips.push("• Leave reviews after dining to earn bonus points");

    return tips;
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-6">
        {/* Rating Overview */}
        <View className="bg-white rounded-xl p-6 mb-6 shadow-sm">
          <Text className="text-xl font-bold text-gray-900 mb-4 text-center">
            Your Rating Status
          </Text>

          <View className="items-center mb-6">
            <CircularProgress
              size={120}
              width={12}
              fill={(currentRating / 5) * 100}
              tintColor={getRatingColor()}
              backgroundColor="#e5e7eb"
              rotation={0}
            >
              {() => (
                <View className="items-center">
                  <Text className="text-2xl font-bold text-gray-900">
                    {currentRating.toFixed(1)}
                  </Text>
                  <Text className="text-sm text-gray-600">out of 5.0</Text>
                </View>
              )}
            </CircularProgress>

            <View className="mt-4 items-center">
              <Text
                className="text-lg font-semibold mb-2"
                style={{ color: getRatingColor() }}
              >
                {getRatingLabel()} Rating
              </Text>
              <Text className="text-gray-600 text-center px-4">
                {getRestrictionMessage()}
              </Text>
            </View>
          </View>

          {/* Booking Status */}
          <View className="border-t border-gray-200 pt-4">
            <Text className="font-semibold text-gray-900 mb-2">
              Booking Privileges
            </Text>
            <View className="flex-row items-center mb-2">
              <View
                className={`w-3 h-3 rounded-full mr-3 ${isUnrestricted ? "bg-green-500" : "bg-amber-500"}`}
              />
              <Text
                className={isUnrestricted ? "text-green-700" : "text-amber-700"}
              >
                Restaurant Policy:{" "}
                {isUnrestricted ? "Follows restaurant setting" : "All requests"}
              </Text>
            </View>
            <View className="flex-row items-center">
              <View
                className={`w-3 h-3 rounded-full mr-3 ${!isUserBlocked ? "bg-green-500" : "bg-red-500"}`}
              />
              <Text
                className={!isUserBlocked ? "text-green-700" : "text-red-700"}
              >
                Booking Access: {!isUserBlocked ? "Available" : "Blocked"}
              </Text>
            </View>
          </View>
        </View>

        {/* Statistics */}
        {stats && (
          <View className="bg-white rounded-xl p-6 mb-6 shadow-sm">
            <Text className="text-lg font-bold text-gray-900 mb-4">
              Booking Statistics
            </Text>

            <View className="grid grid-cols-2 gap-4">
              <View className="items-center p-3 bg-blue-50 rounded-lg">
                <Text className="text-2xl font-bold text-blue-600">
                  {stats.total_bookings}
                </Text>
                <Text className="text-sm text-gray-600">Total Bookings</Text>
              </View>

              <View className="items-center p-3 bg-green-50 rounded-lg">
                <Text className="text-2xl font-bold text-green-600">
                  {stats.completed_bookings}
                </Text>
                <Text className="text-sm text-gray-600">Completed</Text>
              </View>

              <View className="items-center p-3 bg-amber-50 rounded-lg">
                <Text className="text-2xl font-bold text-amber-600">
                  {stats.cancelled_bookings}
                </Text>
                <Text className="text-sm text-gray-600">Cancelled</Text>
              </View>

              <View className="items-center p-3 bg-red-50 rounded-lg">
                <Text className="text-2xl font-bold text-red-600">
                  {stats.no_show_count}
                </Text>
                <Text className="text-sm text-gray-600">No Shows</Text>
              </View>
            </View>
          </View>
        )}

        {/* Improvement Tips */}
        {(isRequestOnly || isUserBlocked) && isOwnProfile && (
          <View className="bg-white rounded-xl p-6 mb-6 shadow-sm">
            <Text className="text-lg font-bold text-gray-900 mb-4">
              How to Improve Your Rating
            </Text>

            {getImprovementTips().map((tip, index) => (
              <Text key={index} className="text-gray-700 mb-2">
                {tip}
              </Text>
            ))}

            <View className="mt-4 p-4 bg-blue-50 rounded-lg">
              <Text className="text-blue-800 font-medium mb-2">
                Rating System
              </Text>
              <Text className="text-blue-700 text-sm">
                • No-shows: -0.5 points{"\n"}• Late cancellations: -0.2 points
                {"\n"}• Completed bookings: baseline{"\n"}• Reviews left: +0.1
                points{"\n"}
                {"\n"}
                Rating Tiers:{"\n"}• 2.0+: Unrestricted (Follows restaurant
                policy){"\n"}• 1.0-1.9: Request only (All bookings need
                approval){"\n"}• 1.0: Blocked (No booking allowed)
              </Text>
            </View>
          </View>
        )}

        {/* Recent Rating History */}
        {history.length > 0 && isOwnProfile && (
          <View className="bg-white rounded-xl p-6 shadow-sm">
            <Text className="text-lg font-bold text-gray-900 mb-4">
              Recent Rating Changes
            </Text>

            {history.slice(0, 5).map((entry) => (
              <View
                key={entry.id}
                className="flex-row items-center justify-between py-3 border-b border-gray-100 last:border-b-0"
              >
                <View className="flex-1">
                  <Text className="font-medium text-gray-900">
                    {entry.change_reason
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Text>
                  <Text className="text-sm text-gray-600">
                    {formatDateToDDMMYYYY(new Date(entry.created_at))}
                  </Text>
                </View>

                <View className="items-end">
                  <Text
                    className={`font-semibold ${
                      entry.rating_after > entry.rating_before
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {entry.rating_after > entry.rating_before ? "+" : ""}
                    {(entry.rating_after - entry.rating_before).toFixed(2)}
                  </Text>
                  <Text className="text-sm text-gray-600">
                    {entry.rating_after.toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Contact Support for Blocked Users */}
        {isUserBlocked && isOwnProfile && (
          <View className="bg-red-50 rounded-xl p-6 mt-6">
            <Text className="text-red-800 font-bold mb-2">Need Help?</Text>
            <Text className="text-red-700 mb-4">
              If you believe your rating restriction is unfair or have questions
              about improving your standing, please contact our support team.
            </Text>
            <Button
              onPress={() =>
                Alert.alert(
                  "Contact Support",
                  "Please email support@plate.com or use the in-app support feature.",
                )
              }
              className="bg-red-600"
            >
              <Text className="text-white">Contact Support</Text>
            </Button>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
