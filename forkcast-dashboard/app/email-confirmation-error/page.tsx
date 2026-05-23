"use client"

import Link from "next/link"
import { XCircle, RefreshCw, Mail, ArrowRight } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function EmailConfirmationErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const getErrorMessage = (errorType: string | null) => {
    switch (errorType) {
      case 'expired':
        return {
          title: "Link Expired",
          message: "This confirmation link has expired. Please request a new one.",
          showResend: true
        }
      case 'invalid':
        return {
          title: "Invalid Link",
          message: "This confirmation link is invalid or has already been used.",
          showResend: true
        }
      case 'auth_error':
        return {
          title: "Authentication Error",
          message: "There was an error confirming your email. Please try again.",
          showResend: true
        }
      default:
        return {
          title: "Confirmation Failed",
          message: "We couldn't confirm your email address. This might be due to an expired or invalid link.",
          showResend: true
        }
    }
  }

  const errorInfo = getErrorMessage(error)

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-red-50 to-orange-100">
      <Card className="w-full max-w-lg border-2 shadow-xl backdrop-blur-md bg-white/95 border-red-200">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 border-4 border-red-200">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-red-800">
            {errorInfo.title}
          </CardTitle>
          <CardDescription className="text-lg text-red-700">
            {errorInfo.message}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
            <h3 className="font-semibold text-red-800 mb-2">❌ Email Not Confirmed</h3>
            <p className="text-sm text-red-700">
              Your email address has not been verified yet. You'll need to confirm your email before accessing your account.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-center text-gray-800">What you can do:</h3>

            <div className="space-y-3">
              {errorInfo.showResend && (
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                  <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-800">Request New Confirmation Email</p>
                    <p className="text-blue-600">Go to the login page and use "Forgot Password" to get a new confirmation link</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                <RefreshCw className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-purple-800">Try Again</p>
                  <p className="text-purple-600">If you have another confirmation email, try clicking that link</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                <div className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full text-sm flex items-center justify-center font-semibold">
                  ?
                </div>
                <div className="text-sm">
                  <p className="font-medium text-amber-800">Need Help?</p>
                  <p className="text-amber-600">Contact our support team if you continue having issues</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3 pt-6">
          <Button asChild className="w-full" size="sm">
            <Link href="/login">
              <ArrowRight className="mr-2 h-4 w-4" />
              Go to Login
            </Link>
          </Button>

          <Button asChild variant="outline" className="w-full">
            <Link href="/signup">
              <RefreshCw className="mr-2 h-4 w-4" />
              Sign Up Again
            </Link>
          </Button>

          <div className="text-center text-xs text-gray-500">
            Need help? Contact us at{" "}
            <a href="mailto:support@plate-app.com" className="text-blue-600 hover:underline">
              support@plate-app.com
            </a>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function EmailConfirmationErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="motion-safe:animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    }>
      <EmailConfirmationErrorContent />
    </Suspense>
  )
}
