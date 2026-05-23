import React from "react";
import { View, ScrollView } from "react-native";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeAreaView } from "@/components/safe-area-view";

export const FriendProfileSkeleton = () => {
  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <View className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <View className="flex-row items-center justify-between">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-32 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
        </View>
      </View>

      <ScrollView className="flex-1">
        {/* Profile Header */}
        <View className="bg-white dark:bg-gray-800 p-6 items-center border-b border-gray-200 dark:border-gray-700">
          <Skeleton className="w-24 h-24 rounded-full mb-4" />
          <Skeleton className="h-8 w-48 rounded-md mb-2" />
          <Skeleton className="h-4 w-32 rounded-md mb-2" />
          <Skeleton className="h-4 w-40 rounded-md mb-4" />

          <View className="flex-row items-center gap-4">
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </View>
        </View>

        {/* Stats Section */}
        <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-2xl">
          <Skeleton className="h-6 w-32 rounded-md mb-4" />
          <View className="flex-row justify-around">
            <View className="items-center">
              <Skeleton className="h-8 w-12 rounded-md" />
              <Skeleton className="h-3 w-16 rounded-md mt-2" />
            </View>
            <View className="items-center">
              <Skeleton className="h-8 w-12 rounded-md" />
              <Skeleton className="h-3 w-16 rounded-md mt-2" />
            </View>
            <View className="items-center">
              <Skeleton className="h-8 w-12 rounded-md" />
              <Skeleton className="h-3 w-16 rounded-md mt-2" />
            </View>
          </View>
        </View>

        {/* Dining Preferences */}
        <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-2xl">
          <Skeleton className="h-6 w-40 rounded-md mb-4" />

          <View className="mb-4">
            <Skeleton className="h-4 w-32 rounded-md mb-2" />
            <View className="flex-row flex-wrap gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </View>
          </View>

          <View className="mb-4">
            <Skeleton className="h-4 w-40 rounded-md mb-2" />
            <View className="flex-row flex-wrap gap-2">
              <Skeleton className="h-6 w-28 rounded-full" />
            </View>
          </View>

          <View>
            <Skeleton className="h-4 w-24 rounded-md mb-2" />
            <View className="flex-row flex-wrap gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
