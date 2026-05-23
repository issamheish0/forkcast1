import React from "react";
import { View, ScrollView } from "react-native";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeAreaView } from "@/components/safe-area-view";

export const CreatePostSkeleton = () => {
  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Skeleton className="h-6 w-6 rounded-md" />
        <Skeleton className="h-6 w-32 rounded-md" />
        <Skeleton className="h-8 w-16 rounded-md" />
      </View>

      <ScrollView className="flex-1">
        {/* Booking/Restaurant Info */}
        <View className="p-4 border-b border-border">
          <View className="flex-row items-center">
            <Skeleton className="w-12 h-12 rounded-lg mr-3" />
            <View className="flex-1">
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="h-3 w-1/2 rounded-md mt-2" />
            </View>
          </View>
        </View>

        {/* Content Input */}
        <View className="p-4">
          <Skeleton className="h-24 w-full rounded-md" />
        </View>

        {/* Selected Images */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-4 mb-4"
        >
          <View className="flex-row gap-3">
            <Skeleton className="w-24 h-24 rounded-lg" />
            <Skeleton className="w-24 h-24 rounded-lg" />
            <Skeleton className="w-24 h-24 rounded-lg" />
          </View>
        </ScrollView>

        {/* Actions */}
        <View className="flex-row items-center gap-4 px-4 py-3 border-t border-border">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
