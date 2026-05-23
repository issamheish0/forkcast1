import React from "react";
import { View, ScrollView } from "react-native";
import OfferCardSkeleton from "./OfferCardSkeleton";

import { SafeAreaView } from "react-native-safe-area-context";

const OffersScreenSkeleton = () => {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16 }}
      >
        {[...Array(5)].map((_, index) => (
          <OfferCardSkeleton key={index} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default OffersScreenSkeleton;
