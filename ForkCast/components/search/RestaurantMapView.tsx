// components/search/RestaurantMapView.tsx
import React, { useMemo, RefObject } from "react";
import { View } from "react-native";
import MapView, {
  Marker,
  Callout,
  Region,
  PROVIDER_GOOGLE,
  Circle,
} from "react-native-maps";
import { Star, MapPin } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { getDisplayCuisine } from "@/lib/cuisineUtils";
import { Image } from "@/components/image";
import { useLocationWithDistance } from "@/hooks/useLocationWithDistance";

type Restaurant = {
  id: string;
  name: string;
  cuisine_type: string;
  main_image_url: string | null;
  price_range: number;
  average_rating?: number;
  coordinates?: { latitude: number; longitude: number } | null;
  staticCoordinates?: { lat: number; lng: number };
  distance?: number | null;
};

interface RestaurantMapViewProps {
  restaurants: Restaurant[];
  mapRegion: Region;
  mapRef?: RefObject<MapView>;
  onRegionChangeComplete: (region: Region) => void;
  onRestaurantPress: (restaurantId: string) => void;
}

export const RestaurantMapView = React.memo(
  ({
    restaurants,
    mapRegion,
    mapRef,
    onRegionChangeComplete,
    onRestaurantPress,
  }: RestaurantMapViewProps) => {
    const { location: userLocation } = useLocationWithDistance();

    // Memoize markers to prevent recreation on every render
    const markers = useMemo(() => {
      return restaurants
        .map((restaurant) => {
          const coords: any =
            restaurant.staticCoordinates || restaurant.coordinates;
          if (!coords) return null;

          const coordinate = {
            latitude: coords.lat || coords.latitude,
            longitude: coords.lng || coords.longitude,
          };

          return (
            <Marker
              key={`marker-${restaurant.id}`}
              coordinate={coordinate}
              title={restaurant.name}
              description={getDisplayCuisine(
                restaurant.cuisine_type,
                (restaurant as any).secondary_cuisines,
                "",
              )}
              onPress={() => onRestaurantPress(restaurant.id)}
            >
              {/* Custom marker with restaurant image */}
              <View className="items-center">
                <View className="bg-white rounded-full p-1 border-2 border-gray-200">
                  <Image
                    source={{ uri: restaurant.main_image_url }}
                    className="w-12 h-12 rounded-full"
                    contentFit="cover"
                    optimizationPreset="thumbnail"
                  />
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
                    borderTopColor: "white",
                    marginTop: -1,
                  }}
                />
              </View>

              <Callout tooltip onPress={() => onRestaurantPress(restaurant.id)}>
                <View className="bg-white p-3 rounded-lg border border-gray-200 w-48">
                  <Text className="font-semibold text-black">
                    {restaurant.name}
                  </Text>
                  <Text className="text-sm text-gray-600 mb-2">
                    {getDisplayCuisine(
                      restaurant.cuisine_type,
                      (restaurant as any).secondary_cuisines,
                      "",
                    )}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    {(restaurant.average_rating || 0) > 0 && (
                      <View className="flex-row items-center gap-1">
                        <Star size={12} color="#f59e0b" fill="#f59e0b" />
                        <Text className="text-xs text-black">
                          {restaurant.average_rating?.toFixed(1)}
                        </Text>
                      </View>
                    )}
                    <Text className="text-xs text-black">
                      {"$".repeat(restaurant.price_range)}
                    </Text>
                    {restaurant.distance && (
                      <Text className="text-xs text-gray-500">
                        {restaurant.distance < 1
                          ? `${(restaurant.distance * 1000).toFixed(0)}m`
                          : `${restaurant.distance.toFixed(1)}km`}
                      </Text>
                    )}
                  </View>
                  <Text className="text-xs text-blue-600 mt-2 font-medium">
                    Tap for details
                  </Text>
                </View>
              </Callout>
            </Marker>
          );
        })
        .filter(Boolean);
    }, [restaurants, onRestaurantPress]);

    // User location marker
    const userLocationMarker = useMemo(() => {
      if (!userLocation) return null;

      return (
        <Marker
          key="user-location"
          coordinate={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          }}
          title="Your Location"
          pinColor="blue"
        >
          <View className="items-center">
            <View className="bg-blue-500 rounded-full p-2 border-2 border-blue-600">
              <MapPin size={16} color="white" />
            </View>
          </View>
        </Marker>
      );
    }, [userLocation]);

    // Optional: Add a circle to show search radius if distance filter is active
    const searchRadiusCircle = useMemo(() => {
      // You can add this if you want to show the search radius
      // For now, we'll keep it simple
      return null;
    }, [userLocation]);

    return (
      <View className="flex-1">
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          region={mapRegion}
          onRegionChangeComplete={onRegionChangeComplete}
          showsUserLocation={false} // We'll use our custom marker instead
          showsMyLocationButton={true}
          moveOnMarkerPress={false}
          showsCompass={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {/* User location marker */}
          {userLocationMarker}

          {/* Restaurant markers */}
          {markers}

          {/* Search radius circle (if needed) */}
          {searchRadiusCircle}
        </MapView>

        {/* Map overlay with location info */}
        {userLocation && (
          <View className="absolute top-4 left-4 right-4">
            <View className="bg-background/90 rounded-lg p-3 border border-border">
              <Text className="text-sm font-medium">
                Showing restaurants near {userLocation.district}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {restaurants.length} restaurants found
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  },
);
