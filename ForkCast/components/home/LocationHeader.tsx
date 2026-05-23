import React from "react";
import { View, Pressable } from "react-native";
import { MapPin, ChevronRight } from "lucide-react-native";
import { H2 } from "@/components/ui/typography";
import { Text } from "@/components/ui/text";

interface LocationData {
  latitude?: number;
  longitude?: number;
  city: string;
  district: string;
}

interface LocationHeaderProps {
  userName?: string;
  location: LocationData | null;
  onLocationPress: () => void;
  getGreeting: () => string;
}

export function LocationHeader({
  userName,
  location,
  onLocationPress,
  getGreeting,
}: LocationHeaderProps) {
  return (
    <View className="px-4 pt-12 pb-4">
      {/* Commented out greeting as per original code */}
      {/* <H2>{getGreeting()}, {userName || "User"}!</H2> */}
      <Pressable
        onPress={onLocationPress}
        className="flex-row items-center gap-2 mt-2"
      >
        <MapPin size={16} color="#666" />
        <Text className="text-muted-foreground">
          {location?.district || "Unknown"}, {location?.city || "Unknown"}
        </Text>
        <ChevronRight size={16} color="#666" />
      </Pressable>
    </View>
  );
}
