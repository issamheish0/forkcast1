// components/search/GeneralFiltersModal.tsx
import React, { useState, useEffect, useCallback } from "react";
import { View, Modal, Pressable, ScrollView, Image } from "react-native";
import { X, Star, Check, ChevronDown } from "lucide-react-native";
import Slider from "@react-native-community/slider";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { H3 } from "@/components/ui/typography";
import { SafeAreaView } from "@/components/safe-area-view";
import { DistanceFilter } from "./DistanceFilter";
import { useColorScheme } from "@/lib/useColorScheme";
import { getThemedColors } from "@/lib/utils";

const CUISINE_TYPES = [
  {
    name: "Lebanese",
    icon: require("@/assets/cuisine-categories/lebanese.png"),
  },
  { name: "Italian", icon: require("@/assets/cuisine-categories/italian.png") },
  { name: "French", icon: require("@/assets/cuisine-categories/french.png") },
  {
    name: "Japanese",
    icon: require("@/assets/cuisine-categories/japanese.png"),
  },
  { name: "Chinese", icon: require("@/assets/cuisine-categories/chinese.png") },
  { name: "Indian", icon: require("@/assets/cuisine-categories/indian.png") },
  { name: "Mexican", icon: require("@/assets/cuisine-categories/mexican.png") },
  {
    name: "American",
    icon: require("@/assets/cuisine-categories/american.png"),
  },
  {
    name: "Mediterranean",
    icon: require("@/assets/cuisine-categories/mediterranean.png"),
  },
  {
    name: "Mediterrasian",
    icon: require("@/assets/cuisine-categories/mediterrasian.png"),
  },
  { name: "Seafood", icon: require("@/assets/cuisine-categories/seafood.png") },
  { name: "Thai", icon: require("@/assets/cuisine-categories/thai.png") },
  { name: "Greek", icon: require("@/assets/cuisine-categories/greek.png") },
  { name: "Spanish", icon: require("@/assets/cuisine-categories/spanish.png") },
];

const FEATURES = [
  { id: "outdoor_seating", label: "Outdoor Seating", field: "outdoor_seating" },
  { id: "valet_parking", label: "Valet Parking", field: "valet_parking" },
  { id: "parking_available", label: "Parking", field: "parking_available" },
  { id: "shisha_available", label: "Shisha", field: "shisha_available" },
  { id: "live_music", label: "Live Music", field: "live_music_schedule" },
];

interface GeneralFilters {
  sortBy: "recommended" | "rating" | "distance" | "name";
  cuisines: string[];
  features: string[];
  priceRange: number[];
  bookingPolicy: "all" | "instant" | "request";
  minRating: number;
  maxDistance: number | null;
  hasSpecialOffer: "all" | "yes" | "no";
}

interface GeneralFiltersModalProps {
  visible: boolean;
  generalFilters: GeneralFilters;
  onApplyFilters: (filters: GeneralFilters) => void;
  onClose: () => void;
}

