"use client"

import React, { useMemo } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format, differenceInMinutes } from "date-fns"
import { AlertTriangle, Clock, Users, Table2, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface BookingConflictAlertsProps {
  bookings: any[]
  tables: any[]
  currentTime: Date
  onSelectBooking?: (booking: any) => void
  onOpenTableSwitch?: (bookingId: string) => void
}

export function BookingConflictAlerts({
  bookings,
  tables,
  currentTime,
  onSelectBooking,
  onOpenTableSwitch
}: BookingConflictAlertsProps) {
  // Find bookings that are walk-ins at tables with upcoming confirmed reservations
  const conflicts = useMemo(() => {
    const conflicts: Array<{
      walkIn: any
      upcomingBookings: any[]
      tables: any[]
      urgencyLevel: 'critical' | 'warning' | 'info'
      timeToNext: number
    }> = []

    // Get current walk-ins (seated walk-ins)
    const walkIns = bookings.filter(booking => {
      const isWalkIn = booking.status === 'seated' && 
        new Date(booking.booking_time) <= currentTime &&
        differenceInMinutes(currentTime, new Date(booking.booking_time)) < 30 // Seated in last 30 min
      return isWalkIn && booking.tables && booking.tables.length > 0
    })

    walkIns.forEach(walkIn => {
      if (!walkIn.tables) return

      // Find upcoming confirmed bookings at the same tables
      const tableIds = walkIn.tables.map((t: any) => t.id)
      const upcomingBookings = bookings.filter(booking => {
        if (booking.id === walkIn.id || booking.status !== 'confirmed') return false
        
        const bookingTime = new Date(booking.booking_time)
        const timeDiff = differenceInMinutes(bookingTime, currentTime)
        
        return timeDiff > 0 && 
               timeDiff <= 180 && // Within next 3 hours
               booking.tables?.some((t: any) => tableIds.includes(t.id))
      })

      if (upcomingBookings.length > 0) {
        const nextBooking = upcomingBookings.sort(
          (a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime()
        )[0]
        
        const timeToNext = differenceInMinutes(new Date(nextBooking.booking_time), currentTime)
        
        let urgencyLevel: 'critical' | 'warning' | 'info'
        if (timeToNext <= 30) urgencyLevel = 'critical'
        else if (timeToNext <= 60) urgencyLevel = 'warning'
        else urgencyLevel = 'info'

        conflicts.push({
          walkIn,
          upcomingBookings,
          tables: walkIn.tables,
          urgencyLevel,
          timeToNext
        })
      }
    })

    return conflicts.sort((a, b) => a.timeToNext - b.timeToNext)
  }, [bookings, currentTime])

  if (conflicts.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-destructive flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        Active Booking Conflicts ({conflicts.length})
      </h3>
      
      {conflicts.map((conflict, index) => {
        const nextBooking = conflict.upcomingBookings[0]
        const tableNumbers = conflict.tables.map(t => t.table_number).join(', ')
        
        const alertClass = cn(
          "border-l-4",
          conflict.urgencyLevel === 'critical' && "border-l-destructive bg-destructive/5 border-destructive/20",
          conflict.urgencyLevel === 'warning' && "border-l-orange-500 bg-orange-50 border-orange-200",
          conflict.urgencyLevel === 'info' && "border-l-blue-500 bg-blue-50 border-blue-200"
        )
        
        return (
          <Alert key={`${conflict.walkIn.id}-${index}`} className={alertClass}>
            <AlertTriangle className={cn(
              "h-4 w-4",
              conflict.urgencyLevel === 'critical' && "text-destructive",
              conflict.urgencyLevel === 'warning' && "text-orange-600",
              conflict.urgencyLevel === 'info' && "text-blue-600"
            )} />
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      Table {tableNumbers} Conflict
                    </p>
                    <p className="text-xs text-muted-foreground text-sm">Walk-in vs. Confirmed Reservation
                    </p>
                  </div>
                  <Badge 
                    className={cn(
                      "text-xs",
                      conflict.urgencyLevel === 'critical' && "bg-destructive text-destructive-foreground",
                      conflict.urgencyLevel === 'warning' && "bg-orange-500 text-white",
                      conflict.urgencyLevel === 'info' && "bg-blue-500 text-white"
                    )}
                  >
                    {conflict.urgencyLevel === 'critical' ? 'URGENT' : 
                     conflict.urgencyLevel === 'warning' ? 'SOON' : 'UPCOMING'}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span className="font-medium">Walk-in:</span>
                    </div>
                    <p className="ml-4">
                      {conflict.walkIn.guest_name || conflict.walkIn.user?.full_name || 'Anonymous'} 
                      ({conflict.walkIn.party_size}p)
                    </p>
                    <p className="ml-4 text-muted-foreground text-sm">Seated at {format(new Date(conflict.walkIn.seated_at || conflict.walkIn.booking_time), 'h:mm a')}
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span className="font-medium">Next Booking:</span>
                    </div>
                    <p className="ml-4">
                      {nextBooking.guest_name || nextBooking.user?.full_name || 'Anonymous'}
                      ({nextBooking.party_size}p)
                    </p>
                    <p className="ml-4 text-muted-foreground text-sm">Arriving in {conflict.timeToNext} min ({format(new Date(nextBooking.booking_time), 'h:mm a')})
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-6 px-2"
                    onClick={() => onSelectBooking?.(conflict.walkIn)}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View Walk-in
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-6 px-2"
                    onClick={() => onSelectBooking?.(nextBooking)}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View Booking
                  </Button>
                  <Button
                    size="sm"
                    className={cn(
                      "text-xs h-6 px-2",
                      conflict.urgencyLevel === 'critical' && "bg-destructive hover:bg-destructive/90",
                      conflict.urgencyLevel === 'warning' && "bg-orange-500 hover:bg-orange-600",
                      conflict.urgencyLevel === 'info' && "bg-blue-500 hover:bg-blue-600"
                    )}
                    onClick={() => onOpenTableSwitch?.(nextBooking.id)}
                  >
                    <Table2 className="h-3 w-3 mr-1" />
                    Reassign Table
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )
      })}
    </div>
  )
}
