// app/(protected)/location-selector.tsx - Updated to use new location system
import React, { useState } from "react";
import { View, FlatList, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Check, MapPin, Locate } from "lucide-react-native";
import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { useLocationWithDistance } from "@/hooks/useLocationWithDistance";
import { LocationService, LocationData } from "@/lib/locationService";
import { OptimizedList } from "@/components/ui/optimized-list";
import { useColorScheme } from "@/lib/useColorScheme";

const LEBANESE_LOCATIONS = [
  {
    city: "Beirut",
    districts: [
      { name: "Achrafieh", lat: 33.8886, lng: 35.5131 },
      { name: "Hamra", lat: 33.8992, lng: 35.4851 },
      { name: "Downtown", lat: 33.8938, lng: 35.5018 },
      { name: "Mar Mikhael", lat: 33.8943, lng: 35.5156 },
      { name: "Gemmayzeh", lat: 33.8956, lng: 35.5141 },
      { name: "Verdun", lat: 33.8689, lng: 35.4851 },
      { name: "Ras Beirut", lat: 33.9006, lng: 35.4815 },
      { name: "Badaro", lat: 33.8792, lng: 35.5156 },
      { name: "Sodeco", lat: 33.8831, lng: 35.5131 },
      { name: "Sassine", lat: 33.8886, lng: 35.5131 },
      { name: "Ain El Mreisseh", lat: 33.8975, lng: 35.4823 },
      { name: "Raouche", lat: 33.8912, lng: 35.4792 },
      { name: "Manara", lat: 33.8945, lng: 35.4781 },
      { name: "Mazraa", lat: 33.8856, lng: 35.4954 },
      { name: "Tarik Jdideh", lat: 33.8723, lng: 35.5089 },
    ],
  },
  {
    city: "Mount Lebanon",
    districts: [
      { name: "Jounieh", lat: 33.9806, lng: 35.6178 },
      { name: "Jbeil (Byblos)", lat: 34.1208, lng: 35.6478 },
      { name: "Baabda", lat: 33.8369, lng: 35.5442 },
      { name: "Aley", lat: 33.8067, lng: 35.5981 },
      { name: "Broummana", lat: 33.8831, lng: 35.6442 },
      { name: "Beit Mery", lat: 33.8531, lng: 35.6097 },
      { name: "Dbayeh", lat: 33.9497, lng: 35.6053 },
      { name: "Zalka", lat: 33.9264, lng: 35.5711 },
      { name: "Antelias", lat: 33.9289, lng: 35.5856 },
      { name: "Jal el Dib", lat: 33.9386, lng: 35.5958 },
      { name: "Kaslik", lat: 33.9706, lng: 35.6125 },
      { name: "Zouk Mosbeh", lat: 34.0017, lng: 35.6264 },
      { name: "Naccache", lat: 33.9181, lng: 35.5644 },
      { name: "Rabweh", lat: 33.8964, lng: 35.5794 },
      { name: "Bikfaya", lat: 33.9258, lng: 35.6736 },
    ],
  },
  {
    city: "North Lebanon",
    districts: [
      { name: "Tripoli", lat: 34.4332, lng: 35.8498 },
      { name: "Batroun", lat: 34.2553, lng: 35.6592 },
      { name: "Chekka", lat: 34.3006, lng: 35.7089 },
      { name: "Koura", lat: 34.3506, lng: 35.8256 },
      { name: "Zgharta", lat: 34.3983, lng: 35.9006 },
      { name: "Bcharre", lat: 34.2506, lng: 36.0131 },
      { name: "Amioun", lat: 34.3056, lng: 35.8131 },
      { name: "Kousba", lat: 34.2631, lng: 35.6478 },
      { name: "Anfeh", lat: 34.3356, lng: 35.7306 },
    ],
  },
  {
    city: "South Lebanon",
    districts: [
      { name: "Saida (Sidon)", lat: 33.5634, lng: 35.3711 },
      { name: "Tyre (Sour)", lat: 33.2704, lng: 35.2038 },
      { name: "Nabatieh", lat: 33.3789, lng: 35.4839 },
      { name: "Jezzine", lat: 33.5456, lng: 35.5789 },
      { name: "Marjayoun", lat: 33.3594, lng: 35.5931 },
      { name: "Bint Jbeil", lat: 33.1206, lng: 35.4294 },
    ],
  },
  {
    city: "Bekaa",
    districts: [
      { name: "Zahle", lat: 33.8469, lng: 35.9019 },
      { name: "Baalbek", lat: 34.0042, lng: 36.2075 },
      { name: "Chtaura", lat: 33.8206, lng: 35.8556 },
      { name: "Anjar", lat: 33.7306, lng: 35.9306 },
      { name: "Rayak", lat: 33.8456, lng: 35.9731 },
      { name: "Bar Elias", lat: 33.8081, lng: 35.9019 },
    ],
  },
];

