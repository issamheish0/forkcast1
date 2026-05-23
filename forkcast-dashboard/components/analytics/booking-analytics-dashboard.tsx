"use client"

import { useState, useEffect } from "react"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  ComposedChart
} from "recharts"
import {
  Calendar,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Star,
  Timer,
  Target,
  Activity,
  Zap
} from "lucide-react"
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, getHours } from "date-fns"
import { cn } from "@/lib/utils"

interface BookingAnalytics {
  period: {
    start: string
    end: string
    label: string
  }
  summary: {
    totalBookings: number
    confirmedBookings: number
    completedBookings: number
    cancelledBookings: number
    noShowBookings: number
    pendingBookings: number
    averagePartySize: number
    totalGuests: number
    conversionRate: number
    noShowRate: number
    completionRate: number
  }
  trends: {
    dailyBookings: Array<{ date: string; bookings: number; guests: number }>
    hourlyPattern: Array<{ hour: number; bookings: number; label: string }>
    weeklyComparison: Array<{ week: string; bookings: number; completion: number }>
    statusTrend: Array<{ date: string; confirmed: number; completed: number; cancelled: number; noShow: number }>
  }
  insights: {
    peakDay: string
    peakHour: string
    averageTurnTime: number
    popularPartySize: number
    busyPeriods: Array<{ period: string; bookings: number; percentage: number }>
    cancellationReasons: Array<{ reason: string; count: number; percentage: number }>
  }
  performance: {
    responseTime: number
    confirmationRate: number
    repeatCustomerRate: number
    advanceBookingDays: number
    tableUtilization: number
  }
  demographics: {
    partySizeDistribution: Array<{ size: number; count: number; percentage: number }>
    bookingSourceDistribution: Array<{ source: string; count: number; percentage: number }>
    timePreferences: Array<{ timeSlot: string; count: number; percentage: number }>
  }
}

const COLORS = ['#7A2E4A', '#D4C4E0', '#FFF0E6', '#10B981', '#F97316', '#F59E0B', '#8B5CF6', '#787878'] // Brand colors with complementary colors

