// app/(dashboard)/analytics/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { restaurantAuth } from "@/lib/restaurant-auth"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BusinessIntelligenceDashboard } from "@/components/analytics/business-intelligence-dashboard"
import {
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  Star,
  Clock,
  ChefHat,
  Table2,
  Activity,
  Target,
  BarChart3,
  PieChart,
} from "lucide-react"
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns"
import { useRouter } from "next/navigation"

// Type definitions
type BookingStats = {
  total: number
  confirmed: number
  completed: number
  cancelled: number
  noShow: number
  pending: number
  revenue: number
  conversionRate: number
  averageSpend: number
}

type OperationalStats = {
  tableUtilization: number
  averageWaitTime: number
  turnoverRate: number
  capacityUtilization: number
  peakHours: Array<{ hour: string; bookings: number }>
}

type MenuPerformance = {
  topItems: Array<{ name: string; orders: number; revenue: number }>
  categoryPerformance: Array<{ category: string; orders: number; revenue: number }>
  profitMargins: Array<{ item: string; margin: number; revenue: number }>
}

type StaffMetrics = {
  activeStaff: number
  shiftEfficiency: number
  orderProcessingTime: number
  customerServiceRating: number
}

type TimeStats = {
  busiestDay: string
  busiestHour: string
  averagePartySize: number
  averageTurnTime: number
  hourlyTrends: Array<{ hour: string; bookings: number; revenue: number }>
  dailyTrends: Array<{ day: string; bookings: number; revenue: number }>
}

type ReviewStats = {
  averageRating: number
  totalReviews: number
  recentReviews: number
  recentAverage: number
  ratingDistribution: Array<{ rating: number; count: number }>
  sentimentTrend: Array<{ date: string; sentiment: number }>
}

