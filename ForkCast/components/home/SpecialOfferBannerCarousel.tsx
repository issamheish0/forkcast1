// components/home/SpecialOfferBannerCarousel.tsx
import React, { useRef, useState, useCallback } from "react";
import { ScrollView, View, Dimensions, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";

import { SpecialOfferBanner } from "./SpecialOfferBanner";
import { useAuth } from "@/context/supabase-provider";
import { useGuestGuard } from "@/hooks/useGuestGuard";
import { useOffers, EnrichedOffer } from "@/hooks/useOffers";
import { GuestPromptModal } from "@/components/guest/GuestPromptModal";
import { Image } from "@/components/image";

const { width: screenWidth } = Dimensions.get("window");

interface SpecialOfferBannerCarouselProps {
  offers: EnrichedOffer[];
}

export function SpecialOfferBannerCarousel({
  offers,
}: SpecialOfferBannerCarouselProps) {
  // --- Hooks ---
  const router = useRouter();
  const { claimOffer } = useOffers();
  const {
    showGuestPrompt,
    promptedFeature,
    runProtectedAction,
    handleClosePrompt,
    handleSignUpFromPrompt,
  } = useGuestGuard();

  // --- State ---
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processingOfferId, setProcessingOfferId] = useState<string | null>(
    null,
  );
  const scrollViewRef = useRef<ScrollView>(null);

  // --- UI Logic ---
  const bannersWithImages = offers.filter(
    (offer) => offer.img_url && offer.img_url.trim() !== "",
  );

  // Build list with local welcome banner as the first item
  const bannerWidth = screenWidth - 32;
  const spacing = 8;

  const localWelcomeBanner = (
    <View key="welcome-local" style={{ marginRight: spacing }}>
      <Image
        source={require("@/assets/welcome.png")}
        style={{ width: bannerWidth, height: 200, borderRadius: 12 }}
        contentFit="cover"
      />
    </View>
  );

  const hasRemoteBanners = bannersWithImages.length > 0;

  if (!hasRemoteBanners) {
    // Still show the local banner alone
    return (
      <View className="mb-6">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={bannerWidth + spacing}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {localWelcomeBanner}
        </ScrollView>
      </View>
    );
  }

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / (bannerWidth + spacing));
    // +1 because of the local banner at the beginning
    setCurrentIndex(Math.max(0, Math.min(index, bannersWithImages.length)));
  };

  const handleDotPress = (index: number) => {
    const scrollPosition = index * (bannerWidth + spacing);
    scrollViewRef.current?.scrollTo({
      x: scrollPosition,
      animated: true,
    });
    setCurrentIndex(index);
  };

  // --- Offer Handling Logic (with Guest Guard) ---
  const handleClaimAndBook = useCallback(
    async (offer: EnrichedOffer) => {
      try {
        setProcessingOfferId(offer.id);
        const success = await claimOffer(offer.id);

        if (success) {
          router.push({
            pathname: "/booking/availability",
            params: {
              restaurantId: offer.restaurant_id,
              restaurantName: offer.restaurant.name,
              offerId: offer.id,
              discountPercentage: (offer.discount_percentage ?? 0).toString(),
            },
          });
        } else {
          Alert.alert(
            "Unable to Claim",
            "This offer could not be claimed. Please try again.",
          );
        }
      } catch (error) {
        console.error("Error claiming and booking offer:", error);
      } finally {
        setProcessingOfferId(null);
      }
    },
    [claimOffer, router],
  );

  const handleBannerPress = useCallback(
    (offer: EnrichedOffer) => {
      runProtectedAction(async () => {
        // Offer is claimed and valid, navigate to booking
        // This assumes the user must claim the offer elsewhere first,
        // or the banner is a direct link to book.
        // For simplicity, we'll navigate directly to the restaurant page.
        if (offer.isExpired || offer.used) {
          Alert.alert(
            "Offer Not Available",
            offer.used
              ? "This offer has already been used."
              : "This offer has expired.",
          );
          return;
        }

        Alert.alert(
          "Use Offer",
          `Use this ${offer.discount_percentage ?? 0}% off offer at ${offer.restaurant.name}?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Book Now",
              onPress: () => handleClaimAndBook(offer),
            },
          ],
        );
      }, "use special offers");
    },
    [runProtectedAction, router, handleClaimAndBook],
  );

  return (
    <>
      <View className="mb-6">
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={bannerWidth + spacing}
          snapToAlignment="start"
          contentContainerStyle={{ paddingHorizontal: 16 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Local welcome banner first */}
          {localWelcomeBanner}

          {/* Then remote offer banners */}
          {bannersWithImages.map((offer, index) => (
            <View
              key={offer.id}
              style={{
                marginRight:
                  index === bannersWithImages.length - 1 ? 0 : spacing,
              }}
            >
              {/* Conditionally wrap with Pressable based on is_clickable field */}
              {offer.is_clickable ? (
                <Pressable onPress={() => handleBannerPress(offer)}>
                  <SpecialOfferBanner offer={offer} />
                </Pressable>
              ) : (
                <SpecialOfferBanner offer={offer} />
              )}
            </View>
          ))}
        </ScrollView>

        {/* Pagination Dots */}
        {bannersWithImages.length >= 1 && (
          <View className="flex-row justify-center items-center mt-4 gap-2">
            {/* +1 dot for the local banner */}
            {[...Array(bannersWithImages.length + 1)].map((_, index) => (
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

      {/* Guest Prompt Modal */}
      <GuestPromptModal
        visible={showGuestPrompt}
        onClose={handleClosePrompt}
        onSignUp={handleSignUpFromPrompt}
        featureName={promptedFeature}
      />
    </>
  );
}
