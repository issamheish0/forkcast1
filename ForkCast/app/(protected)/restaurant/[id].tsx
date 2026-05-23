// app/(protected)/restaurant/[id].tsx
import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  BookOpen,
  ChevronLeft,
  Heart,
  Star,
  MapPin,
  Phone,
  Navigation,
  Calendar,
  ChevronRight,
  ChevronDown,
  Edit3,
  Car,
  Leaf,
  TreePine,
  CheckCircle,
  Send,
  Timer,
  X,
  Share2,
  Instagram,
  Facebook,
  Twitter,
  ExternalLink,
  Wind,
  Music,
  Wine,
  CarFront,
  Clock,
  MessageCircle,
  Tag,
  ArrowUpRight,
  Ticket,
  Info,
  Users,
  Globe,
} from "lucide-react-native";
import {
  ScrollView,
  View,
  Pressable,
  Alert,
  Dimensions,
  StatusBar,
  Modal,
  Linking,
  FlatList,
  Platform,
  InteractionManager,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  runOnJS,
} from "react-native-reanimated";
import { RefScrollView } from "@/components/ui/RefScrollView";

const AnimatedRefScrollView = Animated.createAnimatedComponent(RefScrollView);
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import MapView, { Marker } from "react-native-maps";
import { RestaurantPosts } from "@/components/restaurant/RestaurantPosts";
import { GuestPromptModal } from "@/components/guest/GuestPromptModal";
import { RestaurantHoursDisplay } from "@/components/restaurant/RestaurantHoursDisplay";
import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H3, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { LocationService } from "@/lib/locationService";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { colors } from "@/constants/colors";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useRestaurantReviews } from "@/hooks/useRestaurantReviews";
import { useGuestGuard } from "@/hooks/useGuestGuard";
import {
  useBookingPress,
  useQuickActionPress,
  useModalPress,
} from "@/hooks/useHapticPress";

import { DirectionsButton } from "@/components/restaurant/DirectionsButton";
import { useShare } from "@/hooks/useShare";
import { ShareModal } from "@/components/ui/share-modal";
import RestaurantDetailsScreenSkeleton from "@/components/skeletons/RestaurantDetailsScreenSkeleton";
import { Restaurant } from "@/types/restaurant";
import { Database } from "@/types/supabase";
import {
  getAgeRestrictionMessage,
  isAgeRestricted,
} from "@/utils/ageVerification";
import { useBookingEligibility } from "@/hooks/useBookingEligibility";
import { VerifyPhoneModal } from "@/components/auth/VerifyPhoneModal";
import { RestaurantEventsList } from "@/components/events/RestaurantEventsList";
import { EventDetailsModal } from "@/components/events/EventDetailsModal";
import { useRestaurantEvents } from "@/hooks/useRestaurantEvents";
import { useRestaurantOpenHours } from "@/hooks/useRestaurantOpenHours";
import { useRestaurantOffersDetail } from "@/hooks/useRestaurantOffersDetail";
import { formatCuisines } from "@/lib/cuisineUtils";
import { FontAwesome } from "@expo/vector-icons";

type Review = Database["public"]["Tables"]["reviews"]["Row"] & {
  user: {
    full_name: string;
    avatar_url?: string | null;
  };
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

// Custom hook for restaurant location - Updated to handle different location formats
const useRestaurantLocation = (location: any, restaurant?: Restaurant) => {
  const [address, setAddress] = useState<string>("Loading...");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    setIsLoading(true);

    // Use LocationService to extract coordinates from any format
    const coords = LocationService.extractCoordinates(location);

    if (coords) {
      setCoordinates(coords);
    } else {
      // Default to Beirut coordinates if no valid coordinates found
      setCoordinates({
        latitude: 33.8938,
        longitude: 35.5018,
      });
    }

    // Use the actual restaurant address instead of placeholder text
    if (restaurant?.address) {
      setAddress(restaurant.address);
    } else {
      setAddress("Address not available");
    }
    setIsLoading(false);
  }, [location, restaurant]);

  return { address, coordinates, isLoading };
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_HEIGHT = Math.min(SCREEN_HEIGHT * 0.6, 400);

