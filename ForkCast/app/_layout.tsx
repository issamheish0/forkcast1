import "@/utils/polyfills";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";
import { Stack, router, usePathname } from "expo-router";
import { AuthProvider, useAuth } from "@/context/supabase-provider";
import { NetworkProvider } from "@/context/network-provider";
import { ModalProvider } from "@/context/modal-provider";
import {
  DeepLinkProvider,
  useDeepLinkContext,
} from "@/context/deeplink-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { LogBox, View, AppState } from "react-native";
import React, { useEffect, useState, useRef } from "react";
import {
  ErrorBoundary,
  NavigationErrorBoundary,
} from "@/components/ErrorBoundary";
import { useNetworkMonitor } from "@/hooks/useNetworkMonitor";
import { getThemedColors } from "@/lib/utils";
import { useRestaurantStore } from "@/stores";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { initializeNotificationHandlers } from "@/lib/notifications/setup";
import AnimatedSplashScreen from "@/components/AnimatedSplashScreen";
import { useForceUpdate } from "@/hooks/useForceUpdate";
import { ForceUpdateModal } from "@/components/ui/force-update-modal";
import { usePostBookingReview } from "@/hooks/usePostBookingReview";
import { PostBookingReviewModal } from "@/components/booking/PostBookingReviewModal";

// Required at root level to close the Chrome Custom Tab on Android when the OAuth redirect arrives
WebBrowser.maybeCompleteAuthSession();

LogBox.ignoreAllLogs();

// Network status bar component
function NetworkStatusBar() {
  const { isOnline, connectionQuality, isLoading, hasInitialized } =
    useNetworkMonitor({
      showOfflineAlert: true,
      showOnlineAlert: false,
      alertDelay: 5000,
    });

  const [showBanner, setShowBanner] = useState(false);

  // Control banner visibility with proper initialization checks
  useEffect(() => {
    if (isLoading || !hasInitialized) {
      setShowBanner(false);
      return;
    }

    const timer = setTimeout(() => {
      const shouldShow = !isOnline || connectionQuality === "poor";
      setShowBanner(shouldShow);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isOnline, connectionQuality, isLoading, hasInitialized]);

  if (!showBanner) {
    return null;
  }

  const backgroundColor = !isOnline ? "#F44336" : "#FF9800";

  return (
    <View
      style={{
        backgroundColor,
        paddingVertical: 8,
        paddingHorizontal: 16,
      }}
      className="bg-warning"
    ></View>
  );
}

function RootLayoutWithSplashState() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashDismissRequested, setSplashDismissRequested] = useState(false);

  // EMERGENCY SPLASH DISMISSAL: Force hide splash after navigation is ready
  useEffect(() => {
    const emergencyTimer = setTimeout(() => {
      setShowSplash(false);
    }, 3500); // 3.5 seconds - increased to allow animations to complete

    return () => clearTimeout(emergencyTimer);
  }, []);

  // Handle early splash dismissal for deep links
  const handleSplashDismissRequest = () => {
    setSplashDismissRequested(true);
  };

  // Dismiss splash immediately if requested by deep link
  useEffect(() => {
    if (splashDismissRequested && showSplash) {
      setShowSplash(false);
    }
  }, [splashDismissRequested, showSplash]);

  return (
    <DeepLinkProvider
      isSplashVisible={showSplash}
      onSplashDismissRequested={handleSplashDismissRequest}
    >
      <ModalProvider>
        <NavigationErrorBoundary>
          <RootLayoutContent
            showSplash={showSplash}
            setShowSplash={setShowSplash}
          />
        </NavigationErrorBoundary>
      </ModalProvider>
    </DeepLinkProvider>
  );
}

