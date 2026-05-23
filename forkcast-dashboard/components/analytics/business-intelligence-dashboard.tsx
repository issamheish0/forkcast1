"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart
} from "recharts"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Activity,
  Star,
  ChefHat,
  Table2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface BusinessMetrics {
  timestamp: string
  period: {
    today: string
    thisWeek: string
    thisMonth: string
  }
  revenue: {
    today: number
    yesterday: number
    growth: number
    averageOrderValue: number
  }
  bookings: {
    total: number
    confirmed: number
    completed: number
    cancelled: number
    active: number
  }
  operations: {
    currentGuests: number
    occupancyRate: number
    activeTables: number
    occupiedTables: number
    peakHour: string
  }
  orders: {
    total: number
    completed: number
    pending: number
  }
  staff: {
    topPerformers: Array<{
      name: string
      orders: number
      completed: number
    }>
  }
  satisfaction: {
    averageRating: number
    totalReviews: number
  }
  alerts: Array<{
    type: 'error' | 'warning' | 'info'
    message: string
    priority: 'high' | 'medium' | 'low'
  }>
  trends: {
    hourlyBookings: Array<{
      hour: number
      bookings: number
    }>
  }
}

export function BusinessIntelligenceDashboard() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [mounted, setMounted] = useState(false)
  
  const supabase = createClient()
  const { currentRestaurant, isLoading: contextLoading } = useRestaurantContext()
  const restaurantId = currentRestaurant?.restaurant.id


  // Handle client-side mounting
  useEffect(() => {
    setMounted(true)
    setCurrentTime(new Date())
  }, [])

  // Update time every second (only on client)
  useEffect(() => {
    if (!mounted) return

    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [mounted])

  // Remove the old restaurant ID fetching logic since we're using context now

  const { data: metrics, isLoading, error, refetch } = useQuery({
    queryKey: ['business-metrics', restaurantId],
    queryFn: async (): Promise<BusinessMetrics | null> => {
      if (!restaurantId) return null

      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59)

      // Today's bookings
      const { data: todayBookings } = await supabase
        .from('bookings')
        .select('id, status, party_size, booking_time, created_at')
        .eq('restaurant_id', restaurantId)
        .neq('status', 'payment_pending')
        .gte('booking_time', today.toISOString())
        .lte('booking_time', todayEnd.toISOString())

      // Today's orders
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('id, status, subtotal, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', today.toISOString())
        .lte('created_at', todayEnd.toISOString())

      // Today's revenue from completed orders (excluding tax)
      const { data: todayRevenue } = await supabase
        .from('orders')
        .select('subtotal')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', today.toISOString())
        .lte('created_at', todayEnd.toISOString())
        .in('status', ['completed', 'served'])

      // Yesterday's revenue for comparison (excluding tax)
      const { data: yesterdayRevenue } = await supabase
        .from('orders')
        .select('subtotal')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', yesterday.toISOString())
        .lte('created_at', yesterdayEnd.toISOString())
        .in('status', ['completed', 'served'])

      // Currently active bookings (only those actually dining right now)
      // Only count bookings that are happening TODAY and are in active dining statuses
      const { data: activeBookings } = await supabase
        .from('bookings')
        .select('id, status, party_size, booking_time, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('booking_time', today.toISOString())
        .lte('booking_time', todayEnd.toISOString())
        .in('status', ['seated', 'ordered', 'appetizers', 'main_course', 'dessert'])

      // FORCE ZERO if no active bookings (safety check)
      const safeActiveBookings = activeBookings?.filter(booking => {
        const bookingDate = new Date(booking.booking_time)
        const isToday = bookingDate >= today && bookingDate <= todayEnd
        const isActiveStatus = ['seated', 'ordered', 'appetizers', 'main_course', 'dessert'].includes(booking.status)
        return isToday && isActiveStatus
      }) || []

      // All tables for the restaurant
      const { data: allTables } = await supabase
        .from('restaurant_tables')
        .select('id, is_active, capacity')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)

      // Get tables for the safe active bookings only
      const activeBookingIds = safeActiveBookings.map(b => b.id)

      // Now get tables for these active bookings (will be empty if no active bookings)
      const { data: occupiedTableData } = activeBookingIds.length > 0
        ? await supabase
            .from('booking_tables')
            .select('table_id, booking_id')
            .in('booking_id', activeBookingIds)
        : { data: [] }

      // Recent reviews for satisfaction
      const { data: reviews } = await supabase
        .from('reviews')
        .select('rating, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50)

      // Calculate metrics (excluding tax)
      const todayTotalRevenue = todayRevenue?.reduce((sum, order) => sum + (order.subtotal || 0), 0) || 0
      const yesterdayTotalRevenue = yesterdayRevenue?.reduce((sum, order) => sum + (order.subtotal || 0), 0) || 0
      const revenueGrowth = yesterdayTotalRevenue > 0 ? ((todayTotalRevenue - yesterdayTotalRevenue) / yesterdayTotalRevenue) * 100 : 0

      const totalBookingsToday = todayBookings?.length || 0
      const confirmedBookings = todayBookings?.filter(b => b.status === 'confirmed').length || 0
      const completedBookings = todayBookings?.filter(b => b.status === 'completed').length || 0
      const cancelledBookings = todayBookings?.filter(b => ['cancelled_by_user', 'cancelled_by_restaurant', 'no_show'].includes(b.status)).length || 0

      // Calculate correct table metrics
      const totalTables = allTables?.length || 0
      const occupiedTableIds = occupiedTableData?.map(bt => bt.table_id).filter(Boolean) || []
      const uniqueOccupiedTables = new Set(occupiedTableIds).size
      const occupancyRate = totalTables > 0 ? (uniqueOccupiedTables / totalTables) * 100 : 0


      // Calculate current guests correctly (only those actively dining)
      const currentGuests = safeActiveBookings.reduce((sum, booking) => sum + (booking.party_size || 0), 0)


      // SAFETY CHECK: Force zero if no safe active bookings
      const finalCurrentGuests = safeActiveBookings.length === 0 ? 0 : currentGuests
      const finalUniqueOccupiedTables = safeActiveBookings.length === 0 ? 0 : uniqueOccupiedTables
      const finalOccupancyRate = safeActiveBookings.length === 0 ? 0 : occupancyRate


      const totalOrdersToday = todayOrders?.length || 0
      const completedOrdersToday = todayOrders?.filter(o => ['completed', 'served'].includes(o.status)).length || 0
      const pendingOrders = todayOrders?.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.status)).length || 0
      const averageOrderValue = completedOrdersToday > 0 ? todayTotalRevenue / completedOrdersToday : 0

      const averageRating = reviews && reviews.length > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
        : 0

      // Peak hours analysis
      const hourlyBookings = todayBookings?.reduce((acc, booking) => {
        const hour = new Date(booking.booking_time).getHours()
        acc[hour] = (acc[hour] || 0) + 1
        return acc
      }, {} as Record<number, number>) || {}

      const peakHour = Object.entries(hourlyBookings)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'

      // Alerts
      const alerts = []

      if (occupancyRate > 90) {
        alerts.push({ type: 'warning' as const, message: 'Restaurant is at near full capacity', priority: 'high' as const })
      }

      if (pendingOrders > 10) {
        alerts.push({ type: 'warning' as const, message: `${pendingOrders} orders pending in kitchen`, priority: 'medium' as const })
      }

      if (averageRating < 4.0 && reviews && reviews.length >= 5) {
        alerts.push({ type: 'error' as const, message: 'Customer satisfaction below target', priority: 'high' as const })
      }

      if (revenueGrowth < -20) {
        alerts.push({ type: 'error' as const, message: 'Revenue significantly down from yesterday', priority: 'high' as const })
      }

      return {
        timestamp: now.toISOString(),
        period: {
          today: today.toISOString(),
          thisWeek: today.toISOString(),
          thisMonth: today.toISOString()
        },
        revenue: {
          today: todayTotalRevenue,
          yesterday: yesterdayTotalRevenue,
          growth: revenueGrowth,
          averageOrderValue
        },
        bookings: {
          total: totalBookingsToday,
          confirmed: confirmedBookings,
          completed: completedBookings,
          cancelled: cancelledBookings,
          active: activeBookings?.length || 0
        },
        operations: {
          currentGuests: finalCurrentGuests,
          occupancyRate: finalOccupancyRate,
          activeTables: totalTables,
          occupiedTables: finalUniqueOccupiedTables,
          peakHour: peakHour !== 'N/A' ? `${peakHour}:00` : 'N/A'
        },
        orders: {
          total: totalOrdersToday,
          completed: completedOrdersToday,
          pending: pendingOrders
        },
        staff: {
          topPerformers: [] // Simplified for now
        },
        satisfaction: {
          averageRating,
          totalReviews: reviews?.length || 0
        },
        alerts,
        trends: {
          hourlyBookings: Array.from({ length: 24 }, (_, hour) => ({
            hour,
            bookings: hourlyBookings[hour] || 0
          }))
        }
      }
    },
    enabled: !!restaurantId,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default: return <CheckCircle className="h-4 w-4 text-blue-500" />
    }
  }

  const getAlertVariant = (type: string) => {
    switch (type) {
      case 'error': return 'destructive'
      case 'warning': return 'default'
      default: return 'default'
    }
  }

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted || contextLoading || isLoading || !restaurantId) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-6 w-6 motion-safe:animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !metrics) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Failed to load business metrics</p>
        </CardContent>
      </Card>
    )
  }

  const { revenue, bookings, operations, orders, staff, satisfaction, alerts, trends } = metrics

  return (
    <div className="space-y-4">
      {/* Header with Live Time */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Business Intelligence Dashboard</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-green-500" />
            Live • Last updated: {currentTime ? format(currentTime, 'h:mm:ss a') : '--:--:--'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          refetch()
        }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Force Refresh
        </Button>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <Alert key={index} variant={getAlertVariant(alert.type) as any}>
              {getAlertIcon(alert.type)}
              <AlertDescription className="ml-2">
                <span className="font-medium">{alert.message}</span>
                <Badge variant="outline" className="ml-2 text-xs">
                  {alert.priority.toUpperCase()}
                </Badge>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Key Performance Indicators */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(revenue.today)}</div>
            <div className="flex items-center text-xs text-muted-foreground text-sm">{revenue.growth >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={cn(
                revenue.growth >= 0 ? "text-green-500" : "text-red-500"
              )}>
                {formatPercentage(revenue.growth)}
              </span>
              <span className="ml-1">vs yesterday</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Guests</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{operations.currentGuests}</div>
            <p className="text-xs text-muted-foreground text-sm">{bookings.active} active bookings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Table Occupancy</CardTitle>
            <Table2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{operations.occupancyRate.toFixed(0)}%</div>
            <div className="mt-2">
              <Progress value={operations.occupancyRate} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground text-sm">
              {operations.occupiedTables}/{operations.activeTables} tables
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customer Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold flex items-center gap-1">
              {satisfaction.averageRating.toFixed(1)}
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            </div>
            <p className="text-xs text-muted-foreground text-sm">From {satisfaction.totalReviews} recent reviews
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Operational Metrics */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Today's Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Orders</span>
                <span className="font-bold">{orders.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Completed</span>
                <span className="font-bold text-green-600">{orders.completed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pending</span>
                <span className="font-bold text-yellow-600">{orders.pending}</span>
              </div>
              <div className="mt-2">
                <Progress 
                  value={orders.total > 0 ? (orders.completed / orders.total) * 100 : 0} 
                  className="h-2" 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Booking Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Today</span>
                <span className="font-bold">{bookings.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Confirmed</span>
                <span className="font-bold text-blue-600">{bookings.confirmed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Completed</span>
                <span className="font-bold text-green-600">{bookings.completed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Cancelled</span>
                <span className="font-bold text-red-600">{bookings.cancelled}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Staff Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {staff.topPerformers.slice(0, 3).map((performer, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm font-medium">{performer.name}</span>
                  <Badge variant="outline">
                    {performer.completed} orders
                  </Badge>
                </div>
              ))}
              {staff.topPerformers.length === 0 && (
                <p className="text-sm text-muted-foreground">No orders processed yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hourly Booking Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Booking Pattern</CardTitle>
          <CardDescription>
            Hourly booking distribution • Peak hour: {operations.peakHour}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trends.hourlyBookings}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="hour" 
                tickFormatter={(value) => `${value}:00`}
              />
              <YAxis />
              <Tooltip 
                formatter={(value) => [value, 'Bookings']}
                labelFormatter={(value) => `${value}:00 - ${value + 1}:00`}
              />
              <Area 
                type="monotone" 
                dataKey="bookings" 
                stroke="#7A2E4A" 
                fill="#7A2E4A" 
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4 text-center">
            <ChefHat className="h-6 w-6 mx-auto mb-2 text-blue-600" />
            <p className="font-medium">Kitchen Display</p>
            <p className="text-xs text-muted-foreground">{orders.pending} pending</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4 text-center">
            <Calendar className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <p className="font-medium">Reservations</p>
            <p className="text-xs text-muted-foreground">{bookings.confirmed} confirmed</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4 text-center">
            <Table2 className="h-6 w-6 mx-auto mb-2 text-purple-600" />
            <p className="font-medium">Floor Plan</p>
            <p className="text-xs text-muted-foreground">{operations.occupancyRate.toFixed(0)}% occupied</p>
          </CardContent>
        </Card>

      
      </div>
    </div>
  )
}
