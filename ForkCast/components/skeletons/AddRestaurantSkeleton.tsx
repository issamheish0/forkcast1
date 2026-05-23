import React from "react";
import { View } from "react-native";
import { Skeleton } from "@/components/ui/skeleton";

const AddRestaurantSkeletonItem = () => (
  <View className="mb-3">
    <View className="flex-row items-center p-3 bg-white dark:bg-gray-800 rounded-2xl">
      <Skeleton className="w-20 h-20 rounded-lg" />
      <View className="ml-3 flex-1">
        <Skeleton className="h-4 w-3/4 rounded-md" />
        <Skeleton className="h-3 w-1/2 rounded-md mt-2" />
        <Skeleton className="h-3 w-1/4 rounded-md mt-2" />
      </View>
      <Skeleton className="w-6 h-6 rounded-full" />
    </View>
  </View>
);

export const AddRestaurantSkeleton = ({ count = 5 }: { count?: number }) => {
  return (
    <View className="p-4">
      {Array.from({ length: count }).map((_, index) => (
        <AddRestaurantSkeletonItem key={index} />
      ))}
    </View>
  );
};
