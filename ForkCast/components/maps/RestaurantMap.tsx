// components/ui/restaurant-map.tsx - Fixed flickering and marker issues
import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import { View, Platform, StyleSheet, Dimensions } from "react-native";
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
  Region,
  Callout,
} from "react-native-maps";
import { LocationService } from "@/lib/locationService";
import { Text } from "@/components/ui/text";
import { Image } from "@/components/image";
import { MapPin, Star, Navigation2, Utensils } from "lucide-react-native";
import { useColorScheme } from "@/lib/useColorScheme";
import { getDisplayCuisine } from "@/lib/cuisineUtils";

interface Restaurant {
  id: string;
  name: string;
  cuisine_type: string;
  main_image_url?: string;
  average_rating?: number;
  location?: any;
  distance?: number | null;
  coordinates?: { latitude: number; longitude: number } | null;
  staticCoordinates?: { lat: number; lng: number };
  price_range?: number;
}

interface RestaurantMapProps {
  restaurants: Restaurant[];
  userLocation?: { latitude: number; longitude: number } | null;
  onRestaurantPress?: (restaurantId: string) => void;
  style?: any;
  showUserLocation?: boolean;
  initialRegion?: Region;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Dark mode map style
const darkMapStyle = [
  {
    elementType: "geometry",
    stylers: [{ color: "#242f3e" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#746855" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#242f3e" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];

// Memoized Restaurant Marker Component to prevent flickering
const RestaurantMarker = React.memo(
  ({
    restaurant,
    onPress,
  }: {
    restaurant: Restaurant;
    onPress: (id: string) => void;
  }) => {
    let coords = restaurant.coordinates;

    // Try staticCoordinates if coordinates is not available
    if (!coords && restaurant.staticCoordinates) {
      coords = {
        latitude: restaurant.staticCoordinates.lat,
        longitude: restaurant.staticCoordinates.lng,
      };
    }

    // Try extracting from location field if still no coordinates
    if (!coords && restaurant.location) {
      coords = LocationService.extractCoordinates(restaurant.location);
    }

    if (!coords) {
      return null;
    }

    const handlePress = useCallback(() => {
      onPress(restaurant.id);
    }, [restaurant.id, onPress]);

    return (
      <Marker
        coordinate={coords}
        onPress={handlePress}
        anchor={{ x: 0.5, y: 1 }} // Fixed anchor point - center bottom
        centerOffset={{ x: 0, y: -30 }} // Offset to position properly
      >
        {/* Restaurant Image Marker - Fixed container */}
        <View style={styles.markerWrapper}>
          <View style={styles.imageMarkerContainer}>
            <View style={styles.imageMarkerBorder}>
              {restaurant.main_image_url ? (
                <Image
                  {...({
                    source: { uri: restaurant.main_image_url },
                    optimizationPreset: "thumbnail",
                    style: styles.restaurantImage,
                    contentFit: "cover",
                    cachePolicy: "memory-disk",
                  } as any)}
                />
              ) : (
                <View
                  style={[
                    styles.restaurantImage,
                    styles.fallbackImageBackground,
                  ]}
                >
                  <Utensils size={20} color="white" />
                </View>
              )}
            </View>
          </View>
          <View style={styles.imageMarkerTriangle} />
        </View>

        {/* Enhanced Callout */}
        <Callout tooltip>
          <View style={styles.calloutContainer}>
            <View style={styles.calloutContent}>
              <View style={styles.calloutHeader}>
                <Text
                  className="font-bold text-base text-black"
                  numberOfLines={1}
                >
                  {restaurant.name}
                </Text>
                {restaurant.average_rating && (
                  <View className="flex-row items-center gap-1">
                    <Star size={14} fill="#fbbf24" color="#fbbf24" />
                    <Text className="text-sm font-semibold text-black">
                      {restaurant.average_rating.toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>

              <Text className="text-sm text-gray-600 mb-2" numberOfLines={1}>
                {getDisplayCuisine(
                  restaurant.cuisine_type,
                  (restaurant as any).secondary_cuisines,
                  "",
                )}
              </Text>

              <View className="flex-row items-center justify-between">
                {restaurant.price_range && (
                  <Text className="text-sm font-medium text-black">
                    {"$".repeat(restaurant.price_range)}
                  </Text>
                )}

                {restaurant.distance !== undefined &&
                  restaurant.distance !== null && (
                    <Text className="text-sm text-blue-600 font-medium">
                      {LocationService.formatDistance(restaurant.distance)}
                    </Text>
                  )}
              </View>

              <Text className="text-xs text-blue-600 mt-3 font-medium text-center">
                Tap for details →
              </Text>
            </View>
            <View style={styles.calloutArrow} />
          </View>
        </Callout>
      </Marker>
    );
  },
);

RestaurantMarker.displayName = "RestaurantMarker";

// Memoized User Location Marker
const UserLocationMarker = React.memo(
  ({
    userLocation,
  }: {
    userLocation: { latitude: number; longitude: number };
  }) => {
    return (
      <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
        <View style={styles.userMarkerContainer}>
          <View style={styles.userMarkerOuter}>
            <View style={styles.userMarkerInner}>
              <Navigation2 size={16} color="white" fill="white" />
            </View>
          </View>
        </View>
      </Marker>
    );
  },
);

UserLocationMarker.displayName = "UserLocationMarker";

export function RestaurantMap({
  restaurants,
  userLocation,
  onRestaurantPress,
  style,
  showUserLocation = true,
  initialRegion,
}: RestaurantMapProps) {
  const mapRef = useRef<MapView>(null);
  const { colorScheme } = useColorScheme();
  const [mapReady, setMapReady] = useState(false);

  // Memoize the restaurant press handler to prevent recreating on every render
  const handleRestaurantPress = useCallback(
    (restaurantId: string) => {
      onRestaurantPress?.(restaurantId);
    },
    [onRestaurantPress],
  );

  // Determine provider based on platform
  const provider: any = Platform.select({
    ios: PROVIDER_DEFAULT,
    android: PROVIDER_GOOGLE,
    default: PROVIDER_DEFAULT,
  });

  // Memoize the default region to prevent changes
  const defaultRegion: Region = useMemo(
    () =>
      initialRegion || {
        latitude: userLocation?.latitude || 33.8938,
        longitude: userLocation?.longitude || 35.5018,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
    [initialRegion, userLocation?.latitude, userLocation?.longitude],
  );

  // Memoize restaurant markers with stable keys to prevent flickering
  const restaurantMarkers = useMemo(() => {
    return restaurants
      .map((restaurant) => {
        // Check if restaurant has valid coordinates
        let coords = restaurant.coordinates;

        if (!coords && restaurant.staticCoordinates) {
          coords = {
            latitude: restaurant.staticCoordinates.lat,
            longitude: restaurant.staticCoordinates.lng,
          };
        }

        if (!coords && restaurant.location) {
          coords = LocationService.extractCoordinates(restaurant.location);
        }

        if (!coords) {
          return null;
        }

        return (
          <RestaurantMarker
            key={`restaurant-${restaurant.id}`} // Stable key
            restaurant={restaurant}
            onPress={handleRestaurantPress}
          />
        );
      })
      .filter(Boolean);
  }, [restaurants, handleRestaurantPress]);

  // Memoize user location marker
  const userLocationMarker = useMemo(() => {
    if (!userLocation || !showUserLocation) {
      return null;
    }

    return (
      <UserLocationMarker key="user-location" userLocation={userLocation} />
    );
  }, [userLocation, showUserLocation]);

  // Fit map to coordinates when ready (only once)
  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }

    const coordinates: { latitude: number; longitude: number }[] = [];

    // Add restaurant coordinates
    restaurants.forEach((restaurant) => {
      let coords = restaurant.coordinates;

      if (!coords && restaurant.staticCoordinates) {
        coords = {
          latitude: restaurant.staticCoordinates.lat,
          longitude: restaurant.staticCoordinates.lng,
        };
      }

      if (!coords && restaurant.location) {
        coords = LocationService.extractCoordinates(restaurant.location);
      }

      if (coords) {
        coordinates.push(coords);
      }
    });

    // Add user location if available
    if (userLocation && showUserLocation) {
      coordinates.push(userLocation);
    }

    // Fit to coordinates if we have multiple points
    if (coordinates.length > 1) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
          animated: true,
        });
      }, 500); // Increased delay to ensure map is fully ready
    }
  }, [mapReady]); // Only depend on mapReady, not restaurants or userLocation

  const validMarkerCount = restaurantMarkers.length;

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={provider}
        initialRegion={defaultRegion}
        showsUserLocation={false}
        showsMyLocationButton={showUserLocation}
        showsCompass={true}
        customMapStyle={colorScheme === "dark" ? darkMapStyle : undefined}
        onMapReady={() => {
          setMapReady(true);
        }}
        // Performance optimizations
        loadingEnabled={true}
        loadingIndicatorColor={colorScheme === "dark" ? "#fff" : "#000"}
        moveOnMarkerPress={false}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
      >
        {restaurantMarkers}
        {userLocationMarker}
      </MapView>

      {/* Map overlay with restaurant count */}
      {userLocation && validMarkerCount > 0 && (
        <View style={styles.overlayContainer}>
          <View
            style={[
              styles.overlay,
              {
                backgroundColor:
                  colorScheme === "dark"
                    ? "rgba(0,0,0,0.8)"
                    : "rgba(255,255,255,0.9)",
              },
            ]}
          >
            <Text
              className={`text-sm font-medium ${colorScheme === "dark" ? "text-white" : "text-black"}`}
            >
              Tap markers for details
            </Text>
            <Text
              className={`text-xs ${colorScheme === "dark" ? "text-gray-300" : "text-gray-600"}`}
            >
              View restaurant information
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },

  // Fixed marker wrapper to prevent half-circle issue
  markerWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },

  // Image marker styles - Fixed dimensions and positioning
  imageMarkerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  imageMarkerBorder: {
    width: 50, // Reduced size for better performance
    height: 50,
    borderRadius: 25,
    backgroundColor: "white",
    padding: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  restaurantImage: {
    width: 46, // Slightly smaller than container
    height: 46,
    borderRadius: 23,
    overflow: "hidden", // Ensure image stays within circle
  },
  fallbackImageBackground: {
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  imageMarkerTriangle: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "white",
    marginTop: -1,
  },

  // User location marker styles
  userMarkerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  userMarkerOuter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  userMarkerInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },

  // Enhanced callout styles
  calloutContainer: {
    alignItems: "center",
  },
  calloutContent: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    minWidth: 220,
    maxWidth: 280,
  },
  calloutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  calloutArrow: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "white",
    marginTop: -2,
  },

  // Overlay styles
  overlayContainer: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
  },
  overlay: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
});
