// components/dashboard/pending-requests-widget.tsx
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { format, differenceInMinutes } from "date-fns"
import {
  Clock,
  Users,
  Timer,
  CheckCircle,
  XCircle,
  AlertCircle,
  Phone,
  Mail,
  MessageSquare,
  Table2,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Star
} from "lucide-react"
import { cn } from "@/lib/utils"
import { BookingRequestService } from "@/lib/booking-request-service"
import { TableAvailabilityService } from "@/lib/table-availability"
import { toast } from "react-hot-toast"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

interface PendingRequestsWidgetProps {
  bookings: any[]
  restaurantId: string
  userId: string
  onUpdate: () => void
}

interface ConflictResolutionDialogProps {
  booking: any
  error: string
  alternatives?: {
    tables?: string[]
    times?: Date[]
  }
  onAccept: (tableIds: string[]) => void
  onDecline: () => void
  onClose: () => void
}

function ConflictResolutionDialog({
  booking,
  error,
  alternatives,
  onAccept,
  onDecline,
  onClose
}: ConflictResolutionDialogProps) {
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([])
  const [selectedTime, setSelectedTime] = useState<Date | null>(null)
  const supabase = createClient()

  // Fetch table details
  const { data: tables } = useQuery({
    queryKey: ["alternative-tables", alternatives?.tables],
    queryFn: async () => {
      if (!alternatives?.tables || alternatives.tables.length === 0) return []
      
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .in("id", alternatives.tables)
      
      if (error) throw error
      return data
    },
    enabled: !!alternatives?.tables && alternatives.tables.length > 0
  })

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Booking Conflict Detected
          </DialogTitle>
          <DialogDescription>
            {error}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Booking details */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Booking Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Guest:</span>{" "}
                {booking.guest_name || booking.user?.full_name}
              </div>
              <div>
                <span className="text-muted-foreground">Party:</span>{" "}
                {booking.party_size} guests
              </div>
              <div>
                <span className="text-muted-foreground">Time:</span>{" "}
                {format(new Date(booking.booking_time), "MMM d, h:mm a")}
              </div>
              <div>
                <span className="text-muted-foreground">Duration:</span>{" "}
                {booking.turn_time_minutes} minutes
              </div>
            </div>
          </div>

          {/* Alternative tables */}
          {tables && tables.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Alternative Tables Available</h4>
              <div className="grid grid-cols-3 gap-2">
                {tables.map((table) => (
                  <Button
                    key={table.id}
                    variant={selectedTableIds.includes(table.id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedTableIds(prev =>
                        prev.includes(table.id)
                          ? prev.filter(id => id !== table.id)
                          : [...prev, table.id]
                      )
                    }}
                  >
                    <Table2 className="h-4 w-4 mr-1" />
                    T{table.table_number} ({table.capacity})
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Alternative times */}
          {alternatives?.times && alternatives.times.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Alternative Times Available</h4>
              <div className="grid grid-cols-2 gap-2">
                {alternatives.times.map((time, idx) => (
                  <Button
                    key={idx}
                    variant={selectedTime === time ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTime(time)}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    {format(time, "h:mm a")}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => onAccept(selectedTableIds)}
              disabled={selectedTableIds.length === 0}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Accept with Alternative Tables
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                if (confirm("Are you sure you want to decline this request?")) {
                  onDecline()
                }
              }}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Decline Request
            </Button>
          </div>

          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function PendingRequestsWidget({ 
  bookings, 
  restaurantId, 
  userId,
  onUpdate 
}: PendingRequestsWidgetProps) {
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [conflictDialog, setConflictDialog] = useState<{
    booking: any
    error: string
    alternatives?: any
  } | null>(null)
  const [selectedTables, setSelectedTables] = useState<Record<string, string[]>>({})
  
  const requestService = new BookingRequestService()
  const tableService = new TableAvailabilityService()
  const supabase = createClient()

  // Filter pending requests
  const pendingRequests = bookings
    .filter(b => b.status === 'pending')
    .sort((a, b) => {
      // Sort by urgency: expiry time, then booking time
      if (a.request_expires_at && b.request_expires_at) {
        return new Date(a.request_expires_at).getTime() - new Date(b.request_expires_at).getTime()
      }
      return new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime()
    })

  // Fetch available tables for each pending request
  const { data: availableTables } = useQuery({
    queryKey: ["available-tables-requests", pendingRequests.map(r => r.id)],
    queryFn: async () => {
      const availability: Record<string, any> = {}
      
      for (const request of pendingRequests) {
        const available = await tableService.getAvailableTablesForSlot(
          restaurantId,
          new Date(request.booking_time),
          request.party_size,
          request.turn_time_minutes || 120
        )
        availability[request.id] = available
      }
      
      return availability
    },
    enabled: pendingRequests.length > 0,
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  const handleAccept = async (bookingId: string, tableIds?: string[]) => {
    setProcessingId(bookingId)
    const booking = pendingRequests.find(b => b.id === bookingId)
    
    try {
      const result = await requestService.acceptRequest(
        bookingId, 
        userId, 
        tableIds || selectedTables[bookingId] || [],
        { suggestAlternatives: true }
      )
      
      if (result.success) {
        toast.success("Booking request accepted")
        onUpdate()
      } else {
        // Show conflict resolution dialog
        setConflictDialog({
          booking,
          error: result.error || "Failed to accept request",
          alternatives: result.alternatives
        })
      }
    } catch (error) {
      toast.error("Failed to accept request")
    } finally {
      setProcessingId(null)
    }
  }

  const handleDecline = async (bookingId: string, suggestAlternatives = false) => {
    if (!confirm("Are you sure you want to decline this booking request?")) return
    
    setProcessingId(bookingId)
    try {
      const result = await requestService.declineRequest(
        bookingId, 
        userId, 
        "Restaurant declined", 
        suggestAlternatives
      )
      
      if (result.success) {
        toast.success("Booking request declined")
        if (result.alternatives) {
          toast("Alternative suggestions sent to customer")
        }
        onUpdate()
      }
    } catch (error) {
      toast.error("Failed to decline request")
    } finally {
      setProcessingId(null)
    }
  }

  const ExpiryTimer = ({ booking }: { booking: any }) => {
    const [timeInfo, setTimeInfo] = useState<{ 
      hours: number
      minutes: number
      expired: boolean
      percentage: number 
    }>()
    
    useEffect(() => {
      const updateTimer = async () => {
        const info = await requestService.getTimeUntilExpiry(booking)
        setTimeInfo(info)
      }

      updateTimer()
      const interval = setInterval(updateTimer, 60000)
      return () => clearInterval(interval)
    }, [booking])

    if (!timeInfo || !booking.request_expires_at) return null

    return (
      <div className="space-y-2">
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium",
          timeInfo.expired ? "text-red-600" : 
          timeInfo.hours < 2 ? "text-orange-600" : 
          "text-gray-600"
        )}>
          <Timer className="h-3 w-3" />
          {timeInfo.expired ? "Expired" : `${timeInfo.hours}h ${timeInfo.minutes}m left`}
        </div>
        <Progress 
          value={timeInfo.percentage} 
          className="h-1"
          indicatorClassName={cn(
            timeInfo.percentage < 20 ? "bg-red-500" :
            timeInfo.percentage < 50 ? "bg-orange-500" :
            "bg-green-500"
          )}
        />
      </div>
    )
  }

  if (pendingRequests.length === 0) {
    return null
  }

  // Count urgent requests
  const urgentCount = pendingRequests.filter(r => {
    if (!r.request_expires_at) return false
    const hoursLeft = differenceInMinutes(new Date(r.request_expires_at), new Date()) / 60
    return hoursLeft < 2
  }).length

  return (
    <>
      <Card className={cn(
        "border-2",
        urgentCount > 0 ? "border-red-300 bg-red-50" : "border-orange-200 bg-orange-50"
      )}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "p-2 rounded-full",
                urgentCount > 0 ? "bg-red-100 motion-safe:animate-pulse" : "bg-orange-100"
              )}>
                <Timer className={cn(
                  "h-5 w-5",
                  urgentCount > 0 ? "text-red-600" : "text-orange-600"
                )} />
              </div>
              <div>
                <CardTitle className="text-lg">Pending Booking Requests</CardTitle>
                <CardDescription>
                  {pendingRequests.length} request{pendingRequests.length !== 1 ? 's' : ''} awaiting approval
                  {urgentCount > 0 && (
                    <span className="text-red-600 font-medium">
                      {" "}• {urgentCount} expiring soon!
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onUpdate}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {pendingRequests.map((booking) => {
                const bookingTime = new Date(booking.booking_time)
                const isProcessing = processingId === booking.id
                const availability = availableTables?.[booking.id]
                const hasAvailableTables = availability && 
                  (availability.singleTables.length > 0 || availability.combinations.length > 0)
                
                return (
                  <div
                    key={booking.id}
                    className={cn(
                      "p-4 rounded-lg border-2 bg-white",
                      "hover:shadow-md transition-all",
                      isProcessing && "opacity-50",
                      !hasAvailableTables && "border-red-200 bg-red-50"
                    )}
                  >
                    {/* Conflict alert */}
                    {!hasAvailableTables && (
                      <Alert className="mb-3 border-red-300 bg-red-100">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <AlertTitle className="text-red-800">No tables available</AlertTitle>
                        <AlertDescription className="text-red-700">
                          All suitable tables are booked for this time slot
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Header with guest info and expiry */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-lg">
                          {booking.guest_name || booking.user?.full_name || 'Guest'}
                        </h4>
                        <div className="space-y-1">
                          {(booking.guest_email || booking.user?.email) && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {booking.guest_email || booking.user?.email}
                            </div>
                          )}
                          {(booking.guest_phone || booking.user?.phone_number) ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {booking.guest_phone || booking.user?.phone_number}
                            </div>
                          ) : (
                            <div className="text-sm text-red-600">No phone number</div>
                          )}
                        </div>
                      </div>
                      {booking.request_expires_at && (
                        <ExpiryTimer booking={booking} />
                      )}
                    </div>

                    {/* Booking details */}
                    <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{format(bookingTime, 'MMM d')}</p>
                          <p className="text-muted-foreground">{format(bookingTime, 'h:mm a')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{booking.party_size} guests</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Timer className="h-4 w-4 text-muted-foreground" />
                        <span>{booking.turn_time_minutes}min</span>
                      </div>
                    </div>

                    {/* Special requests */}
                    {booking.special_requests && (
                      <div className="mb-3 p-2 bg-gray-50 rounded text-sm">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <p>{booking.special_requests}</p>
                        </div>
                      </div>
                    )}

                    {/* Applied offers */}
                    {booking.special_offers && (
                      <div className="mb-3 p-2 bg-green-50 rounded text-sm border border-green-200">
                        <div className="flex items-start gap-2">
                          <Star className="h-4 w-4 text-green-600 mt-0.5" />
                          <div>
                            <p className="font-medium text-green-800">{booking.special_offers.title}</p>
                            {booking.special_offers.description && (
                              <p className="text-xs text-green-600 mt-1">{booking.special_offers.description}</p>
                            )}
                            {booking.special_offers.discount_percentage && (
                              <Badge variant="secondary" className="mt-1 text-xs bg-green-100 text-green-800">
                                {booking.special_offers.discount_percentage}% OFF
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Table selection */}
                    {hasAvailableTables && (
                      <div className="mb-3">
                        <label className="text-sm font-medium mb-2 block">
                          Select Table(s)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {availability.singleTables.map((table: any) => (
                            <Button
                              key={table.id}
                              size="sm"
                              variant={
                                (selectedTables[booking.id] || []).includes(table.id) 
                                  ? "default" 
                                  : "outline"
                              }
                              onClick={() => {
                                setSelectedTables(prev => ({
                                  ...prev,
                                  [booking.id]: prev[booking.id]?.includes(table.id)
                                    ? prev[booking.id].filter(id => id !== table.id)
                                    : [...(prev[booking.id] || []), table.id]
                                }))
                              }}
                              disabled={isProcessing}
                            >
                              T{table.table_number} ({table.capacity})
                            </Button>
                          ))}
                        </div>
                        {availability.combinations.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {availability.combinations.length} table combination{availability.combinations.length !== 1 ? 's' : ''} available
                          </p>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleAccept(booking.id)}
                        disabled={
                          isProcessing || 
                          (!hasAvailableTables && !selectedTables[booking.id]?.length)
                        }
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleDecline(booking.id, !hasAvailableTables)}
                        disabled={isProcessing}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                    </div>

                    {/* Show previous attempts */}
                    {booking.acceptance_attempted_at && (
                      <div className="mt-2 text-xs text-orange-600">
                        <AlertCircle className="h-3 w-3 inline mr-1" />
                        Previous acceptance failed: {booking.acceptance_failed_reason}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Conflict Resolution Dialog */}
      {conflictDialog && (
        <ConflictResolutionDialog
          booking={conflictDialog.booking}
          error={conflictDialog.error}
          alternatives={conflictDialog.alternatives}
          onAccept={(tableIds) => {
            handleAccept(conflictDialog.booking.id, tableIds)
            setConflictDialog(null)
          }}
          onDecline={() => {
            handleDecline(conflictDialog.booking.id, true)
            setConflictDialog(null)
          }}
          onClose={() => setConflictDialog(null)}
        />
      )}
    </>
  )
}
