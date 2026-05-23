import React from "react";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { NavigationHeader } from "@/components/ui/navigation-header";
import { useRouter } from "expo-router";
import { Skeleton } from "@/components/ui/skeleton";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";

export const WaitlistDetailsSkeleton = () => {
  const router = useRouter();
  const { colorScheme } = useColorScheme();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Real Header */}
      <NavigationHeader
        title="Waitlist Details"
        onBack={() => router.back()}
        showShare={true}
        onShare={() => {}}
      />

      <View className="flex-1">
        {/* Restaurant Header Skeleton */}
        <View className="bg-card border-b border-border p-4">
          <View className="flex-row">
            <Skeleton className="w-24 h-24 rounded-lg" />
            <View className="flex-1 ml-4">
              <Skeleton className="h-6 w-40 rounded-md mb-2" />
              <Skeleton className="h-4 w-24 rounded-md mb-2" />
              <Skeleton className="h-4 w-32 rounded-md" />
            </View>
          </View>
        </View>

        {/* Status Section Skeleton */}
        <View className="px-4 py-4 border-b border-border">
          <Skeleton className="h-20 w-full rounded-lg mb-3" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </View>

        {/* Waitlist Information Skeleton */}
        <View className="px-4 py-4">
          <Skeleton className="h-6 w-40 mb-4 rounded-md" />
          <View className="bg-primary/5 rounded-lg p-3 border border-primary/10">
            <Skeleton className="h-16 w-full rounded-md mb-3" />
            <Skeleton className="h-12 w-full rounded-md mb-3" />
            <Skeleton className="h-12 w-full rounded-md mb-3" />
            <Skeleton className="h-12 w-full rounded-md" />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default WaitlistDetailsSkeleton;
