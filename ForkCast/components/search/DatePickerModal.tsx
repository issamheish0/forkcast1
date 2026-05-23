import React, { useMemo } from "react";
import { View, Modal, Pressable, ScrollView } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Calendar, X } from "lucide-react-native";
import { formatDateLong } from "@/utils/birthday";

interface BookingFilters {
  date: Date | null;
  time: string | null;
  partySize: number | null;
  availableOnly: boolean;
}

interface DatePickerModalProps {
  visible: boolean;
  bookingFilters: BookingFilters;
  onDateSelect: (date: Date | null) => void;
  onClose: () => void;
}

export const DatePickerModal = React.memo(
  ({
    visible,
    bookingFilters,
    onDateSelect,
    onClose,
  }: DatePickerModalProps) => {
    // Generate next 14 days
    const dateOptions = useMemo(() => {
      const dates = [];
      const today = new Date();

      for (let i = 0; i < 14; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        dates.push(date);
      }

      return dates;
    }, []);

    const handleDateSelect = (date: Date | null) => {
      onDateSelect(date);
      onClose();
    };

    const getDateDisplayText = (date: Date) => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      if (date.toDateString() === today.toDateString()) return "Today";
      if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
      return formatDateLong(date);
    };

    const isDateSelected = (date: Date | null) => {
      if (bookingFilters.date === null && date === null) return true;
      if (bookingFilters.date === null || date === null) return false;
      return date.toDateString() === bookingFilters.date.toDateString();
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
                <Calendar size={20} color="#666" />
                <Text className="font-semibold text-lg">Select Date</Text>
              </View>
              <Pressable onPress={onClose} className="p-1">
                <X size={20} color="#666" />
              </Pressable>
            </View>

            {/* Content */}
            <ScrollView className="max-h-64 py-2">
              {/* Any Date Option */}
              <Pressable
                onPress={() => handleDateSelect(null)}
                className={`mx-4 my-1 p-4 rounded-xl border ${
                  isDateSelected(null)
                    ? "bg-primary/10 border-primary/20"
                    : "bg-transparent border-transparent hover:bg-muted"
                }`}
              >
                <Text
                  className={`font-medium text-center ${
                    isDateSelected(null) ? "text-primary" : "text-foreground"
                  }`}
                >
                  Any date
                </Text>
              </Pressable>

              {/* Specific Dates */}
              {dateOptions.map((date, index) => {
                const isSelected = isDateSelected(date);

                return (
                  <Pressable
                    key={index}
                    onPress={() => handleDateSelect(date)}
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
                      {getDateDisplayText(date)}
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
