// components/search/RestaurantSearchCard.tsx
import React, { useMemo, useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useNavigationModal } from "@/context/modal-provider";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";
import {
  Star,
  DollarSign,
  MapPin,
  Clock,
  Navigation,
  Heart,
  Trash2,
  Zap,
  Timer,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Image } from "@/components/image";
import { cn } from "@/lib/utils";
import { LocationService } from "@/lib/locationService";
import { VisitCountBadge } from "@/components/restaurant/VisitCountBadge";
import { useRestaurantOpenHours } from "@/hooks/useRestaurantOpenHours";
import { useRestaurantOffers } from "@/hooks/useRestaurantOffers";
import { OfferBadge } from "@/components/restaurant/OfferBadge";
import { RestaurantCardOverlay } from "@/components/restaurant/RestaurantCardOverlay";
import { useQuickActionPress } from "@/hooks/useHapticPress";

// Imported from types
import { Restaurant } from "@/types/restaurant";

// Helper to capitalize first letter of cuisine names
import { formatCuisines } from "@/lib/cuisineUtils";

interface BookingFilters {
  date: Date | null;
  time: string | null;
  partySize: number | null;
  availableOnly: boolean;
}

// Original interface for search screen
interface SearchScreenProps {
  item: Restaurant;
  bookingFilters: BookingFilters;
  favorites: Set<string>;
  onToggleFavorite: (restaurantId: string) => Promise<void>;
  onDirections: (restaurant: Restaurant) => Promise<void>;
  onPress?: () => void;
  /** Whether this restaurant is a sponsored/paid placement */
  isSponsored?: boolean;
  variant?: never;
  showActions?: never;
  disabled?: never;
  className?: never;
  restaurant?: never;
  onDelete?: never;
  isDeleting?: never;
  showDeleteButton?: never;
}

// Additional interface for search with restaurant prop and separate handlers
interface SearchWithRestaurantProps {
  restaurant: Restaurant;
  isFavorite: boolean;
  onPress?: () => void;
  onToggleFavorite: () => Promise<void>;
  onOpenDirections: () => Promise<void>;
  /** Whether this restaurant is a sponsored/paid placement */
  isSponsored?: boolean;
  variant?: never;
  showActions?: never;
  disabled?: never;
  className?: never;
  onDelete?: never;
  isDeleting?: never;
  showDeleteButton?: never;
  item?: never;
  bookingFilters?: never;
  favorites?: never;
  onDirections?: never;
}

type RestaurantSearchCardProps =
  | SearchScreenProps
  | SearchWithRestaurantProps;

