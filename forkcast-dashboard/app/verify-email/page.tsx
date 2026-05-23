"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { CheckCircle, Sparkles, ArrowRight, Clock, XCircle, Loader2 } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Suspense } from "react"

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  const token = searchParams.get('token')
  const type = searchParams.get('type')

  useEffect(() => {
    async function checkVerificationStatus() {
      const supabase = createClient()

      try {
        // Check if user is now authenticated (meaning verification succeeded)
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError) {
          console.error('Auth error:', userError)
          setStatus('error')
          setErrorMessage('Failed to check authentication status')
          return
        }

        if (user) {
          // User is authenticated - verification was successful!
          console.log('Email verification successful:', user.email)
          setStatus('success')

          // Small delay to show success state, then redirect
          setTimeout(() => {
            // Don't use router.push, use window.location for proper session handling
            window.location.href = '/bookings'
          }, 2000)
        } else {
          // If we have a token, try to verify it directly (fallback)
          if (token) {
            console.log('Attempting direct token verification...')

            const { data, error } = await supabase.auth.verifyOtp({
              token_hash: token,
              type: type === 'signup' ? 'signup' : 'email'
            })

            if (error) {
              console.error('Direct verification error:', error)
              setStatus('error')
              setErrorMessage(error.message || 'Failed to verify email')
              return
            }

            if (data.user) {
              console.log('Direct verification successful:', data.user.email)
              setStatus('success')
              setTimeout(() => {
                window.location.href = '/bookings'
              }, 2000)
            } else {
              setStatus('error')
              setErrorMessage('Verification completed but no user found')
            }
          } else {
            // No token and no authenticated user - likely an error case
            setStatus('error')
            setErrorMessage('Email verification failed. The link may be expired or invalid.')
          }
        }

      } catch (error: any) {
        console.error('Verification check error:', error)
        setStatus('error')
        setErrorMessage(error.message || 'Unexpected error during verification')
      }
    }

    checkVerificationStatus()
  }, [token, type])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-lg border-2 shadow-xl backdrop-blur-md bg-white/95 border-blue-200">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 border-4 border-blue-200">
              <Loader2 className="h-6 w-6 text-blue-600 motion-safe:animate-spin" />
            </div>
            <CardTitle className="text-2xl font-bold text-blue-800">
              Verifying Email...
            </CardTitle>
            <CardDescription className="text-lg text-blue-700">
              Please wait while we confirm your email address
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-green-50 to-emerald-100">
        <Card className="w-full max-w-lg border-2 shadow-xl backdrop-blur-md bg-white/95 border-green-200">
          <CardHeader className="text-center space-y-4">
            <div className="relative mx-auto">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 border-4 border-green-200">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="absolute -top-1 -right-1">
                <Sparkles className="h-5 w-5 text-yellow-500 motion-safe:animate-pulse" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-green-800">
              🎉 Email Verified!
            </CardTitle>
            <CardDescription className="text-lg text-green-700">
              Your email has been successfully confirmed. Welcome to Forkcast!
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <h3 className="font-semibold text-green-800 mb-2">✅ Account Activated</h3>
              <p className="text-sm text-green-700">
                Your account is now fully activated. Redirecting to dashboard...
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-center text-gray-800">What happens next?</h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full text-sm flex items-center justify-center font-semibold">
                    1
                  </div>
                  <div className="text-sm">
                    <p className="font-medium text-blue-800">Access Dashboard</p>
                    <p className="text-blue-600">You'll be redirected to your dashboard automatically</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                  <div className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full text-sm flex items-center justify-center font-semibold">
                    2
                  </div>
                  <div className="text-sm">
                    <p className="font-medium text-purple-800">Restaurant Setup</p>
                    <p className="text-purple-600">Our team will contact you within 24-48 hours to set up your restaurant</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">Full Access Pending</p>
                    <p className="text-amber-600">Complete dashboard access after restaurant verification</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3 pt-6">
            <Button asChild className="w-full" size="sm">
              <Link href="/bookings">
                <ArrowRight className="mr-2 h-4 w-4" />
                Go to Dashboard Now
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-red-50 to-orange-100">
      <Card className="w-full max-w-lg border-2 shadow-xl backdrop-blur-md bg-white/95 border-red-200">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 border-4 border-red-200">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-red-800">
            Verification Failed
          </CardTitle>
          <CardDescription className="text-lg text-red-700">
            We couldn't verify your email address
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
            <h3 className="font-semibold text-red-800 mb-2">❌ Error Details</h3>
            <p className="text-sm text-red-700">
              {errorMessage}
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-center text-gray-800">What you can do:</h3>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full text-sm flex items-center justify-center font-semibold">
                  1
                </div>
                <div className="text-sm">
                  <p className="font-medium text-blue-800">Try Signing Up Again</p>
                  <p className="text-blue-600">Get a fresh confirmation email</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                <div className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full text-sm flex items-center justify-center font-semibold">
                  2
                </div>
                <div className="text-sm">
                  <p className="font-medium text-purple-800">Use Forgot Password</p>
                  <p className="text-purple-600">Get a password reset link that also verifies your email</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3 pt-6">
          <Button asChild className="w-full" size="sm">
            <Link href="/signup">
              <ArrowRight className="mr-2 h-4 w-4" />
              Sign Up Again
            </Link>
          </Button>

          <Button asChild variant="outline" className="w-full">
            <Link href="/login">
              Go to Login
            </Link>
          </Button>

         
        </CardFooter>
      </Card>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="motion-safe:animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