export function BookingAnalyticsDashboard() {
  const [period, setPeriod] = useState<string>('month')
  const [selectedTab, setSelectedTab] = useState('overview')
  const [mounted, setMounted] = useState(false)

  const { currentRestaurant } = useRestaurantContext()
  const restaurantId = currentRestaurant?.restaurant.id ?? ""

  const supabase = createClient()

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true)
  }, [])

  const { data: bookingData, isLoading, error, refetch } = useQuery({
    queryKey: ['booking-analytics', restaurantId, period],
    queryFn: async (): Promise<BookingAnalytics | null> => {
      if (!restaurantId) return null

      const now = new Date()
      let start: Date, end: Date

      switch (period) {
        case 'week':
          start = startOfWeek(now)
          end = endOfWeek(now)
          break
        case 'month':
          start = new Date(now.getFullYear(), now.getMonth(), 1)
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
          break
        case 'quarter':
          const quarterStart = Math.floor(now.getMonth() / 3) * 3
          start = new Date(now.getFullYear(), quarterStart, 1)
          end = new Date(now.getFullYear(), quarterStart + 3, 0, 23, 59, 59)
          break
        case 'year':
          start = new Date(now.getFullYear(), 0, 1)
          end = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
          break
        default:
          start = new Date(now.getFullYear(), now.getMonth(), 1)
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      }

      // Get all bookings in the period
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          booking_time,
          created_at,
          party_size,
          status,
          special_requests,
          occasion,
          turn_time_minutes,
          profiles!bookings_user_id_fkey(
            id,
            full_name,
            created_at
          )
        `)
        .eq('restaurant_id', restaurantId)
        .neq('status', 'payment_pending')
        .gte('booking_time', start.toISOString())
        .lte('booking_time', end.toISOString())
        .order('booking_time', { ascending: true })

      if (bookingsError) throw bookingsError

      // Calculate summary metrics
      const totalBookings = bookings?.length || 0
      const confirmedBookings = bookings?.filter(b => b.status === 'confirmed').length || 0
      const completedBookings = bookings?.filter(b => b.status === 'completed').length || 0
      const cancelledBookings = bookings?.filter(b => ['cancelled_by_user', 'cancelled_by_restaurant'].includes(b.status)).length || 0
      const noShowBookings = bookings?.filter(b => b.status === 'no_show').length || 0
      const pendingBookings = bookings?.filter(b => b.status === 'pending').length || 0
      
      const totalGuests = bookings?.reduce((sum, b) => sum + (b.party_size || 0), 0) || 0
      const averagePartySize = totalBookings > 0 ? totalGuests / totalBookings : 0
      
      const conversionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0
      const noShowRate = totalBookings > 0 ? (noShowBookings / totalBookings) * 100 : 0
      const completionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0

      // Calculate trends and patterns
      const dailyBookings = eachDayOfInterval({ start, end }).map(date => {
        const dayBookings = bookings?.filter(b => 
          format(parseISO(b.booking_time), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
        ) || []
        
        return {
          date: format(date, 'yyyy-MM-dd'),
          bookings: dayBookings.length,
          guests: dayBookings.reduce((sum, b) => sum + (b.party_size || 0), 0)
        }
      })

      // Hourly pattern
      const hourlyPattern = Array.from({ length: 24 }, (_, hour) => {
        const hourBookings = bookings?.filter(b => 
          getHours(parseISO(b.booking_time)) === hour
        ).length || 0
        
        return {
          hour,
          bookings: hourBookings,
          label: `${hour}:00`
        }
      })

      // Find peak times
      const peakDay = dailyBookings.reduce((max, day) => 
        day.bookings > max.bookings ? day : max, dailyBookings[0] || { date: 'N/A', bookings: 0 }
      )
      
      const peakHourData = hourlyPattern.reduce((max, hour) => 
        hour.bookings > max.bookings ? hour : max, hourlyPattern[0] || { hour: 0, bookings: 0, label: 'N/A' }
      )

      // Party size distribution
      const partySizeMap = new Map<number, number>()
      bookings?.forEach(b => {
        const size = b.party_size || 1
        partySizeMap.set(size, (partySizeMap.get(size) || 0) + 1)
      })
      
      const partySizeDistribution = Array.from(partySizeMap.entries()).map(([size, count]) => ({
        size,
        count,
        percentage: totalBookings > 0 ? (count / totalBookings) * 100 : 0
      })).sort((a, b) => b.count - a.count)

      const popularPartySize = partySizeDistribution[0]?.size || 2

      // Average turn time
      const averageTurnTime = bookings?.filter(b => b.turn_time_minutes)
        .reduce((sum, b, _, arr) => sum + (b.turn_time_minutes || 0) / arr.length, 0) || 0

      return {
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
          label: period
        },
        summary: {
          totalBookings,
          confirmedBookings,
          completedBookings,
          cancelledBookings,
          noShowBookings,
          pendingBookings,
          averagePartySize,
          totalGuests,
          conversionRate,
          noShowRate,
          completionRate
        },
        trends: {
          dailyBookings,
          hourlyPattern,
          weeklyComparison: [], // Will implement if needed
          statusTrend: [] // Will implement if needed
        },
        insights: {
          peakDay: format(parseISO(peakDay.date), 'EEEE'),
          peakHour: peakHourData.label,
          averageTurnTime,
          popularPartySize,
          busyPeriods: [],
          cancellationReasons: []
        },
        performance: {
          responseTime: 0,
          confirmationRate: totalBookings > 0 ? (confirmedBookings / totalBookings) * 100 : 0,
          repeatCustomerRate: 0,
          advanceBookingDays: 0,
          tableUtilization: 0
        },
        demographics: {
          partySizeDistribution,
          bookingSourceDistribution: [],
          timePreferences: []
        }
      }
    },
    enabled: !!restaurantId,
    refetchInterval: 60000, // Refresh every minute
  })

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

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

  if (error || !bookingData) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Failed to load booking analytics</p>
        </CardContent>
      </Card>
    )
  }

  const { summary, trends, insights, performance, demographics } = bookingData

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Booking Analytics</h2>
          <p className="text-muted-foreground text-sm">Comprehensive insights into your reservation patterns and performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
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
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{summary.totalBookings}</div>
            <p className="text-xs text-muted-foreground text-sm">{summary.totalGuests} total guests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatPercentage(summary.completionRate)}</div>
            <p className="text-xs text-muted-foreground text-sm">{summary.completedBookings} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No-Show Rate</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatPercentage(summary.noShowRate)}</div>
            <p className="text-xs text-muted-foreground text-sm">{summary.noShowBookings} no-shows
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Party Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{summary.averagePartySize.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground text-sm">Most popular: {insights.popularPartySize} guests
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {/* Booking Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Booking Status Distribution</CardTitle>
                <CardDescription>
                  Breakdown of all bookings by status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Completed', value: summary.completedBookings, color: '#10B981' },
                        { name: 'Confirmed', value: summary.confirmedBookings, color: '#3B82F6' },
                        { name: 'Pending', value: summary.pendingBookings, color: '#F59E0B' },
                        { name: 'Cancelled', value: summary.cancelledBookings, color: '#EF4444' },
                        { name: 'No Show', value: summary.noShowBookings, color: '#6B7280' }
                      ].filter(item => item.value > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }:any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[
                        { name: 'Completed', value: summary.completedBookings, color: '#10B981' },
                        { name: 'Confirmed', value: summary.confirmedBookings, color: '#3B82F6' },
                        { name: 'Pending', value: summary.pendingBookings, color: '#F59E0B' },
                        { name: 'Cancelled', value: summary.cancelledBookings, color: '#EF4444' },
                        { name: 'No Show', value: summary.noShowBookings, color: '#6B7280' }
                      ].filter(item => item.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Daily Booking Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Booking Trend</CardTitle>
                <CardDescription>
                  Bookings and guests over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={trends.dailyBookings}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => format(parseISO(value), 'MMM d')}
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      labelFormatter={(value) => format(parseISO(value), 'MMM d, yyyy')}
                    />
                    <Bar yAxisId="left" dataKey="bookings" fill="#3B82F6" name="Bookings" />
                    <Line yAxisId="right" type="monotone" dataKey="guests" stroke="#10B981" strokeWidth={2} name="Guests" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          {/* Hourly Pattern */}
          <Card>
            <CardHeader>
              <CardTitle>Hourly Booking Pattern</CardTitle>
              <CardDescription>
                Peak hours: {insights.peakHour} • Busiest day: {insights.peakDay}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trends.hourlyPattern}>
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
                    stroke="#8B5CF6"
                    fill="#8B5CF6"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Party Size Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Party Size Distribution</CardTitle>
              <CardDescription>
                Understanding your guest preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={demographics.partySizeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="size" />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name) => [value, name === 'count' ? 'Bookings' : name]}
                    labelFormatter={(value) => `${value} guests`}
                  />
                  <Bar dataKey="count" fill="#06B6D4" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>
                  Key performance indicators
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Confirmation Rate</span>
                    <span className="text-sm text-muted-foreground">{formatPercentage(performance.confirmationRate)}</span>
                  </div>
                  <Progress value={performance.confirmationRate} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Completion Rate</span>
                    <span className="text-sm text-muted-foreground">{formatPercentage(summary.completionRate)}</span>
                  </div>
                  <Progress value={summary.completionRate} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">No-Show Rate</span>
                    <span className="text-sm text-muted-foreground">{formatPercentage(summary.noShowRate)}</span>
                  </div>
                  <Progress value={summary.noShowRate} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Operational Metrics</CardTitle>
                <CardDescription>
                  Service and efficiency metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Avg Turn Time</span>
                  </div>
                  <span className="text-sm text-muted-foreground text-sm">{insights.averageTurnTime.toFixed(0)} minutes
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Popular Party Size</span>
                  </div>
                  <span className="text-sm text-muted-foreground text-sm">{insights.popularPartySize} guests
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Peak Hour</span>
                  </div>
                  <span className="text-sm text-muted-foreground text-sm">{insights.peakHour}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Peak Day</span>
                  </div>
                  <span className="text-sm text-muted-foreground text-sm">{insights.peakDay}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Business Insights</CardTitle>
              <CardDescription>
                Actionable insights to improve your booking performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {summary.noShowRate > 15 && (
                  <div className="flex items-start gap-3 p-4 border border-orange-200 bg-orange-50 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-orange-800 ">High No-Show Rate</h4>
                      <p className="text-sm text-orange-700">
                        Your no-show rate is {formatPercentage(summary.noShowRate)}. Consider implementing confirmation calls or deposits to reduce no-shows.
                      </p>
                    </div>
                  </div>
                )}

                {summary.completionRate > 85 && (
                  <div className="flex items-start gap-3 p-4 border border-green-200 bg-green-50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-green-900">Excellent Completion Rate</h4>
                      <p className="text-sm text-green-700">
                        Your completion rate of {formatPercentage(summary.completionRate)} is excellent! Keep up the great service.
                      </p>
                    </div>
                  </div>
                )}

                {insights.averageTurnTime > 120 && (
                  <div className="flex items-start gap-3 p-4 border border-blue-200 bg-blue-50 rounded-lg">
                    <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-blue-900">Long Turn Times</h4>
                      <p className="text-sm text-blue-700">
                        Average turn time is {insights.averageTurnTime.toFixed(0)} minutes. Consider optimizing service flow to increase table turnover.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 p-4 border border-gray-200 bg-gray-50 rounded-lg">
                  <Target className="h-5 w-5 text-gray-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Peak Performance</h4>
                    <p className="text-sm text-gray-700">
                      Your busiest day is {insights.peakDay} at {insights.peakHour}. Ensure adequate staffing during these peak periods.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
