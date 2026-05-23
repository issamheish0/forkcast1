import React from "react";
import { View, ScrollView } from "react-native";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { SafeAreaView } from "react-native-safe-area-context";

const BookingDetailsScreenSkeleton = () => {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View
          style={{
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: "#eee",
          }}
        >
          <SkeletonPlaceholder
            width="100%"
            height={40}
            style={{ marginBottom: 16 }}
          />
        </View>

        {/* Restaurant Info */}
        <View style={{ padding: 16 }}>
          <SkeletonPlaceholder
            width="100%"
            height={150}
            style={{ marginBottom: 16 }}
          />
          <SkeletonPlaceholder
            width="80%"
            height={24}
            style={{ marginBottom: 8 }}
          />
          <SkeletonPlaceholder
            width="60%"
            height={18}
            style={{ marginBottom: 16 }}
          />
        </View>

        {/* Booking Details */}
        <View
          style={{ padding: 16, borderTopWidth: 1, borderTopColor: "#eee" }}
        >
          <SkeletonPlaceholder
            width="50%"
            height={20}
            style={{ marginBottom: 16 }}
          />
          <SkeletonPlaceholder
            width="100%"
            height={50}
            style={{ marginBottom: 12 }}
          />
          <SkeletonPlaceholder
            width="100%"
            height={50}
            style={{ marginBottom: 12 }}
          />
          <SkeletonPlaceholder
            width="100%"
            height={50}
            style={{ marginBottom: 16 }}
          />
          <SkeletonPlaceholder
            width="50%"
            height={20}
            style={{ marginBottom: 16 }}
          />
          <SkeletonPlaceholder width="100%" height={80} />
        </View>

        {/* Map */}
        <View
          style={{ padding: 16, borderTopWidth: 1, borderTopColor: "#eee" }}
        >
          <SkeletonPlaceholder width="100%" height={200} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default BookingDetailsScreenSkeleton;
