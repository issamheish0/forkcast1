// components/restaurant/EnhancedRestaurantCard.tsx
import React from "react";
import { View, Pressable, Dimensions, Alert } from "react-native";
import { useRouter } from "expo-router";
import {
  Star,
  MapPin,
  Clock,
  Heart,
  ChevronRight,
  Tag,
  Calendar,
} from "lucide-react-native";
import { Image } from "@/components/image";
import { Text } from "@/components/ui/text";
import { H3, P, Muted } from "@/components/ui/typography";
import { Database } from "@/types/supabase";
import { cn } from "@/lib/utils";
import { useRestaurantOpenHours } from "@/hooks/useRestaurantOpenHours";
import { format } from "date-fns";
import {
  useRestaurantPress,
  useQuickActionPress,
} from "@/hooks/useHapticPress";
import { useNavigationModal } from "@/context/modal-provider";
import { useBookingEligibility } from "@/hooks/useBookingEligibility";

import { formatCuisines } from "@/lib/cuisineUtils";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

interface EnhancedRestaurantCardProps {
  restaurant: Restaurant;
  variant?: "default" | "detailed" | "compact";
  onPress?: () => void;
  onFavoritePress?: () => void;
  isFavorite?: boolean;
  className?: string;
  showQuickActions?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export function EnhancedRestaurantCard({
  restaurant,
  variant = "default",
  onPress,
  onFavoritePress,
  isFavorite = false,
  className,
  showQuickActions = false,
}: EnhancedRestaurantCardProps) {
  const { colorScheme } = useColorScheme();
  const primaryColor =
    colors[colorScheme === "dark" ? "dark" : "light"].primary;
  const router = useRouter();

  // Haptic press hooks
  const { handlePress: handleRestaurantPress } = useRestaurantPress();
  const { handlePress: handleQuickActionPress } = useQuickActionPress();

  // Booking eligibility check
  const bookingEligibility = useBookingEligibility(restaurant);

  // Modal state management
  const { openNavigationModal, isAnyModalOpen } = useNavigationModal();

  // Use the new open hours hook
  const {
    formatDisplayHours,
    checkAvailability,
    loading: availabilityLoading,
  } = useRestaurantOpenHours(restaurant.id);

  const handlePress = () => {
    handleRestaurantPress(() => {
      // Check if any modal is already open
      if (isAnyModalOpen) {
        return;
      }

      // Use navigation modal to prevent multiple modals
      openNavigationModal(`restaurant-${restaurant.id}`, () => {
        if (onPress) {
          onPress();
        } else {
          router.push({
            pathname: "/restaurant/[id]",
            params: { id: restaurant.id },
          });
        }
      });
    });
  };

  const handleQuickBook = (e: any) => {
    e.stopPropagation();
    handleQuickActionPress(() => {
      // Check booking eligibility first
      if (!bookingEligibility.isEligible) {
        Alert.alert(
          "Booking Not Available",
          bookingEligibility.blockedReason || "Unable to proceed with booking",
          [
            { text: "OK", style: "default" },
            ...(bookingEligibility.actionText
              ? [
                  {
                    text: bookingEligibility.actionText,
                    style: "default" as const,
                    onPress: () => {
                      if (bookingEligibility.actionRequired === "sign_up") {
                        router.push("/sign-up");
                      } else if (
                        bookingEligibility.actionRequired ===
                        "add_date_of_birth"
                      ) {
                        router.push("/profile/edit");
                      }
                    },
                  },
                ]
              : []),
          ],
        );
        return;
      }

      router.push({
        pathname: "/booking/create",
        params: {
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          quickBook: "true",
        },
      });
    });
  };

  const handleViewMenu = (e: any) => {
    e.stopPropagation();
    handleQuickActionPress(() => {
      router.push({
        pathname: "/restaurant/[id]",
        params: { id: restaurant.id, tab: "menu" },
      });
    });
  };

  // Compact variant for lists where space is limited
  if (variant === "compact") {
    return (
      <Pressable
        onPress={handlePress}
        className={cn(
          "bg-card rounded-xl overflow-hidden shadow-sm border border-border mb-2",
          className,
        )}
      >
        <View className="flex-row p-3">
          <Image
            source={{ uri: restaurant.main_image_url || "" }}
            className="w-20 h-20 rounded-lg"
            contentFit="cover"
            optimizationPreset="thumbnail"
          />

          <View className="flex-1 ml-3">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text
                  className="font-semibold text-base mb-1"
                  numberOfLines={1}
                >
                  {restaurant.name}
                </Text>
                <Text
                  className="text-sm text-muted-foreground"
                  numberOfLines={1}
                >
                  {formatCuisines(
                    restaurant.cuisine_type,
                    restaurant.secondary_cuisines,
                  )}
                </Text>
              </View>
              {onFavoritePress && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    handleQuickActionPress(onFavoritePress);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Heart
                    size={18}
                    color={isFavorite ? "#ef4444" : "#666"}
                    fill={isFavorite ? "#ef4444" : "transparent"}
                  />
                </Pressable>
              )}
            </View>

            <View className="flex-row items-center gap-3 mt-2">
              <View className="flex-row items-center gap-1">
                <Star size={12} color="#f59e0b" fill="#f59e0b" />
                <Text className="text-xs font-medium">
                  {restaurant.average_rating && restaurant.average_rating > 0
                    ? restaurant.average_rating.toFixed(1)
                    : "-"}
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground">
                {"$".repeat(restaurant.price_range || 1)}
              </Text>
              <Text
                className={cn(
                  "text-xs font-medium",
                  restaurant.booking_policy === "instant"
                    ? "text-green-600"
                    : "text-orange-600",
                )}
              >
                {restaurant.booking_policy === "instant"
                  ? "Instant"
                  : "Request"}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  // Detailed variant with full information and actions
  if (variant === "detailed") {
    return (
      <Pressable
        onPress={handlePress}
        className={cn(
          "bg-card rounded-xl overflow-hidden shadow-sm border border-border",
          className,
        )}
      >
        {/* Full Width Image */}
        <View className="relative">
          <Image
            source={{ uri: restaurant.main_image_url || "" }}
            className="w-full h-48"
            contentFit="cover"
            optimizationPreset="medium"
          />

          {/* Favorite Button Overlay */}
          {onFavoritePress && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                handleQuickActionPress(onFavoritePress);
              }}
              className={`absolute top-3 right-3 rounded-full p-2 ${colorScheme === "dark" ? "bg-black/50" : "bg-white/50"}`}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Heart
                size={20}
                color={
                  isFavorite
                    ? "#ef4444"
                    : colorScheme === "dark"
                      ? "white"
                      : primaryColor
                }
                fill={isFavorite ? "#ef4444" : "transparent"}
              />
            </Pressable>
          )}

          {/* Featured Badge */}
          {restaurant.featured && (
            <View className="absolute top-3 left-3 bg-primary px-2 py-1 rounded">
              <Text className="text-xs text-primary-foreground font-medium">
                Featured
              </Text>
            </View>
          )}

          {/* Booking Policy Badge */}
          <View className="absolute bottom-3 right-3">
            <View
              className={cn(
                "px-2 py-1 rounded-full",
                restaurant.booking_policy === "instant"
                  ? "bg-green-600"
                  : "bg-orange-600",
              )}
            >
              <Text className="text-xs text-white font-medium">
                {restaurant.booking_policy === "instant"
                  ? "Instant Book"
                  : "Request"}
              </Text>
            </View>
          </View>
        </View>

        {/* Restaurant Information */}
        <View className="p-4 border-b border-border">
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1">
              <View className="flex-row items-center gap-2 mb-1">
                <H3 className="text-lg flex-1" numberOfLines={1}>
                  {restaurant.name}
                </H3>
                {!availabilityLoading && (
                  <View
                    className={cn(
                      "w-2 h-2 rounded-full",
                      checkAvailability(new Date(), format(new Date(), "HH:mm"))
                        .isOpen
                        ? "bg-green-500"
                        : "bg-red-500",
                    )}
                  />
                )}
              </View>
              <Text className="text-muted-foreground text-sm">
                {formatCuisines(
                  restaurant.cuisine_type,
                  restaurant.secondary_cuisines,
                )}
              </Text>
            </View>
          </View>

          {/* Rating and Price Row */}
          <View className="flex-row items-center gap-4 mb-3">
            <View className="flex-row items-center gap-1">
              <Star size={16} color="#f59e0b" fill="#f59e0b" />
              <Text className="text-sm font-semibold">
                {restaurant.average_rating && restaurant.average_rating > 0
                  ? restaurant.average_rating.toFixed(1)
                  : "-"}
              </Text>
              <Text className="text-sm text-muted-foreground">
                ({restaurant.total_reviews || 0} reviews)
              </Text>
            </View>
            <Text className="text-sm font-semibold text-muted-foreground">
              {"$".repeat(restaurant.price_range || 1)} •{" "}
              {
                ["Budget", "Moderate", "Upscale", "Fine Dining"][
                  (restaurant.price_range || 1) - 1
                ]
              }
            </Text>
          </View>

          {/* Status Row */}
          {!availabilityLoading && (
            <View className="flex-row items-center gap-2 mb-3">
              <View
                className={cn(
                  "w-2 h-2 rounded-full",
                  checkAvailability(new Date(), format(new Date(), "HH:mm"))
                    .isOpen
                    ? "bg-green-500"
                    : "bg-red-500",
                )}
              />
              <Text
                className={cn(
                  "text-sm font-medium",
                  checkAvailability(new Date(), format(new Date(), "HH:mm"))
                    .isOpen
                    ? "text-green-600"
                    : "text-red-600",
                )}
              >
                {checkAvailability(new Date(), format(new Date(), "HH:mm"))
                  .isOpen
                  ? "Open"
                  : "Closed"}
              </Text>
              <Text className="text-sm text-muted-foreground">
                • {formatDisplayHours()}
              </Text>
            </View>
          )}

          {/* Tags Row */}
          {restaurant.tags && restaurant.tags.length > 0 && (
            <View className="flex-row flex-wrap gap-2">
              {restaurant.tags.slice(0, 3).map((tag) => (
                <View
                  key={tag}
                  className="bg-primary/10 rounded-full px-3 py-1 border border-primary/20"
                >
                  <Text className="text-xs text-primary font-medium">
                    {tag}
                  </Text>
                </View>
              ))}
              {restaurant.tags.length > 3 && (
                <View className="bg-muted rounded-full px-3 py-1 border border-border">
                  <Text className="text-xs text-muted-foreground font-medium">
                    +{restaurant.tags.length - 3} more
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Quick Actions Bar */}
        {showQuickActions && (
          <View className="px-4 py-3">
            <View className="flex-row gap-3">
              <Pressable
                onPress={handleQuickBook}
                className={`flex-1 rounded-lg py-3 px-4 flex-row items-center justify-center gap-2 border ${
                  bookingEligibility.isEligible
                    ? "bg-primary border-primary"
                    : "bg-muted border-muted"
                }`}
                disabled={!bookingEligibility.isEligible}
              >
                <Calendar
                  size={18}
                  color={bookingEligibility.isEligible ? "white" : "#666"}
                />
                <Text
                  className={`font-semibold ${
                    bookingEligibility.isEligible
                      ? "text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {!bookingEligibility.isEligible
                    ? bookingEligibility.actionText || "Not Available"
                    : restaurant.booking_policy === "instant"
                      ? "Book Now"
                      : "Request Booking"}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleViewMenu}
                className="flex-1 bg-background rounded-lg py-3 px-4 flex-row items-center justify-center gap-2 border border-border"
              >
                <Tag size={18} color="#666" />
                <Text className="text-foreground font-semibold">View Menu</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Pressable>
    );
  }

  // Default variant - balanced between compact and detailed
  return (
    <Pressable
      onPress={handlePress}
      className={cn(
        "bg-card rounded-xl overflow-hidden shadow-sm border border-border",
        className,
      )}
    >
      {/* Full Width Image */}
      <View className="relative">
        <Image
          source={{ uri: restaurant.main_image_url || "" }}
          className="w-full h-40"
          contentFit="cover"
          optimizationPreset="medium"
        />

        {/* Favorite Button Overlay */}
        {onFavoritePress && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              handleQuickActionPress(onFavoritePress);
            }}
            className={`absolute top-3 right-3 rounded-full p-2 ${colorScheme === "dark" ? "bg-black/50" : "bg-white/50"}`}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Heart
              size={18}
              color={
                isFavorite
                  ? "#ef4444"
                  : colorScheme === "dark"
                    ? "white"
                    : primaryColor
              }
              fill={isFavorite ? "#ef4444" : "transparent"}
            />
          </Pressable>
        )}

        {/* Featured Badge */}
        {restaurant.featured && (
          <View className="absolute top-3 left-3 bg-primary px-2 py-1 rounded">
            <Text className="text-xs text-primary-foreground font-medium">
              Featured
            </Text>
          </View>
        )}
      </View>

      {/* Restaurant Information */}
      <View className="p-4">
        <H3 className="mb-1" numberOfLines={1}>
          {restaurant.name}
        </H3>
        <P className="text-muted-foreground text-sm mb-3">
          {formatCuisines(
            restaurant.cuisine_type,
            restaurant.secondary_cuisines,
          )}
        </P>

        <View className="flex-row items-center gap-3 mb-2">
          <View className="flex-row items-center gap-1">
            <Star size={14} color="#f59e0b" fill="#f59e0b" />
            <Text className="text-sm font-medium">
              {restaurant.average_rating && restaurant.average_rating > 0
                ? restaurant.average_rating.toFixed(1)
                : "-"}
            </Text>
            <Text className="text-xs text-muted-foreground">
              ({restaurant.total_reviews || 0})
            </Text>
          </View>
          <Text className="text-sm text-muted-foreground">
            {"$".repeat(restaurant.price_range || 1)}
          </Text>
          <View className="flex-row items-center gap-1">
            <MapPin size={14} color="#666" />
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {restaurant.address?.split(",")[0] || "N/A"}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          {!availabilityLoading && (
            <View className="flex-row items-center gap-1">
              <Clock
                size={14}
                color={
                  checkAvailability(new Date(), format(new Date(), "HH:mm"))
                    .isOpen
                    ? "#10b981"
                    : "#ef4444"
                }
              />
              <Text
                className={cn(
                  "text-xs font-medium",
                  checkAvailability(new Date(), format(new Date(), "HH:mm"))
                    .isOpen
                    ? "text-green-600"
                    : "text-red-600",
                )}
              >
                {checkAvailability(new Date(), format(new Date(), "HH:mm"))
                  .isOpen
                  ? "Open"
                  : "Closed"}
              </Text>
              <Text className="text-xs text-muted-foreground">
                • {formatDisplayHours()}
              </Text>
            </View>
          )}

          <Text
            className={cn(
              "text-xs font-medium",
              restaurant.booking_policy === "instant"
                ? "text-green-600"
                : "text-orange-600",
            )}
          >
            {restaurant.booking_policy === "instant"
              ? "Instant Book"
              : "Request"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
