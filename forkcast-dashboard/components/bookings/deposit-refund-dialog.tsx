"use client"

import { useState, useEffect } from "react"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2, AlertTriangle, CreditCard, Wallet, RefreshCcw, Ban } from "lucide-react"
import { toast } from "react-hot-toast"
import { Badge } from "@/components/ui/badge"

interface DepositRefundDialogProps {
  isOpen: boolean
  onClose: () => void
  bookingId: string | null
  action: 'decline' | 'cancel' | 'no_show' | 'cancelled_by_user'
  guestName?: string
  onSuccess: (refundDecision: 'refund' | 'no_refund') => void
}

interface DepositDetails {
  id: string
  booking_id: string
  total_amount: number
  amount: number  // base amount
  service_fee: number
  currency: string
  status: string
  payment_provider: 'montypay' | 'whish'
  provider_transaction_id: string | null
  created_at: string
}

export function DepositRefundDialog({
  isOpen,
  onClose,
  bookingId,
  action,
  guestName,
  onSuccess
}: DepositRefundDialogProps) {
  const [step, setStep] = useState<'loading' | 'confirm' | 'processing'>('loading')
  const [deposit, setDeposit] = useState<DepositDetails | null>(null)
  const [refundDecision, setRefundDecision] = useState<'refund' | 'no_refund'>('refund')
  const [reason, setReason] = useState("")
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchDepositDetails()
    } else {
      resetState()
    }
  }, [isOpen, bookingId])

  const resetState = () => {
    setStep('loading')
    setDeposit(null)
    setRefundDecision('refund')
    setReason("")
  }

  const fetchDepositDetails = async () => {
    setStep('loading')
    try {
      const { data, error } = await supabase
        .from('booking_deposits')
        .select('*')
        .eq('booking_id', bookingId)
        .eq('status', 'paid')
        .single()

      if (error || !data) {
        console.warn('DepositRefundDialog: No active deposit found', error)
        // No deposit found, just proceed without dialog
        onClose()
        onSuccess('no_refund')
        return
      }

      setDeposit(data)
      setStep('confirm')
      
      // Default refund decision based on action
      if (action === 'decline' || action === 'cancelled_by_user') {
        // Restaurant declined or user cancelled - typically refund
        setRefundDecision('refund')
      } else if (action === 'no_show') {
        // No show - typically no refund
        setRefundDecision('no_refund')
      } else if (action === 'cancel') {
        // Restaurant cancellation - typically refund
        setRefundDecision('refund')
      }
    } catch (error) {
      console.error("Error fetching deposit details:", error)
      toast.error("Failed to load deposit details")
      onClose()
    }
  }

  const handleProcess = async () => {
    if (!deposit || !bookingId) return

    setStep('processing')
    try {
      if (refundDecision === 'refund') {
        // Call the refund edge function
        const response = await fetch('/api/refund-deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            booking_id: bookingId,
            reason: reason || getDefaultReason()
          })
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to process refund')
        }

        // Check if manual refund is required (Whish or auto-refund failed)
        if (result.manual_refund_required || deposit.payment_provider === 'whish') {
          toast.success(
            `Refund marked for manual processing. Amount: ${deposit.currency} ${deposit.total_amount.toFixed(2)}.`,
            { duration: 8000 }
          )
        } else {
          toast.success(
            `Refund of ${deposit.currency} ${deposit.total_amount.toFixed(2)} processed successfully`
          )
        }
      } else {
        // No refund - just update the deposit status to forfeited
        const { error } = await supabase
          .from('booking_deposits')
          .update({
            status: 'forfeited',
            refund_reason: reason || `Deposit forfeited due to ${getDefaultReason()}`
          })
          .eq('id', deposit.id)

        if (error) throw error

        toast.success(`Deposit of ${deposit.currency} ${deposit.total_amount.toFixed(2)} forfeited`)
      }

      onSuccess(refundDecision)
      onClose()
    } catch (error) {
      console.error("Error processing deposit:", error)
      toast.error(error instanceof Error ? error.message : "Failed to process deposit")
      setStep('confirm')
    }
  }

  const getDefaultReason = () => {
    switch (action) {
      case 'decline':
        return 'Booking declined by restaurant'
      case 'cancel':
        return 'Booking cancelled by restaurant'
      case 'no_show':
        return 'Customer no-show'
      case 'cancelled_by_user':
        return 'Booking cancelled by customer'
      default:
        return 'Booking status change'
    }
  }

  const getDialogTitle = () => {
    switch (action) {
      case 'decline':
        return "Decline Booking with Deposit"
      case 'cancel':
        return "Cancel Booking with Deposit"
      case 'no_show':
        return "Mark as No Show - Deposit Decision"
      case 'cancelled_by_user':
        return "Customer Cancelled - Deposit Decision"
      default:
        return "Deposit Refund Decision"
    }
  }

  const getDescription = () => {
    switch (action) {
      case 'decline':
        return "This booking has a paid deposit. Would you like to refund it?"
      case 'cancel':
        return "This booking has a paid deposit. Refund is recommended for restaurant-initiated cancellations."
      case 'no_show':
        return "The customer did not show up. Would you like to refund their deposit or keep it as compensation?"
      case 'cancelled_by_user':
        return "The customer has cancelled their booking. Check your cancellation policy to decide on the refund."
      default:
        return "This booking has a paid deposit. Please decide on the refund."
    }
  }

  const getRecommendation = () => {
    switch (action) {
      case 'decline':
        return { text: "Recommended: Refund (restaurant declined)", variant: "refund" as const }
      case 'cancel':
        return { text: "Recommended: Refund (restaurant cancelled)", variant: "refund" as const }
      case 'no_show':
        return { text: "Recommended: Keep deposit (no-show policy)", variant: "no_refund" as const }
      case 'cancelled_by_user':
        return { text: "Check cancellation policy for timing", variant: "neutral" as const }
      default:
        return null
    }
  }

  const recommendation = getRecommendation()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            {getDialogTitle()}
          </DialogTitle>
          <DialogDescription>
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        {step === 'loading' && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 motion-safe:animate-spin text-primary" />
          </div>
        )}

        {step === 'confirm' && deposit && (
          <div className="space-y-4">
            {/* Deposit Info Card */}
            <div className="bg-muted/50 p-4 rounded-lg space-y-3 border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Guest</span>
                <span className="font-medium">{guestName || 'Guest'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Deposit Paid</span>
                <span className="text-lg font-bold text-emerald-600">
                  {deposit.currency} {deposit.total_amount.toFixed(2)}
                </span>
              </div>
              {deposit.service_fee > 0 && (
                <div className="pt-2 border-t border-border/50 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Base Amount</span>
                    <span>{deposit.currency} {deposit.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Service Fee</span>
                    <span>{deposit.currency} {deposit.service_fee.toFixed(2)}</span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-muted-foreground">Payment Method</span>
                <Badge variant="outline" className="gap-1">
                  {deposit.payment_provider === 'whish' ? (
                    <>
                      <Wallet className="h-3 w-3" />
                      Whish Money
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-3 w-3" />
                      Card
                    </>
                  )}
                </Badge>
              </div>
              {deposit.payment_provider === 'whish' && (
                <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  ⚠️ Whish payments require manual refund processing
                </div>
              )}
            </div>

            {/* Recommendation Badge */}
            {recommendation && (
              <div className={`text-sm p-2 rounded-md text-center ${
                recommendation.variant === 'refund' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : recommendation.variant === 'no_refund'
                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {recommendation.text}
              </div>
            )}

            {/* Refund Decision */}
            <RadioGroup value={refundDecision} onValueChange={(v: any) => setRefundDecision(v)}>
              <div className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${
                refundDecision === 'refund' ? 'border-emerald-500 bg-emerald-50/50' : ''
              }`}>
                <RadioGroupItem value="refund" id="r-refund" />
                <Label htmlFor="r-refund" className="flex-1 cursor-pointer">
                  <div className="font-semibold flex items-center gap-2">
                    <RefreshCcw className="h-4 w-4 text-emerald-600" />
                    Refund Deposit
                  </div>
                  <div className="text-xs text-muted-foreground text-sm">Return {deposit.currency} {deposit.total_amount.toFixed(2)} to the customer
                  </div>
                </Label>
              </div>
              <div className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${
                refundDecision === 'no_refund' ? 'border-orange-500 bg-orange-50/50' : ''
              }`}>
                <RadioGroupItem value="no_refund" id="r-no-refund" />
                <Label htmlFor="r-no-refund" className="flex-1 cursor-pointer">
                  <div className="font-semibold flex items-center gap-2">
                    <Ban className="h-4 w-4 text-orange-600" />
                    Keep Deposit
                  </div>
                  <div className="text-xs text-muted-foreground text-sm">Forfeit the deposit as per policy
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {/* Optional Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason / Notes (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="Add any notes about this decision..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={step === 'processing'}>
            Cancel
          </Button>
          <Button
            onClick={handleProcess}
            disabled={step !== 'confirm'}
            variant={refundDecision === 'refund' ? 'default' : 'destructive'}
          >
            {step === 'processing' && <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />}
            {refundDecision === 'refund'
              ? `Refund ${deposit?.currency || ''} ${deposit?.total_amount?.toFixed(2) || ''}`
              : 'Forfeit Deposit & Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
