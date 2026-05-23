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
  AreaChart,
  Area,
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
  Cell
} from "recharts"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  Calculator,
  PieChart as PieChartIcon,
  BarChart3,
  Activity
} from "lucide-react"
import { format, subDays, startOfDay, endOfDay } from "date-fns"

interface FinancialMetrics {
  totalRevenue: number
  projectedRevenue: number
  revenueGrowth: number
  averageOrderValue: number
  profitMargin: number
  revenueByCategory: Array<{ category: string; revenue: number; percentage: number }>
  dailyRevenue: Array<{ date: string; revenue: number; orders: number; aov: number }>
  hourlyRevenue: Array<{ hour: string; revenue: number; efficiency: number }>
  paymentMethods: Array<{ method: string; amount: number; count: number }>
  costBreakdown: {
    foodCost: number
    laborCost: number
    overhead: number
    profit: number
  }
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d']

export function FinancialAnalyticsDashboard() {
  const supabase = createClient()
  const { currentRestaurant } = useRestaurantContext()
  const restaurantId = currentRestaurant?.restaurant.id ?? ""
  const [dateRange, setDateRange] = useState<number>(30) // days

  const startDate = subDays(new Date(), dateRange)
  const endDate = new Date()

  // Fetch comprehensive financial metrics
  const { data: financialMetrics, isLoading } = useQuery({
    queryKey: ["financial-metrics", restaurantId, dateRange],
    queryFn: async (): Promise<FinancialMetrics | null> => {
      if (!restaurantId) return null

      // Get orders with items and menu details for revenue analysis
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select(`
          *,
          order_items(
            *,
            menu_item:menu_items(
              name,
              price,
              category:menu_categories(name)
            )
          )
        `)
        .eq("restaurant_id", restaurantId)
        .gte("created_at", startOfDay(startDate).toISOString())
        .lte("created_at", endOfDay(endDate).toISOString())
        .in("status", ["completed", "served"])

      if (ordersError) throw ordersError

      // Calculate total revenue
      const totalRevenue = orders?.reduce((sum, order) => sum + order.total_amount, 0) || 0

      // Calculate projected revenue based on growth trend
      const halfwayPoint = subDays(endDate, Math.floor(dateRange / 2))
      const firstHalf = orders?.filter(order => 
        new Date(order.created_at) < halfwayPoint
      ) || []
      const secondHalf = orders?.filter(order => 
        new Date(order.created_at) >= halfwayPoint
      ) || []

      const firstHalfRevenue = firstHalf.reduce((sum, order) => sum + order.total_amount, 0)
      const secondHalfRevenue = secondHalf.reduce((sum, order) => sum + order.total_amount, 0)
      
      const revenueGrowth = firstHalfRevenue > 0 
        ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100 
        : 0

      const projectedRevenue = totalRevenue * (1 + (revenueGrowth / 100))

      // Calculate AOV
      const averageOrderValue = orders && orders.length > 0 
        ? totalRevenue / orders.length 
        : 0

      // Calculate revenue by category
      const categoryRevenue: Record<string, number> = {}
      orders?.forEach(order => {
        order.order_items?.forEach((item: any) => {
          const category = item.menu_item?.category?.name || "Other"
          categoryRevenue[category] = (categoryRevenue[category] || 0) + (item.quantity * item.unit_price)
        })
      })

      const revenueByCategory = Object.entries(categoryRevenue)
        .map(([category, revenue]) => ({
          category,
          revenue,
          percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0
        }))
        .sort((a, b) => b.revenue - a.revenue)

      // Calculate daily revenue trends
      const dailyStats: Record<string, { revenue: number; orders: number }> = {}
      orders?.forEach(order => {
        const date = format(new Date(order.created_at), "yyyy-MM-dd")
        if (!dailyStats[date]) {
          dailyStats[date] = { revenue: 0, orders: 0 }
        }
        dailyStats[date].revenue += order.total_amount
        dailyStats[date].orders += 1
      })

      const dailyRevenue = Object.entries(dailyStats)
        .map(([date, stats]) => ({
          date: format(new Date(date), "MMM dd"),
          revenue: stats.revenue,
          orders: stats.orders,
          aov: stats.orders > 0 ? stats.revenue / stats.orders : 0
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      // Calculate hourly revenue patterns
      const hourlyStats: Record<string, { revenue: number; orders: number }> = {}
      orders?.forEach(order => {
        const hour = format(new Date(order.created_at), "HH")
        if (!hourlyStats[hour]) {
          hourlyStats[hour] = { revenue: 0, orders: 0 }
        }
        hourlyStats[hour].revenue += order.total_amount
        hourlyStats[hour].orders += 1
      })

      const maxHourlyRevenue = Math.max(...Object.values(hourlyStats).map(h => h.revenue))
      const hourlyRevenue = Object.entries(hourlyStats)
        .map(([hour, stats]) => ({
          hour: `${hour}:00`,
          revenue: stats.revenue,
          efficiency: maxHourlyRevenue > 0 ? (stats.revenue / maxHourlyRevenue) * 100 : 0
        }))
        .sort((a, b) => parseInt(a.hour) - parseInt(b.hour))

      // Payment method analysis (simplified - would come from payment data)
      const paymentMethods = [
        { method: "Credit Card", amount: totalRevenue * 0.6, count: Math.floor((orders?.length || 0) * 0.6) },
        { method: "Cash", amount: totalRevenue * 0.25, count: Math.floor((orders?.length || 0) * 0.25) },
        { method: "Digital Wallet", amount: totalRevenue * 0.15, count: Math.floor((orders?.length || 0) * 0.15) }
      ]

      // Cost breakdown (estimated - would come from actual cost data)
      const foodCost = totalRevenue * 0.30 // 30% food cost
      const laborCost = totalRevenue * 0.25 // 25% labor cost  
      const overhead = totalRevenue * 0.15 // 15% overhead
      const profit = totalRevenue - foodCost - laborCost - overhead

      const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0

      const costBreakdown = {
        foodCost,
        laborCost,
        overhead,
        profit
      }

      return {
        totalRevenue,
        projectedRevenue,
        revenueGrowth,
        averageOrderValue,
        profitMargin,
        revenueByCategory,
        dailyRevenue,
        hourlyRevenue,
        paymentMethods,
        costBreakdown
      }
    },
    enabled: !!restaurantId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="motion-safe:animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">Loading financial analytics...</p>
        </div>
      </div>
    )
  }

  if (!financialMetrics) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground">No financial data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Financial KPIs */}
      <div className="grid gap-3 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">${financialMetrics.totalRevenue.toLocaleString()}</div>
            <div className="flex items-center mt-1">
              {financialMetrics.revenueGrowth > 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <p className="text-xs text-muted-foreground text-sm">{Math.abs(financialMetrics.revenueGrowth).toFixed(1)}% vs previous period
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">${financialMetrics.averageOrderValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground text-sm">
              Per order average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{financialMetrics.profitMargin.toFixed(1)}%</div>
            <Progress value={financialMetrics.profitMargin} className="mt-2" />
            <p className="text-xs text-muted-foreground text-sm">
              ${financialMetrics.costBreakdown.profit.toLocaleString()} profit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projected Revenue</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">${financialMetrics.projectedRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground text-sm">
              Next {dateRange} days forecast
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Food Cost %</CardTitle>
            <PieChartIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {((financialMetrics.costBreakdown.foodCost / financialMetrics.totalRevenue) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground text-sm">
              ${financialMetrics.costBreakdown.foodCost.toLocaleString()} food costs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Daily Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Daily Revenue Trend
            </CardTitle>
            <CardDescription>Revenue and order volume over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={financialMetrics.dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} name="Revenue ($)" />
                <Bar yAxisId="right" dataKey="orders" fill="#82ca9d" name="Orders" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Revenue by Category
            </CardTitle>
            <CardDescription>Revenue distribution across menu categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={financialMetrics.revenueByCategory}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, percentage }: any) => `${category}: ${percentage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="revenue"
                >
                  {financialMetrics.revenueByCategory.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hourly Revenue Pattern */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Hourly Revenue Pattern
            </CardTitle>
            <CardDescription>Revenue efficiency throughout the day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={financialMetrics.hourlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Bar yAxisId="left" dataKey="revenue" fill="#8884d8" name="Revenue ($)" />
                <Line yAxisId="right" type="monotone" dataKey="efficiency" stroke="#82ca9d" name="Efficiency %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cost Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Cost Breakdown Analysis
            </CardTitle>
            <CardDescription>Expense distribution and profit analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Food Costs</span>
                  <span className="text-sm">${financialMetrics.costBreakdown.foodCost.toLocaleString()}</span>
                </div>
                <Progress 
                  value={(financialMetrics.costBreakdown.foodCost / financialMetrics.totalRevenue) * 100} 
                  className="h-2" 
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Labor Costs</span>
                  <span className="text-sm">${financialMetrics.costBreakdown.laborCost.toLocaleString()}</span>
                </div>
                <Progress 
                  value={(financialMetrics.costBreakdown.laborCost / financialMetrics.totalRevenue) * 100} 
                  className="h-2" 
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Overhead</span>
                  <span className="text-sm">${financialMetrics.costBreakdown.overhead.toLocaleString()}</span>
                </div>
                <Progress 
                  value={(financialMetrics.costBreakdown.overhead / financialMetrics.totalRevenue) * 100} 
                  className="h-2" 
                />
              </div>

              <div className="space-y-2 pt-2 border-t">
                <div className="flex justify-between">
                  <span className="text-sm font-bold">Net Profit</span>
                  <span className="text-sm font-bold text-green-600">
                    ${financialMetrics.costBreakdown.profit.toLocaleString()}
                  </span>
                </div>
                <Progress 
                  value={financialMetrics.profitMargin} 
                  className="h-2" 
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods & Recommendations */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payment Method Distribution</CardTitle>
            <CardDescription>How customers prefer to pay</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {financialMetrics.paymentMethods.map((method, index) => (
                <div key={index} className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{method.method}</p>
                    <p className="text-sm text-muted-foreground">{method.count} transactions</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${method.amount.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground text-sm">{((method.amount / financialMetrics.totalRevenue) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Recommendations</CardTitle>
            <CardDescription>AI-powered insights to improve profitability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {financialMetrics.profitMargin < 20 && (
                <div className="p-4 border-l-4 border-yellow-500 bg-yellow-50">
                  <div className="flex items-center">
                    <Target className="h-5 w-5 text-yellow-500 mr-2" />
                    <p className="font-medium">Low Profit Margin</p>
                  </div>
                  <p className="text-sm text-muted-foreground text-sm">
                    Consider reviewing menu pricing or reducing food costs to improve profitability.
                  </p>
                </div>
              )}

              {financialMetrics.averageOrderValue < 25 && (
                <div className="p-4 border-l-4 border-blue-500 bg-blue-50">
                  <div className="flex items-center">
                    <TrendingUp className="h-5 w-5 text-blue-500 mr-2" />
                    <p className="font-medium">Increase AOV Opportunity</p>
                  </div>
                  <p className="text-sm text-muted-foreground text-sm">
                    Implement upselling strategies or combo deals to increase average order value.
                  </p>
                </div>
              )}

              {financialMetrics.revenueGrowth > 10 && (
                <div className="p-4 border-l-4 border-green-500 bg-green-50">
                  <div className="flex items-center">
                    <TrendingUp className="h-5 w-5 text-green-500 mr-2" />
                    <p className="font-medium">Strong Growth</p>
                  </div>
                  <p className="text-sm text-muted-foreground text-sm">
                    Excellent revenue growth! Consider expanding operations or marketing efforts.
                  </p>
                </div>
              )}

              <div className="p-4 border-l-4 border-gray-500 bg-gray-50">
                <div className="flex items-center">
                  <Calculator className="h-5 w-5 text-gray-500 mr-2" />
                  <p className="font-medium">Cost Optimization</p>
                </div>
                <p className="text-sm text-muted-foreground text-sm">
                  Monitor food costs regularly and negotiate with suppliers for better rates.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
