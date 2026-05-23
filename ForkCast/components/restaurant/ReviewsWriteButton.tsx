import React from "react";
import { View, Pressable } from "react-native";
import { MessageSquare } from "lucide-react-native";

interface ReviewsWriteButtonProps {
  onPress: () => void;
}

export const ReviewsWriteButton: React.FC<ReviewsWriteButtonProps> = ({
  onPress,
}) => {
  return (
    <View className="absolute bottom-6 right-4">
      <Pressable
        onPress={onPress}
        className="w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg"
      >
        <MessageSquare size={24} color="white" />
      </Pressable>
    </View>
  );
};
