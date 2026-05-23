import React from "react";
import { View, ScrollView, Dimensions } from "react-native";
import { SafeAreaView } from "@/components/safe-area-view";
import SkeletonPlaceholder from "./SkeletonPlaceholder";

const { width: screenWidth } = Dimensions.get("window");

const RatingDetailsScreenSkeleton = () => {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F5F5" }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#E0E0E0",
        }}
      >
        <SkeletonPlaceholder width={24} height={24} borderRadius={4} />
        <SkeletonPlaceholder width={180} height={28} borderRadius={4} />
        <SkeletonPlaceholder width={24} height={24} borderRadius={4} />
      </View>

      <ScrollView>
        {/* Main Rating Display */}
        <View
          style={{
            alignItems: "center",
            paddingVertical: 24,
            backgroundColor: "#FFFFFF",
            marginHorizontal: 16,
            marginTop: 16,
            borderRadius: 12,
          }}
        >
          <SkeletonPlaceholder
            width={120}
            height={16}
            borderRadius={4}
            style={{ marginBottom: 8 }}
          />
          <SkeletonPlaceholder
            width={150}
            height={40}
            borderRadius={4}
            style={{ marginBottom: 8 }}
          />
          <SkeletonPlaceholder width={80} height={24} borderRadius={4} />
        </View>

        {/* Info Banner */}
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 16,
            padding: 16,
            backgroundColor: "#FFFFFF",
            borderRadius: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <SkeletonPlaceholder
              width={16}
              height={16}
              borderRadius={8}
              style={{ marginTop: 4 }}
            />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <SkeletonPlaceholder
                width="70%"
                height={16}
                borderRadius={4}
                style={{ marginBottom: 8 }}
              />
              <SkeletonPlaceholder width="100%" height={14} borderRadius={4} />
              <SkeletonPlaceholder
                width="90%"
                height={14}
                borderRadius={4}
                style={{ marginTop: 4 }}
              />
            </View>
          </View>
        </View>

        {/* Detailed Stats */}
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 16,
            backgroundColor: "#FFFFFF",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <View
            style={{ flexDirection: "row", justifyContent: "space-around" }}
          >
            <View style={{ alignItems: "center" }}>
              <SkeletonPlaceholder width={60} height={20} borderRadius={4} />
              <SkeletonPlaceholder
                width={80}
                height={14}
                borderRadius={4}
                style={{ marginTop: 8 }}
              />
            </View>
            <View style={{ alignItems: "center" }}>
              <SkeletonPlaceholder width={60} height={20} borderRadius={4} />
              <SkeletonPlaceholder
                width={80}
                height={14}
                borderRadius={4}
                style={{ marginTop: 8 }}
              />
            </View>
            <View style={{ alignItems: "center" }}>
              <SkeletonPlaceholder width={60} height={20} borderRadius={4} />
              <SkeletonPlaceholder
                width={80}
                height={14}
                borderRadius={4}
                style={{ marginTop: 8 }}
              />
            </View>
          </View>
        </View>

        {/* Rating Trend Chart */}
        <View
          style={{ marginHorizontal: 16, marginTop: 24, paddingBottom: 24 }}
        >
          <SkeletonPlaceholder
            width="50%"
            height={24}
            borderRadius={4}
            style={{ marginBottom: 16 }}
          />
          <SkeletonPlaceholder
            width={screenWidth - 32}
            height={200}
            borderRadius={12}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default RatingDetailsScreenSkeleton;