interface LocationOption {
  name: string;
  lat: number;
  lng: number;
}

interface LocationGroup {
  city: string;
  districts: LocationOption[];
}

export default function LocationSelectorScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#fff' : '#374151';
  const {
    location: currentLocation,
    updateLocation,
    loading,
  } = useLocationWithDistance();
  const [updating, setUpdating] = useState(false);

  const handleSelectDistrict = async (
    city: string,
    district: LocationOption,
  ) => {
    if (updating) return;

    setUpdating(true);

    const newLocation: LocationData = {
      latitude: district.lat,
      longitude: district.lng,
      city,
      district: district.name,
      country: "Lebanon",
    };

    try {
      await updateLocation(newLocation);
      router.back();
    } catch (error) {
      console.error("Error updating location:", error);
      Alert.alert("Error", "Failed to update location");
    } finally {
      setUpdating(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    if (updating) return;

    setUpdating(true);

    try {
      const currentLoc = await LocationService.getCurrentLocation();
      await updateLocation(currentLoc);
      router.back();
    } catch (error) {
      console.error("Error getting current location:", error);
      Alert.alert("Error", "Failed to get current location");
    } finally {
      setUpdating(false);
    }
  };

  const isCurrentlySelected = (city: string, districtName: string) => {
    return (
      currentLocation?.city === city &&
      currentLocation?.district === districtName
    );
  };

  const renderLocationGroup = ({ item }: { item: LocationGroup }) => (
    <View className="mb-6">
      <Text className="font-semibold text-lg px-4 mb-3 text-muted-foreground">
        {item.city}
      </Text>
      {item.districts.map((district) => {
        const isSelected = isCurrentlySelected(item.city, district.name);

        return (
          <Pressable
            key={`${item.city}-${district.name}`}
            onPress={() => handleSelectDistrict(item.city, district)}
            disabled={updating}
            className={`flex-row items-center justify-between px-4 py-4 mx-4 mb-2 rounded-lg ${
              isSelected
                ? "bg-primary/10 border border-primary"
                : "bg-card border border-border"
            } ${updating ? "opacity-50" : ""}`}
          >
            <View className="flex-row items-center gap-3">
              <MapPin size={20} color={isSelected ? "#3b82f6" : "#666"} />
              <View>
                <Text
                  className={`font-medium ${isSelected ? "text-primary" : ""}`}
                >
                  {district.name}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {item.city}
                </Text>
              </View>
            </View>
            {isSelected && <Check size={20} color="#3b82f6" />}
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-4 py-4 border-b border-border">
        <H2>Choose Your Location</H2>
        <Text className="text-sm text-muted-foreground mt-1">
          Select your area to find nearby restaurants
        </Text>
      </View>

      {/* Current Location Button */}
      <View className="p-4 border-b border-border">
        <Button
          onPress={handleUseCurrentLocation}
          variant="outline"
          className="flex-row items-center justify-center gap-2"
          disabled={loading || updating}
        >
          <Locate size={20} color={iconColor} />
          <Text>{updating ? "Updating..." : "Use Current Location"}</Text>
        </Button>
      </View>

      {/* Current Selection Display */}
      {currentLocation && (
        <View className="px-4 py-3 bg-muted/30">
          <Text className="text-sm text-muted-foreground">
            Current location:
          </Text>
          <Text className="font-medium">
            {LocationService.getLocationDisplayName(currentLocation)}
          </Text>
        </View>
      )}

      <OptimizedList
        data={LEBANESE_LOCATIONS}
        renderItem={renderLocationGroup}
        keyExtractor={(item) => item.city}
        contentContainerStyle={{ paddingVertical: 16 }}
      />
    </SafeAreaView>
  );
}
