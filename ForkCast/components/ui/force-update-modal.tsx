import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Platform,
  Linking,
  Alert,
  Pressable,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/lib/useColorScheme";
import { getThemedColors } from "@/lib/utils";
import * as Application from "expo-application";
import AsyncStorage from "@react-native-async-storage/async-storage";

type UpdateMode = "soft" | "hard";

interface ForceUpdateModalProps {
  /**
   * Whether the modal is visible
   */
  visible: boolean;
  /**
   * Update mode: "soft" (dismissible) or "hard" (mandatory)
   */
  mode: UpdateMode;
  /**
   * Current app version
   */
  currentVersion: string;
  /**
   * Required/suggested version
   */
  targetVersion: string;
}

const DISMISS_KEY = "soft_update_dismissed_version";

/**
 * Utility function to clear dismissed state (for testing)
 * Call this from dev menu or console to reset soft update dismissal
 */
export async function clearDismissedUpdate(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DISMISS_KEY);
  } catch (error) {
    console.error("Error clearing dismissed state:", error);
  }
}

/**
 * Modal that prompts or forces users to update the app.
 * - Soft mode: Dismissible modal suggesting update (user can skip)
 * - Hard mode: Blocking modal forcing update (user must update)
 */
export function ForceUpdateModal({
  visible,
  mode,
  currentVersion,
  targetVersion,
}: ForceUpdateModalProps): React.JSX.Element {
  const { colorScheme } = useColorScheme();
  const [localVisible, setLocalVisible] = useState(visible);

  // Update local visibility when prop changes
  useEffect(() => {
    setLocalVisible(visible);
  }, [visible]);

  const handleDismiss = async (): Promise<void> => {
    try {
      // Store the version that was dismissed
      await AsyncStorage.setItem(DISMISS_KEY, targetVersion);
      setLocalVisible(false);
    } catch (error) {
      console.error("Error saving dismissed state:", error);
      setLocalVisible(false);
    }
  };

  const { colorScheme: theme } = useColorScheme();

  const handleUpdate = async (): Promise<void> => {
    try {
      let storeUrl: string;

      if (Platform.OS === "ios") {
        // iOS App Store URL - Replace with your actual App Store ID
        storeUrl =
          "https://apps.apple.com/lb/app/plate-no-call-no-wait/id6751504077";
      } else if (Platform.OS === "android") {
        // Android Play Store URL - Replace with your actual package name
        const packageName = Application.applicationId || "com.notqwerty.plate";
        storeUrl = `https://play.google.com/store/apps/details?id=${packageName}`;
      } else {
        Alert.alert("Error", "Platform not supported");
        return;
      }

      const canOpen = await Linking.canOpenURL(storeUrl);
      if (canOpen) {
        await Linking.openURL(storeUrl);
      } else {
        Alert.alert(
          "Cannot Open Store",
          "Please update the app manually from your app store.",
        );
      }
    } catch (error) {
      console.error("Error opening app store:", error);
      Alert.alert(
        "Error",
        "Could not open the app store. Please update manually.",
      );
    }
  };

  const isSoftMode = mode === "soft";
  const isHardMode = mode === "hard";
  const themedColors = getThemedColors(colorScheme);

  // Convert HSL to rgba for gradient
  const hslToRgba = (hsl: string, alpha: number = 1): string => {
    const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!match) return `rgba(255, 255, 255, ${alpha})`;

    const h = parseInt(match[1]) / 360;
    const s = parseInt(match[2]) / 100;
    const l = parseInt(match[3]) / 100;

    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
  };

  const gradientColors = [
    hslToRgba(themedColors.cardGradientFrom, 0.95),
    hslToRgba(themedColors.cardGradientTo, 0.98),
    hslToRgba(themedColors.cardGradientFrom, 0.95),
  ] as const;

  return (
    <Modal
      visible={localVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        // Allow dismissal in soft mode, prevent in hard mode
        if (isSoftMode) {
          handleDismiss();
        }
      }}
    >
      <View
        className="flex-1 justify-center items-center"
        style={{
          backgroundColor:
            colorScheme === "dark" ? "rgba(0,0,0,0.9)" : "rgba(0,0,0,0.6)",
        }}
      >
        <Pressable
          className="absolute inset-0"
          onPress={() => {
            // Allow tap outside to dismiss in soft mode only
            if (isSoftMode) {
              handleDismiss();
            }
          }}
        />

        <View className="w-full px-6" style={{ maxWidth: 440 }}>
          <View
            style={{
              borderRadius: 12,
              overflow: "hidden",
              shadowColor:
                colorScheme === "dark" ? "#000" : themedColors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: colorScheme === "dark" ? 0.3 : 0.06,
              shadowRadius: 6,
              elevation: 4,
            }}
          >
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 12, padding: 24 }}
            >
              {/* Close button for soft mode */}
              {isSoftMode && (
                <Pressable
                  onPress={handleDismiss}
                  className="absolute top-4 right-4 z-10"
                  accessibilityLabel="Dismiss update notification"
                  accessibilityHint="Skip this update for now"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="close-circle"
                    size={28}
                    color={colorScheme === "dark" ? "#999" : "#666"}
                  />
                </Pressable>
              )}

              {/* Icon */}
              <View className="items-center mb-3">
                <View
                  className="w-16 h-16 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: isSoftMode
                      ? colorScheme === "dark"
                        ? "rgba(107,169,255,0.2)"
                        : "rgba(107,169,255,0.15)"
                      : colorScheme === "dark"
                        ? "rgba(255,107,107,0.2)"
                        : "rgba(255,107,107,0.15)",
                  }}
                >
                  <Ionicons
                    name={isSoftMode ? "information-circle" : "alert-circle"}
                    size={40}
                    color={
                      isSoftMode
                        ? colorScheme === "dark"
                          ? "#6ba9ff"
                          : "#4a90e2"
                        : colorScheme === "dark"
                          ? "#ff6b6b"
                          : "#e63946"
                    }
                  />
                </View>
              </View>

              {/* Title */}
              <Text className="text-xl font-bold text-center text-foreground mb-2">
                {isSoftMode ? "Update Available" : "Update Required"}
              </Text>

              {/* Description */}
              <Text className="text-sm text-center text-muted-foreground leading-5 mb-3">
                {isSoftMode
                  ? "A new version of ForkCast is available with exciting features and improvements."
                  : "A critical update is required to continue using ForkCast. Please update now."}
              </Text>

              {/* Version Info */}
              <View className="w-full bg-muted/30 rounded-lg p-3 mb-4">
                <View className="flex-row justify-between items-center mb-1.5">
                  <Text className="text-xs text-muted-foreground">
                    Current Version:
                  </Text>
                  <Text className="text-xs font-semibold text-foreground">
                    {currentVersion}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-muted-foreground">
                    {isSoftMode ? "Latest Version:" : "Required Version:"}
                  </Text>
                  <Text className="text-xs font-semibold text-primary">
                    {targetVersion}
                  </Text>
                </View>
              </View>

              {/* Update Button */}
              <Button
                onPress={handleUpdate}
                className="w-full mb-2"
                size="default"
                accessibilityLabel="Update app now"
                accessibilityHint="Opens the app store to update ForkCast"
              >
                <View className="flex-row items-center justify-center">
                  <Ionicons
                    name="download"
                    size={18}
                    color={colorScheme === "dark" ? "#1a1a1a" : "#ffffff"}
                  />
                  <Text className="text-primary-foreground font-semibold text-sm ml-2">
                    Update Now
                  </Text>
                </View>
              </Button>

              {/* Maybe Later button for soft mode */}
              {isSoftMode && (
                <Button
                  onPress={handleDismiss}
                  variant="ghost"
                  className="w-full mb-2"
                  accessibilityLabel="Maybe later"
                  accessibilityHint="Dismiss this update notification"
                >
                  <Text className="text-muted-foreground font-medium text-sm">
                    Maybe Later
                  </Text>
                </Button>
              )}

              {/* Info text */}
              <Text className="text-xs text-center text-muted-foreground">
                {isSoftMode
                  ? "You can continue using the app, but we recommend updating soon."
                  : "This update is required to continue using ForkCast. Thank you for your patience!"}
              </Text>
            </LinearGradient>
          </View>
        </View>
      </View>
    </Modal>
  );
}
