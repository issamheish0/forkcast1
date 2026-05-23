// Airbridge Events Type Definitions for Attribution and Analytics Tracking
// Separate from Meta tracking for easy removal/replacement

/**
 * Base Airbridge event properties interface
 */
export interface AirbridgeEventProperties {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Booking event data for Airbridge tracking
 */
export interface AirbridgeBookingData {
  bookingId?: string;
  restaurantId: string;
  restaurantName: string;
  bookingDate: string;
  bookingTime?: string;
  partySize: number;
  tableType?: string;
  isFirstBooking?: boolean;
  currency?: string;
  value?: number;
  source?: string;
}

/**
 * Search event data for Airbridge tracking
 */
export interface AirbridgeSearchData {
  query: string;
  resultCount: number;
  filters?: {
    cuisine?: string;
    location?: string;
    date?: string;
    partySize?: number;
    tableType?: string;
  };
}

/**
 * Restaurant view event data for Airbridge tracking
 */
export interface AirbridgeRestaurantData {
  restaurantId: string;
  restaurantName: string;
  cuisine?: string;
  tier?: string;
  source?: string;
}

/**
 * Loyalty points event data for Airbridge tracking
 */
export interface AirbridgeLoyaltyData {
  restaurantId: string;
  restaurantName: string;
  pointsEarned: number;
  totalPoints: number;
  activityType: string;
  tier?: string;
}

/**
 * Review submission event data for Airbridge tracking
 */
export interface AirbridgeReviewData {
  restaurantId: string;
  restaurantName: string;
  bookingId: string;
  rating: number;
  hasComment: boolean;
  hasPhotos: boolean;
}

/**
 * Waitlist event data for Airbridge tracking
 */
export interface AirbridgeWaitlistData {
  restaurantId: string;
  restaurantName: string;
  desiredDate: string;
  desiredTimeRange?: string;
  partySize: number;
  tableType?: string;
}

/**
 * Favorite event data for Airbridge tracking
 */
export interface AirbridgeFavoriteData {
  restaurantId: string;
  restaurantName: string;
}

/**
 * Funnel-stage event data. Lets us measure where users drop off in the
 * booking / waitlist creation flow without having to glue together heavy
 * client metrics. The string union is intentionally narrow so analytics
 * dashboards can group by step without freeform-string sprawl.
 */
export type BookingFunnelStep =
  /** Form passed validation; confirmation modal opened. */
  | "confirmation_opened"
  /** User pressed Confirm in the modal; submission about to start. */
  | "confirmed"
  /** Network call (RPC or insert) is in flight. */
  | "submit_started"
  /** Booking created server-side. */
  | "success"
  /** Submission failed (network, capacity, validation, etc.). */
  | "failed"
  /** User abandoned the modal without confirming (best-effort). */
  | "abandoned";

export interface BookingFunnelStepData {
  restaurantId: string;
  partySize: number;
  /** "instant" | "request" | "deposit" | "guarantee" — narrow enough to chart. */
  bookingType?: string;
  /** Failure reason (mapped error code, e.g. "capacity_exceeded"). */
  reason?: string;
  /** Milliseconds since `confirmation_opened` for this attempt. */
  durationMs?: number;
}

export type WaitlistFunnelStep =
  | "submit_started"
  | "duplicate_blocked"
  | "restaurant_inactive"
  | "success"
  | "failed";

export interface WaitlistFunnelStepData {
  restaurantId: string;
  partySize: number;
  reason?: string;
}

/**
 * User registration/sign-in event data for Airbridge tracking
 */
export interface AirbridgeUserData {
  userId?: string;
  method: "email" | "google" | "apple" | "guest";
  isNewUser?: boolean;
  hasProfileData?: boolean;
}

/**
 * Airbridge standard event categories
 * Using Airbridge's standard categories where applicable for better dashboard integration
 * Custom events prefixed with 'plate.' for clear identification
 */
export const AIRBRIDGE_EVENTS = {
  // Airbridge Standard User Events (these show up in standard reports)
  SIGN_UP: "airbridge.user.sign_up",
  SIGN_IN: "airbridge.user.sign_in",
  SIGN_OUT: "airbridge.user.sign_out",

  // Airbridge Standard E-commerce Events (mapped to booking flow)
  ORDER_COMPLETED: "airbridge.ecommerce.order.completed", // For booking created
  ORDER_CANCELLED: "airbridge.ecommerce.order.cancelled", // For booking cancelled
  PRODUCT_VIEWED: "airbridge.ecommerce.product.viewed", // For restaurant viewed
  SEARCH_RESULT_VIEWED: "airbridge.ecommerce.searchResults.viewed", // For search
  HOME_VIEWED: "airbridge.ecommerce.home.viewed", // For app open
  ADD_TO_WISHLIST: "airbridge.ecommerce.product.addedToWishlist", // For favorites

  // Custom ForkCast-specific events (for unique features)
  BOOKING_CREATED: "plate.booking.created",
  BOOKING_CANCELLED: "plate.booking.cancelled",
  FIRST_BOOKING: "plate.booking.first",
  SEARCH_PERFORMED: "plate.search.performed",
  RESTAURANT_VIEWED: "plate.restaurant.viewed",
  FAVORITE_ADDED: "plate.favorite.added",
  FAVORITE_REMOVED: "plate.favorite.removed",
  WAITLIST_JOINED: "plate.waitlist.joined",
  WAITLIST_REMOVED: "plate.waitlist.removed",
  REVIEW_SUBMITTED: "plate.review.submitted",
  LOYALTY_POINTS_EARNED: "plate.loyalty.points_earned",
  PROFILE_UPDATED: "plate.profile.updated",
  OFFER_VIEWED: "plate.offer.viewed",
  OFFER_CLAIMED: "plate.offer.claimed",
  APP_OPEN: "plate.app.opened",

  // Funnel-stage events. Emit one per stage so we can compute drop-off
  // (started → confirmed → submitted → success/failed) per restaurant.
  BOOKING_FUNNEL_STEP: "plate.booking.funnel_step",
  WAITLIST_FUNNEL_STEP: "plate.waitlist.funnel_step",
} as const;

/**
 * Airbridge tracking service interface
 */
export interface AirbridgeTrackingServiceInterface {
  // Initialization
  initialize(onDeferredDeepLink?: (url: string) => void): Promise<void>;

