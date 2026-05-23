import React from "react";
import { View, ScrollView, Pressable, StatusBar, Dimensions } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_HEIGHT = Math.min(SCREEN_HEIGHT * 0.6, 400);

const RestaurantDetailsScreenSkeleton = () => {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const overlayBg = isDark ? "bg-black/50" : "bg-white/50";
  const overlayIconColor = isDark
    ? "white"
    : colors[isDark ? "dark" : "light"].primary;

  return (
    <View className="flex-1 bg-background">
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Header - matches real screen: back left, share + heart right */}
      <View className="absolute top-0 left-0 right-0 z-50">
        <SafeAreaView edges={["top"]}>
          <View className="flex-row items-center justify-between p-4">
            <Pressable
              onPress={() => router.back()}
              className={`w-10 h-10 rounded-full items-center justify-center ${overlayBg}`}
            >
              <ChevronLeft size={24} color={overlayIconColor} />
            </Pressable>
            <View className="flex-row gap-3">
              <View className={`w-10 h-10 rounded-full ${overlayBg}`} />
              <View className={`w-10 h-10 rounded-full ${overlayBg}`} />
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Image gallery - matches IMAGE_HEIGHT */}
        <View style={{ height: IMAGE_HEIGHT }}>
          <SkeletonPlaceholder width="100%" height="100%" borderRadius={0} />
        </View>

        {/* RestaurantHeaderInfo card: rounded-t-3xl with overlap */}
        <View className="bg-background rounded-t-3xl -mt-6 pt-6 px-5 pb-6">
          {/* Name + badge + rating row */}
          <View className="flex-row items-start justify-between mb-5">
            <View className="flex-1 pr-4">
              <View className="flex-row items-center gap-2 mb-1.5 flex-wrap">
                <SkeletonPlaceholder width="55%" height={28} borderRadius={6} />
                <SkeletonPlaceholder width={90} height={24} borderRadius={9999} />
              </View>
              <SkeletonPlaceholder width="45%" height={14} borderRadius={4} />
            </View>
            <View className="items-end flex-shrink-0">
              <SkeletonPlaceholder width={36} height={24} borderRadius={4} style={{ marginBottom: 6 }} />
              <SkeletonPlaceholder width={55} height={12} borderRadius={4} />
            </View>
          </View>

          {/* Description row: icon circle + text + chevron */}
          <View className="flex-row items-center gap-3 mb-3">
            <View className="w-8 h-8 rounded-full bg-muted" />
            <SkeletonPlaceholder width="70%" height={14} borderRadius={4} />
            <View className="w-7 h-7 rounded-full bg-muted" />
          </View>

          {/* Location row: icon circle + text + nav button */}
          <View className="flex-row items-center gap-3 mb-3">
            <View className="w-8 h-8 rounded-full bg-muted" />
            <SkeletonPlaceholder width="65%" height={14} borderRadius={4} />
            <View className="w-7 h-7 rounded-full bg-muted" />
          </View>

          {/* Hours row: icon circle + text + OPEN pill + chevron */}
          <View className="flex-row items-center gap-3 mb-3">
            <View className="w-8 h-8 rounded-full bg-muted" />
            <SkeletonPlaceholder width="40%" height={14} borderRadius={4} />
            <SkeletonPlaceholder width={48} height={20} borderRadius={9999} />
            <View className="w-7 h-7 rounded-full bg-muted" style={{ marginLeft: "auto" }} />
          </View>

          {/* Feature tags: horizontal pills */}
          <View className="flex-row gap-2 mt-1">
            <SkeletonPlaceholder width={85} height={28} borderRadius={9999} />
            <SkeletonPlaceholder width={120} height={28} borderRadius={9999} />
          </View>
        </View>

        {/* Quick Actions: 4 circles */}
        <View className="px-5 py-4 border-t border-border/50">
          <View className="flex-row">
            {[1, 2, 3, 4].map((i) => (
              <View key={i} className="flex-1 items-center">
                <View className="w-14 h-14 rounded-full bg-muted" />
              </View>
            ))}
          </View>
        </View>

        {/* Tabs: Events, Offers, Menu, Reviews - 4 tabs */}
        <View className="mt-2 border-t border-border pt-2">
          <View className="flex-row border-b border-border px-5">
            {[1, 2, 3, 4].map((i) => (
              <View key={i} className="flex-1 py-3.5 items-center">
                <SkeletonPlaceholder width={56} height={14} borderRadius={4} />
              </View>
            ))}
          </View>
        </View>

        {/* Section content placeholders */}
        <View className="px-5 py-4">
          <SkeletonPlaceholder width="100%" height={56} borderRadius={12} style={{ marginBottom: 12 }} />
          <SkeletonPlaceholder width="100%" height={56} borderRadius={12} style={{ marginBottom: 12 }} />
          <SkeletonPlaceholder width="80%" height={56} borderRadius={12} />
        </View>
      </ScrollView>

      {/* Bottom book button bar */}
      <View className="absolute bottom-0 left-0 right-0" pointerEvents="none">
        <SafeAreaView edges={["bottom"]}>
          <View className="px-4 pt-3 pb-4 bg-background border-t border-border">
            <SkeletonPlaceholder width="100%" height={52} borderRadius={16} />
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
};

export default RestaurantDetailsScreenSkeleton;
