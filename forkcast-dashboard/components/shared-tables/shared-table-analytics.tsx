// components/shared-tables/shared-table-analytics.tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSharedTableStats } from "@/hooks/use-shared-tables"
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
  Cell
} from "recharts"
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  Clock,
  Calendar,
  Target
} from "lucide-react"

interface SharedTableAnalyticsProps {
  restaurantId: string
}

export function SharedTableAnalytics({ restaurantId }: SharedTableAnalyticsProps) {
  const [timeRange, setTimeRange] = useState("7")

  const { data: stats, isLoading } = useSharedTableStats(restaurantId, parseInt(timeRange))

  // Mock data for charts - in real implementation, this would come from the API
  const occupancyData = [
    { time: "9:00", occupancy: 20 },
    { time: "10:00", occupancy: 35 },
    { time: "11:00", occupancy: 45 },
    { time: "12:00", occupancy: 80 },
    { time: "13:00", occupancy: 95 },
    { time: "14:00", occupancy: 70 },
    { time: "15:00", occupancy: 40 },
    { time: "16:00", occupancy: 30 },
    { time: "17:00", occupancy: 60 },
    { time: "18:00", occupancy: 85 },
    { time: "19:00", occupancy: 100 },
    { time: "20:00", occupancy: 90 },
    { time: "21:00", occupancy: 60 },
    { time: "22:00", occupancy: 30 }
  ]

  const partySizeData = [
    { size: "1", count: 15, percentage: 25 },
    { size: "2", count: 25, percentage: 42 },
    { size: "3-4", count: 12, percentage: 20 },
    { size: "5+", count: 8, percentage: 13 }
  ]

  const revenueData = [
    { day: "Mon", revenue: 450 },
    { day: "Tue", revenue: 520 },
    { day: "Wed", revenue: 480 },
    { day: "Thu", revenue: 680 },
    { day: "Fri", revenue: 850 },
    { day: "Sat", revenue: 920 },
    { day: "Sun", revenue: 720 }
  ]

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 bg-muted motion-safe:animate-pulse rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Analytics Overview</h3>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats?.total_bookings || 0}</div>
            <p className="text-xs text-muted-foreground text-sm">Last {timeRange} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Party Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {stats?.average_party_size?.toFixed(1) || "0.0"}
            </div>
            <p className="text-xs text-muted-foreground text-sm">People per booking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Occupancy</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {stats?.occupancy_rate?.toFixed(0) || 0}%
            </div>
            <p className="text-xs text-muted-foreground text-sm">Table utilization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Hour</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {stats?.peak_hours ? Object.keys(stats.peak_hours)[0] || "7:00 PM" : "7:00 PM"}
            </div>
            <p className="text-xs text-muted-foreground text-sm">Busiest time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="occupancy" className="space-y-4">
        <TabsList>
          <TabsTrigger value="occupancy">Occupancy Trends</TabsTrigger>
          <TabsTrigger value="party-size">Party Size Distribution</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="occupancy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Occupancy Pattern</CardTitle>
              <CardDescription>
                Average occupancy rate throughout the day
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={occupancyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [`${value}%`, 'Occupancy']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="occupancy" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="party-size" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Party Size Distribution</CardTitle>
                <CardDescription>
                  Breakdown of booking sizes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={partySizeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ size, percentage }: any) => `${size} (${percentage}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {partySizeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Party Size Trends</CardTitle>
                <CardDescription>
                  Booking count by party size
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={partySizeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="size" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Revenue</CardTitle>
              <CardDescription>
                Revenue generated from shared table bookings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [`$${value}`, 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