const RestaurantSearchCardComponent = (props: RestaurantSearchCardProps) => {
  const router = useRouter();
  const { openNavigationModal, isAnyModalOpen } = useNavigationModal();
  const { handlePress: handleQuickActionPress } = useQuickActionPress();

  // Determine which props pattern we're using
  const isSearchScreen = "item" in props && props.item !== undefined;
  const isSearchWithRestaurant =
    "isFavorite" in props && "onToggleFavorite" in props;
  const isActualSearchScreen = isSearchScreen || isSearchWithRestaurant;

  // Extract the restaurant data based on props pattern
  const restaurant = isSearchScreen ? props.item : props.restaurant;
  const variant = isActualSearchScreen ? "default" : props.variant || "default";
  const showActions = isActualSearchScreen ? true : props.showActions !== false;
  const disabled = isActualSearchScreen ? false : props.disabled || false;
  const className = isActualSearchScreen ? "" : props.className || "";
  const showDeleteButton = isActualSearchScreen
    ? false
    : props.showDeleteButton || false;
  const isDeleting = isActualSearchScreen ? false : props.isDeleting || false;
  const isSponsored = props.isSponsored || false;

  // Safety check
  if (!restaurant) {
    return null;
  }

  // Use the new open hours hook - same as RestaurantCard
  const { checkAvailability, loading: availabilityLoading } =
    useRestaurantOpenHours(restaurant.id);

  // Get offer info for this restaurant
  const { getOfferInfo } = useRestaurantOffers();
  const offerInfo = getOfferInfo(restaurant.id);

  // Memoize current date and time to prevent recreation on every render
  const currentDateTime = useMemo(
    () => ({
      date: new Date(),
      time: format(new Date(), "HH:mm"),
    }),
    [],
  );

  // Memoize availability status - same logic as RestaurantCard
  const isOpen = useMemo(() => {
    if (availabilityLoading) return true; // Default to true while loading
    return checkAvailability(currentDateTime.date, currentDateTime.time).isOpen;
  }, [availabilityLoading, checkAvailability, currentDateTime]);

  const handleRestaurantPress = async () => {
    if (disabled) return;

    // Add haptic feedback for better UX
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Check if any modal is already open
    if (isAnyModalOpen) {
      return;
    }

    // Use navigation modal to prevent multiple modals
    openNavigationModal(`restaurant-${restaurant.id}`, () => {
      if (props.onPress) {
        props.onPress();
      } else {
        router.push(`/restaurant/${restaurant.id}`);
      }
    });
  };

  const handleFavoritePress = async (e: any) => {
    e.stopPropagation();
    // Add haptic feedback for better UX
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isSearchScreen && props.onToggleFavorite) {
      props.onToggleFavorite(restaurant.id);
    } else if (isSearchWithRestaurant && props.onToggleFavorite) {
      props.onToggleFavorite();
    }
  };

  const handleDirectionsPress = (e: any) => {
    e.stopPropagation();
    if (isSearchScreen && props.onDirections) {
      props.onDirections(restaurant);
    } else if (isSearchWithRestaurant && props.onOpenDirections) {
      props.onOpenDirections();
    }
  };

  const handleDeletePress = (e: any) => {
    e.stopPropagation();
    if (!isSearchScreen && props.onDelete) {
      props.onDelete(restaurant.id);
    }
  };

  const handleOverlayFavoritePress = () => {
    // Wrapper for overlay favorite press (overlay doesn't pass event)
    handleFavoritePress({ stopPropagation: () => {} } as any);
  };

  const isFavorite = isSearchScreen
    ? props.favorites?.has(restaurant.id)
    : isSearchWithRestaurant
      ? props.isFavorite
      : false;

  return (
    <>
      <Pressable
        onPress={handleRestaurantPress}
        disabled={disabled}
        className={cn(
          "bg-card rounded-lg shadow-sm border border-border overflow-hidden",
          variant === "compact" ? "mb-2" : "mb-3",
          disabled && "opacity-60",
          className,
        )}
      >
        <View className="relative">
          {/* Sponsored badge */}
          {isSponsored && (
            <View className="absolute top-2 left-2 z-10 bg-primary/90 px-2 py-0.5 rounded">
              <Text className="text-[10px] font-semibold text-primary-foreground">
                Sponsored
              </Text>
            </View>
          )}
          <Image
            source={{ uri: restaurant?.main_image_url || "" }}
            className={cn("w-full", variant === "compact" ? "h-48" : "h-60")}
            contentFit="cover"
            optimizationPreset="large"
          />

          {/* Delete button overlay - only show in playlist context (separate from unified overlay) */}
          {!isActualSearchScreen && showDeleteButton && (
            <Pressable
              onPress={handleDeletePress}
              disabled={isDeleting}
              className="absolute top-3 right-3 bg-red-500/90 rounded-full p-2 z-20"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Trash2 size={16} color="#fff" />
              )}
            </Pressable>
          )}

          {/* Unified overlay for badges and action buttons */}
          {isActualSearchScreen && showActions && (
            <RestaurantCardOverlay
              showFavorite={true}
              isFavorite={isFavorite}
              onFavoritePress={handleOverlayFavoritePress}
              isFeatured={restaurant.featured || false}
              hasActiveOffer={!!offerInfo}
              offerDiscount={offerInfo?.maxDiscount}
              inset={12}
            />
          )}
        </View>

        <View className={cn("p-3", variant === "compact" && "p-2")}>
          <View className="flex-row items-start justify-between mb-1">
            <View className="flex-1 mr-3">
              {/* Restaurant name with status dot */}
              <View className="flex-row items-center mb-1 gap-2">
                <Text
                  className={cn(
                    "font-semibold flex-1",
                    variant === "compact" ? "text-base" : "text-lg",
                  )}
                  numberOfLines={1}
                >
                  {restaurant.name}
                </Text>
                {/* Status dot - matches RestaurantCard */}
                {!availabilityLoading && (
                  <View
                    className={cn(
                      "w-2 h-2 rounded-full",
                      isOpen ? "bg-green-500" : "bg-red-500",
                    )}
                  />
                )}
              </View>

              {/* Cuisine type with visit count on opposite side */}
              <View className="flex-row items-center justify-between mb-1">
                <Text
                  className="text-muted-foreground text-sm"
                  numberOfLines={1}
                >
                  {formatCuisines(
                    restaurant.cuisine_type,
                    restaurant.secondary_cuisines,
                  )}
                </Text>
                {/* Visit Count Badge - subtle on right side */}
                <VisitCountBadge
                  restaurantId={restaurant.id}
                  variant="compact"
                />
              </View>

              <Text className="text-xs text-muted-foreground mb-2">
                {restaurant.address}
              </Text>

              {/* Compact row with price, rating, and distance - matching small cards */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center" style={{ gap: 3 }}>
                  {restaurant.price_range && (
                    <>
                      <Text className="text-[11px] text-muted-foreground font-medium">
                        {"$".repeat(restaurant.price_range)}
                      </Text>
                      <Text className="text-[11px] text-muted-foreground">
                        •
                      </Text>
                    </>
                  )}
                  <View className="flex-row items-center" style={{ gap: 0.5 }}>
                    <Star size={11} color="#F2B25F" fill="#F2B25F" />
                    <Text className="text-[11px] font-medium">
                      {restaurant.average_rating &&
                      restaurant.average_rating > 0
                        ? restaurant.average_rating.toFixed(1)
                        : "-"}
                    </Text>
                  </View>
                </View>
                {/* Distance */}
                {restaurant.distance !== undefined &&
                  restaurant.distance !== null && (
                    <View className="flex-row items-center gap-1 ml-2">
                      <MapPin size={11} color="#888" />
                      <Text
                        className="text-[11px] text-muted-foreground"
                        numberOfLines={1}
                      >
                        {LocationService.formatDistance(
                          restaurant.distance ?? 0,
                        )}
                      </Text>
                    </View>
                  )}
              </View>

              {/* Availability indicator - only show in search screen with booking filters */}
              {isSearchScreen &&
                typeof restaurant.isAvailable === "boolean" &&
                props.bookingFilters && (
                  <View
                    className={`px-2 py-1 rounded-full self-start mt-2 ${
                      restaurant.isAvailable
                        ? "bg-green-100 dark:bg-green-900/20"
                        : "bg-red-100 dark:bg-red-900/20"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        restaurant.isAvailable
                          ? "text-green-800 dark:text-green-200"
                          : "text-red-800 dark:text-red-200"
                      }`}
                    >
                      {restaurant.isAvailable
                        ? `Available ${props.bookingFilters.time}`
                        : `Fully booked ${props.bookingFilters.time}`}
                    </Text>
                  </View>
                )}
            </View>
          </View>
        </View>
      </Pressable>

    </>
  );
};

// Export memoized component for better performance in lists
export const RestaurantSearchCard = React.memo(RestaurantSearchCardComponent);
