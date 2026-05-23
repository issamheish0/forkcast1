// components/guest/GuestPromptModal.tsx
import React from "react";
import { Modal, View, TouchableOpacity, Pressable } from "react-native";
import { X, UserPlus } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H3, P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { useColorScheme } from "@/lib/useColorScheme";

interface GuestPromptModalProps {
  visible: boolean;
  onClose: () => void;
  onSignUp: () => void;
  featureName: string;
}

export function GuestPromptModal({
  visible,
  onClose,
  onSignUp,
  featureName,
}: GuestPromptModalProps) {
  const { colorScheme } = useColorScheme();

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-background rounded-t-3xl p-6 pb-8">
          {/* Close Button */}
          <TouchableOpacity
            onPress={onClose}
            className="absolute right-4 top-4 p-2"
          >
            <X size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
          </TouchableOpacity>

          {/* Icon */}
          <View className="items-center mb-4">
            <View className="w-16 h-16 rounded-full bg-primary/20 items-center justify-center">
              <UserPlus size={32} color="#ff4444" />
            </View>
          </View>

          {/* Content */}
          <H3 className="text-center mb-2">Sign Up Required</H3>
          <P className="text-center text-muted-foreground mb-6">
            Create a free account to {featureName}. Join thousands of food
            lovers discovering the best restaurants in Lebanon!
          </P>

          {/* Actions */}
          <View className="gap-3">
            <Button onPress={onSignUp} variant="default" size="lg">
              <Text>Sign Up Now</Text>
            </Button>
            <Button onPress={onClose} variant="outline" size="lg">
              <Text>Maybe Later</Text>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