function RootLayoutContent({
  showSplash,
  setShowSplash,
}: {
  showSplash: boolean;
  setShowSplash: (show: boolean) => void;
}) {
  const { colorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);
  const { profile, session } = useAuth();
  const pathname = usePathname();
  const hasRedirectedToOnboarding = useRef(false);

  // Get deep link context to check if we're processing a deep link
  const { state: deepLinkState } = useDeepLinkContext();
  const isProcessingDeepLink = useRef(false);
  const hasInitialDeepLink = useRef(false);

  // OPTIMIZATION: Clear expired cache periodically
  const { clearExpiredCache } = useRestaurantStore();

  useEffect(() => {
    // Clear expired cache on mount
    clearExpiredCache();

    // Set up periodic cache cleanup (every 5 minutes)
    const cacheCleanupInterval = setInterval(
      () => {
        clearExpiredCache();
      },
      5 * 60 * 1000,
    ); // 5 minutes

    // Set up AppState listener to clear cache when app comes to foreground
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        clearExpiredCache();
      }
    });

    return () => {
      clearInterval(cacheCleanupInterval);
      subscription.remove();
    };
  }, [clearExpiredCache]);

  // Track if we have an initial deep link that hasn't been processed yet
  useEffect(() => {
    if (deepLinkState.initialUrl && !hasInitialDeepLink.current) {
      hasInitialDeepLink.current = true;
      isProcessingDeepLink.current = true;
    }

    // Clear the processing flag once the deep link is processed
    if (deepLinkState.lastProcessedUrl && isProcessingDeepLink.current) {
      // Add a delay to ensure navigation completes
      setTimeout(() => {
        isProcessingDeepLink.current = false;
      }, 1000);
    }
  }, [deepLinkState.initialUrl, deepLinkState.lastProcessedUrl]);

  // Force update check
  const {
    needsHardUpdate,
    needsSoftUpdate,
    currentVersion,
    minimumVersion,
    suggestedVersion,
    updateMode,
    isLoading: isCheckingVersion,
  } = useForceUpdate();

  // Post-booking review prompt
  const {
    eligibleBooking,
    isVisible: isReviewPromptVisible,
    handleWriteReview,
    handleSkip,
  } = usePostBookingReview(profile?.id, !!profile);

  // Sync authenticated user with OneSignal — skipped in Expo Go (native module unavailable)
  useEffect(() => {
    // no-op for Expo Go demo
  }, [
    profile?.id,
    profile?.first_name,
    profile?.membership_tier,
    profile?.completed_bookings,
    profile?.onboarded,
    session?.user?.email,
  ]);

  // Debug log for force update state
  useEffect(() => {}, [
    isCheckingVersion,
    needsHardUpdate,
    needsSoftUpdate,
    updateMode,
  ]);

  // Helper to check if profile is complete (has all required fields)
  const isProfileComplete = (p: typeof profile): boolean => {
    if (!p) return false;
    const firstName = p.first_name;
    const lastName = p.last_name;
    const phoneNumber = p.phone_number;
    const dateOfBirth = p.date_of_birth;

    const hasFirstName = firstName?.trim() && firstName.trim() !== "User";
    const hasLastName = lastName?.trim();
    const hasPhone = phoneNumber?.trim();
    const hasDOB = !!dateOfBirth;

    return !!(hasFirstName && hasLastName && hasPhone && hasDOB);
  };

  // FIXED: Prevent onboarding redirect when deep linking OR when profile is incomplete
  // Profile completion takes priority over onboarding - handled by protected layout
  useEffect(() => {
    // Don't redirect if:
    // 1. We're processing a deep link
    // 2. We already redirected
    // 3. User is already onboarded
    // 4. No profile yet
    // 5. Profile is incomplete (let complete-profile handle it first)

    if (!profile) {
      return;
    }

    if (profile.onboarded !== false) {
      return;
    }

    // CRITICAL: Don't redirect to onboarding if profile is incomplete
    // The complete-profile page should be shown first
    if (!isProfileComplete(profile)) {
      return;
    }

    // CRITICAL: Don't redirect while user is on complete-profile (e.g. on the phone verify step).
    // Let complete-profile navigate to onboarding after they verify.
    if (pathname?.includes("complete-profile")) {
      return;
    }

    if (hasRedirectedToOnboarding.current) {
      return;
    }

    // CRITICAL: Don't redirect if we have a deep link
    if (
      isProcessingDeepLink.current ||
      hasInitialDeepLink.current ||
      deepLinkState.initialUrl
    ) {
      return;
    }

    // Add a delay to ensure deep links have a chance to be detected
    const redirectTimer = setTimeout(() => {
      // Double-check we still don't have a deep link
      if (
        isProcessingDeepLink.current ||
        deepLinkState.initialUrl ||
        deepLinkState.isProcessing
      ) {
        return;
      }

      // Double-check profile is still complete
      if (!isProfileComplete(profile)) {
        return;
      }

      // Still on complete-profile (e.g. verify step) - don't replace with onboarding
      if (pathname?.includes("complete-profile")) {
        return;
      }

      hasRedirectedToOnboarding.current = true;
      try {
        router.replace("/onboarding");
      } catch (e) {
        // ignore navigation errors during startup race conditions
        console.warn("[RootLayout] Onboarding redirect failed:", e);
      }
    }, 800); // Wait 800ms to allow deep link detection

    return () => clearTimeout(redirectTimer);
  }, [
    pathname,
    profile?.onboarded,
    profile?.first_name,
    profile?.last_name,
    profile?.phone_number,
    profile?.date_of_birth,
    deepLinkState.initialUrl,
    deepLinkState.isProcessing,
  ]);

  useEffect(() => {
    try {
      initializeNotificationHandlers((deeplink: any) => {
      try {
        if (typeof deeplink !== "string" || deeplink.length === 0) {
          return;
        }

        let processedUrl: string = deeplink;

        if (deeplink.startsWith("app://")) {
          processedUrl = deeplink.replace("app://", "plate://");
        } else if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(deeplink)) {
          processedUrl = deeplink;
        } else if (deeplink.startsWith("/")) {
          processedUrl = `plate://${deeplink.substring(1)}`;
        } else {
          processedUrl = `plate://${deeplink}`;
        }

        Linking.openURL(processedUrl).catch(() => {});
      } catch (e) {
        console.warn("Failed to process notification deep link:", e);
      }
    });
    } catch {
      // OneSignal not available in Expo Go
    }
  }, []);

  // Hide warnings in development
  useEffect(() => {
    LogBox.ignoreLogs([
      "Clerk:",
      "Clerk has been loaded with development keys",
      "Unsupported Server Component type",
      "Warning: TNodeChildrenRenderer",
      'You seem to update props of the "TRenderEngineProvider" component',
      "Text strings must be rendered within a <Text> component",
      "VirtualizedLists should never be nested inside plain ScrollViews",
      // Suppress RN shadow calculation advice warnings that are noisy in development
      "View .* of type RCTView has a shadow set but cannot calculate shadow efficiently",
    ]);
  }, []);

  return (
    <>
      {showSplash && (
        <AnimatedSplashScreen
          onAnimationComplete={() => setShowSplash(false)}
        />
      )}
      {/* Force Update Modal - Shows when user's app version is outdated */}
      <ForceUpdateModal
        visible={!isCheckingVersion && (needsHardUpdate || needsSoftUpdate)}
        mode={updateMode}
        currentVersion={currentVersion}
        targetVersion={
          updateMode === "hard" ? minimumVersion : suggestedVersion
        }
      />
      {/* Post-Booking Review Prompt - Shows after completed bookings */}
      <PostBookingReviewModal
        visible={isReviewPromptVisible}
        booking={eligibleBooking}
        onWriteReview={handleWriteReview}
        onSkip={handleSkip}
      />
      <NetworkStatusBar />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: themedColors.background,
          },
        }}
      >
        {/* Disable gestures for the entire protected group to block back-swipe from home */}
        <Stack.Screen name="(protected)" options={{ gestureEnabled: false }} />
        {/* Welcome and onboarding use pop animation for replace to avoid double slide effect */}
        <Stack.Screen
          name="welcome"
          options={{ gestureEnabled: false, animationTypeForReplace: "pop" }}
        />
        <Stack.Screen
          name="onboarding"
          options={{ gestureEnabled: false, animationTypeForReplace: "pop" }}
        />
        {/* Disable back-swipe on auth entry points to prevent navigating back to welcome */}
        <Stack.Screen name="sign-in" options={{ gestureEnabled: false }} />
        <Stack.Screen name="sign-up" options={{ gestureEnabled: false }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen
          name="auth/google/callback"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="oauth-callback" options={{ headerShown: false }} />
        <Stack.Screen
          name="legal/[documentType]"
          options={{ headerShown: false }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary showDetails={__DEV__}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NetworkProvider>
          <AuthProvider>
            <RootLayoutWithSplashState />
          </AuthProvider>
        </NetworkProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
