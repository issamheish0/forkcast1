import React from "react";
import { View, Pressable, useColorScheme } from "react-native";
import { ChevronLeft, Share2, Camera } from "lucide-react-native";
import { colors } from "@/constants/colors";
import { H3 } from "@/components/ui/typography";

interface NavigationHeaderProps {
  /** Title to display in the center */
  title: string;
  /** Function to call when back button is pressed */
  onBack?: () => void;
  /** Function to call when share button is pressed */
  onShare?: () => void;
  /** Whether to show the share button */
  showShare?: boolean;
  /** Function to call when camera button is pressed */
  onCamera?: () => void;
  /** Whether to show the camera button */
  showCamera?: boolean;
  /** Additional class names for custom styling */
  className?: string;
}

function NavigationHeaderComponent({
  title,
  onBack,
  onShare,
  showShare = false,
  onCamera,
  showCamera = false,
  className = "",
}: NavigationHeaderProps) {
  const colorScheme = useColorScheme() ?? "light";

  return (
    <View
      className={`flex-row items-center justify-between px-4 py-3 border-b border-border bg-card ${className}`}
    >
      {/* Back Button */}
      <Pressable onPress={onBack} className="p-1 -ml-1">
        <ChevronLeft
          size={20}
          color={colors[colorScheme]?.foreground ?? colors.light.foreground}
        />
      </Pressable>

      {/* Title */}
      <H3 className="text-foreground font-medium flex-1 text-center px-4">
        {title}
      </H3>

      {/* Right Side Actions */}
      <View className="flex-row items-center gap-2">
        {/* Camera Button */}
        {showCamera && onCamera ? (
          <Pressable onPress={onCamera} className="p-1">
            <Camera
              size={20}
              color={colors[colorScheme]?.primary ?? colors.light.primary}
            />
          </Pressable>
        ) : null}

        {/* Share Button */}
        {showShare ? (
          <Pressable onPress={onShare} className="p-1 -mr-1">
            <Share2
              size={20}
              color={colors[colorScheme]?.foreground ?? colors.light.foreground}
            />
          </Pressable>
        ) : (
          <View className="w-6" />
        )}
      </View>
    </View>
  );
}

// Memoize to prevent re-renders on navigation screens
export const NavigationHeader = React.memo(NavigationHeaderComponent);
