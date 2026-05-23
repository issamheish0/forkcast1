// app/(protected)/offers.tsx
import React from "react";
import {
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Share,
  Modal,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  Tag,
  Clock,
  Calendar,
  Users,
  Percent,
  ChevronRight,
  ChevronLeft,
  Star,
  MapPin,
  Gift,
  X,
  Share2,
  CheckCircle,
  ExternalLink,
  AlertCircle,
  ArrowUpDown,
  ArrowLeft,
  Check,
  Info,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { useColorScheme } from "@/lib/useColorScheme";
import { getThemedColors } from "@/lib/utils";
import { useOffers, EnrichedOffer } from "@/hooks/useOffers";
import OffersScreenSkeleton from "@/components/skeletons/OffersScreenSkeleton";
import { OptimizedList } from "@/components/ui/optimized-list";
import { formatDateToDDMMYYYY } from "@/utils/birthday";
import { useLocationWithDistance } from "@/hooks/useLocationWithDistance";
import { LocationService } from "@/lib/locationService";
import { useRestaurantStore } from "@/stores/index";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { RestaurantCardOverlay } from "@/components/restaurant/RestaurantCardOverlay";
import { useQuickActionPress } from "@/hooks/useHapticPress";

export default function SpecialOffersScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);
  const insets = useSafeAreaInsets();

  // Get search params to check if coming from booking flow
  const params = useLocalSearchParams<{
    restaurantId?: string;
    returnTo?: string;
  }>();

  // Check if we're in booking context
  const isBookingContext =
    params.restaurantId && params.returnTo === "availability";

  // Use the useOffers hook for all offer logic
  const {
    offers,
    loading,
    error,
    filters,
    claimOffer,
    useOffer,
    updateFilters,
    fetchOffers,
  } = useOffers();

  // Sort state
  const [sortBy, setSortBy] = React.useState<
    | "highest-discount"
    | "lowest-discount"
    | "closest"
    | "furthest"
    | "expiring-soon"
    | "expiring-later"
  >("highest-discount");

  // Location for distance sorting
  const { location: userLocation, calculateDistance } =
    useLocationWithDistance();
  const { favorites, addToFavorites, removeFromFavorites } =
    useRestaurantStore();
  const { profile } = useAuth();

  // Filter offers for booking context and sort them
  const displayOffers = React.useMemo(() => {
    let filtered =
      isBookingContext && params.restaurantId
        ? offers.filter((offer) => offer.restaurant_id === params.restaurantId)
        : offers;

    // Sort offers
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "highest-discount") {
        // Highest to lowest discount
        return (b.discount_percentage || 0) - (a.discount_percentage || 0);
      } else if (sortBy === "lowest-discount") {
        // Lowest to highest discount
        return (a.discount_percentage || 0) - (b.discount_percentage || 0);
      } else if (sortBy === "closest") {
        // Closest to furthest
        if (!userLocation) return 0;

        const getDistance = (offer: EnrichedOffer) => {
          const restaurant = offer.restaurant;
          if (!restaurant?.location) return Infinity;

          const coords = LocationService.extractCoordinates(
            restaurant.location,
          );
          if (!coords) return Infinity;

          return (
            calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              coords.latitude,
              coords.longitude,
            ) || Infinity
          );
        };

        const distA = getDistance(a);
        const distB = getDistance(b);

        return distA - distB;
      } else if (sortBy === "furthest") {
        // Furthest to closest
        if (!userLocation) return 0;

        const getDistance = (offer: EnrichedOffer) => {
          const restaurant = offer.restaurant;
          if (!restaurant?.location) return Infinity;

          const coords = LocationService.extractCoordinates(
            restaurant.location,
          );
          if (!coords) return Infinity;

          return (
            calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              coords.latitude,
              coords.longitude,
            ) || Infinity
          );
        };

        const distA = getDistance(a);
        const distB = getDistance(b);

        return distB - distA;
      } else if (sortBy === "expiring-soon") {
        // Expiring soon first (earliest expiry date first)
        const dateA = new Date(a.valid_until).getTime();
        const dateB = new Date(b.valid_until).getTime();
        return dateA - dateB;
      } else if (sortBy === "expiring-later") {
        // Expiring later first (latest expiry date first)
        const dateA = new Date(a.valid_until).getTime();
        const dateB = new Date(b.valid_until).getTime();
        return dateB - dateA;
      }
      return 0;
    });

    return sorted;
  }, [
    offers,
    isBookingContext,
    params.restaurantId,
    sortBy,
    userLocation,
    calculateDistance,
  ]);

  // UI state
  const [processingOfferId, setProcessingOfferId] = React.useState<
    string | null
  >(null);
  const [selectedOffer, setSelectedOffer] =
    React.useState<EnrichedOffer | null>(null);
  const [showOfferDetails, setShowOfferDetails] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [showSortModal, setShowSortModal] = React.useState(false);

  // Share offer
  const shareOffer = React.useCallback(async (offer: EnrichedOffer) => {
    try {
      const message = `Check out this ${offer.discount_percentage}% off deal at ${offer.restaurant.name}! 🎉\n\n${offer.title}\n\nValid until ${formatDateToDDMMYYYY(new Date(offer.valid_until))}`;
      await Share.share({
        message,
        title: `Special Offer: ${offer.title}`,
      });
    } catch (error) {
      console.error("Error sharing offer:", error);
    }
  }, []);

  // Navigate to restaurant
  const navigateToRestaurant = React.useCallback(
    (restaurantId: string, offerId?: string) => {
      router.push({
        pathname: "/restaurant/[id]",
        params: {
          id: restaurantId,
          ...(offerId && { highlightOfferId: offerId }),
        },
      });
    },
    [router],
  );

  // FIXED: Book with offer - now goes through availability selection first
  const bookWithOffer = React.useCallback(
    (offer: EnrichedOffer) => {
      // Check if offer is still valid
      const now = new Date();
      const validUntil = new Date(offer.valid_until);
      if (now > validUntil) {
        Alert.alert(
          "Offer Expired",
          "This offer is no longer valid. Please select a different offer.",
          [{ text: "OK" }],
        );
        return;
      }

      // For claimed offers, check if they can be used
      if (offer.claimed && !offer.canUse) {
        Alert.alert(
          "Offer Not Available",
          offer.used
            ? "This offer has already been used."
            : "This offer has expired.",
          [{ text: "OK" }],
        );
        return;
      }

      // Navigate to availability selection with offer pre-selected
      // The booking flow will handle claiming unclaimed offers during confirmation
      router.push({
        pathname: "/booking/availability",
        params: {
          restaurantId: offer.restaurant_id,
          restaurantName: offer.restaurant.name,
          // Pass offer information to be carried through the booking flow
          preselectedOfferId: offer.id,
          offerTitle: offer.title,
          offerDiscount: (offer.discount_percentage || 0).toString(),
          // Only pass redemptionCode if offer is already claimed
          ...(offer.claimed &&
            offer.redemptionCode && {
              redemptionCode: offer.redemptionCode,
            }),
        },
      });
    },
    [router],
  );

  // Enhanced claim offer with better error handling
  const handleClaimOffer = React.useCallback(
    async (offer: EnrichedOffer) => {
      if (processingOfferId === offer.id) return;

      // Pre-flight validation
      const now = new Date();
      const validUntil = new Date(offer.valid_until);
      if (now > validUntil) {
        Alert.alert("Offer Expired", "This offer is no longer valid.", [
          { text: "OK" },
        ]);
        return;
      }

      if (offer.claimed) {
        Alert.alert("Already Claimed", "You have already claimed this offer.", [
          { text: "OK" },
        ]);
        return;
      }

      setProcessingOfferId(offer.id);

      try {
        const success = await claimOffer(offer.id);
        if (!success) {
          throw new Error("Failed to claim offer");
        }

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );

        Alert.alert(
          "Offer Claimed! 🎉",
          `You've successfully claimed ${offer.discount_percentage || 0}% off at ${offer.restaurant.name}. You can now use this offer when booking.`,
          [
            {
              text: "View Restaurant",
              onPress: () =>
                navigateToRestaurant(offer.restaurant_id, offer.id),
            },
            { text: "Book Now", onPress: () => bookWithOffer(offer) },
            { text: "OK", style: "cancel" },
          ],
        );
      } catch (err: any) {
        console.error("Error claiming offer:", err);

        let errorMessage = "Failed to claim offer. Please try again.";
        if (err.message?.includes("already claimed")) {
          errorMessage = "This offer has already been claimed.";
        } else if (err.message?.includes("expired")) {
          errorMessage = "This offer has expired and can no longer be claimed.";
        } else if (
          err.message?.includes("network") ||
          err.message?.includes("connection")
        ) {
          errorMessage =
            "Network error. Please check your connection and try again.";
        }

        Alert.alert("Error", errorMessage);
      } finally {
        setProcessingOfferId(null);
      }
    },
    [claimOffer, processingOfferId, navigateToRestaurant, bookWithOffer],
  );

  // Apply offer to booking and return to availability
  const applyOfferToBooking = React.useCallback(
    (offer: EnrichedOffer) => {
      // Check if offer is still valid
      const now = new Date();
      const validUntil = new Date(offer.valid_until);
      if (now > validUntil) {
        Alert.alert(
          "Offer Expired",
          "This offer is no longer valid. Please select a different offer.",
          [{ text: "OK" }],
        );
        return;
      }

      // If not claimed, prompt to claim first
      if (!offer.claimed) {
        Alert.alert(
          "Claim Required",
          "You need to claim this offer first before you can use it.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Claim Now",
              onPress: () => handleClaimOffer(offer),
            },
          ],
        );
        return;
      }

      // Check if claimed offer can be used
      if (!offer.canUse) {
        Alert.alert(
          "Offer Not Available",
          offer.used
            ? "This offer has already been used."
            : "This offer has expired.",
          [{ text: "OK" }],
        );
        return;
      }

      // Validate redemption code exists
      if (!offer.redemptionCode) {
        Alert.alert(
          "Error",
          "Invalid offer data. Please try refreshing the page.",
          [{ text: "OK" }],
        );
        return;
      }

      // Navigate back to availability with the offer applied
      router.push({
        pathname: "/booking/availability",
        params: {
          restaurantId: params.restaurantId!,
          preselectedOfferId: offer.id,
          offerTitle: offer.title,
          offerDiscount: (offer.discount_percentage || 0).toString(),
          redemptionCode: offer.redemptionCode || "",
        },
      });
    },
    [router, params.restaurantId, handleClaimOffer],
  );

  // Refresh handler
  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchOffers();
    } catch (error) {
      console.error("Error refreshing offers:", error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchOffers]);

  // Toggle favorite handler
  const handleToggleFavorite = React.useCallback(
    async (restaurantId: string) => {
      if (!restaurantId || !profile?.id) return;

      const currentIsFavorite = favorites.has(restaurantId);
      const newFavoriteState = !currentIsFavorite;

      // Optimistic update
      if (newFavoriteState) {
        addToFavorites(restaurantId);
      } else {
        removeFromFavorites(restaurantId);
      }

      // Sync with backend (fire and forget)
      try {
        if (newFavoriteState) {
          await supabase.from("favorites").insert({
            user_id: profile.id,
            restaurant_id: restaurantId,
          });
        } else {
          await supabase
            .from("favorites")
            .delete()
            .eq("user_id", profile.id)
            .eq("restaurant_id", restaurantId);
        }
      } catch (error) {
        // Revert on error
        if (newFavoriteState) {
          removeFromFavorites(restaurantId);
        } else {
          addToFavorites(restaurantId);
        }
      }
    },
    [favorites, addToFavorites, removeFromFavorites, profile?.id],
  );

  // Custom offer card component
  const OfferCard = ({ offer }: { offer: EnrichedOffer }) => {
    const { handlePress: handleQuickActionPress } = useQuickActionPress();

    const handleCardPress = () => {
      if (offer.claimed) {
        setSelectedOffer(offer);
        setShowOfferDetails(true);
      } else {
        navigateToRestaurant(offer.restaurant_id, offer.id);
      }
    };

    const handleFavoritePress = () => {
      handleQuickActionPress(() => handleToggleFavorite(offer.restaurant_id));
    };

    // Calculate days left
    const calculateDaysLeft = () => {
      const now = new Date();
      const validUntil = new Date(offer.valid_until);
      const diffTime = validUntil.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    };

    const daysLeft = calculateDaysLeft();
    const expiryDate = formatDateToDDMMYYYY(new Date(offer.valid_until));

    return (
      <>
        <Pressable
          onPress={handleCardPress}
          className="bg-card border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden mb-6 shadow-lg shadow-black/5"
        >
          {/* Restaurant Image with Overlay */}
          <View className="relative">
            <Image
              source={{ uri: offer.restaurant.main_image_url }}
              className="w-full h-60"
              contentFit="cover"
              optimizationPreset="medium"
            />

            {/* Unified Overlay with Featured, Like, and Playlist buttons */}
            <RestaurantCardOverlay
              showFavorite={true}
              isFavorite={favorites.has(offer.restaurant_id)}
              onFavoritePress={handleFavoritePress}
              isFeatured={offer.restaurant.featured || false}
              hasActiveOffer={true}
              offerDiscount={offer.discount_percentage ?? undefined}
              inset={12}
            />
          </View>

          {/* Offer Details */}
          <View className="p-4">
            {/* Restaurant Name - Prominent */}
            <Pressable
              onPress={() => navigateToRestaurant(offer.restaurant_id)}
              className="mb-3"
            >
              <Text className="font-bold text-xl">{offer.restaurant.name}</Text>
            </Pressable>

            {/* Offer Title */}
            <Text className="text-base font-semibold mb-3">{offer.title}</Text>

            {/* Countdown and Party Size on Same Line */}
            <View className="flex-row items-center mb-4">
              <Calendar
                size={14}
                color={colorScheme === "dark" ? "#a1a1aa" : "#3f3f46"}
              />
              <Text className="text-sm text-muted-foreground ml-1.5">
                {daysLeft === 0
                  ? "Expires today"
                  : daysLeft === 1
                    ? "1 day left"
                    : `${daysLeft} days left`}
              </Text>
              {(offer.minimum_party_size || 0) > 0 && (
                <>
                  <Text className="text-sm text-muted-foreground mx-1.5">
                    •
                  </Text>
                  <Users
                    size={14}
                    color={colorScheme === "dark" ? "#a1a1aa" : "#3f3f46"}
                  />
                  <Text className="text-sm text-muted-foreground ml-1.5">
                    {offer.minimum_party_size || 0}+ People
                  </Text>
                </>
              )}
            </View>

            {/* Action Buttons Row */}
            <View className="flex-row items-center gap-3">
              {/* Info Button - Round */}
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedOffer(offer);
                  setShowOfferDetails(true);
                }}
                className="w-12 h-12 rounded-full bg-muted/50 border border-border items-center justify-center"
              >
                <Info
                  size={20}
                  color={colorScheme === "dark" ? "#fff" : "#000"}
                />
              </Pressable>

              {/* Main Action Button */}
              <View className="flex-1">
                {!offer.claimed ? (
                  <Button
                    variant="default"
                    onPress={(e) => {
                      e.stopPropagation();
                      handleClaimOffer(offer);
                    }}
                    disabled={processingOfferId === offer.id}
                    className="h-12 rounded-lg"
                  >
                    {processingOfferId === offer.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Tag size={18} className="mr-2" />
                        <Text className="font-bold text-base text-white">
                          Claim Offer
                        </Text>
                      </>
                    )}
                  </Button>
                ) : offer.canUse ? (
                  <Button
                    variant="default"
                    onPress={(e) => {
                      e.stopPropagation();
                      if (isBookingContext) {
                        applyOfferToBooking(offer);
                      } else {
                        bookWithOffer(offer);
                      }
                    }}
                    className="h-12 rounded-lg"
                  >
                    <Text className="font-bold text-base text-white">
                      {isBookingContext
                        ? "Apply to Booking"
                        : "Book with Offer"}
                    </Text>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onPress={(e) => {
                      e.stopPropagation();
                      navigateToRestaurant(offer.restaurant_id);
                    }}
                    className="h-12 rounded-lg"
                  >
                    <ExternalLink size={18} className="mr-2" />
                    <Text className="font-bold text-base">View Restaurant</Text>
                  </Button>
                )}
              </View>
            </View>
          </View>
        </Pressable>

      </>
    );
  };

  // Sort modal component
  const SortModal = () => (
    <Modal
      visible={showSortModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowSortModal(false)}
    >
      <Pressable
        className="flex-1 bg-black/50 justify-end"
        onPress={() => setShowSortModal(false)}
      >
        <Pressable
          className="bg-card rounded-t-2xl"
          style={{ paddingBottom: insets.bottom + 24 }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <View className="items-center py-3">
            <View className="w-10 h-1 bg-muted rounded-full" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-6 pb-4 border-b border-border">
            <H3>Sort Offers</H3>
            <Pressable
              onPress={() => setShowSortModal(false)}
              className="p-2 -mr-2"
            >
              <X size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
            </Pressable>
          </View>

          {/* Sort options */}
          <ScrollView
            className="px-6 pt-4"
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              onPress={() => {
                setSortBy("highest-discount");
                setShowSortModal(false);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className="flex-row items-center justify-between py-4 border-b border-border"
            >
              <View className="flex-1">
                <Text className="text-base font-medium">Highest Discount</Text>
                <Text className="text-sm text-muted-foreground mt-1">
                  Sort by highest discount first
                </Text>
              </View>
              {sortBy === "highest-discount" && (
                <Check size={20} color="#3b82f6" />
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setSortBy("lowest-discount");
                setShowSortModal(false);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className="flex-row items-center justify-between py-4 border-b border-border"
            >
              <View className="flex-1">
                <Text className="text-base font-medium">Lowest Discount</Text>
                <Text className="text-sm text-muted-foreground mt-1">
                  Sort by lowest discount first
                </Text>
              </View>
              {sortBy === "lowest-discount" && (
                <Check size={20} color="#3b82f6" />
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setSortBy("closest");
                setShowSortModal(false);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className="flex-row items-center justify-between py-4 border-b border-border"
            >
              <View className="flex-1">
                <Text className="text-base font-medium">Closest First</Text>
                <Text className="text-sm text-muted-foreground mt-1">
                  Sort by distance from you
                </Text>
              </View>
              {sortBy === "closest" && <Check size={20} color="#3b82f6" />}
            </Pressable>

            <Pressable
              onPress={() => {
                setSortBy("furthest");
                setShowSortModal(false);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className="flex-row items-center justify-between py-4 border-b border-border"
            >
              <View className="flex-1">
                <Text className="text-base font-medium">Furthest First</Text>
                <Text className="text-sm text-muted-foreground mt-1">
                  Sort by furthest distance first
                </Text>
              </View>
              {sortBy === "furthest" && <Check size={20} color="#3b82f6" />}
            </Pressable>

            <Pressable
              onPress={() => {
                setSortBy("expiring-soon");
                setShowSortModal(false);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className="flex-row items-center justify-between py-4 border-b border-border"
            >
              <View className="flex-1">
                <Text className="text-base font-medium">Expiring Soon</Text>
                <Text className="text-sm text-muted-foreground mt-1">
                  Sort by earliest expiry date
                </Text>
              </View>
              {sortBy === "expiring-soon" && (
                <Check size={20} color="#3b82f6" />
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setSortBy("expiring-later");
                setShowSortModal(false);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className="flex-row items-center justify-between py-4"
            >
              <View className="flex-1">
                <Text className="text-base font-medium">Expiring Later</Text>
                <Text className="text-sm text-muted-foreground mt-1">
                  Sort by latest expiry date
                </Text>
              </View>
              {sortBy === "expiring-later" && (
                <Check size={20} color="#3b82f6" />
              )}
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // Enhanced offer details modal
  const OfferDetailsModal = () => {
    if (!selectedOffer) return null;

    // Calculate days left
    const calculateDaysLeft = () => {
      const now = new Date();
      const validUntil = new Date(selectedOffer.valid_until);
      const diffTime = validUntil.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    };

    const daysLeft = calculateDaysLeft();

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={showOfferDetails}
        onRequestClose={() => setShowOfferDetails(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShowOfferDetails(false)}
        >
          <Pressable
            className="bg-card rounded-t-2xl p-6"
            style={{ paddingBottom: insets.bottom + 24 }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View className="flex-row justify-between items-center mb-6">
              <H3>Offer Details</H3>
              <Pressable
                onPress={() => setShowOfferDetails(false)}
                className="p-1"
              >
                <X size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
              </Pressable>
            </View>

            {/* Offer info */}
            <View className="mb-6">
              <Text className="font-bold text-xl mb-2">
                {selectedOffer.title}
              </Text>
              <Text className="text-muted-foreground mb-6">
                {selectedOffer.description}
              </Text>

              {/* Location, Discount, Valid Until, and Party Size - Better Layout */}
              <View className="space-y-3 mb-6">
                {/* Location */}
                <View className="flex-row items-center bg-muted/30 rounded-lg px-4 py-3">
                  <MapPin
                    size={18}
                    color={colorScheme === "dark" ? "#a1a1aa" : "#3f3f46"}
                  />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-muted-foreground mb-0.5">
                      Location
                    </Text>
                    <Text className="font-medium text-base">
                      {selectedOffer.restaurant.name}
                    </Text>
                  </View>
                </View>

                {/* Discount */}
                <View className="flex-row items-center bg-muted/30 rounded-lg px-4 py-3">
                  <Percent
                    size={18}
                    color={colorScheme === "dark" ? "#a1a1aa" : "#3f3f46"}
                  />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-muted-foreground mb-0.5">
                      Discount
                    </Text>
                    <Text className="font-medium text-base">
                      {selectedOffer.discount_percentage}% off
                    </Text>
                  </View>
                </View>

                {/* Valid Until */}
                <View className="flex-row items-center bg-muted/30 rounded-lg px-4 py-3">
                  <Calendar
                    size={18}
                    color={colorScheme === "dark" ? "#a1a1aa" : "#3f3f46"}
                  />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-muted-foreground mb-0.5">
                      Valid Until
                    </Text>
                    <Text className="font-medium text-base">
                      {formatDateToDDMMYYYY(
                        new Date(selectedOffer.valid_until),
                      )}
                      {daysLeft > 0 &&
                        ` (${daysLeft} ${daysLeft === 1 ? "day" : "days"} left)`}
                    </Text>
                  </View>
                </View>

                {/* Party Size */}
                {(selectedOffer.minimum_party_size || 0) > 0 && (
                  <View className="flex-row items-center bg-muted/30 rounded-lg px-4 py-3">
                    <Users
                      size={18}
                      color={colorScheme === "dark" ? "#a1a1aa" : "#3f3f46"}
                    />
                    <View className="ml-3 flex-1">
                      <Text className="text-xs text-muted-foreground mb-0.5">
                        Party Size
                      </Text>
                      <Text className="font-medium text-base">
                        {selectedOffer.minimum_party_size || 0}+ People
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Status display */}
              <View className="mb-6">
                {selectedOffer.used ? (
                  <View className="flex-row items-center bg-green-100 dark:bg-green-900/30 px-3 py-1.5 rounded-full self-start">
                    <CheckCircle size={14} color="#16a34a" />
                    <Text className="text-green-700 dark:text-green-300 text-sm ml-1.5 font-medium">
                      Used
                    </Text>
                  </View>
                ) : selectedOffer.isExpired ? (
                  <View className="flex-row items-center bg-red-100 dark:bg-red-900/30 px-3 py-1.5 rounded-full self-start">
                    <Clock size={14} color="#dc2626" />
                    <Text className="text-red-700 dark:text-red-300 text-sm ml-1.5 font-medium">
                      Expired
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Terms and conditions */}
            {selectedOffer.terms_conditions &&
              selectedOffer.terms_conditions.length > 0 && (
                <View className="mb-6">
                  <Text className="font-bold mb-3">Terms & Conditions</Text>
                  {selectedOffer.terms_conditions.map(
                    (term: string, index: number) => (
                      <Text
                        key={index}
                        className="text-sm text-muted-foreground mb-2"
                      >
                        • {term}
                      </Text>
                    ),
                  )}
                </View>
              )}

            {/* Action button */}
            {selectedOffer.canUse && (
              <Button
                onPress={() => {
                  setShowOfferDetails(false);
                  bookWithOffer(selectedOffer);
                }}
                className="h-12 rounded-lg"
              >
                <Text className="text-white font-bold text-base">Book Now</Text>
              </Button>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  if (loading) {
    return <OffersScreenSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background justify-center items-center px-4">
        <AlertCircle size={48} color="#ef4444" className="mb-4" />
        <H3 className="text-center mb-2">Something went wrong</H3>
        <Text className="text-center text-muted-foreground mb-4">{error}</Text>
        <Button onPress={handleRefresh}>
          <Text className="text-white">Try Again</Text>
        </Button>
      </SafeAreaView>
    );
  }

  // Empty state
  if (!loading && displayOffers.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View
          style={{ paddingTop: insets.top }}
          className="bg-background border-b border-border/50"
        >
          <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
            {isBookingContext ? (
              <View className="flex-row items-center flex-1">
                <Pressable
                  onPress={() => router.back()}
                  className="p-2 -ml-2 mr-2 rounded-full"
                  hitSlop={8}
                >
                  <ChevronLeft
                    size={24}
                    color={colorScheme === "dark" ? "#fff" : "#000"}
                  />
                </Pressable>
                <View className="flex-1">
                  <H2>Restaurant Offers</H2>
                  <Muted>No offers available for this restaurant</Muted>
                </View>
              </View>
            ) : (
              <>
                <View>
                  <H2>Special Offers</H2>
                  <Muted>No offers available</Muted>
                </View>
                <Pressable
                  onPress={() => {
                    setShowSortModal(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  className="bg-muted/50 rounded-full p-2.5"
                >
                  <ArrowUpDown
                    size={20}
                    color={colorScheme === "dark" ? "#fff" : "#000"}
                  />
                </Pressable>
              </>
            )}
          </View>
        </View>

        <View className="flex-1 justify-center items-center px-4">
          <Gift size={48} color="#666" className="mb-4" />
          <H3 className="text-center mb-2">No offers found</H3>
          <Text className="text-center text-muted-foreground mb-4">
            {isBookingContext
              ? "This restaurant doesn't have any active offers right now. You can still continue with your booking."
              : "Check back later for new deals or try adjusting your filters."}
          </Text>
          <View className="flex-row gap-3">
            <Button onPress={handleRefresh}>
              <Text className="text-white">Refresh</Text>
            </Button>
            {isBookingContext && (
              <Button variant="outline" onPress={() => router.back()}>
                <Text>Continue Booking</Text>
              </Button>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Main render - header same design as Ramadan Special (view all)
  return (
    <SafeAreaView className="flex-1 bg-background" edges={[]}>
      {/* Header - same layout as Ramadan Special: back + title (+ sort when not booking context) */}
      <View
        style={{ paddingTop: insets.top }}
        className="bg-background border-b border-border"
      >
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="p-2 -ml-2 rounded-full active:bg-muted"
          >
            <ArrowLeft size={24} color={themedColors.foreground} />
          </Pressable>
          <View className="flex-1 ml-2">
            <Text className="text-xl font-bold text-foreground">
              {isBookingContext ? "Restaurant Offers" : "🎁 Special Offers"}
            </Text>
          </View>
          {!isBookingContext && (
            <Pressable
              onPress={() => {
                setShowSortModal(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className="bg-muted/50 rounded-full p-2.5"
            >
              <ArrowUpDown size={20} color={themedColors.foreground} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Content */}
      <OptimizedList
        data={displayOffers}
        renderItem={({ item: offer }) => <OfferCard offer={offer} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: insets.bottom + 16,
        }}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* Modals */}
      <SortModal />
      <OfferDetailsModal />
    </SafeAreaView>
  );
}
