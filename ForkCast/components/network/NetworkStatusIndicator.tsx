import React from "react";
import { View } from "react-native";
import { Wifi, WifiOff, Signal } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useConnectionStatus } from "@/context/network-provider";
import { useColorScheme } from "@/lib/useColorScheme";

interface NetworkStatusIndicatorProps {
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "icon" | "badge" | "full";
}

export function NetworkStatusIndicator({
  showText = false,
  size = "md",
  variant = "icon",
}: NetworkStatusIndicatorProps) {
  const { isOnline, isSlowConnection, connectionQuality } =
    useConnectionStatus();
  const { colorScheme } = useColorScheme();

  const sizeMap = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  const iconSize = sizeMap[size];

  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        color: "#792339", // Mulberry Velvet
        text: "Offline",
        bgColor: "bg-destructive/10",
        textColor: "text-destructive",
      };
    }

    if (isSlowConnection) {
      return {
        icon: Signal,
        color: "#792339", // Mulberry Velvet
        text: `Slow (${connectionQuality})`,
        bgColor: "bg-primary/10",
        textColor: "text-primary",
      };
    }

    return {
      icon: Wifi,
      color: "#792339", // Mulberry Velvet
      text: `Online (${connectionQuality})`,
      bgColor: "bg-primary/10",
      textColor: "text-primary",
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  if (variant === "icon") {
    return <Icon size={iconSize} color={config.color} />;
  }

  if (variant === "badge") {
    return (
      <View
        className={`${config.bgColor} px-2 py-1 rounded-full flex-row items-center`}
      >
        <Icon size={12} color={config.color} />
        {showText && (
          <Text className={`${config.textColor} text-xs font-medium ml-1`}>
            {config.text}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View className="flex-row items-center">
      <Icon size={iconSize} color={config.color} />
      {showText && (
        <Text className={`${config.textColor} font-medium ml-2`}>
          {config.text}
        </Text>
      )}
    </View>
  );
}
