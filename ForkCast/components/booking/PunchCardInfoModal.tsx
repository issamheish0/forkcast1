// components/booking/PunchCardInfoModal.tsx
import React, { useState, useEffect } from "react";
import { Modal, View, Pressable } from "react-native";
import { QrCode, Sparkles, X, CheckCircle } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, P } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import * as Haptics from "expo-haptics";

const STORAGE_KEY = "@punch_card_info_modal_dismissed";

interface PunchCardInfoModalProps {
  /**
   * Whether to auto-show the modal (checks storage)
   */
  autoShow?: boolean;
}

export function PunchCardInfoModal({
  autoShow = true,
}: PunchCardInfoModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { colorScheme } = useColorScheme();
  const themeColors = colorScheme === "dark" ? colors.dark : colors.light;

  useEffect(() => {
    if (!autoShow) return;

    // Check if modal has been dismissed
    const checkDismissed = async () => {
      try {
        const dismissed = await AsyncStorage.getItem(STORAGE_KEY);
        if (!dismissed) {
          // Small delay to ensure screen is loaded
          setTimeout(() => {
            setIsVisible(true);
          }, 500);
        }
      } catch (error) {
        console.error("Error checking punch card modal status:", error);
        // Show by default if there's an error
        setIsVisible(true);
      }
    };

    checkDismissed();
  }, [autoShow]);

  const handleDismiss = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, "true");
      setIsVisible(false);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error("Error dismissing punch card modal:", error);
      setIsVisible(false);
    }
  };

  const handleGotIt = async () => {
    await handleDismiss();
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View
        className="flex-1 justify-center items-center px-6"
        style={{
          backgroundColor:
            colorScheme === "dark" ? "rgba(0,0,0,0.9)" : "rgba(0,0,0,0.6)",
        }}
      >
        <Pressable className="absolute inset-0" onPress={handleDismiss} />

        <View
          className="w-full rounded-xl p-4"
          style={{
            backgroundColor: themeColors.card,
            maxWidth: 340,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          {/* Close Button */}
          <Pressable
            onPress={handleDismiss}
            className="absolute top-3 right-3 z-10 p-1"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={18} color={themeColors.mutedForeground} />
          </Pressable>

          {/* Icon */}
          <View className="items-center mb-3">
            <View
              className="p-2.5 rounded-full mb-2"
              style={{ backgroundColor: themeColors.primary + "20" }}
            >
              <QrCode size={24} color={themeColors.primary} />
            </View>
            <Text className="text-center font-bold text-base mb-1">
              New: Punch Card Rewards! 🎉
            </Text>
          </View>

          {/* Content */}
          <View className="mb-4">
            <Text className="text-center text-muted-foreground mb-3 text-sm leading-5">
              Scan QR codes during your booking to earn punches. Collect 6 to
              unlock a{" "}
              <Text className="font-semibold text-primary">$50 reward</Text>!
            </Text>

            {/* How it works - Compact */}
            <View className="gap-2 mb-3">
              <View className="flex-row items-start gap-2">
                <CheckCircle
                  size={14}
                  color={themeColors.primary}
                  style={{ marginTop: 2 }}
                />
                <Text className="text-xs text-muted-foreground flex-1">
                  Scan QR code during booking time
                </Text>
              </View>

              <View className="flex-row items-start gap-2">
                <CheckCircle
                  size={14}
                  color={themeColors.primary}
                  style={{ marginTop: 2 }}
                />
                <Text className="text-xs text-muted-foreground flex-1">
                  Each scan = 1 punch
                </Text>
              </View>

              <View className="flex-row items-start gap-2">
                <CheckCircle
                  size={14}
                  color={themeColors.primary}
                  style={{ marginTop: 2 }}
                />
                <Text className="text-xs text-muted-foreground flex-1">
                  6 punches = $50 reward
                </Text>
              </View>
            </View>

            {/* Hint */}
            <View className="flex-row items-center gap-1.5 p-2 rounded-lg bg-muted/50">
              <Sparkles size={12} color={themeColors.primary} />
              <Text className="text-xs text-muted-foreground flex-1">
                Tap the QR button on bookings screen
              </Text>
            </View>
          </View>

          {/* Action Button */}
          <Button onPress={handleGotIt} size="sm" className="w-full h-10">
            <Text className="text-primary-foreground font-semibold text-sm">
              Got it!
            </Text>
          </Button>
        </View>
      </View>
    </Modal>
  );
}
