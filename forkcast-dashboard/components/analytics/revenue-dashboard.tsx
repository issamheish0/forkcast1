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
  AreaChart
} from "recharts"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Clock,
  Users,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface RevenueData {
  period: {
    start: string
    end: string
    label: string
  }
  summary: {
    totalRevenue: number
    totalSubtotal: number
    totalTax: number
    totalOrders: number
    averageOrderValue: number
    revenueGrowth: number
  }
  breakdown: {
    byType: Record<string, number>
    byCourse: Record<string, number>
    daily: Record<string, number>
    hourly: Record<number, number>
  }
  topMenuItems: Array<{
    name: string
    category: string
    revenue: number
    quantity: number
  }>
  trends: {
    dailyTrend: Array<{ date: string; revenue: number }>
    hourlyPattern: Array<{ hour: number; revenue: number }>
  }
}

const COLORS = ['#7A2E4A', '#D4C4E0', '#FFF0E6', '#10B981', '#F97316', '#F59E0B'] // Brand colors with complementary colors

export function RevenueDashboard() {
  const [period, setPeriod] = useState<string>('week')
  const [selectedTab, setSelectedTab] = useState('overview')
  const [mounted, setMounted] = useState(false)

  const { currentRestaurant } = useRestaurantContext()
  const restaurantId = currentRestaurant?.restaurant.id ?? ""

  const supabase = createClient()

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true)
  }, [])

  const { data: revenueData, isLoading, error, refetch } = useQuery({
    queryKey: ['revenue-analytics', restaurantId, period],
    queryFn: async (): Promise<RevenueData | null> => {
      if (!restaurantId) return null

      const now = new Date()
      let start: Date, end: Date

      switch (period) {
        case 'day':
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
          break
        case 'week':
          const startOfWeek = now.getDate() - now.getDay()
          start = new Date(now.getFullYear(), now.getMonth(), startOfWeek)
          end = new Date(now.getFullYear(), now.getMonth(), startOfWeek + 6, 23, 59, 59)
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
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
          end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      }

      // Get actual revenue from completed orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          subtotal,
          tax_amount,
          order_type,
          course_type,
          created_at,
          completed_at,
          status,
          booking:bookings!orders_booking_id_fkey(
            id,
            party_size,
            booking_time,
            status
          ),
          order_items(
            id,
            quantity,
            unit_price,
            total_price,
            menu_item:menu_items!order_items_menu_item_id_fkey(
              id,
              name,
              price,
              category:menu_categories!menu_items_category_id_fkey(
                id,
                name
              )
            )
          )
        `)
        .eq('restaurant_id', restaurantId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .in('status', ['completed', 'served'])
        .limit(1000)
        .order('created_at', { ascending: false })

      if (ordersError) throw ordersError

      // Calculate revenue metrics (excluding tax)
      const totalSubtotal = orders?.reduce((sum, order) => sum + (order.subtotal || 0), 0) || 0
      const totalTax = orders?.reduce((sum, order) => sum + (order.tax_amount || 0), 0) || 0
      const totalRevenue = totalSubtotal // Revenue should exclude tax
      const totalOrders = orders?.length || 0
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

      // Revenue by order type (excluding tax)
      const revenueByType = orders?.reduce((acc, order) => {
        const type = order.order_type || 'dine_in'
        acc[type] = (acc[type] || 0) + (order.subtotal || 0)
        return acc
      }, {} as Record<string, number>) || {}

      // Revenue by course type (excluding tax)
      const revenueByCourse = orders?.reduce((acc, order) => {
        const course = order.course_type || 'all_courses'
        acc[course] = (acc[course] || 0) + (order.subtotal || 0)
        return acc
      }, {} as Record<string, number>) || {}

      // Daily revenue trend (excluding tax)
      const dailyRevenue = orders?.reduce((acc, order) => {
        const date = order.created_at.split('T')[0]
        acc[date] = (acc[date] || 0) + (order.subtotal || 0)
        return acc
      }, {} as Record<string, number>) || {}

      // Hourly revenue pattern (excluding tax)
      const hourlyRevenue = orders?.reduce((acc, order) => {
        const hour = new Date(order.created_at).getHours()
        acc[hour] = (acc[hour] || 0) + (order.subtotal || 0)
        return acc
      }, {} as Record<number, number>) || {}

      // Top menu items by revenue
      const menuItemRevenue = new Map<string, { name: string, category: string, revenue: number, quantity: number }>()

      orders?.forEach((order:any) => {
        order.order_items?.forEach((item: { menu_item: { id: any; name: any; category: { name: any } }; total_price: any; quantity: any }) => {
          const key = item.menu_item.id
          const existing = menuItemRevenue.get(key) || {
            name: item.menu_item.name,
            category: item.menu_item.category?.name || 'Unknown',
            revenue: 0,
            quantity: 0
          }
          existing.revenue += item.total_price || 0
          existing.quantity += item.quantity || 0
          menuItemRevenue.set(key, existing)
        })
      })

      const topMenuItems = Array.from(menuItemRevenue.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)

      // Calculate previous period for comparison (combined query for better performance)
      const periodLength = end.getTime() - start.getTime()
      const prevStart = new Date(start.getTime() - periodLength)
      const prevEnd = new Date(end.getTime() - periodLength)

      // Fetch both current and previous period in one query, then filter client-side
      const { data: allOrders } = await supabase
        .from('orders')
        .select('subtotal, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', prevStart.toISOString())
        .lte('created_at', end.toISOString())
        .in('status', ['completed', 'served'])
        .limit(2000)

      // Separate current and previous period orders
      const prevOrders = allOrders?.filter(order => 
        new Date(order.created_at) >= prevStart && new Date(order.created_at) < start
      ) || []

      const prevRevenue = prevOrders.reduce((sum, order) => sum + (order.subtotal || 0), 0)
      const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0

      return {
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
          label: period
        },
        summary: {
          totalRevenue,
          totalSubtotal,
          totalTax,
          totalOrders,
          averageOrderValue,
          revenueGrowth
        },
        breakdown: {
          byType: revenueByType,
          byCourse: revenueByCourse,
          daily: dailyRevenue,
          hourly: hourlyRevenue
        },
        topMenuItems,
        trends: {
          dailyTrend: Object.entries(dailyRevenue).map(([date, revenue]) => ({
            date,
            revenue
          })),
          hourlyPattern: Array.from({ length: 24 }, (_, hour) => ({
            hour,
            revenue: hourlyRevenue[hour] || 0
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

  if (error || !revenueData) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Failed to load revenue data</p>
        </CardContent>
      </Card>
    )
  }

  const { summary, breakdown, topMenuItems, trends } = revenueData

  // Prepare chart data
  const orderTypeData = Object.entries(breakdown.byType).map(([type, revenue]) => ({
    name: type.replace('_', ' ').toUpperCase(),
    value: revenue,
    percentage: ((revenue / summary.totalRevenue) * 100).toFixed(1)
  }))

  const courseTypeData = Object.entries(breakdown.byCourse).map(([course, revenue]) => ({
    name: course.replace('_', ' ').toUpperCase(),
    value: revenue,
    percentage: ((revenue / summary.totalRevenue) * 100).toFixed(1)
  }))

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Revenue Analytics</h2>
          <p className="text-muted-foreground text-sm">{format(new Date(revenueData.period.start), 'MMM d')} - {format(new Date(revenueData.period.end), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Today</SelectItem>
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
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
            <div className="flex items-center text-xs text-muted-foreground text-sm">{summary.revenueGrowth >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={cn(
                summary.revenueGrowth >= 0 ? "text-green-500" : "text-red-500"
              )}>
                {formatPercentage(summary.revenueGrowth)}
              </span>
              <span className="ml-1">from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{summary.totalOrders}</div>
            <p className="text-xs text-muted-foreground text-sm">Orders completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(summary.averageOrderValue)}</div>
            <p className="text-xs text-muted-foreground text-sm">Per order average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tax Collected</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(summary.totalTax)}</div>
            <p className="text-xs text-muted-foreground text-sm">{((summary.totalTax / summary.totalSubtotal) * 100).toFixed(1)}% tax rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="menu">Menu Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trends.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(new Date(value), 'MMM d')}
                    />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip 
                      formatter={(value) => [formatCurrency(value as number), 'Revenue']}
                      labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#3B82F6" 
                      fill="#3B82F6" 
                      fillOpacity={0.1}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by Order Type</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={orderTypeData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percentage }: any) => `${name} (${percentage}%)`}
                    >
                      {orderTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Hourly Revenue Pattern</CardTitle>
              <CardDescription>Revenue distribution throughout the day</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={trends.hourlyPattern}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="hour" 
                    tickFormatter={(value) => `${value}:00`}
                  />
                  <YAxis tickFormatter={(value) => `$${value}`} />
                  <Tooltip 
                    formatter={(value) => [formatCurrency(value as number), 'Revenue']}
                    labelFormatter={(value) => `${value}:00 - ${value + 1}:00`}
                  />
                  <Bar dataKey="revenue" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Course Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {courseTypeData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">{formatCurrency(item.value)}</div>
                        <div className="text-xs text-muted-foreground">{item.percentage}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order Type Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {orderTypeData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">{formatCurrency(item.value)}</div>
                        <div className="text-xs text-muted-foreground">{item.percentage}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="menu" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Menu Items</CardTitle>
              <CardDescription>Highest revenue generating items</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topMenuItems.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-muted-foreground">{item.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatCurrency(item.revenue)}</div>
                      <div className="text-sm text-muted-foreground">{item.quantity} sold</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
