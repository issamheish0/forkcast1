// app/(dashboard)/bookings/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format, startOfDay, endOfDay, addMinutes, differenceInMinutes, addDays } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BookingList } from "@/components/bookings/booking-list"
import { BookingDetails } from "@/components/bookings/booking-details"
import { ManualBookingForm } from "@/components/bookings/manual-booking-form"
import { TableAvailabilityService } from "@/lib/table-availability"
import { TableStatusService, type DiningStatus } from "@/lib/table-status"
import { toast } from "react-hot-toast"
import { 
  Search, 
  Calendar as CalendarIcon, 
  Download, 
  Plus,
  Table2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  ChefHat,
  UserCheck,
  Utensils,
  CreditCard,
  Activity,
  Users
} from "lucide-react"
import type { Booking } from "@/types"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { cn, titleCase } from "@/lib/utils"

// Enhanced statistics card component with dining status support
function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon,
  trend,
  variant = "default"
}: { 
  title: string
  value: string | number
  description?: string
  icon: any
  trend?: { value: number; isPositive: boolean }
  variant?: "default" | "warning" | "success" | "info"
}) {
  const variantStyles = {
    default: "",
    warning: "border-yellow-200 bg-yellow-50",
    success: "border-green-200 bg-green-50",
    info: "border-blue-200 bg-blue-50"
  }

  return (
    <Card className={cn(variantStyles[variant])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {trend && (
          <div className="flex items-center mt-2">
            {trend.isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
            )}
            <span className={`text-xs ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.value}% from last week
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Dining status filter component
function DiningStatusFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const diningStatuses = [
    { value: 'all', label: 'All Statuses', icon: Activity },
    { value: 'pending', label: 'Pending', icon: Clock },
    { value: 'confirmed', label: 'Confirmed', icon: UserCheck },
    { value: 'dining', label: 'Currently Dining', icon: Utensils },
    { value: 'completed', label: 'Completed', icon: Activity },
  ]

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Filter by status" />
      </SelectTrigger>
      <SelectContent>
        {diningStatuses.map(status => {
          const Icon = status.icon
          return (
            <SelectItem key={status.value} value={status.value}>
              <div className="flex items-center gap-2">
                <Icon className="h-3 w-3" />
                {status.label}
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

export default function BookingsPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"list" | "calendar" | "table-view">("list")
  const [showManualBooking, setShowManualBooking] = useState(false)
  const [timeFilter, setTimeFilter] = useState<string>("all")
  const [restaurantId, setRestaurantId] = useState<string>("")
  const [userId, setUserId] = useState<string>("")
  const [dateRange, setDateRange] = useState<"today" | "tomorrow" | "week">("today")
  
  const supabase = createClient()
  const queryClient = useQueryClient()
  const tableService = new TableAvailabilityService()
  const statusService = new TableStatusService()

  // Get restaurant and user ID
  useEffect(() => {
    async function getIds() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: staffData } = await supabase
          .from("restaurant_staff")
          .select("restaurant_id")
          .eq("user_id", user.id)
          .single()
        
        if (staffData) {
          setRestaurantId(staffData.restaurant_id)
        }
      }
    }
    getIds()
  }, [supabase])

  // Enhanced bookings query with dining status support
  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings", restaurantId, selectedDate, statusFilter, timeFilter, dateRange],
    queryFn: async () => {
      if (!restaurantId) return []
      
      let query = supabase
        .from("bookings")
        .select(`
          *,
          profiles!bookings_user_id_fkey(
            id,
            full_name,
            phone_number,
            email
          ),
          booking_tables(
            table:restaurant_tables(*)
          ),
          booking_status_history(
            new_status,
            old_status,
            changed_at,
            changed_by
          )
        `)
        .eq("restaurant_id", restaurantId)
        .neq("status", "payment_pending")
        .order("booking_time", { ascending: true })

      // Date filter logic
      let startDate: Date, endDate: Date
      
      switch (dateRange) {
        case "tomorrow":
          startDate = startOfDay(addDays(new Date(), 1))
          endDate = endOfDay(addDays(new Date(), 1))
          break
        case "week":
          startDate = startOfDay(new Date())
          endDate = endOfDay(addDays(new Date(), 7))
          break
        default: // today
          startDate = viewMode === "calendar" && selectedDate 
            ? startOfDay(selectedDate) 
            : startOfDay(new Date())
          endDate = viewMode === "calendar" && selectedDate
            ? endOfDay(selectedDate)
            : endOfDay(new Date())
      }
      
      query = query
        .gte("booking_time", startDate.toISOString())
        .lte("booking_time", endDate.toISOString())

      // Enhanced status filter
      if (statusFilter === "dining") {
        query = query.in("status", ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'])
      } else if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error fetching bookings:", error)
        throw error
      }

      // Transform data
      let transformedData = data?.map((booking: any) => ({
        ...booking,
        user: booking.profiles || null,
        tables: booking.booking_tables?.map((bt: { table: any }) => bt.table) || []
      })) as Booking[]

      // Apply time filter
      if (timeFilter !== "all" && transformedData) {
        transformedData = transformedData.filter(booking => {
          const hour = new Date(booking.booking_time).getHours()
          if (timeFilter === "lunch") return hour >= 11 && hour < 15
          if (timeFilter === "dinner") return hour >= 17 && hour < 23
          return true
        })
      }

      return transformedData
    },
    enabled: !!restaurantId,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Fetch all tables for table view with section information
  const { data: tables } = useQuery({
    queryKey: ["restaurant-tables-with-sections", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select(`
          *,
          section:restaurant_sections(*)
        `)
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("table_number")

      if (error) throw error
      return data || []
    },
    enabled: !!restaurantId && viewMode === "table-view",
  })

  // Enhanced table utilization stats
  const { data: tableStats } = useQuery({
    queryKey: ["table-stats", restaurantId, selectedDate],
    queryFn: async () => {
      if (!restaurantId) return null

      const dayStart = startOfDay(selectedDate)
      const dayEnd = endOfDay(selectedDate)

      // Get total tables
      const { data: tables } = await supabase
        .from("restaurant_tables")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)

      // Get current dining count
      const { data: currentDining } = await supabase
        .from("bookings")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .in("status", ['seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'])

      // Get occupied table slots for the day
      const { data: occupiedSlots } = await supabase
        .from("bookings")
        .select(`
          booking_time,
          turn_time_minutes,
          booking_tables(table_id)
        `)
        .eq("restaurant_id", restaurantId)
        .gte("booking_time", dayStart.toISOString())
        .lte("booking_time", dayEnd.toISOString())
        .not("status", "in", "(cancelled_by_user,cancelled_by_restaurant,declined_by_restaurant)")

      // Calculate utilization
      const totalTables = tables?.length || 0
      const totalSlots = totalTables * 12 // Assuming 12 hours of operation
      const occupiedCount = occupiedSlots?.reduce((acc, booking) => {
        const slots = Math.ceil((booking.turn_time_minutes || 120) / 60)
        return acc + (booking.booking_tables?.length || 0) * slots
      }, 0) || 0

      const utilization = totalSlots > 0 ? Math.round((occupiedCount / totalSlots) * 100) : 0

      return {
        totalTables,
        utilization,
        currentlyDining: currentDining?.length || 0,
        peakHour: getPeakHour(occupiedSlots || [])
      }
    },
    enabled: !!restaurantId
  })

  // Update booking status with new status service
  const updateBookingMutation = useMutation({
    mutationFn: async ({ bookingId, updates }: { bookingId: string; updates: Partial<Booking> }) => {
      if (updates.status) {
        // Use the new status service for status updates
        await statusService.updateBookingStatus(
          bookingId,
          updates.status as DiningStatus,
          userId,
          { source: 'bookings_page' }
        )
      } else {
        // Regular update for other fields
        const { error } = await supabase
          .from("bookings")
          .update({ 
            ...updates,
            updated_at: new Date().toISOString() 
          })
          .eq("id", bookingId)

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      toast.success("Booking updated")
    },
    onError: (error) => {
      console.error("Update error:", error)
      toast.error("Failed to update booking")
    },
  })

  // Create manual booking with enhanced status support
  const createManualBookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Must be logged in to create bookings")
      
      // Validate table availability
      if (bookingData.table_ids && bookingData.table_ids.length > 0) {
        const availability = await tableService.checkTableAvailability(
          restaurantId,
          bookingData.table_ids,
          new Date(bookingData.booking_time),
          bookingData.turn_time_minutes || 120
        )

        if (!availability.available) {
          throw new Error("Selected tables are no longer available")
        }
      }

      // Generate confirmation code
      const confirmationCode = `${restaurantId.slice(0, 4).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`

      // Create booking
      const { data: booking, error } = await supabase
        .from("bookings")
        .insert({
          restaurant_id: restaurantId,
          user_id: bookingData.user_id || user.id,
          customer_id: bookingData.customer_id || null,
          guest_name: bookingData.guest_name,
          guest_email: bookingData.guest_email,
          guest_phone: bookingData.guest_phone,
          booking_time: bookingData.booking_time,
          party_size: bookingData.party_size,
          turn_time_minutes: bookingData.turn_time_minutes || 120,
          status: bookingData.status || "confirmed",
          special_requests: bookingData.special_requests,
          occasion: bookingData.occasion,
          confirmation_code: confirmationCode,
          source:'manual',
          is_shared_booking: bookingData.is_shared_booking || false,
        })
        .select()
        .single()

      if (error) throw error

      // Assign tables if provided
      if (bookingData.table_ids && bookingData.table_ids.length > 0) {
        const tableAssignments = bookingData.table_ids.map((tableId: string) => ({
          booking_id: booking.id,
          table_id: tableId,
          // For shared table bookings, set seats_occupied to party_size
          // For regular bookings, it defaults to 1 which is correct
          seats_occupied: bookingData.is_shared_booking ? bookingData.party_size : 1,
        }))

        const { error: tableError } = await supabase
          .from("booking_tables")
          .insert(tableAssignments)

        if (tableError) {
          // Rollback booking if table assignment fails
          await supabase.from("bookings").delete().eq("id", booking.id)
          throw tableError
        }
      }

      // Log initial status
      await supabase
        .from("booking_status_history")
        .insert({
          booking_id: booking.id,
          new_status: bookingData.status || "confirmed",
          changed_by: user.id,
          metadata: { source: 'manual_booking' }
        })

      return booking
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      toast.success("Booking created successfully")
      setShowManualBooking(false)
    },
    onError: (error: any) => {
      console.error("Create booking error:", error)
      toast.error(error.message || "Failed to create booking")
    },
  })

  // Enhanced filter function
  const filteredBookings = bookings?.filter((booking) => {
    if (!searchQuery) return true
    
    const searchLower = searchQuery.toLowerCase()
    const userName = booking.user?.full_name?.toLowerCase() || ""
    const guestName = booking.guest_name?.toLowerCase() || ""
    const confirmationCode = booking.confirmation_code?.toLowerCase() || ""
    const phone = booking.guest_phone?.toLowerCase() || booking.user?.phone_number?.toLowerCase() || ""
    const email = booking.guest_email?.toLowerCase() || booking.user?.email?.toLowerCase() || ""
    const tableNumbers = booking.tables?.map(t => `${t.table_number.toLowerCase()} t${t.table_number.toLowerCase()}`).join(" ") || ""
    const status = booking.status?.toLowerCase() || ""
    
    return (
      userName.includes(searchLower) ||
      guestName.includes(searchLower) ||
      confirmationCode.includes(searchLower) ||
      phone.includes(searchLower) ||
      email.includes(searchLower) ||
      tableNumbers.includes(searchLower) ||
      status.includes(searchLower)
    )
  })

  // Enhanced booking statistics
  const bookingStats = {
    all: bookings?.length || 0,
    pending: bookings?.filter(b => b.status === "pending").length || 0,
    confirmed: bookings?.filter(b => b.status === "confirmed").length || 0,
    arrived: bookings?.filter((b:any) => b.status === "arrived").length || 0,
    currentlyDining: bookings?.filter(b => 
      ['seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(b.status)
    ).length || 0,
    completed: bookings?.filter(b => b.status === "completed").length || 0,
    cancelled: bookings?.filter(b => 
      ['cancelled_by_user', 'cancelled_by_restaurant', 'declined_by_restaurant'].includes(b.status)
    ).length || 0,
    no_show: bookings?.filter(b => b.status === "no_show").length || 0,
    withoutTables: bookings?.filter(b => 
      ['confirmed', 'arrived'].includes(b.status) && (!b.tables || b.tables.length === 0)
    ).length || 0,
  }

  // Calculate dining progress for currently dining bookings
  const diningProgress = bookings?.filter(b => 
    ['seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(b.status)
  ).map(booking => ({
    ...booking,
    progress: TableStatusService.getDiningProgress(booking.status as DiningStatus)
  }))

  // Helper function to get peak hour
  function getPeakHour(bookings: any[]): string {
    const hourCounts: Record<number, number> = {}
    
    bookings.forEach(booking => {
      const hour = new Date(booking.booking_time).getHours()
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
    })

    const peakHour = Object.entries(hourCounts).reduce((max, [hour, count]) => 
      count > max.count ? { hour: parseInt(hour), count } : max,
      { hour: 0, count: 0 }
    )

    return peakHour.count > 0 ? `${peakHour.hour}:00` : "N/A"
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bookings Management</h1>
          <p className="text-muted-foreground">
            Comprehensive booking and dining status management
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setShowManualBooking(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Booking
          </Button>
        </div>
      </div>

      {/* Enhanced Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Today's Bookings"
          value={bookingStats.confirmed + bookingStats.arrived}
          description={`${bookingStats.pending} pending`}
          icon={CalendarIcon}
        />
        <StatCard
          title="Currently Dining"
          value={bookingStats.currentlyDining}
          description={`${tableStats?.currentlyDining || 0} tables occupied`}
          icon={ChefHat}
          variant="info"
        />
        <StatCard
          title="Table Utilization"
          value={`${tableStats?.utilization || 0}%`}
          description={`${tableStats?.totalTables || 0} tables total`}
          icon={Table2}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Peak Hour"
          value={tableStats?.peakHour || "N/A"}
          description="Busiest time today"
          icon={Clock}
        />
        <StatCard
          title="Action Required"
          value={bookingStats.withoutTables + bookingStats.arrived}
          description="Need attention"
          icon={AlertCircle}
          variant={bookingStats.withoutTables > 0 ? "warning" : "default"}
        />
      </div>

      {/* Currently Dining Progress Overview */}
      {diningProgress && diningProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Service Progress Overview</CardTitle>
            <CardDescription>
              Real-time dining status for active tables
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {diningProgress.slice(0, 5).map((booking) => {
                // Use checked_in_at for elapsed time if guest has checked in, otherwise use booking_time
                const timeReference = booking.checked_in_at ? new Date(booking.checked_in_at) : new Date(booking.booking_time)
                const elapsedTime = differenceInMinutes(new Date(), timeReference)
                const estimatedRemaining = statusService.estimateRemainingTime(
                  booking.status as DiningStatus,
                  booking.turn_time_minutes || 120
                )
                
                return (
                  <div key={booking.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">
                          {booking.guest_name || booking.user?.full_name}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {titleCase(booking.status)}
                        </Badge>
                        {booking.tables && booking.tables.length > 0 && (
                          <span className="text-sm text-muted-foreground">
                            Table {booking.tables.map(t => t.table_number).join(", ")}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {elapsedTime}m elapsed • ~{estimatedRemaining}m remaining
                      </span>
                    </div>
                    <Progress value={booking.progress} className="h-2" />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced View Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <TabsList className="grid w-[300px] grid-cols-3">
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="table-view">Table Status</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Enhanced Filters */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Filters & Search</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={dateRange === "today" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDateRange("today")}
                  >
                    Today
                  </Button>
                  <Button
                    variant={dateRange === "tomorrow" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDateRange("tomorrow")}
                  >
                    Tomorrow
                  </Button>
                  <Button
                    variant={dateRange === "week" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDateRange("week")}
                  >
                    This Week
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, code, phone, email, table, or status..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <DiningStatusFilter value={statusFilter} onChange={setStatusFilter} />
                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Times</SelectItem>
                    <SelectItem value="lunch">Lunch (11-3)</SelectItem>
                    <SelectItem value="dinner">Dinner (5-11)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status badges summary */}
              <div className="flex flex-wrap gap-2 mt-4">
                <Badge variant="secondary">
                  {bookingStats.pending} Pending
                </Badge>
                <Badge variant="default">
                  {bookingStats.confirmed} Confirmed
                </Badge>
                <Badge variant="outline" className="border-blue-200 bg-blue-50">
                  {bookingStats.arrived} Arrived
                </Badge>
                <Badge variant="outline" className="border-purple-200 bg-purple-50">
                  <Activity className="h-3 w-3 mr-1" />
                  {bookingStats.currentlyDining} Dining
                </Badge>
                {bookingStats.withoutTables > 0 && (
                  <Badge variant="destructive">
                    {bookingStats.withoutTables} Need Tables
                  </Badge>
                )}
              </div>

              {/* Quick alerts */}
              {bookingStats.withoutTables > 0 && (
                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {bookingStats.withoutTables} confirmed booking{bookingStats.withoutTables > 1 ? 's' : ''} 
                    {bookingStats.withoutTables > 1 ? 'need' : 'needs'} table assignment
                  </AlertDescription>
                </Alert>
              )}
              
              {bookingStats.arrived > 0 && (
                <Alert className="mt-4" variant="default">
                  <UserCheck className="h-4 w-4" />
                  <AlertDescription>
                    {bookingStats.arrived} guest{bookingStats.arrived > 1 ? 's have' : ' has'} arrived and 
                    {bookingStats.arrived > 1 ? ' are' : ' is'} waiting to be seated
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Enhanced Booking List */}
          <BookingList
            bookings={filteredBookings || []}
            isLoading={isLoading}
            onSelectBooking={setSelectedBooking}
            onUpdateStatus={(bookingId: any, status: any) => 
              updateBookingMutation.mutate({ bookingId, updates: { status } })
            }
          />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[300px_1fr]">
            {/* Calendar */}
            <Card>
              <CardHeader>
                <CardTitle>Select Date</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md"
                />
              </CardContent>
            </Card>

            {/* Day's Bookings with Status Overview */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Bookings for {format(selectedDate, "MMMM d, yyyy")}
                </CardTitle>
                <CardDescription>
                  {filteredBookings?.length || 0} bookings • 
                  {bookingStats.currentlyDining} currently dining
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BookingList
                  bookings={filteredBookings || []}
                  isLoading={isLoading}
                  onSelectBooking={setSelectedBooking}
                  onUpdateStatus={(bookingId: any, status: any) => 
                    updateBookingMutation.mutate({ bookingId, updates: { status } })
                  }
                  compact
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="table-view" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Table Status Overview</CardTitle>
              <CardDescription>
                Real-time table availability and booking assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tables && tables.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {tables.map((table) => {
                    const tableBookings = bookings?.filter(booking =>
                      booking.tables?.some(t => t.id === table.id)
                    ) || []

                    const currentBooking:any = tableBookings.find(booking => {
                      const isDining = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(booking.status)
                      if (!isDining) return false
                      
                      const bookingTime = new Date(booking.booking_time)
                      const endTime = addMinutes(bookingTime, booking.turn_time_minutes || 120)
                      const now = new Date()
                      return now >= bookingTime && now <= endTime
                    })

                    const upcomingBooking = tableBookings
                      .filter(b => new Date(b.booking_time) > new Date() && b.status === 'confirmed')
                      .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())[0]

                    const isOccupied = !!currentBooking
                    const hasUpcoming = !!upcomingBooking

                    return (
                      <Card
                        key={table.id}
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-md",
                          isOccupied && "border-green-500 bg-green-50",
                          !isOccupied && hasUpcoming && "border-yellow-500 bg-yellow-50"
                        )}
                        onClick={() => {
                          if (currentBooking) {
                            setSelectedBooking(currentBooking)
                          } else if (upcomingBooking) {
                            setSelectedBooking(upcomingBooking)
                          }
                        }}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Table2 className="h-5 w-5" />
                              <span className="font-bold">Table {table.table_number}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {table.capacity} seats
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {isOccupied && currentBooking ? (
                            <div className="space-y-2">
                              <p className="text-sm font-medium">
                                {currentBooking.user?.full_name || currentBooking.guest_name}
                              </p>
                              <div className="flex items-center gap-2 text-xs">
                                <Users className="h-3 w-3" />
                                {currentBooking.party_size} guests
                              </div>
                              <Badge 
                                variant="default" 
                                className={cn(
                                  "text-xs w-full justify-center",
                                  currentBooking.status === 'payment' && "bg-yellow-500"
                                )}
                              >
                                {titleCase(currentBooking.status)}
                              </Badge>
                              <Progress 
                                value={TableStatusService.getDiningProgress(currentBooking.status as DiningStatus)} 
                                className="h-1"
                              />
                            </div>
                          ) : (
                            <div className="text-center py-2">
                              <Badge variant="secondary" className="mb-2">
                                Available
                              </Badge>
                              {upcomingBooking && (
                                <div className="text-xs text-muted-foreground mt-2">
                                  <p>Next: {format(new Date(upcomingBooking.booking_time), 'h:mm a')}</p>
                                  <p className="truncate">{upcomingBooking.party_size} guests</p>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Loading table information...
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Enhanced Booking Details Modal */}
      {selectedBooking && (
        <BookingDetails
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdate={(updates) => {
            updateBookingMutation.mutate({ 
              bookingId: selectedBooking.id, 
              updates 
            })
          }}
        />
      )}

      {/* Manual Booking Modal */}
      <Dialog open={showManualBooking} onOpenChange={setShowManualBooking}>
        <DialogContent className="max-w-4xl w-full h-[95vh] flex flex-col p-0">
          <div className="flex-shrink-0 px-6 py-4 border-b">
            <DialogHeader>
              <DialogTitle>Add Manual Booking</DialogTitle>
              <DialogDescription>
                Create a new booking manually for walk-ins or phone reservations
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <ManualBookingForm
              restaurantId={restaurantId}
              onSubmit={(data) => createManualBookingMutation.mutate(data)}
              onCancel={() => setShowManualBooking(false)}
              isLoading={createManualBookingMutation.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}