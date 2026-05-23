// app/(dashboard)/bookings/calendar/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  parseISO
} from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Clock,
  Users,
  Filter,
  ArrowLeft,
  CalendarDays,
  CalendarRange
} from "lucide-react"
import { cn, titleCase } from "@/lib/utils"
import type { Booking } from "@/types"

type ViewMode = "month" | "week" | "day"

const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, "0")
  return `${hour}:00`
})

export default function BookingCalendarPage() {
  const router = useRouter()
  const supabase = createClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [restaurantId, setRestaurantId] = useState<string>("")

  const { currentRestaurant } = useRestaurantContext()
  
  // Set restaurant ID from current restaurant context
  useEffect(() => {
    if (currentRestaurant) {
      setRestaurantId(currentRestaurant.restaurant.id)
    } else {
      setRestaurantId("")
    }
  }, [currentRestaurant])

  // Get date range based on view mode
  const getDateRange = () => {
    switch (viewMode) {
      case "month":
        const monthStart = startOfMonth(currentDate)
        const monthEnd = endOfMonth(currentDate)
        return {
          start: startOfWeek(monthStart),
          end: endOfWeek(monthEnd),
        }
      case "week":
        return {
          start: startOfWeek(currentDate),
          end: endOfWeek(currentDate),
        }
      case "day":
        return {
          start: currentDate,
          end: currentDate,
        }
    }
  }

  const dateRange = getDateRange()

  // Fetch bookings
  const { data: bookings, isLoading } = useQuery({
    queryKey: ["calendar-bookings", restaurantId, dateRange.start, dateRange.end, statusFilter],
    queryFn: async () => {
      if (!restaurantId) return []
      
      let query = supabase
        .from("bookings")
        .select(`
          *,
          user:profiles(full_name, phone_number),
          tables:booking_tables(
            table:restaurant_tables(table_number)
          )
        `)
        .eq("restaurant_id", restaurantId)
        .neq("status", "payment_pending")
        .gte("booking_time", dateRange.start.toISOString())
        .lte("booking_time", dateRange.end.toISOString())
        .order("booking_time", { ascending: true })

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Booking[]
    },
    enabled: !!restaurantId,
  })

  // Group bookings by date
  const bookingsByDate = bookings?.reduce((acc, booking) => {
    const date = format(new Date(booking.booking_time), "yyyy-MM-dd")
    if (!acc[date]) acc[date] = []
    acc[date].push(booking)
    return acc
  }, {} as Record<string, Booking[]>) || {}

  // Navigation functions
  const navigatePrevious = () => {
    switch (viewMode) {
      case "month":
        setCurrentDate(subMonths(currentDate, 1))
        break
      case "week":
        setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000))
        break
      case "day":
        setCurrentDate(new Date(currentDate.getTime() - 24 * 60 * 60 * 1000))
        break
    }
  }

  const navigateNext = () => {
    switch (viewMode) {
      case "month":
        setCurrentDate(addMonths(currentDate, 1))
        break
      case "week":
        setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000))
        break
      case "day":
        setCurrentDate(new Date(currentDate.getTime() + 24 * 60 * 60 * 1000))
        break
    }
  }

  const navigateToday = () => {
    setCurrentDate(new Date())
  }

  // Get calendar days
  const calendarDays = eachDayOfInterval({
    start: dateRange.start,
    end: dateRange.end,
  })

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  // Render booking card
  const renderBookingCard = (booking: any) => (
    <div
      key={booking.id}
      className={cn(
        "p-2 rounded-md border text-xs cursor-pointer hover:shadow-md transition-shadow",
        getStatusColor(booking.status)
      )}
      onClick={() => router.push(`/bookings/${booking.id}`)}
    >
      <div className="font-medium">
        {format(new Date(booking.booking_time), "HH:mm")}
      </div>
      <div className="truncate">
        {booking.guest_name || booking.user?.full_name}
      </div>
      <div className="flex items-center gap-1 text-[10px] opacity-75">
        <Users className="h-3 w-3" />
        {booking.party_size}
        {booking.tables?.[0]?.table && (
          <span> • T{booking.tables[0].table.table_number}</span>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => router.push("/bookings")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Bookings
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Booking Calendar</h1>
        <p className="text-muted-foreground text-sm">View and manage bookings in calendar format
        </p>
      </div>

      {/* Calendar Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={navigatePrevious}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={navigateNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={navigateToday}
              >
                Today
              </Button>
              <h2 className="text-xl font-semibold ml-4">
                {viewMode === "month" && format(currentDate, "MMMM yyyy")}
                {viewMode === "week" && `Week of ${format(dateRange.start, "MMM d, yyyy")}`}
                {viewMode === "day" && format(currentDate, "EEEE, MMMM d, yyyy")}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-4">Loading bookings...</div>
          ) : viewMode === "month" ? (
            /* Month View */
            <div className="border-t">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0"
                  >
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar grid */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd")
                  const dayBookings = bookingsByDate[dateStr] || []
                  const isCurrentMonth = isSameMonth(day, currentDate)
                  const isSelected = selectedDate && isSameDay(day, selectedDate)
                  
                  return (
                    <div
                      key={dateStr}
                      className={cn(
                        "min-h-[120px] p-2 border-r border-b last:border-r-0",
                        !isCurrentMonth && "bg-muted/30",
                        isToday(day) && "bg-primary/5",
                        isSelected && "bg-primary/10"
                      )}
                      onClick={() => setSelectedDate(day)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={cn(
                            "text-sm font-medium",
                            !isCurrentMonth && "text-muted-foreground",
                            isToday(day) && "text-primary"
                          )}
                        >
                          {format(day, "d")}
                        </span>
                        {dayBookings.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {dayBookings.length}
                          </Badge>
                        )}
                      </div>
                      <ScrollArea className="h-[80px]">
                        <div className="space-y-1">
                          {dayBookings.slice(0, 3).map((booking) => (
                            <div
                              key={booking.id}
                              className={cn(
                                "p-1 rounded text-xs cursor-pointer hover:opacity-80",
                                getStatusColor(booking.status)
                              )}
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/bookings/${booking.id}`)
                              }}
                            >
                              <div className="font-medium truncate">
                                {format(new Date(booking.booking_time), "HH:mm")} - {booking.guest_name || booking.user?.full_name}
                              </div>
                            </div>
                          ))}
                          {dayBookings.length > 3 && (
                            <div className="text-xs text-muted-foreground text-center">
                              +{dayBookings.length - 3} more
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : viewMode === "week" ? (
            /* Week View */
            <div className="border-t">
              <div className="grid grid-cols-8">
                {/* Time column */}
                <div className="border-r">
                  <div className="h-12 border-b" />
                  {TIME_SLOTS.map((time) => (
                    <div
                      key={time}
                      className="h-16 px-2 py-1 text-xs text-muted-foreground border-b"
                    >
                      {time}
                    </div>
                  ))}
                </div>
                
                {/* Days columns */}
                {calendarDays.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd")
                  const dayBookings = bookingsByDate[dateStr] || []
                  
                  return (
                    <div key={dateStr} className="border-r last:border-r-0">
                      <div className="h-12 p-2 text-center border-b">
                        <div className="text-sm font-medium">
                          {format(day, "EEE")}
                        </div>
                        <div
                          className={cn(
                            "text-lg",
                            isToday(day) && "text-primary font-semibold"
                          )}
                        >
                          {format(day, "d")}
                        </div>
                      </div>
                      <div className="relative">
                        {TIME_SLOTS.map((time) => (
                          <div
                            key={`${dateStr}-${time}`}
                            className="h-16 border-b"
                          />
                        ))}
                        {/* Bookings overlay */}
                        <div className="absolute inset-0 p-1">
                          {dayBookings.map((booking) => {
                            const bookingTime = new Date(booking.booking_time)
                            const hour = bookingTime.getHours()
                            const minutes = bookingTime.getMinutes()
                            const top = (hour + minutes / 60) * 64 // 64px per hour
                            
                            return (
                              <div
                                key={booking.id}
                                className="absolute left-1 right-1"
                                style={{ top: `${top}px` }}
                              >
                                {renderBookingCard(booking)}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Day View */
            <div className="border-t">
              <div className="grid grid-cols-[100px_1fr]">
                {/* Time column */}
                <div className="border-r">
                  {TIME_SLOTS.map((time) => (
                    <div
                      key={time}
                      className="h-20 px-2 py-1 text-sm text-muted-foreground border-b"
                    >
                      {time}
                    </div>
                  ))}
                </div>
                
                {/* Bookings column */}
                <div className="relative">
                  {TIME_SLOTS.map((time) => (
                    <div
                      key={time}
                      className="h-20 border-b"
                    />
                  ))}
                  {/* Bookings overlay */}
                  <div className="absolute inset-0 p-2">
                    {(bookingsByDate[format(currentDate, "yyyy-MM-dd")] || []).map((booking:any) => {
                      const bookingTime = new Date(booking.booking_time)
                      const hour = bookingTime.getHours()
                      const minutes = bookingTime.getMinutes()
                      const top = (hour + minutes / 60) * 80 // 80px per hour in day view
                      
                      return (
                        <div
                          key={booking.id}
                          className="absolute left-2 right-2 max-w-md"
                          style={{ top: `${top}px` }}
                        >
                          <Card
                            className="cursor-pointer hover:shadow-lg transition-shadow"
                            onClick={() => router.push(`/bookings/${booking.id}`)}
                          >
                            <CardHeader className="p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <CardTitle className="text-base">
                                    {format(bookingTime, "HH:mm")} - {booking.guest_name || booking.user?.full_name}
                                  </CardTitle>
                                  <CardDescription className="text-xs">
                                    {booking.confirmation_code}
                                  </CardDescription>
                                </div>
                                <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
                                  {titleCase(booking.status)}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="p-3 pt-0">
                              <div className="flex items-center gap-4 text-sm text-muted-foreground text-sm"><div className="flex items-center gap-1">
                                  <Users className="h-4 w-4" />
                                  {booking.party_size} guests
                                </div>
                                {booking.tables?.[0]?.table && (
                                  <div>
                                    Table {booking.tables[0].table.table_number}
                                  </div>
                                )}
                                {booking.special_requests && (
                                  <div className="truncate flex-1">
                                    Note: {booking.special_requests}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className={cn("w-4 h-4 rounded border", getStatusColor("pending"))} />
              <span className="text-sm">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn("w-4 h-4 rounded border", getStatusColor("confirmed"))} />
              <span className="text-sm">Confirmed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn("w-4 h-4 rounded border", getStatusColor("completed"))} />
              <span className="text-sm">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn("w-4 h-4 rounded border", getStatusColor("cancelled"))} />
              <span className="text-sm">Cancelled</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

