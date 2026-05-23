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
import { Loader2, AlertTriangle, ShieldCheck } from "lucide-react"
import { toast } from "react-hot-toast"
import { processPenalty } from "@/app/actions/guarantees"
import { formatCurrency } from "@/lib/utils"

interface PenaltyDialogProps {
  isOpen: boolean
  onClose: () => void
  bookingId: string | null
  newStatus: 'no_show' | 'cancelled_by_restaurant'
  onSuccess: () => void
}

export function PenaltyDialog({
  isOpen,
  onClose,
  bookingId,
  newStatus,
  onSuccess
}: PenaltyDialogProps) {
  const [step, setStep] = useState<'loading' | 'confirm' | 'processing'>('loading')
  const [details, setDetails] = useState<any>(null)
  const [action, setAction] = useState<'charge' | 'waive'>('charge')
  const [reason, setReason] = useState("")
  const [waiveReason, setWaiveReason] = useState("")
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchDetails()
    } else {
      resetState()
    }
  }, [isOpen, bookingId])

  const resetState = () => {
    setStep('loading')
    setDetails(null)
    setAction('charge')
    setReason("")
    setWaiveReason("")
  }

  const fetchDetails = async () => {
    setStep('loading')
    try {
      const { data, error } = await supabase.rpc('get_booking_guarantee_details', {
        p_booking_id: bookingId
      })

      if (error) throw error
      
      console.log("Guarantee details:", data);

      if (!data || !data.has_guarantee || data.guarantee_status !== 'held') {
         // Should not happen if we intercepted correctly, but safe fallback
         console.warn('PenaltyDialog: No active guarantee found', data)
         onClose()
         return
      }

      setDetails(data)
      setStep('confirm')
    } catch (error) {
      console.error("Error fetching guarantee details:", error)
      toast.error("Failed to load guarantee details")
      onClose()
    }
  }

  const handleProcess = async () => {
    if (!details || !bookingId) return

    setStep('processing')
    try {
      const result = await processPenalty({
        guaranteeId: details.booking_guarantee_id,
        reason: newStatus === 'no_show' ? 'no_show' : 'late_cancellation',
        action,
        waiverReason: action === 'waive' ? waiveReason : undefined,
        amount: action === 'charge' ? details.potential_penalty_amount : undefined
      })

      if (result.success) {
        toast.success(result.data?.message || "Penalty processed successfully")
        onSuccess()
        onClose()
      } else {
        toast.error(result.error || "Failed to process penalty")
        setStep('confirm')
      }
    } catch (error) {
      console.error("Error processing penalty:", error)
      toast.error("An unexpected error occurred")
      setStep('confirm')
    }
  }

  const getDialogTitle = () => {
    if (newStatus === 'no_show') return "Mark as No Show"
    return "Cancel Booking"
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>
             This booking has an active credit card guarantee.
          </DialogDescription>
        </DialogHeader>

        {step === 'loading' && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 motion-safe:animate-spin text-primary" />
          </div>
        )}

        {step === 'confirm' && details && (
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2 border">
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-muted-foreground">Potential Penalty</span>
                    <span className="text-lg font-bold text-destructive">
                        {details.currency} {details.potential_penalty_amount}
                    </span>
                </div>
                {/* Service Fee Breakdown */}
                {details.service_fee_percentage > 0 && (
                  <div className="pt-2 border-t border-border/50 space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Base Fee</span>
                      <span className="font-medium">{details.currency} {details.base_fee?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Service Fee ({details.service_fee_percentage}%)</span>
                      <span className="font-medium">{details.currency} {details.service_fee_amount?.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Reason</span>
                    <span className="font-medium text-foreground">
                        {newStatus === 'no_show' ? 'Customer No-Show' : 'Restaurant Cancellation'}
                    </span>
                </div>
            </div>

            <RadioGroup value={action} onValueChange={(v: any) => setAction(v)}>
              <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="charge" id="r-charge" />
                <Label htmlFor="r-charge" className="flex-1 cursor-pointer">
                    <div className="font-semibold flex items-center gap-2">
                        Charge Penalty
                        <ShieldCheck className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-xs text-muted-foreground text-sm">Charge the customer's card {details.currency} {details.potential_penalty_amount}
                        {details.service_fee_percentage > 0 && (
                          <span className="text-muted-foreground/70"> (incl. {details.service_fee_percentage}% service fee)</span>
                        )}
                    </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="waive" id="r-waive" />
                <Label htmlFor="r-waive" className="flex-1 cursor-pointer">
                    <div className="font-semibold">Waive Penalty</div>
                    <div className="text-xs text-muted-foreground text-sm">Release the hold without charging
                    </div>
                </Label>
              </div>
            </RadioGroup>

            {action === 'waive' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <Label htmlFor="waive-reason">Waiver Reason</Label>
                    <Textarea 
                        id="waive-reason"
                        placeholder="Why are you waiving the fee? (e.g. VIP guest, Emergency)"
                        value={waiveReason}
                        onChange={(e) => setWaiveReason(e.target.value)}
                    />
                </div>
            )}
          </div>
        )}
        
        <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={step === 'processing'}>
                Cancel
            </Button>
            <Button 
                onClick={handleProcess} 
                disabled={step !== 'confirm' || (action === 'waive' && !waiveReason)}
                variant={action === 'charge' ? 'destructive' : 'default'}
            >
                {step === 'processing' && <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />}
                {action === 'charge' ? `Charge ${details?.currency || ''} ${details?.potential_penalty_amount || ''}` : 'Waive & Confirm'}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
