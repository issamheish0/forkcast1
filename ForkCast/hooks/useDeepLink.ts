import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { AppState, AppStateStatus } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import {
  parseDeepLinkUrl,
  navigateToDeepLink,
  isSupportedDeepLink,
  DEEP_LINK_ROUTES,
  type DeepLinkRoute,
} from "@/lib/deeplink";
import {
  markDeepLinkAttempt,
  markDeepLinkFailure,
  markDeepLinkIdle,
  markDeepLinkInitialUrl,
  markDeepLinkSuccess,
  resetDeepLinkStatus,
} from "@/lib/deepLinkStatus";
import { useAuth } from "@/context/supabase-provider";

export interface DeepLinkState {
  initialUrl: string | null;
  lastProcessedUrl: string | null;
  isProcessing: boolean;
  error: string | null;
}

export interface DeepLinkHookOptions {
  // Whether to handle deep links automatically
  autoHandle?: boolean;

  // Fallback path when navigation fails
  fallbackPath?: string;

  // Custom handler for protected routes when user is not authenticated
  onAuthRequired?: (url: string) => void;

  // Custom handler for successful navigation
  onNavigationSuccess?: (url: string, path: string) => void;

  // Custom handler for navigation errors
  onNavigationError?: (url: string, error: Error) => void;

  // Delay before processing deep links (to allow auth to initialize)
  processDelay?: number;

  // Whether to log deep link activities for debugging
  enableLogging?: boolean;

  // Whether splash screen is currently showing (prevents navigation during splash)
  isSplashVisible?: boolean;

  // Callback when deep link should dismiss splash screen early
  onSplashDismissRequested?: () => void;
}

const DEFAULT_OPTIONS: Required<DeepLinkHookOptions> = {
  autoHandle: true,
  fallbackPath: "/",
  onAuthRequired: () => {},
  onNavigationSuccess: () => {},
  onNavigationError: () => {},
  processDelay: 1500, // Increased for cold start stability
  enableLogging: __DEV__,
  isSplashVisible: false,
  onSplashDismissRequested: () => {},
};

