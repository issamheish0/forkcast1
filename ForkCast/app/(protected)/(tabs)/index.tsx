// app/(protected)/(tabs)/index.tsx
import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  View,
  Image,
  Pressable,
  RefreshControl,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Dimensions,
  DeviceEventEmitter,
  Platform,
} from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";

import { useColorScheme } from "@/lib/useColorScheme";
import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";
import { RestaurantCard } from "@/components/restaurant/RestaurantCard";
import { RestaurantSearchCard } from "@/components/search/RestaurantSearchCard";
import { CuisineCategory } from "@/components/home/CuisineCategory";
import { SectionHeader } from "@/components/ui/section-header";
import { HomeHeader } from "@/components/home/HomeHeader";
import { BannerCarousel } from "@/components/home/BannerCarousel";
import { Button } from "@/components/ui/button";
import { getRefreshControlColor, getThemedColors } from "@/lib/utils";
import { supabase } from "@/config/supabase";
import {
  useHomeScreenLogic,
  RecommendedSection,
} from "@/hooks/useHomeScreenLogic";
import { useBanners } from "@/hooks/useBanners";
import { useCuisineCategories } from "@/hooks/useCuisineCategories";
import { useAuth } from "@/context/supabase-provider";
import { useGuestGuard } from "@/hooks/useGuestGuard";
import { useRestaurantStore } from "@/stores/index";
import { useRestaurantSearch } from "@/hooks/useRestaurantSearch";
import { useAnalytics } from "@/hooks/useAnalytics";

import { GuestPromptModal } from "@/components/guest/GuestPromptModal";
import HomeScreenSkeleton from "@/components/skeletons/HomeScreenSkeleton";

import { useOffers } from "@/hooks/useOffers";
import { useRestaurantOffers } from "@/hooks/useRestaurantOffers";
import { useRestaurantsWithOffers } from "@/hooks/useRestaurantsWithOffers";
import { useAvailableNowRestaurants } from "@/hooks/useAvailableNowRestaurants";


// --- Horizontal List Component with Analytics ---
const HorizontalRestaurantList = React.memo(function HorizontalRestaurantList({
  data,
  sectionKey,
  onPress,
  onFavoriteToggle,
  favorites,
  getItemLayout,
  trackClick,
  getOfferInfo,
}: {
  data: any[];
  sectionKey: string;
  onPress: (id: string) => void;
  onFavoriteToggle: (id: string) => void;
  favorites: Set<string>;
  getItemLayout: any;
  trackClick: any;
  getOfferInfo?: (
    restaurantId: string,
  ) => { hasActiveOffer: boolean; maxDiscount: number } | undefined;
}) {
  const horizontalPadding = 16;

  return (
    <FlatList
      horizontal
      scrollEnabled={true}
      data={data}
      renderItem={({ item, index }) => {
        const offerInfo = getOfferInfo?.(item.id);
        return (
          <RestaurantCard
            item={item}
            variant="featured"
            onPress={(id) => {
              if (sectionKey === "featured-restaurants" || item.featured) {
                trackClick("featured_restaurant", id, {
                  section: sectionKey,
                  position: index,
                  is_explicit_featured_list:
                    sectionKey === "featured-restaurants",
                });
              }
              onPress(id);
            }}
            onFavoritePress={() => onFavoriteToggle(item.id)}
            isFavorite={favorites.has(item.id)}
            showOfferBadge={true}
            hasActiveOffer={offerInfo?.hasActiveOffer ?? false}
            offerDiscount={offerInfo?.maxDiscount}
          />
        );
      }}
      keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: horizontalPadding }}
      maxToRenderPerBatch={2}
      initialNumToRender={2}
      windowSize={3}
      getItemLayout={getItemLayout}
      extraData={favorites}
    />
  );
});

