import * as z from "zod";

/**
 * Password policy for the customer mobile app.
 *
 * This MUST stay in lock-step with the Supabase project's native
 * password policy (`password_min_length` + `password_required_characters`
 * at /v1/projects/{ref}/config/auth), because the backend is the hard
 * floor and will return HTTP 422 `weak_password` to any signup / password
 * update request that violates it — regardless of what the client did.
 *
 * Remote values applied on 2026-04-21 (pentest W09 remediation):
 *   password_min_length          = 8
 *   password_required_characters = "abcdefghijklmnopqrstuvwxyz
 *                                   :ABCDEFGHIJKLMNOPQRSTUVWXYZ
 *                                   :0123456789"
 *
 * This equals: min 8 chars, at least one lowercase, one uppercase, one
 * digit. Deliberately NOT requiring symbols — keeps customer passwords
 * memorable (Mydog2024, Pizza123, Hello2024 all pass).
 *
 * The staff web app uses a stricter bar (12 + symbol) in its UI only;
 * the backend gate for every client is the same minimum enforced here.
 */

export const PASSWORD_MIN_LENGTH = 8;
// bcrypt (Supabase's hashing algo) has a hard 72-byte ceiling — anything
// past 72 is silently truncated server-side, so we reject up-front.
export const PASSWORD_MAX_LENGTH = 72;

export const PASSWORD_REQUIREMENTS: readonly string[] = [
  `At least ${PASSWORD_MIN_LENGTH} characters`,
  "At least one lowercase letter",
  "At least one uppercase letter",
  "At least one digit",
];

const HAS_LOWER = /[a-z]/;
const HAS_UPPER = /[A-Z]/;
const HAS_DIGIT = /\d/;
const HAS_SYMBOL = /[^A-Za-z0-9]/;

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Imperative validator — use on any server action / edge function that
 * sets a password, and for the strength indicator's reason text.
 */
export function validatePasswordStrength(pw: unknown): PasswordPolicyResult {
  if (typeof pw !== "string") {
    return { ok: false, reason: "Password is required" };
  }
  if (pw.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      reason: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    };
  }
  if (pw.length > PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      reason: `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
    };
  }
  if (!HAS_LOWER.test(pw))
    return {
      ok: false,
      reason: "Password must contain at least one lowercase letter",
    };
  if (!HAS_UPPER.test(pw))
    return {
      ok: false,
      reason: "Password must contain at least one uppercase letter",
    };
  if (!HAS_DIGIT.test(pw))
    return { ok: false, reason: "Password must contain at least one digit" };
  return { ok: true };
}

/**
 * Zod field schema — drop into any `z.object({ password: ... })` form.
 * Error messages match the strings the backend surfaces so users see a
 * consistent error whether validation hits locally or on the server.
 */
export const passwordFieldSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
  )
  .max(
    PASSWORD_MAX_LENGTH,
    `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`,
  )
  .refine(
    (v) => HAS_LOWER.test(v),
    "Password must contain at least one lowercase letter.",
  )
  .refine(
    (v) => HAS_UPPER.test(v),
    "Password must contain at least one uppercase letter.",
  )
  .refine(
    (v) => HAS_DIGIT.test(v),
    "Password must contain at least one digit.",
  );

/** Returns true when the password has a symbol — used only to bump the
 *  strength meter UI from "medium" to "strong"; never enforced. */
export function hasSymbol(pw: string): boolean {
  return HAS_SYMBOL.test(pw);
}
