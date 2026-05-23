// components/floorplan/bookings-panel.tsx
"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { format, isToday, isSameDay, differenceInMinutes } from 'date-fns'
import { useDebounce } from '@/hooks/use-debounce'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Clock,
  Users,
  Search,
  Plus,
  PanelRightClose,
  Timer,
  CheckCircle,
  XCircle,
  Phone,
  MapPin,
  ExternalLink,
  ChevronDown,
  LogIn,
  LogOut,
  MessageSquare,
  AlertCircle,
  CalendarCheck,
  AlertTriangle,
  Eye,
} from 'lucide-react'
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
import { cn } from '@/lib/utils'
import type { Booking, RestaurantSection, RestaurantShift } from '@/types'
import {
  ACTIVE_BOOKING_STATUSES,
  TERMINAL_BOOKING_STATUSES,
  isSeatedStatus,
  isTerminalStatus,
  resolveGuestName,
  getTimerColor,
} from '@/lib/constants/floorplan'
import { classifyBookingInShift, formatShiftRange } from '@/lib/utils/shifts'

// Confirmation action types for destructive operations
type ConfirmAction = {
  type: 'no_show' | 'decline' | 'checkout' | 'unassign' | 'cancel'
  bookingId: string
  guestName: string
}

const confirmationConfig: Record<ConfirmAction['type'], { title: string; description: (name: string) => string; actionLabel: string; variant: 'destructive' | 'default' }> = {
  no_show: {
    title: 'Mark as No-show?',
    description: (name) => `Mark ${name}'s reservation as a no-show. This action cannot be easily undone.`,
    actionLabel: 'Mark No-show',
    variant: 'destructive',
  },
  decline: {
    title: 'Decline Request?',
    description: (name) => `Decline ${name}'s booking request. The guest will be notified.`,
    actionLabel: 'Decline',
    variant: 'destructive',
  },
  checkout: {
    title: 'Check Out Guest?',
    description: (name) => `Complete ${name}'s visit and free up the table.`,
    actionLabel: 'Check Out',
    variant: 'default',
  },
  unassign: {
    title: 'Unassign Table?',
    description: (name) => `Remove the table assignment for ${name}'s booking. The booking will remain confirmed.`,
    actionLabel: 'Unassign',
    variant: 'destructive',
  },
  cancel: {
    title: 'Cancel Booking?',
    description: (name) => `Cancel ${name}'s confirmed booking. The guest will be notified.`,
    actionLabel: 'Cancel Booking',
    variant: 'destructive',
  },
}

interface BookingsPanelProps {
  bookings: Booking[]
  sections?: RestaurantSection[]
  selectedBookingId: string | null
  selectedDate: Date
  selectedTime: string
  selectedShift?: RestaurantShift | null
  searchQuery: string
  onSearchChange: (query: string) => void
  onDateChange: (date: Date) => void
  onTimeChange: (time: string) => void
  onSelectBooking: (bookingId: string | null) => void
  onDragBookingStart: (bookingId: string) => void
  onNewBooking: () => void
  onAddWalkIn: () => void
  onAddToWaitlist: () => void
  onUpdateBookingStatus: (bookingId: string, status: string) => void
  onUnassignBooking?: (bookingId: string) => void
  onGoToFloorplan?: (bookingId: string) => void
  onStartAssign?: (bookingId: string) => void
  onVisualizeBooking?: (bookingId: string) => void
  onAcceptAndAssign?: (bookingId: string) => void
  onAcceptBooking?: (bookingId: string) => void
  onNow: () => void
  onClose: () => void
  allPendingRequests?: Booking[]
  restaurantTurnoverTime?: number // Restaurant's table turnover time in minutes
  allBookings?: Booking[] // All bookings (for finding next booking on same table)
  isCollapsed?: boolean
  onToggleCollapsed?: () => void
}

