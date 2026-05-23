import React from "react";
import { View, Pressable, Alert, Platform, Linking } from "react-native";
import { MapPin } from "lucide-react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { DirectionsButton } from "@/components/restaurant/DirectionsButton";

interface BookingMapSectionProps {
  restaurant: {
    id: string;
    name: string;
    address: string;
    location: any;
    staticCoordinates?: { lat: number; lng: number };
    coordinates?: { latitude: number; longitude: number };
  };
}

export const BookingMapSection: React.FC<BookingMapSectionProps> = ({
  restaurant,
}) => {
  // Extract coordinates from PostGIS geography type
  const extractLocationCoordinates = (location: any) => {
    if (!location) return null;

    if (typeof location === "string" && location.startsWith("POINT(")) {
      const coords = location.match(/POINT\(([^)]+)\)/);
      if (coords && coords[1]) {
        const [lng, lat] = coords[1].split(" ").map(Number);
        return { latitude: lat, longitude: lng };
      }
    }

    if (location.type === "Point" && Array.isArray(location.coordinates)) {
      const [lng, lat] = location.coordinates;
      return { latitude: lat, longitude: lng };
    }

    if (location.lat && location.lng) {
      return { latitude: location.lat, longitude: location.lng };
    }

    if (location.latitude && location.longitude) {
      return { latitude: location.latitude, longitude: location.longitude };
    }

    return null;
  };

  const mapCoordinates = extractLocationCoordinates(restaurant.location) || {
    latitude: 33.8938,
    longitude: 35.5018,
  };

  return (
    <View className="p-4 border-b border-border">
      <H3 className="mb-3">Location</H3>
      <View className="bg-card rounded-lg overflow-hidden border border-border">
        <MapView
          style={{ height: 200 }}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: mapCoordinates.latitude,
            longitude: mapCoordinates.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
        >
          <Marker
            coordinate={mapCoordinates}
            title={restaurant.name}
            description={restaurant.address}
          />
        </MapView>
        <View className="p-4 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="font-medium">{restaurant.address}</Text>
            <Text className="text-sm text-muted-foreground mt-1">
              Get directions
            </Text>
          </View>
          <DirectionsButton
            restaurant={restaurant}
            variant="icon"
            size="md"
            backgroundColor="bg-primary/10"
            iconColor="#3b82f6"
            className="p-2"
          />
        </View>
      </View>
    </View>
  );
};
