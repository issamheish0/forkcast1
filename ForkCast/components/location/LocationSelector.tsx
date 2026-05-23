// components/ui/location-selector.tsx - Integrated with location system
import React, { useState, useCallback } from "react";
import {
  View,
  Modal,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  MapPin,
  Search,
  X,
  Navigation,
  ChevronRight,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { H3 } from "@/components/ui/typography";
import { LocationService, LocationData } from "@/lib/locationService";
import { useColorScheme } from "@/lib/useColorScheme";
import * as Haptics from "expo-haptics";
import { OptimizedList } from "../ui/optimized-list";

interface LocationOption {
  id: string;
  city: string;
  district: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

const LEBANON_LOCATIONS: LocationOption[] = [
  // Beirut Districts
  {
    id: "beirut-central",
    city: "Beirut",
    district: "Central District",
    coordinates: { latitude: 33.8938, longitude: 35.5018 },
  },
  {
    id: "beirut-hamra",
    city: "Beirut",
    district: "Hamra",
    coordinates: { latitude: 33.8959, longitude: 35.4797 },
  },
  {
    id: "beirut-achrafieh",
    city: "Beirut",
    district: "Achrafieh",
    coordinates: { latitude: 33.8854, longitude: 35.5209 },
  },
  {
    id: "beirut-gemmayzeh",
    city: "Beirut",
    district: "Gemmayzeh",
    coordinates: { latitude: 33.8958, longitude: 35.5144 },
  },
  {
    id: "beirut-mar-mikhael",
    city: "Beirut",
    district: "Mar Mikhael",
    coordinates: { latitude: 33.8969, longitude: 35.5262 },
  },
  {
    id: "beirut-verdun",
    city: "Beirut",
    district: "Verdun",
    coordinates: { latitude: 33.8791, longitude: 35.4834 },
  },
  {
    id: "beirut-ras-beirut",
    city: "Beirut",
    district: "Ras Beirut",
    coordinates: { latitude: 33.9006, longitude: 35.4815 },
  },
  {
    id: "beirut-badaro",
    city: "Beirut",
    district: "Badaro",
    coordinates: { latitude: 33.8792, longitude: 35.5156 },
  },
  {
    id: "beirut-sodeco",
    city: "Beirut",
    district: "Sodeco",
    coordinates: { latitude: 33.8831, longitude: 35.5131 },
  },
  {
    id: "beirut-raouche",
    city: "Beirut",
    district: "Raouche",
    coordinates: { latitude: 33.8912, longitude: 35.4792 },
  },
  // Mount Lebanon
  {
    id: "jounieh",
    city: "Jounieh",
    district: "Keserwan",
    coordinates: { latitude: 33.9806, longitude: 35.6178 },
  },
  {
    id: "dbayeh",
    city: "Dbayeh",
    district: "Metn",
    coordinates: { latitude: 33.9481, longitude: 35.5872 },
  },
  {
    id: "antelias",
    city: "Antelias",
    district: "Metn",
    coordinates: { latitude: 33.9139, longitude: 35.5858 },
  },
  {
    id: "zalka",
    city: "Zalka",
    district: "Metn",
    coordinates: { latitude: 33.9264, longitude: 35.5711 },
  },
  {
    id: "jal-el-dib",
    city: "Jal el Dib",
    district: "Metn",
    coordinates: { latitude: 33.9386, longitude: 35.5958 },
  },
  {
    id: "baabda",
    city: "Baabda",
    district: "Baabda",
    coordinates: { latitude: 33.8339, longitude: 35.5442 },
  },
  {
    id: "aley",
    city: "Aley",
    district: "Aley",
    coordinates: { latitude: 33.8106, longitude: 35.5992 },
  },
  {
    id: "broummana",
    city: "Broummana",
    district: "Metn",
    coordinates: { latitude: 33.8831, longitude: 35.6442 },
  },
  {
    id: "beit-mery",
    city: "Beit Mery",
    district: "Metn",
    coordinates: { latitude: 33.8531, longitude: 35.6097 },
  },
  {
    id: "kaslik",
    city: "Kaslik",
    district: "Keserwan",
    coordinates: { latitude: 33.9706, longitude: 35.6125 },
  },
  // North Lebanon
  {
    id: "batroun",
    city: "Batroun",
    district: "Batroun",
    coordinates: { latitude: 34.2556, longitude: 35.6586 },
  },
  {
    id: "byblos",
    city: "Byblos",
    district: "Jbeil",
    coordinates: { latitude: 34.1224, longitude: 35.6487 },
  },
  {
    id: "tripoli",
    city: "Tripoli",
    district: "Tripoli",
    coordinates: { latitude: 34.4332, longitude: 35.8498 },
  },
  {
    id: "chekka",
    city: "Chekka",
    district: "Batroun",
    coordinates: { latitude: 34.3006, longitude: 35.7089 },
  },
  {
    id: "zgharta",
    city: "Zgharta",
    district: "Zgharta",
    coordinates: { latitude: 34.3983, longitude: 35.9006 },
  },
  // South Lebanon
  {
    id: "tyre",
    city: "Tyre",
    district: "Tyre",
    coordinates: { latitude: 33.2704, longitude: 35.2038 },
  },
  {
    id: "sidon",
    city: "Sidon",
    district: "Sidon",
    coordinates: { latitude: 33.5634, longitude: 35.3711 },
  },
  {
    id: "nabatieh",
    city: "Nabatieh",
    district: "Nabatieh",
    coordinates: { latitude: 33.3789, longitude: 35.4839 },
  },
  {
    id: "jezzine",
    city: "Jezzine",
    district: "Jezzine",
    coordinates: { latitude: 33.5456, longitude: 35.5789 },
  },
  // Bekaa
  {
    id: "zahle",
    city: "Zahle",
    district: "Zahle",
    coordinates: { latitude: 33.8463, longitude: 35.9019 },
  },
  {
    id: "baalbek",
    city: "Baalbek",
    district: "Baalbek",
    coordinates: { latitude: 34.0042, longitude: 36.2075 },
  },
  {
    id: "chtaura",
    city: "Chtaura",
    district: "Zahle",
    coordinates: { latitude: 33.8206, longitude: 35.8556 },
  },
];

interface LocationSelectorProps {
  currentLocation: LocationData | null;
  onLocationChange: (location: LocationData) => void;
  triggerComponent?: React.ReactNode;
}

export function LocationSelector({
  currentLocation,
  onLocationChange,
  triggerComponent,
}: LocationSelectorProps) {
  const { colorScheme } = useColorScheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [detectingLocation, setDetectingLocation] = useState(false);

  const filteredLocations = LEBANON_LOCATIONS.filter(
    (loc) =>
      loc.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.district.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleDetectLocation = useCallback(async () => {
    setDetectingLocation(true);
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const location = await LocationService.getCurrentLocation();
      onLocationChange(location);
      setModalVisible(false);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      }
    } catch (error) {
      console.error("Error detecting location:", error);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setDetectingLocation(false);
    }
  }, [onLocationChange]);

  const handleSelectLocation = useCallback(
    async (location: LocationOption) => {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const locationData: LocationData = {
        city: location.city,
        district: location.district,
        latitude: location.coordinates.latitude,
        longitude: location.coordinates.longitude,
        country: "Lebanon",
      };

      onLocationChange(locationData);
      setModalVisible(false);
    },
    [onLocationChange],
  );

  const isCurrentLocation = (location: LocationOption) => {
    if (!currentLocation) return false;

    // If current location is a GPS location (not from the predefined list),
    // don't highlight any predefined locations as current
    if (
      currentLocation.city === "Current Location" ||
      currentLocation.district === "GPS Location" ||
      currentLocation.city === "GPS Location" ||
      currentLocation.city === "Unknown Location" ||
      currentLocation.district === "Unknown Area"
    ) {
      return false;
    }

    // Only match if both city and district exactly match
    return (
      location.city === currentLocation.city &&
      location.district === currentLocation.district
    );
  };

  return (
    <>
      {triggerComponent ? (
        <Pressable onPress={() => setModalVisible(true)}>
          {triggerComponent}
        </Pressable>
      ) : (
        <Pressable
          onPress={() => setModalVisible(true)}
          className="flex-row items-center gap-2 px-3 py-2 bg-muted rounded-lg"
        >
          <MapPin size={16} color="#666" />
          <Text className="text-sm font-medium">
            {LocationService.getLocationDisplayName(currentLocation)}
          </Text>
          <ChevronRight size={16} color="#666" />
        </Pressable>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="flex-1 bg-background">
            {/* Header */}
            <View className="p-4 border-b border-border safe-area-top">
              <View className="flex-row items-center justify-between mb-4">
                <H3>Select Location</H3>
                <Pressable
                  onPress={() => setModalVisible(false)}
                  className="p-2"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X
                    size={24}
                    color={colorScheme === "dark" ? "#fff" : "#000"}
                  />
                </Pressable>
              </View>

              {/* Search Bar */}
              <View className="flex-row items-center gap-2 bg-muted rounded-lg px-3 py-2">
                <Search size={20} color="#666" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search location..."
                  className="flex-1 text-base text-foreground"
                  placeholderTextColor="#666"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery("")}>
                    <X size={18} color="#666" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Location List */}
            <OptimizedList
              data={filteredLocations}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 20 }}
              ListHeaderComponent={
                <Pressable
                  onPress={handleDetectLocation}
                  disabled={detectingLocation}
                  className={`flex-row items-center justify-between p-4 mx-4 mt-4 rounded-lg border ${
                    detectingLocation
                      ? "bg-primary/5 border-primary/10 opacity-50"
                      : currentLocation &&
                          (currentLocation.city === "Current Location" ||
                            currentLocation.district === "GPS Location" ||
                            currentLocation.city === "GPS Location" ||
                            currentLocation.city === "Unknown Location" ||
                            currentLocation.district === "Unknown Area")
                        ? "bg-primary/10 border-primary/20"
                        : "bg-primary/10 border-primary/20"
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className={`w-10 h-10 rounded-full items-center justify-center ${
                        currentLocation &&
                        (currentLocation.city === "Current Location" ||
                          currentLocation.district === "GPS Location" ||
                          currentLocation.city === "GPS Location" ||
                          currentLocation.city === "Unknown Location" ||
                          currentLocation.district === "Unknown Area")
                          ? "bg-primary/20"
                          : "bg-primary/20"
                      }`}
                    >
                      <Navigation size={20} color="#3b82f6" />
                    </View>
                    <View>
                      <Text className="font-semibold text-primary">
                        Use Current Location
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        {currentLocation
                          ? `Currently: ${LocationService.getLocationDisplayName(currentLocation)}`
                          : "Allow access to find restaurants near you"}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2">
                    {currentLocation &&
                      (currentLocation.city === "Current Location" ||
                        currentLocation.district === "GPS Location" ||
                        currentLocation.city === "GPS Location" ||
                        currentLocation.city === "Unknown Location" ||
                        currentLocation.district === "Unknown Area") && (
                        <View className="px-2 py-1 bg-primary/20 rounded">
                          <Text className="text-xs font-medium text-primary">
                            Current
                          </Text>
                        </View>
                      )}
                    {detectingLocation && (
                      <ActivityIndicator size="small" color="#3b82f6" />
                    )}
                  </View>
                </Pressable>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelectLocation(item)}
                  className={`flex-row items-center justify-between p-4 mx-4 mt-2 rounded-lg border ${
                    isCurrentLocation(item)
                      ? "bg-primary/10 border-primary/20"
                      : "bg-card border-border"
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className={`w-10 h-10 rounded-full items-center justify-center ${
                        isCurrentLocation(item) ? "bg-primary/20" : "bg-muted"
                      }`}
                    >
                      <MapPin
                        size={20}
                        color={isCurrentLocation(item) ? "#3b82f6" : "#666"}
                      />
                    </View>
                    <View>
                      <Text
                        className={`font-medium ${
                          isCurrentLocation(item) ? "text-primary" : ""
                        }`}
                      >
                        {item.city}
                      </Text>
                      <Text className="text-sm text-muted-foreground">
                        {item.district}
                      </Text>
                    </View>
                  </View>
                  {isCurrentLocation(item) && (
                    <View className="px-2 py-1 bg-primary/20 rounded">
                      <Text className="text-xs font-medium text-primary">
                        Current
                      </Text>
                    </View>
                  )}
                </Pressable>
              )}
              ListEmptyComponent={
                <View className="p-8 items-center">
                  <MapPin size={48} color="#666" />
                  <Text className="text-muted-foreground mt-2">
                    No locations found
                  </Text>
                </View>
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
