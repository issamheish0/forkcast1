// components/floorplan/table-detail-sheet.tsx
"use client"

import { useState, useEffect } from 'react'
import { format, differenceInMinutes } from 'date-fns'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Users, Timer, User, Clock, Phone, LogOut, CalendarPlus, Pencil, Trash2, Zap, ChevronDown, ChevronRight, Ban, CheckCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useTableBookingRules, useUpdateBookingRule, useDeleteBookingRule } from '@/hooks/use-table-booking-rules'
import { RuleFormDialog } from './rule-form-dialog'
import type { RestaurantTable, Booking, TableBookingRule, RestaurantShift } from '@/types'
import { isSeatedStatus, resolveGuestName, getTimerColor } from '@/lib/constants/floorplan'
import { classifyBookingInShift, formatShiftRange } from '@/lib/utils/shifts'

interface TableDetailSheetProps {
  table: RestaurantTable | null
  assignedBooking: Booking | null
  upcomingBookings: Booking[]
  isOpen: boolean
  onClose: () => void
  selectedTime: string
  restaurantTurnoverTime?: number
  allBookings?: Booking[]
  selectedShift?: RestaurantShift | null
  shiftBookings?: Booking[]
  onSeatWalkIn?: () => void
  onNewReservation?: () => void
  onCompleteAndFree?: (bookingId: string) => void
  onToggleActive?: (tableId: string, isActive: boolean) => void
}

