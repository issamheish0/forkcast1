// components/basic/quick-stats-summary.tsx
"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Users, Clock, TrendingUp, Calendar } from "lucide-react"
import { format, isToday, parseISO } from "date-fns"
import { cn } from "@/lib/utils"

interface QuickStatsSummaryProps {
  bookings: any[]
  selectedDate?: Date
}

export function QuickStatsSummary({ bookings, selectedDate }: QuickStatsSummaryProps) {
  const currentDate = selectedDate || new Date()
  const isViewingToday = isToday(currentDate)

  // Filter bookings for the current viewing date
  const todaysBookings = bookings.filter(booking => {
    const bookingDate = parseISO(booking.booking_time)
    return format(bookingDate, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd') &&
           booking.status === 'confirmed'
  })

  // Calculate stats
  const confirmedCount = todaysBookings.length
  const totalGuests = todaysBookings.reduce((sum, b) => sum + (b.party_size || 0), 0)

  // Find most popular time slot (group by hour)
  const timeSlots: Record<string, number> = {}
  todaysBookings.forEach(booking => {
    const hour = format(parseISO(booking.booking_time), 'ha')
    timeSlots[hour] = (timeSlots[hour] || 0) + 1
  })

  const mostPopularTime = Object.entries(timeSlots).sort((a, b) => b[1] - a[1])[0]
  const popularTimeText = mostPopularTime
    ? `${mostPopularTime[0]} (${mostPopularTime[1]} booking${mostPopularTime[1] > 1 ? 's' : ''})`
    : 'No bookings'

  // Calculate average party size
  const avgPartySize = confirmedCount > 0
    ? (totalGuests / confirmedCount).toFixed(1)
    : '0'

  const stats = [
    {
      label: 'Confirmed Bookings',
      value: confirmedCount,
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Total Guests',
      value: totalGuests,
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Most Popular Time',
      value: popularTimeText,
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      isText: true,
    },
    {
      label: 'Avg Party Size',
      value: avgPartySize,
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ]

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-foreground">
          {isViewingToday ? "Today's Quick Stats" : `Stats for ${format(currentDate, 'MMM d, yyyy')}`}
        </h2>
        {confirmedCount > 0 && (
          <span className="text-sm text-muted-foreground text-sm">{confirmedCount} booking{confirmedCount !== 1 ? 's' : ''} confirmed
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, index) => (
          <Card key={index} className={cn("border-l-4", stat.bgColor)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                  <p className={cn(
                    "font-bold",
                    stat.isText ? "text-sm" : "text-2xl",
                    stat.color
                  )}>
                    {stat.value}
                  </p>
                </div>
                <div className={cn("rounded-full p-2", stat.bgColor)}>
                  <stat.icon className={cn("h-4 w-4", stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
