// app/(dashboard)/analytics/customers/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { restaurantAuth } from "@/lib/restaurant-auth"
import { useQuery } from "@tanstack/react-query"
import { 
  startOfMonth, 
  endOfMonth, 
  subMonths,
  format,
  differenceInDays
} from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts"
import { 
  Users,
  UserPlus,
  UserCheck,
  Star,
  TrendingUp,
  Calendar,
  Download,
  ArrowLeft,
  Heart,
  AlertCircle,
  Clock,
  Repeat,
  RefreshCw
} from "lucide-react"

type TimeRange = "month" | "quarter" | "year"
type CustomerSegment = "new" | "returning" | "frequent" | "at_risk" | "lost"

interface CustomerMetrics {
  totalCustomers: number
  newCustomers: number
  returningCustomers: number
  frequentCustomers: number
  averageLifetimeValue: number
  customerRetentionRate: number
  averageVisitFrequency: number
  customerSatisfaction: number
  segmentDistribution: Array<{name: string, value: number, percentage: number}>
  acquisitionTrend: Array<{month: string, newCustomers: number}>
  visitFrequencyDistribution: Array<{range: string, count: number, percentage: number}>
  topCustomers: Array<any>
  customerLifecycle: Array<{stage: string, value: number}>
  segments: Record<string, number>
}

