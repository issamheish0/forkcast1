// utils/guestUtils.tsx
import React from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/supabase-provider";

/**
 * Simple utility to check if an action should be blocked for guests
 * Shows a native alert instead of modal for quick interactions
 */
export function checkGuestAccess(
  isGuest: boolean,
  featureName: string,
  onSignUp: () => void | Promise<void>, // Allow async
): boolean {
  if (isGuest) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    Alert.alert(
      "Sign Up Required",
      `Create a free account to ${featureName}.`,
      [
        {
          text: "Not Now",
          style: "cancel",
        },
        {
          text: "Sign Up",
          onPress: () => {
            void onSignUp(); // Handle promise
          },
          style: "default",
        },
      ],
    );

    return false; // Action blocked
  }

  return true; // Action allowed
}

/**
 * HOC to wrap components that should be completely hidden from guests
 */
export function withAuthOnly<P extends object>(
  Component: React.ComponentType<P>,
): typeof Component {
  const WithAuthOnlyComponent = (props: P) => {
    const { isGuest } = useAuth();

    if (isGuest) {
      return null;
    }

    return <Component {...props} />;
  };

  WithAuthOnlyComponent.displayName = `withAuthOnly(${Component.displayName || Component.name || "Component"})`;

  return WithAuthOnlyComponent;
}

/**
 * Conditional rendering helper for guest-specific content
 */
export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isGuest } = useAuth();
  return isGuest ? <>{children}</> : null;
}

export function AuthOnly({ children }: { children: React.ReactNode }) {
  const { isGuest } = useAuth();
  return !isGuest ? <>{children}</> : null;
}

// Don't forget to import useAuth at the top of the file:
// import { useAuth } from "@/context/supabase-provider";
