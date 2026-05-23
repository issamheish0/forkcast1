"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Shield, AlertCircle, Smartphone, Lock } from "lucide-react"
import { toast } from "react-hot-toast"
import QRCode from "qrcode"

interface Enforce2FAModalProps {
  open: boolean
  onSuccess: () => void
}

export function Enforce2FAModal({ open, onSuccess }: Enforce2FAModalProps) {
  const [step, setStep] = useState<"intro" | "setup" | "verify">("intro")
  const [isLoading, setIsLoading] = useState(false)
  const [factorId, setFactorId] = useState<string>("")
  const [qrCode, setQrCode] = useState<string>("")
  const [secret, setSecret] = useState<string>("")
  const [friendlyName, setFriendlyName] = useState("Admin Device")
  const [verificationCode, setVerificationCode] = useState("")
  const [error, setError] = useState<string>("")
  const supabase = createClient()

  const handleEnroll = async () => {
    try {
      setIsLoading(true)
      setError("")

      // Clean up any orphaned unverified factors before enrolling a new one
      // Note: data.totp only contains verified factors, so we must use data.all
      const { data: existingFactors } = await supabase.auth.mfa.listFactors()
      const unverifiedFactors = existingFactors?.all?.filter(f => f.factor_type === 'totp' && f.status === 'unverified') || []
      for (const factor of unverifiedFactors) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id })
      }

      // Enroll a new TOTP factor
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: friendlyName || "Admin Device",
      })

      if (enrollError) throw enrollError

      if (!data) {
        throw new Error("Failed to enroll MFA factor")
      }

      let qrCodeDataUrl: string

      // Check if we have a URI field (the actual otpauth:// string)
      if (data.totp.uri) {
        // Generate our own QR code from the URI
        qrCodeDataUrl = await QRCode.toDataURL(data.totp.uri, {
          errorCorrectionLevel: "M",
          type: "image/png",
          width: 300,
          margin: 2,
        })
      } else {
        // Use the SVG QR code directly from Supabase
        qrCodeDataUrl = data.totp.qr_code
      }

      setFactorId(data.id)
      setQrCode(qrCodeDataUrl)
      setSecret(data.totp.secret)
      setStep("verify")
      toast.success("Scan the QR code with your authenticator app")
    } catch (err: any) {
      console.error("Enrollment error:", err)
      setError(err.message || "Failed to enroll MFA factor")
      toast.error("Failed to start enrollment")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async () => {
    try {
      setIsLoading(true)
      setError("")

      if (!verificationCode || verificationCode.length !== 6) {
        setError("Please enter a valid 6-digit code")
        return
      }

      // Create a challenge for the newly enrolled factor
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({
          factorId,
        })

      if (challengeError) throw challengeError

      // Verify the challenge with the code from authenticator app
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verificationCode,
      })

      if (verifyError) throw verifyError

      toast.success("Two-factor authentication enabled successfully! You now have access to the admin panel.")
      onSuccess()
    } catch (err: any) {
      console.error("Verification error:", err)
      setError(
        err.message === "Invalid TOTP code"
          ? "Invalid code. Please check your authenticator app and try again."
          : err.message || "Failed to verify code"
      )
      toast.error("Verification failed")
    } finally {
      setIsLoading(false)
    }
  }

  const copySecret = () => {
    navigator.clipboard.writeText(secret)
    toast.success("Secret copied to clipboard")
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader className="text-center">
          <div className="mx-auto bg-red-100 p-3 rounded-full w-fit mb-4">
            <Lock className="h-6 w-6 text-red-600" />
          </div>
          <DialogTitle className="text-2xl">
            {step === "intro" && "Two-Factor Authentication Required"}
            {step === "setup" && "Set Up Your Authenticator"}
            {step === "verify" && "Verify Your Device"}
          </DialogTitle>
          <DialogDescription className="text-base">
            {step === "intro" &&
              "For security reasons, all administrators must enable two-factor authentication before accessing the admin panel."}
            {step === "setup" &&
              "Enter a name for this device and click continue to get your QR code."}
            {step === "verify" &&
              "Scan the QR code with your authenticator app, then enter the 6-digit code."}
          </DialogDescription>
        </DialogHeader>

        {step === "intro" && (
          <div className="space-y-4 py-4">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                You cannot access the admin panel until you set up two-factor authentication.
                This is a mandatory security requirement.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                  1
                </div>
                <div>
                  <p className="font-medium text-gray-900">Download an Authenticator App</p>
                  <p className="text-sm text-gray-600">
                    If you don&apos;t have one, download <strong>Google Authenticator</strong> (recommended) from your
                    phone&apos;s app store. Authy and 1Password also work.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                  2
                </div>
                <div>
                  <p className="font-medium text-gray-900">Scan the QR Code</p>
                  <p className="text-sm text-gray-600">
                    Open the authenticator app, tap the <strong>+</strong> button, choose
                    &quot;Scan QR code&quot;, and point your camera at the code we&apos;ll show you.
                    Wait until a 6-digit code appears in the app before proceeding.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                  3
                </div>
                <div>
                  <p className="font-medium text-gray-900">Enter the Verification Code</p>
                  <p className="text-sm text-gray-600">
                    Type the 6-digit code shown in your authenticator app. The code changes every 30
                    seconds, so enter the most recent one.
                  </p>
                </div>
              </div>
            </div>

            <Button onClick={() => setStep("setup")} className="w-full" size="sm">
              <Shield className="mr-2 h-5 w-5" />
              Begin Setup
            </Button>
          </div>
        )}

        {step === "setup" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="friendlyName">Device Name (Optional)</Label>
              <Input
                id="friendlyName"
                placeholder="e.g., My iPhone, Work Laptop"
                value={friendlyName}
                onChange={(e) => setFriendlyName(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500">
                Give this device a name to identify it later
              </p>
            </div>

            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertDescription>
                Make sure you have your authenticator app ready before continuing.
              </AlertDescription>
            </Alert>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep("intro")}
                disabled={isLoading}
                className="flex-1"
              >
                Back
              </Button>
              <Button onClick={handleEnroll} disabled={isLoading} className="flex-1">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />}
                Generate QR Code
              </Button>
            </div>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center space-y-4">
              {qrCode && (
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200 shadow-sm">
                  <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                </div>
              )}

              <div className="w-full space-y-2">
                <Label className="text-sm font-medium">Or enter this code manually:</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm font-mono break-all">
                    {secret}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copySecret}
                    disabled={isLoading}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verificationCode">Verification Code</Label>
              <Input
                id="verificationCode"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                maxLength={6}
                disabled={isLoading}
                className="text-center text-2xl tracking-widest font-mono"
                autoComplete="one-time-code"
              />
              <p className="text-xs text-gray-500">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Save the secret key above in a secure location. If you lose access to your
                authenticator app, contact a super admin to reset your 2FA.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={async () => {
                  if (factorId) {
                    await supabase.auth.mfa.unenroll({ factorId })
                  }
                  setStep("setup")
                  setFactorId("")
                  setQrCode("")
                  setSecret("")
                  setVerificationCode("")
                  setError("")
                }}
                disabled={isLoading}
                className="flex-1"
                size="sm"
              >
                Start Over
              </Button>
              <Button
                onClick={handleVerify}
                disabled={isLoading || verificationCode.length !== 6}
                className="flex-1"
                size="sm"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify & Enable 2FA
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

