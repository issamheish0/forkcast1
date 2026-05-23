// components/search/BookingQuickModal.tsx
import React, { useState } from "react";
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
  FlatList,
  Switch,
} from "react-native";
import { X, Users, Check, Clock, RotateCcw } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { formatDateShort } from "@/utils/birthday";
import { PARTY_SIZES } from "@/constants/searchConstants";
import { formatTime } from "@/utils/timeFormat";

interface BookingFilters {
  date: Date | null;
  time: string | null;
  partySize: number | null;
  availableOnly: boolean;
}

interface BookingQuickModalProps {
  visible: boolean;
  bookingFilters: BookingFilters;
  colorScheme: "light" | "dark";
  onClose: () => void;
  onApply: (filters: Partial<BookingFilters>) => void;
}

interface DateOption {
  id: string;
  date: Date | null;
  label: string;
}

interface TimeOption {
  id: string;
  time: string | null;
  label: string;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Generate available dates (next 60 days)
const generateDateOptions = (): DateOption[] => {
  const dates: DateOption[] = [];

  // Add "Any date" option first
  dates.push({
    id: "date-any",
    date: null,
    label: "Any date",
  });

  for (let dayOffset = 0; dayOffset < 60; dayOffset++) {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);

    let label: string;
    if (dayOffset === 0) {
      label = "Today";
    } else if (dayOffset === 1) {
      label = "Tomorrow";
    } else {
      label = formatDateShort(date);
    }

    dates.push({
      id: `date-${dayOffset}`,
      date,
      label,
    });
  }

  return dates;
};

// Generate available times (all day in 30-minute intervals)
const generateTimeOptions = (): TimeOption[] => {
  const times: TimeOption[] = [];

  // Add "Any time" option first
  times.push({
    id: "time-any",
    time: null,
    label: "Any time",
  });

  // Generate times from 06:00 to 23:30 in 30-minute intervals
  for (let hour = 6; hour <= 23; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

      // Format time for display using device's preferred format
      const displayTime = formatTime(timeString);

      times.push({
        id: `time-${timeString}`,
        time: timeString,
        label: displayTime,
      });
    }
  }

  return times;
};

const DATE_OPTIONS = generateDateOptions();
const TIME_OPTIONS = generateTimeOptions();

