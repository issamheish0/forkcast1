import React, { useCallback } from "react";
import { View, Pressable } from "react-native";
import { CheckCircle, AlertCircle } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { formatDateToDDMMYYYY } from "@/utils/birthday";

interface UserOfferWithDetails {
  id: string;
  user_id: string;
  offer_id: string;
  claimed_at: string;
  used_at?: string;
  expires_at: string;
  special_offer: {
    id: string;
    title: string;
    description: string;
    discount_percentage: number;
    valid_until: string;
    restaurant_id: string;
    minimum_party_size?: number;
    terms_conditions?: string[];
  };
}

interface OfferCardProps {
  offer: UserOfferWithDetails;
  isSelected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  partySize: number;
}

const isValidDate = (dateString: string | undefined): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date.getTime() > 0;
};

export const OfferCard: React.FC<OfferCardProps> = ({
  offer,
  isSelected,
  onSelect,
  onDeselect,
  partySize,
}) => {
  const formatDate = useCallback((dateString: string) => {
    try {
      if (!isValidDate(dateString)) return "Soon";
      const date = new Date(dateString);
      return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
    } catch (error) {
      console.warn("Error formatting date:", dateString, error);
      return "Soon";
    }
  }, []);

  // Check if offer is valid for current party size
  const isValidForPartySize =
    !offer.special_offer.minimum_party_size ||
    partySize >= offer.special_offer.minimum_party_size;

  // Check if offer is expired
  const isExpired =
    isValidDate(offer.expires_at) && new Date(offer.expires_at) < new Date();

  const canUse = isValidForPartySize && !isExpired && !offer.used_at;

  return (
    <Pressable
      onPress={canUse ? (isSelected ? onDeselect : onSelect) : undefined}
      className={`border-2 rounded-xl p-4 ${
        !canUse
          ? "border-gray-300 bg-gray-50 dark:bg-gray-900/50 opacity-60"
          : isSelected
            ? "border-green-500 bg-green-50 dark:bg-green-900/20"
            : "border-border bg-card"
      }`}
    >
      {/* Header with discount badge */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-3">
          <Text className="font-bold text-lg mb-1" numberOfLines={1}>
            {offer.special_offer.title}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={2}>
            {offer.special_offer.description}
          </Text>
        </View>

        <View className="relative">
          <View
            className={`rounded-full h-12 w-12 items-center justify-center ${
              canUse ? "bg-green-500" : "bg-gray-400"
            }`}
          >
            <Text className="text-white font-bold text-lg">
              {offer.special_offer.discount_percentage}
            </Text>
            <Text className="text-white text-xs -mt-1">%</Text>
          </View>

          {isSelected && canUse && (
            <View className="absolute -top-1 -right-1 bg-green-600 rounded-full p-1">
              <CheckCircle size={16} color="white" />
            </View>
          )}
        </View>
      </View>

      {/* Validation messages */}
      {!canUse && (
        <View className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <View className="flex-row items-center gap-2">
            <AlertCircle size={16} color="#dc2626" />
            <Text className="text-sm text-red-700 dark:text-red-300">
              {isExpired
                ? "This offer has expired"
                : !isValidForPartySize
                  ? `Minimum ${offer.special_offer.minimum_party_size} guests required`
                  : offer.used_at
                    ? "This offer has already been used"
                    : "Cannot use this offer"}
            </Text>
          </View>
        </View>
      )}

      {/* Offer details */}
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-muted-foreground">
          Expires {formatDate(offer.expires_at)}
        </Text>

        <View className="bg-muted/50 rounded px-2 py-1">
          <Text className="text-xs font-mono">
            Code: {offer.id.slice(-6).toUpperCase()}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};