export function TableDetailSheet({
  table,
  assignedBooking,
  upcomingBookings,
  isOpen,
  onClose,
  selectedTime: _selectedTime,
  restaurantTurnoverTime = 90,
  allBookings = [],
  selectedShift,
  shiftBookings,
  onSeatWalkIn,
  onNewReservation,
  onCompleteAndFree,
  onToggleActive,
}: TableDetailSheetProps) {
  // Rules state — must be declared before any early return (React rules of hooks)
  const [editingRule, setEditingRule] = useState<TableBookingRule | null>(null)
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null)
  const [rulesExpanded, setRulesExpanded] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)

  // Reset expansion state when switching tables
  useEffect(() => {
    setShowAllUpcoming(false)
    setRulesExpanded(false)
  }, [table?.id])

  const { data: bookingRules = [] } = useTableBookingRules(table?.id)
  const updateRule = useUpdateBookingRule()
  const deleteRule = useDeleteBookingRule()

  const instantRules = bookingRules.filter(r => r.booking_type === 'instant' && r.is_active)

  if (!table) return null

  // Seated timer logic with Expected End Time and color states
  let timeSinceSeated: number | null = null
  let timerColor: 'green' | 'yellow' | 'red' | 'flashing-red' = 'green'
  let isFlashing = false
  
  if (assignedBooking?.seated_at) {
    const seatedAt = new Date(assignedBooking.seated_at)
    // Use actual current time for the seated timer — this is a real-time elapsed counter,
    // not a hypothetical view based on the time picker
    const now = new Date()

    // Calculate time seated (counting up) — floor to 0 to prevent negative display
    timeSinceSeated = Math.max(0, differenceInMinutes(now, seatedAt))
    
    // Find next booking on this table
    const nextBooking = upcomingBookings.length > 0 ? upcomingBookings[0] : null
    
    // Determine Expected End Time
    let expectedEndTime: Date
    if (nextBooking) {
      expectedEndTime = new Date(nextBooking.booking_time)
    } else {
      // Use booking's turn_time_minutes if available, otherwise fall back to restaurant's table_turnover_minutes
      const bookingTurnoverTime = assignedBooking.turn_time_minutes || restaurantTurnoverTime
      // Expected End = Check-in Time + Turnover Time
      expectedEndTime = new Date(seatedAt.getTime() + bookingTurnoverTime * 60 * 1000)
    }
    
    // Calculate time remaining until Expected End
    const minutesRemaining = differenceInMinutes(expectedEndTime, now)
    
    // Determine timer color based on time remaining
    const timerResult = getTimerColor(minutesRemaining)
    timerColor = timerResult.color
    isFlashing = timerResult.isFlashing
  }

  // Derive isOverstay from timer state (past expected end time)
  const isOverstay = timerColor === 'flashing-red'

  // Get current status
  const getStatusInfo = () => {
    if (assignedBooking) {
      const isSeated = isSeatedStatus(assignedBooking.status)
      if (isSeated) {
        return { label: 'Occupied', color: isOverstay ? 'bg-status-overstay' : 'bg-status-taken', text: isOverstay ? 'text-status-overstay' : 'text-status-taken' }
      }
      return { label: 'Reserved', color: 'bg-status-reserved', text: 'text-status-reserved' }
    }
    if (!table.is_active) {
      return { label: 'Inactive', color: 'bg-status-blocked', text: 'text-status-blocked' }
    }
    return { label: 'Available', color: 'bg-status-available', text: 'text-status-available' }
  }

  const statusInfo = getStatusInfo()

  return (
    <>
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-2xl p-0 flex flex-col" aria-label={`Table ${table.table_number} details`}>
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header with large status square */}
        <SheetHeader className="px-4 pb-3 border-b">
          <SheetTitle className="flex items-center gap-3 pr-8">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-card',
              statusInfo.color
            )}>
              {table.table_number}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold">Table {table.table_number}</span>
                <Badge className={cn('text-white text-[10px] px-2 py-0.5 shadow-sm', statusInfo.color)}>
                  {statusInfo.label}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Users className="w-3.5 h-3.5" />
                {table.min_capacity}–{table.max_capacity} seats
                <span className="mx-0.5">•</span>
                <span className="capitalize">{table.shape}</span>
                <span className="mx-0.5">•</span>
                <span className="capitalize">{table.table_type}</span>
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Scrollable body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-4">
            {/* Time since seated with color states */}
            {timeSinceSeated !== null && (
              <div className={cn(
                'flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border tabular-nums',
                timerColor === 'green' && 'bg-[hsl(var(--status-available)/.1)] border-[hsl(var(--status-available)/.3)] text-[hsl(var(--status-available))]',
                timerColor === 'yellow' && 'bg-[hsl(var(--status-highlight)/.12)] border-[hsl(var(--status-highlight)/.3)] text-[hsl(var(--status-highlight))]',
                timerColor === 'red' && 'bg-[hsl(var(--status-taken)/.1)] border-[hsl(var(--status-taken)/.3)] text-[hsl(var(--status-taken))]',
                timerColor === 'flashing-red' && 'bg-[hsl(var(--status-taken)/.1)] border-[hsl(var(--status-taken)/.3)] text-[hsl(var(--status-taken))]',
                isFlashing && 'motion-safe:animate-pulse'
              )}>
                <Timer className="w-4 h-4" />
                <span>Seated for {timeSinceSeated >= 60 ? `${Math.floor(timeSinceSeated / 60)}h ${timeSinceSeated % 60}m` : `${timeSinceSeated}m`}</span>
                {timerColor === 'flashing-red' && <Badge className="bg-destructive text-white text-[10px] ml-auto shadow-sm">Past Expected End</Badge>}
              </div>
            )}

            {/* Assigned Booking */}
            {assignedBooking && (
              <div className="rounded-xl border bg-card p-3 shadow-card">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Current Guest</h4>
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {resolveGuestName(assignedBooking)}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span className="tabular-nums">{format(new Date(assignedBooking.booking_time), 'h:mm a')}</span>
                      <span>•</span>
                      <Users className="w-3 h-3" />
                      <span>{assignedBooking.party_size}</span>
                    </div>
                    {(assignedBooking.guest_phone || assignedBooking.user?.phone_number) && (
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        {assignedBooking.guest_phone || assignedBooking.user?.phone_number}
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-[10px] capitalize flex-shrink-0">
                    {assignedBooking.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>
            )}

            {/* Empty state — table is available with no bookings */}
            {!assignedBooking && upcomingBookings.length === 0 && table.is_active && (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <div className="w-10 h-10 rounded-full bg-[hsl(var(--status-available)/.1)] flex items-center justify-center mb-2">
                  <CalendarPlus className="w-5 h-5 text-[hsl(var(--status-available))]" />
                </div>
                <p className="text-sm font-medium text-foreground">Table is available</p>
                <p className="text-xs text-muted-foreground mt-0.5">No upcoming bookings for this table</p>
              </div>
            )}

            {/* Shift Bookings — shown when a shift filter is active */}
            {selectedShift && shiftBookings && shiftBookings.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: selectedShift.color || 'hsl(var(--primary))' }}
                  />
                  {selectedShift.name} ({shiftBookings.length})
                  <span className="text-[9px] font-normal normal-case text-muted-foreground tabular-nums ml-1">
                    {formatShiftRange(selectedShift)}
                  </span>
                </h4>
                <div className="space-y-1.5">
                  {shiftBookings.map((booking) => {
                    const klass = classifyBookingInShift(booking, selectedShift, restaurantTurnoverTime)
                    const spansBefore = klass === 'spans_before' || klass === 'spans_both'
                    const spansAfter = klass === 'spans_after' || klass === 'spans_both'
                    const durationMinutes = booking.turn_time_minutes || restaurantTurnoverTime
                    return (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between py-2 px-3 bg-card border rounded-xl"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-xs truncate">
                            {resolveGuestName(booking)}
                          </p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                            <Users className="w-2.5 h-2.5" />
                            <span>{booking.party_size}</span>
                            <span className="text-muted-foreground/50">·</span>
                            <span>{durationMinutes}min</span>
                            {(spansBefore || spansAfter) && (
                              <>
                                <span className="text-muted-foreground/50">·</span>
                                <span
                                  className="text-[9px] px-1 py-0.5 rounded bg-muted text-foreground font-semibold uppercase tracking-wide"
                                  title={spansBefore && spansAfter ? 'Spans entire shift' : spansBefore ? 'Spans into shift from before' : 'Spans out of shift'}
                                >
                                  {spansBefore && spansAfter ? 'Spans' : spansBefore ? 'From before' : 'To after'}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 text-xs font-bold tabular-nums text-foreground flex-shrink-0">
                          {spansBefore && <span aria-hidden className="text-muted-foreground">‹</span>}
                          {format(new Date(booking.booking_time), 'h:mm a')}
                          {spansAfter && <span aria-hidden className="text-muted-foreground">›</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Upcoming Bookings */}
            {upcomingBookings.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Upcoming ({upcomingBookings.length})
                </h4>
                <div className="space-y-1.5">
                  {(showAllUpcoming ? upcomingBookings : upcomingBookings.slice(0, 4)).map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between py-2 px-3 bg-card border rounded-xl hover:shadow-card transition-shadow"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-xs truncate">
                          {resolveGuestName(booking)}
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Users className="w-2.5 h-2.5" />
                          {booking.party_size}
                        </p>
                      </div>
                      <span className="text-xs font-bold tabular-nums text-foreground">
                        {format(new Date(booking.booking_time), 'h:mm a')}
                      </span>
                    </div>
                  ))}
                  {upcomingBookings.length > 4 && !showAllUpcoming && (
                    <button
                      className="w-full text-center text-xs text-primary font-medium py-1.5 hover:underline active:scale-[0.98] transition-transform"
                      onClick={() => setShowAllUpcoming(true)}
                    >
                      Show all {upcomingBookings.length} bookings
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Instant Booking Rules */}
            {instantRules.length > 0 && (
              <div>
                <button
                  className="flex items-center gap-1.5 w-full text-left mb-2 group"
                  onClick={() => setRulesExpanded(v => !v)}
                >
                  <Zap className="w-3 h-3 text-[hsl(var(--status-highlight))] flex-shrink-0" />
                  <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex-1">
                    Instant Rules ({instantRules.length})
                  </h4>
                  {rulesExpanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>

                {rulesExpanded && (
                  <div className="space-y-1.5">
                    {instantRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center justify-between py-2 px-3 bg-card border rounded-xl hover:shadow-card transition-shadow"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-xs truncate">{rule.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Priority {rule.priority}
                            {rule.conditions.length > 0 && ` · ${rule.conditions.length} condition${rule.conditions.length !== 1 ? 's' : ''}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setEditingRule(rule)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeletingRuleId(rule.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Table Features */}
            {table.features && table.features.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Features</h4>
                <div className="flex flex-wrap gap-1.5">
                  {table.features.map((feature, index) => (
                    <Badge key={index} variant="outline" className="text-[10px] rounded-full">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Bottom CTA bar */}
        <div className="p-4 border-t bg-card flex-shrink-0">
          {assignedBooking ? (
            <Button
              className="w-full h-12 touch-target bg-muted-foreground hover:bg-muted-foreground/90 text-white shadow-card active:scale-[0.97] transition-transform"
              variant="default"
              onClick={() => setShowCompleteConfirm(true)}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Complete & Free Table
            </Button>
          ) : table.is_active ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button className="flex-1 h-12 touch-target shadow-card active:scale-[0.97] transition-transform" variant="secondary" onClick={onSeatWalkIn}>
                  <User className="w-4 h-4 mr-2" />
                  Walk-in
                </Button>
                <Button className="flex-1 h-12 touch-target shadow-card active:scale-[0.97] transition-transform" variant="default" onClick={onNewReservation}>
                  <CalendarPlus className="w-4 h-4 mr-2" />
                  Reservation
                </Button>
              </div>
              {onToggleActive && (
                <Button
                  className="w-full h-10 touch-target active:scale-[0.97] transition-transform"
                  variant="outline"
                  onClick={() => {
                    if (assignedBooking) {
                      const guestName = resolveGuestName(assignedBooking)
                      toast.error(`Cannot disable — ${guestName} is currently seated/assigned`)
                      return
                    }
                    if (upcomingBookings.length > 0) {
                      const count = upcomingBookings.length
                      toast.error(`Cannot disable — ${count} upcoming booking${count > 1 ? 's' : ''} assigned to this table`)
                      return
                    }
                    onToggleActive(table.id, false)
                    onClose()
                  }}
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Disable Table
                </Button>
              )}
            </div>
          ) : (
            onToggleActive ? (
              <Button
                className="w-full h-12 touch-target shadow-card active:scale-[0.97] transition-transform"
                variant="default"
                onClick={() => { onToggleActive(table.id, true); onClose() }}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Enable Table
              </Button>
            ) : null
          )}
        </div>
      </SheetContent>
    </Sheet>

    {/* Edit Instant Rule Dialog */}
    <RuleFormDialog
      open={!!editingRule}
      onOpenChange={(open) => { if (!open) setEditingRule(null) }}
      rule={editingRule}
      onDelete={editingRule ? () => {
        deleteRule.mutate({ id: editingRule.id, tableId: table.id, restaurantId: table.restaurant_id })
        setEditingRule(null)
      } : undefined}
      onSave={(updates) => {
        if (!editingRule) return
        updateRule.mutate({ id: editingRule.id, ...updates })
        setEditingRule(null)
      }}
    />

    {/* Delete Confirmation */}
    <AlertDialog open={!!deletingRuleId} onOpenChange={(open) => { if (!open) setDeletingRuleId(null) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete instant rule?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the instant booking rule from this table.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setDeletingRuleId(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (!deletingRuleId) return
              deleteRule.mutate({
                id: deletingRuleId,
                tableId: table.id,
                restaurantId: table.restaurant_id,
              })
              setDeletingRuleId(null)
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Complete & Free Table confirmation */}
    <AlertDialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Complete & Free Table?</AlertDialogTitle>
          <AlertDialogDescription>
            Check out {assignedBooking ? resolveGuestName(assignedBooking) : 'the guest'} and mark Table {table.table_number} as available.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (assignedBooking && onCompleteAndFree) {
                onCompleteAndFree(assignedBooking.id)
              }
              setShowCompleteConfirm(false)
              onClose()
            }}
          >
            Complete & Free
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
