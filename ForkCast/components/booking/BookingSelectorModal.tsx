// components/booking/BookingSelectorModal.tsx
import React from "react";
import { View, Modal, Pressable, ScrollView } from "react-native";
import { X, Calendar, Clock, Users, Check } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { formatLebanonTime, formatLebanonDateShort } from "@/utils/lebanonTime";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";

interface BookingOption {
  id: string;
  booking_time: string;
  party_size: number;
  restaurant_name?: string;
}

interface BookingSelectorModalProps {
  visible: boolean;
  bookings: BookingOption[];
  restaurantName?: string;
  onSelect: (bookingId: string) => void;
  onClose: () => void;
}

export const BookingSelectorModal: React.FC<BookingSelectorModalProps> = ({
  visible,
  bookings,
  restaurantName,
  onSelect,
  onClose,
}) => {
  const { colorScheme } = useColorScheme();
  const theme = colors[colorScheme ?? "light"];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/50 justify-center px-4"
        onPress={onClose}
      >
        <Pressable
          className="bg-card border border-border rounded-xl p-6 max-h-[80%]"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <H3 className="font-semibold">Select Booking</H3>
            <Pressable onPress={onClose} className="p-1">
              <X size={20} color={theme.foreground} />
            </Pressable>
          </View>

          {/* Description */}
          <Text className="text-muted-foreground text-sm mb-4">
            {restaurantName
              ? `You have multiple bookings at ${restaurantName}. Which one would you like to scan?`
              : "You have multiple bookings. Which one would you like to scan?"}
          </Text>

          {/* Booking List */}
          <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
            {bookings.map((booking, index) => {
              const bookingDate = new Date(booking.booking_time);
              return (
                <Pressable
                  key={booking.id}
                  onPress={() => onSelect(booking.id)}
                  className={`bg-background border border-border rounded-lg p-4 mb-3 ${
                    index === bookings.length - 1 ? "mb-0" : ""
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-2">
                        <Calendar size={16} color={theme.primary} />
                        <Text className="font-semibold">
                          {formatLebanonDateShort(bookingDate)}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2 mb-2">
                        <Clock size={16} color={theme.primary} />
                        <Text className="text-muted-foreground">
                          {formatLebanonTime(bookingDate)}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <Users size={16} color={theme.primary} />
                        <Text className="text-muted-foreground">
                          {booking.party_size}{" "}
                          {booking.party_size === 1 ? "Guest" : "Guests"}
                        </Text>
                      </View>
                    </View>
                    <Check size={20} color={theme.primary} />
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View className="mt-4 pt-4 border-t border-border">
            <Button variant="ghost" onPress={onClose} className="w-full">
              <Text>Cancel</Text>
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
