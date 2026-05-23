import React from "react";
import { View, ScrollView } from "react-native";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { SafeAreaView } from "react-native-safe-area-context";

const ReviewCreateScreenSkeleton = () => {
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

        {/* Restaurant Info */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <SkeletonPlaceholder
            width={64}
            height={64}
            borderRadius={8}
            style={{ marginRight: 16 }}
          />
          <View>
            <SkeletonPlaceholder
              width="70%"
              height={20}
              style={{ marginBottom: 8 }}
            />
            <SkeletonPlaceholder width="90%" height={16} />
          </View>
        </View>

        {/* Step Title */}
        <View style={{ marginBottom: 24 }}>
          <SkeletonPlaceholder
            width="60%"
            height={24}
            style={{ marginBottom: 8 }}
          />
          <SkeletonPlaceholder width="80%" height={18} />
        </View>

        {/* Step Content */}
        <SkeletonPlaceholder width="100%" height={300} borderRadius={8} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default ReviewCreateScreenSkeleton;
