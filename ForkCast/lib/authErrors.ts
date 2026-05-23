/**
 * Centralized Supabase auth error → user-friendly message mapper.
 *
 * Replaces ad-hoc `error.message?.includes(...)` chains scattered across
 * sign-in, sign-up, OTP, password-reset, and forgot-password screens.
 *
 * Goals:
 *  - Consistent, friendly copy regardless of which screen surfaces the error.
 *  - Never leak raw Supabase / Postgres / network error strings to the user.
 *  - Map known patterns (rate limit, weak password, invalid OTP, expired
 *    token, network failure, conflicts) to a stable error code so callers
 *    can drive UI behaviour (e.g. show resend button on EXPIRED_TOKEN).
 *
 * The mapper is intentionally pure: no I/O, no React. Easily unit-tested.
 */

export type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_CONFIRMED"
  | "EMAIL_ALREADY_EXISTS"
  | "PHONE_ALREADY_EXISTS"
  | "WEAK_PASSWORD"
  | "RATE_LIMITED"
  | "INVALID_OTP"
  | "EXPIRED_TOKEN"
  | "NETWORK_OFFLINE"
  | "PROVIDER_CANCELLED"
  | "USER_NOT_FOUND"
  | "PASSWORD_MISMATCH"
  | "GENERIC";

export interface MappedAuthError {
  code: AuthErrorCode;
  /** Title for Alert.alert() */
  title: string;
  /** Body text for Alert.alert() / inline display */
  message: string;
  /** True when the user can meaningfully retry (e.g. resend OTP, retry sign-in). */
  retryable: boolean;
}

const GENERIC: MappedAuthError = {
  code: "GENERIC",
  title: "Something went wrong",
  message: "Please try again. If the problem persists, contact support.",
  retryable: true,
};

/** Lower-cased haystack with safe fallback for non-string error inputs. */
function toLowerMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error.toLowerCase();
  if (error instanceof Error) return (error.message || "").toLowerCase();
  if (typeof error === "object" && "message" in (error as any)) {
    const m = (error as { message?: unknown }).message;
    return typeof m === "string" ? m.toLowerCase() : "";
  }
  return "";
}

/**
 * Map any thrown error from the Supabase auth surface to a stable, friendly
 * error descriptor. Order matters: more specific patterns first, generic
 * network last (network errors often masquerade as other things).
 */
export function mapAuthError(error: unknown): MappedAuthError {
  const msg = toLowerMessage(error);
  if (!msg) return GENERIC;

  // --- User-driven cancellations (don't surface as errors at the call site,
  //     but include here so callers can detect & swallow consistently). ---
  if (
    msg.includes("user canceled") ||
    msg.includes("user cancelled") ||
    msg.includes("err_request_canceled")
  ) {
    return {
      code: "PROVIDER_CANCELLED",
      title: "Sign-in cancelled",
      message: "You cancelled the sign-in. Try again whenever you're ready.",
      retryable: true,
    };
  }

  // --- Network / offline. Check before "invalid" patterns: a flaky network
  //     can produce "fetch failed" / "Network request failed" errors. ---
  if (
    msg.includes("network request failed") ||
    msg.includes("fetch failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("network error") ||
    msg.includes("typeerror: network")
  ) {
    return {
      code: "NETWORK_OFFLINE",
      title: "No internet connection",
      message:
        "We can't reach our servers. Please check your connection and try again.",
      retryable: true,
    };
  }

  // --- Rate limiting (Supabase + custom RateLimiter). ---
  if (
    msg.includes("too many requests") ||
    msg.includes("rate limit") ||
    msg.includes("rate-limit") ||
    msg.includes("rate exceeded")
  ) {
    return {
      code: "RATE_LIMITED",
      title: "Too many attempts",
      message:
        "You've tried too many times in a short window. Please wait a minute and try again.",
      retryable: true,
    };
  }

  // --- Sign-in specific. ---
  if (
    msg.includes("invalid login credentials") ||
    msg.includes("invalid credentials") ||
    msg.includes("invalid_grant")
  ) {
    return {
      code: "INVALID_CREDENTIALS",
      title: "Invalid email or password",
      message:
        "We couldn't sign you in with those details. Double-check and try again.",
      retryable: true,
    };
  }

  if (msg.includes("email not confirmed")) {
    return {
      code: "EMAIL_NOT_CONFIRMED",
      title: "Confirm your email",
      message:
        "Check your inbox for the confirmation email before signing in.",
      retryable: false,
    };
  }

  // --- Sign-up conflicts. ---
  if (
    msg.includes("user already registered") ||
    msg.includes("already exists") ||
    msg.includes("already been registered") ||
    msg.includes("duplicate key") ||
    msg.includes("email_exists")
  ) {
    if (msg.includes("phone")) {
      return {
        code: "PHONE_ALREADY_EXISTS",
        title: "Phone already in use",
        message:
          "An account already uses this phone number. Sign in instead, or use a different number.",
        retryable: false,
      };
    }
    return {
      code: "EMAIL_ALREADY_EXISTS",
      title: "Account already exists",
      message:
        "An account with this email already exists. Try signing in or resetting your password.",
      retryable: false,
    };
  }

  // --- Password validation surfaced from the backend. ---
  if (
    msg.includes("weak_password") ||
    msg.includes("password should be at least") ||
    msg.includes("password is too weak") ||
    msg.includes("password does not meet")
  ) {
    return {
      code: "WEAK_PASSWORD",
      title: "Choose a stronger password",
      message:
        "Use at least 8 characters with an uppercase, lowercase, and a number.",
      retryable: true,
    };
  }

  // --- OTP / token. Expired must come before generic "invalid". ---
  if (
    msg.includes("token has expired") ||
    msg.includes("otp expired") ||
    msg.includes("expired") ||
    msg.includes("link is invalid or has expired")
  ) {
    return {
      code: "EXPIRED_TOKEN",
      title: "Code expired",
      message: "That code has expired. Request a new one and try again.",
      retryable: true,
    };
  }

  if (
    msg.includes("invalid otp") ||
    msg.includes("invalid token") ||
    msg.includes("token_not_found") ||
    msg.includes("otp_disabled") ||
    msg.includes("invalid verification code")
  ) {
    return {
      code: "INVALID_OTP",
      title: "Incorrect code",
      message:
        "That code doesn't match. Double-check and try again, or request a new one.",
      retryable: true,
    };
  }

  if (
    msg.includes("user not found") ||
    msg.includes("no user found") ||
    msg.includes("user_not_found")
  ) {
    return {
      code: "USER_NOT_FOUND",
      title: "Account not found",
      message:
        "We couldn't find an account with those details. Check your input or sign up.",
      retryable: false,
    };
  }

  if (
    msg.includes("passwords do not match") ||
    msg.includes("password mismatch")
  ) {
    return {
      code: "PASSWORD_MISMATCH",
      title: "Passwords don't match",
      message: "Make sure both password fields are identical.",
      retryable: true,
    };
  }

  return GENERIC;
}

/**
 * True when the underlying error indicates the user (or system) cancelled
 * the OAuth flow — caller should swallow silently rather than alert.
 */
export function isProviderCancellation(error: unknown): boolean {
  return mapAuthError(error).code === "PROVIDER_CANCELLED";
}
