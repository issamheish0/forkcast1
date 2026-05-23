import React from "react";
import { View, Pressable } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { H1, H2, H3, H4, Muted } from "@/components/ui/typography";
import { Text } from "@/components/ui/text";
import { cn, getThemedColors } from "@/lib/utils";
import { useColorScheme } from "@/lib/useColorScheme";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "default" | "large" | "simple" | "compact";
  titleVariant?: "h1" | "h2" | "h3" | "h4";
  className?: string;
  showChevron?: boolean;
}

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  variant = "default",
  titleVariant = "h3",
  className,
  showChevron = true,
}: SectionHeaderProps) {
  const { colorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);
  const TitleComponent =
    titleVariant === "h1"
      ? H1
      : titleVariant === "h2"
        ? H2
        : titleVariant === "h3"
          ? H3
          : H4;

  if (variant === "simple") {
    return (
      <View className={cn("bg-background px-4 py-2", className)}>
        <Text className="font-semibold text-muted-foreground">{title}</Text>
      </View>
    );
  }

  if (variant === "compact") {
    return (
      <View
        className={cn(
          "px-4 mb-3 flex-row items-center justify-between",
          className,
        )}
      >
        <View>
          <TitleComponent>{title}</TitleComponent>
        </View>
        {actionLabel && onAction && (
          <Pressable onPress={onAction}>
            <Text
              className={`text-xs ${
                colorScheme === "dark" ? "text-white" : "text-primary"
              }`}
            >
              {actionLabel}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View
      className={cn(
        "flex-row items-center justify-between px-4 mb-3",
        className,
      )}
    >
      <View className="flex-1">
        <TitleComponent>{title}</TitleComponent>
        {subtitle && <Muted className="text-sm mt-1">{subtitle}</Muted>}
      </View>
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          className="flex-row items-center gap-1"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text
            className={`text-xs ${
              colorScheme === "dark" ? "text-white" : "text-primary"
            }`}
          >
            {actionLabel}
          </Text>
          {showChevron && (
            <ChevronRight
              size={14}
              color={colorScheme === "dark" ? "#ffffff" : themedColors.primary}
            />
          )}
        </Pressable>
      )}
    </View>
  );
}
