// components/dashboard/operational-status-cards.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Users, 
  Clock, 
  Table2, 
  UserCheck,
  AlertCircle,
  TrendingUp,
  Calendar,
  ChefHat,
  Store
} from "lucide-react"
import { format, addMinutes, isWithinInterval } from "date-fns"
import { RestaurantAvailability } from "@/lib/restaurant-availability"
import { useQuery } from "@tanstack/react-query"

interface OperationalStatusCardsProps {
  bookings: any[]
  tables: any[]
  currentTime: Date
  restaurantId: string
}

export function OperationalStatusCards({ bookings, tables, currentTime, restaurantId }: OperationalStatusCardsProps) {
  // Check current operational status
  const availability = new RestaurantAvailability()
  const { data: operationalStatus } = useQuery({
    queryKey: ["restaurant-operational-status", restaurantId, format(currentTime, 'yyyy-MM-dd HH:mm')],
    queryFn: () => availability.isRestaurantOpen(restaurantId, currentTime, format(currentTime, 'HH:mm')),
    refetchInterval: 60000, // Refetch every minute
  })

  // Calculate current dining (bookings that are happening now)
  const currentlyDining = bookings.filter(booking => {
    const bookingStart = new Date(booking.booking_time)
    const bookingEnd = addMinutes(bookingStart, booking.turn_time_minutes || 120)
    return booking.status === 'confirmed' && 
           isWithinInterval(currentTime, { start: bookingStart, end: bookingEnd })
  })

  // Calculate arriving soon (next 30 minutes)
  const arrivingSoon = bookings.filter(booking => {
    const bookingTime = new Date(booking.booking_time)
    const minutesUntil = (bookingTime.getTime() - currentTime.getTime()) / (1000 * 60)
    return booking.status === 'confirmed' && minutesUntil > 0 && minutesUntil <= 30
  })

  // Calculate departing soon (ending in next 30 minutes)
  const departingSoon = currentlyDining.filter(booking => {
    const bookingEnd = addMinutes(new Date(booking.booking_time), booking.turn_time_minutes || 120)
    const minutesUntil = (bookingEnd.getTime() - currentTime.getTime()) / (1000 * 60)
    return minutesUntil > 0 && minutesUntil <= 30
  })

  // Calculate empty tables
  const activeTables = tables.filter(table => table.is_active)
  const occupiedTableIds = currentlyDining.flatMap(booking => 
    booking.tables?.map((t: any) => t.id) || []
  )
  const emptyTables = activeTables.filter(table => 
    !occupiedTableIds.includes(table.id)
  )

  // Calculate today's metrics
  const todaysConfirmed = bookings.filter(b => b.status === 'confirmed').length
  const todaysPending = bookings.filter(b => b.status === 'pending').length
  const todaysCompleted = bookings.filter(b => b.status === 'completed').length
  const noShowCount = bookings.filter(b => b.status === 'no_show').length

  // Calculate total guests currently dining
  const currentGuests = currentlyDining.reduce((sum, booking) => sum + booking.party_size, 0)

  // Tables without assignment
  const unassignedBookings = bookings.filter(b => 
    b.status === 'confirmed' && (!b.tables || b.tables.length === 0)
  )

  const cards = [
    {
      title: "Restaurant Status",
      value: operationalStatus?.isOpen ? "OPEN" : "CLOSED",
      description: operationalStatus?.reason || (operationalStatus?.hours ? 
        `Open: ${operationalStatus.hours.open} - ${operationalStatus.hours.close}` : 
        "See availability settings"
      ),
      icon: Store,
      color: operationalStatus?.isOpen ? "text-green-600" : "text-red-600",
      bgColor: operationalStatus?.isOpen ? "bg-green-50" : "bg-red-50",
      details: null
    },
    {
      title: "Currently Dining",
      value: currentlyDining.length,
      description: `${currentGuests} guests total`,
      icon: ChefHat,
      color: "text-green-600",
      bgColor: "bg-green-50",
      details: currentlyDining.length > 0 ? currentlyDining.slice(0, 3).map(b => ({
        name: b.user?.full_name || b.guest_name || 'Guest',
        time: format(new Date(b.booking_time), 'h:mm a'),
        table: b.tables?.[0]?.table_number || 'Unassigned'
      })) : null
    },
    {
      title: "Arriving Soon",
      value: arrivingSoon.length,
      description: "Next 30 minutes",
      icon: Clock,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      details: arrivingSoon.length > 0 ? arrivingSoon.slice(0, 3).map(b => ({
        name: b.user?.full_name || b.guest_name || 'Guest',
        time: format(new Date(b.booking_time), 'h:mm a'),
        party: `${b.party_size} guests`
      })) : null
    },
    {
      title: "Empty Tables",
      value: emptyTables.length,
      description: `of ${activeTables.length} total`,
      icon: Table2,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      details: emptyTables.length > 0 ? emptyTables.slice(0, 5).map(t => ({
        number: t.table_number,
        capacity: `${t.min_capacity}-${t.max_capacity} seats`,
        type: t.table_type
      })) : null
    },
    {
      title: "Needs Attention",
      value: unassignedBookings.length + todaysPending,
      description: `${unassignedBookings.length} need tables, ${todaysPending} pending`,
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      urgent: (unassignedBookings.length + todaysPending) > 0
    }
  ]

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <Card key={index} className={card.urgent ? "border-red-200" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <div className={`rounded-full p-2 ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
            
            {card.details && card.details.length > 0 && (
              <div className="mt-3 space-y-1">
                {card.details.map((detail:any, idx) => (
                  <div key={idx} className="text-xs text-muted-foreground text-sm">{detail.name && <span className="font-medium">{detail.name}</span>}
                    {detail.number && <span className="font-medium">Table {detail.number}</span>}
                    {detail.time && <span> • {detail.time}</span>}
                    {detail.party && <span> • {detail.party}</span>}
                    {detail.table && <span> • T{detail.table}</span>}
                    {detail.capacity && <span> • {detail.capacity}</span>}
                    {detail.type && (
                      <Badge variant="outline" className="ml-1 text-xs">
                        {detail.type}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
