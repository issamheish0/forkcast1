import React from "react";
import { View, Pressable } from "react-native";
import { Sun, Moon, Monitor } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/useColorScheme";
import { getThemedColors } from "@/lib/utils";

interface ThemeToggleProps {
  variant?: "compact" | "full";
  showLabels?: boolean;
}

export function ThemeToggle({
  variant = "full",
  showLabels = true,
}: ThemeToggleProps) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);

  const themes = [
    {
      id: "light" as const,
      label: "Light",
      icon: Sun,
    },
    {
      id: "dark" as const,
      label: "Dark",
      icon: Moon,
    },
    {
      id: "system" as const,
      label: "System",
      icon: Monitor,
    },
  ];

  if (variant === "compact") {
    return (
      <Pressable
        onPress={() => {
          const nextTheme = colorScheme === "light" ? "dark" : "light";
          setColorScheme(nextTheme);
        }}
        className="flex-row items-center gap-2 p-2 rounded-lg bg-muted"
      >
        {colorScheme === "light" ? (
          <Sun size={20} color={themedColors.foreground} />
        ) : (
          <Moon size={20} color={themedColors.foreground} />
        )}
        {showLabels && (
          <Text className="text-sm font-medium">
            {colorScheme === "light" ? "Light" : "Dark"}
          </Text>
        )}
      </Pressable>
    );
  }

  return (
    <View className="flex-row bg-muted rounded-lg p-1">
      {themes.map((theme) => {
        const isActive = colorScheme === theme.id;
        const IconComponent = theme.icon;

        return (
          <Pressable
            key={theme.id}
            onPress={() => setColorScheme(theme.id as any)}
            className={`flex-1 flex-row items-center justify-center gap-2 py-2 px-3 rounded-md ${
              isActive ? "bg-background shadow-sm" : ""
            }`}
          >
            <IconComponent
              size={16}
              color={
                isActive ? themedColors.primary : themedColors.mutedForeground
              }
            />
            {showLabels && (
              <Text
                className={`text-sm font-medium ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {theme.label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