export const GeneralFiltersModal = React.memo(
  ({
    visible,
    generalFilters,
    onApplyFilters,
    onClose,
  }: GeneralFiltersModalProps) => {
    const { colorScheme } = useColorScheme();
    const themedColors = getThemedColors(colorScheme);
    const [tempFilters, setTempFilters] = useState(generalFilters);
    const [cuisineModalVisible, setCuisineModalVisible] = useState(false);

    // Synchronize with props when modal opens
    useEffect(() => {
      if (visible) {
        setTempFilters(generalFilters);
      }
    }, [visible, generalFilters]);

    const applyFilters = useCallback(() => {
      onApplyFilters(tempFilters);
      onClose();
    }, [tempFilters, onApplyFilters, onClose]);

    const clearAllFilters = useCallback(() => {
      const defaultFilters: GeneralFilters = {
        sortBy: "recommended",
        cuisines: [],
        features: [],
        priceRange: [1, 2, 3, 4],
        bookingPolicy: "all",
        minRating: 0,
        maxDistance: null,
        hasSpecialOffer: "all",
      };
      onApplyFilters(defaultFilters);
      onClose();
    }, [onApplyFilters, onClose]);

    const toggleCuisine = useCallback(
      (cuisineName: string) => {
        const isSelected = tempFilters.cuisines.includes(cuisineName);
        setTempFilters((prev) => ({
          ...prev,
          cuisines: isSelected
            ? prev.cuisines.filter((c) => c !== cuisineName)
            : [...prev.cuisines, cuisineName],
        }));
      },
      [tempFilters.cuisines],
    );

    const togglePriceRange = useCallback(
      (price: number) => {
        const isSelected = tempFilters.priceRange.includes(price);
        setTempFilters((prev) => ({
          ...prev,
          priceRange: isSelected
            ? prev.priceRange.filter((p) => p !== price)
            : [...prev.priceRange, price].sort(),
        }));
      },
      [tempFilters.priceRange],
    );

    const toggleFeature = useCallback(
      (featureId: string) => {
        const isSelected = tempFilters.features.includes(featureId);
        setTempFilters((prev) => ({
          ...prev,
          features: isSelected
            ? prev.features.filter((f) => f !== featureId)
            : [...prev.features, featureId],
        }));
      },
      [tempFilters.features],
    );

    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
          {/* Header */}
          <View className="bg-card px-6 py-4 border-b border-border">
            <View className="flex-row items-center justify-between">
              <H3 className="text-foreground">Filters</H3>
              <Pressable
                onPress={onClose}
                className="p-2 -mr-2 rounded-full active:bg-muted"
              >
                <X size={24} className="text-muted-foreground" />
              </Pressable>
            </View>
          </View>

          <ScrollView
            className="flex-1 px-4"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 16 }}
          >
            {/* Sort By Section */}
            <View className="bg-card rounded-xl p-5 mb-4 border border-border">
              <Text className="font-semibold text-lg text-foreground mb-4">
                Sort By
              </Text>
              <View className="gap-3">
                {[
                  {
                    value: "recommended",
                    label: "Recommended",
                    desc: "Best overall matches",
                  },

                  {
                    value: "rating",
                    label: "Highest Rated",
                    desc: "Top customer reviews",
                  },
                  {
                    value: "distance",
                    label: "Nearest First",
                    desc: "Closest to your location",
                  },
                  { value: "name", label: "A-Z", desc: "Alphabetical order" },
                ].map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      setTempFilters((prev) => ({
                        ...prev,
                        sortBy: option.value as any,
                      }))
                    }
                    className={`p-3 rounded-lg border-2 ${
                      tempFilters.sortBy === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text
                          className={`font-medium ${
                            tempFilters.sortBy === option.value
                              ? "text-primary"
                              : "text-foreground"
                          }`}
                        >
                          {option.label}
                        </Text>
                        <Text className="text-sm text-muted-foreground mt-1">
                          {option.desc}
                        </Text>
                      </View>
                      {tempFilters.sortBy === option.value && (
                        <Check size={20} className="text-primary" />
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Distance & Location */}
            <View className="bg-card rounded-xl p-5 mb-4 border border-border">
              <DistanceFilter
                selectedDistance={tempFilters.maxDistance}
                onDistanceChange={(distance) =>
                  setTempFilters((prev) => ({ ...prev, maxDistance: distance }))
                }
              />
            </View>

            {/* Price Range Section */}
            <View className="bg-card rounded-xl p-5 mb-4 border border-border">
              <Text className="font-semibold text-lg text-foreground mb-4">
                Price Range
              </Text>
              <View className="flex-row gap-3">
                {[1, 2, 3, 4].map((price) => (
                  <Pressable
                    key={price}
                    onPress={() => togglePriceRange(price)}
                    className={`flex-1 items-center py-4 rounded-xl border-2 ${
                      tempFilters.priceRange.includes(price)
                        ? "bg-primary border-primary"
                        : "bg-muted border-border"
                    }`}
                  >
                    <Text
                      className={`font-bold text-base ${
                        tempFilters.priceRange.includes(price)
                          ? "text-primary-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {"$".repeat(price)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Minimum Rating Section */}
            <View className="bg-card rounded-xl p-5 mb-4 border border-border">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="font-semibold text-lg text-foreground">
                  Minimum Rating
                </Text>
                <View className="flex-row items-center gap-1">
                  <Star size={18} color="#f59e0b" fill="#f59e0b" />
                  <Text className="font-semibold text-foreground text-lg">
                    {tempFilters.minRating === 0
                      ? "Any"
                      : `${tempFilters.minRating}+`}
                  </Text>
                </View>
              </View>
              <Slider
                style={{ width: "100%", height: 40 }}
                minimumValue={0}
                maximumValue={5}
                step={0.5}
                value={tempFilters.minRating}
                onSlidingComplete={(value) =>
                  setTempFilters((prev) => ({
                    ...prev,
                    minRating: value,
                  }))
                }
                minimumTrackTintColor={themedColors.primary}
                maximumTrackTintColor={themedColors.muted}
                thumbTintColor={themedColors.primary}
              />
              <View className="flex-row justify-between mt-2">
                <Text className="text-xs text-muted-foreground">Any</Text>
                <Text className="text-xs text-muted-foreground">5.0</Text>
              </View>
            </View>

            {/* Cuisine Types */}
            <View className="bg-card rounded-xl p-5 mb-4 border border-border">
              <Text className="font-semibold text-lg text-foreground mb-4">
                Cuisine Types
              </Text>
              <Pressable
                onPress={() => setCuisineModalVisible(true)}
                className="flex-row items-center justify-between p-4 rounded-xl border-2 border-border bg-muted"
              >
                <Text className="text-foreground font-medium">
                  {tempFilters.cuisines.length === 0
                    ? "Select cuisines"
                    : `${tempFilters.cuisines.length} cuisine${tempFilters.cuisines.length > 1 ? "s" : ""} selected`}
                </Text>
                <ChevronDown size={20} className="text-muted-foreground" />
              </Pressable>
              {tempFilters.cuisines.length > 0 && (
                <View className="flex-row flex-wrap gap-2 mt-3">
                  {tempFilters.cuisines.map((cuisineName) => {
                    const cuisine = CUISINE_TYPES.find(
                      (c) => c.name === cuisineName,
                    );
                    return (
                      <Pressable
                        key={cuisineName}
                        onPress={() => toggleCuisine(cuisineName)}
                        className="flex-row items-center gap-2 px-3 py-2 rounded-full bg-primary"
                      >
                        {cuisine && (
                          <Image
                            source={cuisine.icon}
                            style={{ width: 16, height: 16 }}
                            resizeMode="contain"
                          />
                        )}
                        <Text className="text-sm font-medium text-primary-foreground">
                          {cuisineName}
                        </Text>
                        <X size={14} color="white" />
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Cuisine Selection Modal */}
            <Modal
              visible={cuisineModalVisible}
              transparent
              animationType="slide"
              onRequestClose={() => setCuisineModalVisible(false)}
            >
              <Pressable
                className="flex-1"
                onPress={() => setCuisineModalVisible(false)}
              >
                <View className="flex-1" />
              </Pressable>
              <View className="h-1/2 bg-background rounded-t-3xl border-t border-border">
                {/* Header */}
                <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
                  <Pressable onPress={() => setCuisineModalVisible(false)}>
                    <X size={24} className="text-foreground" />
                  </Pressable>
                  <H3>Select Cuisines</H3>
                  <Pressable onPress={() => setCuisineModalVisible(false)}>
                    <Text className="text-primary font-semibold">Done</Text>
                  </Pressable>
                </View>

                {/* Cuisine List */}
                <ScrollView
                  className="flex-1 px-4 py-4"
                  contentContainerStyle={{ paddingBottom: 32 }}
                >
                  <View className="gap-2">
                    {CUISINE_TYPES.map((cuisine) => (
                      <Pressable
                        key={cuisine.name}
                        onPress={() => toggleCuisine(cuisine.name)}
                        className={`flex-row items-center p-4 rounded-xl border-2 ${
                          tempFilters.cuisines.includes(cuisine.name)
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card"
                        }`}
                      >
                        <Image
                          source={cuisine.icon}
                          style={{ width: 32, height: 32 }}
                          resizeMode="contain"
                        />
                        <Text
                          className={`flex-1 ml-4 font-medium text-base ${
                            tempFilters.cuisines.includes(cuisine.name)
                              ? "text-primary"
                              : "text-foreground"
                          }`}
                        >
                          {cuisine.name}
                        </Text>
                        {tempFilters.cuisines.includes(cuisine.name) && (
                          <Check size={20} className="text-primary" />
                        )}
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </Modal>

            {/* Features & Amenities */}
            <View className="bg-card rounded-xl p-5 mb-4 border border-border">
              <Text className="font-semibold text-lg text-foreground mb-4">
                Features & Amenities
              </Text>
              <View className="grid grid-cols-2 gap-3">
                {FEATURES.map((feature) => (
                  <Pressable
                    key={feature.id}
                    onPress={() => toggleFeature(feature.id)}
                    className={`p-3 rounded-lg border-2 flex-row items-center ${
                      tempFilters.features.includes(feature.id)
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <View
                      className={`w-5 h-5 rounded border-2 items-center justify-center mr-3 ${
                        tempFilters.features.includes(feature.id)
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      }`}
                    >
                      {tempFilters.features.includes(feature.id) && (
                        <Check size={12} className="text-primary-foreground" />
                      )}
                    </View>
                    <Text
                      className={`flex-1 text-sm font-medium ${
                        tempFilters.features.includes(feature.id)
                          ? "text-primary"
                          : "text-foreground"
                      }`}
                    >
                      {feature.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Booking Policy */}
            <View className="bg-card rounded-xl p-5 mb-4 border border-border">
              <Text className="font-semibold text-lg text-foreground mb-4">
                Booking Type
              </Text>
              <View className="gap-3">
                {[
                  {
                    value: "all",
                    label: "All restaurants",
                    desc: "Show all booking options",
                  },
                  {
                    value: "instant",
                    label: "Instant booking only",
                    desc: "Book immediately without waiting",
                  },
                  {
                    value: "request",
                    label: "Request booking only",
                    desc: "Requires restaurant confirmation",
                  },
                ].map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      setTempFilters((prev) => ({
                        ...prev,
                        bookingPolicy: option.value as any,
                      }))
                    }
                    className={`p-3 rounded-lg border-2 ${
                      tempFilters.bookingPolicy === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text
                          className={`font-medium ${
                            tempFilters.bookingPolicy === option.value
                              ? "text-primary"
                              : "text-foreground"
                          }`}
                        >
                          {option.label}
                        </Text>
                        <Text className="text-sm text-muted-foreground mt-1">
                          {option.desc}
                        </Text>
                      </View>
                      {tempFilters.bookingPolicy === option.value && (
                        <Check size={20} className="text-primary" />
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Special Offers */}
            <View className="bg-card rounded-xl p-5 mb-6 border border-border">
              <Text className="font-semibold text-lg text-foreground mb-4">
                Special Offers
              </Text>
              <View className="gap-3">
                {[
                  {
                    value: "all",
                    label: "All restaurants",
                    desc: "Show all restaurants",
                  },
                  {
                    value: "yes",
                    label: "Has special offers",
                    desc: "Only restaurants with active offers",
                  },
                  {
                    value: "no",
                    label: "No special offers",
                    desc: "Only restaurants without offers",
                  },
                ].map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      setTempFilters((prev) => ({
                        ...prev,
                        hasSpecialOffer: option.value as any,
                      }))
                    }
                    className={`p-3 rounded-lg border-2 ${
                      tempFilters.hasSpecialOffer === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text
                          className={`font-medium ${
                            tempFilters.hasSpecialOffer === option.value
                              ? "text-primary"
                              : "text-foreground"
                          }`}
                        >
                          {option.label}
                        </Text>
                        <Text className="text-sm text-muted-foreground mt-1">
                          {option.desc}
                        </Text>
                      </View>
                      {tempFilters.hasSpecialOffer === option.value && (
                        <Check size={20} className="text-primary" />
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Bottom Action Buttons */}
          <View className="bg-card px-4 py-4 border-t border-border">
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onPress={clearAllFilters}
              >
                <Text className="font-semibold text-foreground">Clear All</Text>
              </Button>
              <Button
                variant="default"
                className="flex-1"
                onPress={applyFilters}
              >
                <Text className="font-semibold text-primary-foreground">
                  Apply Filters
                </Text>
              </Button>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  },
);
