import React from "react";
import { View, Pressable } from "react-native";
import { Calendar, Clock, Users, Tag, X, Hourglass } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Image } from "@/components/image";
import { formatLebanonDateShort, formatLebanonTime } from "@/utils/lebanonTime";
import { TurnTimeService } from "@/lib/TurnTimeService";

interface Restaurant {
  id: string;
  name: string;
  main_image_url: string | null;
}

interface UserProfile {
  full_name?: string;
  phone_number?: string;
}

interface AppliedOffer {
  id: string;
  special_offer: {
    title: string;
    discount_percentage: number;
  };
}

interface AppliedPromoDisplay {
  code: string;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  max_discount_amount?: number | null;
  description?: string | null;
}

interface BookingSummaryCardProps {
  restaurant: Restaurant;
  date: Date;
  time: string;
  partySize: number;
  invitedFriendsCount: number;
  userProfile: UserProfile;
  appliedOffer?: AppliedOffer | null;
  onRemoveOffer?: () => void;
  appliedPromo?: AppliedPromoDisplay | null;
  onRemovePromo?: () => void;
  className?: string;
  /** Dining duration in minutes - shown as a note to set expectations */
  diningDurationMinutes?: number;
  /** Whether to show the dining duration notice (controlled by restaurant setting) */
  showDiningDuration?: boolean;
}

export const BookingSummaryCard: React.FC<BookingSummaryCardProps> = ({
  restaurant,
  date,
  time,
  partySize,
  invitedFriendsCount,
  userProfile,
  appliedOffer,
  onRemoveOffer,
  appliedPromo,
  onRemovePromo,
  className = "",
  diningDurationMinutes,
  showDiningDuration,
}) => {
  const totalPartySize = partySize + invitedFriendsCount;

  return (
    <View
      className={`p-4 bg-card rounded-xl border border-border ${className}`}
    >
      {/* Restaurant and Booking Info */}
      <View className="flex-row items-center gap-3 mb-3">
        <Image
          {...({
            source: { uri: restaurant.main_image_url },
            optimizationPreset: "medium",
            className: "w-16 h-16 rounded-lg",
            contentFit: "cover",
          } as any)}
        />
        <View className="flex-1">
          <Text className="font-semibold text-lg">{restaurant.name}</Text>
          <View className="flex-row items-center gap-2 mt-1">
            <Calendar size={14} color="#666" />
            <Text className="text-sm text-muted-foreground">
              {formatLebanonDateShort(date)}
            </Text>
            <Clock size={14} color="#666" />
            <Text className="text-sm text-muted-foreground">
              {formatLebanonTime(date)}
            </Text>
            <Users size={14} color="#666" />
            <Text className="text-sm text-muted-foreground">
              {totalPartySize} {totalPartySize === 1 ? "Guest" : "Guests"}
              {invitedFriendsCount > 0 &&
                ` (${invitedFriendsCount} friends invited)`}
            </Text>
          </View>
        </View>
      </View>

      {/* User Info */}
      <View className="border-t border-border pt-3">
        <Text className="text-sm text-muted-foreground">Booking for:</Text>
        <Text className="font-medium">{userProfile.full_name || "User"}</Text>
        {userProfile.phone_number && (
          <Text className="text-sm text-muted-foreground">
            {userProfile.phone_number.replace(
              /^(\+\d{1,3})(\d{2})(\d{3})(\d{3,4})$/,
              "$1 $2 $3 $4",
            )}
          </Text>
        )}
      </View>

      {/* Applied Offer */}
      {appliedOffer && (
        <View className="border-t border-border pt-3 mt-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Tag size={16} color="#10b981" />
              <Text className="text-sm font-medium">
                {appliedOffer.special_offer.title} (
                {appliedOffer.special_offer.discount_percentage}% OFF)
              </Text>
            </View>
            {onRemoveOffer && (
              <Pressable onPress={onRemoveOffer}>
                <X size={16} color="#666" />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Applied Promo Code */}
      {appliedPromo && (
        <View className="border-t border-border pt-3 mt-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Tag size={16} color="#8b5cf6" />
              <Text className="text-sm font-medium">
                {appliedPromo.code} ·{" "}
                {appliedPromo.discount_type === "percentage"
                  ? `${appliedPromo.discount_value}% OFF${appliedPromo.max_discount_amount ? ` (max $${appliedPromo.max_discount_amount})` : ""}`
                  : `$${appliedPromo.discount_value} OFF`}
              </Text>
            </View>
            {onRemovePromo && (
              <Pressable onPress={onRemovePromo}>
                <X size={16} color="#666" />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Dining Duration Notice */}
      {showDiningDuration &&
        diningDurationMinutes &&
        diningDurationMinutes > 0 && (
          <View className="border-t border-border pt-2 mt-3">
            <View className="flex-row items-center gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
              <Hourglass
                size={14}
                className="text-amber-600 dark:text-amber-400"
              />
              <Text className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                Dining time limit:{" "}
                {TurnTimeService.getTurnTimeSummary(diningDurationMinutes)}
              </Text>
            </View>
          </View>
        )}
    </View>
  );
};