export default function AnalyticsPage() {
  const supabase = createClient()
  const router = useRouter()
  const { currentRestaurant, isLoading: contextLoading } = useRestaurantContext()
  const [dateRange, setDateRange] = useState<string>("7days")
  const restaurantId = currentRestaurant?.restaurant.id

  // Check permissions on mount - only after context has loaded and restaurant is selected
  useEffect(() => {
    if (!contextLoading && currentRestaurant) {
      const hasPermission = restaurantAuth.hasPermission(
        currentRestaurant.permissions,
        'analytics.view',
        currentRestaurant.role
      )
      
      if (!hasPermission) {
        router.push('/bookings')
      }
    }
    // Don't redirect to overview immediately - let the context auto-select restaurant first
  }, [contextLoading, currentRestaurant, router])

  // Calculate date range
  const getDateRange = () => {
    const now = new Date()
    switch (dateRange) {
      case "7days":
        return { start: subDays(now, 7), end: now }
      case "30days":
        return { start: subDays(now, 30), end: now }
      case "thisMonth":
        return { start: startOfMonth(now), end: endOfMonth(now) }
      case "thisWeek":
        return { start: startOfWeek(now), end: endOfWeek(now) }
      default:
        return { start: subDays(now, 7), end: now }
    }
  }

  const { start, end } = getDateRange()

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  // Fetch booking statistics
  const { data: bookingStats, isLoading: bookingStatsLoading } = useQuery({
    queryKey: ["booking-stats", restaurantId, dateRange],
    queryFn: async () => {
      if (!restaurantId) return null

      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .neq("status", "payment_pending")
        .gte("booking_time", start.toISOString())
        .lte("booking_time", end.toISOString())

      if (error) throw error

      // Calculate estimated revenue (assuming $50 per person average)
      const PRICE_PER_PERSON = 50
      const completedBookings = bookings.filter(b => b.status === "completed")
      const revenue = completedBookings.reduce((sum, booking) => 
        sum + (booking.party_size * PRICE_PER_PERSON), 0
      )

      const confirmedBookings = bookings.filter(b => 
        b.status === "confirmed" || b.status === "completed"
      ).length
      const conversionRate = bookings.length > 0 ? (confirmedBookings / bookings.length) * 100 : 0
      const averageSpend = completedBookings.length > 0 ? revenue / completedBookings.length : 0

      const stats: BookingStats = {
        total: bookings.length,
        confirmed: bookings.filter(b => b.status === "confirmed").length,
        completed: completedBookings.length,
        cancelled: bookings.filter(b => 
          b.status === "cancelled_by_user" || b.status === "declined_by_restaurant"
        ).length,
        noShow: bookings.filter(b => b.status === "no_show").length,
        pending: bookings.filter(b => b.status === "pending").length,
        revenue,
        conversionRate,
        averageSpend,
      }

      return stats
    },
    enabled: !!restaurantId,
  })



  // Fetch time-based statistics
  const { data: timeStats, isLoading: timeStatsLoading } = useQuery({
    queryKey: ["time-stats", restaurantId, dateRange],
    queryFn: async () => {
      if (!restaurantId) return null

      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("booking_time, party_size, turn_time_minutes")
        .eq("restaurant_id", restaurantId)
        .neq("status", "payment_pending")
        .gte("booking_time", start.toISOString())
        .lte("booking_time", end.toISOString())
        .in("status", ["completed", "confirmed"])

      if (error) throw error

      // Calculate busiest day
      const dayCount: Record<string, number> = {}
      const dayRevenue: Record<string, number> = {}
      bookings.forEach(booking => {
        const day = format(new Date(booking.booking_time), "EEEE")
        dayCount[day] = (dayCount[day] || 0) + 1
        dayRevenue[day] = (dayRevenue[day] || 0) + (booking.party_size * 50)
      })
      const busiestDay = Object.entries(dayCount).sort(([,a], [,b]) => b - a)[0]?.[0] || "N/A"

      // Calculate busiest hour and hourly trends
      const hourCount: Record<string, number> = {}
      const hourRevenue: Record<string, number> = {}
      bookings.forEach(booking => {
        const hour = format(new Date(booking.booking_time), "ha")
        hourCount[hour] = (hourCount[hour] || 0) + 1
        hourRevenue[hour] = (hourRevenue[hour] || 0) + (booking.party_size * 50)
      })
      const busiestHour = Object.entries(hourCount).sort(([,a], [,b]) => b - a)[0]?.[0] || "N/A"

      // Create hourly trends
      const hourlyTrends = Object.entries(hourCount).map(([hour, bookings]) => ({
        hour,
        bookings,
        revenue: hourRevenue[hour] || 0
      })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour))

      // Create daily trends
      const dailyTrends = Object.entries(dayCount).map(([day, bookings]) => ({
        day,
        bookings,
        revenue: dayRevenue[day] || 0
      }))

      // Calculate averages
      const averagePartySize = bookings.length > 0 
        ? bookings.reduce((sum, b) => sum + (b.party_size || 2), 0) / bookings.length 
        : 0

      const averageTurnTime = bookings.length > 0
        ? bookings.reduce((sum, b) => sum + (b.turn_time_minutes || 120), 0) / bookings.length
        : 0

      const stats: TimeStats = {
        busiestDay,
        busiestHour,
        averagePartySize: Math.round(averagePartySize * 10) / 10,
        averageTurnTime: Math.round(averageTurnTime),
        hourlyTrends,
        dailyTrends,
      }

      return stats
    },
    enabled: !!restaurantId,
  })

  // Fetch review statistics
  const { data: reviewStats, isLoading: reviewStatsLoading } = useQuery({
    queryKey: ["review-stats", restaurantId, dateRange],
    queryFn: async () => {
      if (!restaurantId) return null

      // Get restaurant's overall stats
      const { data: restaurant, error } = await supabase
        .from("restaurants")
        .select("average_rating, total_reviews")
        .eq("id", restaurantId)
        .single()

      if (error) throw error

      // Get recent reviews in the date range
      const { data: recentReviews, error: reviewError } = await supabase
        .from("reviews")
        .select("rating, created_at")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())

      if (reviewError) throw reviewError

      // Calculate rating distribution
      const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      recentReviews?.forEach(review => {
        const rating = Math.round(review.rating) as 1 | 2 | 3 | 4 | 5
        if (rating >= 1 && rating <= 5) {
          ratingCounts[rating]++
        }
      })

      const ratingDistribution = Object.entries(ratingCounts).map(([rating, count]) => ({
        rating: parseInt(rating),
        count
      }))

      // Create sentiment trend (simplified - based on rating averages over time)
      const sentimentTrend = recentReviews ? 
        recentReviews.reduce((acc: Array<{ date: string; sentiment: number }>, review, index) => {
          if (index % Math.max(1, Math.floor(recentReviews.length / 7)) === 0) {
            acc.push({
              date: format(new Date(review.created_at), "MMM dd"),
              sentiment: review.rating
            })
          }
          return acc
        }, []) : []

      const stats: ReviewStats = {
        averageRating: restaurant.average_rating || 0,
        totalReviews: restaurant.total_reviews || 0,
        recentReviews: recentReviews?.length || 0,
        recentAverage: recentReviews && recentReviews.length > 0
          ? recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length
          : 0,
        ratingDistribution,
        sentimentTrend,
      }

      return stats
    },
    enabled: !!restaurantId,
  })

  // Fetch operational statistics
  const { data: operationalStats, isLoading: operationalStatsLoading } = useQuery({
    queryKey: ["operational-stats", restaurantId, dateRange],
    queryFn: async () => {
      if (!restaurantId) return null

      // Get table utilization data
      const { data: tables, error: tablesError } = await supabase
        .from("restaurant_tables")
        .select("id, capacity")
        .eq("restaurant_id", restaurantId)

      if (tablesError) throw tablesError

      const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0)

      // Get booking table data for utilization
      const { data: bookingTables, error: bookingTablesError } = await supabase
        .from("booking_tables")
        .select(`
          *, 
          booking:bookings!inner(booking_time, status, turn_time_minutes),
          table:restaurant_tables!inner(capacity)
        `)
        .eq("booking.restaurant_id", restaurantId)
        .gte("booking.booking_time", start.toISOString())
        .lte("booking.booking_time", end.toISOString())
        .in("booking.status", ["completed", "confirmed", "seated"])

      if (bookingTablesError) throw bookingTablesError

      const totalSeatsUsed = bookingTables.reduce((sum, bt) => 
        sum + (bt.seats_occupied || bt.table.capacity), 0
      )
      const tableUtilization = totalCapacity > 0 ? (totalSeatsUsed / totalCapacity) * 100 : 0

      // Calculate average wait time (time between booking and seating)
      const { data: seatedBookings } = await supabase
        .from("bookings")
        .select("booking_time, seated_at")
        .eq("restaurant_id", restaurantId)
        .neq("status", "payment_pending")
        .gte("booking_time", start.toISOString())
        .lte("booking_time", end.toISOString())
        .not("seated_at", "is", null)

      const averageWaitTime = seatedBookings && seatedBookings.length > 0
        ? seatedBookings.reduce((sum, booking) => {
            const waitTime = new Date(booking.seated_at!).getTime() - new Date(booking.booking_time).getTime()
            return sum + (waitTime / (1000 * 60)) // Convert to minutes
          }, 0) / seatedBookings.length
        : 0

      // Calculate turnover rate
      const hoursInPeriod = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      const turnoverRate = tables.length > 0 ? (bookingTables.length / tables.length) / hoursInPeriod : 0

      // Get peak hours data
      const hourlyBookings: Record<string, number> = {}
      bookingTables.forEach(bt => {
        const hour = format(new Date(bt.booking.booking_time), "HH:mm")
        hourlyBookings[hour] = (hourlyBookings[hour] || 0) + 1
      })

      const peakHours = Object.entries(hourlyBookings)
        .map(([hour, bookings]) => ({ hour, bookings }))
        .sort((a, b) => b.bookings - a.bookings)
        .slice(0, 5)

      const stats: OperationalStats = {
        tableUtilization: Math.round(tableUtilization * 10) / 10,
        averageWaitTime: Math.round(averageWaitTime),
        turnoverRate: Math.round(turnoverRate * 100) / 100,
        capacityUtilization: Math.round((totalSeatsUsed / (totalCapacity * hoursInPeriod)) * 100 * 10) / 10,
        peakHours,
      }

      return stats
    },
    enabled: !!restaurantId,
  })

  // Fetch menu performance data
  const { data: menuPerformance, isLoading: menuPerformanceLoading } = useQuery({
    queryKey: ["menu-performance", restaurantId, dateRange],
    queryFn: async () => {
      if (!restaurantId) return null

      // Get order items with menu item details
      const { data: orderItems, error } = await supabase
        .from("order_items")
        .select(`
          *, 
          menu_item:menu_items!inner(name, price, category:menu_categories(name)),
          order:orders!inner(created_at)
        `)
        .eq("order.restaurant_id", restaurantId)
        .gte("order.created_at", start.toISOString())
        .lte("order.created_at", end.toISOString())

      if (error) throw error

      // Calculate top items
      const itemStats: Record<string, { orders: number; revenue: number; cost: number }> = {}
      orderItems?.forEach(item => {
        const name = item.menu_item.name
        if (!itemStats[name]) {
          itemStats[name] = { orders: 0, revenue: 0, cost: 0 }
        }
        itemStats[name].orders += item.quantity
        itemStats[name].revenue += item.quantity * item.unit_price
        itemStats[name].cost += item.quantity * (item.unit_price * 0.3) // Assume 30% cost ratio
      })

      const topItems = Object.entries(itemStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)

      // Calculate category performance
      const categoryStats: Record<string, { orders: number; revenue: number }> = {}
      orderItems?.forEach(item => {
        const category = item.menu_item.category?.name || "Other"
        if (!categoryStats[category]) {
          categoryStats[category] = { orders: 0, revenue: 0 }
        }
        categoryStats[category].orders += item.quantity
        categoryStats[category].revenue += item.quantity * item.unit_price
      })

      const categoryPerformance = Object.entries(categoryStats)
        .map(([category, stats]) => ({ category, ...stats }))
        .sort((a, b) => b.revenue - a.revenue)

      // Calculate profit margins
      const profitMargins = topItems.map(item => ({
        item: item.name,
        margin: item.revenue > 0 ? ((item.revenue - item.cost) / item.revenue) * 100 : 0,
        revenue: item.revenue
      })).sort((a, b) => b.margin - a.margin)

      const stats: MenuPerformance = {
        topItems,
        categoryPerformance,
        profitMargins,
      }

      return stats
    },
    enabled: !!restaurantId,
  })

  // Fetch staff metrics
  const { data: staffMetrics, isLoading: staffMetricsLoading } = useQuery({
    queryKey: ["staff-metrics", restaurantId, dateRange],
    queryFn: async () => {
      if (!restaurantId) return null

      // Get active staff count
      const { data: activeStaff, error: staffError } = await supabase
        .from("restaurant_staff")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)

      if (staffError) throw staffError

      // Get staff shifts for efficiency calculation
      const { data: shifts, error: shiftsError } = await supabase
        .from("staff_shifts")
        .select(`
          *, 
          staff:restaurant_staff!inner(restaurant_id)
        `)
        .eq("staff.restaurant_id", restaurantId)
        .gte("start_time", start.toISOString())
        .lte("end_time", end.toISOString())

      if (shiftsError) throw shiftsError

      // Calculate average shift efficiency (simplified metric)
      const totalShiftHours = shifts?.reduce((sum, shift) => {
        const hours = (new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / (1000 * 60 * 60)
        return sum + hours
      }, 0) || 0

      const shiftEfficiency = shifts && shifts.length > 0 ? (totalShiftHours / shifts.length) : 0

      // Get order processing times
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("created_at, confirmed_at, ready_at")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .not("ready_at", "is", null)

      if (ordersError) throw ordersError

      const orderProcessingTime = orders && orders.length > 0
        ? orders.reduce((sum, order) => {
            const processingTime = new Date(order.ready_at!).getTime() - new Date(order.created_at).getTime()
            return sum + (processingTime / (1000 * 60)) // Convert to minutes
          }, 0) / orders.length
        : 0

      const stats: StaffMetrics = {
        activeStaff: activeStaff?.length || 0,
        shiftEfficiency: Math.round(shiftEfficiency * 10) / 10,
        orderProcessingTime: Math.round(orderProcessingTime),
        customerServiceRating: 4.2, // This would come from customer feedback
      }

      return stats
    },
    enabled: !!restaurantId,
  })

  const isDataLoading = bookingStatsLoading || timeStatsLoading || reviewStatsLoading || 
                        operationalStatsLoading || menuPerformanceLoading || staffMetricsLoading

  // Show loading while context is loading or while we have a restaurant but data is loading
  if (contextLoading || (currentRestaurant && isDataLoading)) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-3 text-sm">Loading analytics...</p>
        </div>
      </div>
    )
  }

  // Only show "no restaurant selected" if context has loaded and there's still no restaurant
  if (!contextLoading && (!currentRestaurant || !restaurantId)) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No restaurant selected.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Compact Header Bar */}
      <div className="flex-shrink-0 px-3 py-2 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-violet-500 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Analytics</h1>
              <p className="text-xs text-muted-foreground">Performance & insights</p>
            </div>
          </div>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 days</SelectItem>
              <SelectItem value="30days">Last 30 days</SelectItem>
              <SelectItem value="thisWeek">This week</SelectItem>
              <SelectItem value="thisMonth">This month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-3">
          {/* Pill-Style Stats */}
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 dark:bg-violet-950 rounded-full border border-violet-200 dark:border-violet-800">
              <Calendar className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              <span className="text-xs font-medium">{bookingStats?.total || 0} bookings</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950 rounded-full border border-emerald-200 dark:border-emerald-800">
              <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-medium">${bookingStats?.revenue?.toLocaleString() || 0}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950 rounded-full border border-blue-200 dark:border-blue-800">
              <Table2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-medium">{operationalStats?.tableUtilization || 0}% util</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-950 rounded-full border border-amber-200 dark:border-amber-800">
              <Star className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 fill-amber-500" />
              <span className="text-xs font-medium">{reviewStats?.averageRating ? reviewStats.averageRating.toFixed(1) : "0.0"}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 dark:bg-orange-950 rounded-full border border-orange-200 dark:border-orange-800">
              <ChefHat className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
              <span className="text-xs font-medium">{staffMetrics?.activeStaff || 0} staff</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-50 dark:bg-cyan-950 rounded-full border border-cyan-200 dark:border-cyan-800">
              <Activity className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
              <span className="text-xs font-medium">{operationalStats?.turnoverRate ? (operationalStats.turnoverRate * 100).toFixed(0) : 0}% eff</span>
            </div>
          </div>

          {/* Compact Quick Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button 
              onClick={() => router.push("/analytics/customers")} 
              variant="outline" 
              className="h-12 flex-col gap-1 p-2"
            >
              <Users className="h-3.5 w-3.5" />
              <span className="text-xs">Customers</span>
            </Button>
            
            <Button 
              onClick={() => router.push("/menu")} 
              variant="outline" 
              className="h-12 flex-col gap-1 p-2"
            >
              <ChefHat className="h-3.5 w-3.5" />
              <span className="text-xs">Menu</span>
            </Button>
            
            <Button 
              onClick={() => router.push("/staff")} 
              variant="outline" 
              className="h-12 flex-col gap-1 p-2"
            >
              <Activity className="h-3.5 w-3.5" />
              <span className="text-xs">Staff</span>
            </Button>
            
            <Button 
              onClick={() => router.push("/bookings")} 
              variant="outline" 
              className="h-12 flex-col gap-1 p-2"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span className="text-xs">Bookings</span>
            </Button>
          </div>

          <Tabs defaultValue="overview" className="space-y-3">
            <div className="overflow-x-auto -mx-3 px-3">
              <TabsList className="h-8 p-0.5 min-w-max">
                <TabsTrigger value="overview" className="text-xs h-7 px-2">Overview</TabsTrigger>
                <TabsTrigger value="revenue" className="text-xs h-7 px-2">Revenue</TabsTrigger>
                <TabsTrigger value="bookings" className="text-xs h-7 px-2">Bookings</TabsTrigger>
                <TabsTrigger value="customers" className="text-xs h-7 px-2">Customers</TabsTrigger>
                <TabsTrigger value="menu" className="text-xs h-7 px-2">Menu</TabsTrigger>
                <TabsTrigger value="staff" className="text-xs h-7 px-2">Staff</TabsTrigger>
                <TabsTrigger value="operations" className="text-xs h-7 px-2">Ops</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="space-y-3">
              <BusinessIntelligenceDashboard />
              
              {/* Real-time Metrics Overview */}
              <div className="grid gap-2 md:grid-cols-2">
                <Card className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-3.5 w-3.5 text-violet-500" />
                    <span className="text-xs font-semibold">Peak Hours Analysis</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Busiest Day:</span>
                      <span className="text-xs font-medium">{timeStats?.busiestDay || "N/A"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Peak Hour:</span>
                      <span className="text-xs font-medium">{timeStats?.busiestHour || "N/A"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Capacity:</span>
                      <span className="text-xs font-medium">{operationalStats?.capacityUtilization || 0}%</span>
                    </div>
                    <div className="pt-1 border-t space-y-1">
                      <span className="text-xs text-muted-foreground">Top Hours:</span>
                      {operationalStats?.peakHours?.slice(0, 3).map((hour, index) => (
                        <div key={index} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{hour.hour}</span>
                          <span className="font-medium">{hour.bookings}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>

                <Card className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-3.5 w-3.5 text-violet-500" />
                    <span className="text-xs font-semibold">Performance Indicators</span>
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Conversion Rate</span>
                        <span className="text-xs font-medium">{bookingStats?.conversionRate?.toFixed(1) || 0}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5">
                        <div 
                          className="bg-violet-500 h-1.5 rounded-full" 
                          style={{ width: `${Math.min(bookingStats?.conversionRate || 0, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Table Utilization</span>
                        <span className="text-xs font-medium">{operationalStats?.tableUtilization || 0}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5">
                        <div 
                          className="bg-emerald-500 h-1.5 rounded-full" 
                          style={{ width: `${Math.min(operationalStats?.tableUtilization || 0, 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Staff Efficiency</span>
                        <span className="text-xs font-medium">{staffMetrics?.customerServiceRating ? (staffMetrics.customerServiceRating * 20).toFixed(0) : 0}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5">
                        <div 
                          className="bg-blue-500 h-1.5 rounded-full" 
                          style={{ width: `${Math.min((staffMetrics?.customerServiceRating || 0) * 20, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="revenue" className="space-y-3">
              <Card className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-semibold">Revenue Analytics</span>
                </div>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <div className="text-lg font-bold">{bookingStats ? formatCurrency(bookingStats.revenue) : '$0'}</div>
                    <p className="text-xs text-muted-foreground">Total Revenue</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <div className="text-lg font-bold">{bookingStats ? formatCurrency(bookingStats.averageSpend) : '$0'}</div>
                    <p className="text-xs text-muted-foreground">Avg Spend</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <div className="text-lg font-bold">{bookingStats?.completed || 0}</div>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="bookings" className="space-y-3">
              <Card className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-xs font-semibold">Booking Analytics</span>
                </div>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-medium mb-2">Status</h4>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Total</span>
                        <Badge variant="outline" className="text-xs h-5">{bookingStats?.total || 0}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Confirmed</span>
                        <Badge className="text-xs h-5">{bookingStats?.confirmed || 0}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Completed</span>
                        <Badge className="text-xs h-5 bg-emerald-500">{bookingStats?.completed || 0}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Cancelled</span>
                        <Badge variant="destructive" className="text-xs h-5">{bookingStats?.cancelled || 0}</Badge>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium mb-2">Performance</h4>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Conversion</span>
                        <span className="text-xs font-medium">{bookingStats?.conversionRate?.toFixed(1) || 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Busiest Day</span>
                        <span className="text-xs font-medium">{timeStats?.busiestDay || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Peak Hour</span>
                        <span className="text-xs font-medium">{timeStats?.busiestHour || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="customers" className="space-y-3">
              <Card className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-xs font-semibold">Customer Analytics</span>
                </div>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-medium mb-2">Metrics</h4>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Avg Party Size</span>
                        <span className="text-xs font-medium">{timeStats?.averagePartySize || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Avg Rating</span>
                        <span className="text-xs font-medium flex items-center gap-1">
                          {reviewStats?.averageRating?.toFixed(1) || '0.0'}
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">New Reviews</span>
                        <span className="text-xs font-medium">{reviewStats?.recentReviews || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium mb-2">Engagement</h4>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Total Reviews</span>
                        <span className="text-xs font-medium">{reviewStats?.totalReviews || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Recent Avg</span>
                        <span className="text-xs font-medium">{reviewStats?.recentAverage?.toFixed(1) || '0.0'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="menu" className="space-y-3">
              <div className="grid gap-2 md:grid-cols-2">
                <Card className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-3.5 w-3.5 text-violet-500" />
                    <span className="text-xs font-semibold">Top Items</span>
                  </div>
                  <div className="space-y-2">
                    {menuPerformance?.topItems?.slice(0, 5).map((item, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <div>
                          <p className="text-xs font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.orders} orders</p>
                        </div>
                        <span className="text-xs font-medium">${item.revenue.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <PieChart className="h-3.5 w-3.5 text-violet-500" />
                    <span className="text-xs font-semibold">Categories</span>
                  </div>
                  <div className="space-y-2">
                    {menuPerformance?.categoryPerformance?.map((category, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <div>
                          <p className="text-xs font-medium">{category.category}</p>
                          <p className="text-xs text-muted-foreground">{category.orders} orders</p>
                        </div>
                        <span className="text-xs font-medium">${category.revenue.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="md:col-span-2 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-xs font-semibold">Profit Margins</span>
                  </div>
                  <div className="space-y-2">
                    {menuPerformance?.profitMargins?.slice(0, 6).map((item, index) => (
                      <div key={index} className="flex justify-between items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{item.item}</p>
                          <div className="w-full bg-secondary rounded-full h-1.5 mt-0.5">
                            <div 
                              className="bg-emerald-500 h-1.5 rounded-full" 
                              style={{ width: `${Math.min(item.margin, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-medium">{item.margin.toFixed(0)}%</p>
                          <p className="text-xs text-muted-foreground">${item.revenue.toFixed(0)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="staff" className="space-y-3">
              <div className="grid gap-2 md:grid-cols-2">
                <Card className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-3.5 w-3.5 text-violet-500" />
                    <span className="text-xs font-semibold">Staff Overview</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Active Staff:</span>
                      <span className="text-sm font-bold">{staffMetrics?.activeStaff || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Avg Shift:</span>
                      <span className="text-sm font-bold">{staffMetrics?.shiftEfficiency || 0}h</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Order Time:</span>
                      <span className="text-sm font-bold">{staffMetrics?.orderProcessingTime || 0}m</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Service Rating:</span>
                      <span className="text-sm font-bold flex items-center gap-1">
                        {staffMetrics?.customerServiceRating || 0}
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      </span>
                    </div>
                  </div>
                </Card>

                <Card className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-3.5 w-3.5 text-violet-500" />
                    <span className="text-xs font-semibold">Efficiency</span>
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Order Processing</span>
                        <span className="text-xs font-medium">
                          {staffMetrics?.orderProcessingTime && staffMetrics.orderProcessingTime < 15 ? "Excellent" : 
                           staffMetrics?.orderProcessingTime && staffMetrics.orderProcessingTime < 25 ? "Good" : "Needs Work"}
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5">
                        <div 
                          className={`h-1.5 rounded-full ${
                            staffMetrics?.orderProcessingTime && staffMetrics.orderProcessingTime < 15 ? "bg-emerald-500" :
                            staffMetrics?.orderProcessingTime && staffMetrics.orderProcessingTime < 25 ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${Math.max(20, Math.min(100 - (staffMetrics?.orderProcessingTime || 30), 100))}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Customer Satisfaction</span>
                        <span className="text-xs font-medium">{((staffMetrics?.customerServiceRating || 0) * 20).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5">
                        <div 
                          className="bg-blue-500 h-1.5 rounded-full" 
                          style={{ width: `${Math.min((staffMetrics?.customerServiceRating || 0) * 20, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="operations" className="space-y-3">
              <Card className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-xs font-semibold">Operational Analytics</span>
                </div>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-medium mb-2">Table Operations</h4>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Utilization</span>
                        <span className="text-xs font-medium">{operationalStats?.tableUtilization || 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Wait Time</span>
                        <span className="text-xs font-medium">{operationalStats?.averageWaitTime || 0}m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Turnover</span>
                        <span className="text-xs font-medium">{operationalStats?.turnoverRate || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium mb-2">Service Metrics</h4>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Turn Time</span>
                        <span className="text-xs font-medium">{timeStats?.averageTurnTime || 0}m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Party Size</span>
                        <span className="text-xs font-medium">{timeStats?.averagePartySize || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">No-Show</span>
                        <span className="text-xs font-medium">
                          {bookingStats && bookingStats.total > 0
                            ? Math.round((bookingStats.noShow / bookingStats.total) * 100)
                            : 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mt-3 pt-3 border-t">
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium">Table Turnover</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Avg {timeStats?.averageTurnTime || 0}min turnover
                      {(timeStats?.averageTurnTime || 0) > 150 && " - Consider optimizing service flow"}
                    </p>
                  </div>

                  <div className="p-2 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium">Completion Rate</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {bookingStats && bookingStats.total > 0
                        ? Math.round((bookingStats.completed / bookingStats.total) * 100)
                        : 0}% of bookings completed
                    </p>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

