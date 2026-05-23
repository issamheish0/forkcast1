// components/booking/GuaranteeBadge.tsx
// Small badge component indicating a booking has a credit card guarantee

import React from "react";
import { View } from "react-native";
import { ShieldCheck, AlertTriangle } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";

type BadgeVariant = "default" | "charged" | "released" | "waived" | "failed";

interface GuaranteeBadgeProps {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

const variantConfig: Record<
  BadgeVariant,
  {
    bgColor: string;
    textColor: string;
    icon: typeof ShieldCheck;
    label: string;
  }
> = {
  default: {
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-600 dark:text-blue-400",
    icon: ShieldCheck,
    label: "Guaranteed",
  },
  charged: {
    bgColor: "bg-red-500/10",
    textColor: "text-red-600 dark:text-red-400",
    icon: AlertTriangle,
    label: "Charged",
  },
  released: {
    bgColor: "bg-green-500/10",
    textColor: "text-green-600 dark:text-green-400",
    icon: ShieldCheck,
    label: "Released",
  },
  waived: {
    bgColor: "bg-gray-500/10",
    textColor: "text-gray-600 dark:text-gray-400",
    icon: ShieldCheck,
    label: "Waived",
  },
  failed: {
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-600 dark:text-amber-400",
    icon: AlertTriangle,
    label: "Failed",
  },
};

export function GuaranteeBadge({
  variant = "default",
  size = "sm",
  showLabel = true,
  className,
}: GuaranteeBadgeProps) {
  const config = variantConfig[variant];
  const IconComponent = config.icon;

  const iconSize = size === "sm" ? 12 : 14;
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const padding = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";

  // Extract color for icon from text color class
  const iconColorMap: Record<string, string> = {
    "text-blue-600 dark:text-blue-400": "#2563EB",
    "text-red-600 dark:text-red-400": "#DC2626",
    "text-green-600 dark:text-green-400": "#16A34A",
    "text-gray-600 dark:text-gray-400": "#6B7280",
    "text-amber-600 dark:text-amber-400": "#D97706",
  };

  const iconColor = iconColorMap[config.textColor] || colors.light.primary;

  return (
    <View
      className={cn(
        "flex-row items-center rounded-full",
        config.bgColor,
        padding,
        className,
      )}
    >
      <IconComponent size={iconSize} color={iconColor} strokeWidth={2.5} />
      {showLabel && (
        <Text className={cn("font-medium ml-1", textSize, config.textColor)}>
          {config.label}
        </Text>
      )}
    </View>
  );
}

// Compact icon-only version for tight spaces
export function GuaranteeIcon({
  variant = "default",
  size = 16,
}: {
  variant?: BadgeVariant;
  size?: number;
}) {
  const config = variantConfig[variant];
  const IconComponent = config.icon;

  const iconColorMap: Record<string, string> = {
    "text-blue-600 dark:text-blue-400": "#2563EB",
    "text-red-600 dark:text-red-400": "#DC2626",
    "text-green-600 dark:text-green-400": "#16A34A",
    "text-gray-600 dark:text-gray-400": "#6B7280",
    "text-amber-600 dark:text-amber-400": "#D97706",
  };

  return (
    <IconComponent
      size={size}
      color={iconColorMap[config.textColor] || colors.light.primary}
      strokeWidth={2}
    />
  );
}

// Helper to convert guarantee status to badge variant
export function getGuaranteeBadgeVariant(
  status: string | null | undefined,
): BadgeVariant {
  switch (status) {
    case "held":
    case "active": // backwards-compat if older DB rows ever used this
      return "default";
    case "charged":
      return "charged";
    case "released":
      return "released";
    case "waived":
      return "waived";
    case "failed":
      return "failed";
    default:
      return "default";
  }
}
