// components/bookings/customer-booking-history.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { format, differenceInDays } from "date-fns"
import { titleCase } from "@/lib/utils"
import { 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Clock,
  Users,
  AlertCircle
} from "lucide-react"

interface CustomerBookingHistoryProps {
  customerId: string
  currentBookingId: string
  restaurantId: string
}

interface BookingHistoryData {
  totalBookings: number
  successfulBookings: number
  cancelledBookings: number
  noShowBookings: number
  averagePartySize: number
  totalSpent: number
  averageSpent: number
  lastVisit?: string
  daysSinceLastVisit?: number
  bookingFrequency: 'first-time' | 'occasional' | 'regular' | 'frequent'
  recentBookings: Array<{
    id: string
    booking_time: string
    party_size: number
    status: string
  }>
}

export function CustomerBookingHistory({ customerId, currentBookingId, restaurantId }: CustomerBookingHistoryProps) {
  const [data, setData] = useState<BookingHistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  
  const supabase = createClient()

  useEffect(() => {
    loadBookingHistory()
  }, [customerId, restaurantId])

  const loadBookingHistory = async () => {
    try {
      setLoading(true)

      // Get customer data
      const { data: customer } = await supabase
        .from('restaurant_customers')
        .select('total_bookings, total_spent, last_visit, user_id, guest_email')
        .eq('id', customerId)
        .single()

      if (!customer) return

      // Get detailed booking history
      let bookingQuery
      if (customer.user_id) {
        bookingQuery = supabase
          .from('bookings')
          .select('id, booking_time, party_size, status')
          .eq('user_id', customer.user_id)
          .neq('status', 'payment_pending')
      } else {
        bookingQuery = supabase
          .from('bookings')
          .select('id, booking_time, party_size, status')
          .eq('guest_email', customer.guest_email)
          .neq('status', 'payment_pending')
      }

      const { data: bookings } = await bookingQuery
        .eq('restaurant_id', restaurantId)
        .neq('id', currentBookingId) // Exclude current booking
        .order('booking_time', { ascending: false })
        .limit(10)

      if (!bookings) return

      // Get total booking count for this restaurant (same logic as booking-customer-details)
      const totalBookingQuery = customer.user_id
        ? supabase.from('bookings').select('id', { count: 'exact' }).eq('user_id', customer.user_id).neq('status', 'payment_pending')
        : supabase.from('bookings').select('id', { count: 'exact' }).eq('guest_email', customer.guest_email).neq('status', 'payment_pending')

      const { count: totalBookings } = await totalBookingQuery
        .eq('restaurant_id', restaurantId)

      // Calculate statistics
      const totalBookingsCount = totalBookings || 0
      const successfulBookings = bookings.filter(b => b.status === 'completed').length
      const cancelledBookings = bookings.filter(b => 
        b.status === 'cancelled_by_user' || b.status === 'cancelled_by_restaurant'
      ).length
      const noShowBookings = bookings.filter(b => b.status === 'no_show').length
      
      const totalPartySize = bookings.reduce((sum, b) => sum + b.party_size, 0)
      const averagePartySize = bookings.length > 0 ? totalPartySize / bookings.length : 0
      
      const totalSpent = customer.total_spent || 0
      const averageSpent = totalBookingsCount > 0 ? totalSpent / totalBookingsCount : 0

      let daysSinceLastVisit: number | undefined
      if (customer.last_visit) {
        daysSinceLastVisit = differenceInDays(new Date(), new Date(customer.last_visit))
      }

      // Determine booking frequency
      let bookingFrequency: BookingHistoryData['bookingFrequency'] = 'first-time'
      if (totalBookingsCount >= 10) {
        bookingFrequency = 'frequent'
      } else if (totalBookingsCount >= 5) {
        bookingFrequency = 'regular'
      } else if (totalBookingsCount >= 2) {
        bookingFrequency = 'occasional'
      }

      const historyData: BookingHistoryData = {
        totalBookings: totalBookingsCount,
        successfulBookings,
        cancelledBookings,
        noShowBookings,
        averagePartySize,
        totalSpent,
        averageSpent,
        lastVisit: customer.last_visit,
        daysSinceLastVisit,
        bookingFrequency,
        recentBookings: bookings.slice(0, 5)
      }

      setData(historyData)
    } catch (error) {
      console.error('Error loading booking history:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="motion-safe:animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Booking History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No booking history available.</p>
        </CardContent>
      </Card>
    )
  }

  const successRate = data.totalBookings > 0 
    ? ((data.successfulBookings / data.totalBookings) * 100).toFixed(1)
    : '0'

  const getFrequencyBadgeColor = (frequency: string) => {
    switch (frequency) {
      case 'frequent': return 'bg-green-100 text-green-800'
      case 'regular': return 'bg-blue-100 text-blue-800'
      case 'occasional': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getFrequencyText = (frequency: string) => {
    switch (frequency) {
      case 'frequent': return 'Frequent Guest (10+ visits)'
      case 'regular': return 'Regular Guest (5-9 visits)'
      case 'occasional': return 'Occasional Guest (2-4 visits)'
      default: return 'First-time Guest'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Booking History
        </CardTitle>
        <CardDescription>
          Customer's booking patterns and statistics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Guest Type Badge */}
        <div className="flex items-center gap-2">
          <Badge className={getFrequencyBadgeColor(data.bookingFrequency)}>
            {getFrequencyText(data.bookingFrequency)}
          </Badge>
          {data.lastVisit && (
            <Badge variant="outline">
              <Clock className="h-3 w-3 mr-1" />
              Last: {format(new Date(data.lastVisit), 'MMM d, yyyy')}
            </Badge>
          )}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{data.totalBookings} Total Bookings</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Avg Party: {data.averagePartySize.toFixed(1)}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">${data.totalSpent.toFixed(2)} Total</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span>Avg: ${data.averageSpent.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Success Rate */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span>Success Rate</span>
            <span className="font-medium">{successRate}%</span>
          </div>
          <Progress value={parseFloat(successRate)} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground text-sm">
            <span>{data.successfulBookings} completed</span>
            <span>{data.cancelledBookings} cancelled</span>
            <span>{data.noShowBookings} no-shows</span>
          </div>
        </div>

        {/* Recent Bookings */}
        {data.recentBookings.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Recent Visits</h4>
            <div className="space-y-2">
              {data.recentBookings.map((booking) => (
                <div key={booking.id} className="grid grid-cols-3 gap-2 items-center text-xs text-center">
                  <span className="text-left">
                    {format(new Date(booking.booking_time), 'MMM d, yyyy')}
                  </span>
                  <span>Party of {booking.party_size}</span>
                  <div className="text-right">
                    <Badge 
                      variant={
                        booking.status === 'completed' ? 'default' :
                        booking.status === 'no_show' || booking.status.includes('cancelled') ? 'destructive' :
                        'secondary'
                      }
                      className={`text-xs px-1 py-0 ${
                        booking.status === 'no_show' || booking.status.includes('cancelled') ? 'text-white' : ''
                      }`}
                    >
                      {titleCase(booking.status.replace(/_/g, ' '))}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alerts */}
        {data.noShowBookings > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
            <div className="flex items-center gap-2 text-sm text-yellow-800">
              <AlertCircle className="h-4 w-4" />
              <span>
                {data.noShowBookings} previous no-show{data.noShowBookings > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
