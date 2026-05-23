import React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  SharedValue,
} from "react-native-reanimated";
import { Image } from "@/components/image";
import { useColorScheme } from "@/lib/useColorScheme";
import { LocationDisplay } from "../search/LocationDisplay";
import { HomeSearchBar } from "./HomeSearchBar";

/** Profile data for header display */
interface ProfileData {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  avatar_url?: string;
}

/** Location data for header display */
interface LocationData {
  latitude: number;
  longitude: number;
  city?: string;
  district?: string;
  country?: string;
}

interface HomeHeaderProps {
  profile: ProfileData | null;
  isGuest: boolean;
  location: LocationData | null;
  scrollY: SharedValue<number>;
  collapsibleHeaderHeight: number;
  refreshing: boolean;
  setTotalHeaderHeight: (height: number | ((prev: number) => number)) => void;
  setCollapsibleHeaderHeight: (height: number) => void;
  onLocationPress: () => void;
  onProfilePress: () => void;
  onSearchPress: () => void;
}

export function HomeHeader({
  profile,
  isGuest,
  location,
  scrollY,
  collapsibleHeaderHeight,
  refreshing,
  setTotalHeaderHeight,
  setCollapsibleHeaderHeight,
  onLocationPress,
  onProfilePress,
  onSearchPress,
}: HomeHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();

  const headerTopPadding = insets.top + 8;
  const headerBottomPadding = 10;

  // Same translateY for greeting+location and search bar: both move up; search bar ends up pinned at top
  const scrollTranslateY = useAnimatedStyle(() => {
    if (refreshing) return { transform: [{ translateY: 0 }] };
    const translateY = interpolate(
      scrollY.value,
      [-100, 0, collapsibleHeaderHeight],
      [0, 0, -collapsibleHeaderHeight],
      Extrapolation.CLAMP,
    );
    return { transform: [{ translateY }] };
  });

  const collapsibleBlockStyle = useAnimatedStyle(() => {
    if (refreshing) return { opacity: 1 };
    return {
      opacity: interpolate(
        scrollY.value,
        [-100, 0, collapsibleHeaderHeight * 0.7],
        [1, 1, 0],
        Extrapolation.CLAMP,
      ),
    };
  });


  return (
    <Animated.View
      className="absolute top-0 left-0 right-0"
      style={{
        paddingTop: headerTopPadding,
        paddingBottom: headerBottomPadding,
        zIndex: 50,
        elevation: 50,
        overflow: "visible",
      }}
      pointerEvents="box-none"
      onLayout={(event) => {
        const h = Math.round(event.nativeEvent.layout.height);
        setTotalHeaderHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
      }}
    >
      {/* Safe area fill: white/background so status bar + island area isn't transparent */}
      <View
        className="bg-background"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: headerTopPadding,
          zIndex: 0,
        }}
        pointerEvents="none"
      />

      {/* Greeting + location: move up and fade on scroll */}
      <Animated.View
        onLayout={(event) => {
          setCollapsibleHeaderHeight(event.nativeEvent.layout.height);
        }}
        style={[scrollTranslateY, collapsibleBlockStyle]}
        pointerEvents="box-none"
      >
        <View
          className="flex-row items-center justify-between px-4 pt-4 pb-2 bg-background"
          pointerEvents="box-none"
        >
          <View className="flex-1" pointerEvents="none">
            <Text className="text-2xl font-bold text-foreground">
              Hello{" "}
              {profile?.first_name ||
                profile?.full_name?.split(" ")[0] ||
                "there"}{" "}
              <Text className="text-2xl">👋</Text>
            </Text>
          </View>

          <Pressable
            onPress={() => router.push("/profile")}
            style={({ pressed }) => ({
              marginLeft: 12,
              padding: 4,
              zIndex: 999,
              elevation: 999,
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            pointerEvents="box-only"
          >
            <View style={{ position: "relative", zIndex: 999, elevation: 999 }}>
              <Image
                {...({
                  source: profile?.avatar_url
                    ? { uri: profile.avatar_url }
                    : require("@/assets/default-avatar.jpeg"),
                  optimizationPreset: "thumbnail",
                  style: {
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    borderWidth: 2,
                    borderColor:
                      colorScheme === "dark"
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.2)",
                  },
                  contentFit: "cover",
                } as any)}
              />
            </View>
          </Pressable>
        </View>

        <View className="px-4 pb-2 bg-background">
          <LocationDisplay />
        </View>
      </Animated.View>

      {/* Search bar: moves up with header and pins at top; white strip when collapsed */}
      <Animated.View
        style={[scrollTranslateY, { paddingTop: 14, paddingBottom: 14 }]}
        className="px-4 bg-background w-full"
      >
        <View className="bg-background rounded-full w-full">
          <HomeSearchBar onPress={onSearchPress} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}
