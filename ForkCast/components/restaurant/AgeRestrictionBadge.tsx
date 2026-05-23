import React from "react";
import { View } from "react-native";
import { Shield, AlertTriangle } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import {
  getAgeRestrictionLevel,
  formatAgeRestriction,
} from "@/utils/ageVerification";
import { Database } from "@/types/supabase";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

interface AgeRestrictionBadgeProps {
  restaurant: Restaurant;
  variant?: "card" | "detail" | "compact";
}

export const AgeRestrictionBadge: React.FC<AgeRestrictionBadgeProps> = ({
  restaurant,
  variant = "card",
}) => {
  const level = getAgeRestrictionLevel(restaurant);

  // Don't show if no age restriction
  if (level === "none") return null;

  const getBadgeStyles = () => {
    switch (level) {
      case "strict":
        return {
          bg: "bg-red-100 dark:bg-red-900/30",
          border: "border-red-200 dark:border-red-800",
          text: "text-red-700 dark:text-red-300",
          icon: AlertTriangle,
          iconColor: "#dc2626",
        };
      case "adult":
        return {
          bg: "bg-orange-100 dark:bg-orange-900/30",
          border: "border-orange-200 dark:border-orange-800",
          text: "text-orange-700 dark:text-orange-300",
          icon: Shield,
          iconColor: "#ea580c",
        };
      case "minor":
        return {
          bg: "bg-yellow-100 dark:bg-yellow-900/30",
          border: "border-yellow-200 dark:border-yellow-800",
          text: "text-yellow-700 dark:text-yellow-300",
          icon: Shield,
          iconColor: "#ca8a04",
        };
      default:
        return {
          bg: "bg-gray-100 dark:bg-gray-900/30",
          border: "border-gray-200 dark:border-gray-800",
          text: "text-gray-700 dark:text-gray-300",
          icon: Shield,
          iconColor: "#64748b",
        };
    }
  };

  const styles = getBadgeStyles();
  const IconComponent = styles.icon;

  if (variant === "compact") {
    return (
      <View
        className={`flex-row items-center px-2 py-1 rounded-full ${styles.bg} ${styles.border} border`}
      >
        <IconComponent size={12} color={styles.iconColor} />
        <Text className={`ml-1 text-xs font-medium ${styles.text}`}>
          {restaurant.minimum_age}+
        </Text>
      </View>
    );
  }

  if (variant === "detail") {
    return (
      <View
        className={`flex-row items-center px-3 py-2 rounded-lg ${styles.bg} ${styles.border} border`}
      >
        <IconComponent size={16} color={styles.iconColor} />
        <Text className={`ml-2 text-sm font-medium ${styles.text}`}>
          {formatAgeRestriction(restaurant.minimum_age)}
        </Text>
      </View>
    );
  }

  // Default card variant
  return (
    <View
      className={`flex-row items-center px-2 py-1 rounded-md ${styles.bg} ${styles.border} border`}
    >
      <IconComponent size={14} color={styles.iconColor} />
      <Text className={`ml-1 text-xs font-medium ${styles.text}`}>
        {restaurant.minimum_age}+
      </Text>
    </View>
  );
};
