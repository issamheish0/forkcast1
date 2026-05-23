"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Shield, AlertCircle, Smartphone } from "lucide-react"
import { toast } from "react-hot-toast"
import QRCode from "qrcode"

interface MfaEnrollmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function MfaEnrollmentDialog({
  open,
  onOpenChange,
  onSuccess,
}: MfaEnrollmentDialogProps) {
  const [step, setStep] = useState<"setup" | "verify">("setup")
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
          errorCorrectionLevel: 'M',
          type: 'image/png',
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

      toast.success("Two-factor authentication enabled successfully!")
      onSuccess()
      // Clear factorId before close so handleClose doesn't unenroll the just-verified factor
      setFactorId("")
      handleClose()
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

  const handleClose = async () => {
    // Clean up unverified factor if dialog is closed mid-enrollment
    if (factorId) {
      await supabase.auth.mfa.unenroll({ factorId }).catch(() => {})
    }
    setStep("setup")
    setFactorId("")
    setQrCode("")
    setSecret("")
    setFriendlyName("Admin Device")
    setVerificationCode("")
    setError("")
    onOpenChange(false)
  }

  const copySecret = () => {
    navigator.clipboard.writeText(secret)
    toast.success("Secret copied to clipboard")
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            {step === "setup" ? "Enable Two-Factor Authentication" : "Verify Your Device"}
          </DialogTitle>
          <DialogDescription>
            {step === "setup"
              ? "Add an extra layer of security to your admin account"
              : "Enter the 6-digit code from your authenticator app"}
          </DialogDescription>
        </DialogHeader>

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
                You'll need an authenticator app like Google Authenticator, Authy, 1Password, or
                similar to scan the QR code.
              </AlertDescription>
            </Alert>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center space-y-4">
              {qrCode && (
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
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
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                disabled={isLoading}
                className="text-center text-2xl tracking-widest font-mono"
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

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Save the secret key above in a secure location. If you lose access to your
                authenticator app, contact a super admin to reset your 2FA.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {step === "setup" && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleEnroll} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />}
                Continue
              </Button>
            </>
          )}

          {step === "verify" && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                onClick={handleVerify}
                disabled={isLoading || verificationCode.length !== 6}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />}
                Verify & Enable
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