export const BookingQuickModal = ({
  visible,
  bookingFilters,
  colorScheme,
  onClose,
  onApply,
}: BookingQuickModalProps) => {
  const [localFilters, setLocalFilters] =
    useState<BookingFilters>(bookingFilters);
  const [selectedDateId, setSelectedDateId] = useState<string>("");
  const [selectedTimeId, setSelectedTimeId] = useState<string>("");

  // Reset local filters when modal opens
  React.useEffect(() => {
    if (visible) {
      setLocalFilters(bookingFilters);

      // Find the closest matching date
      const matchingDate = bookingFilters.date
        ? DATE_OPTIONS.find(
            (option) =>
              option.date &&
              option.date.toDateString() ===
                bookingFilters.date!.toDateString(),
          )
        : DATE_OPTIONS.find((option) => option.date === null); // Find "Any date" option
      setSelectedDateId(matchingDate?.id || "date-any");

      // Find the matching time
      const matchingTime = bookingFilters.time
        ? TIME_OPTIONS.find((option) => option.time === bookingFilters.time)
        : TIME_OPTIONS.find((option) => option.time === null); // Find "Any time" option
      setSelectedTimeId(matchingTime?.id || "time-any");
    }
  }, [visible, bookingFilters]);

  const handleApply = () => {
    const selectedDate = DATE_OPTIONS.find(
      (option) => option.id === selectedDateId,
    );
    const selectedTime = TIME_OPTIONS.find(
      (option) => option.id === selectedTimeId,
    );

    if (selectedDate && selectedTime) {
      onApply({
        ...localFilters,
        date: selectedDate.date, // date can now be null for "Any date"
        time: selectedTime.time, // time can now be null for "Any time"
      });
    }
    onClose();
  };

  const renderDateOption = ({ item }: { item: DateOption }) => {
    const isSelected = selectedDateId === item.id;

    return (
      <Pressable
        onPress={() => setSelectedDateId(item.id)}
        className={`px-4 py-4 mx-2 my-1 rounded-lg ${
          isSelected ? "bg-muted" : "bg-transparent"
        }`}
      >
        <Text
          className={`text-center text-base ${
            isSelected
              ? "text-foreground font-semibold"
              : "text-muted-foreground"
          }`}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  };

  const renderTimeOption = ({ item }: { item: TimeOption }) => {
    const isSelected = selectedTimeId === item.id;

    return (
      <Pressable
        onPress={() => setSelectedTimeId(item.id)}
        className={`px-4 py-4 mx-2 my-1 rounded-lg ${
          isSelected ? "bg-muted" : "bg-transparent"
        }`}
      >
        <Text
          className={`text-center text-base ${
            isSelected
              ? "text-foreground font-semibold"
              : "text-muted-foreground"
          }`}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable onPress={onClose} className="flex-1 bg-black/50 justify-end">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-background rounded-t-3xl"
          style={{ height: SCREEN_HEIGHT * 0.6 }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <H3>Booking Details</H3>
            <Pressable onPress={onClose} className="p-2 rounded-full bg-muted">
              <X size={20} color={colorScheme === "dark" ? "#fff" : "#000"} />
            </Pressable>
          </View>

          <View className="flex-1">
            {/* Party Size Section */}
            <View className="px-4 py-4 border-b border-border">
              <View className="flex-row items-center gap-2 mb-3">
                <Users size={18} color="#666" />
                <Text className="text-lg font-semibold">Party size</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="flex-row"
                contentContainerStyle={{ paddingHorizontal: 8 }}
              >
                {PARTY_SIZES.map((size, index) => (
                  <Pressable
                    key={index}
                    onPress={() =>
                      setLocalFilters({ ...localFilters, partySize: size })
                    }
                    className={`${size === null ? "w-16" : "w-12"} h-12 rounded-full mr-3 items-center justify-center border-2 ${
                      localFilters.partySize === size
                        ? "bg-black border-black"
                        : "bg-transparent border-gray-300"
                    }`}
                  >
                    <Text
                      className={`font-semibold ${size === null ? "text-xs" : ""} ${
                        localFilters.partySize === size
                          ? "text-white"
                          : "text-foreground"
                      }`}
                    >
                      {size === null ? "Any" : size}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Open Now Toggle */}
              <View className="flex-row items-center justify-between mt-4 p-3 bg-muted rounded-lg">
                <View className="flex-row items-center gap-2">
                  <Clock size={16} color="#666" />
                  <Text className="text-base font-medium">Open now</Text>
                </View>
                <Switch
                  value={localFilters.availableOnly}
                  onValueChange={(value) =>
                    setLocalFilters({ ...localFilters, availableOnly: value })
                  }
                  trackColor={{ false: "#e5e5e5", true: "#2563eb" }}
                  thumbColor={
                    localFilters.availableOnly ? "#ffffff" : "#f4f3f4"
                  }
                />
              </View>
            </View>

            {/* Date and Time Section */}
            <View className="flex-1 px-4 py-4">
              <Text className="text-lg font-semibold mb-4">Date and time</Text>

              <View className="flex-1 flex-row">
                {/* Date Selector */}
                <View className="flex-1 pr-2">
                  <FlatList
                    data={DATE_OPTIONS}
                    renderItem={renderDateOption}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    getItemLayout={(data, index) => ({
                      length: 60,
                      offset: 60 * index,
                      index,
                    })}
                    initialScrollIndex={Math.max(
                      0,
                      DATE_OPTIONS.findIndex(
                        (option) => option.id === selectedDateId,
                      ),
                    )}
                  />
                </View>

                {/* Vertical Divider */}
                <View className="w-px bg-border mx-2" />

                {/* Time Selector */}
                <View className="flex-1 pl-2">
                  <FlatList
                    data={TIME_OPTIONS}
                    renderItem={renderTimeOption}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    getItemLayout={(data, index) => ({
                      length: 60,
                      offset: 60 * index,
                      index,
                    })}
                    initialScrollIndex={Math.max(
                      0,
                      TIME_OPTIONS.findIndex(
                        (option) => option.id === selectedTimeId,
                      ),
                    )}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View className="p-4 border-t border-border space-y-3">
            {/* Show All Button - only show if any filters are applied */}
            {(localFilters.partySize !== null ||
              selectedDateId !== "date-any" ||
              selectedTimeId !== "time-any" ||
              localFilters.availableOnly) && (
              <Button
                onPress={() => {
                  // Reset all filters to "Any"
                  setLocalFilters({
                    ...localFilters,
                    partySize: null,
                    availableOnly: false,
                  });
                  setSelectedDateId("date-any");
                  setSelectedTimeId("time-any");

                  // Apply the reset filters immediately
                  onApply({
                    ...localFilters,
                    partySize: null,
                    date: null, // "Any date"
                    time: null, // "Any time"
                    availableOnly: false,
                  });
                }}
                variant="outline"
                className="w-full border-primary flex-row items-center gap-2"
              >
                <RotateCcw size={16} color="#2563eb" />
                <Text className="text-primary font-medium">
                  Show All Restaurants
                </Text>
              </Button>
            )}

            {/* Done Button */}
            <Button onPress={handleApply} className="w-full bg-black">
              <Text className="text-white font-semibold text-lg">Done</Text>
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
