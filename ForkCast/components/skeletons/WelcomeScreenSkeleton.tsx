import React from "react";
import { View } from "react-native";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { SafeAreaView } from "react-native-safe-area-context";

const WelcomeScreenSkeleton = () => {
  return (
    <SafeAreaView className="flex flex-1 bg-background p-4">
      <View className="flex flex-1 items-center justify-center gap-y-4">
        <View style={{ alignItems: "center" }}>
          <SkeletonPlaceholder
            width={64}
            height={64}
            borderRadius={12}
            style={{ marginBottom: 24 }}
          />
          <SkeletonPlaceholder
            width="80%"
            height={30}
            style={{ marginBottom: 16 }}
          />
          <SkeletonPlaceholder
            width="90%"
            height={18}
            style={{ marginBottom: 8 }}
          />
          <SkeletonPlaceholder width="80%" height={18} />
        </View>
      </View>
      <View className="flex flex-col gap-y-4">
        <View style={{ width: "100%" }}>
          <SkeletonPlaceholder
            width="100%"
            height={50}
            borderRadius={8}
            style={{ marginBottom: 16 }}
          />
          <SkeletonPlaceholder width="100%" height={50} borderRadius={8} />
        </View>
      </View>
    </SafeAreaView>
  );
};

export default WelcomeScreenSkeleton;
