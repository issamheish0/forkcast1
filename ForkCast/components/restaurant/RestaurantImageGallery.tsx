import React from "react";
import { View, ScrollView, Pressable, Dimensions } from "react-native";
import { ChevronLeft, Camera } from "lucide-react-native";
import { Image } from "@/components/image";
import { Text } from "@/components/ui/text";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_HEIGHT = 300;

interface RestaurantImageGalleryProps {
  images: string[];
  imageIndex: number;
  isRestaurantOpen: boolean;
  onImageIndexChange: (index: number) => void;
  onBackPress: () => void;
  onCameraPress: () => void;
}

export const RestaurantImageGallery = ({
  images,
  imageIndex,
  isRestaurantOpen,
  onImageIndexChange,
  onBackPress,
  onCameraPress,
}: RestaurantImageGalleryProps) => {
  return (
    <View className="relative" style={{ height: IMAGE_HEIGHT }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          const index = Math.round(
            e.nativeEvent.contentOffset.x / SCREEN_WIDTH,
          );
          onImageIndexChange(index);
        }}
        scrollEventThrottle={16}
      >
        {images.map((image, index) => {
          // Lazy load: only load current, previous, and next images
          const isVisible = Math.abs(index - imageIndex) <= 1;

          return (
            <Pressable key={index} onPress={() => onCameraPress()}>
              {isVisible ? (
                <Image
                  source={{ uri: image }}
                  style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT }}
                  contentFit="cover"
                  optimizationPreset="large"
                  optimizationOptions={{ quality: 80 }} // Slightly lower quality for gallery (was 85%)
                />
              ) : (
                <View
                  style={{
                    width: SCREEN_WIDTH,
                    height: IMAGE_HEIGHT,
                    backgroundColor: "#1a1a1a",
                  }}
                />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="absolute bottom-4 left-0 right-0 flex-row justify-center gap-2">
        {images.map((_, index) => (
          <View
            key={index}
            className={`w-2 h-2 rounded-full ${
              index === imageIndex ? "bg-white" : "bg-white/50"
            }`}
          />
        ))}
      </View>

      <View className="absolute bottom-5 right-4">
        <View
          className={`px-3 py-1 rounded-full ${
            isRestaurantOpen ? "bg-green-500" : "bg-red-500"
          }`}
        >
          <Text className="text-white text-sm font-medium">
            {isRestaurantOpen ? "Open Now" : "Closed"}
          </Text>
        </View>
      </View>
    </View>
  );
};
