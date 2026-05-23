// components/search/LocationDisplay.tsx - Updated to use LocationSelector
import React from "react";
import { View, Pressable } from "react-native";
import { MapPin, ChevronDown } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useLocationWithDistance } from "@/hooks/useLocationWithDistance";
import { LocationService } from "@/lib/locationService";
import { LocationSelector } from "../location/LocationSelector";

interface LocationDisplayProps {
  showChangeButton?: boolean;
  className?: string;
}

export const LocationDisplay: React.FC<LocationDisplayProps> = ({
  showChangeButton = true,
  className = "",
}) => {
  const { location, updateLocation, loading } = useLocationWithDistance();

  if (loading) {
    return (
      <View className={`flex-row items-center gap-2 ${className}`}>
        <MapPin size={16} color="#666" />
        <Text className="text-sm text-muted-foreground">
          Loading location...
        </Text>
      </View>
    );
  }

  const displayName = location
    ? LocationService.getLocationDisplayName(location)
    : "Select location";

  if (!showChangeButton) {
    return (
      <View className={`flex-row items-center gap-2 ${className}`}>
        <MapPin size={16} color="#666" />
        <Text
          className={`text-sm font-medium ${location ? "text-foreground" : "text-muted-foreground"}`}
          numberOfLines={1}
        >
          {displayName}
        </Text>
      </View>
    );
  }

  return (
    <LocationSelector
      currentLocation={location}
      onLocationChange={updateLocation}
      triggerComponent={
        <View className={`flex-row items-center gap-2 ${className}`}>
          <MapPin size={16} color="#666" />
          <Text
            className={`text-sm font-medium ${location ? "text-foreground" : "text-muted-foreground"}`}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <ChevronDown size={14} color="#666" />
        </View>
      }
    />
  );
};
