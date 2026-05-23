import React from "react";
import { View, Pressable } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { MapPin, ChevronRight } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { Database } from "@/types/supabase";
import { useColorScheme } from "@/lib/useColorScheme";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

const MAP_HEIGHT = 200;

interface LocationSectionProps {
  restaurant: Restaurant;
  mapCoordinates: { latitude: number; longitude: number };
  mapRef: React.RefObject<MapView | null>;
  onDirectionsPress: () => void;
}

export const LocationSection = ({
  restaurant,
  mapCoordinates,
  mapRef,
  onDirectionsPress,
}: LocationSectionProps) => {
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#fff' : '#374151';
  return (
    <View className="px-4 mb-6">
      <H3 className="mb-3">Location</H3>
      <Pressable
        onPress={onDirectionsPress}
        className="bg-card rounded-lg overflow-hidden"
      >
        <MapView
          ref={mapRef}
          style={{ height: MAP_HEIGHT }}
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
            <View className="flex-row items-center gap-2">
              <MapPin size={20} color={iconColor} />
              <Text className="font-medium">Address</Text>
            </View>
            <Text className="text-muted-foreground mt-1">
              {restaurant.address}
            </Text>
          </View>
          <ChevronRight size={20} color="#666" />
        </View>
      </Pressable>
    </View>
  );
};
