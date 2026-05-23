// components/home/BannerCarousel.tsx
import React, { useRef, useState, useCallback, useEffect } from "react";
import { ScrollView, View, Dimensions, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";

import { Banner } from "./Banner";
import { useGuestGuard } from "@/hooks/useGuestGuard";
import { useOffers, EnrichedOffer } from "@/hooks/useOffers";
import { GuestPromptModal } from "@/components/guest/GuestPromptModal";
import { EventDetailsModal } from "@/components/events/EventDetailsModal";
import { EnrichedBanner } from "@/types/banners";
import { useAnalytics } from "@/hooks/useAnalytics";
import type { RestaurantEventWithOccurrences } from "@/types/events";

const { width: screenWidth } = Dimensions.get("window");

interface BannerCarouselProps {
  banners: EnrichedBanner[];
}

export function BannerCarousel({ banners }: BannerCarouselProps) {
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
  const scrollViewRef = useRef<ScrollView>(null);
  const isAutoScrollingRef = useRef(false);
  const autoScrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const isManualScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationTimeoutRefs = useRef<Set<ReturnType<typeof setTimeout>>>(
    new Set(),
  );

  // Event modal state
  const [selectedEvent, setSelectedEvent] =
    useState<RestaurantEventWithOccurrences | null>(null);
  const [selectedEventRestaurantId, setSelectedEventRestaurantId] = useState<
    string | null
  >(null);
  const [showEventModal, setShowEventModal] = useState(false);

  // --- UI Logic ---
  const bannersWithImages = banners.filter(
    (banner) => banner.image_url && banner.image_url.trim() !== "",
  );

  const bannerWidth = screenWidth - 32;
  const spacing = 8;

  // Don't render if no banners
  if (bannersWithImages.length === 0) {
    return null;
  }

  // --- Auto-scroll functionality ---
  useEffect(() => {
    // Only auto-scroll if there are multiple banners
    if (bannersWithImages.length <= 1) {
      return;
    }

    // Start auto-scroll on mount
    isManualScrollingRef.current = false;
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
    }

    autoScrollIntervalRef.current = setInterval(() => {
      isAutoScrollingRef.current = true;
      setCurrentIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % bannersWithImages.length;
        const scrollPosition = nextIndex * (bannerWidth + spacing);
        scrollViewRef.current?.scrollTo({
          x: scrollPosition,
          animated: true,
        });
        // Reset the flag after a short delay to allow scroll animation
        const timeoutId = setTimeout(() => {
          isAutoScrollingRef.current = false;
          animationTimeoutRefs.current.delete(timeoutId);
        }, 500);
        animationTimeoutRefs.current.add(timeoutId);
        return nextIndex;
      });
    }, 4000); // 4 seconds

    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
        autoScrollIntervalRef.current = null;
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
      // Clean up any pending animation timeouts
      animationTimeoutRefs.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      animationTimeoutRefs.current.clear();
    };
  }, [bannersWithImages.length, bannerWidth, spacing]);

  // Start auto-scroll interval
  const startAutoScroll = useCallback(() => {
    // Clear any existing interval first
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }

    if (bannersWithImages.length > 1 && !isManualScrollingRef.current) {
      autoScrollIntervalRef.current = setInterval(() => {
        isAutoScrollingRef.current = true;
        setCurrentIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % bannersWithImages.length;
          const scrollPosition = nextIndex * (bannerWidth + spacing);
          scrollViewRef.current?.scrollTo({
            x: scrollPosition,
            animated: true,
          });
          const timeoutId = setTimeout(() => {
            isAutoScrollingRef.current = false;
            animationTimeoutRefs.current.delete(timeoutId);
          }, 500);
          animationTimeoutRefs.current.add(timeoutId);
          return nextIndex;
        });
      }, 4000);
    }
  }, [bannersWithImages.length, bannerWidth, spacing]);

  const handleScroll = useCallback(
    (event: any) => {
      // Don't update from scroll events during auto-scroll to prevent lag
      if (isAutoScrollingRef.current) {
        return;
      }

      // Mark that user is manually scrolling and stop auto-scroll
      isManualScrollingRef.current = true;
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
        autoScrollIntervalRef.current = null;
      }

      // Clear any existing scroll timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Set timeout to restart auto-scroll after user finishes scrolling
      scrollTimeoutRef.current = setTimeout(() => {
        isManualScrollingRef.current = false;
        startAutoScroll();
      }, 4000); // Wait 4 seconds after last scroll event before restarting

      const contentOffset = event.nativeEvent.contentOffset.x;
      const index = Math.round(contentOffset / (bannerWidth + spacing));
      const newIndex = Math.max(
        0,
        Math.min(index, bannersWithImages.length - 1),
      );

      // Only update if index actually changed (prevents unnecessary updates)
      setCurrentIndex((prevIndex) => {
        if (prevIndex !== newIndex) {
          return newIndex;
        }
        return prevIndex;
      });
    },
    [bannersWithImages.length, bannerWidth, spacing, startAutoScroll],
  );

  const handleDotPress = (index: number) => {
    // Stop auto-scroll
    isAutoScrollingRef.current = false;
    isManualScrollingRef.current = true;

    // Clear any existing intervals/timeouts
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    const scrollPosition = index * (bannerWidth + spacing);
    scrollViewRef.current?.scrollTo({
      x: scrollPosition,
      animated: true,
    });
    setCurrentIndex(index);

    // Restart auto-scroll after a delay
    scrollTimeoutRef.current = setTimeout(() => {
      isManualScrollingRef.current = false;
      startAutoScroll();
    }, 4000);
  };

  // --- Offer Handling Logic (with Guest Guard) ---
  const handleClaimAndBook = useCallback(
    async (offer: EnrichedOffer) => {
      try {
        const success = await claimOffer(offer.id);

        if (success) {
          router.push({
            pathname: "/booking/availability",
            params: {
              restaurantId: offer.restaurant_id,
              restaurantName: offer.restaurant.name,
              offerId: offer.id,
              discountPercentage: (offer.discount_percentage || 0).toString(),
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
      }
    },
    [claimOffer, router],
  );

  // --- Analytics ---
  const { trackImpression, trackClick } = useAnalytics();
  const impressionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Track impression when active slide changes
  useEffect(() => {
    if (bannersWithImages.length === 0) return;

    const currentBanner = bannersWithImages[currentIndex];
    if (!currentBanner) return;

    // Clear any pending impression from previous slide
    if (impressionTimeoutRef.current) {
      clearTimeout(impressionTimeoutRef.current);
    }

    // Set a delay to count as an impression (e.g., 1 second view)
    impressionTimeoutRef.current = setTimeout(() => {
      trackImpression("banner", currentBanner.id, {
        position: currentIndex,
        from_screen: "home_carousel",
        restaurant_id: currentBanner.restaurant_id,
        special_offer_id: currentBanner.special_offer_id,
        click_type: currentBanner.clickType,
      });
    }, 1000);

    return () => {
      if (impressionTimeoutRef.current) {
        clearTimeout(impressionTimeoutRef.current);
      }
    };
  }, [currentIndex, bannersWithImages, trackImpression]);

  // --- Banner Click Handling ---
  const handleBannerPress = useCallback(
    (banner: EnrichedBanner) => {
      // Track click immediately
      trackClick("banner", banner.id, {
        position: currentIndex,
        destination_type: banner.clickType,
        restaurant_id: banner.restaurant_id,
        special_offer_id: banner.special_offer_id,
        special_event_id: banner.special_event_id,
      });

      runProtectedAction(async () => {
        // Handle event navigation - show EventDetailsModal
        if (banner.clickType === "event" && banner.special_event) {
          setSelectedEvent(banner.special_event);
          setSelectedEventRestaurantId(banner.special_event.restaurant_id);
          setShowEventModal(true);
          return;
        }

        // Handle restaurant navigation
        if (banner.clickType === "restaurant" && banner.restaurant) {
          router.push({
            pathname: "/restaurant/[id]",
            params: {
              id: banner.restaurant.id,
            },
          });
          return;
        }

        // Handle special offer
        if (
          banner.clickType === "offer" &&
          banner.special_offer &&
          banner.special_offer.restaurant
        ) {
          const offer = banner.special_offer;

          // Check if offer is valid
          if (offer.valid_until) {
            const validUntil = new Date(offer.valid_until);
            const now = new Date();
            if (now > validUntil) {
              Alert.alert("Offer Expired", "This offer has expired.");
              return;
            }
          }

          // Show confirmation dialog
          Alert.alert(
            "Use Offer",
            `Use this ${offer.discount_percentage || 0}% off offer at ${offer.restaurant.name}?`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Book Now",
                onPress: () =>
                  handleClaimAndBook(offer as unknown as EnrichedOffer),
              },
            ],
          );
          return;
        }
      }, "view offers, events and restaurants");
    },
    [runProtectedAction, router, handleClaimAndBook, trackClick, currentIndex],
  );

  // Handle closing the event modal
  const handleCloseEventModal = useCallback(() => {
    setShowEventModal(false);
    setSelectedEvent(null);
    setSelectedEventRestaurantId(null);
  }, []);

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
          {bannersWithImages.map((banner, index) => (
            <View
              key={banner.id}
              style={{
                marginRight:
                  index === bannersWithImages.length - 1 ? 0 : spacing,
              }}
            >
              <Banner banner={banner} onPress={handleBannerPress} />
            </View>
          ))}
        </ScrollView>

        {/* Pagination Dots - only show if more than 1 banner */}
        {bannersWithImages.length > 1 && (
          <View className="flex-row justify-center items-center mt-4 gap-2">
            {bannersWithImages.map((_, index) => (
              <Pressable
                key={index}
                onPress={() => handleDotPress(index)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                className={`h-2.5 rounded-full transition-all ${
                  index === currentIndex
                    ? "bg-primary w-7"
                    : "bg-muted-foreground/30 w-2.5"
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

      {/* Event Details Modal */}
      {selectedEvent && selectedEventRestaurantId && (
        <EventDetailsModal
          visible={showEventModal}
          event={selectedEvent}
          restaurantId={selectedEventRestaurantId}
          onClose={handleCloseEventModal}
        />
      )}
    </>
  );
}
