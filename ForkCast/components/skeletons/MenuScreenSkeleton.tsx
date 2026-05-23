import React from "react";
import { View, ScrollView } from "react-native";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeAreaView } from "@/components/safe-area-view";

const MenuItemSkeleton = () => (
  <View className="bg-card p-4 mb-3 mx-4 rounded-lg border border-border">
    <View className="flex-row">
      <Skeleton className="w-24 h-24 rounded-lg mr-4" />
      <View className="flex-1">
        <View className="flex-row justify-between items-start mb-1">
          <Skeleton className="h-6 w-3/4 rounded-md" />
          <Skeleton className="h-6 w-1/4 rounded-md" />
        </View>
        <Skeleton className="h-4 w-full rounded-md mb-2" />
        <View className="flex-row flex-wrap gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </View>
      </View>
    </View>
  </View>
);

const MenuSectionSkeleton = () => (
  <View className="mb-4">
    <View className="bg-background px-4 py-3 border-b border-border">
      <Skeleton className="h-6 w-1/2 rounded-md" />
      <Skeleton className="h-4 w-3/4 rounded-md mt-2" />
    </View>
    <MenuItemSkeleton />
    <MenuItemSkeleton />
  </View>
);

export const MenuScreenSkeleton = () => {
  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header with Search */}
      <View className="p-4 border-b border-border">
        <View className="flex-row items-center gap-3">
          <Skeleton className="h-12 flex-1 rounded-lg" />
          <Skeleton className="h-12 w-12 rounded-lg" />
        </View>
      </View>

      <ScrollView>
        {/* Featured Items */}
        <View className="mb-4">
          <Skeleton className="h-6 w-1/3 rounded-md my-2 mx-4" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row p-4 gap-3">
              <Skeleton className="w-48 h-48 rounded-lg" />
              <Skeleton className="w-48 h-48 rounded-lg" />
              <Skeleton className="w-48 h-48 rounded-lg" />
            </View>
          </ScrollView>
        </View>

        {/* Menu Items */}
        <MenuSectionSkeleton />
        <MenuSectionSkeleton />
      </ScrollView>
    </SafeAreaView>
  );
};
