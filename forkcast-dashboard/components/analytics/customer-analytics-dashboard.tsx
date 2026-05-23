"use client"

import { useState, useEffect } from "react"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { createClient } from "@/lib/supabase/client"
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
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import {
  Users,
  Star,
  TrendingUp,
  Calendar,
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

const COLORS = ['#7A2E4A', '#D4C4E0', '#FFF0E6', '#10B981', '#F97316', '#F59E0B'] // Brand colors with complementary colors

export function CustomerAnalyticsDashboard() {
  const supabase = createClient()
  const [timeRange, setTimeRange] = useState<TimeRange>("quarter")

  const { currentRestaurant } = useRestaurantContext()
  const restaurantId = currentRestaurant?.restaurant.id ?? ""
  const [mounted, setMounted] = useState(false)

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true)
  }, [])

  // Get date range
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
  const { data: customerData, isLoading, error, refetch } = useQuery({
    queryKey: ["customer-analytics", restaurantId, timeRange],
    queryFn: async () => {
      if (!restaurantId) return null

      // Get ALL bookings for this restaurant
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

      if (allBookingsError) throw allBookingsError

      // Get period bookings
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

      if (periodError) throw periodError

      // Fetch reviews for customer satisfaction
      const { data: reviews, error: reviewsError } = await supabase
        .from("reviews")
        .select("rating, user_id, booking_id, created_at")
        .eq("restaurant_id", restaurantId)

      // Fetch favorites
      const { data: favorites, error: favoritesError } = await supabase
        .from("favorites")
        .select("user_id, created_at")
        .eq("restaurant_id", restaurantId)

      return {
        allBookings: allBookings || [],
        periodBookings: periodBookings || [],
        reviews: reviews || [],
        favorites: favorites || [],
      }
    },
    enabled: !!restaurantId,
    refetchInterval: 60000, // Refresh every minute
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

    console.log("Unique customers found:", uniqueCustomers.size)

    // Calculate customer segments and metrics
    let newCustomers = 0
    let returningCustomers = 0
    let frequentCustomers = 0
    let atRiskCustomers = 0
    let lostCustomers = 0

    const topCustomers: any[] = []
    const now = new Date()

    uniqueCustomers.forEach((customer, userId) => {
      const bookingCount = customer.bookings.length
      const daysSinceLastBooking = differenceInDays(now, new Date(customer.bookings[0].created_at))
      
      // Customer reviews
      const customerReviews = reviews.filter((r: any) => r.user_id === userId)
      const avgRating = customerReviews.length > 0 
        ? customerReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / customerReviews.length 
        : 0

      // Determine customer segment
      let segment = "new"
      if (bookingCount >= 5) {
        segment = "frequent"
        frequentCustomers++
      } else if (bookingCount > 1) {
        if (daysSinceLastBooking > 90) {
          segment = "lost"
          lostCustomers++
        } else if (daysSinceLastBooking > 60) {
          segment = "at_risk"
          atRiskCustomers++
        } else {
          segment = "returning"
          returningCustomers++
        }
      } else {
        newCustomers++
      }

      // Add to top customers
      topCustomers.push({
        ...customer,
        totalBookings: bookingCount,
        avgRating,
        segment,
        daysSinceLastBooking,
        status: customer.isFavorite ? "Favorite" : segment.charAt(0).toUpperCase() + segment.slice(1)
      })
    })

    // Sort top customers by booking count
    topCustomers.sort((a, b) => b.totalBookings - a.totalBookings)

    const totalCustomers = uniqueCustomers.size
    const customerRetentionRate = totalCustomers > 0 ? (returningCustomers + frequentCustomers) / totalCustomers * 100 : 0
    const averageVisitFrequency = totalCustomers > 0 ? allBookings.length / totalCustomers : 0
    const customerSatisfaction = reviews.length > 0 
      ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length 
      : 0

    // Segment distribution
    const segmentDistribution = [
      { name: "New", value: newCustomers, percentage: totalCustomers > 0 ? (newCustomers / totalCustomers) * 100 : 0 },
      { name: "Returning", value: returningCustomers, percentage: totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0 },
      { name: "Frequent", value: frequentCustomers, percentage: totalCustomers > 0 ? (frequentCustomers / totalCustomers) * 100 : 0 },
      { name: "At Risk", value: atRiskCustomers, percentage: totalCustomers > 0 ? (atRiskCustomers / totalCustomers) * 100 : 0 },
      { name: "Lost", value: lostCustomers, percentage: totalCustomers > 0 ? (lostCustomers / totalCustomers) * 100 : 0 },
    ].filter(segment => segment.value > 0)

    return {
      totalCustomers,
      newCustomers,
      returningCustomers,
      frequentCustomers,
      averageLifetimeValue: 0, // Would need order data to calculate
      customerRetentionRate,
      averageVisitFrequency,
      customerSatisfaction,
      segmentDistribution,
      acquisitionTrend: [], // Would implement if needed
      visitFrequencyDistribution: [], // Would implement if needed
      topCustomers: topCustomers.slice(0, 10),
      customerLifecycle: [], // Would implement if needed
      segments: {
        new: newCustomers,
        returning: returningCustomers,
        frequent: frequentCustomers,
        at_risk: atRiskCustomers,
        lost: lostCustomers
      }
    }
  }

  const metrics = calculateMetrics()

  if (!mounted || isLoading || !restaurantId) {
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

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Failed to load customer analytics</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Customer Analytics</h2>
          <p className="text-muted-foreground text-sm">Understand your customer base and improve retention
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(value: TimeRange) => setTimeRange(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{metrics.totalCustomers}</div>
            <p className="text-xs text-muted-foreground text-sm">{metrics.newCustomers} new this period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
            <Repeat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{metrics.customerRetentionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground text-sm">{metrics.returningCustomers + metrics.frequentCustomers} returning
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Visit Frequency</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{metrics.averageVisitFrequency.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground text-sm">visits per customer
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {metrics.customerSatisfaction > 0 ? metrics.customerSatisfaction.toFixed(1) : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground text-sm">average rating
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Customer Segments */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Segments</CardTitle>
            <CardDescription>
              Distribution of customers by engagement level
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.segmentDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={metrics.segmentDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }: any) => `${name} (${percentage.toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {metrics.segmentDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-4">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No customer data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>
              Key customer performance indicators
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Retention Rate</span>
                <span className="text-sm text-muted-foreground">{metrics.customerRetentionRate.toFixed(1)}%</span>
              </div>
              <Progress value={metrics.customerRetentionRate} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Customer Satisfaction</span>
                <span className="text-sm text-muted-foreground text-sm">{metrics.customerSatisfaction > 0 ? `${metrics.customerSatisfaction.toFixed(1)}/5.0` : "N/A"}
                </span>
              </div>
              <Progress
                value={metrics.customerSatisfaction > 0 ? (metrics.customerSatisfaction / 5) * 100 : 0}
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Frequent Customers</span>
                <span className="text-sm text-muted-foreground text-sm">{metrics.totalCustomers > 0 ? ((metrics.frequentCustomers / metrics.totalCustomers) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <Progress
                value={metrics.totalCustomers > 0 ? (metrics.frequentCustomers / metrics.totalCustomers) * 100 : 0}
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Customers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Customers</CardTitle>
          <CardDescription>
            Your most valuable customers by total bookings
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
  )
}
