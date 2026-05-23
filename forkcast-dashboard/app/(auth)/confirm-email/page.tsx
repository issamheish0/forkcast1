"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, CheckCircle, Clock, ArrowRight } from "lucide-react"

export default function ConfirmEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-2 shadow-xl backdrop-blur-md bg-white/20 border-white/30">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
          <CardDescription className="text-white">
            We've sent you a 6-digit verification code to verify your email address.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-200 shrink-0" />
              <div className="text-sm text-white">
                <p className="font-medium">Account Created Successfully</p>
                <p className="text-white">Your account has been created and is waiting for code verification.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="text-sm text-primary">
                <p className="font-medium">Restaurant Setup Pending</p>
                <p className="text-muted-foreground">The Forkcast team will contact you within 24-48 hours to set up your restaurant account and provide access credentials.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-center">Next Steps:</h3>
            <ol className="space-y-2 text-sm text-white">
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center font-semibold">1</span>
                <span>Check your email and enter the 6-digit verification code</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center font-semibold">2</span>
                <span>Wait for the Forkcast team to contact you</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center font-semibold">3</span>
                <span>Receive your restaurant access credentials</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center font-semibold">4</span>
                <span>Start managing your restaurant with Forkcast</span>
              </li>
            </ol>
          </div>

          <div className="space-y-3 pt-4">
            <Button asChild className="w-full" size="sm">
              <Link href="/verify-otp">
                <ArrowRight className="mr-2 h-4 w-4" />
                Go to Verification
              </Link>
            </Button>

            <div className="text-center">
              <p className="text-xs text-white">
                Didn't receive an email?{" "}
                <button className="text-primary hover:underline">
                  Check your spam folder
                </button>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
