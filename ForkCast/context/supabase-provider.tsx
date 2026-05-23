import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
import { SplashScreen, useRouter } from "expo-router";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../config/supabase";
import { View, ActivityIndicator, Text, Alert, Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SecurityMonitor,
  RateLimiter,
  DeviceSecurity,
  withSecurityMiddleware,
  InputValidator,
} from "../lib/security";
import NetInfo from "@react-native-community/netinfo";
import { airbridgeTracker } from "../lib/airbridgeTracking";
import { metaTracker } from "../lib/metaTracking";
import { parseDeepLink as parseDeepLinkUrl } from "@/lib/deeplink";
import { MOCK_PROFILE, MOCK_USER_ID } from "@/lib/mockData";
import {
  getDeepLinkStatusSnapshot,
  markDeepLinkInitialUrl,
} from "@/lib/deepLinkStatus";
import { PresenceService as presenceService } from "@/lib/presence/PresenceService";
import { audit as auditLogger } from "@/lib/audit";

const GUEST_MODE_KEY = "guest-mode-active";

// AGGRESSIVE SPLASH HIDING: Hide splash as soon as possible, don't wait for complex logic
let splashHideAttempted = false;
const hideSplashImmediately = () => {
  if (!splashHideAttempted) {
    splashHideAttempted = true;
    SplashScreen.hideAsync().catch(() => {});
  }
};

// Multiple aggressive timeouts to ensure splash never stays visible
setTimeout(hideSplashImmediately, 100); // 100ms - almost immediate
setTimeout(hideSplashImmediately, 500); // 500ms - backup
setTimeout(hideSplashImmediately, 1000); // 1s - third attempt
setTimeout(hideSplashImmediately, 2000); // 2s - final backup

// Initial prevention (but will be overridden quickly)
SplashScreen.preventAutoHideAsync().catch(() => {});

// Profile type definition
type Profile = {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  phone_number?: string;
  phone_verified?: boolean;
  phone_verified_at?: string;
  date_of_birth?: string;
  avatar_url?: string;
  allergies?: string[];
  favorite_cuisines?: string[];
  dietary_restrictions?: string[];
  preferred_ambiance?: string[];
  preferred_party_size?: number;
  special_requirements?: string;
  notification_preferences?: {
    email: boolean;
    push: boolean;
    sms: boolean;
    whatsapp: boolean;
    all_muted: boolean;
  };
  loyalty_points?: number;
  membership_tier?: "bronze" | "silver" | "gold" | "platinum";
  onboarded?: boolean;
  completed_bookings?: number;
  created_at?: string;
  updated_at?: string;
};

type PendingDeeplinkResult = string | null;

type AuthState = {
  initialized: boolean;
  databaseReady: boolean; // NEW: Database readiness state
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isGuest: boolean; // NEW: Guest state
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phoneNumber?: string,
    dateOfBirth?: string,
    firstName?: string,
    lastName?: string,
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  appleSignIn: () => Promise<{ error?: Error; needsProfileUpdate?: boolean }>;
  googleSignIn: () => Promise<{ error?: Error; needsProfileUpdate?: boolean }>;
  continueAsGuest: () => void; // NEW: Guest function
  convertGuestToUser: () => void; // NEW: Convert guest to user function
  /** Set before navigating after sign-up so protected layout skips complete-profile redirect once */
  setSkipCompleteProfileRedirect: () => void;
  /** Returns true if redirect should be skipped (and clears the flag). Used by protected layout. */
  consumeSkipCompleteProfileRedirect: () => boolean;
  /** Override where the auth provider navigates after the next session is established. */
  setPostAuthNavigation: (path: string) => void;
};

export const AuthContext = createContext<AuthState>({
  initialized: false,
  databaseReady: false,
  session: null,
  user: null,
  profile: null,
  isGuest: false,
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  updateProfile: async () => {},
  refreshProfile: async () => {},
  appleSignIn: async () => ({}),
  googleSignIn: async () => ({}),
  continueAsGuest: () => {},
  convertGuestToUser: () => {},
  setSkipCompleteProfileRedirect: () => {},
  consumeSkipCompleteProfileRedirect: () => false,
  setPostAuthNavigation: (_path: string) => {},
});

export const useAuth = () => useContext(AuthContext);

