// hooks/useNetworkMonitor.ts
import { useEffect, useRef, useCallback, useState } from "react";
import { Alert, AppState, AppStateStatus } from "react-native";
import { useNetwork } from "@/context/network-provider";

// Types
export interface NetworkMonitorConfig {
  // Alert configuration
  showOfflineAlert?: boolean;
  showOnlineAlert?: boolean;
  showSlowConnectionAlert?: boolean;
  alertDelay?: number; // Delay before showing alerts (ms)

  // Callbacks
  onOffline?: () => void;
  onOnline?: () => void;
  onConnectionChange?: (quality: string) => void;

  // Monitoring options
  checkAppState?: boolean; // Monitor when app comes to foreground
}

// Default configuration
const DEFAULT_CONFIG: Required<NetworkMonitorConfig> = {
  showOfflineAlert: true,
  showOnlineAlert: true,
  showSlowConnectionAlert: true,
  alertDelay: 3000,
  onOffline: () => {},
  onOnline: () => {},
  onConnectionChange: () => {},
  checkAppState: true,
};

// Alert messages
const ALERT_MESSAGES = {
  offline: {
    title: "No Internet Connection",
    message: "You're currently offline. Some features may not be available.",
  },
  online: {
    title: "Connection Restored",
    message: "You're back online!",
  },
  slowConnection: {
    title: "Slow Connection",
    message: "Your connection is slow. Things may take longer to load.",
  },
};

// Hook implementation
export function useNetworkMonitor(config: NetworkMonitorConfig = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const {
    isOnline,
    networkState,
    addListener,
    refresh,
    isLoading,
    hasInitialized,
  } = useNetwork();

  // Refs to track state and timers
  const previousOnlineRef = useRef<boolean | null>(null);
  const previousQualityRef = useRef(networkState.quality);
  const alertTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [canShowAlerts, setCanShowAlerts] = useState(false);

  // Show alert with optional delay
  const showAlert = useCallback(
    (title: string, message: string, delay: number = 0) => {
      // Clear any pending alert
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
        alertTimerRef.current = null;
      }

      if (delay > 0) {
        alertTimerRef.current = setTimeout(() => {
          Alert.alert(title, message, [{ text: "OK" }]);
          alertTimerRef.current = null;
        }, delay) as any;
      } else {
        Alert.alert(title, message, [{ text: "OK" }]);
      }
    },
    [],
  );

  // Handle offline state
  const handleOffline = useCallback(() => {
    finalConfig.onOffline();

    if (finalConfig.showOfflineAlert && canShowAlerts) {
      showAlert(
        ALERT_MESSAGES.offline.title,
        ALERT_MESSAGES.offline.message,
        finalConfig.alertDelay,
      );
    }
  }, [finalConfig, showAlert, canShowAlerts]);

  // Handle online state
  const handleOnline = useCallback(() => {
    // Clear any pending offline alert
    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current);
      alertTimerRef.current = null;
    }

    finalConfig.onOnline();

    if (finalConfig.showOnlineAlert && canShowAlerts) {
      showAlert(
        ALERT_MESSAGES.online.title,
        ALERT_MESSAGES.online.message,
        0, // Show immediately
      );
    }
  }, [finalConfig, showAlert, canShowAlerts]);

  // Handle connection quality change
  const handleQualityChange = useCallback(
    (quality: string) => {
      finalConfig.onConnectionChange(quality);

      if (
        finalConfig.showSlowConnectionAlert &&
        canShowAlerts &&
        (quality === "poor" || quality === "fair") &&
        (previousQualityRef.current === "good" ||
          previousQualityRef.current === "excellent")
      ) {
        showAlert(
          ALERT_MESSAGES.slowConnection.title,
          ALERT_MESSAGES.slowConnection.message,
          0,
        );
      }
    },
    [finalConfig, showAlert, canShowAlerts],
  );

  // Enable alerts after initialization with delay
  useEffect(() => {
    if (hasInitialized && !isLoading) {
      // Wait a bit longer to ensure network state is stable
      const timer = setTimeout(() => {
        setCanShowAlerts(true);
        // Set the initial previous state after enabling alerts
        previousOnlineRef.current = isOnline;
      }, 2000); // 2 second delay after initialization

      return () => clearTimeout(timer);
    }
  }, [hasInitialized, isLoading, isOnline]);

  // Monitor network changes
  useEffect(() => {
    const cleanup = addListener((state) => {
      const currentlyOnline = state.isConnected && state.isInternetReachable;

      // Only process changes if we can show alerts and have a previous state
      if (canShowAlerts && previousOnlineRef.current !== null) {
        // Check for online/offline change
        if (previousOnlineRef.current !== currentlyOnline) {
          if (currentlyOnline) {
            handleOnline();
          } else {
            handleOffline();
          }
        }

        // Check for quality change
        if (previousQualityRef.current !== state.quality) {
          handleQualityChange(state.quality);
        }
      }

      // Update refs
      previousOnlineRef.current = currentlyOnline;
      previousQualityRef.current = state.quality;
    });

    return cleanup;
  }, [
    addListener,
    handleOnline,
    handleOffline,
    handleQualityChange,
    canShowAlerts,
  ]);

  // Monitor app state changes
  useEffect(() => {
    if (!finalConfig.checkAppState) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        // Refresh network state when app comes to foreground
        refresh();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, [finalConfig.checkAppState, refresh]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
      }
    };
  }, []);

  return {
    isOnline,
    isLoading,
    hasInitialized,
    networkState,
    connectionQuality: networkState.quality,
  };
}