export default function CustomerAnalyticsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { currentRestaurant, isLoading: contextLoading } = useRestaurantContext()
  const restaurantId = currentRestaurant?.restaurant.id
  const [timeRange, setTimeRange] = useState<TimeRange>("quarter")

  // Check permissions on mount
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
  }, [contextLoading, currentRestaurant, router])

  // Get date range - use created_at for when customers first booked
  const getDateRange = () => {
    const now = new Date()
    switch (timeRange) {
      case "month":
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
        }
      case "quarter":
        return {
          start: startOfMonth(subMonths(now, 2)),
          end: endOfMonth(now),
        }
      case "year":
        return {
          start: startOfMonth(subMonths(now, 11)),
          end: endOfMonth(now),
        }
    }
  }

  const dateRange = getDateRange()

  // Fetch customer data
  const { data: customerData, isLoading, error } = useQuery({
    queryKey: ["customer-analytics", restaurantId, timeRange],
    queryFn: async () => {
      if (!restaurantId) return null



      // First, let's get ALL bookings for this restaurant to see if there's any data
      const { data: allBookings, error: allBookingsError } = await supabase
        .from("bookings")
        .select(`
          id,
          user_id,
          restaurant_id,
          booking_time,
          created_at,
          party_size,
          status,
          profiles!bookings_user_id_fkey(
            id,
            full_name,
            created_at,
            avatar_url
          )
        `)
        .eq("restaurant_id", restaurantId)
        .neq("status", "payment_pending")
        .not("user_id", "is", null)
        .order("created_at", { ascending: false })



      if (allBookingsError) {
        console.error("Error fetching all bookings:", allBookingsError)
        throw allBookingsError
      }

      // Now filter by date range for period-specific analysis
      const { data: periodBookings, error: periodError } = await supabase
        .from("bookings")
        .select(`
          id,
          user_id,
          restaurant_id,
          booking_time,
          created_at,
          party_size,
          status,
          profiles!bookings_user_id_fkey(
            id,
            full_name,
            created_at,
            avatar_url
          )
        `)
        .eq("restaurant_id", restaurantId)
        .neq("status", "payment_pending")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .not("user_id", "is", null)

      if (periodError) {
        console.error("Error fetching period bookings:", periodError)
        throw periodError
      }

      // Fetch reviews for customer satisfaction
      const { data: reviews, error: reviewsError } = await supabase
        .from("reviews")
        .select("rating, user_id, booking_id, created_at")
        .eq("restaurant_id", restaurantId)

      if (reviewsError) {
        console.error("Error fetching reviews:", reviewsError)
        // Don't throw error for reviews, just continue without them
      }

      // Fetch favorites to understand customer engagement
      const { data: favorites, error: favoritesError } = await supabase
        .from("favorites")
        .select("user_id, created_at")
        .eq("restaurant_id", restaurantId)

      if (favoritesError) {
        console.error("Error fetching favorites:", favoritesError)
        // Don't throw error for favorites, just continue without them
      }

      const result = {
        allBookings: allBookings || [],
        periodBookings: periodBookings || [],
        reviews: reviews || [],
        favorites: favorites || [],
      }

      return result
    },
    enabled: !!restaurantId,
  })

  // Calculate customer metrics
  const calculateMetrics = (): CustomerMetrics => {

    if (!customerData) {
      return {
        totalCustomers: 0,
        newCustomers: 0,
        returningCustomers: 0,
        frequentCustomers: 0,
        averageLifetimeValue: 0,
        customerRetentionRate: 0,
        averageVisitFrequency: 0,
        customerSatisfaction: 0,
        segmentDistribution: [],
        acquisitionTrend: [],
        visitFrequencyDistribution: [],
        topCustomers: [],
        customerLifecycle: [],
        segments: {},
      }
    }

    const { allBookings, periodBookings, reviews, favorites } = customerData
    const favoriteUserIds = new Set(favorites.map((f: any) => f.user_id))

    // Process unique customers and their stats from all bookings
    const uniqueCustomers = new Map()
    const customerStats = new Map()

    // Process ALL bookings to get complete customer picture
    allBookings.forEach((booking: any) => {
      if (!booking.user_id || !booking.profiles) return
      
      if (!uniqueCustomers.has(booking.user_id)) {
        uniqueCustomers.set(booking.user_id, {
          ...booking.profiles,
          firstBooking: booking.created_at,
          bookings: [],
          isFavorite: favoriteUserIds.has(booking.user_id),
        })
      }
      
      uniqueCustomers.get(booking.user_id).bookings.push(booking)

      // Update first booking if this is earlier
      const existingCustomer = uniqueCustomers.get(booking.user_id)
      if (new Date(booking.created_at) < new Date(existingCustomer.firstBooking)) {
        existingCustomer.firstBooking = booking.created_at
      }
    })

    // Build detailed customer stats
    allBookings.forEach((booking: any) => {
      if (!booking.user_id) return

      if (!customerStats.has(booking.user_id)) {
        customerStats.set(booking.user_id, {
          totalBookings: 0,
          totalGuests: 0,
          firstVisit: booking.created_at,
          lastVisit: booking.booking_time,
          completedBookings: 0,
        })
      }
      
      const stats = customerStats.get(booking.user_id)
      stats.totalBookings++
      stats.totalGuests += booking.party_size || 1
      
      // Update first and last visit dates
      if (new Date(booking.created_at) < new Date(stats.firstVisit)) {
        stats.firstVisit = booking.created_at
      }
      if (new Date(booking.booking_time) > new Date(stats.lastVisit)) {
        stats.lastVisit = booking.booking_time
      }
      
      if (booking.status === "completed") {
        stats.completedBookings++
      }
    })

    // Segment customers based on all-time behavior
    const segments = {
      new: 0,
      returning: 0,
      frequent: 0,
      at_risk: 0,
      lost: 0,
    }

    const now = new Date()
    uniqueCustomers.forEach((_, userId) => {
      const stats = customerStats.get(userId)
      if (!stats) return

      const daysSinceLastVisit = differenceInDays(now, new Date(stats.lastVisit))
      const totalBookings = stats.totalBookings

      if (totalBookings === 1) {
        segments.new++
      } else if (totalBookings >= 5) {
        segments.frequent++
      } else if (daysSinceLastVisit > 90) {
        segments.lost++
      } else if (daysSinceLastVisit > 60) {
        segments.at_risk++
      } else {
        segments.returning++
      }
    })

    // Calculate customers who made bookings in the current period
    const periodCustomerIds = new Set(periodBookings.map((b: any) => b.user_id))

    // Calculate metrics
    const totalCustomers = uniqueCustomers.size
    const newCustomersInPeriod = Array.from(periodCustomerIds).filter(userId => {
      const stats = customerStats.get(userId)
      return stats && new Date(stats.firstVisit) >= dateRange.start
    }).length

    const returningCustomersCount = segments.returning + segments.frequent

    // Customer retention rate (customers with >1 booking)
    const customerRetentionRate = totalCustomers > 0 
      ? ((returningCustomersCount) / totalCustomers) * 100 
      : 0

    // Average lifetime value (estimated at $50 per person)
    const PRICE_PER_PERSON = 50
    const totalRevenue = Array.from(customerStats.values()).reduce((sum: number, stats: any) => 
      sum + (stats.completedBookings * PRICE_PER_PERSON * (stats.totalGuests / Math.max(stats.totalBookings, 1))), 0
    )
    const averageLifetimeValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0

    // Customer satisfaction (average rating)
    const customerSatisfaction = reviews.length > 0 
      ? reviews.reduce((sum: number, review: any) => sum + review.rating, 0) / reviews.length 
      : 0

    // Visit frequency (average bookings per customer)
    const totalBookingsAllTime = Array.from(customerStats.values()).reduce((sum: number, stats: any) => 
      sum + stats.totalBookings, 0
    )
    const averageVisitFrequency = totalCustomers > 0 ? totalBookingsAllTime / totalCustomers : 0

    // Segment distribution for pie chart
    const segmentDistribution = Object.entries(segments).map(([segment, count]) => ({
      name: segment.charAt(0).toUpperCase() + segment.slice(1).replace('_', ' '),
      value: count,
      percentage: totalCustomers > 0 ? (count / totalCustomers) * 100 : 0,
    }))

    // Customer acquisition trend (new customers per month) - last 12 months
    const acquisitionTrend = []
    for (let i = 11; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(now, i))
      const monthEnd = endOfMonth(subMonths(now, i))
      
      const newInMonth = Array.from(customerStats.values()).filter((stats: any) => {
        const firstVisit = new Date(stats.firstVisit)
        return firstVisit >= monthStart && firstVisit <= monthEnd
      }).length

      acquisitionTrend.push({
        month: format(monthStart, "MMM"),
        newCustomers: newInMonth,
      })
    }

    // Visit frequency distribution
    const frequencyBuckets = {
      "1 visit": 0,
      "2-3 visits": 0,
      "4-6 visits": 0,
      "7+ visits": 0,
    }

    customerStats.forEach((stats: any) => {
      if (stats.totalBookings === 1) frequencyBuckets["1 visit"]++
      else if (stats.totalBookings <= 3) frequencyBuckets["2-3 visits"]++
      else if (stats.totalBookings <= 6) frequencyBuckets["4-6 visits"]++
      else frequencyBuckets["7+ visits"]++
    })

    const visitFrequencyDistribution = Object.entries(frequencyBuckets).map(([range, count]) => ({
      range,
      count,
      percentage: customerStats.size > 0 ? (count / customerStats.size) * 100 : 0,
    }))

    // Top customers by total bookings and estimated spending
    const topCustomers = Array.from(uniqueCustomers.entries())
      .map(([userId, customer]) => {
        const stats = customerStats.get(userId) || { totalBookings: 0, totalGuests: 0, completedBookings: 0 }
        const avgRating = reviews.filter((r: any) => r.user_id === userId).length > 0
          ? reviews.filter((r: any) => r.user_id === userId).reduce((sum: number, r: any) => sum + r.rating, 0) / 
            reviews.filter((r: any) => r.user_id === userId).length
          : 0

        return {
          id: userId,
          ...customer,
          totalBookings: stats.totalBookings,
          totalSpent: stats.completedBookings * PRICE_PER_PERSON * (stats.totalGuests / Math.max(stats.totalBookings, 1)),
          avgRating,
          status: customer.isFavorite ? "Favorite" : "Regular",
        }
      })
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10)

    // Customer lifecycle stages
    const customerLifecycle = [
      { stage: "New", value: segments.new },
      { stage: "Returning", value: segments.returning },
      { stage: "Frequent", value: segments.frequent },
      { stage: "At Risk", value: segments.at_risk },
      { stage: "Lost", value: segments.lost },
    ]

    const result = {
      totalCustomers,
      newCustomers: newCustomersInPeriod,
      returningCustomers: returningCustomersCount,
      frequentCustomers: segments.frequent,
      averageLifetimeValue,
      customerRetentionRate,
      averageVisitFrequency,
      customerSatisfaction,
      segmentDistribution,
      acquisitionTrend,
      visitFrequencyDistribution,
      topCustomers,
      customerLifecycle,
      segments,
    }

    return result
  }

  const metrics = calculateMetrics()

  const getSegmentColor = (segment: string) => {
    switch (segment.toLowerCase()) {
      case "new": return "#10B981" // Keep green for new
      case "returning": return "#7A2E4A" // Mulberry Velvet
      case "frequent": return "#D4C4E0" // Lavender Fog
      case "at risk": return "#F97316" // Orange
      case "lost": return "#787878" // Charcoal Mood
      default: return "#D4C4E0" // Lavender Fog
    }
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">Error loading customer analytics</p>
          <p className="text-sm text-gray-500 mt-2">{error.message}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (contextLoading || isLoading || !restaurantId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="motion-safe:animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">Loading customer analytics...</p>
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => router.push("/analytics")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="w-8 h-8 rounded-md bg-violet-500 flex items-center justify-center">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Customer Analytics</h1>
              <p className="text-xs text-muted-foreground">Behavior patterns & insights</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <SelectTrigger className="w-[110px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Download className="mr-1 h-3.5 w-3.5" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {/* No Data Warning */}
      {customerData && customerData.allBookings.length === 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-blue-900">No Customer Data</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-700">
              No customer bookings found for this restaurant. Make sure you have bookings with registered users to see customer analytics.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{metrics.totalCustomers}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                <UserPlus className="mr-1 h-3 w-3" />
                {metrics.newCustomers} new this period
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
            <Repeat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {metrics.customerRetentionRate.toFixed(1)}%
            </div>
            <Progress value={metrics.customerRetentionRate} className="mt-2" />
          </CardContent>
        </Card>

 

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold flex items-center gap-1">
              {metrics.customerSatisfaction.toFixed(1)}
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            </div>
            <p className="text-xs text-muted-foreground text-sm">Average rating
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Segments */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer Segments</CardTitle>
            <CardDescription>
              Distribution of your customer base
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.segmentDistribution.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={metrics.segmentDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }: any) => `${name}: ${percentage.toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {metrics.segmentDistribution.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={getSegmentColor(entry.name)} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Segment Details */}
                <div className="mt-4 space-y-2">
                  {Object.entries(metrics.segments).map(([segment, count]: any) => (
                    <div key={segment} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: getSegmentColor(segment) }}
                        />
                        <span className="text-sm capitalize">
                          {segment.replace('_', ' ')}
                        </span>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-muted-foreground">No customer segments to display</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Acquisition</CardTitle>
            <CardDescription>
              New customers acquired over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.acquisitionTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics.acquisitionTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="newCustomers" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-muted-foreground">No acquisition data to display</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Visit Frequency & Lifecycle */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Visit Frequency</CardTitle>
            <CardDescription>
              How often customers visit your restaurant
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.visitFrequencyDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.visitFrequencyDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-muted-foreground">No visit frequency data to display</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Lifecycle</CardTitle>
            <CardDescription>
              Distribution across lifecycle stages
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.customerLifecycle.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={metrics.customerLifecycle}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="stage" />
                  <PolarRadiusAxis />
                  <Radar 
                    name="Customers" 
                    dataKey="value" 
                    stroke="#8b5cf6" 
                    fill="#8b5cf6" 
                    fillOpacity={0.6} 
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-muted-foreground">No lifecycle data to display</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Customers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Customers</CardTitle>
          <CardDescription>
            Your most valuable customers by total spend
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.topCustomers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Total Bookings</TableHead>
          
                  <TableHead>Avg Rating</TableHead>
                  <TableHead>Member Since</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.topCustomers.map((customer: any) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={customer.avatar_url} />
                          <AvatarFallback>
                            {customer.full_name?.split(" ").map((n: string) => n[0]).join("") || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{customer.full_name || "N/A"}</div>
                          <div className="text-sm text-muted-foreground text-sm">Customer ID: {customer.id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{customer.totalBookings}</TableCell>
               
                    <TableCell>
                      {customer.avgRating > 0 ? (
                        <div className="flex items-center gap-1">
                          {customer.avgRating.toFixed(1)}
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(customer.created_at), "MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.status === "Favorite" ? "default" : "secondary"}>
                        {customer.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-4">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No customers to display</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Insights</CardTitle>
          <CardDescription>
            Key findings and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.totalCustomers === 0 ? (
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold">Get Started with Customer Analytics</h4>
                  <p className="text-sm text-muted-foreground text-sm">Start collecting customer data by encouraging users to create accounts when making bookings. 
                    This will help you understand your customer base and improve your service.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {metrics.segments.at_risk > metrics.totalCustomers * 0.2 && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold">High Number of At-Risk Customers</h4>
                      <p className="text-sm text-muted-foreground text-sm">{metrics.segments.at_risk} customers haven't visited in 60+ days. 
                        Consider running a re-engagement campaign with special offers.
                      </p>
                    </div>
                  </div>
                )}

                {metrics.customerRetentionRate < 30 && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      <Repeat className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Low Retention Rate</h4>
                      <p className="text-sm text-muted-foreground text-sm">Only {metrics.customerRetentionRate.toFixed(1)}% of customers return. 
                        Focus on improving the dining experience and implementing a loyalty program.
                      </p>
                    </div>
                  </div>
                )}

                {metrics.customerSatisfaction >= 4.5 && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      <Heart className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Excellent Customer Satisfaction</h4>
                      <p className="text-sm text-muted-foreground text-sm">Your {metrics.customerSatisfaction.toFixed(1)} average rating shows customers love your restaurant. 
                        Leverage this in marketing and encourage reviews.
                      </p>
                    </div>
                  </div>
                )}

                {metrics.averageVisitFrequency < 2 && metrics.totalCustomers > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      <Clock className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Increase Visit Frequency</h4>
                      <p className="text-sm text-muted-foreground text-sm">Customers visit {metrics.averageVisitFrequency.toFixed(1)} times on average. 
                        Consider loyalty programs or weekday specials to increase frequency.
                      </p>
                    </div>
                  </div>
                )}

                {metrics.newCustomers > metrics.returningCustomers && metrics.totalCustomers > 10 && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Strong Customer Acquisition</h4>
                      <p className="text-sm text-muted-foreground text-sm">You're acquiring more new customers than retaining existing ones. 
                        Focus on retention strategies to maximize customer lifetime value.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}

