import React from "react";
import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SkeletonPlaceholder from "./SkeletonPlaceholder";

const AvailabilityScreenSkeleton = () => {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <SkeletonPlaceholder
            width={32}
            height={32}
            style={{ borderRadius: 16 }}
          />
          <View className="flex-1 ml-4">
            <SkeletonPlaceholder width="70%" height={24} />
          </View>
        </View>

        {/* Restaurant Info */}
        <View className="mb-6">
          <SkeletonPlaceholder
            width="100%"
            height={180}
            style={{ borderRadius: 12, marginBottom: 16 }}
          />
          <SkeletonPlaceholder
            width="80%"
            height={28}
            style={{ marginBottom: 8 }}
          />
          <SkeletonPlaceholder width="60%" height={20} />
        </View>

        {/* Date Selector */}
        <View className="mb-6">
          <SkeletonPlaceholder width="100%" height={80} />
        </View>

        {/* Party Size Selector */}
        <View className="mb-6">
          <SkeletonPlaceholder width="100%" height={60} />
        </View>

        {/* Time Slots */}
        <View>
          <SkeletonPlaceholder
            width="40%"
            height={24}
            style={{ marginBottom: 16 }}
          />
          <View className="flex-row flex-wrap gap-4">
            {[...Array(6)].map((_, i) => (
              <SkeletonPlaceholder
                key={i}
                width={100}
                height={48}
                style={{ borderRadius: 8 }}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AvailabilityScreenSkeleton;
