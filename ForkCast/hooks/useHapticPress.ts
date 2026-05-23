// hooks/useHapticPress.ts
import { useCallback, useRef } from "react";
import * as Haptics from "expo-haptics";

export interface HapticPressOptions {
  /**
   * Haptic feedback style
   * @default Haptics.ImpactFeedbackStyle.Light
   */
  hapticStyle?: Haptics.ImpactFeedbackStyle;
  /**
   * Debounce delay in milliseconds to prevent double-clicks
   * @default 300
   */
  debounceMs?: number;
  /**
   * Whether to enable haptic feedback
   * @default true
   */
  enableHaptic?: boolean;
  /**
   * Whether to enable double-click prevention
   * @default true
   */
  enableDebounce?: boolean;
}

/**
 * Custom hook that provides haptic feedback and double-click prevention
 * for pressable components throughout the app
 */
export function useHapticPress(options: HapticPressOptions = {}) {
  const {
    hapticStyle = Haptics.ImpactFeedbackStyle.Light,
    debounceMs = 300,
    enableHaptic = true,
    enableDebounce = true,
  } = options;

  const lastPressTime = useRef<number>(0);
  const isProcessing = useRef<boolean>(false);

  const handlePress = useCallback(
    async (callback: () => void | Promise<void>) => {
      const now = Date.now();

      // Double-click prevention
      if (enableDebounce) {
        if (isProcessing.current) {
          return;
        }

        if (now - lastPressTime.current < debounceMs) {
          return;
        }

        lastPressTime.current = now;
        isProcessing.current = true;
      }

      try {
        // Haptic feedback
        if (enableHaptic) {
          await Haptics.impactAsync(hapticStyle);
        }

        // Execute callback
        await callback();
      } catch (error) {
        console.error("Error in haptic press handler:", error);
      } finally {
        if (enableDebounce) {
          // Reset processing flag after a short delay
          setTimeout(() => {
            isProcessing.current = false;
          }, debounceMs);
        }
      }
    },
    [hapticStyle, debounceMs, enableHaptic, enableDebounce],
  );

  return { handlePress };
}

/**
 * Hook for handling restaurant card presses with appropriate haptic feedback
 */
export function useRestaurantPress() {
  return useHapticPress({
    hapticStyle: Haptics.ImpactFeedbackStyle.Medium,
    debounceMs: 500, // Longer debounce for navigation
    enableHaptic: true,
    enableDebounce: true,
  });
}

/**
 * Hook for handling booking button presses with stronger haptic feedback
 */
export function useBookingPress() {
  return useHapticPress({
    hapticStyle: Haptics.ImpactFeedbackStyle.Heavy,
    debounceMs: 1000, // Longer debounce for booking actions
    enableHaptic: true,
    enableDebounce: true,
  });
}

/**
 * Hook for handling quick actions (favorites, playlist, etc.) with light haptic feedback
 */
export function useQuickActionPress() {
  return useHapticPress({
    hapticStyle: Haptics.ImpactFeedbackStyle.Light,
    debounceMs: 200,
    enableHaptic: true,
    enableDebounce: true,
  });
}

/**
 * Hook for handling modal/overlay interactions
 */
export function useModalPress() {
  return useHapticPress({
    hapticStyle: Haptics.ImpactFeedbackStyle.Light,
    debounceMs: 100,
    enableHaptic: true,
    enableDebounce: true,
  });
}
