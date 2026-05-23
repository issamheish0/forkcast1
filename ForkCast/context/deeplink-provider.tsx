import React, {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { router } from "expo-router";
import { useDeepLink, type DeepLinkState } from "@/hooks/useDeepLink";
import { generateDeepLink, generateUniversalLink } from "@/lib/deeplink";

interface DeepLinkContextType {
  // State
  state: DeepLinkState;
  isAuthenticated: boolean;

  // Actions
  handleDeepLink: (url: string) => Promise<boolean>;
  clearCache: () => void;

  // Utilities
  isUrlSupported: (url: string) => boolean;
  generateAppLink: (path: string) => string;
  generateWebLink: (path: string) => string;
  shareLink: (path: string, preferUniversal?: boolean) => string;
}

const DeepLinkContext = createContext<DeepLinkContextType | null>(null);

interface DeepLinkProviderProps {
  children: ReactNode;
  isSplashVisible?: boolean;
  onSplashDismissRequested?: () => void;
}

export function DeepLinkProvider({
  children,
  isSplashVisible = false,
  onSplashDismissRequested,
}: DeepLinkProviderProps) {
  // Memoize callbacks to prevent infinite re-renders
  const handleAuthRequired = useCallback((url: string) => {
    // Store the intended URL in a way that can be retrieved after sign-in
    // For now, just navigate to sign-in
    try {
      router.push("/sign-in");
    } catch (error) {
      console.warn("Failed to navigate to sign-in:", error);
    }
  }, []);

  const handleNavigationSuccess = useCallback((url: string, path: string) => {
    // Success callback - can be used for analytics or tracking
  }, []);

  const handleNavigationError = useCallback((url: string, error: Error) => {
    console.error("[DeepLinkProvider] Navigation error:", url, error);
    // During cold start, don't immediately show errors - they might resolve on retry
    if (!error.message?.includes("cold start")) {
      // Optionally show user-friendly error message for non-cold-start errors
      console.warn("Deep link navigation failed:", url);
    }
  }, []);

  const { state, isAuthenticated, handleDeepLink, clearCache, isUrlSupported } =
    useDeepLink({
      autoHandle: true,
      fallbackPath: "/(protected)/(tabs)", // Better fallback for authenticated users
      enableLogging: __DEV__,
      processDelay: 600, // Slightly increased delay for cold start stability
      isSplashVisible,
      onSplashDismissRequested,
      onAuthRequired: handleAuthRequired,
      onNavigationSuccess: handleNavigationSuccess,
      onNavigationError: handleNavigationError,
    });

  // Generate app-specific deep link (memoized to prevent re-renders)
  const generateAppLink = useCallback((path: string): string => {
    return generateDeepLink(path, "plate");
  }, []);

  // Generate universal web link (memoized to prevent re-renders)
  const generateWebLink = useCallback((path: string): string => {
    return generateUniversalLink(path, "plate-app.com");
  }, []);

  // Generate shareable link (memoized to prevent re-renders)
  const shareLink = useCallback(
    (path: string, preferUniversal: boolean = true): string => {
      if (preferUniversal) {
        return generateWebLink(path);
      }
      return generateAppLink(path);
    },
    [generateWebLink, generateAppLink],
  );

  // Memoize context value to prevent unnecessary re-renders
  const contextValue: DeepLinkContextType = useMemo(
    () => ({
      // State
      state,
      isAuthenticated,

      // Actions
      handleDeepLink,
      clearCache,

      // Utilities
      isUrlSupported,
      generateAppLink,
      generateWebLink,
      shareLink,
    }),
    [
      state,
      isAuthenticated,
      handleDeepLink,
      clearCache,
      isUrlSupported,
      generateAppLink,
      generateWebLink,
      shareLink,
    ],
  );

  return (
    <DeepLinkContext.Provider value={contextValue}>
      {children}
    </DeepLinkContext.Provider>
  );
}

export function useDeepLinkContext(): DeepLinkContextType {
  const context = useContext(DeepLinkContext);

  if (!context) {
    throw new Error(
      "useDeepLinkContext must be used within a DeepLinkProvider",
    );
  }

  return context;
}

// Convenience hook for generating links
export function useShareableLinks() {
  const { generateAppLink, generateWebLink, shareLink } = useDeepLinkContext();

  return {
    // ==================== RESTAURANT LINKS ====================
    getRestaurantLink: (restaurantId: string, preferUniversal?: boolean) =>
      shareLink(`/restaurant/${restaurantId}`, preferUniversal),

    getRestaurantMenuLink: (restaurantId: string, preferUniversal?: boolean) =>
      shareLink(`/restaurant/${restaurantId}/menu`, preferUniversal),

    getRestaurantReviewsLink: (
      restaurantId: string,
      preferUniversal?: boolean,
    ) => shareLink(`/restaurant/${restaurantId}/reviews`, preferUniversal),

    // ==================== BOOKING LINKS ====================
    getBookingLink: (bookingId: string, preferUniversal?: boolean) =>
      shareLink(`/booking/${bookingId}`, preferUniversal),

    getBookingCreateLink: (preferUniversal?: boolean) =>
      shareLink(`/booking/create`, preferUniversal),

    getBookingAvailabilityLink: (preferUniversal?: boolean) =>
      shareLink(`/booking/availability`, preferUniversal),

    getBookingSuccessLink: (preferUniversal?: boolean) =>
      shareLink(`/booking/success`, preferUniversal),

    // ==================== PLAYLIST LINKS ====================
    getPlaylistLink: (playlistId: string, preferUniversal?: boolean) =>
      shareLink(`/playlist/${playlistId}`, preferUniversal),

    getPlaylistCollaboratorsLink: (
      playlistId: string,
      preferUniversal?: boolean,
    ) => shareLink(`/playlist/${playlistId}/collaborators`, preferUniversal),

    getPlaylistJoinLink: (preferUniversal?: boolean) =>
      shareLink(`/playlist/join`, preferUniversal),

    getPlaylistAddRestaurantsLink: (preferUniversal?: boolean) =>
      shareLink(`/playlist/add-restaurants`, preferUniversal),

    getPlaylistInvitationsLink: (preferUniversal?: boolean) =>
      shareLink(`/playlist/invitations`, preferUniversal),

    // ==================== SOCIAL LINKS ====================
    getSocialHomeLink: (preferUniversal?: boolean) =>
      shareLink(`/social`, preferUniversal),

    getSocialFeedLink: (preferUniversal?: boolean) =>
      shareLink(`/social/feed`, preferUniversal),

    getSocialPostLink: (postId: string, preferUniversal?: boolean) =>
      shareLink(`/social/post/${postId}`, preferUniversal),

    getSocialCreatePostLink: (preferUniversal?: boolean) =>
      shareLink(`/social/create-post`, preferUniversal),

    getSocialMyPostsLink: (preferUniversal?: boolean) =>
      shareLink(`/social/my-posts`, preferUniversal),

    getUserProfileLink: (userId: string, preferUniversal?: boolean) =>
      shareLink(`/social/profile/${userId}`, preferUniversal),

    // ==================== PROFILE LINKS ====================
    getProfileLink: (preferUniversal?: boolean) =>
      shareLink(`/profile`, preferUniversal),

    getProfileEditLink: (preferUniversal?: boolean) =>
      shareLink(`/profile/edit`, preferUniversal),

    getProfileLoyaltyLink: (preferUniversal?: boolean) =>
      shareLink(`/profile/loyalty`, preferUniversal),

    getProfileRewardsLink: (preferUniversal?: boolean) =>
      shareLink(`/profile/my-rewards`, preferUniversal),

    getProfileNotificationsLink: (preferUniversal?: boolean) =>
      shareLink(`/profile/notifications`, preferUniversal),

    getProfileAppearanceLink: (preferUniversal?: boolean) =>
      shareLink(`/profile/appearance`, preferUniversal),

    getProfilePreferencesLink: (preferUniversal?: boolean) =>
      shareLink(`/profile/preferences`, preferUniversal),

    getProfilePrivacyLink: (preferUniversal?: boolean) =>
      shareLink(`/profile/privacy`, preferUniversal),

    getProfileHelpLink: (preferUniversal?: boolean) =>
      shareLink(`/profile/help`, preferUniversal),

    getProfileInsightsLink: (preferUniversal?: boolean) =>
      shareLink(`/profile/insights`, preferUniversal),

    getProfileBlockedUsersLink: (preferUniversal?: boolean) =>
      shareLink(`/profile/blocked-users`, preferUniversal),

    getProfileRatingDetailsLink: (preferUniversal?: boolean) =>
      shareLink(`/profile/rating-details`, preferUniversal),

    getProfileReviewsLink: (preferUniversal?: boolean) =>
      shareLink(`/profile/reviews`, preferUniversal),

    getProfilePostsLink: (preferUniversal?: boolean) =>
      shareLink(`/profile/posts`, preferUniversal),

    // ==================== SEARCH & DISCOVERY LINKS ====================
    getSearchLink: (preferUniversal?: boolean) =>
      shareLink(`/search`, preferUniversal),

    getCuisineLink: (cuisineId: string, preferUniversal?: boolean) =>
      shareLink(`/cuisine/${cuisineId}`, preferUniversal),

    // ==================== WAITLIST LINKS ====================
    getWaitlistLink: (preferUniversal?: boolean) =>
      shareLink(`/waitlist`, preferUniversal),

    getWaitingListLink: (preferUniversal?: boolean) =>
      shareLink(`/waiting-list`, preferUniversal),

    getMyWaitlistsLink: (preferUniversal?: boolean) =>
      shareLink(`/my-waitlists`, preferUniversal),

    // ==================== MAIN TABS LINKS ====================
    getHomeLink: (preferUniversal?: boolean) =>
      shareLink(`/home`, preferUniversal),

    getFavoritesLink: (preferUniversal?: boolean) =>
      shareLink(`/favorites`, preferUniversal),

    getBookingsLink: (preferUniversal?: boolean) =>
      shareLink(`/bookings`, preferUniversal),

    // ==================== FRIENDS LINKS ====================
    getFriendsLink: (preferUniversal?: boolean) =>
      shareLink(`/friends`, preferUniversal),

    getFriendProfileLink: (friendId: string, preferUniversal?: boolean) =>
      shareLink(`/friends/${friendId}`, preferUniversal),

    getInvitationsLink: (preferUniversal?: boolean) =>
      shareLink(`/invitations`, preferUniversal),

    // ==================== OFFERS LINKS ====================
    getOffersLink: (preferUniversal?: boolean) =>
      shareLink(`/offers`, preferUniversal),

    // ==================== REVIEW LINKS ====================
    getCreateReviewLink: (preferUniversal?: boolean) =>
      shareLink(`/review/create`, preferUniversal),

    // ==================== LEGAL LINKS ====================
    getLegalHomeLink: (preferUniversal?: boolean) =>
      shareLink(`/legal`, preferUniversal),

    getLegalDocumentLink: (documentType: string, preferUniversal?: boolean) =>
      shareLink(`/legal/${documentType}`, preferUniversal),

    getHelpLink: (preferUniversal?: boolean) =>
      shareLink(`/help`, preferUniversal),

    // ==================== UTILITY LINKS ====================
    getLocationSelectorLink: (preferUniversal?: boolean) =>
      shareLink(`/location-selector`, preferUniversal),

    // ==================== AUTH LINKS ====================
    getSignInLink: (preferUniversal?: boolean) =>
      shareLink(`/sign-in`, preferUniversal),

    getSignUpLink: (preferUniversal?: boolean) =>
      shareLink(`/sign-up`, preferUniversal),

    getWelcomeLink: (preferUniversal?: boolean) =>
      shareLink(`/welcome`, preferUniversal),

    getOnboardingLink: (preferUniversal?: boolean) =>
      shareLink(`/onboarding`, preferUniversal),

    getPasswordResetLink: (preferUniversal?: boolean) =>
      shareLink(`/password-reset`, preferUniversal),

    // ==================== GENERIC LINK GENERATION ====================
    generateAppLink,
    generateWebLink,
    shareLink,
  };
}