// --- Status strip color mapping (uses --booking-* CSS variables from globals.css) ---
const statusStripColors: Record<string, string> = {
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

export function BookingsPanel({
  bookings,
  sections = [],
  selectedBookingId,
  selectedDate,
  selectedTime,
  selectedShift,
  searchQuery,
  onSearchChange,
  onDateChange,
  onTimeChange,
  onSelectBooking,
  onDragBookingStart,
  onNewBooking,
  onAddWalkIn: _onAddWalkIn,
  onAddToWaitlist: _onAddToWaitlist,
  onUpdateBookingStatus,
  onUnassignBooking,
  onGoToFloorplan,
  onStartAssign,
  onVisualizeBooking,
  onAcceptAndAssign,
  onAcceptBooking,
  allPendingRequests,
  onNow,
  onClose,
  restaurantTurnoverTime = 90,
  allBookings = [],
  isCollapsed = false,
  onToggleCollapsed,
}: BookingsPanelProps) {
  const [activeTab, setActiveTab] = useState('upcoming')
  const isTodaySelected = isToday(selectedDate)

  // Show "Jump to now" when date is not today OR time differs from current time
  const currentTimeStr = format(new Date(), 'HH:mm')
  const isNotNow = !isTodaySelected || selectedTime !== currentTimeStr

  // Confirmation dialog state for destructive actions
  const [pendingAction, setPendingAction] = useState<ConfirmAction | null>(null)

  const requestConfirm = (action: ConfirmAction) => setPendingAction(action)

  const executeConfirmedAction = () => {
    if (!pendingAction) return
    switch (pendingAction.type) {
      case 'no_show':
        onUpdateBookingStatus(pendingAction.bookingId, 'no_show')
        break
      case 'decline':
        onUpdateBookingStatus(pendingAction.bookingId, 'declined_by_restaurant')
        break
      case 'checkout':
        onUpdateBookingStatus(pendingAction.bookingId, 'completed')
        break
      case 'unassign':
        onUnassignBooking
          ? onUnassignBooking(pendingAction.bookingId)
          : onUpdateBookingStatus(pendingAction.bookingId, 'confirmed')
        break
      case 'cancel':
        onUpdateBookingStatus(pendingAction.bookingId, 'cancelled_by_restaurant')
        break
    }
    setPendingAction(null)
  }

  // Filter bookings (debounced to avoid filtering on every keystroke)
  const debouncedSearchQuery = useDebounce(searchQuery, 250)
  const matchesSearch = useCallback((booking: Booking) => {
    if (!debouncedSearchQuery) return true
    const q = debouncedSearchQuery.toLowerCase()
    return (
      (booking.guest_name?.toLowerCase() || '').includes(q) ||
      (booking.guest_phone || '').includes(debouncedSearchQuery) ||
      (booking.user?.full_name?.toLowerCase() || '').includes(q) ||
      (booking.user?.phone_number || '').includes(debouncedSearchQuery) ||
      (booking.guest_email || '').toLowerCase().includes(q)
    )
  }, [debouncedSearchQuery])

  // Filter bookings by shift window when a shift is selected
  // Includes boundary bookings (overlap with shift window)
  const filteredBookings = useMemo(() => {
    let list = bookings.filter(matchesSearch)
    if (selectedShift) {
      list = list.filter((b) => {
        // Never filter out physically present guests — they're happening NOW regardless
        if (isSeatedStatus(b.status) || b.status === 'arrived') return true
        const klass = classifyBookingInShift(b, selectedShift, restaurantTurnoverTime)
        return klass !== 'outside'
      })
    }
    return list
  }, [bookings, matchesSearch, selectedShift, restaurantTurnoverTime])

  // Categorize bookings
  const upcomingBookings = useMemo(() => {
    return filteredBookings
      .filter(b => ['confirmed', 'arrived'].includes(b.status))
      .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
  }, [filteredBookings])

  const seatedBookings = useMemo(() => {
    return filteredBookings.filter(b => isSeatedStatus(b.status))
  }, [filteredBookings])

  // Requests
  const { pendingRequests, computedPending } = useMemo(() => {
    const acceptedStatuses = ACTIVE_BOOKING_STATUSES as readonly string[]
    const declinedStatuses = [...TERMINAL_BOOKING_STATUSES, 'declined_by_user', 'cancelled']

    const computed = filteredBookings.filter(
      (b) => !acceptedStatuses.includes(b.status) && !declinedStatuses.includes(b.status)
    )

    // When a shift is active, only include pending requests that overlap the shift window
    // AND fall on the selected date. Requests for other dates stay hidden while filtering.
    let externalPending = (allPendingRequests || []).filter(matchesSearch)
    if (selectedShift) {
      const selectedDateStr = selectedDate.toISOString().slice(0, 10)
      externalPending = externalPending.filter((b) => {
        if (new Date(b.booking_time).toISOString().slice(0, 10) !== selectedDateStr) return false
        return classifyBookingInShift(b, selectedShift, restaurantTurnoverTime) !== 'outside'
      })
    }

    const pendingMap = new Map<string, Booking>()
    for (const b of [...externalPending, ...computed]) {
      pendingMap.set(b.id, b)
    }
    const pending = Array.from(pendingMap.values())
      .filter(b => !acceptedStatuses.includes(b.status) && !declinedStatuses.includes(b.status))
      .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())

    return { pendingRequests: pending, computedPending: computed }
  }, [filteredBookings, allPendingRequests, matchesSearch, selectedShift, selectedDate, restaurantTurnoverTime])

  const unassignedCount = useMemo(() => {
    return upcomingBookings.filter(b => b.status === 'confirmed' && !(b.tables && b.tables.length > 0)).length
  }, [upcomingBookings])

  const hasPendingRequests = pendingRequests.length > 0

  useEffect(() => {
    if (!isTodaySelected && activeTab === 'seated') {
      setActiveTab('upcoming')
    }
  }, [isTodaySelected, activeTab])

  // Auto-switch to Requests tab when new requests arrive (not just on first appearance)
  const prevPendingCount = useRef(0)
  useEffect(() => {
    if (pendingRequests.length > prevPendingCount.current && pendingRequests.length > 0) {
      // New request(s) arrived — auto-switch to Requests tab
      setActiveTab('requests')
    }
    prevPendingCount.current = pendingRequests.length
  }, [pendingRequests.length])

  return (
    <div
      className={cn(
        "flex flex-col h-full border-r transition-colors duration-300",
        isTodaySelected ? "bg-card" : "bg-destructive/10"
      )}
    >
      {/* Header */}
      <div className={cn("px-2 py-2.5 border-b flex items-center gap-2", isCollapsed && "justify-center")}>
        {!isCollapsed && (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search guest, phone..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 pl-9 text-xs touch-target"
            />
          </div>
        )}
        {onToggleCollapsed ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              "h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground",
              isCollapsed && "mx-auto"
            )}
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? "Expand bookings panel" : "Collapse bookings panel"}
          >
            <PanelRightClose
              className={cn(
                "h-4 w-4 transition-transform",
                isCollapsed && "rotate-180"
              )}
            />
          </Button>
        ) : onClose ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close bookings panel"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {/* When collapsed, show vertical text labels */}
      {isCollapsed && (
        <div className="flex-1 flex flex-col items-center gap-1.5 pt-3 px-1">
          <button
            onClick={() => { setActiveTab('seated'); onToggleCollapsed?.() }}
            className={cn(
              "w-full px-1 py-2 rounded-lg flex flex-col items-center justify-center transition-colors text-center",
              activeTab === 'seated' ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
            )}
            title={`Seated (${seatedBookings.length})`}
          >
            <span className="text-[10px] font-semibold leading-tight">Seated</span>
            <span className="text-[10px] tabular-nums">{seatedBookings.length}</span>
          </button>
          <button
            onClick={() => { setActiveTab('upcoming'); onToggleCollapsed?.() }}
            className={cn(
              "w-full px-1 py-2 rounded-lg flex flex-col items-center justify-center transition-colors text-center",
              activeTab === 'upcoming' ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
            )}
            title={`Arriving (${upcomingBookings.length})`}
          >
            <span className="text-[10px] font-semibold leading-tight">Arriving</span>
            <span className="text-[10px] tabular-nums">{upcomingBookings.length}</span>
          </button>
          <button
            onClick={() => { setActiveTab('requests'); onToggleCollapsed?.() }}
            className={cn(
              "w-full px-1 py-2 rounded-lg flex flex-col items-center justify-center transition-colors relative text-center",
              activeTab === 'requests' ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
            )}
            title="Requests"
          >
            <span className="text-[10px] font-semibold leading-tight">Requests</span>
            {hasPendingRequests && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-[hsl(var(--status-overstay))] rounded-full motion-safe:animate-pulse" />
            )}
          </button>
          <div className="mt-auto pb-3">
            <button
              onClick={onNewBooking}
              className="w-full px-1 py-2 rounded-lg flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              title="New booking"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Shift filter banner — production-grade filter state visible at arm's length */}
      {!isCollapsed && selectedShift && (
        <div
          role="status"
          aria-live="polite"
          aria-label={`Filtered to ${selectedShift.name} shift, ${formatShiftRange(selectedShift)}, ${filteredBookings.length} bookings`}
          className="px-4 py-2.5 border-b border-l-[3px] flex items-center justify-between"
          style={{
            backgroundColor: selectedShift.color ? `${selectedShift.color}14` : 'hsl(var(--muted) / 0.4)',
            borderBottomColor: selectedShift.color ? `${selectedShift.color}33` : undefined,
            borderLeftColor: selectedShift.color || 'hsl(var(--primary))',
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground truncate leading-tight">
                {selectedShift.name}
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums leading-tight mt-0.5">
                {formatShiftRange(selectedShift)}
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 tabular-nums flex-shrink-0 font-semibold">
            {filteredBookings.length} in shift
          </Badge>
        </div>
      )}

      {/* Not-now banner (different date or different time) */}
      {!isCollapsed && isNotNow && (
        <div className="px-4 py-3 border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {isTodaySelected
                ? `Viewing ${selectedTime}`
                : `Viewing ${format(selectedDate, 'EEEE, MMM d')}`}
            </span>
            <Button size="sm" variant="secondary" className="h-7 text-[10px] px-2" onClick={onNow}>
              Jump to now
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      {!isCollapsed && (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        {isTodaySelected ? (
          <TabsList className="mx-2 mt-3 flex w-auto items-center gap-1 overflow-x-auto bg-muted/60 h-9 p-0.5 rounded-lg scrollbar-hide">
            <TabsTrigger
              value="seated"
              className="flex-shrink-0 text-[11px] font-medium h-8 px-2 rounded-md data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-sm"
            >
              Seated ({seatedBookings.length})
            </TabsTrigger>
            <TabsTrigger
              value="upcoming"
              className="flex-shrink-0 text-[11px] font-medium h-8 px-2 rounded-md data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-sm"
            >
              Arriving ({upcomingBookings.length})
            </TabsTrigger>
            <TabsTrigger
              value="requests"
              className={cn(
                "flex-shrink-0 text-[11px] font-medium h-8 px-2 rounded-md data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-sm relative",
                hasPendingRequests && "animate-request-pulse"
              )}
            >
              Requests
              {hasPendingRequests && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[hsl(var(--status-overstay))] rounded-full motion-safe:animate-pulse" />
              )}
            </TabsTrigger>
          </TabsList>
        ) : (
          <TabsList className="mx-2 mt-2 flex w-auto items-center gap-1 overflow-x-auto bg-muted/60 h-9 p-0.5 rounded-lg scrollbar-hide">
            <TabsTrigger
              value="upcoming"
              className="flex-shrink-0 text-[11px] font-medium h-8 px-2 rounded-md data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-sm"
            >
              Upcoming ({upcomingBookings.filter(b => b.tables && b.tables.length > 0).length})
            </TabsTrigger>
            <TabsTrigger
              value="unassigned"
              className="flex-shrink-0 text-[11px] font-medium h-8 px-2 rounded-md data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-sm"
            >
              Unassigned ({unassignedCount})
            </TabsTrigger>
            <TabsTrigger
              value="requests"
              className={cn(
                "flex-shrink-0 text-[11px] font-medium h-8 px-2 rounded-md data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-sm relative",
                hasPendingRequests && "animate-request-pulse"
              )}
            >
              Requests
              {hasPendingRequests && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[hsl(var(--status-overstay))] rounded-full motion-safe:animate-pulse" />
              )}
            </TabsTrigger>
          </TabsList>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-2 scrollbar-hide">
          <TabsContent value="seated" className="mt-0 space-y-2">
            {seatedBookings.length === 0 ? (
              <EmptyState icon={<Users className="w-10 h-10" />} text="No guests seated" />
            ) : (
              seatedBookings.map((booking) => {
                const name = resolveGuestName(booking)
                return (
                <BookingItem
                  key={booking.id}
                  booking={booking}
                  sections={sections}
                  isSelected={selectedBookingId === booking.id}
                  variant="seated"
                  currentTime={selectedTime}
                  restaurantTurnoverTime={restaurantTurnoverTime}
                  allBookings={allBookings}
                  onSelect={() => onSelectBooking(booking.id)}
                  onDragStart={() => onDragBookingStart(booking.id)}
                  onCheckIn={(id) => onUpdateBookingStatus(id, 'seated')}
                  onCheckOut={(id) => requestConfirm({ type: 'checkout', bookingId: id, guestName: name })}
                  onNoShow={(id) => requestConfirm({ type: 'no_show', bookingId: id, guestName: name })}
                  onUnassign={(id) => requestConfirm({ type: 'unassign', bookingId: id, guestName: name })}
                  onGoToFloorplan={(id) => onGoToFloorplan ? onGoToFloorplan(id) : onSelectBooking(id)}
                  onStartAssign={onStartAssign ? (id) => onStartAssign(id) : undefined}
                  onCancelBooking={(id) => requestConfirm({ type: 'cancel', bookingId: id, guestName: name })}
                />
                )
              })
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="mt-0 space-y-2">
            {(() => {
              if (isTodaySelected) {
                return upcomingBookings.length === 0 ? (
                  <EmptyState icon={<Clock className="w-10 h-10" />} text="No upcoming bookings" />
                ) : (
                  upcomingBookings.map((booking) => {
                    const name = resolveGuestName(booking)
                    return (
                    <BookingItem
                      key={booking.id}
                      booking={booking}
                      sections={sections}
                      isSelected={selectedBookingId === booking.id}
                      onSelect={() => onSelectBooking(booking.id)}
                      onDragStart={() => onDragBookingStart(booking.id)}
                      variant="arrivals"
                      currentTime={selectedTime}
                      onCheckIn={(id) => onUpdateBookingStatus(id, 'seated')}
                      onNoShow={(id) => requestConfirm({ type: 'no_show', bookingId: id, guestName: name })}
                      onUnassign={(id) => requestConfirm({ type: 'unassign', bookingId: id, guestName: name })}
                      onGoToFloorplan={(id) => onGoToFloorplan ? onGoToFloorplan(id) : onSelectBooking(id)}
                      onStartAssign={onStartAssign ? (id) => onStartAssign(id) : undefined}
                      onCancelBooking={(id) => requestConfirm({ type: 'cancel', bookingId: id, guestName: name })}
                    />
                    )
                  })
                )
              }

              const assigned = upcomingBookings.filter(b => b.tables && b.tables.length > 0)
              return assigned.length === 0 ? (
                <EmptyState icon={<Clock className="w-10 h-10" />} text="No assigned upcoming bookings" />
              ) : (
                assigned.map((booking) => {
                  const name = resolveGuestName(booking)
                  return (
                  <BookingItem
                    key={booking.id}
                    booking={booking}
                    sections={sections}
                    isSelected={selectedBookingId === booking.id}
                    onSelect={() => onSelectBooking(booking.id)}
                    onDragStart={() => onDragBookingStart(booking.id)}
                    onCheckIn={(id) => onUpdateBookingStatus(id, 'seated')}
                    onNoShow={(id) => requestConfirm({ type: 'no_show', bookingId: id, guestName: name })}
                    onUnassign={(id) => requestConfirm({ type: 'unassign', bookingId: id, guestName: name })}
                    onGoToFloorplan={(id) => onGoToFloorplan ? onGoToFloorplan(id) : onSelectBooking(id)}
                    onStartAssign={onStartAssign ? (id) => onStartAssign(id) : undefined}
                    onCancelBooking={(id) => requestConfirm({ type: 'cancel', bookingId: id, guestName: name })}
                  />
                  )
                })
              )
            })()}
          </TabsContent>

          <TabsContent value="unassigned" className="mt-0 space-y-2">
            {(() => {
              const unassigned = upcomingBookings.filter(b => b.status === 'confirmed' && !(b.tables && b.tables.length > 0))
              return unassigned.length === 0 ? (
                <EmptyState icon={<Clock className="w-10 h-10" />} text="No unassigned bookings" />
              ) : (
                unassigned.map((booking) => {
                  const name = resolveGuestName(booking)
                  return (
                  <BookingItem
                    key={booking.id}
                    booking={booking}
                    sections={sections}
                    isSelected={selectedBookingId === booking.id}
                    onSelect={() => onSelectBooking(booking.id)}
                    onDragStart={() => onDragBookingStart(booking.id)}
                    onCheckIn={(id) => onUpdateBookingStatus(id, 'seated')}
                    onNoShow={(id) => requestConfirm({ type: 'no_show', bookingId: id, guestName: name })}
                    onUnassign={(id) => requestConfirm({ type: 'unassign', bookingId: id, guestName: name })}
                    onGoToFloorplan={(id) => onGoToFloorplan ? onGoToFloorplan(id) : onSelectBooking(id)}
                    onStartAssign={onStartAssign ? (id) => onStartAssign(id) : undefined}
                    onCancelBooking={(id) => requestConfirm({ type: 'cancel', bookingId: id, guestName: name })}
                  />
                  )
                })
              )
            })()}
          </TabsContent>

          <TabsContent value="requests" className="mt-0 space-y-2">
            {pendingRequests.length === 0 ? (
              <EmptyState icon={<AlertCircle className="w-10 h-10" />} text="No pending requests" />
            ) : (
              <div className="space-y-2">
                {pendingRequests.map((booking) => {
                  const name = resolveGuestName(booking)
                  return (
                  <RequestCard
                    key={booking.id}
                    booking={booking}
                    sections={sections}
                    isSelected={selectedBookingId === booking.id}
                    selectedDate={selectedDate}
                    onSelect={() => onSelectBooking(booking.id)}
                    onAccept={() => onAcceptBooking ? onAcceptBooking(booking.id) : onUpdateBookingStatus(booking.id, 'confirmed')}
                    onAcceptAndAssign={() => onAcceptAndAssign?.(booking.id)}
                    onDecline={() => requestConfirm({ type: 'decline', bookingId: booking.id, guestName: name })}
                    onVisualize={() => onVisualizeBooking?.(booking.id)}
                    onGoToDate={(date) => {
                      onDateChange(date)
                      onTimeChange(format(date, 'HH:mm'))
                    }}
                  />
                  )
                })}
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>

      )}

      {/* Confirmation Dialog for destructive actions */}
      <AlertDialog open={!!pendingAction} onOpenChange={(open) => { if (!open) setPendingAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className={cn('w-5 h-5', pendingAction?.type === 'checkout' ? 'text-primary' : 'text-destructive')} />
              {pendingAction ? confirmationConfig[pendingAction.type].title : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction ? confirmationConfig[pendingAction.type].description(pendingAction.guestName) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                pendingAction?.type !== 'checkout' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              )}
              onClick={executeConfirmedAction}
            >
              {pendingAction ? confirmationConfig[pendingAction.type].actionLabel : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---- Booking Item Component (hostess-hub style) ----
function BookingItem({
  booking,
  sections = [],
  isSelected,
  variant = 'arrivals',
  currentTime,
  restaurantTurnoverTime = 90,
  allBookings = [],
  onSelect: _onSelect,
  onDragStart,
  onCheckIn,
  onCheckOut,
  onNoShow,
  onUnassign,
  onGoToFloorplan,
  onStartAssign,
  onCancelBooking,
}: {
  booking: Booking
  sections?: RestaurantSection[]
  isSelected: boolean
  variant?: 'arrivals' | 'seated'
  currentTime?: string
  restaurantTurnoverTime?: number
  allBookings?: Booking[]
  onSelect: () => void
  onDragStart: () => void
  onCheckIn?: (id: string) => void
  onCheckOut?: (id: string) => void
  onNoShow?: (id: string) => void
  onUnassign?: (id: string) => void
  onGoToFloorplan?: (id: string) => void
  onStartAssign?: (id: string) => void
  onCancelBooking?: (id: string) => void
}) {
  const bookingTime = new Date(booking.booking_time)
  const timeStr = format(bookingTime, 'h:mm a')
  const profile = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles
  const guestName = resolveGuestName(booking)
  const phone = profile?.phone_number || booking.user?.phone_number || booking.guest_phone
  const partySize = booking.party_size ?? booking.attendees ?? 1
  const assignedTables = (booking.booking_tables?.map((bt: any) => bt.table?.table_number).filter(Boolean) || booking.tables?.map((t: any) => t.table_number || t.table?.table_number).filter(Boolean) || []).join(', ')

  // Resolve section name: from assigned table's section, or booking's section_id/preferred_section
  const sectionName = (() => {
    // First, try to get from assigned tables
    const tableSectionId = booking.booking_tables?.[0]?.table?.section_id
      || (booking.tables as any)?.[0]?.table?.section_id
      || (booking.tables as any)?.[0]?.section_id
    if (tableSectionId && sections.length > 0) {
      const s = sections.find(sec => sec.id === tableSectionId)
      if (s) return s.name
    }
    // Fallback: booking-level section_id
    if (booking.section_id && sections.length > 0) {
      const s = sections.find(sec => sec.id === booking.section_id)
      if (s) return s.name
    }
    // Fallback: preferred_section text field
    return booking.preferred_section || null
  })()

  // Calculate time diff for arrivals (always relative to real current time)
  const realTimeDiff = differenceInMinutes(bookingTime, new Date())
  const isLate = variant === 'arrivals' && realTimeDiff < 0
  const lateLabel = isLate ? (() => {
    const mins = Math.abs(realTimeDiff)
    const hrs = Math.floor(mins / 60)
    const rem = mins % 60
    return hrs > 0 ? `${hrs}h ${rem}m late` : `${rem}m late`
  })() : ''
  const arrivalLabel = !isLate && variant === 'arrivals'
    ? (realTimeDiff === 0 ? 'Now' : realTimeDiff > 0 ? `in ${realTimeDiff < 60 ? `${realTimeDiff}min` : `${Math.floor(realTimeDiff / 60)}h ${realTimeDiff % 60}m`}` : '')
    : ''

  // Seated timer logic with Expected End Time and color states
  let seatedDuration: string | null = null
  let timerColor: 'green' | 'yellow' | 'red' | 'flashing-red' = 'green'
  let isFlashing = false
  
  if (variant === 'seated' && booking.seated_at) {
    const seatedAt = new Date(booking.seated_at)
    // Use actual current time — seated timer is a real-time elapsed counter
    const now = new Date()

    // Calculate time seated (counting up) — floor to 0 to prevent negative display
    const minutesSeated = Math.max(0, differenceInMinutes(now, seatedAt))
    
    // Find next booking on the same table(s)
    const bookingTableIds = booking.booking_tables?.map((bt: any) => bt.table?.id).filter(Boolean) || 
                            booking.tables?.map((t: any) => t.id || t.table?.id).filter(Boolean) || []
    
    let nextBooking: Booking | null = null
    if (bookingTableIds.length > 0) {
      const futureBookings = allBookings
        .filter(b => {
          if (b.id === booking.id) return false
          const bTableIds = b.booking_tables?.map((bt: any) => bt.table?.id).filter(Boolean) || 
                           b.tables?.map((t: any) => t.id || t.table?.id).filter(Boolean) || []
          const sharesTable = bTableIds.some(id => bookingTableIds.includes(id))
          if (!sharesTable) return false
          const bTime = new Date(b.booking_time)
          return bTime > seatedAt && 
                 !isTerminalStatus(b.status)
        })
        .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
      
      nextBooking = futureBookings[0] || null
    }
    
    // Determine Expected End Time
    let expectedEndTime: Date
    if (nextBooking) {
      expectedEndTime = new Date(nextBooking.booking_time)
    } else {
      // Use booking's turn_time_minutes if available, otherwise fall back to restaurant's table_turnover_minutes
      const bookingTurnoverTime = booking.turn_time_minutes || restaurantTurnoverTime
      // Expected End = Check-in Time + Turnover Time
      expectedEndTime = new Date(seatedAt.getTime() + bookingTurnoverTime * 60 * 1000)
    }
    
    // Calculate time remaining until Expected End
    const minutesRemaining = differenceInMinutes(expectedEndTime, now)
    
    // Determine timer color based on time remaining
    const timerResult = getTimerColor(minutesRemaining)
    timerColor = timerResult.color
    isFlashing = timerResult.isFlashing
    
    // Format seated duration
    const hours = Math.floor(minutesSeated / 60)
    const mins = minutesSeated % 60
    seatedDuration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    setExpanded(!!isSelected)
  }, [isSelected])

  const stripColor = isLate ? 'bg-destructive' : (statusStripColors[booking.status] || 'bg-muted-foreground')

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(s => !s)
  }

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('bookingId', booking.id)
        onDragStart()
      }}
      className={cn(
        'relative rounded-xl bg-card border cursor-pointer transition-all duration-150 overflow-hidden',
        'hover:shadow-card hover:border-primary/30 active:scale-[0.98]',
        isSelected ? 'border-primary shadow-elevated' : 'border-border shadow-card',
        isLate && !isSelected && 'border-destructive/40 bg-destructive/5',
      )}
    >
      {/* Compact row: strip + info + table button */}
      <div className="flex items-stretch gap-0">
        {/* Status strip */}
        <div className={cn('w-1.5 self-stretch flex-shrink-0 rounded-l-xl', stripColor)} />

        {/* Info zone — click to expand */}
        <div className="flex-[2] p-3 min-w-0 cursor-pointer" onClick={handleToggle}>
          {/* Row 1: Name + Pax */}
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-foreground truncate text-sm flex-1">{guestName}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
              <Users className="w-3.5 h-3.5" />
              {partySize}
            </span>
            <ChevronDown className={cn(
              'w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0',
              expanded && 'rotate-180'
            )} />
          </div>

          {/* Arrivals timer */}
          {variant === 'arrivals' && (isLate || arrivalLabel) && (
            <div className={cn(
              'flex items-center gap-1 text-xs font-bold tabular-nums mb-0.5',
              isLate ? 'text-destructive' : 'text-[hsl(var(--status-available))]'
            )}>
              <Timer className="w-3.5 h-3.5" />
              {isLate ? lateLabel : arrivalLabel}
            </div>
          )}

          {/* Phone */}
          {variant !== 'seated' && phone && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
              <Phone className="w-3.5 h-3.5" />
              <span>{phone}</span>
            </div>
          )}

          {/* Time + Section */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 tabular-nums">
              <Clock className="w-3.5 h-3.5" />
              {timeStr}
            </span>
            {sectionName && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {sectionName}
                </span>
              </>
            )}
          </div>

          {/* Seated duration with color states */}
          {seatedDuration && (
            <div className={cn(
              "flex items-center gap-1 mt-1.5 text-xs font-medium tabular-nums",
              timerColor === 'green' && 'text-[hsl(var(--status-available))]',
              timerColor === 'yellow' && 'text-[hsl(var(--status-highlight))]',
              timerColor === 'red' && 'text-[hsl(var(--status-taken))]',
              timerColor === 'flashing-red' && 'text-[hsl(var(--status-taken))]',
              isFlashing && 'motion-safe:animate-pulse'
            )}>
              <Timer className="w-3.5 h-3.5" />
              <span>Seated for {seatedDuration}</span>
              {timerColor === 'flashing-red' && <Badge className="bg-destructive text-white text-[10px] ml-1 shadow-sm">Past Expected End</Badge>}
            </div>
          )}
        </div>

        {/* Right column: Table Assignment — all variants */}
        <button
          className={cn(
            'flex-[1] flex flex-col items-center justify-center gap-1 border-l transition-all min-h-[60px] rounded-r-xl active:scale-[0.97]',
            assignedTables
              ? 'bg-primary/5 hover:bg-primary/10 text-primary'
              : 'bg-[hsl(var(--status-overstay)/.05)] hover:bg-[hsl(var(--status-overstay)/.1)] text-[hsl(var(--status-overstay))]',
          )}
          onClick={(e) => {
            stop(e)
            if (assignedTables) {
              onGoToFloorplan?.(booking.id)
            } else {
              onStartAssign?.(booking.id)
            }
          }}
          title={assignedTables ? 'View table on floorplan' : 'Tap to assign a table'}
        >
          <MapPin className="w-5 h-5" />
          <span className="text-xs font-bold">
            {assignedTables ? `T${assignedTables}` : 'Assign'}
          </span>
        </button>
      </div>

      {/* Expanded details + actions */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-3">
          <div className="border-t pt-3 space-y-2">
            {/* Phone (if not shown for seated) */}
            {variant === 'seated' && phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                <span>{phone}</span>
              </div>
            )}
            {/* Notes */}
            {(booking.special_requests || booking.rest_notes) ? (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{booking.special_requests || booking.rest_notes}</span>
              </div>
            ) : (
              <div className="inline-block">
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-5">Regular</Badge>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {/* Arrivals: Check In + No-show */}
            {variant === 'arrivals' && (
              <div className="grid grid-cols-2 gap-2">
                <Button size="lg" className="touch-target bg-primary hover:bg-primary/90 text-white active:scale-[0.97] transition-transform"
                  onClick={(e) => { stop(e); onCheckIn?.(booking.id) }}>
                  <LogIn className="w-4 h-4 mr-1" /> Check In
                </Button>
                <Button size="lg" variant="outline" className="touch-target active:scale-[0.97] transition-transform"
                  onClick={(e) => { stop(e); onNoShow?.(booking.id) }}>
                  <XCircle className="w-4 h-4 mr-1" /> No-show
                </Button>
              </div>
            )}

            {/* Seated: Check Out */}
            {variant === 'seated' && (
              <Button size="lg" className="w-full touch-target bg-muted-foreground hover:bg-muted-foreground/90 text-white active:scale-[0.97] transition-transform"
                onClick={(e) => { stop(e); onCheckOut?.(booking.id) }}>
                <LogOut className="w-4 h-4 mr-1" /> Check Out
              </Button>
            )}

            {/* Unassign table */}
            {assignedTables && (
              <Button size="lg" variant="outline" className="w-full touch-target border-destructive/50 text-destructive hover:bg-destructive/10"
                onClick={(e) => { stop(e); onUnassign?.(booking.id) }}>
                <MapPin className="w-4 h-4 mr-1" /> Unassign Table
              </Button>
            )}

            {/* View on Floorplan */}
            <Button size="lg" variant="outline"
              className="w-full touch-target"
              disabled={!assignedTables}
              onClick={(e) => { stop(e); onGoToFloorplan?.(booking.id) }}>
              <ExternalLink className="w-4 h-4 mr-1" /> View on Floorplan
            </Button>

            {/* Cancel booking — only for confirmed with no table assigned */}
            {booking.status === 'confirmed' && !assignedTables && (
              <Button size="lg" variant="outline" className="w-full touch-target border-destructive/50 text-destructive hover:bg-destructive hover:text-white"
                onClick={(e) => { stop(e); onCancelBooking?.(booking.id) }}>
                <XCircle className="w-4 h-4 mr-1" /> Cancel Booking
              </Button>
            )}
          </div>


        </div>
      )}
    </div>
  )
}

// ---- Request Card Component (hostess-hub style) ----
function RequestCard({
  booking,
  sections = [],
  isSelected,
  onSelect: _onSelectRequest,
  onAccept,
  onAcceptAndAssign,
  onDecline,
  onVisualize,
  selectedDate,
  onGoToDate,
}: {
  booking: Booking
  sections?: RestaurantSection[]
  isSelected: boolean
  selectedDate: Date
  onSelect: () => void
  onAccept: () => void
  onAcceptAndAssign?: () => void
  onDecline: () => void
  onVisualize?: () => void
  onGoToDate?: (date: Date) => void
}) {
  const bookingTime = new Date(booking.booking_time)
  const timeStr = format(bookingTime, 'h:mm a')
  const isBookingToday = isToday(bookingTime)
  const dateStr = isBookingToday ? 'Today' : format(bookingTime, 'MMM d')
  const profileItem = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles
  const guestName = resolveGuestName(booking)
  const phone = profileItem?.phone_number || booking.user?.phone_number || booking.guest_phone
  const email = profileItem?.email || booking.user?.email || booking.guest_email
  const isRegistered = Boolean(profileItem || booking.user)
  const partySize = booking.party_size ?? booking.attendees ?? 1
  // Resolve section: from booking section_id or preferred_section text
  const sectionName = (() => {
    if (booking.section_id && sections.length > 0) {
      const s = sections.find(sec => sec.id === booking.section_id)
      if (s) return s.name
    }
    return booking.preferred_section || null
  })()

  const [expanded, setExpanded] = useState(false)
  useEffect(() => setExpanded(!!isSelected), [isSelected])

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div
      onClick={(e) => { e.stopPropagation(); setExpanded(s => !s) }}
      className={cn(
        'relative rounded-xl bg-card border cursor-pointer transition-all duration-150 overflow-hidden',
        'hover:shadow-card hover:border-[hsl(var(--booking-pending)/.4)] active:scale-[0.98]',
        isSelected ? 'border-[hsl(var(--booking-pending))] shadow-elevated' : 'border-[hsl(var(--booking-pending)/.3)] shadow-card',
      )}
    >
      <div className="flex items-stretch gap-0">
        {/* Status strip */}
        <div className="w-1.5 self-stretch flex-shrink-0 rounded-l-xl bg-[hsl(var(--booking-pending))]" />

        {/* Info */}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-sm truncate flex-1">{guestName}</span>
            <Badge className="bg-[hsl(var(--booking-pending))] text-white text-[10px] px-1.5 py-0 h-5">Request</Badge>
            <ChevronDown className={cn(
              'w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0',
              expanded && 'rotate-180'
            )} />
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span className="font-medium tabular-nums">{timeStr}</span>
            <span>•</span>
            <span>{dateStr}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>{partySize} guest{partySize > 1 ? 's' : ''}</span>
            <span>•</span>
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{isRegistered ? 'Registered' : 'Guest'}</Badge>
          </div>
          {sectionName && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{sectionName}</span>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <Phone className="w-3 h-3" />
              <span>{phone}</span>
            </div>
          )}
          {email && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <ExternalLink className="w-3 h-3" />
              <span>{email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Expanded actions */}
      {expanded && (
        <div className="px-3 pb-3 pt-0">
          <div className="border-t pt-3">
            {booking.special_requests && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3">
                <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{booking.special_requests}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" className="touch-target bg-[hsl(var(--booking-confirmed))] hover:bg-[hsl(var(--booking-confirmed)/.85)] text-white active:scale-[0.97] transition-transform"
                onClick={(e) => { stop(e); onAccept() }}>
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Accept
              </Button>
              <Button size="lg" variant="outline" className="touch-target border-destructive/50 text-destructive hover:bg-destructive hover:text-white active:scale-[0.97] transition-transform"
                onClick={(e) => { stop(e); onDecline() }}>
                <XCircle className="w-3.5 h-3.5 mr-1" />
                Decline
              </Button>
            </div>
          </div>
          {/* Accept & Assign button — confirms and opens table assignment drawer */}
          {onAcceptAndAssign && (
            <Button
              size="sm"
              variant="outline"
              className="w-full mt-2 h-9 max-[700px]:h-10 text-xs border-[hsl(var(--booking-confirmed)_/_0.4)] text-[hsl(var(--booking-confirmed))] hover:bg-[hsl(var(--booking-confirmed)_/_0.05)] touch-target"
              onClick={(e) => { e.stopPropagation(); onAcceptAndAssign(); }}
            >
              <MapPin className="w-3.5 h-3.5 mr-1" />
              Accept & Assign Table
            </Button>
          )}
          {/* Visualize button — shows assigned tables on floorplan without changing anything */}
          {onVisualize && booking.tables && booking.tables.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="w-full mt-2 h-9 max-[700px]:h-10 text-xs touch-target border-primary/30 text-primary hover:bg-primary/5"
              onClick={(e) => { e.stopPropagation(); onVisualize(); }}
            >
              <Eye className="w-3.5 h-3.5 mr-1" />
              Visualize on Floorplan
            </Button>
          )}
          {/* Go to Date button for future bookings */}
          {(() => {
            const bookingDateTime = new Date(booking.booking_time)
            const isDifferentDate = !isSameDay(bookingDateTime, selectedDate)
            if (isDifferentDate && onGoToDate) {
              return (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2 h-9 max-[700px]:h-10 text-xs touch-target border-primary/50 text-primary hover:bg-primary/10"
                  onClick={(e) => { e.stopPropagation(); onGoToDate(bookingDateTime); }}
                >
                  <CalendarCheck className="w-3.5 h-3.5 mr-1" />
                  Go to {isToday(bookingDateTime) ? 'Today' : format(bookingDateTime, 'MMM d')}
                </Button>
              )
            }
            return null
          })()}
        </div>
      )}
    </div>
  )
}

// ---- Empty State Component ----
function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <div className="opacity-40 mb-2">{icon}</div>
      <p className="text-sm font-medium text-center">{text}</p>
    </div>
  )
}