export default function HomeScreen() {
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [contentOffset, setContentOffset] = useState<{ x: number; y: number } | undefined>(undefined);
  const [scrollLocked, setScrollLocked] = useState(false);
  const translateY = useSharedValue(0);
  const isAnimatingToTop = useRef(false);

  const scrollWrapperStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const snapAfterAnimation = useCallback(() => {
    setContentOffset(undefined);
    setScrollLocked(false);
    isAnimatingToTop.current = false;
  }, []);

  // Scroll to top when Home tab is pressed — Instagram style
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('scrollHomeToTop', () => {
      const currentY = scrollY.value;
      if (currentY <= 0 || isAnimatingToTop.current) return;

      isAnimatingToTop.current = true;
      setScrollLocked(true);

      // 1. Snap real scroll to top
      setContentOffset({ x: 0, y: 0 });

      // 2. Compensate visually: cap translateY so container never starts fully off-screen
      //    Header (z-index 50) covers the gap while it also animates open
      const screenH = Dimensions.get('window').height;
      const visualOffset = Math.min(currentY, screenH * 0.85);
      translateY.value = visualOffset;

      // 3. Animate translateY 0 and scrollY 0 in sync — content slides up naturally
      const duration = currentY < 600 ? 220 : currentY < 1500 ? 260 : 280;
      const easing = Easing.bezier(0.25, 0.1, 0.25, 1);

      translateY.value = withTiming(0, { duration, easing }, (finished) => {
        'worklet';
        if (finished) runOnJS(snapAfterAnimation)();
      });
      scrollY.value = withTiming(0, { duration, easing });
    });
    return () => sub.remove();
  }, [snapAfterAnimation]);

  // --- Guest & Auth Hooks ---
  const { isGuest, convertGuestToUser, profile, refreshProfile } = useAuth();
  const {
    showGuestPrompt,
    promptedFeature,
    runProtectedAction,
    handleClosePrompt,
    handleSignUpFromPrompt,
  } = useGuestGuard();

  const { trackImpression, trackClick } = useAnalytics();

  // --- Favorites Management from Zustand ---
  const { addToFavorites, removeFromFavorites, favorites } =
    useRestaurantStore();

  // --- Sync Favorites from Database ---
  // OPTIMIZATION: Only sync once per session, favorites are managed in Zustand
  const favoritesSynced = useRef(false);

  const syncFavorites = useCallback(async () => {
    if (!profile?.id || favoritesSynced.current) return;

    try {
      const { data, error } = await supabase
        .from("favorites")
        .select("restaurant_id")
        .eq("user_id", profile.id);

      if (error) throw error;

      // Sync to Zustand store - add missing favorites and remove stale ones
      const dbFavoriteIds = new Set(data?.map((f) => f.restaurant_id) || []);

      // Add favorites from DB that aren't in store
      dbFavoriteIds.forEach((id) => {
        if (!favorites.has(id)) {
          addToFavorites(id);
        }
      });

      // Remove favorites from store that aren't in DB
      favorites.forEach((id) => {
        if (!dbFavoriteIds.has(id)) {
          removeFromFavorites(id);
        }
      });

      favoritesSynced.current = true;
    } catch {
      // Ignore sync errors
    }
  }, [profile?.id, favorites, addToFavorites, removeFromFavorites]);

  const toggleFavorite = useCallback(
    async (restaurantId: string) => {
      if (!profile?.id) {
        return;
      }

      // Optimistic update - update UI immediately
      const currentIsFavorite = favorites.has(restaurantId);
      const newFavoriteState = !currentIsFavorite;

      // Update Zustand store immediately (optimistic update)
      if (newFavoriteState) {
        addToFavorites(restaurantId);
      } else {
        removeFromFavorites(restaurantId);
      }

      // Sync with backend in background with retry logic
      const syncFavorite = async (retryCount = 0): Promise<void> => {
        const maxRetries = 3;
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff

        try {
          if (newFavoriteState) {
            // Add to favorites
            const { error } = await supabase
              .from("favorites")
              .insert({
                user_id: profile.id,
                restaurant_id: restaurantId,
              })
              .select();

            // Handle duplicate insert gracefully (already favorited)
            if (error) {
              // If it's a duplicate/unique constraint error, that's fine - already favorited
              if (
                error.code === "23505" ||
                error.message?.includes("duplicate")
              ) {
                // Already favorited, no action needed
                return;
              }

              // For network errors, retry
              if (
                retryCount < maxRetries &&
                (error.message?.includes("network") ||
                  error.message?.includes("fetch") ||
                  error.code === "PGRST116")
              ) {
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
                return syncFavorite(retryCount + 1);
              }

              // Other errors - revert optimistic update
              throw error;
            }
          } else {
            // Remove from favorites
            const { error } = await supabase
              .from("favorites")
              .delete()
              .eq("user_id", profile.id)
              .eq("restaurant_id", restaurantId)
              .select();

            if (error) {
              // For network errors, retry
              if (
                retryCount < maxRetries &&
                (error.message?.includes("network") ||
                  error.message?.includes("fetch") ||
                  error.code === "PGRST116")
              ) {
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
                return syncFavorite(retryCount + 1);
              }

              // Other errors - revert optimistic update
              throw error;
            }
          }
        } catch (error: any) {
          // Revert optimistic update on final failure
          if (retryCount >= maxRetries) {
            // Revert the optimistic update
            if (newFavoriteState) {
              removeFromFavorites(restaurantId);
            } else {
              addToFavorites(restaurantId);
            }
          } else {
            // Retry
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            return syncFavorite(retryCount + 1);
          }
        }
      };

      // Run sync in background (don't await - fire and forget)
      syncFavorite().catch(() => {
        // Already handled in syncFavorite
      });
    },
    [profile?.id, favorites, addToFavorites, removeFromFavorites],
  );

  // --- Data & Logic Hooks ---
  const {
    featuredRestaurants,
    newRestaurants,
    topRatedRestaurants,
    trendingRestaurants,
    recentlyVisitedRestaurants,
    recommendedSections,
    barsRestaurants,
    nearbyRestaurants,
    fetchNearbyRestaurants,
    location,
    refreshing,
    loading,
    handleRefresh,
    handleLocationPress,
    handleRestaurantPress,
    handleCuisinePress,
    handleSearchPress,
    handleSearchWithParams,
    handleProfilePress,
  } = useHomeScreenLogic();

  const { banners, loading: bannersLoading } = useBanners();
  const {
    categories: cuisineCategories,
    loading: categoriesLoading,
    refreshCategories,
  } = useCuisineCategories();

  // --- Offers data for quick access ---
  const { getOfferStats } = useOffers();
  const offerStats = useMemo(() => getOfferStats(), [getOfferStats]);

  // --- Restaurant offers for badges ---
  const { getOfferInfo } = useRestaurantOffers();

  // --- Restaurants with offers for horizontal row ---
  const { restaurants: restaurantsWithOffers } = useRestaurantsWithOffers();

  // --- Available Now restaurants (instant-booking tables + floor plan + open now) ---
  const {
    restaurants: availableNowRestaurants,
    refresh: refreshAvailableNow,
  } = useAvailableNowRestaurants();

  // --- Performance Optimization: getItemLayout for FlatLists ---
  // Featured cards: width 288 + 16 margin = 304
  const getItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: 304,
      offset: 304 * index,
      index,
    }),
    [],
  );

  // --- Animation State (Optimized for lower-end devices) ---
  const scrollY = useSharedValue(0);
  const [totalHeaderHeight, setTotalHeaderHeight] = useState(180);
  const [collapsibleHeaderHeight, setCollapsibleHeaderHeight] = useState(0);
  const prevRefreshing = useRef(false);

  const effectiveCollapsibleHeight = Math.max(collapsibleHeaderHeight, 100);

  // Fix iOS RefreshControl gap: scroll to top after refresh completes
  useEffect(() => {
    if (prevRefreshing.current && !refreshing) {
      if (Platform.OS === 'ios') {
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        });
      }
    }
    prevRefreshing.current = refreshing;
  }, [refreshing]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isAnimatingToTop.current) {
        scrollY.value = event.nativeEvent.contentOffset.y;
      }
    },
    [scrollY],
  );

  // --- Protected Action Handlers ---
  const handleToggleFavorite = useCallback(
    (restaurantId: string) => {
      runProtectedAction(() => {
        toggleFavorite(restaurantId);
      }, "save your favorite restaurants");
    },
    [runProtectedAction, toggleFavorite],
  );

  const handleHomeSearchBarPress = useCallback(() => {
    router.push(`/search?focus=${Date.now()}`);
  }, [router]);

  // --- Enhanced Refresh Handler ---
  const handleRefreshWithCategories = useCallback(async () => {
    await Promise.all([
      handleRefresh(),
      refreshCategories(),
      refreshAvailableNow(),
    ]);
  }, [handleRefresh, refreshCategories, refreshAvailableNow]);

  // --- Effects ---
  // OPTIMIZATION: Sync favorites only once on mount
  useEffect(() => {
    syncFavorites();
  }, [syncFavorites]);

  // --- Loading State ---
  const isLoading = loading || bannersLoading || categoriesLoading;

  // --- Section-based Data Structure for FlatList (Performance Optimization) ---
  // This eliminates nested FlatLists and improves virtualization
  const sections = useMemo(() => {
    const data: { type: string; data?: any; key: string }[] = [];

    // Header spacer
    data.push({ type: "header-spacer", key: "header-spacer" });

    // Guest banner
    if (isGuest) {
      data.push({ type: "guest-banner", key: "guest-banner" });
    }

    // Cuisine categories
    data.push({
      type: "cuisine-categories",
      data: cuisineCategories,
      key: "cuisine-categories",
    });

    // Banners
    if (banners.length > 0) {
      data.push({ type: "banners", data: banners, key: "banners" });
    }

    // === ZONE: FOR YOU (personalized content) ===
    data.push({ type: "zone-divider", key: "zone-for-you" });


    // Featured restaurants
    if (featuredRestaurants.length > 0) {
      data.push({
        type: "section-header",
        data: {
          title: "Featured This Week",
          subtitle: "Hand-picked restaurants just for you",
          actionLabel: "View all",
          onAction: handleSearchPress,
        },
        key: "featured-header",
      });
      data.push({
        type: "horizontal-list",
        data: featuredRestaurants,
        key: "featured-restaurants",
      });
    }

    // // Recently visited restaurants (personal — keep in For You zone)
    // if (recentlyVisitedRestaurants.length > 0) {
    //   data.push({
    //     type: "section-header",
    //     data: {
    //       title: "Recently Visited",
    //       subtitle: "Places you've completed bookings at",
    //       actionLabel: "View all",
    //       onAction: () => router.push("/(protected)/(tabs)/bookings?tab=past"),
    //     },
    //     key: "recently-visited-header",
    //   });
    //   data.push({
    //     type: "horizontal-list",
    //     data: recentlyVisitedRestaurants,
    //     key: "recently-visited-restaurants",
    //   });
    // }

    // Special Offers section — personal value, keep in For You
    if (!isGuest && restaurantsWithOffers.length > 0) {
      data.push({
        type: "section-header",
        data: {
          title: "Special Offers",
          subtitle: "Save on your next reservation",
          actionLabel: "View All",
          onAction: () => {
            try {
              router.push("/offers");
            } catch {
              router.push({
                pathname: "/offers" as any,
              });
            }
          },
        },
        key: "special-offers-header",
      });
      data.push({
        type: "horizontal-list",
        data: restaurantsWithOffers,
        key: "special-offers-restaurants",
      });
    }

    // Recommended Sections (Based on User Favorites) — limited to top 2
    if (recommendedSections && recommendedSections.length > 0) {
      recommendedSections.slice(0, 2).forEach((section) => {
        const cuisineDisplayName =
          section.cuisine.charAt(0).toUpperCase() +
          section.cuisine.slice(1).toLowerCase();

        const title = section.title || `Top ${cuisineDisplayName} Picks`;
        const subtitle = section.subtitle || "Curated for your taste";
        const actionLabel = section.actionLabel || "View all";
        const onAction =
          section.onAction || (() => handleCuisinePress(section.cuisine));
        data.push({
          type: "section-header",
          data: {
            title,
            subtitle,
            actionLabel,
            onAction,
          },
          key: section.key
            ? `recommended-header-${section.key}`
            : `recommended-header-${section.cuisine}`,
        });

        data.push({
          type: "horizontal-list",
          data: section.restaurants,
          key: section.key
            ? `recommended-list-${section.key}`
            : `recommended-list-${section.cuisine}`,
        });
      });
    }

    // === ZONE: EXPLORE (discovery content) ===
    data.push({ type: "zone-divider", key: "zone-explore" });

    // New restaurants
    if (newRestaurants.length > 0) {
      data.push({
        type: "section-header",
        data: {
          title: "New on ForkCast", 
          subtitle: "Recently added restaurants",
          actionLabel: "View all",
          onAction: () => handleSearchWithParams({ sortBy: "newest" }),
        },
        key: "new-header",
      });
      data.push({
        type: "horizontal-list",
        data: newRestaurants,
        key: "new-restaurants",
      });
    }

    // Available Now — restaurants with a floor plan + instant-booking table, open within 30 min
    if (availableNowRestaurants.length > 0) {
      data.push({
        type: "section-header",
        data: {
          title: "Available Now",
          subtitle: "Available in the next 30 mins",
          actionLabel: "View all",
          onAction: () =>
            handleSearchWithParams({ bookingPolicy: "instant" }),
        },
        key: "available-now-header",
      });
      data.push({
        type: "horizontal-list",
        data: availableNowRestaurants,
        key: "available-now-restaurants",
      });
    }

    // Top rated restaurants
    if (topRatedRestaurants.length > 0) {
      data.push({
        type: "section-header",
        data: {
          title: "Top Rated",
          subtitle: "Highest rated by diners",
          actionLabel: "View All",
          onAction: () => handleSearchWithParams({ sortBy: "rating" }),
        },
        key: "top-rated-header",
      });
      data.push({
        type: "horizontal-list",
        data: topRatedRestaurants,
        key: "top-rated-restaurants",
      });
    }

    // Trending restaurants
    if (trendingRestaurants.length > 0) {
      data.push({
        type: "section-header",
        data: {
          title: "Trending Now",
          subtitle: "Most popular this week",
          actionLabel: "View All",
          onAction: () => handleSearchWithParams({ sortBy: "trending" }),
        },
        key: "trending-header",
      });
      data.push({
        type: "horizontal-list",
        data: trendingRestaurants,
        key: "trending-restaurants",
      });
    }

    // Bars section
    if (barsRestaurants.length > 0) {
      data.push({
        type: "section-header",
        data: {
          title: "Bars",
          subtitle: "Grab a drink at these spots",
          actionLabel: "View All",
          onAction: () => handleCuisinePress("bars"),
        },
        key: "bars-header",
      });
      data.push({
        type: "horizontal-list",
        data: barsRestaurants,
        key: "bars-restaurants",
      });
    }

    // Nearby restaurants header
    if (nearbyRestaurants.length > 0) {
      data.push({
        type: "section-header",
        data: {
          title: "Around You",
          onAction: handleSearchPress,
        },
        key: "nearby-header",
      });
      // Add each nearby restaurant as individual item for better virtualization
      nearbyRestaurants.forEach((restaurant, index) => {
        data.push({
          type: "nearby-restaurant",
          data: restaurant,
          key: `nearby-${restaurant.id}`,
        });
      });
    }

    // Bottom padding
    data.push({ type: "bottom-spacer", key: "bottom-spacer" });

    return data;
  }, [
    isGuest,
    cuisineCategories,
    banners,
    featuredRestaurants,
    newRestaurants,
    topRatedRestaurants,
    trendingRestaurants,
    recentlyVisitedRestaurants,
    barsRestaurants,
    nearbyRestaurants,
    recommendedSections,
    offerStats,
    restaurantsWithOffers,
    availableNowRestaurants,
    handleSearchPress,
    handleSearchWithParams,
    handleCuisinePress,
    router,
  ]);

  const renderSectionItem = useCallback(
    ({ item }: { item: any }) => {
      switch (item.type) {
        case "header-spacer":
          return <View style={{ height: totalHeaderHeight }} />;

        case "zone-divider":
          return <View className="my-1 mx-6 h-px bg-border/50" />;

        case "guest-banner":
          return (
            <View className="mx-4 my-4 bg-secondary/60 dark:bg-secondary/15 rounded-2xl p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="font-bold text-foreground">
                    Welcome to ForkCast
                  </Text>
                  <Text className="text-sm text-muted-foreground mt-0.5">
                    Create an account to book tables, earn rewards, and save
                    your favorites.
                  </Text>
                </View>
                <Button size="sm" onPress={convertGuestToUser} className="ml-4">
                  <Text className="text-white text-xs font-bold">Sign Up</Text>
                </Button>
              </View>
            </View>
          );

        case "cuisine-categories":
          return (
            <View className="mb-6 ">
              <FlatList
                horizontal
                data={item.data}
                renderItem={({ item: cuisine }) => (
                  <CuisineCategory
                    cuisine={cuisine}
                    onPress={handleCuisinePress}
                  />
                )}
                keyExtractor={(cuisine) => cuisine.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                maxToRenderPerBatch={5}
                initialNumToRender={5}
                windowSize={3}
              />
            </View>
          );

        case "banners":
          return <BannerCarousel banners={item.data} />;

        case "section-header":
          return (
            <View className="mb-2">
              <SectionHeader {...item.data} />
            </View>
          );

        case "horizontal-list":
          return (
            <View className="mb-6">
              <HorizontalRestaurantList
                data={item.data}
                sectionKey={item.key}
                onPress={handleRestaurantPress}
                onFavoriteToggle={handleToggleFavorite}
                favorites={favorites}
                getItemLayout={getItemLayout}
                trackClick={trackClick}
                getOfferInfo={getOfferInfo}
              />
            </View>
          );

        case "nearby-restaurant":
          return (
            <View className="px-4">
              <RestaurantSearchCard
                item={item.data as any}
                bookingFilters={{
                  date: null,
                  time: null,
                  partySize: null,
                  availableOnly: false,
                }}
                onPress={() => handleRestaurantPress(item.data.id)}
                onToggleFavorite={async () =>
                  await handleToggleFavorite(item.data.id)
                }
                onDirections={async () => {}}
                favorites={favorites}
              />
            </View>
          );

        case "bottom-spacer":
          return <View className="h-24" />;

        default:
          return null;
      }
    },
    [
      totalHeaderHeight,
      convertGuestToUser,
      handleCuisinePress,
      router,
      colorScheme,
      handleRestaurantPress,
      handleToggleFavorite,
      favorites,
      getOfferInfo,
    ],
  );

  return (
    <View className="flex-1 bg-background" style={{ overflow: 'hidden' }}>
      {isLoading ? (
        <HomeScreenSkeleton headerHeight={totalHeaderHeight || 180} />
      ) : (
        <Animated.View style={[{ flex: 1 }, scrollWrapperStyle]}>
          <FlatList
            ref={flatListRef}
            contentOffset={contentOffset}
            data={sections}
            renderItem={renderSectionItem}
            keyExtractor={(item) => item.key}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            overScrollMode="never"
            bounces={true}
            alwaysBounceVertical={false}
            scrollEnabled={!refreshing && !scrollLocked}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefreshWithCategories}
              />
            }
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              // Load more nearby restaurants when user scrolls to the end
              if (nearbyRestaurants.length > 0) {
                fetchNearbyRestaurants(true);
              }
            }}
          />
        </Animated.View>
      )}

      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          elevation: 50,
          backgroundColor: "transparent",
          overflow: "visible",
        }}
      >
        <HomeHeader
          profile={profile}
          isGuest={isGuest}
          location={location as any}
          scrollY={scrollY}
          collapsibleHeaderHeight={effectiveCollapsibleHeight}
          refreshing={refreshing}
          setTotalHeaderHeight={setTotalHeaderHeight}
          setCollapsibleHeaderHeight={setCollapsibleHeaderHeight}
          onLocationPress={handleLocationPress}
          onProfilePress={isGuest ? convertGuestToUser : handleProfilePress}
          onSearchPress={handleHomeSearchBarPress}
        />
      </View>

      {/* Guest Prompt Modal */}
      <GuestPromptModal
        visible={showGuestPrompt}
        onClose={handleClosePrompt}
        onSignUp={handleSignUpFromPrompt}
        featureName={promptedFeature}
      />
    </View>
  );
}
