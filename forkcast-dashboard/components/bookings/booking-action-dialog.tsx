// components/bookings/booking-action-dialog.tsx
"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { AlertTriangle, MessageSquare, XCircle, Ban, ListPlus, Phone } from "lucide-react"

// Predefined decline reasons
const DECLINE_REASONS = [
  { value: "fully_booked", label: "Fully booked at that time" },
  { value: "staff_shortage", label: "Staff shortage" },
  { value: "kitchen_capacity", label: "Kitchen at capacity" },
  { value: "large_party_unavailable", label: "Cannot accommodate large party" },
  { value: "closed_maintenance", label: "Closed for maintenance" },
  { value: "special_event", label: "Private event/special occasion" },
  { value: "insufficient_notice", label: "Insufficient advance notice" },
  { value: "no_suitable_tables", label: "No suitable tables available" },
  { value: "weather_conditions", label: "Weather conditions (outdoor seating)" },
  { value: "other", label: "Other (specify below)" },
]

// Predefined cancellation reasons
const CANCELLATION_REASONS = [
  { value: "emergency_closure", label: "Emergency closure" },
  { value: "staff_emergency", label: "Staff emergency" },
  { value: "equipment_failure", label: "Equipment failure" },
  { value: "power_outage", label: "Power outage" },
  { value: "water_issue", label: "Water/plumbing issue" },
  { value: "health_department", label: "Health department closure" },
  { value: "fire_department", label: "Fire department closure" },
  { value: "severe_weather", label: "Severe weather conditions" },
  { value: "supplier_issue", label: "Critical supplier issue" },
  { value: "double_booking", label: "Double booking error" },
  { value: "other", label: "Other (specify below)" },
]

interface BookingActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (note: string) => void
  onCancel: () => void
  onDeclineAndAddToWaitlist?: (note: string) => void
  action: "decline" | "cancel"
  guestName?: string
  isLoading?: boolean
  bookingTime?: string
  partySize?: number
  guestPhone?: string
}

export function BookingActionDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  onDeclineAndAddToWaitlist,
  action,
  guestName,
  isLoading = false,
  bookingTime,
  partySize,
  guestPhone
}: BookingActionDialogProps) {
  const [selectedReason, setSelectedReason] = useState("")
  const [customNote, setCustomNote] = useState("")
  const [showWaitlistAlert, setShowWaitlistAlert] = useState(false)

  const reasons = action === "decline" ? DECLINE_REASONS : CANCELLATION_REASONS
  const isDecline = action === "decline"

  const buildFinalNote = () => {
    let finalNote = ""

    if (selectedReason && selectedReason !== "other") {
      const reasonLabel = reasons.find(r => r.value === selectedReason)?.label
      finalNote = reasonLabel || ""

      if (customNote.trim()) {
        finalNote += ` - ${customNote.trim()}`
      }
    } else if (selectedReason === "other" && customNote.trim()) {
      finalNote = customNote.trim()
    } else if (customNote.trim()) {
      finalNote = customNote.trim()
    }

    return finalNote
  }

  const handleConfirm = () => {
    onConfirm(buildFinalNote())
    setSelectedReason("")
    setCustomNote("")
  }

  const handleDeclineAndWaitlistClick = () => {
    setShowWaitlistAlert(true)
  }

  const handleConfirmWaitlist = () => {
    setShowWaitlistAlert(false)
    if (onDeclineAndAddToWaitlist) {
      onDeclineAndAddToWaitlist(buildFinalNote())
    }
    setSelectedReason("")
    setCustomNote("")
  }

  const handleCancel = () => {
    onCancel()
    setSelectedReason("")
    setCustomNote("")
    setShowWaitlistAlert(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedReason("")
      setCustomNote("")
      setShowWaitlistAlert(false)
    }
    onOpenChange(newOpen)
  }

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
              isDecline ? "bg-red-100" : "bg-orange-100"
            }`}>
              {isDecline ? (
                <XCircle className={`h-5 w-5 ${isDecline ? "text-red-600" : "text-orange-600"}`} />
              ) : (
                <Ban className="h-5 w-5 text-orange-600" />
              )}
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                {isDecline ? "Decline Booking Request" : "Cancel Booking"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground text-sm">{guestName && (
                  <span className="font-medium text-foreground">{guestName}</span>
                )}
                {bookingTime && partySize && (
                  <>
                    {guestName && " • "}
                    {bookingTime} • {partySize} guest{partySize !== 1 ? 's' : ''}
                  </>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className={`rounded-lg border p-3 ${
            isDecline ? "border-red-200 bg-red-50" : "border-orange-200 bg-orange-50"
          }`}>
            <div className="flex items-start gap-2">
              <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                isDecline ? "text-red-600" : "text-orange-600"
              }`} />
              <div className="text-sm">
                <p className={`font-medium ${
                  isDecline ? "text-red-800" : "text-orange-800"
                }`}>
                  This action cannot be undone
                </p>
                <p className={`mt-1 ${
                  isDecline ? "text-red-700" : "text-orange-700"
                }`}>
                  The guest will be automatically notified of the {action}. You can optionally add a note explaining the reason.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason-select" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Reason for {isDecline ? "Decline" : "Cancellation"}
              </Label>
              <Select
                value={selectedReason}
                onValueChange={setSelectedReason}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {reasons.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(selectedReason === "other" || selectedReason) && (
              <div className="space-y-2">
                <Label htmlFor="custom-note" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  {selectedReason === "other" ? "Custom Reason" : "Additional Notes (Optional)"}
                </Label>
                <Textarea
                  id="custom-note"
                  placeholder={
                    selectedReason === "other"
                      ? `Please specify the reason for ${action}...`
                      : "Add any additional context or alternative suggestions..."
                  }
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  rows={3}
                  className="resize-none"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground text-sm">This {selectedReason === "other" ? "reason" : "note"} will be sent to the guest and visible to staff.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          {isDecline && onDeclineAndAddToWaitlist && (
            <Button
              variant="secondary"
              onClick={handleDeclineAndWaitlistClick}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              <ListPlus className="h-4 w-4 mr-2" />
              Decline & Add to Waitlist
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? `${isDecline ? "Declining" : "Cancelling"}...` : `${isDecline ? "Decline" : "Cancel"} Booking`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Waitlist Confirmation Alert */}
    <AlertDialog open={showWaitlistAlert} onOpenChange={setShowWaitlistAlert}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <Phone className="h-5 w-5 text-blue-600" />
            </div>
            <AlertDialogTitle>Contact Guest Before Adding to Waitlist</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3">
            <p>
              Before adding {guestName || 'this guest'} to the waitlist, please ensure you have contacted them to inform about the decline and waitlist option.
            </p>
            {guestPhone && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{guestPhone}</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              The guest will be added to the waitlist with the same booking details (date, party size, preferences).
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmWaitlist}>
            I&apos;ve Contacted the Guest - Add to Waitlist
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