export function useDeepLink(options: DeepLinkHookOptions = {}) {
  // Memoize finalOptions to prevent recreating on every render (prevents infinite loops)
  const finalOptions = useMemo(
    () => ({ ...DEFAULT_OPTIONS, ...options }),
    [
      options.autoHandle,
      options.fallbackPath,
      options.processDelay,
      options.enableLogging,
      options.isSplashVisible,
      options.onSplashDismissRequested,
      options.onAuthRequired,
      options.onNavigationSuccess,
      options.onNavigationError,
    ],
  );
  const { session, isGuest, initialized: authInitialized } = useAuth();

  const [state, setState] = useState<DeepLinkState>({
    initialUrl: null,
    lastProcessedUrl: null,
    isProcessing: false,
    error: null,
  });

  const [isMounted, setIsMounted] = useState(false);
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const processedUrls = useRef<Set<string>>(new Set());
  const processingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeepLink = useRef<string | null>(null);
  const hasCheckedInitialUrl = useRef<boolean>(false); // Prevent multiple initial URL checks
  const isAuthenticated = Boolean(session) || isGuest;

  // Use refs for options to prevent callbacks from changing and triggering infinite loops
  const enableLoggingRef = useRef(finalOptions.enableLogging);
  const finalOptionsRef = useRef(finalOptions);

  // Update refs when options change (but don't trigger re-renders)
  enableLoggingRef.current = finalOptions.enableLogging;
  finalOptionsRef.current = finalOptions;

  const log = useCallback((message: string, ...args: any[]) => {
    if (enableLoggingRef.current) {
    }
  }, []); // Stable function - never recreates

  // Check if URL should be ignored (development URLs, etc.)
  const shouldIgnoreUrl = useCallback((url: string): boolean => {
    // Ignore Expo development URLs
    if (url.startsWith("exp://")) return true;
    if (url.startsWith("exps://")) return true;

    // Ignore Metro bundler URLs
    if (url.includes(":8081")) return true;
    if (url.includes("localhost")) return true;
    if (url.includes("127.0.0.1")) return true;

    // Ignore file URLs
    if (url.startsWith("file://")) return true;

    // Ignore empty or invalid URLs
    if (!url || url.length < 5) return true;

    return false;
  }, []);

  // Process a deep link URL
  const processDeepLink = useCallback(
    async (url: string): Promise<boolean> => {
      // First check: ignore development/invalid URLs immediately
      if (shouldIgnoreUrl(url)) {
        log("Ignoring development/invalid URL:", url);
        markDeepLinkIdle();
        return false;
      }

      if (!url || processedUrls.current.has(url)) {
        log("Skipping already processed URL:", url);
        markDeepLinkIdle();
        return false;
      }

      if (!isMounted || !isNavigationReady) {
        log("Navigation not ready, delaying deep link processing:", url, {
          isMounted,
          isNavigationReady,
        });
        markDeepLinkIdle();
        return false;
      }

      if (!authInitialized) {
        log("Auth not initialized, delaying deep link processing:", url);
        markDeepLinkIdle();
        return false;
      }

      // Don't wait for database here - navigate immediately and let components handle data fetching
      // This prevents redirect to homepage while waiting for database
      // Components (like useRestaurant) will wait for databaseReady before fetching data

      // If splash screen is visible, dismiss it and let normal processing continue
      if (finalOptionsRef.current.isSplashVisible) {
        log(
          "Splash visible, dismissing and continuing with normal deep link processing",
        );
        finalOptionsRef.current.onSplashDismissRequested();
        // Don't return false - continue with normal processing below
        // This prevents the NUCLEAR OPTION double navigation issue
      }

      markDeepLinkAttempt(url);

      log("Processing deep link:", url);

      setState((prev) => ({
        ...prev,
        isProcessing: true,
        error: null,
        lastProcessedUrl: url,
      }));

      try {
        const { route, path } = parseDeepLinkUrl(url);

        if (!route) {
          log("Unsupported deep link, storing for potential retry:", url);
          markDeepLinkFailure(url, "Unsupported deeplink");

          // During cold start, don't immediately fallback - store the URL for potential retry
          // Only fallback if this is not during initial app load
          if (state.initialUrl === null) {
            log(
              "Cold start detected - storing unsupported URL for retry:",
              url,
            );
            setState((prev) => ({
              ...prev,
              isProcessing: false,
              initialUrl: url,
              error: "Unsupported deeplink during cold start - will retry",
            }));
            return false;
          }

          setState((prev) => ({ ...prev, isProcessing: false }));
          return false;
        }

        // Check if route requires authentication
        if ((route as any)?.protected && !isAuthenticated) {
          log("Protected route requires authentication:", url, path);

          finalOptionsRef.current.onAuthRequired(url);

          // Store the URL for later processing after auth
          setState((prev) => ({
            ...prev,
            isProcessing: false,
            initialUrl: url,
          }));

          return false;
        }

        // Navigate to the deep link
        // Track if this is a cold start (initial URL) to prevent premature fallback
        const isColdStart =
          state.initialUrl === url && !processedUrls.current.has(url);
        const success = navigateToDeepLink(url, {
          isAuthenticated,
          canNavigate: isMounted && isNavigationReady,
          fallbackPath: finalOptionsRef.current.fallbackPath,
          onAuthRequired: () => finalOptionsRef.current.onAuthRequired(url),
          isColdStart, // Don't fallback to homepage during cold start navigation errors
        });

        if (success) {
          processedUrls.current.add(url);
          finalOptionsRef.current.onNavigationSuccess(url, path as string);
          markDeepLinkSuccess(url, path);
          log("Deep link navigation successful:", url, "→", path);
        } else {
          markDeepLinkFailure(url, "Navigation failed");
          throw new Error("Navigation failed");
        }

        setState((prev) => ({ ...prev, isProcessing: false }));
        return success;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        log("Deep link processing failed:", url, errorMessage);
        markDeepLinkFailure(url, errorMessage);

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: errorMessage,
        }));

        finalOptionsRef.current.onNavigationError(
          url,
          error instanceof Error ? error : new Error(errorMessage),
        );
        return false;
      }
    },
    [
      shouldIgnoreUrl,
      isMounted,
      isNavigationReady,
      authInitialized,
      isAuthenticated,
      log,
      state.initialUrl,
    ],
  );

  // Handle app state changes (for when app is opened from background)
  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        log("App became active, checking for pending deep links");

        // Clear processing timeout and check for new URLs
        if (processingTimeout.current) {
          clearTimeout(processingTimeout.current);
          processingTimeout.current = null;
        }
      }
    },
    [log],
  );

  // Handle incoming URL while app is running
  const handleUrl = useCallback(
    ({ url }: { url: string }) => {
      log("Received URL while app is running:", url);

      // Immediately ignore development URLs
      if (shouldIgnoreUrl(url)) {
        log("Ignoring development URL in handleUrl:", url);
        return;
      }

      if (processingTimeout.current) {
        clearTimeout(processingTimeout.current);
      }

      processingTimeout.current = setTimeout(() => {
        processDeepLink(url);
      }, finalOptionsRef.current.processDelay);
    },
    [shouldIgnoreUrl, processDeepLink, log],
  );

  // Get initial URL when app starts (should only run once)
  const getInitialUrl = useCallback(async () => {
    // Prevent multiple calls to getInitialURL
    if (hasCheckedInitialUrl.current) {
      log("Initial URL already checked, skipping...");
      return;
    }

    try {
      const initialUrl = await Linking.getInitialURL();

      log("Initial URL detected:", initialUrl);

      // Mark as checked immediately to prevent duplicate calls
      hasCheckedInitialUrl.current = true;

      if (initialUrl) {
        markDeepLinkInitialUrl(initialUrl);
        // Immediately ignore development URLs
        if (shouldIgnoreUrl(initialUrl)) {
          log("Ignoring development URL in getInitialUrl:", initialUrl);
          return;
        }

        // Only update state if initialUrl is different to prevent re-renders
        setState((prev) => {
          if (prev.initialUrl === initialUrl) {
            return prev; // Don't update if same - prevents infinite loops
          }
          return { ...prev, initialUrl };
        });

        if (
          finalOptionsRef.current.autoHandle &&
          authInitialized &&
          isMounted &&
          isNavigationReady
        ) {
          processingTimeout.current = setTimeout(() => {
            processDeepLink(initialUrl);
          }, finalOptionsRef.current.processDelay);
        }
      }
    } catch (error) {
      log("Failed to get initial URL:", error);
      hasCheckedInitialUrl.current = true; // Mark as checked even on error
    }
    // processDeepLink is intentionally excluded to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authInitialized, isMounted, isNavigationReady, shouldIgnoreUrl, log]);

  // Process pending deep link after authentication
  useEffect(() => {
    if (
      authInitialized &&
      isAuthenticated &&
      isMounted &&
      isNavigationReady &&
      state.initialUrl &&
      !processedUrls.current.has(state.initialUrl)
    ) {
      // Double-check URL filtering before processing
      if (shouldIgnoreUrl(state.initialUrl)) {
        log("Ignoring development URL in auth effect:", state.initialUrl);
        return;
      }

      log("Auth completed, processing pending deep link:", state.initialUrl);
      processDeepLink(state.initialUrl);
    }
    // processDeepLink is intentionally excluded to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authInitialized,
    isAuthenticated,
    isMounted,
    isNavigationReady,
    state.initialUrl,
  ]);

  // Process pending deep link when splash screen is dismissed
  useEffect(() => {
    if (
      !finalOptionsRef.current.isSplashVisible &&
      pendingDeepLink.current &&
      authInitialized &&
      isMounted &&
      isNavigationReady &&
      !processedUrls.current.has(pendingDeepLink.current)
    ) {
      const url = pendingDeepLink.current;
      log("Splash screen dismissed, processing pending deep link:", url);

      // Clear the pending URL to prevent re-processing
      pendingDeepLink.current = null;

      // Process the deep link
      processDeepLink(url);
    }
    // processDeepLink is intentionally excluded to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    finalOptions.isSplashVisible, // Keep this to trigger effect when splash changes
    authInitialized,
    isMounted,
    isNavigationReady,
  ]);

  // Retry failed deeplinks during cold start after everything is ready
  useEffect(() => {
    if (
      authInitialized &&
      isMounted &&
      isNavigationReady &&
      !finalOptionsRef.current.isSplashVisible &&
      state.initialUrl &&
      state.error?.includes("cold start") &&
      !processedUrls.current.has(state.initialUrl)
    ) {
      const url = state.initialUrl;
      log("Retrying failed cold start deeplink:", url);

      // Add a small delay to ensure everything is fully ready
      setTimeout(() => {
        processDeepLink(url);
      }, 1000);
    }
    // processDeepLink is intentionally excluded to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authInitialized,
    isMounted,
    isNavigationReady,
    finalOptions.isSplashVisible, // Keep this to trigger effect when splash changes
    state.initialUrl,
    state.error,
  ]);

  // Set mounting state
  useEffect(() => {
    setIsMounted(true);

    // Give the navigation system time to initialize
    // Increased delay for cold start stability - ensures expo-router is fully ready
    const navigationTimer = setTimeout(() => {
      setIsNavigationReady(true);
    }, 1200); // Extended delay to ensure navigation is fully ready during cold start

    return () => {
      setIsMounted(false);
      setIsNavigationReady(false);
      clearTimeout(navigationTimer);
    };
  }, []);

  // Set up deep link listeners
  useEffect(() => {
    log("Setting up deep link listeners");

    // Get initial URL (protected by hasCheckedInitialUrl ref to run only once)
    getInitialUrl();

    // Listen for URL events
    const urlSubscription = Linking.addEventListener("url", handleUrl);

    // Listen for app state changes
    const appStateSubscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      log("Cleaning up deep link listeners");
      urlSubscription?.remove();
      appStateSubscription?.remove();

      if (processingTimeout.current) {
        clearTimeout(processingTimeout.current);
      }
    };
  }, [getInitialUrl, handleUrl, handleAppStateChange, log]);

  // Manual deep link processing
  const handleDeepLink = useCallback(
    async (url: string): Promise<boolean> => {
      return await processDeepLink(url);
    },
    [processDeepLink],
  );

  // Clear processed URLs cache
  const clearCache = useCallback(() => {
    processedUrls.current.clear();
    setState((prev) => ({
      ...prev,
      error: null,
      lastProcessedUrl: null,
    }));
    resetDeepLinkStatus();
    log("Deep link cache cleared");
  }, [log]);

  // Get available routes
  const getAvailableRoutes = useCallback((): DeepLinkRoute[] => {
    return DEEP_LINK_ROUTES;
  }, []);

  // Check if a URL is supported
  const isUrlSupported = useCallback((url: string): boolean => {
    return isSupportedDeepLink(url);
  }, []);

  return {
    // State
    state,
    isAuthenticated,

    // Actions
    handleDeepLink,
    clearCache,

    // Utilities
    getAvailableRoutes,
    isUrlSupported,
    parseUrl: parseDeepLinkUrl,
  };
}

export default useDeepLink;
