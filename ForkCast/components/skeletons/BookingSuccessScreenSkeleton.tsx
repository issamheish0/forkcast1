import React from "react";
import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SkeletonPlaceholder from "./SkeletonPlaceholder";

const BookingSuccessScreenSkeleton = () => {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingVertical: 24 }}>
        {/* Header Animation */}
        <View className="items-center py-8">
          <SkeletonPlaceholder
            width={96}
            height={96}
            style={{ borderRadius: 48, marginBottom: 16 }}
          />
          <SkeletonPlaceholder
            width="80%"
            height={36}
            style={{ marginBottom: 8 }}
          />
          <SkeletonPlaceholder width="90%" height={48} />
        </View>

        {/* Booking Details Card */}
        <View className="bg-card border border-border rounded-xl p-6 mx-4 mb-4">
          {/* Restaurant Info */}
          <View className="flex-row items-center gap-4 mb-6">
            <SkeletonPlaceholder
              width={80}
              height={80}
              style={{ borderRadius: 12 }}
            />
            <View className="flex-1">
              <SkeletonPlaceholder
                width="80%"
                height={24}
                style={{ marginBottom: 8 }}
              />
              <SkeletonPlaceholder
                width="60%"
                height={16}
                style={{ marginBottom: 8 }}
              />
              <SkeletonPlaceholder width="70%" height={16} />
            </View>
          </View>

          {/* Booking Details */}
          <View style={{ gap: 16 }}>
            <SkeletonPlaceholder width="100%" height={40} />
            <SkeletonPlaceholder width="100%" height={40} />
            <SkeletonPlaceholder width="100%" height={40} />
            <SkeletonPlaceholder width="100%" height={40} />
          </View>

          {/* Confirmation Code */}
          <View className="mt-6 p-4 bg-muted/50 rounded-xl">
            <SkeletonPlaceholder width="100%" height={60} />
          </View>
        </View>

        {/* Quick Actions */}
        <View className="mx-4 mb-6">
          <SkeletonPlaceholder
            width="40%"
            height={24}
            style={{ marginBottom: 16 }}
          />
          <View className="flex-row flex-wrap gap-3">
            <SkeletonPlaceholder
              width="48%"
              height={100}
              style={{ borderRadius: 12 }}
            />
            <SkeletonPlaceholder
              width="48%"
              height={100}
              style={{ borderRadius: 12 }}
            />
            <SkeletonPlaceholder
              width="48%"
              height={100}
              style={{ borderRadius: 12 }}
            />
            <SkeletonPlaceholder
              width="48%"
              height={100}
              style={{ borderRadius: 12 }}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default BookingSuccessScreenSkeleton;