  // User management
  setUserId(userId: string): void;
  clearUserId(): void;

  // Core tracking methods
  trackAppOpen(): void;
  trackSignUp(data: AirbridgeUserData): void;
  trackSignIn(data: AirbridgeUserData): void;
  trackSignOut(): void;

  // Booking events
  trackBookingCreated(data: AirbridgeBookingData): void;
  trackBookingCancelled(data: AirbridgeBookingData): void;
  trackFirstBooking(data: AirbridgeBookingData): void;
  trackBookingFunnelStep(
    step: BookingFunnelStep,
    data: BookingFunnelStepData,
  ): void;
  trackWaitlistFunnelStep(
    step: WaitlistFunnelStep,
    data: WaitlistFunnelStepData,
  ): void;

  // Engagement events
  trackSearchPerformed(data: AirbridgeSearchData): void;
  trackRestaurantViewed(data: AirbridgeRestaurantData): void;
  trackFavoriteAdded(data: AirbridgeFavoriteData): void;
  trackFavoriteRemoved(data: AirbridgeFavoriteData): void;
  trackWaitlistJoined(data: AirbridgeWaitlistData): void;
  trackWaitlistRemoved(data: AirbridgeWaitlistData): void;
  trackReviewSubmitted(data: AirbridgeReviewData): void;
  trackLoyaltyPointsEarned(data: AirbridgeLoyaltyData): void;

  // Utility
  flush(): void;
  getDebugInfo(): {
    isInitialized: boolean;
    userId?: string;
    isDevelopment: boolean;
  };
}
