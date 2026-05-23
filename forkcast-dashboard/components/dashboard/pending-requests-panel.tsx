// components/dashboard/pending-requests-panel.tsx
"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { format, differenceInMinutes, addMinutes } from "date-fns"
import {
  Clock,
  Users,
  Timer,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  MessageSquare,
  Table2,
  RefreshCw,
  AlertTriangle,
  Star,
  UserX
} from "lucide-react"
import { cn } from "@/lib/utils"
import { BookingRequestService } from "@/lib/booking-request-service"
import { toast } from "react-hot-toast"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { TableSelectionModal } from "./table-selection-modal"

interface PendingRequestsPanelProps {
  bookings: any[]
  restaurantId: string
  userId: string
  onUpdate: () => void
}

export function PendingRequestsPanel({
  bookings,
  restaurantId,
  userId,
  onUpdate
}: PendingRequestsPanelProps) {
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [lastExpiredCheck, setLastExpiredCheck] = useState<Date>(new Date())

  const requestService = useMemo(() => new BookingRequestService(), [])
  const supabase = createClient()

  // Auto-decline expired requests
  const handleExpiredRequests = useCallback(async () => {
    if (!restaurantId || !userId) return

    try {
      const result = await requestService.autoDeclineExpiredRequests(restaurantId, userId)

      if (result.declinedCount > 0) {
        toast.success(`${result.declinedCount} expired requests automatically declined`)
        setLastExpiredCheck(new Date())
        onUpdate() // Refresh the bookings list
      }

      if (result.errors.length > 0) {
        console.warn("Some expired requests couldn't be auto-declined:", result.errors)
      }
    } catch (error) {
      console.error("Failed to auto-decline expired requests:", error)
    }
  }, [restaurantId, userId, onUpdate, requestService])

  // Check for expired requests every 30 seconds
  useEffect(() => {
    if (!restaurantId || !userId) return

    // Initial check
    handleExpiredRequests()

    // Set up interval for checking expired requests
    const expiredCheckInterval = setInterval(handleExpiredRequests, 30000) // 30 seconds

    return () => {
      clearInterval(expiredCheckInterval)
    }
  }, [handleExpiredRequests, restaurantId, userId])

  // Also check when the component mounts or when bookings change
  useEffect(() => {
    const now = new Date()
    const timeSinceLastCheck = now.getTime() - lastExpiredCheck.getTime()

    // Only check if it's been more than 15 seconds since last check
    if (timeSinceLastCheck > 15000) {
      handleExpiredRequests()
    }
  }, [bookings.length, handleExpiredRequests, lastExpiredCheck])

  // Filter pending requests
  const pendingRequests = bookings
    .filter(b => b.status === 'pending')
    .sort((a, b) => {
      if (a.request_expires_at && b.request_expires_at) {
        return new Date(a.request_expires_at).getTime() - new Date(b.request_expires_at).getTime()
      }
      return new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime()
    })

  // Fetch all tables for the restaurant
  const { data: allTables = [] } = useQuery({
    queryKey: ["restaurant-tables-pending", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []

      const { data, error } = await supabase
        .from("restaurant_tables")
        .select(`
          *,
          section:restaurant_sections(*)
        `)
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("table_number", { ascending: true })

      if (error) throw error
      return data || []
    },
    enabled: !!restaurantId,
  })

  // Fetch customer data for VIP status
  const { data: customersData = {} } = useQuery({
    queryKey: ["pending-customers", restaurantId, pendingRequests.map(b => b.user?.id).filter(Boolean)],
    queryFn: async () => {
      if (!restaurantId || pendingRequests.length === 0) return {}

      const userIds = pendingRequests
        .map(booking => booking.user?.id)
        .filter(Boolean)
        .filter((id, index, self) => self.indexOf(id) === index)

      if (userIds.length === 0) return {}

      const { data, error } = await supabase
        .from("restaurant_customers")
        .select(`
          user_id,
          vip_status,
          blacklisted,
          blacklist_reason,
          total_bookings,
          no_show_count
        `)
        .eq("restaurant_id", restaurantId)
        .in("user_id", userIds)

      if (error) throw error

      const customerMap: Record<string, any> = {}
      data?.forEach(customer => {
        customerMap[customer.user_id] = customer
      })

      return customerMap
    },
    enabled: !!restaurantId && pendingRequests.length > 0,
  })

  // Calculate table status for each pending request
  const tableStatusForRequests = useMemo(() => {
    const statusMap: Record<string, any[]> = {}

    pendingRequests.forEach(request => {
      const requestTime = new Date(request.booking_time)
      const requestEndTime = addMinutes(requestTime, request.turn_time_minutes || 120)

      const tablesWithStatus = allTables.map(table => {
        // Check if table is occupied during the request time
        const conflictingBooking = bookings.find(booking => {
          if (booking.id === request.id) return false // Skip self
          if (!booking.tables || booking.tables.length === 0) return false
          if (!booking.tables.some((t: any) => t.id === table.id)) return false

          const bookingTime = new Date(booking.booking_time)
          const bookingEndTime = addMinutes(bookingTime, booking.turn_time_minutes || 120)

          // Check for time overlap
          return (requestTime < bookingEndTime && requestEndTime > bookingTime)
        })

        // Check if table is currently occupied
        const currentlyOccupied = bookings.find(booking => {
          const occupiedStatuses = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment']
          return occupiedStatuses.includes(booking.status) &&
                 booking.tables?.some((t: any) => t.id === table.id)
        })

        return {
          ...table,
          isAvailable: !conflictingBooking && !currentlyOccupied,
          conflictingBooking,
          currentlyOccupied,
          canBeSelected: !conflictingBooking && !currentlyOccupied
        }
      })

      statusMap[request.id] = tablesWithStatus
    })

    return statusMap
  }, [allTables, bookings, pendingRequests])

  // Fetch available tables for each pending request (simplified)
  const availableTablesForRequests = useMemo(() => {
    const availability: Record<string, any> = {}

    pendingRequests.forEach(request => {
      const tableStatus = tableStatusForRequests[request.id] || []
      const availableTables = tableStatus.filter(t => t.canBeSelected)

      // Filter by capacity - exact fit first, then fallback to lowest min
      const exactFitTables = availableTables.filter(t =>
        t.capacity >= request.party_size && (t.min_capacity || 1) <= request.party_size
      )
      const fallbackTables = availableTables.filter(t =>
        t.capacity >= request.party_size && (t.min_capacity || 1) > request.party_size
      ).sort((a, b) => (a.min_capacity || 1) - (b.min_capacity || 1))

      const singleTables = [...exactFitTables, ...fallbackTables]
      const allAvailable = availableTables

      availability[request.id] = {
        singleTables,
        allAvailable,
        hasAvailable: singleTables.length > 0 || allAvailable.length > 0
      }
    })

    return availability
  }, [pendingRequests, tableStatusForRequests])

  const handleAcceptClick = (booking: any) => {
    setSelectedBooking(booking)
    setModalOpen(true)
  }

  const handleConfirmTableSelection = async (tableIds: string[]) => {
    if (!selectedBooking) return

    setProcessingId(selectedBooking.id)

    try {
      const result = await requestService.acceptRequest(
        selectedBooking.id,
        userId,
        tableIds,
        { suggestAlternatives: true }
      )

      if (result.success) {
        toast.success("Booking request accepted")
        setModalOpen(false)
        setSelectedBooking(null)
        onUpdate()
      } else {
        toast.error(result.error || "Failed to accept request")
      }
    } catch (error) {
      toast.error("Failed to accept request")
    } finally {
      setProcessingId(null)
    }
  }

  const handleDecline = async (bookingId: string) => {
    const confirmDecline = confirm(
      "⚠️ Decline Booking Request?\n\n" +
      "This action cannot be undone. The guest will be notified.\n\n" +
      "We'll suggest alternative times if available."
    )

    if (!confirmDecline) return

    setProcessingId(bookingId)
    try {
      const result = await requestService.declineRequest(
        bookingId,
        userId,
        "Restaurant declined",
        true
      )

      if (result.success) {
        toast.success("Booking request declined")
        if (result.alternatives) {
          toast("Alternative suggestions sent to customer", { icon: "📧" })
        }
        onUpdate()
      }
    } catch (error) {
      toast.error("Failed to decline request")
    } finally {
      setProcessingId(null)
    }
  }

  const getTimeUntilExpiry = (booking: any) => {
    if (!booking.request_expires_at) return null

    const expiresAt = new Date(booking.request_expires_at)
    const createdAt = new Date(booking.created_at || booking.request_expires_at)
    const now = new Date()

    const totalMs = expiresAt.getTime() - createdAt.getTime()
    const remainingMs = expiresAt.getTime() - now.getTime()

    const expired = remainingMs <= 0

    if (expired) {
      const expiredMinutes = Math.abs(Math.floor(remainingMs / (1000 * 60)))
      return {
        hoursLeft: 0,
        minutesLeft: 0,
        expired: true,
        percentage: 0,
        expiredForMinutes: expiredMinutes
      }
    }

    const hoursLeft = Math.floor(remainingMs / (1000 * 60 * 60))
    const minutesLeft = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60))
    const percentage = Math.max(0, Math.min(100, Math.round((remainingMs / totalMs) * 100)))

    return { hoursLeft, minutesLeft, expired, percentage }
  }

  const urgentCount = pendingRequests.filter(r => {
    const expiry = getTimeUntilExpiry(r)
    return expiry && !expiry.expired && expiry.hoursLeft < 2
  }).length

  if (pendingRequests.length === 0) {
    return null
  }

  return (
    <Card
      id="pending-requests-panel"
      className={cn(
        "w-full border-2 max-h-[400px] shadow-xl flex flex-col",
        urgentCount > 0
          ? "border-destructive/40 bg-gradient-to-br from-destructive/10 to-destructive/5 animate-pulse"
          : "border-[hsl(var(--booking-pending))]/30 bg-gradient-to-br from-[hsl(var(--booking-pending))]/10 to-[hsl(var(--booking-pending))]/5"
      )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-full shadow-inner",
              urgentCount > 0
                ? "bg-destructive/20 animate-bounce"
                : "bg-[hsl(var(--booking-pending))]/20"
            )}>
              <Timer className={cn(
                "h-5 w-5",
                urgentCount > 0 ? "text-destructive" : "text-[hsl(var(--booking-pending))]"
              )} />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-foreground">Pending Requests</CardTitle>
              <CardDescription className="text-sm">
                <span className="font-medium">{pendingRequests.length} awaiting approval</span>
                {urgentCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-2 text-xs px-2 py-0.5 animate-pulse"
                  >
                    {urgentCount} URGENT!
                  </Badge>
                )}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-white/50"
            onClick={onUpdate}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1 overflow-hidden">
        <ScrollArea className="h-[280px]">
          <div className="space-y-4 pr-4">
            {pendingRequests.map((booking) => {
              const bookingTime = new Date(booking.booking_time)
              const isProcessing = processingId === booking.id
              const availability = availableTablesForRequests[booking.id]
              const hasAvailableTables = availability?.hasAvailable
              const expiry = getTimeUntilExpiry(booking)
              const isUrgent = expiry && !expiry.expired && expiry.hoursLeft < 2
              const customerData = customersData[booking.user?.id]

              return (
                <div
                  key={booking.id}
                  className={cn(
                    "p-3 rounded-lg border-2 bg-card shadow-md min-h-[140px]",
                    "transition-all hover:shadow-lg flex flex-col",
                    isProcessing && "opacity-50",
                    !hasAvailableTables && "border-destructive/30 bg-gradient-to-br from-destructive/5 to-card",
                    isUrgent && "ring-2 ring-destructive/40 ring-offset-1"
                  )}
                >
                  {/* Expiry timer */}
                  {expiry && (
                    <div className="mb-3">
                      <div className={cn(
                        "flex items-center gap-2 text-xs font-bold mb-1",
                        expiry.expired ? "text-destructive animate-pulse" :
                        expiry.hoursLeft < 2 ? "text-[hsl(var(--booking-pending))]" :
                        "text-muted-foreground"
                      )}>
                        <Timer className="h-4 w-4" />
                        {expiry.expired
                          ? `EXPIRED ${(expiry as any).expiredForMinutes ? `${(expiry as any).expiredForMinutes}m ago` : ''}`
                          : `${expiry.hoursLeft}h ${expiry.minutesLeft}m remaining`
                        }
                      </div>
                      <Progress
                        value={expiry.percentage}
                        className="h-2"
                        indicatorClassName={cn(
                          expiry.percentage < 20 ? "bg-destructive" :
                          expiry.percentage < 50 ? "bg-[hsl(var(--booking-pending))]" :
                          "bg-[hsl(var(--status-available))]"
                        )}
                      />
                    </div>
                  )}

                  {/* No tables alert */}
                  {!hasAvailableTables && (
                    <Alert className="mb-3 p-3 border-destructive/30 bg-destructive/10">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-sm font-medium text-destructive">
                        No tables available for this time slot
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Guest info with VIP status */}
                  <div className="mb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-lg text-foreground">
                            {booking.guest_name || booking.user?.full_name || 'Anonymous'}
                          </p>
                          {customerData?.vip_status && (
                            <Badge variant="secondary" className="bg-[hsl(var(--status-highlight))]/10 text-[hsl(var(--status-highlight))] border-[hsl(var(--status-highlight))]/30">
                              <Star className="h-3 w-3 mr-1" />
                              VIP
                            </Badge>
                          )}
                          {customerData?.blacklisted && (
                            <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/30">
                              <UserX className="h-3 w-3 mr-1" />
                              Blacklisted
                            </Badge>
                          )}
                        </div>
                        {(booking.guest_email || booking.user?.email) && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                            <Mail className="h-3.5 w-3.5" />
                            {booking.guest_email || booking.user?.email}
                          </p>
                        )}
                        {(booking.guest_phone || booking.user?.phone_number) && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                            <Phone className="h-3.5 w-3.5" />
                            {booking.guest_phone || booking.user?.phone_number}
                          </p>
                        )}
                        {customerData && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {customerData.total_bookings} previous bookings
                            {customerData.no_show_count > 0 && ` • ${customerData.no_show_count} no-shows`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Compact booking details */}
                  <div className="flex items-center justify-between mb-3 p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {format(bookingTime, 'h:mm a')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {booking.party_size}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Timer className="h-4 w-4" />
                        {booking.turn_time_minutes || 120}m
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{format(bookingTime, 'MMM d')}</p>
                  </div>

                  {/* Special requests */}
                  {booking.special_requests && (
                    <div className="mb-3 p-3 bg-[hsl(var(--booking-seated))]/5 rounded-lg border border-[hsl(var(--booking-seated))]/20">
                      <p className="text-sm text-[hsl(var(--booking-seated))] flex items-start gap-1.5">
                        <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span className="font-medium">Note:</span> {booking.special_requests}
                      </p>
                    </div>
                  )}

                  {/* Applied offers */}
                  {booking.special_offers && (
                    <div className="mb-3 p-3 bg-[hsl(var(--status-available))]/5 rounded-lg border border-[hsl(var(--status-available))]/20">
                      <p className="text-sm text-[hsl(var(--status-available))] flex items-start gap-1.5">
                        <Star className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium">Offer:</span> {booking.special_offers.title}
                          {booking.special_offers.discount_percentage && (
                            <Badge variant="secondary" className="ml-2 text-xs bg-[hsl(var(--status-available))]/10 text-[hsl(var(--status-available))]">
                              {booking.special_offers.discount_percentage}% OFF
                            </Badge>
                          )}
                          {booking.special_offers.description && (
                            <p className="text-xs text-[hsl(var(--status-available))]/70 mt-1">{booking.special_offers.description}</p>
                          )}
                        </div>
                      </p>
                    </div>
                  )}

                  {/* Table availability summary - compact */}
                  {hasAvailableTables && (
                    <div className="mb-3 p-2 bg-[hsl(var(--status-available))]/5 rounded border border-[hsl(var(--status-available))]/20">
                      <p className="text-xs text-[hsl(var(--status-available))] font-medium flex items-center gap-1">
                        <Table2 className="h-3 w-3" />
                        {availability.singleTables.length} suitable tables available
                      </p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-3 mt-auto pt-3">
                    <Button
                      size="default"
                      className={cn(
                        "flex-1 h-8 font-medium shadow-md",
                        "bg-gradient-to-r from-[hsl(var(--booking-confirmed))] to-[hsl(var(--booking-confirmed))]/80 hover:from-[hsl(var(--booking-confirmed))]/90 hover:to-[hsl(var(--booking-confirmed))] text-white"
                      )}
                      onClick={() => handleAcceptClick(booking)}
                      disabled={isProcessing}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Accept Request
                    </Button>
                    <Button
                      size="default"
                      variant="outline"
                      className="flex-1 h-8 font-medium border-destructive/30 text-destructive hover:bg-destructive/5 hover:border-destructive/40 shadow-md"
                      onClick={() => handleDecline(booking.id)}
                      disabled={isProcessing}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Decline
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Table Selection Modal */}
      <TableSelectionModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setSelectedBooking(null)
        }}
        booking={selectedBooking}
        allTables={allTables}
        allBookings={bookings}
        onConfirmSelection={handleConfirmTableSelection}
        isProcessing={processingId !== null}
      />
    </Card>
  )
}
