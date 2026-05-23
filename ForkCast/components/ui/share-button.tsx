import React from "react";
import { Pressable, ViewStyle } from "react-native";
import { Share2, Copy, Link } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/useColorScheme";
import { cn } from "@/lib/utils";

export interface ShareButtonProps {
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "copy";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  style?: ViewStyle;
  hitSlop?: { top: number; bottom: number; left: number; right: number };
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  onPress,
  variant = "ghost",
  size = "md",
  disabled = false,
  className,
  style,
  hitSlop = { top: 12, bottom: 12, left: 12, right: 12 },
}) => {
  const { colorScheme } = useColorScheme();

  const handlePress = async () => {
    if (disabled) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const getIconSize = () => {
    switch (size) {
      case "sm":
        return 16;
      case "lg":
        return 24;
      default:
        return 20;
    }
  };

  const getIconColor = () => {
    if (disabled) return colorScheme === "dark" ? "#6b7280" : "#9ca3af";

    switch (variant) {
      case "primary":
        return "#ffffff";
      case "secondary":
        return colorScheme === "dark" ? "#e5e7eb" : "#374151";
      case "copy":
        return colorScheme === "dark" ? "#60a5fa" : "#3b82f6";
      default:
        return colorScheme === "dark" ? "#d1d5db" : "#6b7280";
    }
  };

  const getIcon = () => {
    const IconComponent = variant === "copy" ? Copy : Share2;
    return <IconComponent size={getIconSize()} color={getIconColor()} />;
  };

  const baseClasses = cn(
    "flex-row items-center justify-center rounded-full",
    {
      // Size variants
      "w-8 h-8": size === "sm",
      "w-10 h-10": size === "md",
      "w-12 h-12": size === "lg",

      // Style variants
      "bg-primary": variant === "primary",
      "bg-secondary border border-border": variant === "secondary",
      "bg-transparent": variant === "ghost",
      "bg-blue-100 dark:bg-blue-900/30": variant === "copy",

      // Disabled state
      "opacity-50": disabled,
    },
    className,
  );

  return (
    <Pressable
      onPress={handlePress}
      className={baseClasses}
      style={[style, disabled && { pointerEvents: "none" }]}
      hitSlop={hitSlop}
      disabled={disabled}
    >
      {getIcon()}
    </Pressable>
  );
};

export interface ShareButtonWithTextProps extends ShareButtonProps {
  text?: string;
  showText?: boolean;
}

export const ShareButtonWithText: React.FC<ShareButtonWithTextProps> = ({
  text = "Share",
  showText = true,
  onPress,
  variant = "ghost",
  size = "md",
  disabled = false,
  className,
  style,
  hitSlop,
}) => {
  const { colorScheme } = useColorScheme();

  const handlePress = async () => {
    if (disabled) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const getIconSize = () => {
    switch (size) {
      case "sm":
        return 14;
      case "lg":
        return 18;
      default:
        return 16;
    }
  };

  const getIconColor = () => {
    if (disabled) return colorScheme === "dark" ? "#6b7280" : "#9ca3af";

    switch (variant) {
      case "primary":
        return "#ffffff";
      case "secondary":
        return colorScheme === "dark" ? "#e5e7eb" : "#374151";
      case "copy":
        return colorScheme === "dark" ? "#60a5fa" : "#3b82f6";
      default:
        return colorScheme === "dark" ? "#d1d5db" : "#6b7280";
    }
  };

  const getTextColor = () => {
    if (disabled) return "text-muted-foreground/50";

    switch (variant) {
      case "primary":
        return "text-primary-foreground";
      case "secondary":
        return "text-secondary-foreground";
      case "copy":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-muted-foreground";
    }
  };

  const getIcon = () => {
    const IconComponent = variant === "copy" ? Copy : Share2;
    return <IconComponent size={getIconSize()} color={getIconColor()} />;
  };

  const baseClasses = cn(
    "flex-row items-center justify-center space-x-2 rounded-full px-3 py-2",
    {
      // Style variants
      "bg-primary": variant === "primary",
      "bg-secondary border border-border": variant === "secondary",
      "bg-transparent": variant === "ghost",
      "bg-blue-100 dark:bg-blue-900/30": variant === "copy",

      // Disabled state
      "opacity-50": disabled,
    },
    className,
  );

  return (
    <Pressable
      onPress={handlePress}
      className={baseClasses}
      style={[style, disabled && { pointerEvents: "none" }]}
      hitSlop={hitSlop || { top: 8, bottom: 8, left: 8, right: 8 }}
      disabled={disabled}
    >
      {getIcon()}
      {showText && (
        <Text className={cn("text-sm font-medium", getTextColor())}>
          {text}
        </Text>
      )}
    </Pressable>
  );
};

export interface FloatingShareButtonProps extends ShareButtonProps {
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  offset?: { top?: number; bottom?: number; left?: number; right?: number };
}

export const FloatingShareButton: React.FC<FloatingShareButtonProps> = ({
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  className,
  style,
  position = "top-right",
  offset = {},
  hitSlop,
}) => {
  const defaultOffset = { top: 16, right: 16, bottom: 16, left: 16 };
  const finalOffset = { ...defaultOffset, ...offset };

  const getPositionClasses = () => {
    switch (position) {
      case "top-left":
        return "absolute top-0 left-0";
      case "top-right":
        return "absolute top-0 right-0";
      case "bottom-left":
        return "absolute bottom-0 left-0";
      case "bottom-right":
        return "absolute bottom-0 right-0";
      default:
        return "absolute top-0 right-0";
    }
  };

  return (
    <ShareButton
      onPress={onPress}
      variant={variant}
      size={size}
      disabled={disabled}
      className={cn(
        getPositionClasses(),
        "z-50 shadow-lg backdrop-blur-sm",
        variant === "primary" && "bg-black/60",
        className,
      )}
      style={Object.assign(
        {},
        {
          marginTop: finalOffset.top,
          marginRight: finalOffset.right,
          marginBottom: finalOffset.bottom,
          marginLeft: finalOffset.left,
        },
        style,
      )}
      hitSlop={hitSlop}
    />
  );
};
