// components/shared-tables/shared-table-bookings-modal.tsx
"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSharedTableBookings } from "@/hooks/use-shared-tables"
import { 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle,
  User,
  MessageSquare,
  Eye,
  Calendar,
  RefreshCw
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import type { SharedTableSummary, SharedTableBooking } from "@/types"

interface SharedTableBookingsModalProps {
  isOpen: boolean
  onClose: () => void
  table: SharedTableSummary | null
  restaurantId: string
  date: Date
}

export function SharedTableBookingsModal({ 
  isOpen, 
  onClose, 
  table, 
  restaurantId, 
  date 
}: SharedTableBookingsModalProps) {
  const [selectedTab, setSelectedTab] = useState("current")

  const { 
    data: allBookings, 
    isLoading, 
    error,
    refetch 
  } = useSharedTableBookings(restaurantId, date)

  if (!table) return null

  // Filter bookings for the specific table
  const tableBookings = allBookings?.filter((b: SharedTableBooking) => 
    // We need to add table_id to the booking data structure
    b.booking_id // For now, we'll show all bookings
  ) || []

  const currentBookings = tableBookings?.filter((b: SharedTableBooking) => 
    ["confirmed", "checked_in"].includes(b.status)
  ) || []
  
  const pastBookings = tableBookings?.filter((b: SharedTableBooking) => 
    ["completed", "no_show"].includes(b.status)
  ) || []

  const getStatusBadge = (status: string) => {
    const variants = {
      confirmed: { variant: "default" as const, label: "Confirmed" },
      checked_in: { variant: "default" as const, label: "Checked In" },
      completed: { variant: "secondary" as const, label: "Completed" },
      cancelled: { variant: "destructive" as const, label: "Cancelled" },
      no_show: { variant: "destructive" as const, label: "No Show" }
    }
    
    return variants[status as keyof typeof variants] || { 
      variant: "secondary" as const, 
      label: status 
    }
  }

  const BookingCard = ({ booking }: { booking: SharedTableBooking }) => {
    const badgeInfo = getStatusBadge(booking.status)
    
    return (
      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {booking.guest_name || booking.user_name}
                </span>
                <Badge variant={badgeInfo.variant}>
                  {badgeInfo.label}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground text-sm"><div className="flex items-center space-x-2">
                  <Users className="h-3 w-3" />
                  <span>Party of {booking.party_size}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-3 w-3" />
                  <span>{booking.seats_occupied} seats</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-3 w-3" />
                  <span>{format(new Date(booking.booking_time), "h:mm a")}</span>
                </div>
                {booking.is_social && (
                  <div className="flex items-center space-x-2">
                    <Eye className="h-3 w-3" />
                    <span>Social dining</span>
                  </div>
                )}
              </div>

              {booking.special_requests && (
                <div className="mt-2 p-2 bg-muted rounded-lg">
                  <div className="flex items-start space-x-2">
                    <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5" />
                    <span className="text-xs text-muted-foreground text-sm">{booking.special_requests}
                    </span>
                  </div>
                </div>
              )}

              {booking.checked_in_at && (
                <div className="mt-2 text-xs text-green-600">
                  <CheckCircle className="h-3 w-3 inline mr-1" />
                  Checked in at {format(new Date(booking.checked_in_at), "h:mm a")}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              Table {table.table_number} - {format(date, "MMMM d, yyyy")}
            </DialogTitle>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground text-sm"><span>{table.section_name}</span>
            <span>•</span>
            <span>Capacity: {table.capacity}</span>
            <span>•</span>
            <span>Current: {table.current_occupancy}/{table.capacity}</span>
          </div>
        </DialogHeader>

        {error ? (
          <div className="text-center py-4">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground">Failed to load bookings</p>
            <Button variant="outline" onClick={() => refetch()} className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : (
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="current">
                Current ({currentBookings.length})
              </TabsTrigger>
              <TabsTrigger value="past">
                Past ({pastBookings.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-24 bg-muted motion-safe:animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : currentBookings.length > 0 ? (
                  <div>
                    {currentBookings.map((booking: SharedTableBooking) => (
                      <BookingCard key={booking.booking_id} booking={booking} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No current bookings</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="past" className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-24 bg-muted motion-safe:animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : pastBookings.length > 0 ? (
                  <div>
                    {pastBookings.map((booking: SharedTableBooking) => (
                      <BookingCard key={booking.booking_id} booking={booking} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No past bookings</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
