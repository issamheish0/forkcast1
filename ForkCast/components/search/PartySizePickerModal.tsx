import React from "react";
import { View, Modal, Pressable, ScrollView } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { PARTY_SIZES } from "@/constants/searchConstants";
import { Users, X } from "lucide-react-native";

interface BookingFilters {
  date: Date | null;
  time: string | null;
  partySize: number | null;
  availableOnly: boolean;
}

interface PartySizePickerModalProps {
  visible: boolean;
  bookingFilters: BookingFilters;
  onPartySizeSelect: (size: number | null) => void;
  onClose: () => void;
}

export const PartySizePickerModal = React.memo(
  ({
    visible,
    bookingFilters,
    onPartySizeSelect,
    onClose,
  }: PartySizePickerModalProps) => {
    const handlePartySizeSelect = (size: number | null) => {
      onPartySizeSelect(size);
      onClose();
    };

    const getDisplayText = (size: number | null) => {
      if (size === null) return "Any party size";
      return `${size} ${size === 1 ? "Person" : "People"}`;
    };

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
        statusBarTranslucent={false}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-center items-center"
          onPress={onClose}
        >
          <Pressable
            className="bg-background rounded-2xl w-80 max-h-96 shadow-xl"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <View className="flex-row items-center gap-2">
                <Users size={20} color="#666" />
                <Text className="font-semibold text-lg">Party Size</Text>
              </View>
              <Pressable onPress={onClose} className="p-1">
                <X size={20} color="#666" />
              </Pressable>
            </View>

            {/* Content */}
            <ScrollView className="max-h-64 py-2">
              {PARTY_SIZES.map((size, index) => {
                const isSelected = size === bookingFilters.partySize;

                return (
                  <Pressable
                    key={index}
                    onPress={() => handlePartySizeSelect(size)}
                    className={`mx-4 my-1 p-4 rounded-xl border ${
                      isSelected
                        ? "bg-primary/10 border-primary/20"
                        : "bg-transparent border-transparent hover:bg-muted"
                    }`}
                  >
                    <Text
                      className={`font-medium text-center ${
                        isSelected ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {getDisplayText(size)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Footer */}
            <View className="p-4 border-t border-border">
              <Button variant="outline" onPress={onClose} className="w-full">
                <Text>Cancel</Text>
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  },
);
