// app/(protected)/(tabs)/_layout.tsx
import React, { useMemo } from "react";
import { Platform, View, Pressable, DeviceEventEmitter } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "@/lib/useColorScheme";
import { getThemedColors } from "@/lib/utils";
import { useBookingsStore } from "@/stores";

// --- Fallback JS Tabs import
import { Tabs } from "expo-router";
import { Home, Search, Heart, Calendar, User } from "lucide-react-native";

// --- Optional kill switch (recommended)
// Set EXPO_PUBLIC_ENABLE_NATIVE_TABS="false" to force fallback without redeploying code changes.
const ENABLE_NATIVE_TABS =
  (process.env.EXPO_PUBLIC_ENABLE_NATIVE_TABS ?? "true") === "true";

// --- Lazy/optional import for NativeTabs (prevents hard crashes if module missing)
// NOTE: NativeTabs is only enabled on iOS due to rendering issues on Android
type NativeTabsModule = typeof import("expo-router/unstable-native-tabs");
let Native: NativeTabsModule | null = null;

if (ENABLE_NATIVE_TABS && Platform.OS === "ios") {
  try {
    Native = require("expo-router/unstable-native-tabs") as NativeTabsModule;
  } catch {
    Native = null;
  }
}

function NativeTabsLayout() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);
  const { upcomingBookings } = useBookingsStore();

  const upcomingCount = useMemo(
    () => (upcomingBookings || []).length,
    [upcomingBookings],
  );

  const badgeText =
    upcomingCount > 0
      ? upcomingCount > 9
        ? "9+"
        : String(upcomingCount)
      : null;

  // If module isn't available, caller should not render this
  const { NativeTabs, Icon, Label, Badge } = Native!;

  return (
    <NativeTabs
      tintColor={themedColors.primary}
      labelStyle={{
        color:
          colorScheme === "dark" ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.8)",
        fontSize: 10,
      }}
      // @ts-ignore style prop exists at runtime
      style={{ paddingBottom: insets.bottom }}
      disableTransparentOnScrollEdge
    >
      <NativeTabs.Trigger name="index">
        {/* @ts-ignore md prop is valid on Android */}
        <Icon sf="house.fill" md="home" />
        <Label>Home</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search" role="search">
        {/* @ts-ignore md prop is valid on Android */}
        <Icon sf="magnifyingglass" md="search" />
        <Label>Search</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="favorites">
        {/* @ts-ignore md prop is valid on Android */}
        <Icon sf="heart.fill" md="favorite" />
        <Label>Favorites</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="bookings">
        {/* @ts-ignore md prop is valid on Android */}
        <Icon sf="calendar" md="calendar_month" />
        <Label>Bookings</Label>
        {badgeText ? <Badge>{badgeText}</Badge> : null}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function JsTabsFallbackLayout() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);
  const { upcomingBookings } = useBookingsStore();

  const upcomingCount = useMemo(
    () => (upcomingBookings || []).length,
    [upcomingBookings],
  );

  const tabBarBg =
    colorScheme === "dark" ? "rgb(30,25,28)" : "rgb(255,250,248)";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          borderTopWidth: 0,
          paddingBottom: 6 + insets.bottom,
          paddingTop: 6,
          height: 52 + insets.bottom,
          backgroundColor: tabBarBg,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarBackground: () => (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: tabBarBg,
            }}
          />
        ),
        tabBarActiveTintColor: themedColors.primary,
        tabBarInactiveTintColor: themedColors.mutedForeground,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} strokeWidth={2} />
          ),
          tabBarButton: (props) => (
            // @ts-ignore ref type mismatch in tab bar button context
            <Pressable
              {...props}
              onPress={(e) => {
                props.onPress?.(e as any);
                // Emit after navigation so the Home screen is active when scrolling
                // Disabled on Android to prevent unwanted scroll-to-top on tab press
                if (Platform.OS !== 'android') {
                  setTimeout(() => DeviceEventEmitter.emit('scrollHomeToTop'), 150);
                }
              }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, size }) => (
            <Search size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: "Favorites",
          tabBarIcon: ({ color, size }) => (
            <Heart size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarIcon: ({ color, size }) => (
            <Calendar size={size} color={color} strokeWidth={2} />
          ),
          tabBarBadge:
            upcomingCount > 0
              ? upcomingCount > 9
                ? "9+"
                : String(upcomingCount)
              : undefined,
          tabBarBadgeStyle: {
            backgroundColor: themedColors.primary,
            color: themedColors.primaryForeground,
            fontSize: 10,
            minWidth: 18,
            height: 18,
          },
        }}
      />
    </Tabs>
  );
}

export default function TabsLayout() {
  // If NativeTabs module isn't available, use fallback
  if (!Native) return <JsTabsFallbackLayout />;

  // Extra safety: if NativeTabs throws on some devices, fallback instead of blank screen.
  try {
    return <NativeTabsLayout />;
  } catch {
    return <JsTabsFallbackLayout />;
  }
}

TabsLayout.displayName = "TabsLayout";
