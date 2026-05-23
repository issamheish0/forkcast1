// components/bookings/booking-modification-dialog.tsx
"use client"

import { useState } from "react"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  Loader2,
  AlertCircle,
  Timer,
  Minus,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  buildModificationMessage,
  formatLebanonTime,
  formatLebanonDate,
} from "@/lib/booking-modification-helpers"
import type { Booking } from "@/types"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"

// ── Props ────────────────────────────────────────────────────────────────────

interface BookingModificationDialogProps {
  booking: Booking | null
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurantId: string
  onSaved: () => void
}

// ── Constants ────────────────────────────────────────────────────────────────

const DURATION_OPTIONS = [
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
  { value: 150, label: "2.5 hours" },
  { value: 180, label: "3 hours" },
  { value: 240, label: "4 hours" },
]

/** Generate 15-minute time slots from 08:00 to 23:45 */
const generateTimeSlots = (): { value: string; label: string }[] => {
  const slots: { value: string; label: string }[] = []
  for (let h = 8; h <= 23; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hh = h.toString().padStart(2, "0")
      const mm = m.toString().padStart(2, "0")
      const value = `${hh}:${mm}`
      const hour12 = h % 12 || 12
      const period = h < 12 ? "AM" : "PM"
      const label = `${hour12}:${mm} ${period}`
      slots.push({ value, label })
    }
  }
  return slots
}

const TIME_SLOTS = generateTimeSlots()

/** Round minutes to the nearest 15-minute slot so it matches the Select options */
const nearestTimeSlot = (dateStr: string): string => {
  const dt = new Date(dateStr)
  let h = dt.getHours()
  const rounded = Math.round(dt.getMinutes() / 15) * 15
  if (rounded === 60) {
    h += 1
    return `${h.toString().padStart(2, "0")}:00`
  }
  return `${h.toString().padStart(2, "0")}:${rounded.toString().padStart(2, "0")}`
}

// ── Component ────────────────────────────────────────────────────────────────

