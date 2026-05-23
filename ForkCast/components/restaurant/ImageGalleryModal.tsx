import React from "react";
import { View, ScrollView, Pressable, Dimensions } from "react-native";
import { X } from "lucide-react-native";
import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { Image } from "@/components/image";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ImageGalleryModalProps {
  images: string[];
  selectedImageIndex: number;
  onClose: () => void;
  onImageIndexChange: (index: number) => void;
}

export const ImageGalleryModal = ({
  images,
  selectedImageIndex,
  onClose,
  onImageIndexChange,
}: ImageGalleryModalProps) => {
  return (
    <View className="absolute inset-0 bg-black z-50">
      <SafeAreaView className="flex-1">
        <View className="flex-row justify-between items-center p-4">
          <Text className="text-white text-lg font-semibold">
            {selectedImageIndex + 1} of {images.length}
          </Text>
          <Pressable onPress={onClose} className="bg-black/50 rounded-full p-2">
            <X size={24} color="white" />
          </Pressable>
        </View>

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
          contentOffset={{ x: selectedImageIndex * SCREEN_WIDTH, y: 0 }}
        >
          {images.map((image, index) => {
            // Lazy load: only load current, previous, and next images
            const isVisible = Math.abs(index - selectedImageIndex) <= 1;

            return (
              <View
                key={index}
                style={{ width: SCREEN_WIDTH }}
                className="items-center justify-center"
              >
                {isVisible ? (
                  <Image
                    source={{ uri: image }}
                    optimizationPreset="large"
                    optimizationOptions={{ quality: 80 }} // Slightly lower quality (was 85%)
                    style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 }}
                    contentFit="contain"
                  />
                ) : (
                  <View
                    style={{
                      width: SCREEN_WIDTH,
                      height: SCREEN_HEIGHT * 0.8,
                      backgroundColor: "#000",
                    }}
                  />
                )}
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};
