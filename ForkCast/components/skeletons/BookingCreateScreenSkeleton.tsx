import React from "react";
import { View, ScrollView } from "react-native";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { SafeAreaView } from "react-native-safe-area-context";

const BookingCreateScreenSkeleton = () => {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16 }}
      >
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <SkeletonPlaceholder width="100%" height={40} />
        </View>

        {/* Booking Summary */}
        <View style={{ marginBottom: 24 }}>
          <SkeletonPlaceholder width="100%" height={150} borderRadius={8} />
        </View>

        {/* Offers */}
        <View style={{ marginBottom: 24 }}>
          <SkeletonPlaceholder
            width="40%"
            height={20}
            style={{ marginBottom: 16 }}
          />
          <SkeletonPlaceholder width="100%" height={100} borderRadius={8} />
        </View>

        {/* Friends */}
        <View style={{ marginBottom: 24 }}>
          <SkeletonPlaceholder
            width="40%"
            height={20}
            style={{ marginBottom: 16 }}
          />
          <SkeletonPlaceholder width="100%" height={60} borderRadius={8} />
        </View>

        {/* Special Requirements */}
        <View style={{ marginBottom: 24 }}>
          <SkeletonPlaceholder
            width="60%"
            height={20}
            style={{ marginBottom: 16 }}
          />
          <SkeletonPlaceholder width="100%" height={200} borderRadius={8} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default BookingCreateScreenSkeleton;
