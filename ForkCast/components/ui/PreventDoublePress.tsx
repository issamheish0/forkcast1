// components/ui/PreventDoublePress.tsx
import React, { useRef, useCallback } from "react";
import { Pressable, PressableProps, GestureResponderEvent } from "react-native";

interface PreventDoublePressProps
  extends Omit<PressableProps, "children" | "onPress"> {
  /**
   * Debounce delay in milliseconds to prevent double-clicks
   * @default 300
   */
  debounceMs?: number;
  /**
   * Whether to enable double-click prevention
   * @default true
   */
  enableDebounce?: boolean;
  /**
   * Children function that receives the press handler
   */
  children: (props: { onPress: () => void }) => React.ReactNode;
  /**
   * Press handler
   */
  onPress?: (event: GestureResponderEvent) => void;
}

/**
 * Higher-order component that prevents double-clicks on any pressable element
 * Can be used to wrap any component that needs double-click prevention
 */
export function PreventDoublePress({
  debounceMs = 300,
  enableDebounce = true,
  children,
  onPress,
  ...pressableProps
}: PreventDoublePressProps) {
  const lastPressTime = useRef<number>(0);
  const isProcessing = useRef<boolean>(false);

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (!onPress) return;

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
        onPress(event);
      } catch (error) {
        console.error("Error in PreventDoublePress handler:", error);
      } finally {
        if (enableDebounce) {
          // Reset processing flag after a short delay
          setTimeout(() => {
            isProcessing.current = false;
          }, debounceMs);
        }
      }
    },
    [onPress, debounceMs, enableDebounce],
  );

  // Create a wrapper function that matches the expected signature
  const wrappedHandler = useCallback(() => {
    // Call handlePress with a dummy event when needed through children
    const mockEvent = {} as unknown as GestureResponderEvent;
    handlePress(mockEvent);
  }, [handlePress]);

  return (
    <Pressable {...pressableProps} onPress={handlePress}>
      {children({ onPress: wrappedHandler })}
    </Pressable>
  );
}

/**
 * Simple wrapper for buttons that need double-click prevention
 */
export function PreventDoublePressButton({
  children,
  onPress,
  debounceMs = 300,
  enableDebounce = true,
  ...props
}: Omit<PreventDoublePressProps, "children"> & {
  children: React.ReactNode;
}) {
  return (
    <PreventDoublePress
      onPress={onPress}
      debounceMs={debounceMs}
      enableDebounce={enableDebounce}
      {...props}
    >
      {() => children}
    </PreventDoublePress>
  );
}
