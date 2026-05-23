// components/restaurant/RestaurantHeaderInfo.tsx
import React from "react";
import { View, Pressable } from "react-native";
import {
  Star,
  MapPin,
  Clock,
  DollarSign,
  Users,
  Gift,
  Sparkles,
  ChevronRight,
  Tag,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H1, P, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { AgeRestrictionBadge } from "./AgeRestrictionBadge";
import { getDisplayCuisine } from "@/lib/cuisineUtils";

interface Restaurant {
  id: string;
  name: string;
  cuisine_type: string;
  secondary_cuisines?: string[] | null;
  address: string;
  average_rating?: number;
  total_reviews?: number;
  price_range?: number;
  description?: string;
  minimum_age?: number | null;
}

interface RestaurantHeaderInfoProps {
  restaurant: Restaurant;
  highlightOfferId?: string;
  offerCount?: number;
  onOffersPress?: () => void;
}

export const RestaurantHeaderInfo: React.FC<RestaurantHeaderInfoProps> = ({
  restaurant,
  highlightOfferId,
  offerCount = 0,
  onOffersPress,
}) => {
  const { colorScheme } = useColorScheme();

  const renderPriceRange = (priceRange: number) => {
    return (
      "$".repeat(priceRange) +
      "$".repeat(Math.max(0, 3 - priceRange)).replace(/AED /g, "$ ")
    );
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={i} size={16} fill="#fbbf24" color="#fbbf24" />);
    }

    if (hasHalfStar) {
      stars.push(<Star key="half" size={16} fill="none" color="#fbbf24" />);
    }

    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <Star key={`empty-${i}`} size={16} fill="none" color="#d1d5db" />,
      );
    }

    return stars;
  };

  return (
    <View className="px-4 py-6 bg-background">
      {/* Restaurant Name and Basic Info */}
      <View className="mb-4">
        <H1 className="mb-2">{restaurant.name}</H1>

        {/* Cuisine and Location */}
        <View className="flex-row items-center gap-4 mb-3">
          <Text className="text-lg text-muted-foreground capitalize">
            {getDisplayCuisine(
              restaurant.cuisine_type,
              restaurant.secondary_cuisines,
            )}
          </Text>
          <View className="flex-row items-center">
            <MapPin size={16} color="#666" />
            <Text
              className="text-sm text-muted-foreground ml-1"
              numberOfLines={1}
            >
              {restaurant.address}
            </Text>
          </View>
        </View>

        {/* Age Restriction Badge */}
        <View className="mb-3">
          <AgeRestrictionBadge
            restaurant={restaurant as any}
            variant="detail"
          />
        </View>

        {/* Rating and Price */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-4">
            {/* Rating */}
            {restaurant.average_rating && (
              <View className="flex-row items-center">
                <View className="flex-row mr-2">
                  {renderStars(restaurant.average_rating)}
                </View>
                <Text className="font-bold text-lg">
                  {restaurant.average_rating.toFixed(1)}
                </Text>
                {restaurant.total_reviews && restaurant.total_reviews > 0 && (
                  <Text className="text-sm text-muted-foreground ml-1">
                    ({restaurant.total_reviews})
                  </Text>
                )}
              </View>
            )}

            {/* Price Range */}
            {restaurant.price_range && (
              <View className="flex-row items-center">
                <Text className="font-bold text-lg text-green-600">
                  {renderPriceRange(restaurant.price_range)}
                </Text>
              </View>
            )}
          </View>

          {/* Special Offers Badge */}
          {offerCount > 0 && (
            <Pressable
              onPress={onOffersPress}
              className="flex-row items-center bg-primary/10 px-3 py-2 rounded-full"
            >
              <Gift size={16} color="#3b82f6" />
              <Text className="text-primary font-bold text-sm ml-1">
                {offerCount} offer{offerCount > 1 ? "s" : ""}
              </Text>
              <ChevronRight size={14} color="#3b82f6" className="ml-1" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Highlighted Offer Banner */}
      {highlightOfferId && (
        <Pressable
          onPress={onOffersPress}
          className="bg-gradient-to-r from-primary/15 to-primary/5 border-2 border-primary/30 rounded-xl p-4 mb-4"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <View className="flex-row items-center mb-1">
                <Sparkles size={18} color="#3b82f6" />
                <Text className="font-bold text-primary ml-2">
                  Special Offer Available!
                </Text>
              </View>
              <Text className="text-sm text-muted-foreground">
                You have a special offer for this restaurant. Tap to view and
                claim it.
              </Text>
            </View>
            <View className="bg-primary rounded-full p-2 ml-3">
              <Tag size={20} color="white" />
            </View>
          </View>
        </Pressable>
      )}

      {/* Restaurant Description */}
      {restaurant.description && (
        <View className="mt-2">
          <P className="text-muted-foreground leading-relaxed">
            {restaurant.description}
          </P>
        </View>
      )}

      {/* Quick Stats */}
      <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-border">
        <View className="flex-row items-center">
          <Clock size={16} color="#666" />
          <Text className="text-sm text-muted-foreground ml-2">
            Usually busy 7-9 PM
          </Text>
        </View>

        <View className="flex-row items-center">
          <Users size={16} color="#666" />
          <Text className="text-sm text-muted-foreground ml-2">
            Great for groups
          </Text>
        </View>
      </View>
    </View>
  );
};
