// components/basic/daily-summary-widget.tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp, Clock, Users, TrendingUp, Calendar } from "lucide-react"
import { format, parseISO, isToday } from "date-fns"
import { cn } from "@/lib/utils"

interface DailySummaryWidgetProps {
  bookings: any[]
  selectedDate?: Date
}

export function DailySummaryWidget({ bookings, selectedDate }: DailySummaryWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const currentDate = selectedDate || new Date()
  const isViewingToday = isToday(currentDate)

  // Filter bookings for the current viewing date that are confirmed
  const todaysBookings = bookings.filter(booking => {
    const bookingDate = parseISO(booking.booking_time)
    return format(bookingDate, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd') &&
           booking.status === 'confirmed'
  })

  // Calculate summary stats
  const firstBooking = todaysBookings.length > 0
    ? todaysBookings.reduce((earliest, booking) =>
        new Date(booking.booking_time) < new Date(earliest.booking_time) ? booking : earliest
      )
    : null

  const lastBooking = todaysBookings.length > 0
    ? todaysBookings.reduce((latest, booking) =>
        new Date(booking.booking_time) > new Date(latest.booking_time) ? booking : latest
      )
    : null

  // Group by hour to find busiest hour
  const hourlyGuests: Record<string, number> = {}
  todaysBookings.forEach(booking => {
    const hour = format(parseISO(booking.booking_time), 'HH:00')
    hourlyGuests[hour] = (hourlyGuests[hour] || 0) + booking.party_size
  })

  const busiestHour = Object.entries(hourlyGuests).sort((a, b) => b[1] - a[1])[0]

  // Calculate average party size
  const totalGuests = todaysBookings.reduce((sum, b) => sum + b.party_size, 0)
  const avgPartySize = todaysBookings.length > 0
    ? (totalGuests / todaysBookings.length).toFixed(1)
    : '0'

  const summaryItems = [
    {
      label: 'First Booking',
      value: firstBooking ? format(parseISO(firstBooking.booking_time), 'h:mm a') : 'No bookings',
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Last Booking',
      value: lastBooking ? format(parseISO(lastBooking.booking_time), 'h:mm a') : 'No bookings',
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      label: 'Busiest Hour',
      value: busiestHour
        ? `${format(new Date(`2000-01-01T${busiestHour[0]}`), 'h a')} (${busiestHour[1]} guests)`
        : 'No data',
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      label: 'Avg Party Size',
      value: `${avgPartySize} guests`,
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ]

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {isViewingToday ? "Today's Summary" : `Summary for ${format(currentDate, 'MMM d')}`}
          </CardTitle>
          <div className="flex items-center gap-2">
            {todaysBookings.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {todaysBookings.length} confirmed
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          {todaysBookings.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm"><Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">
                {isViewingToday
                  ? "No confirmed bookings for today yet"
                  : `No confirmed bookings for ${format(currentDate, 'MMM d, yyyy')}`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {summaryItems.map((item, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-3 rounded-lg border",
                    item.bgColor
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn("rounded-full p-1.5", item.bgColor)}>
                      <item.icon className={cn("h-3.5 w-3.5", item.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">
                        {item.label}
                      </p>
                      <p className={cn("text-sm font-semibold", item.color)}>
                        {item.value}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
