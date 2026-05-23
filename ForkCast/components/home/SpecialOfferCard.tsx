// components/home/SpecialOfferCard.tsx
import React from "react";
import { View, Pressable } from "react-native";
import {
  Star,
  MapPin,
  Calendar,
  Users,
  Tag,
  Clock,
  CheckCircle,
  Gift,
} from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { getDisplayCuisine } from "@/lib/cuisineUtils";
import { Image } from "@/components/image";
import { EnrichedOffer } from "@/hooks/useOffers";
import { formatDateToDDMMYYYY } from "@/utils/birthday";

interface SpecialOfferCardProps {
  offer: EnrichedOffer;
}

function SpecialOfferCardComponent({ offer }: SpecialOfferCardProps) {
  // Helper functions
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
    } catch (error) {
      return "Soon";
    }
  };

  const getOfferStatus = () => {
    if (offer.used) {
      return {
        label: "Used",
        color: "#10b981",
        bgColor: "#d1fae5",
        icon: CheckCircle,
      };
    }

    if (offer.isExpired) {
      return {
        label: "Expired",
        color: "#ef4444",
        bgColor: "#fee2e2",
        icon: Clock,
      };
    }

    if (offer.claimed) {
      return {
        label: `${offer.daysUntilExpiry || 0}d left`,
        color: "#3b82f6",
        bgColor: "#dbeafe",
        icon: Tag,
      };
    }

    return {
      label: "Available",
      color: "#10b981",
      bgColor: "#d1fae5",
      icon: Gift,
    };
  };

  const status = getOfferStatus();
  const StatusIcon = status.icon;

  return (
    <View className="mx-4 bg-card border border-border rounded-2xl overflow-hidden shadow-lg shadow-black/5">
      {/* Restaurant Image with Overlay Info */}
      <View className="relative">
        <Image
          {...({
            source: { uri: offer.restaurant.main_image_url },
            optimizationPreset: "large",
            className: "w-full h-48",
            contentFit: "cover",
          } as any)}
        />

        {/* Gradient Overlay */}
        <View className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Status Badge */}
        <View
          className="absolute top-3 left-3 px-3 py-1 rounded-full flex-row items-center gap-1"
          style={{ backgroundColor: status.bgColor }}
        >
          <StatusIcon size={14} color={status.color} />
          <Text className="text-sm font-medium" style={{ color: status.color }}>
            {status.label}
          </Text>
        </View>

        {/* Discount Badge - Top Right */}
        <View className="absolute top-3 right-3 bg-primary h-14 w-14 rounded-full items-center justify-center border-2 border-white">
          <Text className="text-white font-extrabold text-lg">
            {offer.discount_percentage}
          </Text>
          <Text className="text-white font-bold text-xs -mt-1">%</Text>
        </View>

        {/* Restaurant Info Overlay */}
        <View className="absolute bottom-3 left-3 right-3">
          <Text className="text-white font-bold text-xl mb-1">
            {offer.restaurant.name}
          </Text>
          <View className="flex-row items-center gap-2 mb-2">
            <View className="flex-row items-center gap-1">
              <Star size={14} color="#f59e0b" fill="#f59e0b" />
              <Text className="text-white text-sm font-medium">
                {offer.restaurant.average_rating?.toFixed(1) || "4.5"}
              </Text>
            </View>
            <Text className="text-white/80 text-sm">•</Text>
            <Text className="text-white/80 text-sm">
              {getDisplayCuisine(
                offer.restaurant.cuisine_type,
                (offer.restaurant as any).secondary_cuisines,
                "",
              )}
            </Text>
          </View>
        </View>
      </View>

      {/* Offer Details */}
      <View className="p-4">
        <Text className="font-bold text-lg mb-2" numberOfLines={1}>
          {offer.title}
        </Text>

        {offer.description && (
          <Text
            className="text-muted-foreground text-sm mb-3"
            numberOfLines={2}
          >
            {offer.description}
          </Text>
        )}

        {/* Metadata Row */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-4">
            <View className="flex-row items-center gap-1">
              <Calendar size={14} color="#666" />
              <Text className="text-xs text-muted-foreground">
                Until {formatDate(offer.valid_until)}
              </Text>
            </View>

            {offer.minimum_party_size && offer.minimum_party_size > 1 && (
              <View className="flex-row items-center gap-1">
                <Users size={14} color="#666" />
                <Text className="text-xs text-muted-foreground">
                  {offer.minimum_party_size}+ guests
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

// Memoize to prevent re-renders in offer carousels
export const SpecialOfferCard = React.memo(SpecialOfferCardComponent);
