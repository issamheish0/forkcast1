import React from "react";
import { View, ScrollView, Dimensions } from "react-native";
import CuisineCategorySkeleton from "./CuisineCategorySkeleton";
import RestaurantCardSkeleton from "./RestaurantCardSkeleton";
import { SectionHeader } from "../ui/section-header";
import SkeletonPlaceholder from "./SkeletonPlaceholder";

const { width: screenWidth } = Dimensions.get("window");
const bannerWidth = screenWidth - 32;
const spacing = 8;

const BannerSkeleton = () => {
  return (
    <View className="mb-6">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={bannerWidth + spacing}
        snapToAlignment="start"
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {[...Array(2)].map((_, index) => (
          <View
            key={index}
            style={{
              width: bannerWidth,
              marginRight: index === 0 ? spacing : 0,
            }}
          >
            <SkeletonPlaceholder width="100%" height={200} borderRadius={12} />
          </View>
        ))}
      </ScrollView>

      {/* Pagination Dots */}
      <View className="flex-row justify-center items-center mt-4 gap-2">
        {[...Array(2)].map((_, index) => (
          <View
            key={index}
            className={`h-2 rounded-full ${
              index === 0 ? "bg-primary w-6" : "bg-muted-foreground/30 w-2"
            }`}
          />
        ))}
      </View>
    </View>
  );
};

interface HomeScreenSkeletonProps {
  headerHeight?: number;
}

const HomeScreenSkeleton = ({
  headerHeight = 180,
}: HomeScreenSkeletonProps) => {
  return (
    <ScrollView
      className="flex-1 bg-background"
      showsVerticalScrollIndicator={false}
    >
      {/* Header spacer - matches the dynamic header height */}
      <View style={{ height: headerHeight }} />

      {/* Cuisine Categories */}
      <View className="mb-6">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        >
          {[...Array(5)].map((_, index) => (
            <CuisineCategorySkeleton key={index} />
          ))}
        </ScrollView>
      </View>

      {/* Banners */}
      <BannerSkeleton />

      {/* Featured This Week */}
      <View className="mb-2">
        <SectionHeader
          title="Featured This Week"
          subtitle="Hand-picked restaurants just for you"
          actionLabel="View all"
          onAction={() => {}}
        />
      </View>
      <View className="mb-6">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {[...Array(3)].map((_, index) => (
            <RestaurantCardSkeleton key={index} />
          ))}
        </ScrollView>
      </View>

      {/* Bottom spacer */}
      <View className="h-24" />
    </ScrollView>
  );
};

export default HomeScreenSkeleton;
