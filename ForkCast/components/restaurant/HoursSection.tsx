import React from "react";
import { View } from "react-native";
import { Clock, DollarSign } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { Database } from "@/types/supabase";
import { useRestaurantOpenHours } from "@/hooks/useRestaurantOpenHours";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & {
  happy_hour_times?: { start: string; end: string };
};

interface HoursSectionProps {
  restaurant: Restaurant;
}

const HoursSectionComponent = ({ restaurant }: HoursSectionProps) => {
  const { colorScheme } = useColorScheme();
  const {
    formatDisplayHours,
    checkAvailability,
    loading: availabilityLoading,
  } = useRestaurantOpenHours(restaurant.id);

  const availability = React.useMemo(
    () => checkAvailability(new Date()),
    [checkAvailability],
  );

  return (
    <View className="px-4 mb-6">
      <H3 className="mb-3">Hours</H3>
      <View className="bg-card p-4 rounded-lg">
        {!availabilityLoading && (
          <View className="flex-row items-center gap-2 mb-2">
            <Clock
              size={20}
              color={availability.isOpen ? "#10b981" : "#ef4444"}
            />
            <Text className="font-medium text-foreground">
              Today: {formatDisplayHours()}
            </Text>
            <View
              className={`px-2 py-1 rounded-full ml-auto ${
                availability.isOpen
                  ? "bg-green-100 dark:bg-green-900/30"
                  : "bg-red-100 dark:bg-red-900/30"
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  availability.isOpen
                    ? "text-green-800 dark:text-green-300"
                    : "text-red-800 dark:text-red-300"
                }`}
              >
                {availability.isOpen ? "Open" : "Closed"}
              </Text>
            </View>
          </View>
        )}
        {restaurant.happy_hour_times && (
          <View className="flex-row items-center gap-2 mt-2 pt-2 border-t border-border">
            <DollarSign size={20} color={colors[colorScheme].foreground} />
            <Text className="text-green-600 dark:text-green-400">
              Happy Hour: {restaurant.happy_hour_times.start} -{" "}
              {restaurant.happy_hour_times.end}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

// Memoize to prevent re-renders when parent updates
export const HoursSection = React.memo(HoursSectionComponent);
