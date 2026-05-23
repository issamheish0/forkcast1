"use client"

import { useState } from "react"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  AreaChart,
  PieChart,
  Pie,
  Cell
} from "recharts"
import {
  Clock,
  Table2,
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  CheckCircle,
  Target,
  BarChart3,
  ChefHat
} from "lucide-react"
import { format, subDays, startOfDay, endOfDay } from "date-fns"

interface OperationalMetrics {
  tableUtilization: number
  averageWaitTime: number
  turnoverRate: number
  capacityUtilization: number
  peakHours: Array<{ hour: string; bookings: number; utilization: number }>
  dailyTrends: Array<{ date: string; bookings: number; revenue: number; utilization: number }>
  kitchenEfficiency: {
    averageOrderTime: number
    orderAccuracy: number
    peakOrderHour: string
    orderVolume: number
  }
  customerFlow: {
    averageServiceTime: number
    waitTimeDistribution: Array<{ range: string; count: number }>
    serviceEfficiency: number
  }
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export function OperationalAnalyticsDashboard() {
  const supabase = createClient()
  const { currentRestaurant } = useRestaurantContext()
  const restaurantId = currentRestaurant?.restaurant.id ?? ""
  const [dateRange, setDateRange] = useState<number>(7) // days

  const startDate = subDays(new Date(), dateRange)
  const endDate = new Date()

  // Fetch comprehensive operational metrics
  const { data: operationalMetrics, isLoading, error } = useQuery({
    queryKey: ["operational-metrics", restaurantId, dateRange],
    queryFn: async (): Promise<OperationalMetrics | null> => {
      if (!restaurantId) {
        return null
      }

      try {
        // Get restaurant tables for capacity calculations
        const { data: tables, error: tablesError } = await supabase
          .from("restaurant_tables")
          .select("id, capacity, is_active")
          .eq("restaurant_id", restaurantId)
          .eq("is_active", true)

        if (tablesError) {
          throw tablesError
        }

        const totalCapacity = tables?.reduce((sum, table) => sum + table.capacity, 0) || 0
        const activeTableCount = tables?.length || 0

        // Get basic booking data without complex joins
        const { data: bookings, error: bookingsError } = await supabase
          .from("bookings")
          .select("id, party_size, status, booking_time, seated_at, actual_end_time")
          .eq("restaurant_id", restaurantId)
          .gte("booking_time", startOfDay(startDate).toISOString())
          .lte("booking_time", endOfDay(endDate).toISOString())

        if (bookingsError) {
          throw bookingsError
        }

        // Calculate table utilization using simple party sizes
        const totalSeatsUsed = bookings?.reduce((sum, booking) => {
          return sum + (booking.party_size || 0)
        }, 0) || 0

        const hoursInPeriod = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60))
        const maxPossibleSeats = totalCapacity * hoursInPeriod
        const tableUtilization = maxPossibleSeats > 0 ? (totalSeatsUsed / maxPossibleSeats) * 100 : 0

        // Calculate average wait time (booking to seating)
        const seatedBookings = bookings?.filter(b => b.seated_at) || []
        const averageWaitTime = seatedBookings.length > 0 
          ? seatedBookings.reduce((sum, booking) => {
              const waitTime = new Date(booking.seated_at!).getTime() - new Date(booking.booking_time).getTime()
              return sum + (waitTime / (1000 * 60)) // minutes
            }, 0) / seatedBookings.length
          : 0

        // Calculate turnover rate
        const turnoverRate = activeTableCount > 0 ? (bookings?.length || 0) / (activeTableCount * (hoursInPeriod / 24)) : 0

        // Calculate capacity utilization
        const capacityUtilization = totalCapacity > 0 ? (totalSeatsUsed / (totalCapacity * Math.ceil(hoursInPeriod))) * 100 : 0

        // Calculate peak hours with utilization
        const hourlyStats: Record<string, { bookings: number; utilization: number }> = {}
        bookings?.forEach(booking => {
          const hour = format(new Date(booking.booking_time), "HH")
          if (!hourlyStats[hour]) {
            hourlyStats[hour] = { bookings: 0, utilization: 0 }
          }
          hourlyStats[hour].bookings++
          const seats = booking.party_size || 0
          hourlyStats[hour].utilization += (seats / totalCapacity) * 100
        })

        const peakHours = Object.entries(hourlyStats)
          .map(([hour, stats]) => ({
            hour: `${hour}:00`,
            bookings: stats.bookings,
            utilization: Math.round(stats.utilization / Math.max(1, stats.bookings))
          }))
          .sort((a, b) => parseInt(a.hour) - parseInt(b.hour))

        // Calculate daily trends
        const dailyStats: Record<string, { bookings: number; revenue: number; utilization: number }> = {}
        bookings?.forEach(booking => {
          const date = format(new Date(booking.booking_time), "yyyy-MM-dd")
          if (!dailyStats[date]) {
            dailyStats[date] = { bookings: 0, revenue: 0, utilization: 0 }
          }
          dailyStats[date].bookings++
          dailyStats[date].revenue += (booking.party_size || 0) * 50 // Estimated revenue
          const seats = booking.party_size || 0
          dailyStats[date].utilization += (seats / totalCapacity) * 100
        })

      const dailyTrends = Object.entries(dailyStats)
        .map(([date, stats]) => ({
          date: format(new Date(date), "MMM dd"),
          bookings: stats.bookings,
          revenue: stats.revenue,
          utilization: Math.round(stats.utilization / Math.max(1, stats.bookings))
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      // Get kitchen/order data for kitchen efficiency
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("created_at, confirmed_at, ready_at, served_at, status")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", startOfDay(startDate).toISOString())
        .lte("created_at", endOfDay(endDate).toISOString())

      if (ordersError) throw ordersError

      // Calculate kitchen efficiency
      const completedOrders = orders?.filter(o => o.ready_at && o.created_at) || []
      const averageOrderTime = completedOrders.length > 0
        ? completedOrders.reduce((sum, order) => {
            const prepTime = new Date(order.ready_at!).getTime() - new Date(order.created_at).getTime()
            return sum + (prepTime / (1000 * 60)) // minutes
          }, 0) / completedOrders.length
        : 0

      const orderAccuracy = orders?.length ? 
        ((orders.filter(o => o.status === "completed").length / orders.length) * 100) : 0

      // Find peak order hour
      const orderHourCounts: Record<string, number> = {}
      orders?.forEach(order => {
        const hour = format(new Date(order.created_at), "HH")
        orderHourCounts[hour] = (orderHourCounts[hour] || 0) + 1
      })
      const peakOrderHour = Object.entries(orderHourCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || "N/A"

        // Calculate customer flow metrics
        const serviceCompletedBookings = bookings?.filter(b => b.seated_at && b.actual_end_time) || []
        const averageServiceTime = serviceCompletedBookings.length > 0
          ? serviceCompletedBookings.reduce((sum, booking) => {
              const serviceTime = new Date(booking.actual_end_time!).getTime() - new Date(booking.seated_at!).getTime()
              return sum + (serviceTime / (1000 * 60)) // minutes
            }, 0) / serviceCompletedBookings.length
          : 0

        // Wait time distribution
        const waitTimes = seatedBookings.map(booking => {
          const waitTime = new Date(booking.seated_at!).getTime() - new Date(booking.booking_time).getTime()
          return waitTime / (1000 * 60) // minutes
        })

        const waitTimeDistribution = [
          { range: "0-5 min", count: waitTimes.filter(t => t <= 5).length },
          { range: "5-10 min", count: waitTimes.filter(t => t > 5 && t <= 10).length },
          { range: "10-15 min", count: waitTimes.filter(t => t > 10 && t <= 15).length },
          { range: "15+ min", count: waitTimes.filter(t => t > 15).length },
        ]

        const serviceEfficiency = waitTimes.length > 0 ? 
          (waitTimes.filter(t => t <= 10).length / waitTimes.length) * 100 : 0

        return {
          tableUtilization: Math.round(tableUtilization * 10) / 10,
          averageWaitTime: Math.round(averageWaitTime),
          turnoverRate: Math.round(turnoverRate * 100) / 100,
          capacityUtilization: Math.round(capacityUtilization * 10) / 10,
          peakHours,
          dailyTrends,
          kitchenEfficiency: {
            averageOrderTime: Math.round(averageOrderTime),
            orderAccuracy: Math.round(orderAccuracy * 10) / 10,
            peakOrderHour: `${peakOrderHour}:00`,
            orderVolume: orders?.length || 0
          },
          customerFlow: {
            averageServiceTime: Math.round(averageServiceTime),
            waitTimeDistribution,
            serviceEfficiency: Math.round(serviceEfficiency * 10) / 10
          }
        }
      } catch (error) {

        throw error
      }
    },
    enabled: !!restaurantId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="motion-safe:animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">Loading operational analytics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-red-500">Error loading operational data</p>
      </div>
    )
  }

  if (!operationalMetrics) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground">No operational data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Key Performance Indicators */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Table Utilization</CardTitle>
            <Table2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{operationalMetrics.tableUtilization}%</div>
            <Progress value={operationalMetrics.tableUtilization} className="mt-2" />
            <p className="text-xs text-muted-foreground text-sm">
              {operationalMetrics.tableUtilization > 80 ? "High utilization" : 
               operationalMetrics.tableUtilization > 60 ? "Good utilization" : "Low utilization"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Wait Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{operationalMetrics.averageWaitTime}min</div>
            <div className="flex items-center mt-2">
              {operationalMetrics.averageWaitTime <= 10 ? (
                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-500 mr-1" />
              )}
              <p className="text-xs text-muted-foreground text-sm">{operationalMetrics.averageWaitTime <= 10 ? "Excellent" : "Needs improvement"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Turnover Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{operationalMetrics.turnoverRate}</div>
            <p className="text-xs text-muted-foreground text-sm">
              Tables/day average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Service Efficiency</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{operationalMetrics.customerFlow.serviceEfficiency}%</div>
            <Progress value={operationalMetrics.customerFlow.serviceEfficiency} className="mt-2" />
            <p className="text-xs text-muted-foreground text-sm">
              Guests served within 10min
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Peak Hours Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Hourly Performance
            </CardTitle>
            <CardDescription>Booking volume and table utilization by hour</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={operationalMetrics.peakHours}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Bar yAxisId="left" dataKey="bookings" fill="#8884d8" name="Bookings" />
                <Bar yAxisId="right" dataKey="utilization" fill="#82ca9d" name="Utilization %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Daily Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Daily Trends
            </CardTitle>
            <CardDescription>Bookings and utilization over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={operationalMetrics.dailyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Line yAxisId="left" type="monotone" dataKey="bookings" stroke="#8884d8" name="Bookings" />
                <Line yAxisId="right" type="monotone" dataKey="utilization" stroke="#82ca9d" name="Utilization %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Kitchen Efficiency */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5" />
              Kitchen Performance
            </CardTitle>
            <CardDescription>Order processing and kitchen efficiency metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Average Order Time:</span>
                <span className="text-lg font-bold">{operationalMetrics.kitchenEfficiency.averageOrderTime}min</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Order Accuracy:</span>
                <span className="text-lg font-bold">{operationalMetrics.kitchenEfficiency.orderAccuracy}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Peak Order Hour:</span>
                <span className="text-lg font-bold">{operationalMetrics.kitchenEfficiency.peakOrderHour}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Orders:</span>
                <span className="text-lg font-bold">{operationalMetrics.kitchenEfficiency.orderVolume}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wait Time Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Wait Time Distribution
            </CardTitle>
            <CardDescription>Customer waiting time breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={operationalMetrics.customerFlow.waitTimeDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ range, percent }: any) => `${range}: ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {operationalMetrics.customerFlow.waitTimeDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Operational Recommendations
          </CardTitle>
          <CardDescription>AI-powered insights to improve restaurant operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {operationalMetrics.tableUtilization < 60 && (
              <div className="p-4 border-l-4 border-yellow-500 bg-yellow-50">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                  <p className="font-medium">Low Table Utilization</p>
                </div>
                <p className="text-sm text-muted-foreground text-sm">
                  Consider promotional campaigns or flexible seating arrangements to increase bookings.
                </p>
              </div>
            )}
            
            {operationalMetrics.averageWaitTime > 15 && (
              <div className="p-4 border-l-4 border-red-500 bg-red-50">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                  <p className="font-medium">High Wait Times</p>
                </div>
                <p className="text-sm text-muted-foreground text-sm">
                  Focus on reducing wait times through better table management and service optimization.
                </p>
              </div>
            )}

            {operationalMetrics.kitchenEfficiency.averageOrderTime > 25 && (
              <div className="p-4 border-l-4 border-orange-500 bg-orange-50">
                <div className="flex items-center">
                  <ChefHat className="h-5 w-5 text-orange-500 mr-2" />
                  <p className="font-medium">Kitchen Efficiency</p>
                </div>
                <p className="text-sm text-muted-foreground text-sm">
                  Kitchen order processing could be optimized. Consider staff training or workflow improvements.
                </p>
              </div>
            )}

            {operationalMetrics.customerFlow.serviceEfficiency > 85 && (
              <div className="p-4 border-l-4 border-green-500 bg-green-50">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <p className="font-medium">Excellent Service</p>
                </div>
                <p className="text-sm text-muted-foreground text-sm">
                  Great job! Your service efficiency is excellent. Maintain current standards.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
