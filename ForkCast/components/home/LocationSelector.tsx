// components/home/LocationSelector.tsx
import React, { useState, useCallback } from "react";
import {
  View,
  Pressable,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { MapPin, Search, Navigation, X, Check } from "lucide-react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { H3, Muted } from "@/components/ui/typography";
import { SafeAreaView } from "@/components/safe-area-view";
import { useColorScheme } from "@/lib/useColorScheme";
import { OptimizedList } from "../ui/optimized-list";

// Lebanese cities and their popular districts
const LEBANESE_LOCATIONS = [
  {
    city: "Beirut",
    districts: [
      "Achrafieh",
      "Hamra",
      "Downtown",
      "Mar Mikhael",
      "Gemmayzeh",
      "Verdun",
      "Ras Beirut",
      "Badaro",
      "Sodeco",
      "Sassine",
      "Ain El Mreisseh",
      "Raouche",
      "Manara",
      "Mazraa",
      "Tarik Jdideh",
    ],
  },
  {
    city: "Mount Lebanon",
    districts: [
      "Jounieh",
      "Jbeil (Byblos)",
      "Baabda",
      "Aley",
      "Broummana",
      "Beit Mery",
      "Dbayeh",
      "Zalka",
      "Antelias",
      "Jal el Dib",
      "Kaslik",
      "Zouk Mosbeh",
      "Naccache",
      "Rabweh",
      "Bikfaya",
    ],
  },
  {
    city: "North Lebanon",
    districts: [
      "Tripoli",
      "Batroun",
      "Chekka",
      "Koura",
      "Zgharta",
      "Bcharre",
      "Amioun",
      "Kousba",
      "Anfeh",
    ],
  },
  {
    city: "South Lebanon",
    districts: [
      "Saida (Sidon)",
      "Tyre (Sour)",
      "Nabatieh",
      "Jezzine",
      "Marjayoun",
      "Bint Jbeil",
    ],
  },
  {
    city: "Bekaa",
    districts: ["Zahle", "Baalbek", "Chtaura", "Anjar", "Rayak", "Bar Elias"],
  },
];

interface LocationSelectorProps {
  currentLocation: string;
  onLocationChange: (location: { city: string; district: string }) => void;
}

export function LocationSelector({
  currentLocation,
  onLocationChange,
}: LocationSelectorProps) {
  const { colorScheme } = useColorScheme();
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Filter locations based on search
  const filteredLocations = LEBANESE_LOCATIONS.map((location) => ({
    ...location,
    districts: location.districts.filter(
      (district) =>
        district.toLowerCase().includes(searchQuery.toLowerCase()) ||
        location.city.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  })).filter((location) => location.districts.length > 0);

  const handleCurrentLocation = useCallback(async () => {
    setGettingLocation(true);

    try {
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location Permission",
          "Please enable location services to use this feature",
        );
        return;
      }

      // Get current position
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Reverse geocode
      const [address] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      const newLocation = {
        city: address.city || "Beirut",
        district: address.district || address.subregion || "Unknown",
      };

      // Save to storage
      await AsyncStorage.setItem(
        "@selected_location",
        JSON.stringify(newLocation),
      );

      onLocationChange(newLocation);
      setShowModal(false);
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert("Error", "Failed to get your current location");
    } finally {
      setGettingLocation(false);
    }
  }, [onLocationChange]);

  const handleSelectDistrict = useCallback(
    async (city: string, district: string) => {
      const newLocation = { city, district };

      // Save to storage
      await AsyncStorage.setItem(
        "@selected_location",
        JSON.stringify(newLocation),
      );

      onLocationChange(newLocation);
      setShowModal(false);
    },
    [onLocationChange],
  );

  const renderCitySection = ({
    item,
  }: {
    item: (typeof LEBANESE_LOCATIONS)[0];
  }) => {
    if (item.districts.length === 0) return null;

    return (
      <View className="mb-4">
        <Text className="font-semibold text-lg px-4 mb-2">{item.city}</Text>
        <View className="px-4">
          {item.districts.map((district) => (
            <Pressable
              key={`${item.city}-${district}`}
              onPress={() => handleSelectDistrict(item.city, district)}
              className="flex-row items-center justify-between py-3 border-b border-border"
            >
              <Text>{district}</Text>
              {currentLocation === district && (
                <Check size={20} color="#10b981" />
              )}
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  return (
    <>
      <Pressable
        onPress={() => setShowModal(true)}
        className="flex-row items-center gap-2"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MapPin size={16} color="#666" />
        <Text className="text-muted-foreground">{currentLocation}</Text>
      </Pressable>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
            <H3>Select Location</H3>
            <Pressable onPress={() => setShowModal(false)}>
              <X size={24} color={colorScheme === 'dark' ? '#fff' : '#374151'} />
            </Pressable>
          </View>

          {/* Search Bar */}
          <View className="px-4 py-3">
            <View className="relative">
              <Search
                size={20}
                color="#666"
                style={{ position: "absolute", left: 12, top: 10, zIndex: 1 }}
              />
              <Input
                placeholder="Search districts..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="pl-10"
              />
            </View>
          </View>

          {/* Current Location Button */}
          <View className="px-4 mb-4">
            <Button
              variant="outline"
              onPress={handleCurrentLocation}
              disabled={gettingLocation}
              className="w-full"
            >
              {gettingLocation ? (
                <ActivityIndicator size="small" />
              ) : (
                <>
                  <Navigation size={20} color={colorScheme === 'dark' ? '#fff' : '#374151'} />
                  <Text>Use Current Location</Text>
                </>
              )}
            </Button>
          </View>

          {/* Location List */}
          <OptimizedList
            data={filteredLocations}
            renderItem={renderCitySection}
            keyExtractor={(item) => item.city}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center py-20">
                <Muted>No locations found</Muted>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

// app/(protected)/location-selector.tsx
// This is the full-screen version of the location selector
