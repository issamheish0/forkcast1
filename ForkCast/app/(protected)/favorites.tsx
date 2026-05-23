import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useSharedValue, withTiming } from "react-native-reanimated";

import { SafeAreaView } from "@/components/safe-area-view";
import { H2, Muted } from "@/components/ui/typography";
import { FavoritesEmptyState } from "@/components/favorites";
import { FavoritesGridCard } from "@/components/favorites/FavoritesGridCard";
import FavoritesScreenSkeleton from "@/components/skeletons/FavoritesScreenSkeleton";
import { useFavorites, type Favorite } from "@/hooks/useFavorites";

export default function FavoritesScreen() {
  const router = useRouter();
  const { favoritesList, toggleFavorite, isLoading, refresh } = useFavorites();

  // Refresh favorites when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fadeAnim = useSharedValue(1);
  const scaleAnim = useSharedValue(1);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleDiscover = useCallback(() => {
    router.push("/search");
  }, [router]);

  const handleRestaurantPress = useCallback(
    (restaurantId: string) => {
      router.push({
        pathname: "/restaurant/[id]",
        params: { id: restaurantId },
      });
    },
    [router],
  );

  const triggerRemoveAnimation = useCallback((favoriteId: string) => {
    setRemovingId(favoriteId);
    fadeAnim.value = withTiming(0, { duration: 180 });
    scaleAnim.value = withTiming(0.92, { duration: 180 });

    setTimeout(() => {
      fadeAnim.value = 1;
      scaleAnim.value = 1;
      setRemovingId(null);
    }, 220);
  }, [fadeAnim, scaleAnim]);

  const handleUnlike = useCallback(
    (favoriteId: string, restaurantName: string) => {
      Alert.alert(
        "Remove Favorite",
        `Remove ${restaurantName} from your favorites?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => {
              const item = favoritesList.find((fav) => fav.id === favoriteId);
              if (!item) return;
              triggerRemoveAnimation(favoriteId);
              toggleFavorite(item.restaurant_id);
            },
          },
        ],
      );
    },
    [favoritesList, toggleFavorite, triggerRemoveAnimation],
  );

  const handleLongPress = useCallback(
    (favoriteId: string, restaurantName: string) => {
      handleUnlike(favoriteId, restaurantName);
    },
    [handleUnlike],
  );

  const data = useMemo(() => favoritesList, [favoritesList]);

  if (isLoading) {
    return <FavoritesScreenSkeleton />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={handleBack}
            className="p-2 -ml-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={22} color="#6b7280" />
          </Pressable>
          <View className="flex-1 ml-2">
            <H2 className="text-2xl font-bold tracking-tight">
              Favorites
            </H2>
            <Muted className="text-sm mt-0.5">
              {data.length} saved restaurant{data.length === 1 ? "" : "s"}
            </Muted>
          </View>
        </View>
      </View>

      {data.length === 0 ? (
        <FavoritesEmptyState onDiscoverPress={handleDiscover} />
      ) : (
        <FlatList
          data={data}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
          renderItem={({ item }) => (
            <FavoritesGridCard
              item={item as Favorite}
              onPress={handleRestaurantPress}
              onLongPress={handleLongPress}
              onUnlike={handleUnlike}
              removingId={removingId}
              fadeAnim={fadeAnim}
              scaleAnim={scaleAnim}
            />
          )}
          ListFooterComponent={<View className="h-6" />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

FavoritesScreen.displayName = "FavoritesScreen";
