"use client"

// app/(auth)/mfa-enroll/page.tsx
//
// Forced MFA enrollment screen. Staff/admin redirected here cannot
// access the rest of the app until they enroll a TOTP factor. The page
// reuses the existing Enforce2FAModal which calls supabase.auth.mfa.enroll
// + verify in a single flow.

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Shield } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Enforce2FAModal } from "@/components/admin/enforce-2fa-modal"
import { Button } from "@/components/ui/button"

export default function MfaEnrollRequiredPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [checked, setChecked] = useState(false)
  const redirectTo = searchParams.get("redirectTo") || "/bookings"

  // If the user already enrolled in another tab, bounce them out.
  useEffect(() => {
    let active = true
    const run = async () => {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const hasVerified = factors?.totp?.some((f) => f.status === "verified")
      if (active && hasVerified) {
        router.replace(redirectTo)
        return
      }
      if (active) setChecked(true)
    }
    run()
    return () => {
      active = false
    }
  }, [router, redirectTo, supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md space-y-4">
        <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">
          Two-factor authentication required
        </h1>
        <p className="text-sm text-gray-500">
          Your organisation requires every staff member to enroll a TOTP
          authenticator (Google Authenticator, 1Password, Authy, etc.) before
          accessing the dashboard. This takes about a minute.
        </p>
        <div className="pt-2">
          <Button variant="outline" onClick={handleSignOut} size="sm">
            Sign out
          </Button>
        </div>
      </div>

      {checked && (
        <Enforce2FAModal
          open
          onSuccess={() => router.replace(redirectTo)}
        />
      )}
    </div>
  )
}
