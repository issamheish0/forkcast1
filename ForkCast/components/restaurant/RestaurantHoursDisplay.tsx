// components/restaurant/RestaurantHoursDisplay.tsx
import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import {
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Calendar,
} from "lucide-react-native";
import { format, isToday, isTomorrow } from "date-fns";
import { cn } from "@/lib/utils";
import { useRestaurantOpenHours } from "@/hooks/useRestaurantOpenHours";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";

interface RestaurantHoursDisplayProps {
  restaurantId: string;
  className?: string;
}

export const RestaurantHoursDisplay: React.FC<RestaurantHoursDisplayProps> = ({
  restaurantId,
  className,
}) => {
  const { colorScheme } = useColorScheme();
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const {
    loading,
    checkAvailability,
    getWeeklySchedule,
    formatDisplayHours,
    findNextOpenTime,
  } = useRestaurantOpenHours(restaurantId);

  if (loading) {
    return (
      <View className={cn("p-4 bg-card rounded-lg", className)}>
        <Text className="text-muted-foreground">Loading hours...</Text>
      </View>
    );
  }

  const todayStatus = checkAvailability(
    new Date(),
    format(new Date(), "HH:mm"),
  );
  const weeklySchedule = getWeeklySchedule();
  const currentHours = formatDisplayHours();

  // Format day name
  const formatDayName = (day: string): string => {
    return day.charAt(0).toUpperCase() + day.slice(1);
  };

  return (
    <View className={cn("bg-card rounded-lg p-4", className)}>
      {/* Current Status */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Clock size={20} color={colors[colorScheme].mutedForeground} />
          <Text className="text-base font-medium text-foreground">Hours</Text>
        </View>
        <View className="flex-1 items-end">
          <View className="flex-row items-center gap-2 mb-1">
            <View
              className={cn(
                "w-2 h-2 rounded-full",
                todayStatus.isOpen ? "bg-green-500" : "bg-red-500",
              )}
            />
            <Text
              className={cn(
                "text-sm font-medium",
                todayStatus.isOpen ? "text-green-600" : "text-red-600",
              )}
            >
              {todayStatus.isOpen ? "Open now" : "Closed"}
            </Text>
          </View>
          {todayStatus.isOpen && todayStatus.hours && (
            <View className="items-end">
              {todayStatus.hours.map((shift, index) => (
                <Text
                  key={index}
                  className="text-xs text-muted-foreground"
                  numberOfLines={1}
                >
                  {formatTime(shift.open)} - {formatTime(shift.close)}
                </Text>
              ))}
            </View>
          )}
          {!todayStatus.isOpen && todayStatus.reason && (
            <Text className="text-xs text-muted-foreground">
              {todayStatus.reason}
            </Text>
          )}
        </View>
      </View>

      {/* Removed "Next open" section as requested */}

      {/* Weekly Schedule Toggle */}
      <Pressable
        onPress={() => setShowFullSchedule(!showFullSchedule)}
        className="flex-row items-center justify-between py-2"
      >
        <Text className="text-sm text-primary">
          {showFullSchedule ? "Hide" : "View"} weekly schedule
        </Text>
        {showFullSchedule ? (
          <ChevronUp size={16} color="#3b82f6" />
        ) : (
          <ChevronDown size={16} color="#3b82f6" />
        )}
      </Pressable>

      {/* Full Weekly Schedule */}
      {showFullSchedule && (
        <View className="mt-3 pt-3 border-t border-border">
          {weeklySchedule.map((daySchedule) => (
            <View key={daySchedule.day} className="py-2">
              <View className="flex-row items-start justify-between">
                <Text
                  className={cn(
                    "text-sm capitalize text-foreground",
                    !daySchedule.isOpen && "text-muted-foreground",
                  )}
                >
                  {formatDayName(daySchedule.day)}
                </Text>
                <View className="flex-1 items-end">
                  {daySchedule.isOpen &&
                  daySchedule.hours &&
                  daySchedule.hours.length > 0 ? (
                    <View className="items-end flex-shrink">
                      {daySchedule.hours.map((shift, index) => (
                        <Text
                          key={index}
                          className={cn(
                            "text-sm text-foreground text-right flex-shrink",
                            index > 0 && "mt-0.5",
                          )}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.8}
                        >
                          {formatTime(shift.open)} - {formatTime(shift.close)}
                        </Text>
                      ))}
                    </View>
                  ) : (
                    <Text className="text-sm text-muted-foreground">
                      Closed
                    </Text>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

// Helper function to format time
function formatTime(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
}
