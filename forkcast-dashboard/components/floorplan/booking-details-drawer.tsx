// components/floorplan/booking-details-drawer.tsx
"use client"

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import {
  Users,
  Clock,
  Phone,
  Mail,
  MessageSquare,
  CheckCircle,
  XCircle,
  UserCheck,
  Table2,
  ChevronRight,
  LogOut,
  Star,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import type { RestaurantTable, Booking } from '@/types'
import { isSeatedStatus, resolveGuestName, getInitials } from '@/lib/constants/floorplan'

interface BookingDetailsDrawerProps {
  booking: Booking | null
  suggestedTables: RestaurantTable[]
  allTables: RestaurantTable[]
  isOpen: boolean
  onClose: () => void
  onAssignTable: (tableId: string) => void
  onAssignMultipleTables?: (tableIds: string[]) => void
  onUpdateStatus: (status: string) => void
}

const statusColors: Record<string, string> = {
  pending: 'bg-[hsl(var(--booking-pending))]',
  confirmed: 'bg-[hsl(var(--booking-confirmed))]',
  arrived: 'bg-[hsl(var(--booking-seated))]',
  seated: 'bg-primary',
  ordered: 'bg-primary',
  appetizers: 'bg-primary',
  main_course: 'bg-primary',
  dessert: 'bg-primary',
  payment: 'bg-primary',
  completed: 'bg-[hsl(var(--booking-completed))]',
  no_show: 'bg-[hsl(var(--booking-noshow))]',
  cancelled_by_user: 'bg-destructive',
  declined_by_restaurant: 'bg-destructive',
}

export function BookingDetailsDrawer({
  booking,
  suggestedTables,
  allTables,
  isOpen,
  onClose,
  onAssignTable,
  onAssignMultipleTables,
  onUpdateStatus,
}: BookingDetailsDrawerProps) {
  const [mergingTables, setMergingTables] = useState(false)
  const [selectedMergeTableIds, setSelectedMergeTableIds] = useState<string[]>([])
  const [pendingAction, setPendingAction] = useState<{ type: 'decline' | 'no_show' | 'complete' | 'cancel'; status: string } | null>(null)

  // Reset merge state when booking changes or drawer closes
  useEffect(() => {
    if (!isOpen || !booking) {
      setMergingTables(false)
      setSelectedMergeTableIds([])
      setPendingAction(null)
    }
  }, [isOpen, booking?.id])

  if (!booking) return null

  const bookingTime = new Date(booking.booking_time)
  const guestName = resolveGuestName(booking)
  const phone = booking.guest_phone || booking.user?.phone_number
  const email = booking.guest_email || booking.user?.email
  const assignedTables = booking.tables?.map((bt: any) => bt.table?.table_number).filter(Boolean)

  const isPending = booking.status === 'pending'
  const isConfirmed = booking.status === 'confirmed'
  const hasNoTables = !booking.tables || booking.tables.length === 0
  const isArrived = booking.status === 'arrived'
  const isSeated = isSeatedStatus(booking.status)

  // Calculate combined capacity of selected merge tables
  const mergeCapacity = selectedMergeTableIds.reduce((sum, id) => {
    const t = allTables.find(tbl => tbl.id === id)
    return sum + (t?.max_capacity || 0)
  }, 0)

  const handleToggleMergeTable = (tableId: string) => {
    setSelectedMergeTableIds(prev =>
      prev.includes(tableId)
        ? prev.filter(id => id !== tableId)
        : [...prev, tableId]
    )
  }

  const handleConfirmMerge = () => {
    if (selectedMergeTableIds.length === 0) return
    if (selectedMergeTableIds.length > 1 && !onAssignMultipleTables) {
      toast.error('Cannot merge multiple tables — feature not available')
      return
    }
    if (onAssignMultipleTables) {
      onAssignMultipleTables(selectedMergeTableIds)
    } else {
      onAssignTable(selectedMergeTableIds[0])
    }
    setMergingTables(false)
    setSelectedMergeTableIds([])
  }

  const initials = getInitials(guestName)

  return (
    <>
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:w-[360px] md:w-[400px] sm:max-w-md p-0 flex flex-col" aria-label={`Booking details for ${guestName}`}>
        {/* Header — hostess-hub style with rounded-2xl avatar */}
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-3">
            <div className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-card flex-shrink-0',
              statusColors[booking.status] || 'bg-muted'
            )}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold truncate">{guestName}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5" />
                <span className="tabular-nums">{format(bookingTime, 'MMM d, HH:mm')}</span>
                <span className="mx-0.5">•</span>
                <Users className="w-3.5 h-3.5" />
                <span>{booking.party_size}</span>
              </div>
            </div>
            <Badge className={cn('text-white text-[10px] px-2 py-0.5 shadow-sm flex-shrink-0', statusColors[booking.status] || 'bg-muted')}>
              {booking.status.replace(/_/g, ' ')}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Contact Info */}
            <div className="rounded-xl border bg-card p-3 shadow-card space-y-2">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contact</h4>
              {phone && (
                <a href={`tel:${phone}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  {phone}
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  {email}
                </a>
              )}
              {!phone && !email && (
                <p className="text-xs text-muted-foreground">No contact info</p>
              )}
            </div>

            {/* Current Table Assignment */}
            {assignedTables && assignedTables.length > 0 && (
              <div className="rounded-xl border bg-card p-3 shadow-card">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Assigned Table</h4>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <Table2 className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-sm">Table {assignedTables.join(', ')}</span>
                </div>
              </div>
            )}

            {/* Special Requests */}
            {booking.special_requests && (
              <div className="rounded-xl border bg-card p-3 shadow-card">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Special Requests</h4>
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm">{booking.special_requests}</p>
                </div>
              </div>
            )}

            {/* Occasion */}
            {booking.occasion && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Occasion</span>
                <Badge variant="outline" className="text-xs rounded-full">{booking.occasion}</Badge>
              </div>
            )}

            {/* Dietary Notes */}
            {booking.dietary_notes && booking.dietary_notes.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dietary Notes</h4>
                <div className="flex flex-wrap gap-1.5">
                  {booking.dietary_notes.map((note, index) => (
                    <Badge key={index} variant="outline" className="text-[10px] rounded-full">
                      {note}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Tables (for pending/confirmed bookings without table) */}
            {(isPending || isConfirmed) && (!assignedTables || assignedTables.length === 0) && suggestedTables.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {mergingTables ? 'Select tables to merge' : 'Suggested Tables'}
                  </h4>
                  <button
                    onClick={() => {
                      setMergingTables(!mergingTables)
                      setSelectedMergeTableIds([])
                    }}
                    className={cn(
                      "text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors",
                      mergingTables
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {mergingTables ? 'Cancel Merge' : 'Merge Tables'}
                  </button>
                </div>

                {/* Merge capacity indicator */}
                {mergingTables && selectedMergeTableIds.length > 0 && (
                  <div className="flex items-center justify-between p-2.5 mb-2 bg-primary/10 border border-primary/30 rounded-xl text-xs shadow-card">
                    <span>
                      Combined: <strong>{mergeCapacity} seats</strong> for {booking.party_size} guests
                    </span>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={mergeCapacity < booking.party_size}
                      onClick={handleConfirmMerge}
                    >
                      Assign {selectedMergeTableIds.length} tables
                    </Button>
                  </div>
                )}

                <div className="space-y-1.5">
                  {suggestedTables.slice(0, mergingTables ? 10 : 5).map((table, idx) => {
                    const section = (table as any).section as { name?: string; max_covers?: number | null } | undefined
                    const isSelectedForMerge = selectedMergeTableIds.includes(table.id)
                    const isBestFit = idx === 0 && !mergingTables
                    return (
                      <button
                        key={table.id}
                        onClick={() => {
                          if (mergingTables) {
                            handleToggleMergeTable(table.id)
                          } else {
                            onAssignTable(table.id)
                          }
                        }}
                        className={cn(
                          "w-full flex items-center justify-between p-2.5 rounded-xl transition-all border",
                          "hover:shadow-card active:scale-[0.98]",
                          mergingTables && isSelectedForMerge
                            ? "bg-primary/15 border-primary shadow-card"
                            : isBestFit
                              ? "bg-[hsl(var(--status-available)/.1)] border-[hsl(var(--status-available)/.4)] shadow-card"
                              : "bg-card border-border hover:border-primary/30"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          {mergingTables && (
                            <div className={cn(
                              "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                              isSelectedForMerge ? "bg-primary border-primary" : "border-muted-foreground/40"
                            )}>
                              {isSelectedForMerge && (
                                <CheckCircle className="w-3.5 h-3.5 text-white" />
                              )}
                            </div>
                          )}
                          <div className={cn(
                            'w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-sm',
                            isBestFit ? 'bg-status-available' : 'bg-muted-foreground/60'
                          )}>
                            {table.table_number}
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-sm">Table {table.table_number}</p>
                              {isBestFit && (
                                <Badge className="bg-status-available text-white text-[9px] px-1 py-0 h-4">
                                  <Star className="w-2.5 h-2.5 mr-0.5" />Best
                                </Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              {table.min_capacity}–{table.max_capacity} seats • {table.table_type}
                              {section?.name && ` • ${section.name}`}
                            </p>
                          </div>
                        </div>
                        {!mergingTables && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Bottom action bar */}
        <div className="p-4 border-t bg-card">
          {isPending && (
            <div className="flex gap-2">
              <Button
                className="flex-1 h-12 touch-target bg-[hsl(var(--booking-confirmed))] hover:bg-[hsl(var(--booking-confirmed)/.85)] text-white shadow-card"
                onClick={() => onUpdateStatus('confirmed')}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirm
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12 touch-target border-destructive/50 text-destructive hover:bg-destructive hover:text-white"
                onClick={() => setPendingAction({ type: 'decline', status: 'declined_by_restaurant' })}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Decline
              </Button>
            </div>
          )}
          {isConfirmed && (
            <div className="flex gap-2">
              <Button
                className="flex-1 h-12 touch-target shadow-card"
                onClick={() => onUpdateStatus('arrived')}
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Mark as Arrived
              </Button>
              {hasNoTables && (
                <Button
                  variant="outline"
                  className="h-12 touch-target border-destructive/50 text-destructive hover:bg-destructive hover:text-white"
                  onClick={() => setPendingAction({ type: 'cancel', status: 'cancelled_by_restaurant' })}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              )}
              {!hasNoTables && bookingTime < new Date() && (
                <Button
                  variant="outline"
                  className="h-12 touch-target border-destructive/50 text-destructive hover:bg-destructive hover:text-white"
                  onClick={() => setPendingAction({ type: 'no_show', status: 'no_show' })}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  No Show
                </Button>
              )}
            </div>
          )}
          {isArrived && (
            <Button
              className="w-full h-12 touch-target shadow-card"
              onClick={() => onUpdateStatus('seated')}
            >
              <Table2 className="w-4 h-4 mr-2" />
              Seat Guest
            </Button>
          )}
          {isSeated && (
            <Button
              className="w-full h-12 touch-target bg-muted-foreground hover:bg-muted-foreground/90 text-white shadow-card"
              variant="secondary"
              onClick={() => setPendingAction({ type: 'complete', status: 'completed' })}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Complete & Free Table
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>

    {/* Confirmation dialog for destructive actions */}
    <AlertDialog open={!!pendingAction} onOpenChange={(open) => { if (!open) setPendingAction(null) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className={cn('w-5 h-5', pendingAction?.type === 'complete' ? 'text-primary' : 'text-destructive')} />
            {pendingAction?.type === 'decline' && 'Decline Request?'}
            {pendingAction?.type === 'no_show' && 'Mark as No-show?'}
            {pendingAction?.type === 'complete' && 'Check Out Guest?'}
            {pendingAction?.type === 'cancel' && 'Cancel Booking?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pendingAction?.type === 'decline' && `Decline ${guestName}'s booking request. The guest will be notified.`}
            {pendingAction?.type === 'no_show' && `Mark ${guestName}'s reservation as a no-show. This action cannot be easily undone.`}
            {pendingAction?.type === 'complete' && `Complete ${guestName}'s visit and free up the table.`}
            {pendingAction?.type === 'cancel' && `Cancel ${guestName}'s confirmed booking. The guest will be notified.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              pendingAction?.type !== 'complete' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            )}
            onClick={() => {
              if (pendingAction) onUpdateStatus(pendingAction.status)
              setPendingAction(null)
            }}
          >
            {pendingAction?.type === 'decline' && 'Decline'}
            {pendingAction?.type === 'no_show' && 'Mark No-show'}
            {pendingAction?.type === 'complete' && 'Check Out'}
            {pendingAction?.type === 'cancel' && 'Cancel Booking'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  )
}
