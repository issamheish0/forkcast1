import React from "react";
import { View } from "react-native";
import { Skeleton } from "@/components/ui/skeleton";

const FriendListItemSkeleton = () => (
  <View className="flex-row items-center p-4 mb-2 bg-white dark:bg-gray-800 rounded-2xl">
    <Skeleton className="w-14 h-14 rounded-full" />
    <View className="ml-3 flex-1">
      <Skeleton className="h-4 w-3/4 rounded-md" />
      <Skeleton className="h-3 w-1/2 rounded-md mt-2" />
    </View>
    <Skeleton className="h-6 w-6 rounded-md" />
  </View>
);

export const FriendListSkeleton = ({ count = 5 }: { count?: number }) => {
  return (
    <View className="p-4">
      {Array.from({ length: count }).map((_, index) => (
        <FriendListItemSkeleton key={index} />
      ))}
    </View>
  );
};