// Image Gallery Modal Component
const ImageGalleryModal: React.FC<{
  visible: boolean;
  images: string[];
  initialIndex: number;
  onClose: () => void;
}> = ({ visible, images, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const { handlePress: handleModalPress } = useModalPress();

  const goToPrevious = () => {
    handleModalPress(() => {
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    });
  };

  const goToNext = () => {
    handleModalPress(() => {
      setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    });
  };

  const handleClose = () => {
    handleModalPress(onClose);
  };

  if (!visible || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-black">
        <StatusBar barStyle="light-content" backgroundColor="black" />

        {/* Header with close button */}
        <View className="absolute top-0 left-0 right-0 z-50 pt-12">
          <View className="flex-row items-center justify-between p-4">
            <Pressable
              onPress={handleClose}
              className="w-12 h-12 bg-black/70 rounded-full items-center justify-center"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={24} color="white" />
            </Pressable>
            <Text className="text-white font-medium">
              {currentIndex + 1} of {images.length}
            </Text>
            <View className="w-12" />
          </View>
        </View>

        {/* Image Display */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: currentIndex * SCREEN_WIDTH, y: 0 }}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(
              event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
            );
            setCurrentIndex(index);
          }}
        >
          {images.map((image, index) => {
            // Lazy load: only load current, previous, and next images
            const isVisible = Math.abs(index - currentIndex) <= 1;

            return (
              <View
                key={index}
                style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
                className="items-center justify-center"
              >
                {isVisible && (
                  <Image
                    source={{ uri: image }}
                    style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
                    contentFit="contain"
                    optimizationPreset="large"
                    optimizationOptions={{ quality: 80 }} // Lower quality for full-screen gallery
                  />
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Navigation Controls */}
        {images.length > 1 && (
          <>
            <Pressable
              onPress={goToPrevious}
              className="absolute left-4 top-1/2 w-12 h-12 bg-black/50 rounded-full items-center justify-center"
              style={{ marginTop: -24 }}
            >
              <ChevronLeft size={24} color="white" />
            </Pressable>
            <Pressable
              onPress={goToNext}
              className="absolute right-4 top-1/2 w-12 h-12 bg-black/50 rounded-full items-center justify-center"
              style={{ marginTop: -24 }}
            >
              <ChevronRight size={24} color="white" />
            </Pressable>
          </>
        )}

        {/* Image Indicators */}
        {images.length > 1 && (
          <View className="absolute bottom-0 left-0 right-0">
            <SafeAreaView edges={["bottom"]}>
              <View className="flex-row justify-center py-4">
                <View className="flex-row bg-black/50 rounded-full px-3 py-2 gap-1">
                  {images.map((_, index) => (
                    <View
                      key={index}
                      className={`w-2 h-2 rounded-full ${
                        index === currentIndex ? "bg-white" : "bg-white/40"
                      }`}
                    />
                  ))}
                </View>
              </View>
            </SafeAreaView>
          </View>
        )}
      </View>
    </Modal>
  );
};

// Image Gallery Component - Simplified for new design
const ImageGallery: React.FC<{
  images: string[];
  onImagePress: (index: number) => void;
}> = ({ images, onImagePress }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!images.length) return null;

  return (
    <View style={{ height: IMAGE_HEIGHT }} className="relative">
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(
            event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
          );
          setActiveIndex(index);
        }}
      >
        {images.map((image, index) => (
          <Pressable
            key={index}
            onPress={() => onImagePress(index)}
            style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT }}
          >
            <Image
              source={{ uri: image }}
              style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT }}
              contentFit="cover"
              optimizationPreset="large"
            />
          </Pressable>
        ))}
      </ScrollView>

      {/* Image Indicators - iOS Style */}
      {images.length > 1 && (
        <View className="absolute bottom-10 left-0 right-0 flex-row justify-center">
          <View className="flex-row bg-black/30 rounded-full px-2 py-1.5 gap-1.5">
            {images.map((_, index) => (
              <View
                key={index}
                className={`h-2 rounded-full ${
                  index === activeIndex ? "w-5 bg-white" : "w-2 bg-white/50"
                }`}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

// Take Me There Button - Opens Apple Maps or Google Maps
const TakeMeThereButton: React.FC<{
  restaurant: Restaurant;
}> = ({ restaurant }) => {
  const handlePress = useCallback(() => {
    if (!restaurant) return;

    // Extract coordinates from restaurant location
    let coords = restaurant.coordinates
      ? {
          lat: restaurant.coordinates.latitude,
          lng: restaurant.coordinates.longitude,
        }
      : null;

    if (!coords && restaurant.location) {
      const extractedCoords = LocationService.extractCoordinates(
        restaurant.location,
      );
      if (extractedCoords) {
        coords = {
          lat: extractedCoords.latitude,
          lng: extractedCoords.longitude,
        };
      }
    }

    // Fallback to default Beirut coordinates
    if (!coords) {
      coords = { lat: 33.8938, lng: 35.5018 };
    }

    const latLng = `${coords.lat},${coords.lng}`;
    const label = encodeURIComponent(restaurant.name);

    Alert.alert(
      "Take Me There",
      "Select your preferred maps application:",
      [
        {
          text: "Apple Maps",
          onPress: async () => {
            const url = Platform.select({
              ios: `maps:0,0?q=${label}@${latLng}`,
              android: `geo:0,0?q=${latLng}(${label})`,
            });
            if (url) {
              try {
                await Linking.openURL(url);
              } catch {
                Alert.alert("Error", "Unable to open Apple Maps");
              }
            }
          },
        },
        {
          text: "Google Maps",
          onPress: async () => {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${latLng}&destination_place_id=${label}`;
            try {
              await Linking.openURL(url);
            } catch {
              Alert.alert("Error", "Unable to open Google Maps");
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true },
    );
  }, [restaurant]);

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = colors[isDark ? "dark" : "light"].primary;
  const lightBurgundy = isDark
    ? "rgba(121, 35, 57, 0.35)"
    : "rgba(121, 35, 57, 0.3)";

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Open in Maps"
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      className="w-7 h-7 rounded-full items-center justify-center border-2"
      style={{
        borderColor: lightBurgundy,
        backgroundColor: isDark
          ? "rgba(0, 0, 0, 0.1)"
          : "rgba(255, 255, 255, 0.8)",
      }}
    >
      <ArrowUpRight size={14} color={isDark ? "white" : primaryColor} />
    </Pressable>
  );
};

// Restaurant Header Info - Redesigned to match new UI
const RestaurantHeaderInfo: React.FC<{
  restaurant: Restaurant;
  restaurantId: string;
  onViewAllReviews: () => void;
}> = ({ restaurant, restaurantId, onViewAllReviews }) => {
  const [showFullDescription, setShowFullDescription] = useState(false);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { address, isLoading } = useRestaurantLocation(
    restaurant.location,
    restaurant,
  );
  const primaryColor = colors[isDark ? "dark" : "light"].primary;
  const lightBurgundy = isDark
    ? "rgba(121, 35, 57, 0.35)"
    : "rgba(121, 35, 57, 0.3)";

  const shouldTruncate = (restaurant.description?.length || 0) > 60;
  const displayDescription =
    shouldTruncate && !showFullDescription
      ? restaurant.description?.substring(0, 60) + "..."
      : restaurant.description;

  return (
    <View
      className="bg-background rounded-t-3xl -mt-6 pt-6 px-5 pb-6"
      accessibilityLabel="Restaurant details"
    >
      {/* Name, Cuisine and Rating Row */}
      <View className="flex-row items-start justify-between mb-5">
        <View className="flex-1 pr-4">
          <View className="flex-row items-center gap-2 mb-1.5 flex-wrap">
            <Text className="text-2xl font-bold text-foreground flex-shrink-0">
              {restaurant.name}
            </Text>
            {restaurant.scratch_card_enabled && (
              <View
                className="bg-amber-500/15 dark:bg-amber-400/20 flex-shrink-0 overflow-hidden flex-row items-center gap-1"
                style={{
                  borderRadius: 9999,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                }}
                accessibilityLabel="This restaurant participates in the scratch card reward program"
              >
                <Ticket size={12} color={isDark ? "#FCD34D" : "#B45309"} />
                <Text className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Scratch Card
                </Text>
              </View>
            )}
            {isAgeRestricted(restaurant) && restaurant.minimum_age != null && (
              <View
                className="bg-amber-100 dark:bg-amber-900/30 flex-shrink-0 overflow-hidden"
                style={{
                  borderRadius: 9999,
                  paddingHorizontal: 6,
                  paddingVertical: 6,
                }}
                accessibilityLabel={
                  getAgeRestrictionMessage(restaurant) ?? undefined
                }
              >
                <Text className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                  {restaurant.minimum_age}+
                </Text>
              </View>
            )}
          </View>
          <Text className="text-muted-foreground text-sm">
            {formatCuisines(
              restaurant.cuisine_type,
              restaurant.secondary_cuisines,
            )}
          </Text>
        </View>
        <View className="items-end flex-shrink-0">
          <View className="flex-row items-center gap-1.5 mb-1.5">
            <Star size={16} color="#f59e0b" fill="#f59e0b" />
            <Text className="text-lg font-bold text-foreground">
              {restaurant.average_rating && restaurant.average_rating > 0
                ? restaurant.average_rating.toFixed(1)
                : "-"}
            </Text>
          </View>
          <Pressable
            onPress={onViewAllReviews}
            accessibilityRole="button"
            accessibilityLabel={`${restaurant.total_reviews || 0} reviews. Tap to view all.`}
          >
            <Text className="text-muted-foreground text-xs">
              {restaurant.total_reviews || 0} reviews
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Description */}
      {restaurant.description && (
        <Pressable
          onPress={() => setShowFullDescription(!showFullDescription)}
          accessibilityRole="button"
          accessibilityLabel={
            showFullDescription
              ? "Hide full description"
              : "Show full description"
          }
          className="flex-row items-center gap-3 mb-3"
        >
          <View className="w-8 h-8 rounded-full bg-muted items-center justify-center flex-shrink-0">
            <Info size={16} color={primaryColor} />
          </View>
          <View className="flex-1">
            <Text
              className="text-sm leading-5 text-muted-foreground"
              numberOfLines={showFullDescription ? undefined : 1}
              ellipsizeMode="tail"
            >
              {restaurant.description}
            </Text>
          </View>
          <View
            className="w-7 h-7 rounded-full items-center justify-center border-2 flex-shrink-0"
            style={{
              borderColor: lightBurgundy,
              backgroundColor: isDark
                ? "rgba(0, 0, 0, 0.1)"
                : "rgba(255, 255, 255, 0.8)",
            }}
          >
            <ChevronDown
              size={14}
              color={primaryColor}
              style={{
                transform: [{ rotate: showFullDescription ? "180deg" : "0deg" }],
              }}
            />
          </View>
        </Pressable>
      )}

      {/* Location */}
      <View
        className="flex-row items-center gap-3 mb-3"
        accessibilityLabel={
          isLoading ? "Loading location" : `Address: ${address}`
        }
      >
        <View className="w-8 h-8 rounded-full bg-muted items-center justify-center flex-shrink-0">
          <MapPin size={16} color={primaryColor} />
        </View>
        <Text
          className="flex-1 text-sm text-muted-foreground"
          numberOfLines={1}
        >
          {isLoading ? "Loading location..." : address}
        </Text>
        <View style={{ width: 28, alignItems: "flex-end", flexShrink: 0 }}>
          <TakeMeThereButton restaurant={restaurant} />
        </View>
      </View>

      {/* Hours */}
      <HoursInlineDisplay restaurantId={restaurantId} restaurant={restaurant} />

      {/* Inline Features (horizontal, no title) */}
      <FeatureTagsSection restaurant={restaurant} />
    </View>
  );
};

// Inline Hours Display for header
const HoursInlineDisplay: React.FC<{
  restaurantId: string;
  restaurant: Restaurant;
}> = ({ restaurantId, restaurant }) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = colors[isDark ? "dark" : "light"].primary;
  const { loading, checkAvailability, formatDisplayHours, getWeeklySchedule } =
    useRestaurantOpenHours(restaurantId);
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <View className="flex-row items-center gap-2 mb-3">
        <View className="w-8 h-8 rounded-full bg-muted items-center justify-center">
          <Clock size={16} color="#666" />
        </View>
        <Text className="text-muted-foreground text-sm">Loading...</Text>
      </View>
    );
  }

  const todayStatus = checkAvailability(
    new Date(),
    new Date().getHours().toString().padStart(2, "0") +
      ":" +
      new Date().getMinutes().toString().padStart(2, "0"),
  );
  const currentHours = formatDisplayHours();
  const weeklySchedule = getWeeklySchedule();
  const statusColor = todayStatus.isOpen ? "#10b981" : "#ef4444";
  const statusText = todayStatus.isOpen ? "OPEN" : "CLOSED";

  // Show next opening time if closed
  let timeDisplay = currentHours;
  if (!todayStatus.isOpen && todayStatus.nextOpenTime) {
    const nextTime = new Date(todayStatus.nextOpenTime.date);
    const timeStr = nextTime.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    timeDisplay = `Opens at ${timeStr}`;
  }

  const dayNames = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const lightBurgundy = isDark
    ? "rgba(121, 35, 57, 0.35)"
    : "rgba(121, 35, 57, 0.3)";

  return (
    <View className="mb-1">
      <Pressable
        onPress={() => setExpanded(!expanded)}
        accessibilityRole="button"
        accessibilityLabel={
          expanded ? "Collapse weekly hours" : "Expand weekly hours"
        }
        accessibilityState={{ expanded }}
        className="flex-row items-center gap-3"
      >
        <View className="w-8 h-8 rounded-full bg-muted items-center justify-center flex-shrink-0">
          <Clock size={16} color={primaryColor} />
        </View>
        <View className="flex-1">
          {timeDisplay.split(", ").map((range, i) => (
            <Text
              key={i}
              className="text-sm text-muted-foreground"
            >
              {range}
            </Text>
          ))}
        </View>
        <View className="items-end gap-2" style={{ flexShrink: 0 }}>
          <View
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: statusColor + "20" }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: statusColor }}
            >
              {statusText}
            </Text>
          </View>
        </View>
        <View
          className="w-7 h-7 rounded-full items-center justify-center border-2"
          style={{
            borderColor: lightBurgundy,
            backgroundColor: isDark
              ? "rgba(0, 0, 0, 0.1)"
              : "rgba(255, 255, 255, 0.8)",
            flexShrink: 0,
          }}
        >
          <ChevronDown
            size={14}
            color={isDark ? "white" : primaryColor}
            style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
          />
        </View>
      </Pressable>

      {/* Weekly Schedule */}
      {expanded && weeklySchedule && weeklySchedule.length > 0 && (
        <View className="mt-3 p-3 bg-muted/20 rounded-lg border border-border">
          {weeklySchedule.map((day, index) => {
            const formatTime = (time: string) => {
              const [hours, minutes] = time.split(":");
              const hour = parseInt(hours, 10);
              const ampm = hour >= 12 ? "PM" : "AM";
              const displayHour = hour % 12 || 12;
              return `${displayHour}:${minutes.padStart(2, "0")} ${ampm}`;
            };

            const timeRanges =
              day.isOpen && day.hours && day.hours.length > 0
                ? day.hours.map(
                    (h: any) => `${formatTime(h.open)} - ${formatTime(h.close)}`,
                  )
                : null;

            return (
              <View
                key={index}
                className="flex-row py-2 border-b border-border/30 last:border-b-0"
              >
                <Text
                  className="text-sm text-muted-foreground font-medium"
                  style={{ width: 100, flexShrink: 0 }}
                >
                  {dayNames[index % 7]}
                </Text>
                <View className="flex-1 items-end">
                  {timeRanges ? (
                    timeRanges.map((range: string, i: number) => (
                      <Text
                        key={i}
                        className="text-sm text-foreground font-medium"
                      >
                        {range}
                      </Text>
                    ))
                  ) : (
                    <Text className="text-sm text-muted-foreground font-medium">
                      Closed
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

// About Section - Now integrated into header, kept for backwards compat
const AboutSection: React.FC<{ restaurant: Restaurant }> = ({ restaurant }) => {
  const [showFullDescription, setShowFullDescription] = useState(false);

  if (!restaurant.description) return null;

  const shouldTruncate = restaurant.description.length > 120;
  const displayText =
    shouldTruncate && !showFullDescription
      ? restaurant.description.substring(0, 120) + "..."
      : restaurant.description;

  return (
    <View className="px-4 py-3 border-b border-border/50">
      <Text className="text-base font-semibold mb-2 text-foreground">
        About
      </Text>
      <Text className="text-sm text-muted-foreground leading-5 mb-1">
        {displayText}
      </Text>
      {shouldTruncate && (
        <Pressable onPress={() => setShowFullDescription(!showFullDescription)}>
          <Text className="text-primary text-sm font-medium">
            {showFullDescription ? "Show less" : "Read more"}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

// Features Section
const FeaturesSection: React.FC<{ restaurant: Restaurant }> = ({
  restaurant,
}) => {
  const features = [];

  // Parking features
  if (restaurant.parking_available)
    features.push({ icon: Car, text: "Parking", color: "#3b82f6" });
  if (restaurant.valet_parking)
    features.push({ icon: CarFront, text: "Valet Parking", color: "#8b5cf6" });

  // Outdoor seating
  if (restaurant.outdoor_seating)
    features.push({
      icon: TreePine,
      text: "Outdoor Seating",
      color: "#10b981",
    });

  // Shisha
  if (restaurant.shisha_available)
    features.push({ icon: Wind, text: "Shisha Available", color: "#6366f1" });

  // Live music
  if (restaurant.live_music_schedule)
    features.push({ icon: Music, text: "Live Music", color: "#ec4899" });

  // Happy hour
  if (restaurant.happy_hour_times)
    features.push({ icon: Wine, text: "Happy Hour", color: "#f59e0b" });

  // Dietary options
  if (restaurant.dietary_options?.includes("vegetarian"))
    features.push({ icon: Leaf, text: "Vegetarian", color: "#22c55e" });
  if (restaurant.dietary_options?.includes("vegan"))
    features.push({ icon: Leaf, text: "Vegan", color: "#16a34a" });

  if (features.length === 0) return null;

  return (
    <View className="px-4 py-3 border-b border-border/50">
      <Text className="text-base font-semibold mb-3 text-foreground">
        Features & Amenities
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {features.map((feature, index) => {
          const IconComponent = feature.icon;
          return (
            <View
              key={index}
              className="flex-row items-center bg-muted/30 px-3 py-2.5 rounded-xl border border-border/30"
            >
              <IconComponent size={16} color={feature.color} />
              <Text className="text-sm font-medium text-foreground ml-2">
                {feature.text}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// Social Media Section
const SocialMediaSection: React.FC<{
  restaurant: Restaurant;
  onSocialPress: (url: string, platform: string) => void;
}> = ({ restaurant, onSocialPress }) => {
  const socialLinks = [];

  // Check for Instagram
  if (restaurant.instagram_handle) {
    const handle = restaurant.instagram_handle;
    const url = handle.startsWith("@")
      ? `https://instagram.com/${handle.slice(1)}`
      : `https://instagram.com/${handle}`;
    socialLinks.push({
      id: "instagram",
      icon: Instagram,
      label: "Instagram",
      url: url,
      color: "#E4405F",
      handle: handle.startsWith("@") ? handle : `@${handle}`,
    });
  }

  // Note: Facebook, Twitter, TikTok, LinkedIn fields don't exist in current schema
  // They should be added to the database schema if needed:
  // - facebook_url: string | null
  // - twitter_handle: string | null
  // - twitter_url: string | null
  // - tiktok_handle: string | null
  // - tiktok_url: string | null
  // - linkedin_url: string | null

  if (socialLinks.length === 0) return null;

  return (
    <View className="px-4 py-2">
      <Text className="text-base font-semibold mb-2 text-foreground">
        Connect With Us
      </Text>
      <View className="flex-row flex-wrap gap-3">
        {socialLinks.map((social) => {
          const IconComponent = social.icon;
          return (
            <Pressable
              key={social.id}
              onPress={() => onSocialPress(social.url, social.id)}
              className="flex-row items-center gap-2 p-3 rounded-xl border border-border bg-background min-w-[120px] flex-1"
            >
              <View className="w-6 h-6 items-center justify-center">
                <IconComponent size={16} color={social.color} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">
                  {social.label}
                </Text>
                {social.handle !== social.label && (
                  <Text
                    className="text-xs text-muted-foreground"
                    numberOfLines={1}
                  >
                    {social.handle}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

// Menu item type - url is empty string for manual (in-app) menus
type MenuItemType = "pdf" | "link" | "digital";
type MenuItem = { url: string; title: string | null; isManual?: boolean; menuType: MenuItemType };

// Quick Actions Section - Circular buttons like design
const QuickActionsSection: React.FC<{
  restaurant: Restaurant;
  menus: MenuItem[];
  onCall: () => void;
  onWhatsApp: () => void;
  onSelectMenu: (menu: MenuItem, index: number) => void;
  showMenuModal: boolean;
  setShowMenuModal: (show: boolean) => void;
  showContactActions?: boolean;
  showMenuAction?: boolean;
}> = ({
  restaurant,
  menus,
  onCall,
  onWhatsApp,
  onSelectMenu,
  showMenuModal,
  setShowMenuModal,
  showContactActions = true,
  showMenuAction = true,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const hasMenus = menus.length > 0;
  const hasMultipleMenus = menus.length > 1;
  const iconColor = isDark ? "#9ca3af" : "#6b7280";
  // Primary color (burgundy) from theme
  const primaryColor = colors[isDark ? "dark" : "light"].primary;
  // Light burgundy background: darker in dark mode, lighter in light mode
  const ctaBgBurgundy = isDark
    ? "rgba(121, 35, 57, 0.35)"
    : "rgba(121, 35, 57, 0.15)";

  const handleMenuPress = useCallback(() => {
    if (hasMultipleMenus) {
      setShowMenuModal(true);
    } else if (menus.length === 1) {
      onSelectMenu(menus[0], 0);
    }
  }, [hasMultipleMenus, menus, onSelectMenu, setShowMenuModal]);

  const actions: {
    id: string;
    icon: any;
    label: string;
    onPress: () => void;
    color: string;
  }[] = [];

  // Add call action if phone number exists
  if (showContactActions && restaurant.phone_number) {
    actions.push({
      id: "call",
      icon: Phone,
      label: "Call",
      onPress: onCall,
      color: "#007AFF", // Blue
    });
  }

  // Add WhatsApp action if phone number exists
  if (showContactActions && restaurant.phone_number) {
    actions.push({
      id: "whatsapp",
      icon: "whatsapp" as any, // FontAwesome icon name
      label: "WhatsApp",
      onPress: onWhatsApp,
      color: "#25D366", // Green
    });
  }

  // Add Instagram action if Instagram handle exists
  if (showContactActions && restaurant.instagram_handle) {
    const handle = restaurant.instagram_handle;
    const url = handle.startsWith("@")
      ? `https://instagram.com/${handle.slice(1)}`
      : `https://instagram.com/${handle}`;
    actions.push({
      id: "instagram",
      icon: Instagram,
      label: "Instagram",
      onPress: () => {
        Linking.openURL(url).catch(() => {});
      },
      color: "#E4405F", // Pink
    });
  }

  // Add website action if website URL exists
  if (showContactActions && restaurant.website_url) {
    actions.push({
      id: "website",
      icon: ExternalLink,
      label: "Website",
      onPress: () => {
        Linking.openURL(restaurant.website_url!).catch(() => {});
      },
      color: "#007AFF", // Blue link
    });
  }

  // Add menu action if menus exist
  if (showMenuAction && hasMenus) {
    actions.push({
      id: "menu",
      icon: BookOpen,
      label: "Menu",
      onPress: handleMenuPress,
      color: iconColor,
    });
  }

  return (
    <View className="px-5 py-4 border-t border-border/50">
      {/* Circular Action Buttons: N equal columns, button centered in each column */}
      <View className="flex-row" accessibilityLabel="Contact and actions">
        {actions.map((action) => {
          const isWhatsApp = action.id === "whatsapp";
          const a11yLabels: Record<string, string> = {
            call: "Call restaurant",
            whatsapp: "Open WhatsApp",
            instagram: "Open Instagram",
            website: "Open website",
            menu: "View menu",
          };
          return (
            <Pressable
              key={action.id}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={a11yLabels[action.id] ?? action.label}
              className="flex-1 items-center justify-center"
            >
              <View
                className="w-14 h-14 rounded-full items-center justify-center"
                style={{ backgroundColor: ctaBgBurgundy }}
              >
                {isWhatsApp ? (
                  <FontAwesome
                    name="whatsapp"
                    size={20}
                    color={isDark ? "white" : primaryColor}
                  />
                ) : (
                  <action.icon
                    size={20}
                    color={isDark ? "white" : primaryColor}
                  />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Menu Selection Modal */}
      <Modal
        visible={showMenuModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMenuModal(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setShowMenuModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className={`rounded-t-3xl ${isDark ? "bg-zinc-900" : "bg-white"} max-h-[60%] shadow-2xl border-t border-border pb-4`}
            style={{ minHeight: 280 }}
          >
            {/* Modal Header */}
            <View className="flex-row items-center justify-between px-6 py-5 border-b border-border">
              <Text className="text-lg font-bold text-foreground">
                Select a Menu
              </Text>
              <Pressable
                onPress={() => setShowMenuModal(false)}
                className="p-2 rounded-full active:bg-muted"
              >
                <X size={24} color={isDark ? "#fff" : "#000"} />
              </Pressable>
            </View>

            {/* Menu List */}
            <FlatList
              data={menus}
              keyExtractor={(_, index) => `menu-${index}`}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingVertical: 16,
              }}
              renderItem={({ item, index }) => (
                <Pressable
                  onPress={() => {
                    setShowMenuModal(false);
                    onSelectMenu(item, index);
                  }}
                  className="flex-row items-center p-4 mb-3 rounded-xl bg-muted border border-border active:bg-primary/10"
                >
                  <View className="w-11 h-11 rounded-full bg-primary/20 items-center justify-center mr-4">
                    <BookOpen size={22} color="#3b82f6" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground text-base">
                      {item.title || `Menu ${index + 1}`}
                    </Text>
                    <Text className="text-xs text-muted-foreground mt-0.5">
                      {item.menuType === "digital" ? "Browse items" : item.menuType === "link" ? "Opens in browser" : "Tap to view PDF"}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={isDark ? "#999" : "#666"} />
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

// Feature Tags Section - Horizontal scrollable pills (fully dynamic from database)
const FeatureTagsSection: React.FC<{ restaurant: Restaurant }> = ({
  restaurant,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const features: { icon: any; text: string }[] = [];

  // Valet Parking (takes priority over regular parking)
  if (restaurant.valet_parking) {
    features.push({ icon: CarFront, text: "Valet Parking" });
  } else if (restaurant.parking_available) {
    features.push({ icon: Car, text: "Parking" });
  }

  // Outdoor seating
  if (restaurant.outdoor_seating) {
    features.push({ icon: TreePine, text: "Outdoor Seating" });
  }

  // Shisha
  if (restaurant.shisha_available) {
    features.push({ icon: Wind, text: "Shisha" });
  }

  // Live Music (check if schedule exists and has content)
  if (
    restaurant.live_music_schedule &&
    Object.keys(restaurant.live_music_schedule).length > 0
  ) {
    features.push({ icon: Music, text: "Live Music" });
  }

  // Happy Hour (check if times exist and has content)
  if (
    restaurant.happy_hour_times &&
    Object.keys(restaurant.happy_hour_times).length > 0
  ) {
    features.push({ icon: Wine, text: "Happy Hour" });
  }

  // Dietary options
  if (restaurant.dietary_options?.includes("vegetarian")) {
    features.push({ icon: Leaf, text: "Vegetarian" });
  }
  if (restaurant.dietary_options?.includes("vegan")) {
    features.push({ icon: Leaf, text: "Vegan" });
  }

  // Return null if no features available
  if (features.length === 0) return null;

  return (
    <View className="mt-2 mb-1">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 0,
          paddingVertical: 4,
          gap: 6,
        }}
      >
        {features.map((feature, index) => {
          const IconComponent = feature.icon;
          return (
            <View
              key={index}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/30"
            >
              <IconComponent size={16} color={isDark ? "#9ca3af" : "#6b7280"} />
              <Text className="text-xs text-muted-foreground">
                {feature.text}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

// Content Tabs Section - Events, Offers, Menu, Reviews
type TabType = "events" | "offers" | "menu" | "reviews";

const ContentTabsSection: React.FC<{
  restaurant: Restaurant;
  eventsCount: number;
  offersCount: number;
  menusCount: number;
  activeTab: TabType;
  onTabPress: (tab: TabType) => void;
}> = ({
  restaurant,
  eventsCount,
  offersCount,
  menusCount,
  activeTab,
  onTabPress,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = colors[isDark ? "dark" : "light"].primary;

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: "events", label: "Events", count: eventsCount },
    { id: "offers", label: "Offers", count: offersCount },
    { id: "menu", label: "Menu", count: menusCount },
    { id: "reviews", label: "Reviews", count: restaurant.total_reviews || 0 },
  ];

  return (
    <View
      className="mt-2 border-t border-border pt-2"
      accessibilityLabel="Events, offers, menu and reviews"
    >
      {/* Tab Headers */}
      <View className="flex-row border-b border-border px-5">
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => onTabPress(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.id }}
            accessibilityLabel={`${tab.label}${tab.count > 0 ? `, ${tab.count} items` : ""}`}
            className={`flex-1 py-3.5 items-center ${activeTab === tab.id ? "border-b-2" : ""}`}
            style={
              activeTab === tab.id ? { borderBottomColor: primaryColor } : {}
            }
          >
            <Text
              className={`text-sm font-medium ${activeTab === tab.id ? "text-foreground" : "text-muted-foreground"}`}
            >
              {tab.label} {tab.count > 0 ? `(${tab.count})` : ""}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

// Shared section container + card primitives for Events / Offers / Menu / Reviews
interface SectionContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  topSpacing?: boolean;
}

const SectionContainer: React.FC<SectionContainerProps> = ({
  title,
  subtitle,
  children,
  topSpacing = true,
}) => {
  return (
    <View className={`${topSpacing ? "mt-4" : ""} px-5 pt-5 pb-4`}>
      <View className="mb-4">
        <Text
          className="text-xl font-bold text-foreground"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-sm text-muted-foreground mt-1">{subtitle}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
};

interface SectionCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  dimmed?: boolean;
  disabled?: boolean;
  className?: string;
}

const SectionCard: React.FC<SectionCardProps> = ({
  children,
  onPress,
  dimmed,
  disabled,
  className,
}) => {
  const Wrapper: React.ComponentType<any> = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      disabled={disabled}
      className={`rounded-3xl border border-border/60 bg-card/95 px-4 py-3.5 ${
        dimmed ? "opacity-55" : ""
      } ${className ?? ""}`}
    >
      {children}
    </Wrapper>
  );
};

// Offers Section Content — Clean stacked list
const OffersTabContent: React.FC<{
  restaurantId: string;
  restaurantName?: string;
}> = ({ restaurantId, restaurantName }) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = colors[isDark ? "dark" : "light"].primary;
  const router = useRouter();
  const { offers, loading, error } = useRestaurantOffersDetail(restaurantId);

  const handleOfferPress = useCallback(
    (offer: (typeof offers)[0]) => {
      if (offer.isUsed) {
        Alert.alert(
          "Offer Already Used",
          "You have already used this offer. Each offer can only be used once.",
          [{ text: "OK" }],
        );
        return;
      }
      router.push({
        pathname: "/booking/availability",
        params: {
          restaurantId: restaurantId,
          restaurantName: restaurantName || "",
          preselectedOfferId: offer.id,
          offerTitle: offer.title,
          offerDiscount: offer.discount_percentage?.toString() || "",
        },
      });
    },
    [router, restaurantId, restaurantName],
  );

  if (loading) {
    return (
      <SectionContainer title="Offers">
        <View className="items-center justify-center py-4">
          <Text className="text-sm text-muted-foreground">Loading offers...</Text>
        </View>
      </SectionContainer>
    );
  }

  if (error) {
    return (
      <SectionContainer title="Offers">
        <View className="items-center justify-center py-4">
          <Text className="text-destructive text-sm">{error}</Text>
        </View>
      </SectionContainer>
    );
  }

  if (offers.length === 0) {
    return (
      <SectionContainer title="Offers">
        <View className="items-center justify-center rounded-2xl bg-secondary/30 dark:bg-secondary/10 px-4 py-8">
          <Tag size={28} color={primaryColor} strokeWidth={1.5} />
          <Text className="text-sm font-medium text-foreground mt-3 text-center">
            No offers right now
          </Text>
          <Text className="text-xs text-muted-foreground mt-1 text-center">
            We'll let you know when something special comes up.
          </Text>
        </View>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer title="Offers">
      <View className="gap-3">
        {offers.map((offer) => {
          const expiryRaw =
            (offer as any).valid_until ??
            (offer as any).expires_at ??
            (offer as any).end_date ??
            null;
          let expiryLabel: string | null = null;
          if (expiryRaw) {
            const d = new Date(expiryRaw as string);
            if (!Number.isNaN(d.getTime())) {
              expiryLabel = d.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              });
            }
          }

          return (
            <Pressable
              key={offer.id}
              onPress={() => handleOfferPress(offer)}
              disabled={offer.isUsed}
              className={`flex-row items-center px-4 py-4 rounded-2xl active:opacity-80 ${
                offer.isUsed ? "opacity-60" : ""
              }`}
              style={{
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(0,0,0,0.03)",
              }}
            >
              {/* Discount circle */}
              <View
                className="w-14 h-14 rounded-full items-center justify-center mr-4 flex-shrink-0"
                style={{
                  backgroundColor: isDark
                    ? "rgba(200,160,170,0.15)"
                    : "rgba(200,160,170,0.2)",
                }}
              >
                {offer.discount_percentage ? (
                  <Text
                    className="text-sm font-black"
                    style={{ color: offer.isUsed ? "#9ca3af" : primaryColor }}
                  >
                    -{offer.discount_percentage}%
                  </Text>
                ) : (
                  <Tag
                    size={18}
                    color={offer.isUsed ? "#9ca3af" : primaryColor}
                  />
                )}
              </View>

              {/* Content */}
              <View className="flex-1 mr-2">
                <View className="flex-row items-center gap-2">
                  <Text
                    className="text-base font-bold text-foreground flex-shrink"
                    numberOfLines={1}
                  >
                    {offer.title}
                  </Text>
                  {offer.isUsed && (
                    <View className="bg-muted rounded px-2 py-0.5">
                      <Text className="text-[10px] font-semibold text-muted-foreground">
                        Used
                      </Text>
                    </View>
                  )}
                </View>
                {expiryLabel && (
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    Valid until {expiryLabel}
                  </Text>
                )}
                {offer.description && (
                  <Text
                    className="text-xs text-muted-foreground mt-0.5"
                    numberOfLines={2}
                  >
                    {offer.description}
                  </Text>
                )}
              </View>

              {!offer.isUsed && (
                <ChevronRight
                  size={18}
                  color={isDark ? "#6b7280" : "#9ca3af"}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </SectionContainer>
  );
};

// Reviews Tab Content — Rating summary + review cards matching design
const ReviewsTabContent: React.FC<{
  restaurant: Restaurant;
  reviews: Review[];
  restaurantId: string;
  onWriteReview: () => void;
  onShowAllReviews: () => void;
}> = ({
  restaurant,
  reviews,
  restaurantId,
  onWriteReview,
  onShowAllReviews,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = colors[isDark ? "dark" : "light"].primary;

  const reviewSummary = (restaurant.review_summary ?? null) as {
    recommendation_percentage?: number | null;
    average_rating?: number | null;
  } | null;

  const averageRating =
    typeof reviewSummary?.average_rating === "number"
      ? reviewSummary.average_rating
      : (restaurant.average_rating ?? 0);

  const recommendationPercentage =
    typeof reviewSummary?.recommendation_percentage === "number"
      ? reviewSummary.recommendation_percentage
      : 0;

  const totalReviews = restaurant.total_reviews || 0;

  const avatarColors = [
    "#6b21a8",
    "#065f46",
    "#155e75",
    "#92400e",
    "#991b1b",
    "#1e40af",
    "#3730a3",
    "#115e59",
  ];
  const getAvatarColor = (name: string) =>
    avatarColors[(name?.charCodeAt(0) || 65) % avatarColors.length];

  return (
    <View className="gap-4">
      {/* Rating Summary Card */}
      <View className="rounded-2xl border border-border/40 bg-card p-5">
        <View className="flex-row items-center">
          {/* Left: big rating number */}
          <Text className="text-4xl font-black text-foreground mr-4">
            {averageRating > 0 ? averageRating.toFixed(1) : "—"}
          </Text>
          {/* Right: stars + review count */}
          <View className="flex-1">
            <View className="flex-row gap-0.5 mb-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={16}
                  color="#f59e0b"
                  fill={star <= Math.round(averageRating) ? "#f59e0b" : "none"}
                />
              ))}
            </View>
            <Text className="text-sm text-muted-foreground">
              {totalReviews} review{totalReviews !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        {/* Recommendation percentage + bar */}
        {recommendationPercentage > 0 && (
          <View className="mt-3">
            <Text className="text-xs text-muted-foreground mb-1.5">
              {recommendationPercentage}% of guests recommend
            </Text>
            <View className="h-2 bg-border/60 rounded-full overflow-hidden">
              <View
                className="h-2 rounded-full bg-emerald-500"
                style={{ width: `${recommendationPercentage}%` }}
              />
            </View>
          </View>
        )}
      </View>

      {/* Review Cards */}
      {reviews.length > 0 ? (
        <>
          <View className="gap-3">
            {reviews.slice(0, 3).map((review) => {
              const name = review?.user?.full_name || "Guest";
              const initial = name.charAt(0).toUpperCase();
              const bgColor = getAvatarColor(name);

              return (
                <View
                  key={review.id}
                  className="rounded-2xl border border-border/40 bg-card p-4"
                >
                  {/* Header: avatar + name */}
                  <View className="flex-row items-center gap-3 mb-1">
                    {review?.user?.avatar_url ? (
                      <Image
                        source={{ uri: review.user.avatar_url }}
                        style={{ width: 40, height: 40, borderRadius: 20 }}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{ backgroundColor: bgColor }}
                      >
                        <Text className="text-base font-bold text-white">
                          {initial}
                        </Text>
                      </View>
                    )}
                    <Text className="text-sm font-bold text-foreground">
                      {name}
                    </Text>
                  </View>

                  {/* Stars below name, aligned with text */}
                  <View className="flex-row gap-0.5 ml-[52px] mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={14}
                        color="#f59e0b"
                        fill={
                          star <= (review.rating || 0) ? "#f59e0b" : "none"
                        }
                      />
                    ))}
                  </View>

                  {/* Review text */}
                  {review.comment && (
                    <Text
                      className="text-sm text-muted-foreground leading-5"
                      numberOfLines={4}
                    >
                      {review.comment}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* See All Reviews */}
          {totalReviews > 3 && (
            <Pressable
              onPress={onShowAllReviews}
              className="flex-row items-center justify-center gap-1 py-2"
            >
              <Text className="text-sm font-semibold text-primary">
                See all {totalReviews} reviews
              </Text>
              <ChevronRight size={16} color={primaryColor} />
            </Pressable>
          )}
        </>
      ) : (
        <View className="items-center justify-center rounded-2xl bg-secondary/30 dark:bg-secondary/10 px-4 py-8">
          <MessageCircle size={28} color={primaryColor} strokeWidth={1.5} />
          <Text className="text-sm font-medium text-foreground mt-3 text-center">
            No reviews yet
          </Text>
          <Text className="text-xs text-muted-foreground mt-1 text-center">
            Be the first to share your experience.
          </Text>
        </View>
      )}
    </View>
  );
};

// Events Tab Content — Card layout matching design with image, title below, date, time & price
const EventsTabContent: React.FC<{
  restaurantId: string;
  events: any[];
}> = ({ restaurantId, events }) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = colors[isDark ? "dark" : "light"].primary;
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  if (events.length === 0) {
    return (
      <View className="items-center justify-center rounded-2xl bg-secondary/30 dark:bg-secondary/10 px-4 py-8">
        <Calendar size={28} color={primaryColor} strokeWidth={1.5} />
        <Text className="text-sm font-medium text-foreground mt-3 text-center">
          No upcoming events
        </Text>
        <Text className="text-xs text-muted-foreground mt-1 text-center">
          Check back soon for special experiences.
        </Text>
      </View>
    );
  }

  return (
    <>
      <View className="gap-5">
        {events.slice(0, 4).map((event: any) => {
          const todayStr = new Date().toISOString().split("T")[0];
          const nextOccurrence =
            event.occurrences?.find((o: any) => {
              const endStr = o.end_date || o.occurrence_date;
              return endStr >= todayStr && o.status !== "cancelled";
            }) || event.occurrences?.[0];

          const spotsLeft =
            nextOccurrence && nextOccurrence.max_capacity > 0
              ? nextOccurrence.max_capacity - nextOccurrence.current_bookings
              : null;

          // Build combined "Start → End" range string
          const formatTime12h = (t: string) => {
            const parts = t.split(":");
            const h = parseInt(parts[0], 10);
            const m = parts[1] || "00";
            const ampm = h >= 12 ? "PM" : "AM";
            const h12 = h % 12 || 12;
            return `${h12}:${m} ${ampm}`;
          };
          const fmtDate = (d: Date) =>
            d.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            });

          let rangeStr: string | null = null;
          if (nextOccurrence) {
            const occDate = new Date(nextOccurrence.occurrence_date);
            const endDateVal = nextOccurrence.end_date
              ? new Date(nextOccurrence.end_date)
              : null;
            const isMultiDay =
              endDateVal &&
              nextOccurrence.end_date !== nextOccurrence.occurrence_date;
            const startTime = nextOccurrence.start_time || null;
            const endTime = nextOccurrence.end_time || null;

            if (isMultiDay) {
              const startPart = `${fmtDate(occDate)}${startTime ? `, ${formatTime12h(startTime)}` : ""}`;
              const endPart = `${fmtDate(endDateVal)}${endTime ? `, ${formatTime12h(endTime)}` : ""}`;
              rangeStr = `${startPart} → ${endPart}`;
            } else if (startTime && endTime) {
              rangeStr = `${fmtDate(occDate)}, ${formatTime12h(startTime)} - ${formatTime12h(endTime)}`;
            } else if (startTime) {
              rangeStr = `${fmtDate(occDate)}, from ${formatTime12h(startTime)}`;
            } else {
              rangeStr = `${fmtDate(occDate)}, All Day`;
            }
          }

          const hasImage = !!event.image_url;

          return (
            <Pressable
              key={event.id}
              onPress={() => setSelectedEvent(event)}
              className="active:opacity-80"
            >
              {/* Image or placeholder */}
              <View className="rounded-2xl overflow-hidden relative">
                {hasImage ? (
                  <Image
                    source={{ uri: event.image_url }}
                    style={{ width: "100%", height: 200 }}
                    contentFit="cover"
                    optimizationPreset="medium"
                  />
                ) : (
                  <View
                    style={{ width: "100%", height: 200 }}
                    className="bg-muted/30 items-center justify-center"
                  >
                    <Calendar size={40} color={isDark ? "#4b5563" : "#d1d5db"} />
                    <Text className="text-xs text-muted-foreground mt-2">No image</Text>
                  </View>
                )}
                {/* Overlay badges */}
                <View className="absolute top-3 left-3 flex-row gap-2">
                    {event.event_type && (
                      <View className="bg-black/60 rounded-full px-3 py-1.5">
                        <Text className="text-white text-xs font-semibold capitalize">
                          {event.event_type.replace(/_/g, " ")}
                        </Text>
                      </View>
                    )}
                    {spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 10 && (
                      <View className="bg-emerald-600/90 rounded-full px-3 py-1.5">
                        <Text className="text-white text-xs font-bold">
                          {spotsLeft} spots left
                        </Text>
                      </View>
                    )}
                    {spotsLeft !== null && spotsLeft <= 0 && (
                      <View className="bg-red-500/90 rounded-full px-3 py-1.5">
                        <Text className="text-white text-xs font-bold">
                          Sold Out
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

              {/* Info below image */}
              <View className="pt-3 pb-2">
                <Text
                  className="text-lg text-foreground font-bold"
                  numberOfLines={2}
                >
                  {event.title}
                </Text>

                {rangeStr && (
                  <View className="flex-row items-center justify-between mt-1.5">
                    <Text className="text-sm text-foreground">{rangeStr}</Text>
                    <ChevronRight
                      size={18}
                      color={isDark ? "#6b7280" : "#9ca3af"}
                    />
                  </View>
                )}

                <View className="flex-row items-center gap-3 mt-1">
                  {event.price_per_person != null &&
                    event.price_per_person > 0 && (
                      <Text className="text-sm font-bold text-foreground">
                        ${event.price_per_person}
                      </Text>
                    )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {selectedEvent && (
        <EventDetailsModal
          visible={!!selectedEvent}
          event={selectedEvent}
          restaurantId={restaurantId}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </>
  );
};

// Menu Tab Content — Individual cards with icon, name and type badge
const MenuTabContent: React.FC<{
  menus: MenuItem[];
  onSelectMenu: (menu: MenuItem, index: number) => void;
}> = ({ menus, onSelectMenu }) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = colors[isDark ? "dark" : "light"].primary;

  if (menus.length === 0) {
    return (
      <View className="items-center justify-center rounded-2xl border border-dashed border-border/40 px-4 py-6 bg-muted/5">
        <BookOpen size={24} color="#9ca3af" />
        <Text className="text-xs text-muted-foreground mt-2 text-center">
          No menus available yet
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      {menus.map((menu, index) => {
        const isDigital = menu.menuType === "digital";
        const isPdf = menu.menuType === "pdf";
        const badgeLabel = isDigital ? "Digital" : isPdf ? "PDF" : "Link";
        const badgeColor = isDigital
          ? "#2563eb"
          : isPdf
            ? primaryColor
            : "#3b82f6";

        return (
          <Pressable
            key={`menu-${index}`}
            onPress={() => onSelectMenu(menu, index)}
            className="flex-row items-center px-4 py-4 rounded-2xl active:opacity-80"
            style={{
              backgroundColor: isDark
                ? "rgba(255,255,255,0.04)"
                : "rgba(0,0,0,0.03)",
            }}
          >
            {/* Book icon */}
            <View
              className="w-12 h-12 rounded-full items-center justify-center mr-4 flex-shrink-0"
              style={{
                backgroundColor: isDark
                  ? "rgba(200,160,170,0.12)"
                  : "rgba(200,160,170,0.15)",
              }}
            >
              <BookOpen size={20} color={primaryColor} />
            </View>

            {/* Menu name */}
            <Text className="flex-1 text-base font-semibold text-foreground">
              {menu.title || `Menu ${index + 1}`}
            </Text>

            {/* Type badge */}
            <View
              className="rounded px-2.5 py-1 mr-3"
              style={{
                backgroundColor: isDigital
                  ? isDark
                    ? "rgba(37,99,235,0.15)"
                    : "rgba(37,99,235,0.08)"
                  : isPdf
                    ? isDark
                      ? "rgba(121,35,57,0.2)"
                      : "rgba(121,35,57,0.08)"
                    : isDark
                      ? "rgba(59,130,246,0.15)"
                      : "rgba(59,130,246,0.08)",
              }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: badgeColor }}
              >
                {badgeLabel}
              </Text>
            </View>

            <ChevronRight size={18} color={isDark ? "#6b7280" : "#9ca3af"} />
          </Pressable>
        );
      })}
    </View>
  );
};

// Location Map
const LocationMap: React.FC<{
  restaurant: Restaurant;
}> = ({ restaurant }) => {
  const { address, coordinates, isLoading } = useRestaurantLocation(
    restaurant.location,
    restaurant,
  );

  // Default coordinates for Beirut
  const defaultCoordinates: Coordinates = {
    latitude: 33.8938,
    longitude: 35.5018,
  };

  // Use parsed coordinates if available and valid, otherwise use default
  const mapCoordinates =
    coordinates &&
    !isNaN(coordinates.latitude) &&
    !isNaN(coordinates.longitude) &&
    coordinates.latitude !== 0 &&
    coordinates.longitude !== 0
      ? coordinates
      : defaultCoordinates;

  const mapRegion = {
    latitude: mapCoordinates.latitude,
    longitude: mapCoordinates.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <View className="px-4 py-3 border-b border-border/50">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-base font-semibold text-foreground">
          Location
        </Text>
        <DirectionsButton restaurant={restaurant} variant="button" size="sm" />
      </View>

      <View className="rounded-xl overflow-hidden h-40 mb-2 bg-gray-100 border border-border/50">
        <MapView
          style={{ flex: 1 }}
          initialRegion={mapRegion}
          region={mapRegion}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          onMapReady={() => {}}
        >
          <Marker
            coordinate={mapCoordinates}
            title={restaurant.name}
            description={address !== "Loading..." ? address : undefined}
          />
        </MapView>
      </View>

      <View className="flex-row items-center gap-2">
        <MapPin size={14} color="#666" />
        <Text className="text-sm text-muted-foreground flex-1">
          {isLoading ? "Loading location..." : address}
        </Text>
      </View>
    </View>
  );
};

// Reviews Summary
interface ReviewsSummaryProps {
  restaurant: Restaurant;
  reviews: Review[];
  onViewAllReviews: () => void;
  onWriteReview: () => void;
}

const ReviewsSummary: React.FC<ReviewsSummaryProps> = ({
  restaurant,
  reviews,
  onViewAllReviews,
  onWriteReview,
}) => {
  const reviewSummary = (restaurant.review_summary ?? null) as {
    recommendation_percentage?: number | null;
    average_rating?: number | null;
  } | null;

  const recommendationPercentage =
    typeof reviewSummary?.recommendation_percentage === "number"
      ? reviewSummary.recommendation_percentage
      : 0;

  const averageRating =
    typeof reviewSummary?.average_rating === "number"
      ? reviewSummary.average_rating
      : (restaurant.average_rating ?? 0);

  return (
    <View className="px-4 py-3 border-b border-border/50 mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-base font-semibold text-foreground">
          Reviews ({restaurant.total_reviews || 0})
        </Text>
        <Pressable
          onPress={onViewAllReviews}
          className="flex-row items-center gap-1"
        >
          <Text className="text-primary text-sm font-medium">See all</Text>
          <ChevronRight size={14} color="#3b82f6" />
        </Pressable>
      </View>

      {/* Rating Overview */}
      <View className="flex-row items-center gap-4 mb-4 p-3 bg-muted/20 rounded-xl">
        <View className="items-center">
          <Text className="text-2xl font-bold text-foreground">
            {averageRating > 0 ? averageRating.toFixed(1) : "-"}
          </Text>
          <View className="flex-row mb-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={14}
                color="#f59e0b"
                fill={star <= (averageRating || 0) ? "#f59e0b" : "none"}
              />
            ))}
          </View>
        </View>

        <View className="flex-1">
          <Text className="text-xs text-muted-foreground mb-1">
            {recommendationPercentage > 0
              ? `${recommendationPercentage}% recommend`
              : "No recommendation yet"}
          </Text>
          <View className="bg-border rounded-full h-1.5">
            <View
              className="bg-green-500 h-1.5 rounded-full"
              style={{
                width: `${recommendationPercentage}%`,
              }}
            />
          </View>
        </View>
      </View>

      {/* Write a Review Button */}
      <Button variant="outline" onPress={onWriteReview} className="mb-4">
        <View className="flex-row items-center">
          <Edit3 size={16} color="#3b82f6" />
          <Text className="font-semibold text-primary ml-2">
            Write a Review
          </Text>
        </View>
      </Button>

      {/* Recent Reviews */}
      {reviews.length > 0 ? (
        reviews.slice(0, 2).map((review) => (
          <View
            key={review.id}
            className="mb-3 last:mb-0 p-3 bg-muted/10 rounded-xl"
          >
            <View className="flex-row items-center gap-2 mb-2">
              <View className="w-7 h-7 rounded-full bg-primary/20 items-center justify-center">
                <Text className="text-xs font-medium text-primary">
                  {review?.user?.full_name?.charAt(0)}
                </Text>
              </View>
              <Text className="text-sm font-medium text-foreground">
                {review?.user?.full_name}
              </Text>
              <View className="flex-row ml-auto">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={12}
                    color="#f59e0b"
                    fill={star <= (review.rating || 0) ? "#f59e0b" : "none"}
                  />
                ))}
              </View>
            </View>
            <Text className="text-sm text-muted-foreground" numberOfLines={2}>
              {review.comment}
            </Text>
          </View>
        ))
      ) : (
        <View className="items-center py-6">
          <Muted className="text-center">
            No reviews yet. Be the first to share your experience!
          </Muted>
        </View>
      )}
    </View>
  );
};

// Main Component
function RestaurantDetailsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const headerIconColor = colors[isDark ? "dark" : "light"].primary;
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params?.id;
  const { profile } = useAuth();

  // State for non-protected UI elements
  // Defer image rendering until after navigation transition to prevent Glide
  // "can't start loads in RequestListener callbacks" crash on Android.
  const [imagesReady, setImagesReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setImagesReady(true);
    });
    return () => task.cancel();
  }, []);

  const [showImageGallery, setShowImageGallery] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showVerifyPhoneModal, setShowVerifyPhoneModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("events");
  const activeTabRef = useRef<TabType>("events");
  const tabUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const sectionPositions = useRef<{
    events: number;
    offers: number;
    menu: number;
    reviews: number;
  }>({
    events: 0,
    offers: 0,
    menu: 0,
    reviews: 0,
  });
  const tabBarBottom = useRef(0);
  const tabBarY = useRef(0);
  const isAutoScrolling = useRef(false);
  const headerHeight = useRef(100);
  const scrollViewLayout = useRef({ height: 0, contentHeight: 0 });
  const scrollY = useSharedValue(0);
  const tabBarScrollThreshold = useSharedValue(0);
  // UI-thread throttle marker for runOnJS dispatch — avoids hammering the JS
  // thread on every scroll frame under the new architecture.
  const lastTabDispatchY = useSharedValue(0);

  // Animated styles for collapsing image
  const imageAnimatedStyle = useAnimatedStyle(() => {
    const height = interpolate(
      scrollY.value,
      [0, IMAGE_HEIGHT * 2],
      [IMAGE_HEIGHT, 0],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      scrollY.value,
      [0, IMAGE_HEIGHT * 0.6],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return { height, opacity, overflow: 'hidden' as const };
  });

  // Animated styles for header background + title
  const headerBgStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [IMAGE_HEIGHT * 0.1, IMAGE_HEIGHT * 0.5],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  // Animated blur overlay for the main image (gradual blur on scroll)
  const imageBlurStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0.4, IMAGE_HEIGHT * 0.6],
      [0, 0.8],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  const headerTitleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [IMAGE_HEIGHT * 0.345, IMAGE_HEIGHT * 0.75],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  // Sticky tab bar animated style
  const stickyTabStyle = useAnimatedStyle(() => {
    const threshold = tabBarScrollThreshold.value;
    if (threshold <= 0) return { opacity: 0, transform: [{ translateY: -100 }] };
    const shouldShow = scrollY.value >= threshold;
    return {
      opacity: shouldShow ? 1 : 0,
      transform: [{ translateY: shouldShow ? 0 : -100 }],
    };
  });

  // Hooks
  const { shareRestaurantMenu, getShareableLink } = useShare();

  // Guest Guard Hook
  const {
    isGuest,
    showGuestPrompt,
    promptedFeature,
    runProtectedAction,
    handleClosePrompt,
    handleSignUpFromPrompt,
  } = useGuestGuard();

  // Restaurant data hook
  const {
    restaurant,
    reviews,
    isFavorite,
    loading,
    toggleFavorite,
    handleCall,
  } = useRestaurant(id);

  // Booking eligibility check (only when restaurant is loaded)
  const bookingEligibility = useBookingEligibility(
    restaurant || ({} as Restaurant),
  );
  const openVerifyPhoneModal = () => setShowVerifyPhoneModal(true);

  // Restaurant reviews hook for write review functionality
  const { handleWriteReview: handleWriteReviewFromReviews } =
    useRestaurantReviews(id!);

  // Restaurant events hook for events count
  const { events: restaurantEvents } = useRestaurantEvents(id!);

  // Restaurant offers hook for offers count
  const { offers: restaurantOffers } = useRestaurantOffersDetail(id!);

  // Haptic press hooks
  const { handlePress: handleBookingPress } = useBookingPress();
  const { handlePress: handleQuickActionPress } = useQuickActionPress();

  // Action Handlers with Guest Guard
  const handleToggleFavorite = useCallback(() => {
    handleQuickActionPress(() => {
      runProtectedAction(toggleFavorite, "save restaurants");
    });
  }, [runProtectedAction, toggleFavorite, handleQuickActionPress]);

  const handleShare = useCallback(() => {
    if (!restaurant) return;
    handleQuickActionPress(() => {
      setShowShareModal(true);
    });
  }, [restaurant, handleQuickActionPress]);

  const handleWriteReview = useCallback(() => {
    if (!restaurant) return;
    handleQuickActionPress(() => {
      runProtectedAction(
        () => handleWriteReviewFromReviews(),
        "write a review",
      );
    });
  }, [
    runProtectedAction,
    handleWriteReviewFromReviews,
    restaurant,
    handleQuickActionPress,
  ]);

  // FIXED: Navigate to availability screen instead of using BookingWidget
  const handleBookTable = useCallback(() => {
    if (!restaurant) return;
    router.push({
      pathname: "/booking/availability",
      params: {
        restaurantId: id!,
        restaurantName: restaurant.name,
      },
    });
  }, [router, id, restaurant]);

  const handleAttemptBooking = useCallback(() => {
    handleBookingPress(() => {
      // Verify phone: open modal directly (no alert)
      if (bookingEligibility.actionRequired === "verify_phone") {
        openVerifyPhoneModal();
        return;
      }

      // Other eligibility issues: show alert
      if (!bookingEligibility.isEligible) {
        Alert.alert(
          "Booking Not Available",
          bookingEligibility.blockedReason || "Unable to proceed with booking",
          [
            { text: "OK", style: "default" as const },
            ...(bookingEligibility.actionText
              ? [
                  {
                    text: bookingEligibility.actionText,
                    style: "default" as const,
                    onPress: () => {
                      if (bookingEligibility.actionRequired === "sign_up") {
                        router.push("/sign-up");
                      } else if (
                        bookingEligibility.actionRequired ===
                        "add_date_of_birth"
                      ) {
                        router.push("/profile/edit");
                      }
                    },
                  },
                ]
              : []),
          ],
        );
        return;
      }

      runProtectedAction(handleBookTable, "book a table");
    });
  }, [
    runProtectedAction,
    handleBookTable,
    handleBookingPress,
    bookingEligibility,
    router,
    openVerifyPhoneModal,
  ]);

  const allImages = React.useMemo(() => {
    if (!restaurant) return [];
    const images: string[] = [];

    // Add main image if it exists
    if (restaurant.main_image_url) {
      images.push(restaurant.main_image_url);
    }

    // Add additional images if they exist
    if (Array.isArray(restaurant.image_urls)) {
      images.push(...restaurant.image_urls);
    }

    return images.filter(Boolean);
  }, [restaurant]);

  const handleDirections = useCallback(() => {
    handleQuickActionPress(() => {
      if (!restaurant) return;

      // Extract coordinates from restaurant location
      let coords = (restaurant as any).coordinates
        ? {
            lat: (restaurant as any).coordinates.latitude,
            lng: (restaurant as any).coordinates.longitude,
          }
        : null;

      if (!coords && restaurant.location) {
        const extractedCoords = LocationService.extractCoordinates(
          restaurant.location,
        );
        if (extractedCoords) {
          coords = {
            lat: extractedCoords.latitude,
            lng: extractedCoords.longitude,
          };
        }
      }

      // Fallback to default Beirut coordinates
      if (!coords) {
        coords = { lat: 33.8938, lng: 35.5018 };
      }

      const latLng = `${coords.lat},${coords.lng}`;
      const label = encodeURIComponent(restaurant.name);

      Alert.alert(
        "Choose Maps App",
        "Select your preferred maps application:",
        [
          {
            text: "Apple Maps",
            onPress: async () => {
              const url = Platform.select({
                ios: `maps:0,0?q=${label}@${latLng}`,
                android: `geo:0,0?q=${latLng}(${label})`,
              });
              if (url) {
                try {
                  await Linking.openURL(url);
                } catch (error) {
                  console.error("Error opening Apple Maps:", error);
                  Alert.alert("Error", "Unable to open Apple Maps");
                }
              }
            },
          },
          {
            text: "Google Maps",
            onPress: async () => {
              const url = `https://www.google.com/maps/dir/?api=1&destination=${latLng}&destination_place_id=${label}`;
              try {
                await Linking.openURL(url);
              } catch (error) {
                console.error("Error opening Google Maps:", error);
                Alert.alert("Error", "Unable to open Google Maps");
              }
            },
          },
          { text: "Cancel", style: "cancel" },
        ],
        { cancelable: true },
      );
    });
  }, [restaurant, handleQuickActionPress]);

  const handleWhatsApp = useCallback(() => {
    handleQuickActionPress(async () => {
      if (restaurant?.phone_number) {
        const cleanPhone = restaurant.phone_number.replace(/[^0-9]/g, "");
        const waUrl = `whatsapp://send?phone=${cleanPhone}`;
        const canOpen = await Linking.canOpenURL(waUrl);
        if (canOpen) {
          await Linking.openURL(waUrl);
        } else {
          // Fall back to https://wa.me which opens browser if WhatsApp not installed
          await Linking.openURL(`https://wa.me/${cleanPhone}`).catch(() => {
            Alert.alert("WhatsApp Unavailable", "WhatsApp is not installed on this device.");
          });
        }
      }
    });
  }, [restaurant?.phone_number, handleQuickActionPress]);

  const handleViewAllReviews = useCallback(() => {
    handleQuickActionPress(() => {
      router.push({
        pathname: "/restaurant/[id]/reviews",
        params: { id: id! },
      });
    });
  }, [router, id, handleQuickActionPress]);

  // Check if restaurant has manual menu categories
  const [hasManualMenu, setHasManualMenu] = useState(false);
  useEffect(() => {
    if (!id) return;
    supabase
      .from("menu_categories")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", id)
      .eq("is_active", true)
      .then(({ count }) => {
        setHasManualMenu((count ?? 0) > 0);
      });
  }, [id]);

  // Build menus array from restaurant data (URL menus + manual menu)
  const menus: MenuItem[] = useMemo(() => {
    if (!restaurant) return [];

    const result: MenuItem[] = [];

    // Extract menus from menu_urls jsonb array
    const restaurantData = restaurant as any;

    // Helper: detect if a URL points to a PDF
    const isPdfUrl = (url: string) => {
      const lower = url.toLowerCase();
      return lower.endsWith(".pdf") || lower.includes("/pdf/") || lower.includes("content-type=application/pdf");
    };

    // Check for menu_urls structure with {url, title}
    if (restaurantData.menu_urls && Array.isArray(restaurantData.menu_urls)) {
      const urlMenus = restaurantData.menu_urls
        .filter((m: any) => m && m.url)
        .map((m: any) => ({
          url: m.url,
          title: m.title || null,
          menuType: isPdfUrl(m.url) ? "pdf" as const : "link" as const,
        }));
      result.push(...urlMenus);
    }

    // Add manual menu entry if categories exist in the database
    if (hasManualMenu) {
      result.push({ url: "", title: "Digital Menu", isManual: true, menuType: "digital" as const });
    }

    return result;
  }, [restaurant, hasManualMenu]);

  const handleSelectMenu = useCallback(
    (menu: MenuItem, index: number) => {
      if (!restaurant) return;
      handleQuickActionPress(() => {
        if (menu.menuType === "digital") {
          // Digital menu: navigate without menuUrl so MenuScreen shows the in-app menu
          router.push({
            pathname: "/restaurant/menu/[restaurantId]",
            params: {
              restaurantId: restaurant.id,
            },
          });
        } else if (menu.menuType === "link") {
          // Regular web URL: open in browser
          Linking.openURL(menu.url);
        } else {
          // PDF: navigate to menu screen with PDF viewer
          router.push({
            pathname: "/restaurant/menu/[restaurantId]",
            params: {
              restaurantId: restaurant.id,
              menuUrl: menu.url,
              menuTitle: menu.title || `Menu ${index + 1}`,
            },
          });
        }
      });
    },
    [router, restaurant?.id, handleQuickActionPress],
  );

  const handleSocialPress = useCallback(
    (url: string, platform: string) => {
      handleQuickActionPress(() => {
        Linking.openURL(url).catch(() => {});
      });
    },
    [handleQuickActionPress],
  );

  const { handlePress: handleModalPress } = useModalPress();

  const handleImagePress = useCallback(
    (index: number) => {
      handleModalPress(() => {
        setSelectedImageIndex(index);
        setShowImageGallery(true);
      });
    },
    [handleModalPress],
  );

  const handleTabPress = useCallback(
    (tab: TabType) => {
      activeTabRef.current = tab;
      setActiveTab(tab);
      const positions = sectionPositions.current;
      const rawY =
        tab === "events"
          ? positions.events
          : tab === "offers"
            ? positions.offers
            : tab === "menu"

              ? positions.menu
              : positions.reviews;

      // Scroll so the section title sits just below the fixed header.
      // sectionPositions are relative to the ScrollView content container.
      // We subtract headerHeight so the section isn't hidden behind the
      // absolute-positioned header, plus a small padding.
      const targetY = Math.max(0, rawY - headerHeight.current - 420);

      const doScroll = (scrollable: { scrollTo: (opts: { y: number; animated: boolean }) => void }) => {
        isAutoScrolling.current = true;
        scrollable.scrollTo({ y: targetY, animated: true });
        setTimeout(() => {
          isAutoScrolling.current = false;
        }, 600);
      };

      if (scrollViewRef.current && typeof scrollViewRef.current.scrollTo === 'function') {
        doScroll(scrollViewRef.current);
      } else if (scrollViewRef.current) {
        const responder = (scrollViewRef.current as any).getScrollResponder?.();
        if (responder && typeof responder.scrollTo === 'function') {
          doScroll(responder);
        }
      }
    },
    [],
  );

  // Throttled tab highlight update — only crosses JS bridge every 100ms
  const lastTabUpdate = useRef(0);
  const pendingScrollY = useRef(0);
  const tabUpdateRaf = useRef<ReturnType<typeof setTimeout> | null>(null);

  const computeActiveTab = useCallback((y: number) => {
    if (isAutoScrolling.current) return;
    const pos = sectionPositions.current;
    const buffer = headerHeight.current + 80;
    const scrollPos = y + buffer;
    const { height: viewH, contentHeight: contentH } = scrollViewLayout.current;
    const isAtBottom = viewH > 0 && contentH > 0 && y + viewH >= contentH - 50;

    let newTab: TabType = "events";
    if (isAtBottom && pos.reviews > 0) {
      newTab = "reviews";
    } else if (pos.reviews > 0 && scrollPos >= pos.reviews) {
      newTab = "reviews";
    } else if (pos.menu > 0 && scrollPos >= pos.menu) {
      newTab = "menu";
    } else if (pos.offers > 0 && scrollPos >= pos.offers) {
      newTab = "offers";
    }
    if (activeTabRef.current !== newTab) {
      activeTabRef.current = newTab;
      setActiveTab(newTab);
    }
  }, []);

  const throttledTabUpdate = useCallback((y: number) => {
    pendingScrollY.current = y;
    const now = Date.now();
    if (now - lastTabUpdate.current >= 100) {
      lastTabUpdate.current = now;
      computeActiveTab(y);
    } else if (!tabUpdateRaf.current) {
      tabUpdateRaf.current = setTimeout(() => {
        tabUpdateRaf.current = null;
        lastTabUpdate.current = Date.now();
        computeActiveTab(pendingScrollY.current);
      }, 100);
    }
  }, [computeActiveTab]);

  // Regular JS scroll handler for tab highlighting (reliable fallback)
  const handleJsScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      computeActiveTab(event.nativeEvent.contentOffset.y);
    },
    [computeActiveTab],
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      const y = event.contentOffset.y;
      scrollY.value = y;
      // Only cross the JS bridge when the offset moves enough to matter for
      // tab highlighting. The JS-side throttle still applies on top of this.
      if (Math.abs(y - lastTabDispatchY.value) > 24) {
        lastTabDispatchY.value = y;
        runOnJS(throttledTabUpdate)(y);
      }
    },
  });

  // Loading and Error States
  if (loading) {
    return <RestaurantDetailsScreenSkeleton />;
  }

  if (!restaurant) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4">
          <H3 className="text-center mb-2">Restaurant not found</H3>
          <P className="text-center text-muted-foreground mb-4">
            The restaurant you're looking for doesn't exist or has been removed.
          </P>
          <Button
            variant="outline"
            onPress={() => router.back()}
            className="mt-4"
          >
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Header with Back, Share and Heart buttons */}
      <View
        className="absolute top-0 left-0 right-0 z-50"
        onLayout={(e) => { headerHeight.current = e.nativeEvent.layout.height; }}
      >
        {/* Animated header background - blurred image */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: -20,
              overflow: 'hidden',
              borderBottomLeftRadius: 6,
              borderBottomRightRadius: 6,
            },
            headerBgStyle,
          ]}
        >
          {imagesReady && allImages[0] && (
            <Image
              source={{ uri: allImages[0] }}
              blurRadius={25}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              contentFit="cover"
              optimizationPreset="thumbnail"
            />
          )}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.45)',
            }}
          />
        </Animated.View>
        <SafeAreaView edges={["top"]}>
          <View className="flex-row items-center justify-between px-4 py-1">
            {/* Back Button */}
            <Pressable
              onPress={() => router.back()}
              className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? "bg-black/50" : "bg-white/50"}`}
            >
              <ChevronLeft
                size={24}
                color={isDark ? "white" : headerIconColor}
              />
            </Pressable>

            {/* Restaurant name - appears on scroll */}
            <Animated.Text
              numberOfLines={1}
              style={[
                {
                  flex: 1,
                  marginLeft: 12,
                  marginRight: 12,
                  fontSize: 16,
                  fontWeight: '800',
                  color: '#fff',
                  textAlign: 'left',
                  textShadowColor: 'rgba(0,0,0,0.5)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 4,
                },
                headerTitleStyle,
              ]}
            >
              {restaurant?.name || ''}
            </Animated.Text>

            {/* Right side buttons - Share and Heart */}
            <View className="flex-row gap-3">
              <Pressable
                onPress={handleShare}
                disabled={!restaurant}
                className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? "bg-black/50" : "bg-white/50"}`}
                style={{ opacity: restaurant ? 1 : 0.5 }}
              >
                <Share2 size={20} color={isDark ? "white" : headerIconColor} />
              </Pressable>
              <Pressable
                onPress={handleToggleFavorite}
                className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? "bg-black/50" : "bg-white/50"}`}
              >
                <Heart
                  size={20}
                  color={
                    isFavorite ? "#ef4444" : isDark ? "white" : headerIconColor
                  }
                  fill={isFavorite ? "#ef4444" : "none"}
                />
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <AnimatedRefScrollView
        ref={(node: any) => {
          scrollViewRef.current = node;
        }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        style={{ marginBottom: 40 }}
        contentContainerStyle={{ paddingBottom: 80 }}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        onMomentumScrollEnd={handleJsScroll}
        onScrollEndDrag={handleJsScroll}
        onLayout={(e) => {
          scrollViewLayout.current.height = e.nativeEvent.layout.height;
        }}
        onContentSizeChange={(_w, h) => {
          scrollViewLayout.current.contentHeight = h;
        }}
      >
        <Animated.View style={imageAnimatedStyle}>
          {imagesReady && <ImageGallery images={allImages} onImagePress={handleImagePress} />}
          {/* Gradual blur overlay on scroll */}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              },
              imageBlurStyle,
            ]}
          >
            {imagesReady && allImages[0] && (
              <Image
                source={{ uri: allImages[0] }}
                blurRadius={30}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                optimizationPreset="thumbnail"
              />
            )}
          </Animated.View>
        </Animated.View>

        {/* 1. Name, cuisine, description, location, hours */}
        <RestaurantHeaderInfo
          restaurant={restaurant}
          restaurantId={id!}
          onViewAllReviews={handleViewAllReviews}
        />

        {/* 2. Quick Actions - Circular buttons (CTAs) */}
        <QuickActionsSection
          restaurant={restaurant}
          menus={menus}
          onCall={() => handleCall(restaurant)}
          onWhatsApp={handleWhatsApp}
          onSelectMenu={handleSelectMenu}
          showMenuModal={showMenuModal}
          setShowMenuModal={setShowMenuModal}
          showContactActions
          showMenuAction={false}
        />

        {/* 3. Tabs - Events, Offers, Menu, Reviews (scrolls to sections) */}
        <View
          onLayout={(e) => {
            tabBarBottom.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
            tabBarY.current = e.nativeEvent.layout.y;
            tabBarScrollThreshold.value = e.nativeEvent.layout.y - headerHeight.current;
          }}
        >
          <ContentTabsSection
            restaurant={restaurant}
            eventsCount={restaurantEvents?.length || 0}
            offersCount={restaurantOffers?.length || 0}
            menusCount={menus.length}
            activeTab={activeTab}
            onTabPress={handleTabPress}
          />
        </View>

        {/* 4. Events Section */}
        <View
          onLayout={(event) => {
            sectionPositions.current.events = event.nativeEvent.layout.y;
          }}
          className="mt-2"
        >
          <SectionContainer
            title="Upcoming Events"
            subtitle={`Special events and experiences at ${restaurant.name}`}
          >
            <EventsTabContent
              restaurantId={id!}
              events={restaurantEvents || []}
            />
          </SectionContainer>
        </View>

        {/* 5. Offers Section */}
        <View
          onLayout={(event) => {
            sectionPositions.current.offers = event.nativeEvent.layout.y;
          }}
        >
          <OffersTabContent
            restaurantId={id!}
            restaurantName={restaurant.name}
          />
        </View>

        {/* 6. Menu Section */}
        <View
          onLayout={(event) => {
            sectionPositions.current.menu = event.nativeEvent.layout.y;
          }}
        >
          <SectionContainer
            title="Menu"
            subtitle={menus.length > 0 ? `${menus.length} available` : undefined}
          >
            <MenuTabContent menus={menus} onSelectMenu={handleSelectMenu} />
          </SectionContainer>
        </View>

        {/* 7. Reviews Section */}
        <View
          onLayout={(event) => {
            sectionPositions.current.reviews = event.nativeEvent.layout.y;
          }}
        >
          <SectionContainer title="Reviews">
            <ReviewsTabContent
              restaurant={restaurant}
              restaurantId={id!}
              reviews={reviews}
              onWriteReview={handleWriteReview}
              onShowAllReviews={handleViewAllReviews}
            />
          </SectionContainer>
        </View>

      </AnimatedRefScrollView>

      {/* Sticky Tab Bar - Appears when scrolled past inline tabs */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            zIndex: 40,
          },
          stickyTabStyle,
        ]}
        pointerEvents="box-none"
      >
        <View
          style={{ marginTop: headerHeight.current }}
          className="bg-background border-b border-border"
          pointerEvents="auto"
        >
          <ContentTabsSection
            restaurant={restaurant}
            eventsCount={restaurantEvents?.length || 0}
            offersCount={restaurantOffers?.length || 0}
            menusCount={menus.length}
            activeTab={activeTab}
            onTabPress={handleTabPress}
          />
        </View>
      </Animated.View>

      {/* Floating Book Button - No BookingWidget */}
      <View
        className="absolute bottom-0 left-0 right-0 mt-5"
        pointerEvents="box-none"
      >
        <SafeAreaView edges={["bottom"]}>
          <View className="px-4 pt-3 pb-4 bg-background border-t border-border">
            <Button
              onPress={handleAttemptBooking}
              size="lg"
              className="w-full rounded-2xl"
              variant={
                bookingEligibility.isEligible ||
                bookingEligibility.actionRequired === "verify_phone"
                  ? "default"
                  : "secondary"
              }
              disabled={
                !bookingEligibility.isEligible &&
                bookingEligibility.actionRequired !== "verify_phone"
              }
              accessibilityLabel={
                bookingEligibility.actionRequired === "verify_phone"
                  ? "Verify phone number"
                  : bookingEligibility.isEligible
                    ? "Book a table"
                    : bookingEligibility.actionText || "Booking not available"
              }
              accessibilityRole="button"
            >
              <View className="flex-row items-center justify-center gap-2">
                {bookingEligibility.actionRequired === "verify_phone" ? (
                  <>
                    <Phone size={20} color="white" />
                    <Text className="text-white font-bold text-lg">
                      {bookingEligibility.actionText || "Verify Phone"}
                    </Text>
                  </>
                ) : !bookingEligibility.isEligible ? (
                  <>
                    <Calendar size={20} color="#666" />
                    <Text className="text-muted-foreground font-bold text-lg">
                      {bookingEligibility.actionText || "Not Available"}
                    </Text>
                  </>
                ) : (
                  <>
                    <Calendar size={20} color="white" />
                    <Text className="text-white font-bold text-lg">
                      Book a Table
                    </Text>
                  </>
                )}
              </View>
            </Button>

            {/* Instant Booking Badge */}
            {restaurant.booking_policy === "instant" && (
              <View
                className="flex-row items-center justify-center gap-2 mt-2"
                accessibilityLabel="Instant confirmation available"
              >
                <CheckCircle size={14} color="#10b981" />
                <Text className="text-xs text-muted-foreground">
                  Instant confirmation available
                </Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>

      {/* Modals */}
      <GuestPromptModal
        visible={showGuestPrompt}
        onClose={handleClosePrompt}
        onSignUp={handleSignUpFromPrompt}
        featureName={promptedFeature}
      />

      {/* Image Gallery Modal */}
      <ImageGalleryModal
        visible={showImageGallery}
        images={allImages}
        initialIndex={selectedImageIndex}
        onClose={() => setShowImageGallery(false)}
      />

      {restaurant && (
        <ShareModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          title={`Share ${restaurant.name}`}
          description="Share this restaurant with your friends"
          shareOptions={{
            url: getShareableLink(`/restaurant/${restaurant.id}`),
            title: restaurant.name,
            message: `Check out ${restaurant.name} on ForkCast! ${restaurant.cuisine_type} • ${"$".repeat(
              Math.max(restaurant.price_range || 2, 1),
            )}`,
            subject: `${restaurant.name} - ForkCast`,
          }}
          customActions={[
            {
              id: "share-menu",
              title: "Share Menu",
              description: "Share the restaurant's menu",
              icon: BookOpen,
              onPress: async () => {
                await shareRestaurantMenu(restaurant.id, restaurant.name);
              },
            },
          ]}
        />
      )}

      <VerifyPhoneModal
        visible={showVerifyPhoneModal}
        onClose={() => setShowVerifyPhoneModal(false)}
        onVerified={() => {
          setShowVerifyPhoneModal(false);
        }}
        showSkip={true}
        initialPhoneE164={profile?.phone ?? null}
      />
    </View>
  );
}

export default function RestaurantDetailsScreenWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <RestaurantDetailsScreen />
    </ErrorBoundary>
  );
}
