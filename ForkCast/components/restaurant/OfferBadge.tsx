// components/restaurant/OfferBadge.tsx
import React from "react";
import { View, Pressable } from "react-native";
import { Percent, Tag } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

interface OfferBadgeProps {
  /** Discount percentage to display */
  discount: number;
  /** Visual style variant */
  variant?: "default" | "compact" | "mini" | "text";
  /** Position for absolute positioning */
  position?:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "inline";
  /** Optional onPress handler */
  onPress?: () => void;
  /** Additional className */
  className?: string;
  /** Show "OFF" label or just percentage */
  showLabel?: boolean;
}

/**
 * OfferBadge - Displays a subtle, elegant discount badge on restaurant cards
 * Industry-standard design: small, clean, non-intrusive
 *
 * Usage:
 * <OfferBadge discount={20} variant="default" position="top-left" />
 */
export const OfferBadge: React.FC<OfferBadgeProps> = ({
  discount,
  variant = "default",
  position = "inline",
  onPress,
  className,
  showLabel = true,
}) => {
  if (!discount || discount <= 0) return null;

  // Position styles - aligned with action buttons (top-3 for featured cards, top-2 for horizontal)
  const positionStyles = {
    "top-left": "absolute top-3 left-3 z-10",
    "top-right": "absolute top-3 right-3 z-10",
    "bottom-left": "absolute bottom-2 left-2 z-10",
    "bottom-right": "absolute bottom-2 right-2 z-10",
    inline: "",
  };

  // Get color based on discount amount - using burgundy (primary) color
  const getColors = () => {
    return {
      bg: "bg-primary",
      text: "text-white",
    };
  };

  const colors = getColors();
  const positionClass = positionStyles[position];

  // Variant configurations - round, aligned with buttons
  const variantStyles = {
    default: {
      container: cn(colors.bg, "px-2 py-1 rounded-full"),
      text: cn(colors.text, "text-[10px] font-bold"),
      showIcon: false,
    },
    compact: {
      container: cn(colors.bg, "px-1.5 py-0.5 rounded-full"),
      text: cn(colors.text, "text-[9px] font-bold"),
      showIcon: false,
    },
    mini: {
      container: cn(colors.bg, "px-1 py-0.5 rounded-full"),
      text: cn(colors.text, "text-[8px] font-bold"),
      showIcon: false,
    },
    text: {
      container: "bg-transparent",
      text: "text-primary dark:text-primary text-[10px] font-semibold",
      showIcon: true,
    },
  };

  const styles = variantStyles[variant];

  const BadgeContent = () => (
    <View className={cn(styles.container, positionClass, className)}>
      <View className="flex-row items-center justify-center">
        {styles.showIcon && (
          <Percent
            size={8}
            color="hsl(345, 55%, 31%)"
            style={{ marginRight: 2 }}
          />
        )}
        <Text className={styles.text}>
          {discount}%{showLabel && variant !== "mini" ? " OFF" : ""}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} hitSlop={8}>
        <BadgeContent />
      </Pressable>
    );
  }

  return <BadgeContent />;
};

/**
 * OfferIndicator - A smaller indicator showing a restaurant has offers
 * For use in compact/horizontal card variants
 */
interface OfferIndicatorProps {
  hasOffer: boolean;
  discount?: number;
  className?: string;
  variant?: "default" | "subtle" | "bold";
}

export const OfferIndicator: React.FC<OfferIndicatorProps> = ({
  hasOffer,
  discount,
  className,
  variant = "default",
}) => {
  if (!hasOffer) return null;

  const variantStyles = {
    default: {
      container: "bg-green-100 dark:bg-green-900/40",
      iconColor: "#22c55e",
      textColor: "text-green-600 dark:text-green-400",
    },
    subtle: {
      container: "bg-gray-100 dark:bg-gray-800",
      iconColor: "#14b8a6",
      textColor: "text-teal-600 dark:text-teal-400",
    },
    bold: {
      container: "bg-green-500 dark:bg-green-600",
      iconColor: "white",
      textColor: "text-white",
    },
  };

  const styles = variantStyles[variant];

  return (
    <View
      className={cn(
        "flex-row items-center px-1.5 py-0.5 rounded",
        styles.container,
        className,
      )}
    >
      <Percent size={10} color={styles.iconColor} />
      {discount && discount > 0 && (
        <Text
          className={cn("font-semibold text-[10px] ml-0.5", styles.textColor)}
        >
          {discount}%
        </Text>
      )}
    </View>
  );
};

/**
 * OfferTag - An inline text tag for lists and details
 */
interface OfferTagProps {
  discount: number;
  label?: string;
  className?: string;
}

export const OfferTag: React.FC<OfferTagProps> = ({
  discount,
  label = "Special Offer",
  className,
}) => {
  if (!discount || discount <= 0) return null;

  return (
    <View
      className={cn(
        "flex-row items-center bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 px-2 py-1 rounded-lg",
        className,
      )}
    >
      <Tag size={12} color="#22c55e" />
      <Text className="text-green-700 dark:text-green-400 font-medium text-xs ml-1.5">
        {label}: {discount}% off
      </Text>
    </View>
  );
};

export default OfferBadge;
