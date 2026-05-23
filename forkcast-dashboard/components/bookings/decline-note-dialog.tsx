// components/bookings/decline-note-dialog.tsx
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
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { AlertTriangle, MessageSquare } from "lucide-react"

// Predefined decline/cancellation reasons
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

interface DeclineNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (note: string) => void
  onCancel: () => void
  guestName?: string
  isLoading?: boolean
  bookingTime?: string
  partySize?: number
}

export function DeclineNoteDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  guestName,
  isLoading = false,
  bookingTime,
  partySize
}: DeclineNoteDialogProps) {
  const [selectedReason, setSelectedReason] = useState("")
  const [customNote, setCustomNote] = useState("")

  const handleConfirm = () => {
    let finalNote = ""

    if (selectedReason && selectedReason !== "other") {
      const reasonLabel = DECLINE_REASONS.find(r => r.value === selectedReason)?.label
      finalNote = reasonLabel || ""

      // Add custom note if provided
      if (customNote.trim()) {
        finalNote += ` - ${customNote.trim()}`
      }
    } else if (selectedReason === "other" && customNote.trim()) {
      finalNote = customNote.trim()
    } else if (customNote.trim()) {
      finalNote = customNote.trim()
    }

    onConfirm(finalNote)
    setSelectedReason("")
    setCustomNote("")
  }

  const handleCancel = () => {
    onCancel()
    setSelectedReason("")
    setCustomNote("")
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedReason("")
      setCustomNote("")
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                Decline Booking Request
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
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-orange-800">
                  This action cannot be undone
                </p>
                <p className="text-orange-700 mt-1">
                  The guest will be automatically notified of the decline. You can optionally add a note explaining the reason.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="decline-reason" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Reason for Decline
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
                  {DECLINE_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(selectedReason === "other" || selectedReason) && (
              <div className="space-y-2">
                <Label htmlFor="decline-note" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  {selectedReason === "other" ? "Custom Reason" : "Additional Notes (Optional)"}
                </Label>
                <Textarea
                  id="decline-note"
                  placeholder={
                    selectedReason === "other"
                      ? "Please specify the reason for declining..."
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
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? "Declining..." : "Decline Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
