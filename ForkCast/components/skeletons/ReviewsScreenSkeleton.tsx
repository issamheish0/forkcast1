import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "@/components/safe-area-view";
import { Card } from "@/components/ui/card";

const SkeletonPlaceholder = ({ className }: { className?: string }) => (
  <View className={`rounded bg-[#e0e0e0] ${className ?? ""}`} />
);

const ReviewCardSkeleton = () => (
  <Card className="mb-3 rounded-lg p-4">
    <View className="mb-3 flex-row">
      <SkeletonPlaceholder className="mr-1 h-4 w-4" />
      <SkeletonPlaceholder className="mr-1 h-4 w-4" />
      <SkeletonPlaceholder className="mr-1 h-4 w-4" />
      <SkeletonPlaceholder className="mr-1 h-4 w-4" />
      <SkeletonPlaceholder className="mr-1 h-4 w-4" />
    </View>
    <SkeletonPlaceholder className="mb-2 h-4 w-[90%]" />
    <SkeletonPlaceholder className="mb-3 h-4 w-[60%]" />
    <SkeletonPlaceholder className="h-3 w-[30%]" />
  </Card>
);

export function ReviewsScreenSkeleton() {
  return (
    <SafeAreaView className="flex-1">
      {/* Header Skeleton */}
      <View className="flex-row items-center border-b border-[#eee] p-4">
        <SkeletonPlaceholder className="mr-4 h-8 w-8 rounded-full" />
        <SkeletonPlaceholder className="h-6 w-[40%]" />
      </View>

      {/* List Skeleton */}
      <View className="p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <ReviewCardSkeleton key={index} />
        ))}
      </View>
    </SafeAreaView>
  );
}