export function BookingModificationDialog({
  booking,
  open,
  onOpenChange,
  restaurantId,
  onSaved,
}: BookingModificationDialogProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { currentRestaurant } = useRestaurantContext()

  // ── Local form state (re-initialised every mount via key prop) ───────────
  const [bookingDate, setBookingDate] = useState<Date>(
    () => (booking ? new Date(booking.booking_time) : new Date())
  )
  const [bookingTime, setBookingTime] = useState(
    () => (booking ? nearestTimeSlot(booking.booking_time) : "19:00")
  )
  const [partySize, setPartySize] = useState(
    () => booking?.party_size ?? 2
  )
  const [turnTime, setTurnTime] = useState(
    () => booking?.turn_time_minutes ?? 120
  )
  const [specialRequests, setSpecialRequests] = useState(
    () => booking?.special_requests ?? ""
  )
  const [isSaving, setIsSaving] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  if (!booking) return null

  // ── Derived values ───────────────────────────────────────────────────────

  const guestName =
    booking.guest_name ||
    (Array.isArray(booking.profiles)
      ? booking.profiles[0]?.full_name
      : booking.profiles?.full_name) ||
    "Guest"

  const guestPhone =
    booking.guest_phone ||
    (Array.isArray(booking.profiles)
      ? booking.profiles[0]?.phone_number
      : booking.profiles?.phone_number) ||
    null

  /** Combine edited date + time into an ISO string */
  const buildNewBookingTime = (): string => {
    const [hours, minutes] = bookingTime.split(":").map(Number)
    const dt = new Date(bookingDate)
    dt.setHours(hours, minutes, 0, 0)
    return dt.toISOString()
  }

  /** Detect which fields changed (returns human-readable labels) */
  const getChanges = (): string[] => {
    const newBookingTime = buildNewBookingTime()
    const changes: string[] = []

    // Compare timestamps rounded to the minute
    const origMs = Math.floor(new Date(booking.booking_time).getTime() / 60000)
    const newMs = Math.floor(new Date(newBookingTime).getTime() / 60000)
    if (origMs !== newMs) changes.push("date/time")

    if (partySize !== booking.party_size) changes.push("party size")
    if (turnTime !== booking.turn_time_minutes) changes.push("duration")
    if (specialRequests !== (booking.special_requests || ""))
      changes.push("special requests")

    return changes
  }

  const hasChanges = getChanges().length > 0

  // ── Save handler ─────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!hasChanges) {
      toast.error("No changes to save")
      return
    }
    if (partySize < 1) {
      toast.error("Party size must be at least 1")
      return
    }

    setIsSaving(true)

    try {
      const newBookingTime = buildNewBookingTime()

      // ① Update the booking row
      const { error: updateError } = await supabase
        .from("bookings")
        .update({
          booking_time: newBookingTime,
          party_size: partySize,
          turn_time_minutes: turnTime,
          special_requests: specialRequests || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", booking.id)

      if (updateError) throw updateError

      // ② Get restaurant name from context (most reliable), then booking data
      const restaurantName = currentRestaurant?.restaurant?.name || booking.restaurant?.name || "the restaurant"

      // ③ Build natural notification message (times in Lebanon timezone)
      const { body: notificationBody, changeLabels } =
        buildModificationMessage(
          restaurantName,
          booking.booking_time,
          {
            party_size: partySize,
            turn_time_minutes: turnTime,
            special_requests: specialRequests,
            booking_time: newBookingTime,
          },
          {
            party_size: booking.party_size,
            turn_time_minutes: booking.turn_time_minutes,
            special_requests: booking.special_requests,
            booking_time: booking.booking_time,
          },
          false // no table changes from this dialog
        )

      // ④ Send notifications (wrapped in try/catch — must not block save)
      if (notificationBody && changeLabels.length > 0) {
        const notifTitle = `Booking Updated — ${restaurantName}`

        try {
          // Registered user → in-app + push
          if (booking.user_id) {
            await supabase.from("notifications").insert({
              user_id: booking.user_id,
              type: "booking_modified",
              title: notifTitle,
              message: notificationBody,
              data: {
                booking_id: booking.id,
                restaurant_name: restaurantName,
                changes: changeLabels,
                confirmation_code: booking.confirmation_code,
                url: `/booking/${booking.id}`,
              },
              category: "booking",
              priority: "high",
              is_read: false,
            })

            // payload must include title/message at top level — the notify edge function
            // reads item.payload.title and item.payload.message to build the Expo push message
            await supabase.from("notification_outbox").insert({
              user_id: booking.user_id,
              channel: "push",
              type: "booking_modified",
              title: notifTitle,
              body: notificationBody,
              payload: {
                title: notifTitle,
                message: notificationBody,
                data: {
                  booking_id: booking.id,
                  restaurant_name: restaurantName,
                  changes: changeLabels,
                  confirmation_code: booking.confirmation_code,
                },
                deeplink: `/booking/${booking.id}`,
                category: "booking",
                type: "booking_modified",
              },
              status: "queued",
              priority: "high",
              scheduled_for: new Date().toISOString(),
            })
          }

          // Guest booking (no user_id) → email / SMS queue
          if (
            !booking.user_id &&
            (booking.guest_email || booking.guest_phone)
          ) {
            await supabase.from("notification_queue").insert({
              booking_id: booking.id,
              recipient_email: booking.guest_email || null,
              recipient_phone: booking.guest_phone || null,
              notification_type: "booking_modified",
              title: notifTitle,
              message: `Hello ${guestName},\n\n${notificationBody}.\n\nConfirmation code: ${booking.confirmation_code}\n\nPlease contact ${restaurantName} if you have any questions.`,
              data: {
                booking_id: booking.id,
                restaurant_name: restaurantName,
                changes: changeLabels,
                confirmation_code: booking.confirmation_code,
              },
              priority: "high",
              status: "pending",
            })
          }
        } catch (notifErr) {
          // Notification failure must never block the save
          console.error("Failed to send modification notification:", notifErr)
        }
      }

      // ⑤ Invalidate caches so the dashboard refreshes
      queryClient.invalidateQueries({ queryKey: ["basic-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })

      const hasNotifTarget =
        booking.user_id || booking.guest_email || booking.guest_phone
      toast.success(
        hasNotifTarget
          ? "Booking updated. Guest has been notified of the changes."
          : "Booking updated successfully."
      )

      onSaved()
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to update booking:", error)
      toast.error("Failed to update booking. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Modify Booking
          </DialogTitle>
        </DialogHeader>

        {/* Guest info header */}
        <div className="flex items-center justify-between px-1 pb-2 border-b">
          <div>
            <p className="font-semibold text-sm">{guestName}</p>
            {guestPhone && (
              <p className="text-xs text-muted-foreground">{guestPhone}</p>
            )}
          </div>
          <Badge variant="outline" className="text-xs">
            {booking.confirmation_code}
          </Badge>
        </div>

        {/* Warning banner */}
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800 text-xs">
            The guest will be notified of any changes you save.
          </AlertDescription>
        </Alert>

        {/* ── Form fields ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Date</Label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !bookingDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(bookingDate, "EEEE, MMMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={bookingDate}
                  onSelect={(date) => {
                    if (date) {
                      setBookingDate(date)
                      setDatePickerOpen(false)
                    }
                  }}
                  disabled={(date) =>
                    date < new Date(new Date().setHours(0, 0, 0, 0))
                  }
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Time</Label>
            <Select value={bookingTime} onValueChange={setBookingTime}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent className="max-h-[280px]">
                {TIME_SLOTS.map((slot) => (
                  <SelectItem key={slot.value} value={slot.value}>
                    {slot.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Party size */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Party Size</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setPartySize(Math.max(1, partySize - 1))}
                disabled={partySize <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 flex-1 justify-center">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-lg font-semibold tabular-nums w-8 text-center">
                  {partySize}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setPartySize(Math.min(50, partySize + 1))}
                disabled={partySize >= 50}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Duration</Label>
            <Select
              value={String(turnTime)}
              onValueChange={(v) => setTurnTime(Number(v))}
            >
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Special Requests */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Special Requests</Label>
            <Textarea
              placeholder="Any special requests..."
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
        </div>

        {/* ── Changes preview ─────────────────────────────────────────── */}
        {hasChanges && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mt-2">
            <p className="text-xs font-medium text-blue-800 mb-1">
              Changes to be saved:
            </p>
            <div className="flex flex-wrap gap-1">
              {getChanges().map((change) => (
                <Badge
                  key={change}
                  variant="secondary"
                  className="text-xs bg-blue-100 text-blue-700"
                >
                  {change}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-1 motion-safe:animate-spin" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
