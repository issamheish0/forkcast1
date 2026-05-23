// components/restaurant/RestaurantCard.tsx
import React, { useState, useMemo, useCallback } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  Star,
  Heart,
  MapPin,
  Tag,
} from "lucide-react-native";
import { format } from "date-fns";

import { Image } from "@/components/image";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Database } from "@/types/supabase";
import { cn } from "@/lib/utils";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { DirectionsButton } from "@/components/restaurant/DirectionsButton";
import { OfferBadge, OfferIndicator } from "@/components/restaurant/OfferBadge";
import { RestaurantCardOverlay } from "@/components/restaurant/RestaurantCardOverlay";
import { useRestaurantOpenHours } from "@/hooks/useRestaurantOpenHours";

import {
  useRestaurantPress,
  useQuickActionPress,
} from "@/hooks/useHapticPress";
import { useNavigationModal } from "@/context/modal-provider";
import { useLocationWithDistance } from "@/hooks/useLocationWithDistance";
import { LocationService } from "@/lib/locationService";

// Helper to capitalize first letter of cuisine names
import { formatCuisines } from "@/lib/cuisineUtils";

type BaseRestaurant = Database["public"]["Tables"]["restaurants"]["Row"];

// Support flexible restaurant types with proper typing
type Restaurant = BaseRestaurant & {
  tags?: string[] | null;
  staticCoordinates?: { lat: number; lng: number };
  coordinates?: { latitude: number; longitude: number };
  distance?: number | null;
  isAvailable?: boolean;
};

interface RestaurantCardProps {
  restaurant?: Restaurant;
  item?: Restaurant; // Support both prop names for backward compatibility
  variant?: "default" | "compact" | "featured" | "horizontal";
  onPress?: (restaurantId: string) => void;
  onFavoritePress?: () => void;
  onDirections?: (restaurant: Restaurant) => void; // New prop for directions
  isFavorite?: boolean;
  className?: string;
  showFavorite?: boolean;
  showDirections?: boolean; // New prop to control directions button visibility
  showAvailability?: boolean; // New prop to show/hide availability status
 
  showOfferBadge?: boolean;
  /** Max discount percentage for the offer badge */
  offerDiscount?: number;
  /** Whether restaurant has an active offer */
  hasActiveOffer?: boolean;
  /** Whether this restaurant is a sponsored/paid placement */
  isSponsored?: boolean;
}

