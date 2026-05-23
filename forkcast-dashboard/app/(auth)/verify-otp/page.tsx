"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { OTPInput } from "@/components/auth/otp-input"
import { toast } from "react-hot-toast"
import { Loader2, Mail, ArrowLeft, RefreshCw } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"

function VerifyOTPContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [otp, setOtp] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const supabase = createClient()

  const email = searchParams.get("email")

  useEffect(() => {
    if (!email) {
      toast.error("Email address is required")
      router.push("/signup")
    }
  }, [email, router])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter the complete 6-digit code")
      return
    }

    if (!email) {
      toast.error("Email address is missing")
      return
    }

    try {
      setIsVerifying(true)

      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "signup",
      })

      if (error) {
        console.error("OTP verification error:", error)

        if (error.message.includes("expired")) {
          toast.error("This code has expired. Please request a new one.")
        } else if (error.message.includes("invalid")) {
          toast.error("Invalid code. Please check and try again.")
        } else {
          toast.error("Failed to verify code. Please try again.")
        }

        // Clear OTP on error
        setOtp("")
        return
      }

      if (data.user) {
        toast.success("Email verified successfully!")

        // Small delay to show success toast
        setTimeout(() => {
          window.location.href = "/bookings"
        }, 1000)
      }
    } catch (error: any) {
      console.error("Verification error:", error)
      toast.error("An unexpected error occurred")
      setOtp("")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResendCode = async () => {
    if (!email) {
      toast.error("Email address is missing")
      return
    }

    if (countdown > 0) {
      toast.error(`Please wait ${countdown} seconds before resending`)
      return
    }

    try {
      setIsResending(true)

      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
      const baseUrl = appUrl || window.location.origin
      const emailRedirectTo = `${baseUrl.replace(/\/$/, "")}/verify-otp`

      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo },
      })

      if (error) {
        console.error("Resend error:", error)
        if (error.message?.toLowerCase().includes("rate limit") || error.message?.toLowerCase().includes("over_email_send_rate_limit")) {
          toast.error("Too many attempts. Please wait a few minutes before requesting a new code.")
        } else {
          toast.error("Failed to resend code. Please try again.")
        }
        return
      }

      toast.success("A new verification code has been sent to your email")
      setCountdown(60) // 60 second cooldown
      setOtp("") // Clear current OTP
    } catch (error: any) {
      console.error("Resend error:", error)
      toast.error("An unexpected error occurred")
    } finally {
      setIsResending(false)
    }
  }

  // Auto-verify when OTP is complete
  useEffect(() => {
    if (otp.length === 6 && !isVerifying) {
      handleVerifyOTP()
    }
  }, [otp])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-2 shadow-xl backdrop-blur-md bg-white/20 border-white/30">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Verify Your Email
          </CardTitle>
          <CardDescription className="text-white text-base">
            We've sent a 6-digit verification code to
            <div className="font-semibold text-white mt-1">{email}</div>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-4">
            <OTPInput
              length={6}
              value={otp}
              onChange={setOtp}
              disabled={isVerifying}
            />

            <div className="text-center text-sm text-white">
              <p className="flex items-center justify-center gap-1">
                <span className="inline-block w-2 h-2 bg-amber-500 rounded-full motion-safe:animate-pulse" />
                Code expires in <strong>10 minutes</strong>
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleVerifyOTP}
              disabled={otp.length !== 6 || isVerifying}
              className="w-full"
              size="sm"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Code"
              )}
            </Button>

            <div className="text-center text-sm">
              <p className="text-white mb-2">Didn't receive the code?</p>
              <Button
                variant="outline"
                onClick={handleResendCode}
                disabled={countdown > 0 || isResending}
                className="w-full"
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                    Sending...
                  </>
                ) : countdown > 0 ? (
                  `Resend in ${countdown}s`
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resend Code
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t text-center">
            <Button variant="ghost" asChild className="text-white">
              <Link href="/signup">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sign Up
              </Link>
            </Button>
          </div>

         
        </CardContent>
      </Card>
    </div>
  )
}

export default function VerifyOTPPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="motion-safe:animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    }>
      <VerifyOTPContent />
    </Suspense>
  )
}
