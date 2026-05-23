"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { toast } from "react-hot-toast"
import { Loader2, ArrowRight, AlertCircle, ShieldAlert } from "lucide-react"
import { MfaVerificationForm } from "@/components/admin/mfa-verification-form"
import { TurnstileWidget } from "@/components/auth/turnstile-widget"

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password must be at least 1 characters"),
})

type FormData = z.infer<typeof formSchema>

function formatLockoutCountdown(seconds: number): string {
  if (seconds <= 0) return ""
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [showMfaVerification, setShowMfaVerification] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  // Lockout / CAPTCHA state — populated by /api/auth/login-precheck.
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0)
  const [requiresCaptcha, setRequiresCaptcha] = useState(false)
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const supabase = createClient()

  const redirectTo = searchParams.get('redirectTo') || '/bookings'
  const error = searchParams.get('error')

  // If the user was redirected here because they have 2FA enabled but their
  // session is still at AAL1 (e.g. they navigated to /admin directly after a
  // password-only login), show the MFA challenge form straight away instead
  // of making them re-enter their credentials.
  useEffect(() => {
    const checkExistingSession = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch AAL, factors, and admin status in parallel
      const [
        { data: aalData },
        { data: factorsData },
        { data: adminData },
      ] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
        supabase.from('rbs_admins').select('id, user_id').eq('user_id', user.id).single(),
      ])
      const hasVerifiedFactors = factorsData?.totp?.some((f) => f.status === 'verified') || false

      if (hasVerifiedFactors && aalData?.currentLevel === 'aal1') {
        setIsAdmin(!!(adminData))
        setShowMfaVerification(true)
      }
    }
    checkExistingSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  // Live countdown for the lockout window.
  useEffect(() => {
    if (lockoutSecondsLeft <= 0) return
    const t = setInterval(() => {
      setLockoutSecondsLeft((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [lockoutSecondsLeft])

  async function preflight(email: string): Promise<{ ok: boolean }> {
    try {
      const res = await fetch("/api/auth/login-precheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        // Soft-fail: do not block login on precheck infra errors.
        return { ok: true }
      }
      const json = await res.json()
      setTurnstileSiteKey(json.turnstile_site_key ?? null)
      setRequiresCaptcha(!!json.requires_captcha)
      if (json.locked) {
        setLockoutSecondsLeft(Number(json.seconds_until_unlock) || 60)
        return { ok: false }
      }
      // If CAPTCHA is required but the user hasn't completed it yet, block.
      if (json.requires_captcha && json.turnstile_site_key && !captchaToken) {
        toast.error("Please complete the security check before signing in.")
        return { ok: false }
      }
      return { ok: true }
    } catch {
      return { ok: true }
    }
  }

  async function recordFailure(email: string, reason: string) {
    try {
      const res = await fetch("/api/auth/record-failure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, reason, captcha_token: captchaToken }),
      })
      if (res.ok) {
        const json = await res.json()
        if (json.lock_duration_seconds && json.lock_duration_seconds > 0) {
          setLockoutSecondsLeft(json.lock_duration_seconds)
        }
        // Re-evaluate captcha requirement after a fail.
        if (typeof json.fail_count === "number" && json.fail_count >= 2) {
          setRequiresCaptcha(true)
        }
      }
    } catch {
      /* swallow — failure logging is best-effort */
    }
    setCaptchaToken(null)
  }

  async function recordSuccess(email: string) {
    try {
      await fetch("/api/auth/record-success", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
    } catch {
      /* best-effort */
    }
  }

  async function onSubmit(data: FormData) {
    try {
      setIsLoading(true)

      const pf = await preflight(data.email)
      if (!pf.ok) {
        setIsLoading(false)
        return
      }

      // Sign in with email and password. Pass captchaToken when present so
      // Supabase GoTrue can verify it server-side (requires GOTRUE_CAPTCHA_*
      // env vars on the Supabase project — see lockout audit doc).
      console.debug('[Auth] Attempting signInWithPassword for', data.email, { hasCaptcha: !!captchaToken })
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
        ...(captchaToken ? { options: { captchaToken } } : {}),
      })
      console.debug('[Auth] signInWithPassword response', { authData, authError })

      if (authError) {
        // Fire-and-forget: don't block the user-visible error toast on the
        // lockout-bookkeeping round-trip.
        recordFailure(data.email, authError.message ?? "unknown")
        throw authError
      }

      if (!authData.user) {
        recordFailure(data.email, "no_user_returned")
        throw new Error("Login failed")
      }

      // Fire-and-forget: clear failed-login counter (analytics, no need to block)
      recordSuccess(data.email)

      // Run all three post-auth checks in parallel
      const [
        { data: aalData },
        { data: factorsData },
        { data: adminData, error: adminError },
      ] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
        supabase.from("rbs_admins").select("id, user_id").eq("user_id", authData.user.id).single(),
      ])

      const hasVerifiedFactors = factorsData?.totp?.some((f) => f.status === "verified") || false
      const userIsAdmin = adminData && !adminError

      // If user has MFA enabled but hasn't verified yet (AAL1 but has factors)
      if (hasVerifiedFactors && aalData?.currentLevel === "aal1") {
        setIsAdmin(userIsAdmin)
        setShowMfaVerification(true)
        setIsLoading(false)
        return
      }

      // If no MFA or already verified (AAL2), proceed with normal login
      await handleSuccessfulLogin(authData.user.id, userIsAdmin)
    } catch (error: any) {
      console.error("Login error:", error)
      const msg =
        typeof error?.message === "string" && error.message.length > 0
          ? error.message
          : "Failed to login"
      toast.error(msg)
      setIsLoading(false)
    }
  }

  async function handleSuccessfulLogin(userId: string, userIsAdmin: boolean) {
    try {
      if (userIsAdmin) {
        toast.success("Welcome back, Admin!")
        window.location.href = "/bookings"
        return
      }

      // Check if user has restaurant access (as staff or creator)
      const { data: staffData, error: staffError } = await supabase
        .from("restaurant_staff")
        .select(`
          id,
          role,
          restaurant_id,
          restaurant:restaurants(id, name)
        `)
        .eq("user_id", userId)
        .eq("is_active", true)

      // Also check if user created any restaurants
      const { data: createdRestaurants, error: creatorError } = await supabase
        .from("restaurants")
        .select(`
          id,
          name
        `)
        .eq("created_by", userId)

      const hasStaffAccess = staffData && staffData.length > 0
      const hasCreatorAccess = createdRestaurants && createdRestaurants.length > 0

      if (!hasStaffAccess && !hasCreatorAccess) {
        await supabase.auth.signOut()
        throw new Error("You don't have access to any restaurant. Please contact your restaurant owner or create a restaurant.")
      }

      if ((staffData?.length || 0) + (createdRestaurants?.length || 0) === 1) {
        const singleRestaurant = staffData?.[0] || createdRestaurants?.[0]
        const restaurantName = (staffData?.[0]?.restaurant as any)?.name || createdRestaurants?.[0]?.name
        const role = (staffData?.[0]?.role) || 'owner'
        // Fire-and-forget metadata update — doesn't affect session or auth
        supabase.auth.updateUser({
          data: {
            restaurant_id: (singleRestaurant as any)?.id || (singleRestaurant as any)?.restaurant_id,
            restaurant_name: restaurantName,
            role: role,
          },
        })
        toast.success(`Welcome back! Logging in to ${restaurantName}`)
      } else {
        toast.success(`Welcome back! You have access to ${(staffData?.length || 0) + (createdRestaurants?.length || 0)} restaurants.`)
      }

      window.location.href = "/bookings"
    } catch (error: any) {
      console.error("Post-login error:", error)
      const msg =
        typeof error?.message === "string" && error.message.length > 0
          ? error.message
          : "Failed to complete login"
      toast.error(msg)
    }
  }

  async function handleMfaVerified() {
    try {
      setIsLoading(true)

      // Get current user after MFA verification
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("User not found after MFA verification")
      }

      await handleSuccessfulLogin(user.id, isAdmin)
    } catch (error: any) {
      console.error("MFA post-verification error:", error)
      const msg =
        typeof error?.message === "string" && error.message.length > 0
          ? error.message
          : "Failed to complete login"
      toast.error(msg)
      setIsLoading(false)
    }
  }

  function handleMfaCancelled() {
    // Sign out and reset to login screen
    supabase.auth.signOut()
    setShowMfaVerification(false)
    setIsAdmin(false)
    // `react-hot-toast` has no `.info` — calling it throws TypeError and the
    // toast container then falls back to rendering the empty error object.
    toast("Login cancelled")
  }

  // Show MFA verification screen if needed
  if (showMfaVerification) {
    return (
      <MfaVerificationForm
        onVerified={handleMfaVerified}
        onCancel={handleMfaCancelled}
      />
    )
  }

  const errorMessages: Record<string, string> = {
    no_access: "You don't have access to any restaurant. Please contact your restaurant owner.",
    admin_access_required: "Admin access required to view this page. Please log in with an admin account.",
    mfa_required: "Two-factor authentication is required to access the admin panel. Please complete your MFA verification.",
    auth_error: "There was an authentication error. Please try logging in again or request a new confirmation email if your account is unverified.",
    expired: 'Your confirmation link has expired. Please use "Forgot Password" below to get a new confirmation email.',
    invalid: 'The confirmation link was invalid or already used. Try logging in or request a new confirmation email using "Forgot Password".',
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground">
          Sign in to access your restaurant dashboard
        </p>
      </div>

      {/* Error alerts */}
      {error && errorMessages[error] && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessages[error]}</AlertDescription>
        </Alert>
      )}

      {/* Account-lockout banner */}
      {lockoutSecondsLeft > 0 && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Too many failed attempts. This account is temporarily locked.
            Try again in <strong>{formatLockoutCountdown(lockoutSecondsLeft)}</strong>.
          </AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Email address</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@restaurant.com"
                    disabled={isLoading}
                    className="h-11"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="text-sm font-medium">Password</FormLabel>
                 
                </div>
                <FormControl>
                  <PasswordInput
                    placeholder="••••••••"
                    disabled={isLoading}
                    className="h-11"
                    {...field}
                  />
                  
                </FormControl>
                 <Link
                    href="/forgot-password"
                    className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    Forgot password?
                  </Link>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="w-full h-11 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            disabled={
              isLoading ||
              lockoutSecondsLeft > 0 ||
              (requiresCaptcha && !!turnstileSiteKey && !captchaToken)
            }
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>

          {requiresCaptcha && turnstileSiteKey && (
            <div className="flex justify-center pt-1">
              <TurnstileWidget
                siteKey={turnstileSiteKey}
                onToken={(t) => setCaptchaToken(t)}
              />
            </div>
          )}
        </form>
      </Form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            New to Forkcast?
          </span>
        </div>
      </div>

      {/* Sign up link */}
      <div className="text-center">
        <Link
          href="/signup"
          className="inline-flex items-center justify-center w-full h-11 rounded-md border border-input bg-background px-4 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Create an account
        </Link>
      </div>

      
    </div>
  )
}
