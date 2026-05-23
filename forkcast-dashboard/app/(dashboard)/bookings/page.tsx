"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { format, startOfDay, endOfDay, addDays } from "date-fns"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { BookingRequestService } from "@/lib/booking-request-service"
import {
  CalendarIcon,
  CalendarDays,
  Users,
  TrendingUp,
  Plus,
  RefreshCw,
  BarChart3,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Table2
} from "lucide-react"
import type { Booking } from "@/types"
import { bookingAlarmService } from "@/lib/services/booking-alarm-service"

// Import our new components
import { useBookingsState } from "./hooks/useBookingsState"
import { useBookingsActions } from "./hooks/useBookingsActions"
import { AlertCenter } from "./components/AlertCenter"
import { BookingsFilter } from "./components/BookingsFilter"
import { PenaltyDialog } from "@/components/bookings/penalty-dialog"
import { Button } from "@/components/ui/button"

export default function BookingsPage() {
  const router = useRouter()
  const { currentRestaurant, tier, isLoading: contextLoading } = useRestaurantContext()
  const now = useMemo(() => new Date(), [])

  // State management using our custom hooks
  const { state, actions } = useBookingsState()

  const supabase = createClient()
  const queryClient = useQueryClient()

  // Get restaurant and user IDs
  const [restaurantId, setRestaurantId] = useState<string>("")
  const [userId, setUserId] = useState<string>("")
  const [lastExpiredCheck, setLastExpiredCheck] = useState<Date>(new Date())

  // Initialize booking actions hook
  const bookingActions = useBookingsActions({ restaurantId, userId })

  // Get user ID on mount
  useEffect(() => {
    async function getUserId() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    getUserId()
  }, [supabase])

  // Set restaurant ID from context
  useEffect(() => {
    if (currentRestaurant) {
      setRestaurantId(currentRestaurant.restaurant.id)
    } else {
      setRestaurantId("")
    }
  }, [currentRestaurant])

  // Fetch all bookings
  const { data: allBookings } = useQuery({
    queryKey: ["all-bookings", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []

      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          profiles!bookings_user_id_fkey(
            id,
            full_name,
            phone_number
          ),
          booking_tables(
            table:restaurant_tables(*)
          ),
          special_offers!bookings_applied_offer_id_fkey(
            id,
            title,
            description,
            discount_percentage
          ),
          promo_codes!bookings_applied_promo_code_id_fkey(
            id,
            code,
            description,
            discount_type,
            discount_value,
            max_discount_amount
          ),
          booking_guarantees(
            id,
            status
          )
        `)
        .eq("restaurant_id", restaurantId)
        .neq("status", "payment_pending")
        .order("booking_time", { ascending: true })

      if (error) {
        console.error("Error fetching all bookings:", error)
        throw error
      }

      const transformedData = data?.map((booking: any) => ({
        ...booking,
        user: booking.profiles || null,
        tables: booking.booking_tables?.map((bt: { table: any }) => bt.table) || [],
        booking_guarantee: booking.booking_guarantees?.[0] || null
      })) as Booking[]

      return transformedData
    },
    enabled: !!restaurantId,
  })

  // Reconcile alarm state with actual pending bookings on EVERY data refresh.
  // This acts as a polling safety net when Supabase Realtime drops.
  useEffect(() => {
    if (!allBookings) return

    bookingAlarmService.clearSyntheticAlarms()

    // Only alarm for today's pending bookings — old unresolved ones shouldn't ring
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const pendingIds = new Set(
      allBookings
        .filter((b: Booking) => b.status === 'pending' && new Date(b.booking_time) >= todayStart)
        .map((b: Booking) => b.id)
    )

    // Start alarm for any pending bookings not already in the alarm set
    pendingIds.forEach(id => {
      if (!bookingAlarmService.hasPending(id)) {
        bookingAlarmService.startAlarm(id)
      }
    })

    // Stop alarm for any bookings that are no longer pending
    const currentAlarmIds = bookingAlarmService.getPendingIds()
    currentAlarmIds.forEach(id => {
      if (!id.startsWith('push-') && !pendingIds.has(id)) {
        bookingAlarmService.stopAlarm(id)
      }
    })
  }, [allBookings])

  // Real-time subscription for bookings
  useEffect(() => {
    if (!restaurantId) return

    console.log('🔗 Setting up real-time subscription for bookings')

    const channel = supabase
      .channel(`bookings:${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        (payload) => {
          console.log('📥 Booking change received:', payload)
          queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
          queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
        }
      )
      .subscribe()

    return () => {
      console.log('🔌 Cleaning up bookings subscription')
      supabase.removeChannel(channel)
    }
  }, [restaurantId, queryClient, supabase])

  // Penalty Dialog State
  const [penaltyDialog, setPenaltyDialog] = useState<{
    isOpen: boolean
    bookingId: string | null
    newStatus: 'no_show' | 'cancelled_by_restaurant'
  }>({
    isOpen: false,
    bookingId: null,
    newStatus: 'no_show'
  })

  // Intercept Status Updates
  const handleUpdateStatus = (bookingId: string, status: string) => {
    const booking = allBookings?.find((b: any) => b.id === bookingId)
    
    // Check for interception
    if (
      ['no_show', 'cancelled_by_restaurant'].includes(status) && 
      booking?.booking_guarantee?.status === 'held'
    ) {
      setPenaltyDialog({
        isOpen: true,
        bookingId,
        newStatus: status as any
      })
      return
    }

    // Default action
    bookingActions.updateBookingMutation.mutate({ bookingId, updates: { status: status as any } })
  }

  // Fetch displayed bookings based on current view and filters
  const { data: displayedBookings, isLoading } = useQuery({
    queryKey: ["displayed-bookings", restaurantId, state.viewMode, state.selectedDate, state.statusFilter, state.timeFilter, state.dateRange],
    queryFn: async () => {
      if (!restaurantId) return []

      let query = supabase
        .from("bookings")
        .select(`
          *,
          profiles!bookings_user_id_fkey(
            id,
            full_name,
            phone_number
          ),
          booking_tables(
            table:restaurant_tables(*)
          ),
          booking_guarantees(
            id,
            status
          )
        `)
        .eq("restaurant_id", restaurantId)
        .neq("status", "payment_pending")
        .order("booking_time", { ascending: true })

      // Apply filters based on view mode
      if (state.viewMode === "today") {
        const today = startOfDay(now)
        const endToday = endOfDay(now)
        query = query
          .gte("booking_time", today.toISOString())
          .lte("booking_time", endToday.toISOString())
          .gte("booking_time", now.toISOString()) // Only future bookings for today view
      } else if (state.viewMode === "management") {
        // Apply date range filters for management view
        if (state.dateRange !== "all") {
          let startDate: Date, endDate: Date

          if (state.dateRange === "today") {
            startDate = startOfDay(now)
            endDate = endOfDay(now)
          } else if (state.dateRange === "tomorrow") {
            startDate = startOfDay(addDays(now, 1))
            endDate = endOfDay(addDays(now, 1))
          } else if (state.dateRange === "week") {
            startDate = startOfDay(now)
            endDate = endOfDay(addDays(now, 7))
          } else if (state.dateRange === "custom") {
            startDate = startOfDay(state.selectedDate)
            endDate = endOfDay(state.selectedDate)
          } else {
            startDate = startOfDay(now)
            endDate = endOfDay(now)
          }

          query = query
            .gte("booking_time", startDate.toISOString())
            .lte("booking_time", endDate.toISOString())
        }
      }

      // Apply status filter
      if (state.statusFilter === "upcoming") {
        query = query.in("status", ["pending", "confirmed"])
      } else if (state.statusFilter === "cancelled_by_user") {
        query = query.in("status", ["cancelled_by_user", "declined_by_restaurant"])
      } else if (state.statusFilter !== "all") {
        query = query.eq("status", state.statusFilter)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error fetching displayed bookings:", error)
        throw error
      }

      // Transform and filter data
      let transformedData = data?.map((booking: any) => ({
        ...booking,
        user: booking.profiles || null,
        tables: booking.booking_tables?.map((bt: { table: any }) => bt.table) || [],
        booking_guarantee: booking.booking_guarantees?.[0] || null
      })) as Booking[]

      // Apply time filter
      if (state.timeFilter !== "all" && transformedData) {
        transformedData = transformedData.filter(booking => {
          const hour = new Date(booking.booking_time).getHours()
          if (state.timeFilter === "lunch") return hour >= 11 && hour < 15
          if (state.timeFilter === "dinner") return hour >= 17 && hour < 23
          return true
        })
      }

      return transformedData
    },
    enabled: !!restaurantId,
  })

  // Fetch table stats
  const { data: tableStats } = useQuery({
    queryKey: ["table-stats", restaurantId, state.selectedDate],
    queryFn: async () => {
      if (!restaurantId) return null

      const dayStart = startOfDay(state.selectedDate)
      const dayEnd = endOfDay(state.selectedDate)

      // Get total tables
      const { data: tables } = await supabase
        .from("restaurant_tables")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)

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
        .neq("status", "cancelled_by_user")
        .neq("status", "declined_by_restaurant")

      const totalTables = tables?.length || 0
      const totalSlots = totalTables * 12 // 12 hours of operation
      const occupiedCount = occupiedSlots?.reduce((acc, booking) => {
        const slots = Math.ceil((booking.turn_time_minutes || 120) / 60)
        return acc + (booking.booking_tables?.length || 0) * slots
      }, 0) || 0

      const utilization = totalSlots > 0 ? Math.round((occupiedCount / totalSlots) * 100) : 0

      return {
        totalTables,
        utilization,
        peakHour: getPeakHour(occupiedSlots || [])
      }
    },
    enabled: !!restaurantId
  })

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

  // Auto-refresh with expired request cleanup
  useEffect(() => {
    if (!state.autoRefresh) return

    const interval = setInterval(async () => {
      // Check for expired requests periodically
      const now = new Date()
      const timeSinceLastExpiredCheck = now.getTime() - lastExpiredCheck.getTime()

      if (timeSinceLastExpiredCheck > 60000) { // Every minute
        await bookingActions.handleExpiredRequests()
        setLastExpiredCheck(new Date())
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["table-stats"] })
      actions.updateLastRefresh()
    }, 15000) // 15 seconds

    return () => clearInterval(interval)
  }, [state.autoRefresh, queryClient, bookingActions, lastExpiredCheck, actions])

  // Initial expired request check
  useEffect(() => {
    if (restaurantId && userId) {
      bookingActions.handleExpiredRequests()
    }
  }, [restaurantId, userId, bookingActions])

  // Filter bookings based on search
  const filteredBookings = displayedBookings?.filter((booking) => {
    if (!state.searchQuery) return true

    const searchLower = state.searchQuery.toLowerCase()
    const userName = booking.user?.full_name?.toLowerCase() || ""
    const guestName = booking.guest_name?.toLowerCase() || ""
    const confirmationCode = booking.confirmation_code?.toLowerCase() || ""
    const phone = booking.guest_phone?.toLowerCase() || booking.user?.phone_number?.toLowerCase() || ""
    const email = booking.guest_email?.toLowerCase() || ""
    const tableNumbers = booking.tables?.map(t => `${t.table_number.toLowerCase()} t${t.table_number.toLowerCase()}`).join(" ") || ""

    return (
      userName.includes(searchLower) ||
      guestName.includes(searchLower) ||
      confirmationCode.includes(searchLower) ||
      phone.includes(searchLower) ||
      email.includes(searchLower) ||
      tableNumbers.includes(searchLower)
    )
  })

  // Calculate booking statistics
  const bookingStats = useMemo(() => {
    if (!allBookings) return {
      all: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0, no_show: 0,
      withoutTables: 0, upcoming: 0, avgPartySize: 0, totalGuests: 0, revenue: 0, needingAttention: 0
    }

    return {
      all: allBookings.length,
      pending: allBookings.filter((b: any) => b.status === "pending").length,
      confirmed: allBookings.filter((b: any) => b.status === "confirmed").length,
      completed: allBookings.filter((b: any) => b.status === "completed").length,
      cancelled: allBookings.filter((b: any) =>
        b.status === "cancelled_by_user" || b.status === "declined_by_restaurant"
      ).length,
      no_show: allBookings.filter((b: any) => b.status === "no_show").length,
      withoutTables: allBookings.filter((b: any) =>
        b.status === "confirmed" && (!b.tables || b.tables.length === 0)
      ).length,
      upcoming: allBookings.filter((b: any) =>
        (b.status === "pending" || b.status === "confirmed") &&
        new Date(b.booking_time) > now
      ).length,
      avgPartySize: allBookings.length ?
        Math.round((allBookings.reduce((acc: number, b: any) => acc + b.party_size, 0) / allBookings.length) * 10) / 10 : 0,
      totalGuests: allBookings.filter((b: any) => b.status === "confirmed" || b.status === "completed")
        .reduce((acc: number, b: any) => acc + b.party_size, 0),
      revenue: (allBookings.filter((b: any) => b.status === "completed").length) * 45,
      needingAttention: allBookings.filter((b: any) => {
        const isUrgentPending = b.status === "pending" && new Date(b.booking_time).getTime() - now.getTime() < 3600000
        const isConfirmedWithoutTable = b.status === "confirmed" && (!b.tables || b.tables.length === 0)
        return b.status === "pending" || isConfirmedWithoutTable || isUrgentPending
      }).length
    }
  }, [allBookings, now])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case 'r':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            bookingActions.handleRefresh()
            actions.updateLastRefresh()
          }
          break
        case 'n':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            actions.toggleManualBooking()
          }
          break
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            actions.toggleAnalytics()
          }
          break
        case '1':
          e.preventDefault()
          actions.setViewMode("today")
          break
        case '2':
          e.preventDefault()
          actions.setViewMode("management")
          break
        case 'Escape':
          actions.clearSelections()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [actions, bookingActions])

  // Handle stat clicks for navigation
  const handleStatClick = useCallback((statType: string) => {
    switch (statType) {
      case "today":
        actions.setViewMode("today")
        break
      case "attention":
        actions.setViewMode("management")
        actions.setStatusFilter("pending")
        break
      case "performance":
        actions.toggleAnalytics()
        break
      case "nexthour":
        actions.setViewMode("today")
        actions.setStatusFilter("confirmed")
        break
      case "guests":
        actions.setViewMode("management")
        actions.setStatusFilter("confirmed")
        break
      default:
        break
    }
  }, [actions])

  // Loading state
  if (contextLoading || !restaurantId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="motion-safe:animate-spin rounded-full h-16 w-16 border-4 border-border mx-auto mb-4" />
          <p className="text-lg font-medium">Loading bookings...</p>
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
            <div className="w-8 h-8 rounded-md bg-indigo-500 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Bookings</h1>
              <p className="text-xs text-muted-foreground">
                {format(new Date(), 'EEE, MMM d')} • {bookingStats.upcoming} upcoming
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                bookingActions.handleRefresh()
                actions.updateLastRefresh()
              }}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={state.showAnalytics ? "default" : "ghost"}
              size="sm"
              onClick={actions.toggleAnalytics}
              className="h-8 w-8 p-0"
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </Button>
            <Button
              onClick={actions.toggleManualBooking}
              size="sm"
              className="h-8 gap-1 bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="text-xs">Add</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats Pills */}
      <div className="flex-shrink-0 px-3 py-2 border-b">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => handleStatClick("today")}
            className="px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium whitespace-nowrap hover:bg-indigo-200 transition-colors"
          >
            {bookingStats.upcoming} Upcoming
          </button>
          {bookingStats.pending > 0 && (
            <button
              onClick={() => handleStatClick("attention")}
              className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium whitespace-nowrap hover:bg-amber-200 transition-colors flex items-center gap-1"
            >
              <AlertTriangle className="h-3 w-3" />
              {bookingStats.pending} Pending
            </button>
          )}
          <button
            onClick={() => handleStatClick("guests")}
            className="px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium whitespace-nowrap hover:bg-blue-200 transition-colors flex items-center gap-1"
          >
            <Users className="h-3 w-3" />
            {bookingStats.confirmed} Confirmed
          </button>
          <button
            onClick={() => handleStatClick("performance")}
            className="px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-medium whitespace-nowrap hover:bg-green-200 transition-colors flex items-center gap-1"
          >
            <CheckCircle2 className="h-3 w-3" />
            {bookingStats.completed} Complete
          </button>
          {tableStats && (
            <button
              onClick={() => handleStatClick("tables")}
              className="px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium whitespace-nowrap hover:bg-purple-200 transition-colors flex items-center gap-1"
            >
              <Table2 className="h-3 w-3" />
              {tableStats.utilization}% Tables
            </button>
          )}
          {bookingStats.needingAttention > 0 && (
            <button
              onClick={() => handleStatClick("attention")}
              className="px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-xs font-medium whitespace-nowrap hover:bg-red-200 transition-colors motion-safe:animate-pulse"
            >
              ⚠️ {bookingStats.needingAttention} Need Attention
            </button>
          )}
        </div>
      </div>

      {/* Alert Center - Compact */}
      <AlertCenter
        bookings={filteredBookings || []}
        bookingStats={bookingStats}
        onBulkConfirm={(bookingIds) => bookingActions.bulkUpdateMutation.mutate({
          bookingIds,
          updates: { status: "confirmed" }
        })}
        onSelectBookings={(bookingIds) => actions.setSelectedBookings(bookingIds)}
        onAssignTable={(bookingId) => actions.setTableAssignment(true, bookingId)}
      />

      {/* Analytics Panel - Compact */}
      {state.showAnalytics && (
        <div className="flex-shrink-0 px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Analytics</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Peak</div>
              <div className="text-sm font-bold">{tableStats?.peakHour || "N/A"}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Complete</div>
              <div className="text-sm font-bold text-green-600">
                {bookingStats.all > 0 ? Math.round((bookingStats.completed / bookingStats.all) * 100) : 0}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">No-Show</div>
              <div className="text-sm font-bold text-red-600">
                {bookingStats.all > 0 ? Math.round((bookingStats.no_show / bookingStats.all) * 100) : 0}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Avg Party</div>
              <div className="text-sm font-bold">{bookingStats.avgPartySize}</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Scrollable Area */}
      <div className="flex-1 overflow-y-auto">
        <Tabs value={state.viewMode} onValueChange={(v) => actions.setViewMode(v as any)} className="h-full flex flex-col">
          {/* Compact Tab Bar */}
          <div className="flex-shrink-0 px-3 py-2 border-b bg-card/50">
            <div className="flex items-center justify-between">
              <TabsList className="h-8 p-0.5">
                <TabsTrigger value="today" className="h-7 px-3 text-xs gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  <span>Today</span>
                  {bookingStats.upcoming > 0 && (
                    <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                      {bookingStats.upcoming}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="management" className="h-7 px-3 text-xs gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  <span>All</span>
                  {bookingStats.needingAttention > 0 && (
                    <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                      {bookingStats.needingAttention}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Compact Live Indicator */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className={`h-2 w-2 rounded-full ${
                  state.autoRefresh ? 'bg-green-500 motion-safe:animate-pulse' : 'bg-gray-400'
                }`} />
                <span className="font-mono text-[10px]">
                  {format(new Date(), 'HH:mm')}
                </span>
              </div>
            </div>
          </div>

          {/* Today View */}
          <TabsContent value="today" className="flex-1 overflow-y-auto p-3 space-y-3">
            <BookingsFilter
            viewMode={state.viewMode}
            searchQuery={state.searchQuery}
            statusFilter={state.statusFilter}
            timeFilter={state.timeFilter}
            dateRange={state.dateRange}
            selectedDate={state.selectedDate}
            bookingStats={bookingStats}
            onSearchChange={actions.setSearchQuery}
            onStatusFilterChange={actions.setStatusFilter}
            onTimeFilterChange={actions.setTimeFilter}
            onDateRangeChange={actions.setDateRange}
            onDatePickerOpen={actions.toggleDatePicker}
            onResetFilters={actions.resetFilters}
          />

          <BookingList
            bookings={filteredBookings || []}
            isLoading={isLoading}
            restaurantId={restaurantId}
            onSelectBooking={actions.setSelectedBooking}
            onUpdateStatus={handleUpdateStatus}
            onAssignTable={(bookingId) => actions.setTableAssignment(true, bookingId)}
            onSwitchTable={(bookingId, fromTableId, toTableId) =>
              bookingActions.switchTableMutation.mutate({ bookingId, fromTableId, toTableId })
            }
            onRemoveTable={(bookingId, tableId) =>
              bookingActions.removeTableAssignmentMutation.mutate({ bookingId, tableId })
            }
          />
        </TabsContent>

          {/* Management View */}
          <TabsContent value="management" className="flex-1 overflow-y-auto p-3 space-y-3">
          <BookingsFilter
            viewMode={state.viewMode}
            searchQuery={state.searchQuery}
            statusFilter={state.statusFilter}
            timeFilter={state.timeFilter}
            dateRange={state.dateRange}
            selectedDate={state.selectedDate}
            bookingStats={bookingStats}
            onSearchChange={actions.setSearchQuery}
            onStatusFilterChange={actions.setStatusFilter}
            onTimeFilterChange={actions.setTimeFilter}
            onDateRangeChange={actions.setDateRange}
            onDatePickerOpen={actions.toggleDatePicker}
            onResetFilters={actions.resetFilters}
          />

          <BookingList
            bookings={filteredBookings || []}
            isLoading={isLoading}
            restaurantId={restaurantId}
            onSelectBooking={actions.setSelectedBooking}
            onUpdateStatus={handleUpdateStatus}
            onAssignTable={(bookingId) => actions.setTableAssignment(true, bookingId)}
            onSwitchTable={(bookingId, fromTableId, toTableId) =>
              bookingActions.switchTableMutation.mutate({ bookingId, fromTableId, toTableId })
            }
            onRemoveTable={(bookingId, tableId) =>
              bookingActions.removeTableAssignmentMutation.mutate({ bookingId, tableId })
            }
          />
          </TabsContent>

        </Tabs>
      </div>

      {/* Modals and Dialogs */}

      {/* Date picker dialog */}
      <Dialog open={state.showDatePicker} onOpenChange={actions.toggleDatePicker}>
        <DialogContent className="max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle>Select a date</DialogTitle>
            <DialogDescription>Choose a date to view bookings.</DialogDescription>
          </DialogHeader>
          <div className="p-2">
            <Calendar
              mode="single"
              selected={state.selectedDate}
              onSelect={(date) => {
                if (!date) return
                actions.setSelectedDate(date)
                actions.toggleDatePicker()
                actions.setDateRange("custom")
              }}
              className="rounded-md"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking Details Modal */}
      {state.selectedBooking && (
        <BookingDetails
          booking={state.selectedBooking}
          onClose={() => actions.setSelectedBooking(null)}
          onUpdate={(updates) => {
            if (updates.status && ['no_show', 'cancelled_by_restaurant'].includes(updates.status)) {
               handleUpdateStatus(state.selectedBooking!.id, updates.status)
               return
            }
            bookingActions.updateBookingMutation.mutate({
              bookingId: state.selectedBooking!.id,
              updates
            })
          }}
        />
      )}

      {/* Penalty Dialog */}
      <PenaltyDialog
        isOpen={penaltyDialog.isOpen}
        bookingId={penaltyDialog.bookingId}
        newStatus={penaltyDialog.newStatus}
        onClose={() => setPenaltyDialog(prev => ({ ...prev, isOpen: false }))}
        onSuccess={() => {
          bookingActions.updateBookingMutation.mutate({
             bookingId: penaltyDialog.bookingId!,
             updates: { status: penaltyDialog.newStatus as any }
          })
          bookingActions.handleRefresh()
          setPenaltyDialog(prev => ({ ...prev, isOpen: false }))
        }}
      />

      {/* Manual Booking Modal */}
      <Dialog open={state.showManualBooking} onOpenChange={actions.toggleManualBooking}>
        <DialogContent 
          className="max-w-4xl w-[95vw] h-[90vh] tablet:h-[95vh] flex flex-col p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex-shrink-0 px-4 tablet:px-4 py-4 border-b">
            <DialogHeader>
              <DialogTitle>Add Manual Booking</DialogTitle>
              <DialogDescription>
                Create a new booking manually for walk-ins or phone reservations
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-4 tablet:px-4 py-4">
            <ManualBookingForm
              restaurantId={restaurantId}
              onSubmit={(data) => bookingActions.createManualBookingMutation.mutate(data)}
              onCancel={actions.toggleManualBooking}
              isLoading={bookingActions.createManualBookingMutation.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