function AuthContent({ children }: PropsWithChildren) {
  const [initialized, setInitialized] = useState(false);
  const [databaseReady, setDatabaseReady] = useState(false); // NEW: Database readiness state
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isGuest, setIsGuest] = useState(false); // NEW: Guest state
  const [isOAuthFlow, setIsOAuthFlow] = useState(false); // NEW: OAuth flow tracker

  const router = useRouter();
  const initializationAttempted = useRef(false);
  const oAuthFlowTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationInProgress = useRef(false); // Prevent multiple navigation attempts
  const hasCompletedInitialNavigation = useRef(false); // Track if initial navigation is done
  const skipCompleteProfileRedirectRef = useRef(false);
  const postAuthNavigationRef = useRef<string | null>(null);

  // Create redirect URI for OAuth
  // Expo Go: exp://IP:8081/--/oauth-callback
  // Dev build / production: forkcast://oauth-callback
  const redirectUri = makeRedirectUri({ path: "oauth-callback", scheme: "forkcast" });

  // NEW: Continue as guest function
  const continueAsGuest = useCallback(async () => {
    try {
      await AsyncStorage.setItem(GUEST_MODE_KEY, "true");
      setIsGuest(true);
      setSession(null);
      setUser(null);
      setProfile(null);
      // Navigate to main app
      router.replace("/(protected)/(tabs)");
    } catch (error) {
      // Failed to save guest mode status
    }
  }, [router]);

  // NEW: Convert guest to user (redirect to welcome)
  const convertGuestToUser = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      setIsGuest(false);
      router.replace("/welcome");
    } catch (error) {
      // Failed to clear guest mode status
    }
  }, [router]);

  // NEW: Database readiness check
  const checkDatabaseReadiness = useCallback(async (): Promise<boolean> => {
    try {
      // Simple query to test database connectivity
      const { data, error } = await supabase
        .from("restaurants")
        .select("id")
        .limit(1);

      if (error) {
        // Database readiness check failed
        return false;
      }

      return true;
    } catch (error) {
      // Database readiness check error
      return false;
    }
  }, []);

  // Fetch user profile with enhanced error handling
  const fetchProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) {
          // Error fetching profile

          // If profile doesn't exist, try to create it from user metadata
          if (error.code === "PGRST116") {
            // Get user metadata to create profile
            const {
              data: { user },
            } = await supabase.auth.getUser();

            if (user && user.id === userId) {
              const userMetadata = user.user_metadata;
              const authUser = user as { phone?: string };
              // Supabase stores auth.users.phone WITHOUT '+' prefix — normalize to E.164
              const rawPhone =
                authUser.phone || userMetadata?.phone_number || "";
              const phoneNumber = rawPhone
                ? rawPhone.startsWith("+")
                  ? rawPhone
                  : `+${rawPhone}`
                : undefined;

              // Check if phone number already exists (if provided)
              // Normalize: check both with and without '+' prefix to catch legacy data
              if (phoneNumber) {
                const phoneWithoutPlus = phoneNumber.replace(/^\+/, "");
                const phoneCandidates = [phoneNumber, phoneWithoutPlus];
                const { data: existingPhones } = await supabase
                  .from("profiles")
                  .select("id")
                  .in("phone_number", phoneCandidates)
                  .limit(1);

                if (existingPhones && existingPhones.length > 0) {
                  throw new Error(
                    "This phone number is already associated with another account. Please contact support to update your phone number.",
                  );
                }
              }

              // When user signed in with phone OTP, auth user has .phone — treat as verified
              const signedInWithPhone = !!authUser.phone;

              const newProfile: Partial<Profile> = {
                id: user.id,
                full_name:
                  userMetadata?.full_name ||
                  user.email?.split("@")[0] ||
                  "User",
                phone_number: phoneNumber,
                phone_verified: signedInWithPhone,
                phone_verified_at: signedInWithPhone
                  ? new Date().toISOString()
                  : undefined,
                date_of_birth: userMetadata?.date_of_birth || null,
                avatar_url: undefined,
                loyalty_points: 0,
                membership_tier: "bronze",
                onboarded: false,
                notification_preferences: {
                  email: true,
                  push: true,
                  sms: false,
                  whatsapp: true,
                  all_muted: false,
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };

              const { data: createdProfile, error: createError } =
                await supabase
                  .from("profiles")
                  .insert([newProfile])
                  .select()
                  .single();

              if (createError) {
                // Check if it's a unique constraint violation for phone number
                if (
                  createError.code === "23505" &&
                  createError.message?.toLowerCase().includes("phone")
                ) {
                  throw new Error(
                    "This phone number is already associated with another account. Please contact support to update your phone number.",
                  );
                }
                throw createError;
              }

              return createdProfile as Profile;
            }

            return null;
          }

          throw error;
        }

        return data;
      } catch (error) {
        // Unexpected error fetching profile
        throw error;
      }
    },
    [],
  );

  // Process OAuth user - create profile if needed
  const processOAuthUser = useCallback(
    async (session: Session): Promise<Profile | null> => {
      try {
        // Check if user exists in profiles table
        const { data: existingProfile, error: fetchError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (fetchError && fetchError.code === "PGRST116") {
          // User doesn't exist, create new profile
          const userName =
            session.user.user_metadata.full_name ||
            session.user.user_metadata.name ||
            session.user.email?.split("@")[0] ||
            "User";

          const newProfile: Partial<Profile> = {
            id: session.user.id,
            full_name: userName,
            phone_number: undefined,
            date_of_birth: session.user.user_metadata.date_of_birth || null,
            avatar_url: session.user.user_metadata.avatar_url || null,
            loyalty_points: 0,
            membership_tier: "bronze",
            onboarded: false,
            notification_preferences: {
              email: true,
              push: true,
              sms: false,
              whatsapp: true,
              all_muted: false,
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const { data: createdProfile, error: createError } = await supabase
            .from("profiles")
            .insert([newProfile])
            .select()
            .single();

          if (createError) {
            // Error creating profile after OAuth
            return null;
          }

          const oauthProvider = session.user.app_metadata?.provider;
          if (oauthProvider === "google" || oauthProvider === "apple") {
            airbridgeTracker.setUserId(session.user.id);
            metaTracker.setUserID(session.user.id);
            airbridgeTracker.trackSignUp({
              method: oauthProvider,
              userId: session.user.id,
              hasProfileData: !!session.user.user_metadata.full_name,
            });
          }

          return createdProfile as Profile;
        } else if (fetchError) {
          // Error fetching user profile
          return null;
        }

        // Profile exists, return it
        return existingProfile as Profile;
      } catch (error) {
        // Error processing OAuth user
        return null;
      }
    },
    [],
  );

  const signUp = useCallback(
    withSecurityMiddleware(
      async (
        email: string,
        password: string,
        fullName: string,
        phoneNumber?: string,
        dateOfBirth?: string,
        firstName?: string,
        lastName?: string,
      ) => {
        try {
          // Enhanced input validation
          if (!InputValidator.isValidEmail(email)) {
            throw new Error("Please enter a valid email address");
          }

          const passwordValidation = InputValidator.validatePassword(password);
          if (!passwordValidation.isValid) {
            throw new Error(
              passwordValidation.errors[0] || "Password is not strong enough",
            );
          }

          if (!fullName || fullName.trim().length < 2) {
            throw new Error("Please enter your full name");
          }

          if (phoneNumber && !InputValidator.isValidPhoneNumber(phoneNumber)) {
            throw new Error("Please enter a valid phone number");
          }

          // Check rate limits for registration attempts
          const rateLimitResult = await RateLimiter.checkActionRateLimit(
            email,
            "registration_attempts",
          );

          if (!rateLimitResult.allowed) {
            await SecurityMonitor.monitorSuspiciousActivity({
              type: "account_abuse",
              metadata: {
                email,
                reason: "registration_rate_limit",
                timestamp: new Date().toISOString(),
              },
            });

            throw new Error(
              "Too many registration attempts. Please try again later.",
            );
          }

          // Check device account limits
          const deviceAllowed = await DeviceSecurity.checkDeviceAccountLimit();
          if (!deviceAllowed) {
            await SecurityMonitor.monitorSuspiciousActivity({
              type: "account_abuse",
              metadata: {
                email,
                reason: "device_account_limit_exceeded",
                timestamp: new Date().toISOString(),
              },
            });

            throw new Error(
              "Maximum number of accounts reached for this device",
            );
          }

          // Clear guest mode when signing up
          setIsGuest(false);

          // Check if phone number already exists (if provided)
          // Normalize: check both with and without '+' prefix to catch legacy data
          if (phoneNumber) {
            const phoneWithoutPlus = phoneNumber.replace(/^\+/, "");
            const phoneCandidates = [phoneNumber, phoneWithoutPlus];
            const { data: existingPhones, error: phoneCheckError } =
              await supabase
                .from("profiles")
                .select("id")
                .in("phone_number", phoneCandidates)
                .limit(1);

            if (existingPhones && existingPhones.length > 0) {
              throw new Error(
                "This phone number is already associated with another account. Please use a different phone number or sign in to your existing account.",
              );
            }

            if (phoneCheckError && phoneCheckError.code !== "PGRST116") {
              // Continue anyway - this is a non-critical check
            }
          }

          // Attempt signup and check the identities array
          // When email confirmation is enabled, Supabase returns a user object even for existing emails
          // But for existing users, the identities array will be empty
          const { data: authData, error: authError } =
            await supabase.auth.signUp({
              email,
              password,
              options: {
                // Use email OTP instead of magic link
                emailRedirectTo: undefined,
                data: {
                  full_name: fullName,
                  phone_number: phoneNumber,
                  date_of_birth: dateOfBirth,
                  first_name: firstName,
                  last_name: lastName,
                },
              },
            });

          if (authError) {
            // Monitor failed registration attempts
            await SecurityMonitor.monitorSuspiciousActivity({
              type: "account_abuse",
              metadata: {
                email,
                error: authError.message,
                reason: "registration_failed",
                timestamp: new Date().toISOString(),
              },
            });

            const normalizedMessage =
              typeof authError.message === "string"
                ? authError.message.toLowerCase()
                : "";
            const rawDescription = (authError as { error_description?: string })
              .error_description;
            const normalizedDescription =
              typeof rawDescription === "string"
                ? rawDescription.toLowerCase()
                : "";

            const mentionsPhone =
              normalizedMessage.includes("phone") ||
              normalizedDescription.includes("phone");
            const isDuplicateKey =
              normalizedMessage.includes("duplicate key value") ||
              normalizedDescription.includes("duplicate key value");
            const isGenericDatabaseError = normalizedMessage.includes(
              "database error saving new user",
            );

            if (
              phoneNumber &&
              (mentionsPhone || isDuplicateKey || isGenericDatabaseError)
            ) {
              throw new Error(
                "This phone number is already associated with another account. Please use a different phone number or sign in to your existing account.",
              );
            }

            throw authError;
          }

          // Check if this is an existing user
          // When email confirmation is enabled, Supabase ALWAYS returns a user object
          // But for existing users, the identities array will be empty
          if (
            authData.user &&
            authData.user.identities &&
            authData.user.identities.length === 0
          ) {
            throw new Error(
              "This email is already registered. Please sign in instead or use 'Forgot Password' if you need to reset your password.",
            );
          }

          if (!authData.user) {
            throw new Error(
              "This email is already registered. Please sign in instead or use 'Forgot Password' if you need to reset your password.",
            );
          }

          // Check if a session was created (unusual - means user already exists and is confirmed)
          if (authData.user && authData.session) {
            throw new Error(
              "This email is already registered and confirmed. Please use the Sign In page instead.",
            );
          }

          // If we got here, it's a new user who needs to confirm their email with OTP.
          // Supabase automatically sends the confirmation email (with the 6-digit OTP token)
          // when signUp() is called — no extra step needed here.
          if (authData.user && !authData.session) {
            // Navigate to OTP verification screen
            router.push({
              pathname: "/verify-email-otp",
              params: { email },
            });
            return;
          } else if (authData.user && authData.session) {
            // Register device for the new user
            await DeviceSecurity.registerDeviceForUser(authData.user.id);

            const { error: profileError } = await supabase
              .from("profiles")
              .insert({
                id: authData.user.id,
                full_name: fullName,
                first_name: firstName || "",
                last_name: lastName || "",
                phone_number: phoneNumber,
                date_of_birth: dateOfBirth,
                loyalty_points: 0,
                membership_tier: "bronze",
                user_rating: 5.0, // New users start with excellent rating
                onboarded: false,
                notification_preferences: {
                  email: true,
                  push: true,
                  sms: false,
                  whatsapp: true,
                  all_muted: false,
                },
              });

            if (profileError) {
              // Check if it's a unique constraint violation for phone number
              if (
                profileError.code === "23505" &&
                profileError.message?.toLowerCase().includes("phone")
              ) {
                throw new Error(
                  "This phone number is already associated with another account. Please use a different phone number.",
                );
              }

              // Profile creation error (non-critical for other errors)
            } else {
            }
          }

          // Log successful registration for monitoring
          if (authData.user) {
            await SecurityMonitor.monitorSuspiciousActivity({
              type: "account_abuse",
              userId: authData.user.id,
              metadata: {
                action: "successful_registration",
                email,
                timestamp: new Date().toISOString(),
              },
            });

            // Track registration with Airbridge and Meta
            airbridgeTracker.setUserId(authData.user.id);
            metaTracker.setUserID(authData.user.id);
            metaTracker.logCompleteRegistration();
            airbridgeTracker.trackSignUp({
              method: "email",
              userId: authData.user.id,
              hasProfileData: !!phoneNumber,
            });

            // Audit log: signup
            auditLogger.logSignup({
              user_id: authData.user.id,
              email,
              method: "email",
              success: true,
            });
          }
        } catch (error) {
          // Sign-up error
          throw error;
        }
      },
      {
        actionType: "registration_attempts",
        validateInput: true,
        monitorFailures: true,
      },
    ),
    [],
  );

  const signIn = useCallback(
    withSecurityMiddleware(
      async (email: string, password: string) => {
        // ─── MOCK LOGIN ──────────────────────────────────────────────────────────
        if (email === "test@test.com" && password === "test") {
          const mockUser = {
            id: MOCK_USER_ID,
            email: "test@test.com",
            app_metadata: { provider: "email" },
            user_metadata: {},
          } as any;
          const mockSession = {
            user: mockUser,
            access_token: "mock-token",
            token_type: "bearer",
            expires_in: 9999999,
            expires_at: 9999999999,
            refresh_token: "mock-refresh",
          } as any;
          setIsGuest(false);
          setUser(mockUser);
          setSession(mockSession);
          setProfile(MOCK_PROFILE as any);
          setInitialized(true);
          return;
        }
        // ────────────────────────────────────────────────────────────────────────
        try {
          // Input validation
          if (!InputValidator.isValidEmail(email)) {
            throw new Error("Please enter a valid email address");
          }

          if (!password || password.length < 4) {
            throw new Error("Password must be at least 6 characters");
          }

          // Check rate limits for login attempts
          const rateLimitResult = await RateLimiter.checkActionRateLimit(
            email,
            "login_attempts",
          );

          if (!rateLimitResult.allowed) {
            // Try to get user_id from email for better security tracking
            let userId = null;
            try {
              const { data: profileData } = await supabase
                .from("profiles")
                .select("id")
                .eq("email", email)
                .single();
              userId = profileData?.id || null;
            } catch (profileError) {
              // User doesn't exist or other error - continue with null userId
            }

            await SecurityMonitor.monitorSuspiciousActivity({
              type: "multiple_failed_logins",
              userId,
              metadata: { email, timestamp: new Date().toISOString() },
            });

            throw new Error("Too many login attempts. Please try again later.");
          }

          // Check device account limits
          const deviceAllowed = await DeviceSecurity.checkDeviceAccountLimit();
          if (!deviceAllowed) {
            await SecurityMonitor.monitorSuspiciousActivity({
              type: "account_abuse",
              metadata: {
                email,
                reason: "device_account_limit_exceeded",
                timestamp: new Date().toISOString(),
              },
            });

            throw new Error(
              "Maximum number of accounts reached for this device",
            );
          }

          // Clear guest mode when signing in
          setIsGuest(false);

          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            // Sign-in error

            // Try to get user_id from email for better security tracking
            let userId = null;
            try {
              const { data: profileData } = await supabase
                .from("profiles")
                .select("id")
                .eq("email", email)
                .single();
              userId = profileData?.id || null;
            } catch (profileError) {
              // User doesn't exist or other error - continue with null userId
            }

            // Monitor failed login attempts
            try {
              await SecurityMonitor.monitorSuspiciousActivity({
                type: "multiple_failed_logins",
                userId,
                metadata: {
                  email,
                  error: error.message,
                  timestamp: new Date().toISOString(),
                },
              });
            } catch (securityError) {
              // Security monitoring failed - log but don't block user
            }

            // Audit log: failed login
            auditLogger.logLoginFailed({
              user_id: userId ?? undefined,
              email,
              method: "email",
              success: false,
              error_message: error.message,
            });

            throw error;
          }

          // Successful login - register device and check for security flags
          if (data.user) {
            await DeviceSecurity.registerDeviceForUser(data.user.id);

            // Audit log: successful login
            auditLogger.logLogin({
              user_id: data.user.id,
              email: data.user.email,
              method: "email",
              success: true,
            });

            // Check if user is flagged for suspicious activity
            const suspiciousFlags =
              await SecurityMonitor.checkUserSuspiciousFlags(data.user.id);

            if (
              suspiciousFlags.isFlagged &&
              suspiciousFlags.riskLevel === "high"
            ) {
              Alert.alert(
                "Account Review",
                "Your account has been flagged for review. Some features may be limited. Please contact support if you have questions.",
                [{ text: "OK" }],
              );
            }
          }
        } catch (error) {
          // Sign-in error
          throw error;
        }
      },
      {
        actionType: "login_attempts",
        validateInput: true,
        monitorFailures: true,
      },
    ),
    [],
  );

  const signOut = useCallback(async () => {
    try {
      // Clear guest mode
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      setIsGuest(false);

      // Logout from OneSignal to disassociate device from user
      if (user?.id) {
        // no-op in Expo Go — OneSignal not available

        // Stop tracking presence before signing out
        try {
          await presenceService.untrack();
        } catch (presenceError) {
          // Continue with sign out - this is non-critical
        }

        // Clear Airbridge and Meta user ID and track sign out
        try {
          airbridgeTracker.trackSignOut();
          airbridgeTracker.clearUserId();
          metaTracker.clearUserID();
        } catch (trackingError) {
          // Continue with sign out
        }

        // Audit log: logout (do this before clearing user state)
        auditLogger.logLogout(user.id);
      }

      // CRITICAL: Call Supabase signOut FIRST to clear the stored session token
      // This must complete before we clear local state to ensure the token is removed from storage
      try {
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) {
          console.error("Supabase sign-out error:", error);
        }
      } catch (supabaseError) {
        console.error("Supabase sign-out exception:", supabaseError);
      }

      // BACKUP: Manually clear the auth token from SecureStore in case signOut didn't work
      try {
        const SecureStore = await import("expo-secure-store");
        await SecureStore.deleteItemAsync("supabase.auth.token");
      } catch (storageError) {
        // Non-critical - signOut should have handled this
      }

      // Now clear local state to update UI
      setSession(null);
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error("Sign-out error:", error);

      // EMERGENCY: Even if there's an error, force clear everything
      try {
        // Try Supabase signOut again
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});

        // Manually clear storage
        const SecureStore = await import("expo-secure-store");
        await SecureStore.deleteItemAsync("supabase.auth.token").catch(
          () => {},
        );

        setSession(null);
        setUser(null);
        setProfile(null);
        await AsyncStorage.removeItem(GUEST_MODE_KEY);
        // Also stop presence tracking on error
        await presenceService.untrack();
      } catch (stateError) {
        console.error("Failed to clear local state:", stateError);
      }
    }
  }, [user]);

  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      if (!user) {
        throw new Error("No user logged in");
      }

      // Strip protected fields that should only be modified by backend/admin.
      // Defense in depth — the DB trigger also blocks these, but we strip
      // client-side to avoid unnecessary writes and audit log noise.
      const {
        phone_number,
        phone_verified,
        phone_verified_at,
        email,
        loyalty_points,
        membership_tier,
        user_rating,
        rating_last_updated,
        total_bookings,
        completed_bookings,
        cancelled_bookings,
        no_show_bookings,
        created_at,
        id,
        ...safeUpdates
      } = updates as Record<string, unknown>;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .update(safeUpdates)
          .eq("id", user.id)
          .select()
          .single();

        if (error) {
          // Profile update error
          throw error;
        }

        setProfile(data);
        // Profile updated successfully
      } catch (error) {
        // Error updating profile
        throw error;
      }
    },
    [user],
  );

  const refreshProfile = useCallback(async () => {
    if (!user) return;

    try {
      // Refreshing profile
      const profileData = await fetchProfile(user.id);
      if (profileData) {
        setProfile(profileData);
        // Profile refreshed successfully
      }
    } catch (error) {
      // Error refreshing profile
    }
  }, [user, fetchProfile]);

  const setSkipCompleteProfileRedirect = useCallback(() => {
    skipCompleteProfileRedirectRef.current = true;
  }, []);

  const consumeSkipCompleteProfileRedirect = useCallback(() => {
    const v = skipCompleteProfileRedirectRef.current;
    skipCompleteProfileRedirectRef.current = false;
    return v;
  }, []);

  const setPostAuthNavigation = useCallback((path: string) => {
    postAuthNavigationRef.current = path;
  }, []);

  // Apple Sign In implementation
  const appleSignIn = useCallback(async () => {
    try {
      // Clear guest mode
      setIsGuest(false);

      // Check if Apple Authentication is available on this device
      if (Platform.OS !== "ios") {
        return {
          error: new Error(
            "Apple authentication is only available on iOS devices",
          ),
        };
      }

      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        return {
          error: new Error(
            "Apple authentication is not available on this device",
          ),
        };
      }

      // Request authentication with Apple
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Sign in via Supabase Auth
      if (credential.identityToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken,
        });

        if (error) {
          // Apple auth error
          return { error };
        }

        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
          // User signed in with Apple

          // Process OAuth user profile
          const userProfile = await processOAuthUser(data.session);
          if (userProfile) {
            setProfile(userProfile);

            // OneSignal device registration is handled automatically by the SDK
            // User is synced via OneSignal.login() in _layout.tsx when profile loads

            // Audit log: Apple OAuth login
            auditLogger.logOAuthLogin({
              user_id: data.session.user.id,
              email: data.session.user.email,
              provider: "apple",
              success: true,
            });

            // Check if profile needs additional info (like phone number)
            const needsUpdate = !userProfile.phone_number;
            return { needsProfileUpdate: needsUpdate };
          }
        }
      } else {
        return { error: new Error("No identity token received from Apple") };
      }

      return {};
    } catch (error: any) {
      if (error.code === "ERR_REQUEST_CANCELED") {
        // User canceled Apple sign-in
        return {}; // Not an error, just a cancellation
      }

      // Apple authentication error
      return { error: error as Error };
    }
  }, [processOAuthUser]);

  // Google Sign In implementation (keeping your existing implementation)
  const googleSignIn = useCallback(async () => {
    try {
      // Clear guest mode and set OAuth flow state

      setIsGuest(false);
      setIsOAuthFlow(true);

      // Clear any existing OAuth timeout
      if (oAuthFlowTimeout.current) {
        clearTimeout(oAuthFlowTimeout.current);
      }

      // Set timeout to clear OAuth flow state if it takes too long

      oAuthFlowTimeout.current = setTimeout(() => {
        setIsOAuthFlow(false);
      }, 60000); // 1 minute timeout

      // Create platform-specific redirect URI that matches Android intent filters
      // CRITICAL: Use the exact format that Android intent filters expect
      // Use makeRedirectUri() which returns exp:// in Expo Go and forkcast:// in production
      const redirectUrl = redirectUri;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: "select_account consent",
            access_type: "offline",
            include_granted_scopes: "true",
          },
        },
      });

      if (error || !data?.url) {
        console.error("❌ Step 1 FAILED: Error initiating OAuth", error);
        return { error: error || new Error("No OAuth URL received") };
      }

      // Parse the URL to see what redirect_uri Supabase is actually using
      try {
        const oauthUrl = new URL(data.url);
        const actualRedirectUri = oauthUrl.searchParams.get("redirect_uri");

        if (actualRedirectUri && actualRedirectUri !== redirectUrl) {
          console.warn(
            "⚠️ MISMATCH! Supabase is using different redirect_uri than requested!",
          );
          console.warn("   Requested:", redirectUrl);
          console.warn("   Actual:", actualRedirectUri);
        }
      } catch (e) {
        console.warn("⚠️ Could not parse OAuth URL to check redirect_uri");
      }

      // Step 2: Set up a URL listener BEFORE opening the browser

      let urlSubscription: any;
      let urlResolved = false; // Prevent double resolution
      const urlPromise = new Promise<string>((resolve, reject) => {
        // Listen for the redirect
        urlSubscription = Linking.addEventListener("url", (event) => {
          if (urlResolved) {
            return;
          }

          // Received URL - check if it's an OAuth callback
          if (
            event.url.includes("oauth-callback") ||
            event.url.includes("auth-callback") ||
            event.url.includes("#access_token") ||
            event.url.includes("code=")
          ) {
            urlResolved = true;
            resolve(event.url);
          } else {
          }
        });

        // Android devices need longer timeout due to slower OAuth processing
        const timeoutDuration = Platform.OS === "android" ? 180000 : 120000; // 3 minutes for Android, 2 for iOS

        setTimeout(() => {
          if (!urlResolved) {
            console.error("⏱️ ❌ OAuth timeout reached!");
            reject(new Error("OAuth timeout"));
          }
        }, timeoutDuration);
      });

      const browserOptions: any =
        Platform.OS === "android"
          ? {
              // Android-specific: Use default browser behavior
              showInRecents: false,
              // Don't pass redirectUrl as second param for Android - let intent filters handle it
            }
          : {
              // iOS-specific options
              preferEphemeralSession: false,
              showInRecents: false,
            };

      // For Android, don't pass redirect URL to openAuthSessionAsync
      // Let the OS handle the deep link via intent filters
      const browserPromise = WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
        browserOptions,
      );

      try {
        const result = await Promise.race([
          browserPromise.then((browserResult) => {
            return browserResult;
          }),
          urlPromise.then((url) => {
            // On Android, manually dismiss the browser when we receive the callback
            if (Platform.OS === "android") {
              try {
                WebBrowser.dismissBrowser();
              } catch (dismissError) {
                console.warn("⚠️ Failed to dismiss browser:", dismissError);
              }
            }
            return { type: "success" as const, url };
          }),
        ]);

        if (urlSubscription) {
          urlSubscription.remove();
        }

        if (result.type === "success" && result.url) {
          const url = new URL(result.url);

          // Extract parameters from hash or query

          let params = new URLSearchParams();
          if (url.hash) {
            params = new URLSearchParams(url.hash.substring(1));
          } else if (url.search) {
            params = new URLSearchParams(url.search);
          } else {
          }

          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          const code = params.get("code");
          const error_description = params.get("error_description");

          if (error_description) {
            console.error("❌ OAuth error:", error_description);
            return { error: new Error(error_description) };
          }

          // Step 6: Handle code exchange
          if (code && !access_token) {
            try {
              // Add timeout to prevent hanging
              const exchangePromise =
                supabase.auth.exchangeCodeForSession(code);
              const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(
                  () =>
                    reject(new Error("Code exchange timeout after 30 seconds")),
                  30000,
                );
              });

              const { data: sessionData, error: sessionError } =
                await Promise.race([
                  exchangePromise,
                  timeoutPromise.then(() => ({
                    data: null,
                    error: new Error("Timeout"),
                  })),
                ]);

              if (sessionData?.session) {
              }

              if (sessionError) {
                console.error("❌ Code exchange FAILED:", sessionError);
                console.error(
                  "Error details:",
                  JSON.stringify(sessionError, null, 2),
                );
                return { error: sessionError };
              }

              if (sessionData?.session) {
                // Android needs more time to process OAuth state changes
                const processingDelay = Platform.OS === "android" ? 1000 : 500;

                await new Promise((resolve) =>
                  setTimeout(resolve, processingDelay),
                );

                // Process OAuth user profile
                const userProfile = await processOAuthUser(sessionData.session);
                if (userProfile) {
                  setProfile(userProfile);

                  // OneSignal device registration is handled automatically by the SDK
                  // User is synced via OneSignal.login() in _layout.tsx when profile loads

                  // Audit log: Google OAuth login (code exchange)
                  auditLogger.logOAuthLogin({
                    user_id: sessionData.session.user.id,
                    email: sessionData.session.user.email,
                    provider: "google",
                    success: true,
                  });

                  // Check if profile needs additional info
                  const needsUpdate = !userProfile.phone_number;
                  return { needsProfileUpdate: needsUpdate };
                }
                return {};
              }
            } catch (exchangeError: any) {
              console.error("❌ ❌ ❌ CODE EXCHANGE THREW EXCEPTION!");
              console.error(
                "Exception:",
                exchangeError?.message || exchangeError,
              );
              console.error("Stack:", exchangeError?.stack);
              return {
                error: new Error(
                  exchangeError?.message || "Code exchange failed",
                ),
              };
            }
          }

          // Step 7: Handle direct token
          if (access_token) {
            // Access token found, setting session

            // Platform-specific delay for proper state handling
            const stateDelay = Platform.OS === "android" ? 800 : 300;
            await new Promise((resolve) => setTimeout(resolve, stateDelay));

            const { data: sessionData, error: sessionError } =
              await supabase.auth.setSession({
                access_token,
                refresh_token: refresh_token || "",
              });

            if (sessionError) {
              // Session creation failed
              return { error: sessionError };
            }

            if (sessionData?.session) {
              // Session established via tokens
              // Process OAuth user profile
              const userProfile = await processOAuthUser(sessionData.session);
              if (userProfile) {
                setProfile(userProfile);

                // OneSignal device registration is handled automatically by the SDK
                // User is synced via OneSignal.login() in _layout.tsx when profile loads

                // Audit log: Google OAuth login (direct token)
                auditLogger.logOAuthLogin({
                  user_id: sessionData.session.user.id,
                  email: sessionData.session.user.email,
                  provider: "google",
                  success: true,
                });

                // Check if profile needs additional info
                const needsUpdate = !userProfile.phone_number;
                return { needsProfileUpdate: needsUpdate };
              }
              return {};
            }
          }

          // Step 8: Final fallback check with extended wait for Android
          // Checking for session via getSession
          const fallbackWait = Platform.OS === "android" ? 2000 : 1000;
          await new Promise((resolve) => setTimeout(resolve, fallbackWait));

          const {
            data: { session: currentSession },
          } = await supabase.auth.getSession();

          if (currentSession) {
            // Session found via getSession
            // Process OAuth user profile
            const userProfile = await processOAuthUser(currentSession);
            if (userProfile) {
              setProfile(userProfile);

              // OneSignal device registration is handled automatically by the SDK
              // User is synced via OneSignal.login() in _layout.tsx when profile loads

              // Audit log: Google OAuth login (fallback)
              auditLogger.logOAuthLogin({
                user_id: currentSession.user.id,
                email: currentSession.user.email,
                provider: "google",
                success: true,
              });

              // Check if profile needs additional info
              const needsUpdate = !userProfile.phone_number;
              return { needsProfileUpdate: needsUpdate };
            }
            return {};
          }

          // No session established after OAuth
          return { error: new Error("Failed to establish session") };
        } else if (result.type === "cancel") {
          return {};
        } else if (result.type === "dismiss") {
          const maxPolls = Platform.OS === "android" ? 10 : 5; // More polls for Android
          const pollDelay = 500; // 500ms between polls

          for (let poll = 0; poll < maxPolls; poll++) {
            await new Promise((resolve) => setTimeout(resolve, pollDelay));

            const {
              data: { session },
            } = await supabase.auth.getSession();

            if (session) {
              const userProfile = await processOAuthUser(session);
              if (userProfile) {
                setProfile(userProfile);

                // Audit log: Google OAuth login (dismiss polling)
                auditLogger.logOAuthLogin({
                  user_id: session.user.id,
                  email: session.user.email,
                  provider: "google",
                  success: true,
                });

                const needsUpdate = !userProfile.phone_number;
                return { needsProfileUpdate: needsUpdate };
              }
              return {};
            }
          }

          return { error: new Error("Browser dismissed without session") };
        } else {
          return { error: new Error("OAuth flow failed") };
        }
      } catch (timeoutError) {
        console.error("⏱️ ⏱️ ⏱️ TIMEOUT OR ERROR IN OAUTH FLOW!");
        console.error("Error:", timeoutError);

        // Clean up listener if timeout

        if (urlSubscription) {
          urlSubscription.remove();
        }

        // Check if session was created anyway

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          // Process OAuth user profile
          const userProfile = await processOAuthUser(session);
          if (userProfile) {
            setProfile(userProfile);

            // Audit log: Google OAuth login (timeout recovery)
            auditLogger.logOAuthLogin({
              user_id: session.user.id,
              email: session.user.email,
              provider: "google",
              success: true,
            });

            // Check if profile needs additional info
            const needsUpdate = !userProfile.phone_number;
            return { needsProfileUpdate: needsUpdate };
          }
          return {};
        }

        console.error("❌ No session found after timeout");
        return { error: new Error("OAuth timeout") };
      }
    } catch (error: any) {
      console.error("\n❌ ========== GOOGLE SIGN IN FAILED ==========");
      console.error("Error type:", error?.constructor?.name);
      console.error("Error message:", error?.message);
      console.error("Full error:", JSON.stringify(error, null, 2));
      console.error("=".repeat(50) + "\n");
      return { error: error as Error };
    } finally {
      // Clear OAuth flow state after completion

      setIsOAuthFlow(false);
      if (oAuthFlowTimeout.current) {
        clearTimeout(oAuthFlowTimeout.current);
        oAuthFlowTimeout.current = null;
      }
    }
  }, [processOAuthUser]);

  // Listen for URL callbacks
  useEffect(() => {
    // Listen for incoming URLs when app resumes
    const handleUrl = async (url: string) => {
      // Check if it's an OAuth callback
      if (url.includes("#access_token") || url.includes("code=")) {
        try {
          // Explicitly exchange code for session
          const startTime = Date.now();
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(url);
          const duration = Date.now() - startTime;

          if (error) {
            console.error(
              "❌ [URL Handler] Error exchanging code for session:",
              error,
            );
            console.error("Error details:", JSON.stringify(error, null, 2));
            return;
          }

          if (data?.session) {
          } else {
            console.warn(
              "⚠️ [URL Handler] Code exchange succeeded but no session returned",
            );
          }
        } catch (err) {
          console.error(
            "❌ [URL Handler] Exception during code exchange:",
            err,
          );
          console.error("Exception details:", JSON.stringify(err, null, 2));
        }
      } else {
      }
    };

    // Get initial URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl(url).catch((err) =>
          console.error("Error handling initial URL:", err),
        );
      }
    });

    // Listen for URL changes
    const subscription = Linking.addEventListener("url", (event) => {
      if (event.url) {
        // Need to handle async function properly
        handleUrl(event.url).catch((err) =>
          console.error("Error handling incoming URL:", err),
        );
      }
    });

    return () => subscription.remove();
  }, []);

  // Initialize auth state - RUNS ONLY ONCE
  useEffect(() => {
    if (initializationAttempted.current) return;
    initializationAttempted.current = true;

    let authSubscription: { unsubscribe: () => void } | null = null;
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        // Initializing auth state

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        // Check if component is still mounted before updating state
        if (!isMounted) return;

        if (error) {
          // Error getting session
        } else if (session) {
          // Session found during initialization
          setSession(session);
          setUser(session.user);
          setIsGuest(false);
          // Start tracking presence when session is restored
          presenceService
            .track(session.user.id, {
              user: session.user.id,
              online_at: new Date().toISOString(),
            })
            .catch((error) => {
              console.error("Error starting presence tracking on init:", error);
            });
        } else {
          // Check for guest mode
          const guestModeActive = await AsyncStorage.getItem(GUEST_MODE_KEY);
          if (guestModeActive === "true") {
            // Guest mode active from storage
            setIsGuest(true);
          } else {
            // No session found during initialization
          }
        }
      } catch (error) {
        // Error initializing auth
      } finally {
        if (isMounted) {
          setInitialized(true);
          // Auth initialization complete
        }
      }
    };

    // Check database readiness in background (non-blocking)
    const checkDatabaseReadinessBackground = async () => {
      try {
        // Add retries for cold start scenarios with exponential backoff
        let databaseReadySuccess = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          // Database readiness attempt

          const isReady = await checkDatabaseReadiness();
          if (isReady) {
            databaseReadySuccess = true;
            break;
          }

          // Exponential backoff: 1s, 2s, 4s
          if (attempt < 3) {
            const delay = Math.pow(2, attempt - 1) * 1000;
            // Retrying database check
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        if (isMounted) {
          setDatabaseReady(databaseReadySuccess);
          // Database readiness check result
        }
      } catch (error) {
        // Error checking database readiness (non-critical)
        if (isMounted) {
          setDatabaseReady(false);
        }
      }
    };

    initializeAuth();
    checkDatabaseReadinessBackground();

    // Listen for auth changes with proper cleanup
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Auth state changed

      // Check if component is still mounted before updating state
      if (!isMounted) return;

      try {
        if (session) {
          setSession(session);
          setUser(session.user);
          setIsGuest(false);
          // Set Airbridge and Meta user ID when session is restored
          airbridgeTracker.setUserId(session.user.id);
          metaTracker.setUserID(session.user.id);
          // Start tracking presence when user logs in (connectivity-aware, non-blocking)
          setTimeout(() => {
            NetInfo.fetch()
              .then((net) => {
                if (!net.isConnected) return;
                return presenceService.track(session.user.id, {
                  user: session.user.id,
                  online_at: new Date().toISOString(),
                });
              })
              .catch((error) => {
                console.error("Error starting presence tracking:", error);
              });
          }, 500);
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
          // Clear Airbridge and Meta user ID when session ends
          airbridgeTracker.clearUserId();
          metaTracker.clearUserID();
          // Stop tracking presence when user logs out
          presenceService.untrack().catch((error) => {
            console.error("Error stopping presence tracking:", error);
          });
          // Don't set guest mode here - only via explicit action
        }
      } catch (error) {
        // Error handling auth state change
      }
    });

    authSubscription = subscription;

    // Cleanup function
    return () => {
      isMounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
        authSubscription = null;
      }
      // Auth subscription cleaned up
    };
  }, []);

  // Fetch profile when user changes
  useEffect(() => {
    if (user && !profile && !isGuest) {
      // User found, fetching profile
      fetchProfile(user.id)
        .then((profileData) => {
          if (profileData) {
            setProfile(profileData);
            // Profile loaded
          } else {
            // Profile not found
          }
        })
        .catch((error) => {
          // Failed to fetch profile - check if it's a phone duplicate error
          const errorMessage = error?.message || String(error);
          if (errorMessage.includes("phone number is already associated")) {
            Alert.alert("Phone Number Already in Use", errorMessage, [
              {
                text: "Contact Support",
                onPress: () => {
                  // User can contact support
                },
              },
              {
                text: "Sign Out",
                onPress: async () => {
                  await supabase.auth.signOut();
                  router.replace("/welcome");
                },
                style: "cancel",
              },
            ]);
          }
        });
    }
  }, [user?.id, profile, fetchProfile, isGuest]);

  // Helper function to check for pending deeplinks
  const checkForPendingDeeplink =
    useCallback(async (): Promise<PendingDeeplinkResult> => {
      try {
        // Check for initial URL that might be a deeplink
        const initialUrl = await Linking.getInitialURL();
        if (!initialUrl) return null;

        // Ignore development URLs
        const isDevelopmentUrl =
          initialUrl.startsWith("exp://") ||
          initialUrl.startsWith("exps://") ||
          initialUrl.includes(":8081") ||
          initialUrl.includes("localhost") ||
          initialUrl.includes("127.0.0.1") ||
          initialUrl.startsWith("file://");

        if (isDevelopmentUrl) return null;

        // Check if it's a supported deeplink (not just any URL)
        const isSupportedScheme =
          initialUrl.startsWith("plate://") ||
          initialUrl.startsWith("qwerty-plate://") ||
          initialUrl.startsWith("com.notqwerty.plate://") ||
          initialUrl.startsWith("https://plate-app.com") ||
          initialUrl.startsWith("https://www.plate-app.com");

        if (!isSupportedScheme) return null;

        markDeepLinkInitialUrl(initialUrl);

        // If we got here, there's likely a valid deeplink pending
        // Detected pending deeplink during auth navigation
        return initialUrl;
      } catch (error) {
        // Error checking for pending deeplinks
        return null;
      }
    }, []);

  // Handle navigation
  useEffect(() => {
    if (!initialized) return;

    const navigate = async () => {
      // Prevent multiple simultaneous navigation attempts
      if (navigationInProgress.current) {
        // Navigation already in progress, skipping
        return;
      }

      try {
        navigationInProgress.current = true;
        // Handling navigation

        // CRITICAL: Check for pending deeplinks during cold start
        // If a deeplink exists, COMPLETELY skip auth navigation and let deeplink handler take over
        const pendingDeeplinkUrl = await checkForPendingDeeplink();
        if (pendingDeeplinkUrl) {
          // CRITICAL FIX: During cold start with a deeplink, NEVER navigate to home
          // The deeplink handler (_layout.tsx) is responsible for navigation
          // We just need to wait here and not interfere
          return;
        }

        // REDUCED DELAYS: Callback screens now actively poll for session
        // so we don't need long delays here anymore
        const recentAuthTime = session?.expires_at
          ? Date.now() -
            new Date(session.expires_at).getTime() +
            (session.expires_in || 3600) * 1000
          : Date.now();
        const isRecentAuth = recentAuthTime < 30000; // Less than 30 seconds ago

        const isOAuthFlow =
          isRecentAuth &&
          session?.user?.app_metadata?.provider &&
          ["google", "apple"].includes(session.user.app_metadata.provider);

        if (isOAuthFlow) {
          // Reduced delay since callback screens now poll for session
          const oauthDelay = Platform.OS === "android" ? 1000 : 500;

          await new Promise((resolve) => setTimeout(resolve, oauthDelay));
        } else if (Platform.OS === "android") {
          // Small delay for Android navigation stability
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        // Verify router is ready before navigation
        if (!router || typeof router.replace !== "function") {
          // Router not ready, scheduling retry
          throw new Error("Router not ready");
        }

        const statusBeforeNavigation = getDeepLinkStatusSnapshot();

        // Simple navigation based on session or guest mode
        if (session || isGuest) {
          const activeDeepLinkPath = statusBeforeNavigation.activePath;
          const shouldPreserveDeepLink =
            activeDeepLinkPath !== null &&
            activeDeepLinkPath !== "/(protected)/(tabs)" &&
            activeDeepLinkPath !== "/welcome";

          if (shouldPreserveDeepLink) {
            // Deep link already navigated to a protected route, avoid overriding it
            return;
          }

          // If we've already done the initial navigation and there's no pending
          // override (e.g. post-OTP redirect), don't re-navigate on session
          // refreshes or token renewals.
          if (hasCompletedInitialNavigation.current && !postAuthNavigationRef.current) {
            return;
          }

          // Session exists or guest mode, navigating to protected area
          hasCompletedInitialNavigation.current = true;
          const postAuthPath = postAuthNavigationRef.current;
          if (postAuthPath) {
            postAuthNavigationRef.current = null;
            router.replace(postAuthPath as any);
          } else {
            router.replace("/(protected)/(tabs)");
          }
        } else {
          // CRITICAL: Only navigate to /welcome on initial app load
          // Sign-out navigation is handled by the protected layout to avoid double animation
          if (hasCompletedInitialNavigation.current) {
            // Initial navigation already done, skip - protected layout handles sign-out redirect
            return;
          }

          const activeDeepLinkPath = statusBeforeNavigation.activePath;
          const shouldPreservePublicDeepLink =
            activeDeepLinkPath !== null &&
            !activeDeepLinkPath.startsWith("/(protected)/") &&
            activeDeepLinkPath !== "/welcome";

          if (shouldPreservePublicDeepLink) {
            // Public deeplink (sign-in, legal, help, etc.) is active, avoid overriding it
            return;
          }

          // No session and not guest, navigating to welcome (initial load only)
          hasCompletedInitialNavigation.current = true;
          router.replace("/welcome");
        }
      } catch (error) {
        // Navigation error (will auto-recover)

        // SILENT fallback navigation - never throw errors to UI
        const attemptFallbackNavigation = (attempt = 1) => {
          const maxAttempts = 5; // Increased attempts for more reliability
          const delay = Platform.OS === "android" ? attempt * 800 : 300;

          setTimeout(() => {
            try {
              // Silent fallback navigation attempt

              if (!router || typeof router.replace !== "function") {
                if (attempt < maxAttempts) {
                  // Router still not ready, retrying silently
                  attemptFallbackNavigation(attempt + 1);
                  return;
                } else {
                  // Router unavailable after all attempts - user will see loading
                  return;
                }
              }

              try {
                if (session || isGuest) {
                  if (hasCompletedInitialNavigation.current && !postAuthNavigationRef.current) {
                    return;
                  }
                  hasCompletedInitialNavigation.current = true;
                  const postAuthPath = postAuthNavigationRef.current;
                  if (postAuthPath) {
                    postAuthNavigationRef.current = null;
                    router.replace(postAuthPath as any);
                  } else {
                    router.replace("/(protected)/(tabs)");
                  }
                  // Silent fallback navigation to tabs successful
                } else if (!hasCompletedInitialNavigation.current) {
                  // Only navigate to welcome on initial load, not on sign-out
                  hasCompletedInitialNavigation.current = true;
                  router.replace("/welcome");
                  // Silent fallback navigation to welcome successful
                }
              } catch (fallbackError) {
                // Silent fallback navigation attempt failed (continuing)

                if (attempt < maxAttempts) {
                  attemptFallbackNavigation(attempt + 1);
                } else {
                  // All silent fallback attempts completed - user will see loading
                }
              }
            } catch (outerError) {
              // Outer error in fallback attempt
              if (attempt < maxAttempts) {
                attemptFallbackNavigation(attempt + 1);
              }
            }
          }, delay);
        };

        attemptFallbackNavigation();
      } finally {
        // Always release the navigation lock after a delay
        setTimeout(() => {
          navigationInProgress.current = false;
        }, 500);
      }
    };

    // Platform-specific timeout - Android needs more time
    const initialTimeout = Platform.OS === "android" ? 500 : 300;
    const timeout = setTimeout(navigate, initialTimeout);

    return () => {
      clearTimeout(timeout);
      // Release navigation lock on cleanup
      navigationInProgress.current = false;
    };
  }, [initialized, session, isGuest, router]);

  const authValue = useMemo(
    () => ({
      initialized,
      databaseReady,
      session,
      user,
      profile,
      isGuest,
      signUp,
      signIn,
      signOut,
      updateProfile,
      refreshProfile,
      appleSignIn,
      googleSignIn,
      continueAsGuest,
      convertGuestToUser,
      setSkipCompleteProfileRedirect,
      consumeSkipCompleteProfileRedirect,
      setPostAuthNavigation,
    }),
    [
      initialized,
      databaseReady,
      session,
      user,
      profile,
      isGuest,
      signUp,
      signIn,
      signOut,
      updateProfile,
      refreshProfile,
      appleSignIn,
      googleSignIn,
      continueAsGuest,
      convertGuestToUser,
      setSkipCompleteProfileRedirect,
      consumeSkipCompleteProfileRedirect,
      setPostAuthNavigation,
    ],
  );

  return (
    <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
  );
}

export function AuthProvider({ children }: PropsWithChildren) {
  return <AuthContent>{children}</AuthContent>;
}