function RestaurantCardComponent({
  restaurant,
  item,
  variant = "default",
  onPress,
  onFavoritePress,
  onDirections,
  isFavorite = false,
  className,
  showFavorite = true,
  // Default to true
  showDirections = false, // Default to false
  showAvailability = true, // Default to true
 
  showOfferBadge = true, // Default to true - show offer badges
  offerDiscount,
  hasActiveOffer = false,
  isSponsored = false, // Default to false - sponsored badge
}: RestaurantCardProps) {
  // Support both restaurant and item props for backward compatibility
  const restaurantData = restaurant || item;

  // Early return BEFORE any hooks are called
  if (!restaurantData || !restaurantData.id) {
    return null;
  }

  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = colors[isDark ? "dark" : "light"].primary;

  // Haptic press hooks
  const { handlePress: handleRestaurantPress } = useRestaurantPress();
  const { handlePress: handleQuickActionPress } = useQuickActionPress();

  // Modal state management
  const { openNavigationModal, isAnyModalOpen } = useNavigationModal();

  // Location hook for distance calculation
  const {
    location: userLocation,
    calculateDistance,
    formatDistance,
  } = useLocationWithDistance();

  // Use the new open hours hook
  const { checkAvailability, loading: availabilityLoading } =
    useRestaurantOpenHours(restaurantData.id);

 
  // Memoize current date and time to prevent recreation on every render
  const currentDateTime = useMemo(
    () => ({
      date: new Date(),
      time: format(new Date(), "HH:mm"),
    }),
    [],
  );

  // Memoize availability status
  const isOpen = useMemo(() => {
    if (!showAvailability || availabilityLoading) return true;
    return checkAvailability(currentDateTime.date, currentDateTime.time).isOpen;
  }, [
    showAvailability,
    availabilityLoading,
    checkAvailability,
    currentDateTime,
  ]);

  // Calculate distance from current location
  const distance = useMemo(() => {
    try {
      if (!userLocation || !restaurantData?.location) return null;

      const coords = LocationService.extractCoordinates(
        restaurantData.location,
      );
      if (!coords) return null;

      const calculatedDistance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        coords.latitude,
        coords.longitude,
      );

      // Validate the calculated distance
      if (
        calculatedDistance === null ||
        calculatedDistance === undefined ||
        isNaN(calculatedDistance) ||
        !isFinite(calculatedDistance)
      ) {
        return null;
      }

      return calculatedDistance;
    } catch {
      return null;
    }
  }, [userLocation, restaurantData?.location, calculateDistance]);

  // Format distance for display
  const distanceText = useMemo(() => {
    try {
      if (
        distance === null ||
        distance === undefined ||
        isNaN(distance) ||
        !isFinite(distance)
      ) {
        return null;
      }

      if (distance < 1) {
        const meters = Math.round(distance * 1000);
        return meters > 0 ? `${meters}m away` : null;
      }

      return `${distance.toFixed(1)}km away`;
    } catch {
      return null;
    }
  }, [distance]);

  const handlePress = () => {
    handleRestaurantPress(() => {
      // Check if any modal is already open
      if (isAnyModalOpen) {
        return;
      }

      // Use navigation modal to prevent multiple modals
      openNavigationModal(`restaurant-${restaurantData.id}`, () => {
        if (onPress) {
          onPress(restaurantData.id);
        } else {
          router.push({
            pathname: "/restaurant/[id]",
            params: { id: restaurantData.id },
          });
        }
      });
    });
  };

 

 

  const renderStars = (rating: number) => {
    return (
      <View className="flex-row items-center gap-0.5">
        <Star
          size={variant === "compact" ? 10 : 11}
          color="#F2B25F"
          fill="#F2B25F"
        />
        <Text
          className={cn(
            "font-medium",
            variant === "compact" ? "text-[10px]" : "text-[11px]",
          )}
        >
          {rating && rating > 0 ? rating.toFixed(1) : "-"}
        </Text>
      </View>
    );
  };

  const renderPriceRange = (priceRange?: number | null) => {
    if (!priceRange) return null; // Don't show anything if no price range data

    return (
      <Text
        className={cn(
          "text-muted-foreground font-medium",
          variant === "compact" ? "text-[10px]" : "text-[11px]",
        )}
      >
        {"$".repeat(priceRange)}
      </Text>
    );
  };

  // Render status dot (green for open, red for closed) - Memoized
  const renderStatusDot = useCallback(() => {
    if (!showAvailability || availabilityLoading) return null;

    return (
      <View
        className={cn(
          "w-2 h-2 rounded-full",
          isOpen ? "bg-green-500" : "bg-red-500",
        )}
      />
    );
  }, [showAvailability, availabilityLoading, isOpen]);

  const cardOpacity = "opacity-100";

  // Render sponsored badge
  const renderSponsoredBadge = () => {
    if (!isSponsored) return null;

    return (
      <View className="absolute top-2 left-2 z-10 bg-primary/90 px-2 py-0.5 rounded">
        <Text className="text-[10px] font-semibold text-primary-foreground">
          Sponsored
        </Text>
      </View>
    );
  };

  // Render offer indicator for inline display
  const renderOfferIndicator = () => {
    if (!showOfferBadge || !hasActiveOffer) return null;

    return (
      <OfferIndicator
        hasOffer={true}
        discount={offerDiscount}
        className="ml-1"
      />
    );
  };

  // Using a Fragment to wrap the card and the modal
  return (
    <>
      {variant === "compact" && (
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={`${restaurantData.name}, ${restaurantData.cuisine_type || "Restaurant"}${restaurantData.average_rating ? `, rated ${restaurantData.average_rating.toFixed(1)} stars` : ""}`}
          accessibilityHint="Double tap to view restaurant details"
        >
          <Card
            variant="subtle"
            noPadding={true}
            gradient={false}
            style={{
              marginRight: 12,
              width: 240,
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: isDark ? 4 : 2 },
              shadowOpacity: isDark ? 0.35 : 0.06,
              shadowRadius: isDark ? 8 : 6,
              elevation: isDark ? 10 : 2,
            }}
            className={cn(
              cardOpacity,
              "shadow-sm overflow-hidden bg-background",
              !isDark && "border border-border",
              className,
            )}
          >
            <View className="relative">
              {renderSponsoredBadge()}
              <Image
                source={{
                  uri:
                    restaurantData.main_image_url ||
                    "@/assets/default-avatar.jpeg",
                }}
                className="w-full h-32"
                contentFit="cover"
                optimizationPreset="thumbnail"
              />
              <RestaurantCardOverlay
                showFavorite={showFavorite}
                isFavorite={isFavorite}
                onFavoritePress={() =>
                  handleQuickActionPress(() => onFavoritePress?.())
                }
               
                isFeatured={restaurantData.featured || false}
                hasActiveOffer={showOfferBadge && hasActiveOffer}
                offerDiscount={offerDiscount}
                inset={12}
              />
            </View>

            <View className="p-3">
              {/* Name with status dot */}
              <View className="flex-row items-center gap-2 mb-1">
                <Text className="font-bold text-base flex-1" numberOfLines={1}>
                  {restaurantData.name}
                </Text>
                {renderStatusDot()}
              </View>

              {/* Cuisines line */}
              <Text
                className="text-xs font-medium text-muted-foreground mb-2"
                numberOfLines={1}
              >
                {formatCuisines(
                  restaurantData.cuisine_type,
                  restaurantData.secondary_cuisines,
                )}
              </Text>

              {/* Price, Rating, and Distance */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center" style={{ gap: 3 }}>
                  {restaurantData.price_range && (
                    <>
                      {renderPriceRange(restaurantData.price_range)}
                      <Text className="text-[10px] text-muted-foreground">
                        •
                      </Text>
                    </>
                  )}
                  {renderStars(restaurantData.average_rating || 0)}
               
                </View>
                {distanceText && (
                  <View className="flex-row items-center gap-1 ml-2">
                    <MapPin size={10} color="#888" />
                    <Text
                      className="text-[10px] text-muted-foreground"
                      numberOfLines={1}
                    >
                      {distanceText}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Card>
        </Pressable>
      )}

      {variant === "featured" && (
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={`Featured: ${restaurantData.name}, ${restaurantData.cuisine_type || "Restaurant"}${restaurantData.average_rating ? `, rated ${restaurantData.average_rating.toFixed(1)} stars` : ""}`}
          accessibilityHint="Double tap to view restaurant details"
        >
          <Card
            variant="elevated"
            noPadding={true}
            gradient={false}
            style={{
              marginRight: 16,
              width: 288,
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: isDark ? 6 : 3 },
              shadowOpacity: isDark ? 0.4 : 0.08,
              shadowRadius: isDark ? 12 : 8,
              elevation: isDark ? 15 : 3,
            }}
            className={cn(
              cardOpacity,
              "shadow-md overflow-hidden bg-background",
              !isDark && "border border-border",
              className,
            )}
          >
            <View className="relative">
              {renderSponsoredBadge()}
              <Image
                source={{
                  uri:
                    restaurantData.main_image_url ||
                    "@/assets/default-avatar.jpeg",
                }}
                className="w-full h-48"
                contentFit="cover"
                optimizationPreset="card"
              />
              {/* Directions button - separate from overlay since it's optional */}
              {showDirections && (
                <View className="absolute top-3 right-3 z-20">
                  <DirectionsButton
                    restaurant={restaurantData}
                    onDirections={onDirections}
                    variant="icon"
                    size="md"
                    backgroundColor={isDark ? "bg-black/50" : "bg-white/50"}
                    iconColor={isDark ? "white" : primaryColor}
                  />
                </View>
              )}
              <RestaurantCardOverlay
                showFavorite={showFavorite}
                isFavorite={isFavorite}
                onFavoritePress={() =>
                  handleQuickActionPress(() => onFavoritePress?.())
                }
             
                isFeatured={restaurantData.featured || false}
                hasActiveOffer={showOfferBadge && hasActiveOffer}
                offerDiscount={offerDiscount}
                inset={12}
              />
            </View>
            <View className="p-4">
              {/* Name with status dot */}
              <View className="flex-row items-center gap-2 mb-1">
                <Text className="font-bold text-lg flex-1" numberOfLines={1}>
                  {restaurantData.name}
                </Text>
                {renderStatusDot()}
              </View>

              {/* Cuisines line */}
              <Text
                className="text-sm font-medium text-muted-foreground mb-3"
                numberOfLines={1}
              >
                {formatCuisines(
                  restaurantData.cuisine_type,
                  restaurantData.secondary_cuisines,
                )}
              </Text>

              {/* Price, Rating, and Distance */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  {restaurantData.price_range && (
                    <>
                      {renderPriceRange(restaurantData.price_range)}
                      <Text className="text-[11px] text-muted-foreground">
                        •
                      </Text>
                    </>
                  )}
                  {renderStars(restaurantData.average_rating || 0)}
                  
                </View>
                {distanceText && (
                  <View className="flex-row items-center gap-1 ml-2">
                    <MapPin size={11} color="#888" />
                    <Text
                      className="text-[11px] text-muted-foreground"
                      numberOfLines={1}
                    >
                      {distanceText}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Card>
        </Pressable>
      )}

      {(variant === "horizontal" || variant === "default") && (
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={`${restaurantData.name}, ${restaurantData.cuisine_type || "Restaurant"}${restaurantData.average_rating ? `, rated ${restaurantData.average_rating.toFixed(1)} stars` : ""}`}
          accessibilityHint="Double tap to view restaurant details"
        >
          <Card
            variant="default"
            noPadding={true}
            gradient={false}
            style={{
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: isDark ? 4 : 2 },
              shadowOpacity: isDark ? 0.28 : 0.05,
              shadowRadius: isDark ? 7 : 4,
              elevation: isDark ? 8 : 1,
            }}
            className={cn(
              cardOpacity,
              "shadow-sm overflow-hidden bg-background",
              !isDark && "border border-border",
              className,
            )}
          >
            <View className="flex-row">
              <View className="relative">
                {renderSponsoredBadge()}
                <Image
                  source={{
                    uri:
                      restaurantData.main_image_url ||
                      "@/assets/default-avatar.jpeg",
                  }}
                  className="w-32 h-32 rounded-l-lg"
                  contentFit="cover"
                  optimizationPreset="thumbnail"
                />
                <RestaurantCardOverlay
                  showFavorite={showFavorite}
                  isFavorite={isFavorite}
                  onFavoritePress={() =>
                    handleQuickActionPress(() => onFavoritePress?.())
                  }
                 
                  isFeatured={restaurantData.featured || false}
                  hasActiveOffer={showOfferBadge && hasActiveOffer}
                  offerDiscount={offerDiscount}
                  inset={12}
                />
              </View>

              <View className="flex-1 p-3">
                {/* Name with status dot */}
                <View className="flex-row items-center gap-2 mb-1">
                  <Text
                    className="font-bold text-base flex-1"
                    numberOfLines={1}
                  >
                    {restaurantData.name}
                  </Text>
                  {renderStatusDot()}
                </View>

                {/* Cuisines line */}
                <Text
                  className="text-xs font-medium text-muted-foreground mb-2"
                  numberOfLines={1}
                >
                  {formatCuisines(
                    restaurantData.cuisine_type,
                    restaurantData.secondary_cuisines,
                  )}
                </Text>

                {/* Price, Rating, and Distance */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center" style={{ gap: 3 }}>
                    {restaurantData.price_range && (
                      <>
                        {renderPriceRange(restaurantData.price_range)}
                        <Text className="text-[10px] text-muted-foreground">
                          •
                        </Text>
                      </>
                    )}
                    {renderStars(restaurantData.average_rating || 0)}
                    
                  </View>
                  {distanceText && (
                    <View className="flex-row items-center gap-1 ml-2">
                      <MapPin size={10} color="#888" />
                      <Text
                        className="text-[10px] text-muted-foreground"
                        numberOfLines={1}
                      >
                        {distanceText}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </Card>
        </Pressable>
      )}

    </>
  );
}

// Export memoized component for better performance
export const RestaurantCard = React.memo(RestaurantCardComponent);
