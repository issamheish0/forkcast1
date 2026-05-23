"use client"

import Link from "next/link"
import { CheckCircle, Sparkles, ArrowRight, Clock } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function EmailConfirmedPage() {
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
              Your account is now fully activated and ready to use. You can access all features of the Forkcast restaurant management system.
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
                  <p className="font-medium text-blue-800">Sign in to your account</p>
                  <p className="text-blue-600">Use your email and password to access the dashboard</p>
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
                  <p className="font-medium text-amber-800">Access Pending</p>
                  <p className="text-amber-600">Full dashboard access will be granted after restaurant verification</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3 pt-6">
          <Button asChild className="w-full" size="sm">
            <Link href="/login">
              <ArrowRight className="mr-2 h-4 w-4" />
              Sign In to Your Account
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
