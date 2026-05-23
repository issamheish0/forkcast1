/**
 * Feature Flags Configuration
 *
 * Centralized control for app features that can be toggled on/off.
 * Change these values to enable/disable features across the entire app.
 */

export const FEATURE_FLAGS = {
  /**
   * Phone Verification Feature
   *
   * When enabled (true):
   * - Users will be prompted to verify their phone number
   * - Phone verification is required before making bookings
   * - Warning indicators appear in the UI for unverified users
   * - Twilio SMS verification costs apply
   *
   * When disabled (false):
   * - No phone verification prompts or modals
   * - No booking restrictions based on phone verification
   * - No UI warnings about verification status
   * - No Twilio costs
   *
   * To re-enable: Set to true and restart the app
   */
  PHONE_VERIFICATION_ENABLED: false,

  /**
   * Show Phone Verification UI (when feature is enabled)
   *
   * This allows you to enable the feature but hide UI elements
   * during a transition period or for A/B testing.
   */
  SHOW_PHONE_VERIFICATION_UI: true,

  /**
   * Enforce Phone Verification for Bookings
   *
   * When true and PHONE_VERIFICATION_ENABLED is true:
   * - Bookings are blocked until phone is verified
   *
   * When false (but feature enabled):
   * - Users are prompted but can still book without verification
   */
  ENFORCE_PHONE_VERIFICATION_FOR_BOOKINGS: true,

  /**
   * Image Optimization (Supabase render endpoint)
   * Gate to quickly enable/disable optimized image URLs app-wide.
   */
  IMAGE_OPTIMIZATION_ENABLED: true,
} as const;

/**
 * Helper function to check if phone verification should be enforced
 */
export const isPhoneVerificationRequired = (): boolean => {
  return (
    FEATURE_FLAGS.PHONE_VERIFICATION_ENABLED &&
    FEATURE_FLAGS.ENFORCE_PHONE_VERIFICATION_FOR_BOOKINGS
  );
};

/**
 * Helper function to check if phone verification UI should be shown
 */
export const shouldShowPhoneVerificationUI = (): boolean => {
  return (
    FEATURE_FLAGS.PHONE_VERIFICATION_ENABLED &&
    FEATURE_FLAGS.SHOW_PHONE_VERIFICATION_UI
  );
};
