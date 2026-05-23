// components/search/SearchContent.tsx - Updated with scroll handling and analytics
import React, { useRef, Component, PropsWithChildren } from "react";
import {
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import MapView, {
  Region,
  Marker,
  PROVIDER_GOOGLE,
} from "react-native-maps";

import { Restaurant, BookingFilters, ViewMode } from "@/types/search";
import { LocationService } from "@/lib/locationService";
import { RestaurantSearchCard } from "@/components/search/RestaurantSearchCard";
import { Text } from "@/components/ui/text";

import { Image } from "@/components/image";
import { Utensils } from "lucide-react-native";
import { getActivityIndicatorColor, getRefreshControlColor } from "@/lib/utils";
import { getDisplayCuisine } from "@/lib/cuisineUtils";
import { useAnalytics } from "@/hooks/useAnalytics";

// Lightweight error boundary that catches MapView native crashes
class MapErrorBoundary extends Component<PropsWithChildren<{}>, { crashed: boolean }> {
  constructor(props: PropsWithChildren<{}>) {
    super(props);
    this.state = { crashed: false };
  }
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  render() {
    if (this.state.crashed) {
      return (
        <View className="flex-1 justify-center items-center p-8">
          <Text className="text-lg font-semibold mb-2 text-center">Map unavailable</Text>
          <Text className="text-muted-foreground text-center">
            Switch to list view to browse restaurants.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

interface SearchContentProps {
  viewMode: ViewMode;
  restaurants: Restaurant[];
  favorites: Set<string>;
  loading: boolean;
  refreshing: boolean;
  bookingFilters: BookingFilters;
  colorScheme: "light" | "dark";
  mapRegion: Region;
  onToggleFavorite: (restaurantId: string) => Promise<void>;
  onDirections: (restaurant: Restaurant) => Promise<void>;
  onRestaurantPress: (restaurantId: string) => void;
  onRefresh: () => void;
  onClearFilters: () => void;
  onMapRegionChange: (region: Region) => void;
  onScroll?: (event: any) => void; // New prop for scroll handling
}

export const SearchContent = ({
  viewMode,
  restaurants,
  favorites,
  loading,
  refreshing,
  bookingFilters,
  colorScheme,
  mapRegion,
  onToggleFavorite,
  onDirections,
  onRestaurantPress,
  onRefresh,
  onClearFilters,
  onMapRegionChange,
  onScroll,
}: SearchContentProps) => {
  const { trackClick } = useAnalytics();

  // Loading state
  if (loading && restaurants.length === 0) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator
          size="large"
          color={getActivityIndicatorColor(colorScheme)}
        />
        <Text className="mt-4 text-muted-foreground">
          Loading restaurants...
        </Text>
      </View>
    );
  }

  // Empty state
  if (!loading && restaurants.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-8">
        <Text className="text-lg font-semibold mb-2">No restaurants found</Text>
        <Text className="text-muted-foreground text-center mb-4">
          Try adjusting your search criteria or filters
        </Text>
      </View>
    );
  }

  // Map view
  if (viewMode === "map") {
    return (
      <MapErrorBoundary>
        <View className="flex-1">
          <MapView
            style={{ flex: 1 }}
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            region={mapRegion}
            onRegionChangeComplete={onMapRegionChange}
            showsUserLocation={true}
            showsMyLocationButton={true}
            mapType="standard"
          >
          {restaurants.map((restaurant) => {
            const r = restaurant as any;
            // Extract coords: prefer typed fields, then GeoJSON location, then Dubai default
            const locCoords = r.location
              ? LocationService.extractCoordinates(r.location)
              : null;
            const latitude =
              restaurant.coordinates?.latitude ||
              restaurant.staticCoordinates?.lat ||
              locCoords?.latitude ||
              25.2048; // Default Dubai latitude
            const longitude =
              restaurant.coordinates?.longitude ||
              restaurant.staticCoordinates?.lng ||
              locCoords?.longitude ||
              55.2708; // Default Dubai longitude

            return (
              <Marker
                key={restaurant.id}
                coordinate={{ latitude, longitude }}
                onPress={() => {
                  if (restaurant.featured) {
                    trackClick("featured_restaurant", restaurant.id, {
                      section: "map_view",
                      is_search_result: true,
                    });
                  }
                  onRestaurantPress(restaurant.id);
                }}
                title={restaurant.name}
                description={getDisplayCuisine(
                  restaurant.cuisine_type,
                  restaurant.secondary_cuisines,
                  "",
                )}
              >
                {/* Custom marker with restaurant image */}
                <View className="items-center">
                  <View className="bg-white rounded-full p-1 border-2 border-slate-200">
                    {restaurant.main_image_url ? (
                      <Image
                        source={{ uri: restaurant.main_image_url }}
                        className="w-12 h-12 rounded-full"
                        contentFit="cover"
                        optimizationPreset="thumbnail"
                      />
                    ) : (
                      <View className="w-12 h-12 rounded-full bg-primary items-center justify-center">
                        <Utensils size={20} color="white" />
                      </View>
                    )}
                  </View>
                  {/* Small triangle pointer */}
                  <View
                    style={{
                      width: 0,
                      height: 0,
                      backgroundColor: "transparent",
                      borderStyle: "solid",
                      borderLeftWidth: 6,
                      borderRightWidth: 6,
                      borderBottomWidth: 0,
                      borderTopWidth: 8,
                      borderLeftColor: "transparent",
                      borderRightColor: "transparent",
                      borderTopColor: "#ef4444", // Tailwind red-500
                      marginTop: -1,
                    }}
                  />
                </View>
              </Marker>
            );
          })}
        </MapView>
        </View>
      </MapErrorBoundary>
    );
  }

  // List view - OPTIMIZED with FlatList for better performance
  return (
    <FlatList
      data={restaurants}
      renderItem={({ item: restaurant, index }) => (
        <RestaurantSearchCard
          restaurant={restaurant}
          isFavorite={favorites.has(restaurant.id)}
          onPress={() => {
            if (restaurant.featured) {
              trackClick("featured_restaurant", restaurant.id, {
                section: "search_results_list",
                position: index,
                is_search_result: true,
              });
            }
            onRestaurantPress(restaurant.id);
          }}
          onToggleFavorite={() => onToggleFavorite(restaurant.id)}
          onOpenDirections={() => onDirections(restaurant)}
        />
      )}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={getRefreshControlColor(colorScheme)}
        />
      }
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{
        paddingTop: 4,
        paddingHorizontal: 16,
        paddingBottom: 120,
      }}
      // Performance optimizations
      maxToRenderPerBatch={10}
      initialNumToRender={6}
      windowSize={5}
      removeClippedSubviews={true}
      updateCellsBatchingPeriod={50}
    />
  );
};
