// components/home/SpecialOffersCarousel.tsx
import React, { useState, useRef, useCallback } from "react";
import {
  FlatList,
  View,
  Dimensions,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { useOffers, EnrichedOffer } from "@/hooks/useOffers";
import { SpecialOfferCard } from "@/components/home/SpecialOfferCard";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface SpecialOffersCarouselProps {
  offers: EnrichedOffer[];
  onPress: (offer: EnrichedOffer) => void;
}

export function SpecialOffersCarousel({
  offers,
  onPress,
}: SpecialOffersCarouselProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const { claimOffer } = useOffers();

  // State management
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processingOfferId, setProcessingOfferId] = useState<string | null>(
    null,
  );
  const flatListRef = useRef<FlatList>(null);

  // Pagination handlers
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // Enhanced offer press handler - goes to availability with offer applied
  const handleOfferPress = useCallback(
    async (offer: EnrichedOffer) => {
      // Check if user is logged in
      if (!profile?.id) {
        Alert.alert(
          "Sign In Required",
          "Please sign in to use special offers.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Sign In", onPress: () => router.push("/sign-in") },
          ],
        );
        return;
      }

      // Check if offer is claimed by user
      if (!offer.claimed) {
        // Offer not claimed - show claim dialog
        Alert.alert(
          "Claim Offer First",
          `You need to claim this ${offer.discount_percentage}% off offer before using it. Would you like to claim it now?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Claim & Book",
              onPress: async () => {
                await handleClaimAndBook(offer);
              },
            },
          ],
        );
        return;
      }

      // Check if offer is still valid
      if (offer.isExpired || offer.used) {
        Alert.alert(
          "Offer Not Available",
          offer.used
            ? "This offer has already been used."
            : "This offer has expired.",
          [{ text: "OK" }],
        );
        return;
      }

      // Navigate to availability with offer pre-selected
      navigateToAvailabilityWithOffer(offer);
    },
    [profile?.id, router],
  );

  // Claim offer and then book
  const handleClaimAndBook = useCallback(
    async (offer: EnrichedOffer) => {
      if (processingOfferId) return;

      setProcessingOfferId(offer.id);

      try {
        await claimOffer(offer.id);
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );

        // After claiming, navigate to availability
        navigateToAvailabilityWithOffer(offer);
      } catch (err: any) {
        console.error("Error claiming offer:", err);
        Alert.alert(
          "Error",
          err.message || "Failed to claim offer. Please try again.",
        );
      } finally {
        setProcessingOfferId(null);
      }
    },
    [processingOfferId, claimOffer],
  );

  // Navigate to availability with offer details
  const navigateToAvailabilityWithOffer = useCallback(
    (offer: EnrichedOffer) => {
      router.push({
        pathname: "/booking/availability",
        params: {
          restaurantId: offer.restaurant_id,
          restaurantName: offer.restaurant.name,
          preselectedOfferId: offer.id, // special_offer ID
          offerTitle: offer.title,
          offerDiscount: (offer.discount_percentage ?? 0).toString(),
          redemptionCode: offer.redemptionCode || offer.id,
        },
      });
    },
    [router],
  );

  // Pagination dot press handler
  const handleDotPress = useCallback((index: number) => {
    flatListRef.current?.scrollToIndex({
      index,
      animated: true,
    });
    setCurrentIndex(index);
  }, []);

  // Render offer card with enhanced press handling
  const renderOfferCard = useCallback(
    ({ item }: { item: EnrichedOffer }) => (
      <View style={{ width: SCREEN_WIDTH }}>
        {/* Conditionally wrap with Pressable based on is_clickable field */}
        {item.is_clickable ? (
          <Pressable
            onPress={() => (onPress ? onPress(item) : handleOfferPress(item))}
            disabled={processingOfferId === item.id}
            style={{ opacity: processingOfferId === item.id ? 0.7 : 1 }}
          >
            <SpecialOfferCard offer={item} />

            {/* Processing overlay */}
            {processingOfferId === item.id && (
              <View className="absolute inset-0 bg-black/20 rounded-2xl items-center justify-center">
                <View className="bg-white rounded-lg p-4 items-center">
                  <ActivityIndicator size="small" color="#3b82f6" />
                  <Text className="text-sm mt-2">Claiming offer...</Text>
                </View>
              </View>
            )}
          </Pressable>
        ) : (
          <View>
            <SpecialOfferCard offer={item} />
          </View>
        )}
      </View>
    ),
    [onPress, handleOfferPress, processingOfferId],
  );

  if (offers.length === 0) {
    return null;
  }

  return (
    <View>
      <FlatList
        ref={flatListRef}
        data={offers}
        renderItem={renderOfferCard}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        decelerationRate="fast"
        snapToInterval={SCREEN_WIDTH}
        snapToAlignment="start"
        contentContainerStyle={{ paddingVertical: 8 }}
      />

      {/* Pagination Dots */}
      {offers.length > 1 && (
        <View className="flex-row justify-center items-center mt-4 gap-2">
          {offers.map((_, index) => (
            <Pressable
              key={index}
              onPress={() => handleDotPress(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentIndex
                  ? "bg-primary w-6"
                  : "bg-muted-foreground/30 w-2"
              }`}
            />
          ))}
        </View>
      )}
    </View>
  );
}
