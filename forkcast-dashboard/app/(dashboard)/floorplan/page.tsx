// app/(dashboard)/floorplan/page.tsx - Lovable-style Floorplan View
"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, isToday, differenceInMinutes, startOfDay, endOfDay, addDays, subDays } from 'date-fns'
import { useRestaurantContext } from '@/lib/contexts/restaurant-context'
import { useSidebar } from '@/lib/contexts/sidebar-context'
import { bookingAlarmService } from '@/lib/services/booking-alarm-service'
import { FloorplanCanvas } from '@/components/floorplan/floorplan-canvas'
import { FloorplanListView } from '@/components/floorplan/floorplan-list-view'
import { BookingsPanel } from '@/components/floorplan/bookings-panel'
import { TableDetailSheet } from '@/components/floorplan/table-detail-sheet'
import { BookingDetailsDrawer } from '@/components/floorplan/booking-details-drawer'
import { NewBookingModal } from '@/components/floorplan/new-booking-modal'
import { AssignModeBanner } from '@/components/floorplan/assign-mode-banner'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Plus, ChevronLeft, ChevronRight, Info, CalendarIcon, UserPlus, X, ArrowRight } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CapacityWarningDialog } from '@/components/floorplan/capacity-warning-dialog'
import { checkCapacityImpact, getSectionMaxCovers, type CapacityImpact } from '@/lib/section-capacity'
import type { RestaurantTable, Booking, RestaurantSection, RestaurantShift } from '@/types'
import {
  ACTIVE_BOOKING_STATUSES,
  SEATED_STATUSES,
  isSeatedStatus,
  isTerminalStatus,
  resolveGuestName,
  timeToMinutes,
  getTimerColor,
} from '@/lib/constants/floorplan'
import { useActiveRestaurantShifts } from '@/lib/hooks/use-restaurant-shifts'
import { clampTimeToShift, classifyBookingInShift } from '@/lib/utils/shifts'
import { computeTableProgress, type TableProgress } from '@/lib/utils/table-progress'
import { useTableCombinations } from '@/lib/hooks/use-table-combinations'
import type { ShiftBookingPill } from '@/components/floorplan/floorplan-table'

// Type definitions for floorplan
export type TableDisplayColor = 'green' | 'red' | 'orange' | 'grey' | 'yellow' | 'flashing-red' | 'reserved-upcoming'
export type SectionCapacity = { seated: number; booked: number; max: number }

/**
 * Check if assigning a booking to a table would conflict with existing bookings.
 * Returns the conflicting booking if found, or null if the table is available.
 * Uses the same symmetric turnover window as the floorplan display colors.
 */
function findTableConflict(
  tableId: string,
  booking: Booking,
  allBookings: Booking[],
  restaurantTurnoverTime: number
): Booking | null {
  const bookingTurnoverTime = booking.turn_time_minutes || restaurantTurnoverTime
  const bookingTime = new Date(booking.booking_time)
  const bookingStartMin = bookingTime.getHours() * 60 + bookingTime.getMinutes()

  const bookingDateStr = bookingTime.toISOString().slice(0, 10)

  for (const b of allBookings) {
    if (b.id === booking.id) continue
    if (isTerminalStatus(b.status)) continue
    const bTables = (b.tables?.map((bt: any) => bt.table?.id) || []) as string[]
    if (!bTables.includes(tableId)) continue

    // Skip bookings on different dates
    const bTime = new Date(b.booking_time)
    if (bTime.toISOString().slice(0, 10) !== bookingDateStr) continue

    // If the other booking is physically present (arrived or seated), it's always a conflict
    // Matches physicallyPresentStatuses in tableDisplayColors
    if (b.status === 'arrived' || isSeatedStatus(b.status)) return b

    // Check if the new booking starts before the existing booking's turnover ends,
    // AND the existing booking starts before the new booking's turnover ends.
    // Use <= for the boundary: if new booking starts exactly when old turnover ends, it's OK.
    const bStartMin = bTime.getHours() * 60 + bTime.getMinutes()
    const bTurnoverTime = b.turn_time_minutes || restaurantTurnoverTime
    // Existing booking occupies table from its start until start + turnover
    const bEndMin = bStartMin + bTurnoverTime
    // New booking occupies table from its start until start + turnover
    const bookingEndMin = bookingStartMin + bookingTurnoverTime
    // Conflict if ranges overlap (exclusive boundary — touching edges are fine)
    if (bookingStartMin < bEndMin && bStartMin < bookingEndMin) {
      return b
    }
  }
  return null
}

export default function FloorplanPage() {
  const router = useRouter()
  const pathname = usePathname()
  const { currentRestaurant, tier, hasFeature, isLoading: contextLoading } = useRestaurantContext()
  const { isCollapsed } = useSidebar()
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Determine view mode from pathname
  const getViewModeFromPath = () => {
    if (pathname === '/floorplan/list') return 'list'
    if (pathname === '/floorplan/tables') return 'canvas'
    return 'canvas' // default
  }

  // State
  const [restaurantId, setRestaurantId] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedTime, setSelectedTime] = useState(format(new Date(), 'HH:mm'))
  const [activeSection, setActiveSection] = useState<string>('all') // 'all' for list view, section ID for canvas view
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null)
  const [showDecor, setShowDecor] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'canvas' | 'list'>(getViewModeFromPath())

  // Update view mode when pathname changes
  useEffect(() => {
    const newViewMode = getViewModeFromPath()
    setViewMode(newViewMode)
  }, [pathname])

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [draggingBookingId, setDraggingBookingId] = useState<string | null>(null)
  const [assigningBookingId, setAssigningBookingId] = useState<string | null>(null)
  const [assignSelectedTableIds, setAssignSelectedTableIds] = useState<string[]>([])

  const [floorplanFocusTableIds, setFloorplanFocusTableIds] = useState<string[]>([])
  const [pendingAcceptAssignId, setPendingAcceptAssignId] = useState<string | null>(null)
  const [isBookingsPanelCollapsed, setIsBookingsPanelCollapsed] = useState(false)
  const [isMobileBookingsOpen, setIsMobileBookingsOpen] = useState(false)

  const [isTableSheetOpen, setIsTableSheetOpen] = useState(false)
  const [isBookingDrawerOpen, setIsBookingDrawerOpen] = useState(false)
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false)
  const [isWalkInMode, setIsWalkInMode] = useState(false)
  const [walkInTableId, setWalkInTableId] = useState<string | null>(null)
  const [isLegendExpanded, setIsLegendExpanded] = useState(false)
  const [isDateCalendarOpen, setIsDateCalendarOpen] = useState(false)
  const [isFabExpanded, setIsFabExpanded] = useState(false)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const capacityWarningBookingRef = useRef<string | null>(null)

  // When true, the auto-sync timer won't reset selectedTime to "now".
  // Set when the user navigates to a specific booking time (e.g. "View on Floorplan").
  // Cleared when the user explicitly clicks "Now".
  const userSetTimeRef = useRef(false)

  // Keep the displayed clock in sync when viewing today — refresh every minute.
  // Paused while a booking is being accepted/assigned so the floorplan shows
  // the booking's time instead of the current live time.
  // Also paused while tables are highlighted (e.g. after "View on Floorplan")
  // so the navigated-to booking time isn't immediately overwritten.
  useEffect(() => {
    const tick = () => setSelectedTime(format(new Date(), 'HH:mm'))
    // Don't auto-update time if we're assigning a booking, accepting one,
    // highlighting tables from a "go to floorplan" action, or the user
    // navigated to a specific booking time.
    if (
      isToday(selectedDate) &&
      !pendingAcceptAssignId &&
      !assigningBookingId &&
      floorplanFocusTableIds.length === 0 &&
      !userSetTimeRef.current
    ) {
      tick()
      const id = setInterval(tick, 60_000)
      return () => clearInterval(id)
    }
    return
  }, [selectedDate, pendingAcceptAssignId, assigningBookingId, floorplanFocusTableIds])

  // Full restaurant warning state (no tables / covers exceeded at time of accept)
  const [fullRestaurantWarning, setFullRestaurantWarning] = useState<{
    open: boolean
    reasons: string[]
    pendingAction: (() => void) | null
  }>({ open: false, reasons: [], pendingAction: null })

  // Section full warning state (no free tables in preferred section — offer alternatives)
  const [sectionFullWarning, setSectionFullWarning] = useState<{
    open: boolean
    sectionName: string
    sectionId: string
    partySize: number
    bookingId: string
    mode: 'accept' | 'assign' | 'accept-only'
    alternatives: { section: RestaurantSection; freeCount: number; totalCount: number }[]
  }>({ open: false, sectionName: '', sectionId: '', partySize: 0, bookingId: '', mode: 'accept', alternatives: [] })

  // Capacity warning state
  const [capacityWarning, setCapacityWarning] = useState<{
    open: boolean
    impact: CapacityImpact | null
    sectionName: string
    partySize: number
    pendingAction: (() => void) | null
  }>({ open: false, impact: null, sectionName: '', partySize: 0, pendingAction: null })

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')

  // Fetch active shifts for the restaurant
  const { data: shifts = [] } = useActiveRestaurantShifts(restaurantId, !!restaurantId)

  // Fetch defined table combinations for this restaurant.
  // Combinations are explicitly defined pairs of tables that may be assigned together,
  // each with their own combined max capacity. Tables are NOT combinable by default.
  const { data: tableCombinations = [] } = useTableCombinations(restaurantId || undefined)

  // Resolve the selected shift object
  const selectedShift = useMemo<RestaurantShift | null>(
    () => shifts.find((s) => s.id === selectedShiftId) ?? null,
    [shifts, selectedShiftId]
  )

  // Clear the selected shift if it becomes inactive or doesn't apply to the selected date
  useEffect(() => {
    if (!selectedShiftId) return
    if (!selectedShift) {
      setSelectedShiftId(null)
      return
    }
    const dayIdx = selectedDate.getDay()
    if (!selectedShift.applicable_days.includes(dayIdx)) {
      setSelectedShiftId(null)
    }
  }, [selectedShiftId, selectedShift, selectedDate])

  // Clamp selected time to shift window whenever a shift is selected.
  // Also release the userSetTimeRef latch when the shift is cleared so the
  // live-clock auto-sync can resume on today's view.
  useEffect(() => {
    if (!selectedShift) {
      // Shift cleared: if we're on today and the current time roughly matches
      // the live clock, unlatch so the minute-tick effect can take over again.
      if (isToday(selectedDate)) {
        const nowStr = format(new Date(), 'HH:mm')
        if (selectedTime === nowStr) userSetTimeRef.current = false
      }
      return
    }
    const clamped = clampTimeToShift(selectedTime, selectedShift)
    if (clamped !== selectedTime) {
      setSelectedTime(clamped)
      userSetTimeRef.current = true
    }
  }, [selectedShift, selectedTime, selectedDate])

  // Redirect users without floor_plan addon
  useEffect(() => {
    if (!hasFeature('floor_plan')) {
      router.replace('/bookings')
    }
  }, [hasFeature, tier, router])

  // Redirect /floorplan to /floorplan/tables (default view)
  useEffect(() => {
    if (pathname === '/floorplan') {
      router.replace('/floorplan/tables')
    }
  }, [pathname, router])

  // Set restaurant ID from context
  useEffect(() => {
    if (currentRestaurant) {
      setRestaurantId(currentRestaurant.restaurant.id)
      if (typeof window !== 'undefined' && console.debug) {
        console.debug('Floorplan restaurantId set:', currentRestaurant.restaurant.id)
      }
    }
  }, [currentRestaurant])

  // Cleanup highlight timer on unmount
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    }
  }, [])

  // Real-time subscription for instant multi-device sync
  useEffect(() => {
    if (!restaurantId) return
    const channel = supabase
      .channel(`floorplan-realtime-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['floorplan-bookings', restaurantId] })
          queryClient.invalidateQueries({ queryKey: ['pending-requests', restaurantId] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurant_tables', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['floorplan-tables', restaurantId] })
          queryClient.invalidateQueries({ queryKey: ['floorplan-bookings', restaurantId] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurant_shifts', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['restaurant-shifts', restaurantId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId, supabase, queryClient])

  // Fetch sections
  const { data: sections = [] } = useQuery({
    queryKey: ['floorplan-sections', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from('restaurant_sections')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      if (error) throw error
      return data as RestaurantSection[]
    },
    enabled: !!restaurantId,
    refetchOnWindowFocus: true,
  })

  // Set default section for canvas view (when not in list view)
  useEffect(() => {
    if (viewMode === 'canvas' && sections.length > 0) {
      // If activeSection is 'all' or not a valid section, set to first section
      if (activeSection === 'all' || !sections.find(s => s.id === activeSection)) {
        setActiveSection(sections[0].id)
      }
    }
  }, [viewMode, sections, activeSection])

  // Fetch tables
  const { data: tables = [], refetch: refetchTables } = useQuery({
    queryKey: ['floorplan-tables', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('*, section:restaurant_sections(*)')
        .eq('restaurant_id', restaurantId)
        .order('table_number', { ascending: true })
      if (error) throw error
      return data as RestaurantTable[]
    },
    enabled: !!restaurantId,
    refetchOnWindowFocus: true,
  })

  // Fetch bookings for selected date
  const { data: bookings = [], refetch: refetchBookings } = useQuery({
    queryKey: ['floorplan-bookings', restaurantId, selectedDateStr],
    queryFn: async () => {
      if (!restaurantId) return []
      const dayStart = startOfDay(selectedDate)
      const dayEnd = endOfDay(selectedDate)
      
      const res = await supabase
        .from('bookings')
        .select(`
          *,
          tables:booking_tables(table:restaurant_tables(*)),
          user:profiles!bookings_user_id_fkey(id, full_name, phone_number, email, avatar_url)
        `)
        .eq('restaurant_id', restaurantId)
        .gte('booking_time', dayStart.toISOString())
        .lte('booking_time', dayEnd.toISOString())
        // Use unquoted list for PostgREST `in` operator to avoid encoding issues
        .not('status', 'in', '(cancelled_by_user,declined_by_restaurant,auto_declined)')
        .order('booking_time', { ascending: true })

      if (typeof window !== 'undefined' && console.debug) {
        console.debug('Supabase bookings response:', { restaurantId, selectedDate: selectedDateStr, res })
      }

      const { data, error } = res
      if (error) {
        if (typeof window !== 'undefined') {
          console.error('Bookings query error:', error)
        }
        throw error
      }
      return data as Booking[]
    },
    enabled: !!restaurantId,
    refetchInterval: 8_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 4_000,
  })

  // Fetch pending requests across future dates (including today future times)
  const { data: pendingAcrossDates = [], refetch: refetchPendingAcross } = useQuery({
    queryKey: ['pending-requests', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      const res = await supabase
        .from('bookings')
        .select(`
          *,
          tables:booking_tables(table:restaurant_tables(*)),
          user:profiles!bookings_user_id_fkey(id, full_name, phone_number, email, avatar_url)
        `)
        .eq('restaurant_id', restaurantId)
        .gte('booking_time', new Date().toISOString())
        .not('status', 'in', '(confirmed,seated,arrived,ordered,appetizers,main_course,dessert,payment,cancelled_by_user,declined_by_restaurant,auto_declined)')
        .order('booking_time', { ascending: true })

      const { data, error } = res
      if (error) {
        if (typeof window !== 'undefined') console.error('Pending requests query error:', error)
        throw error
      }
      return data as Booking[]
    },
    enabled: !!restaurantId,
    refetchInterval: 8_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 4_000,
  })

  // Compute table display colors based on bookings
  const { tableDisplayColors, tableUpcomingReservations, tableLateArrivals, filteredTables } = useMemo(() => {
    const selectedTimeMinutes = timeToMinutes(selectedTime)
    const colors: Record<string, TableDisplayColor> = {}
    const upcomingRes: Record<string, boolean> = {}
    const lateArrivals: Record<string, boolean> = {}

    const now = new Date()
    const [selHours, selMins] = selectedTime.split(':').map(Number)
    const selectedDateTime = new Date(selectedDate)
    selectedDateTime.setHours(selHours, selMins, 0, 0)

    // Filter tables by section
    const sectionFilteredTables = activeSection === 'all' 
      ? tables 
      : tables.filter(t => t.section_id === activeSection)

    for (const table of sectionFilteredTables) {
      // Blocked/inactive tables
      if (!table.is_active) {
        colors[table.id] = 'grey'
        continue
      }

      // Find bookings for this table on the selected date
      // Exclude pending requests — they haven't been accepted yet and shouldn't affect table state
      const tableBookings = bookings.filter(b => {
        const bookingTables = b.tables?.map((bt: any) => bt.table?.id) || []
        return bookingTables.includes(table.id) && !isTerminalStatus(b.status) && b.status !== 'pending'
      })

      // Find booking that covers the selected time — OR is physically present (arrived/seated early)
      const physicallyPresentStatuses = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment']
      const restaurantTurnoverTime = currentRestaurant?.restaurant?.table_turnover_minutes || 90
      
      const activeBooking = tableBookings.find(b => {
        // If the guest is already physically present, treat as active regardless of time
        if (physicallyPresentStatuses.includes(b.status)) return true
        
        const bookingTime = new Date(b.booking_time)
        const bookingHours = bookingTime.getHours()
        const bookingMins = bookingTime.getMinutes()
        const bookingStartMin = bookingHours * 60 + bookingMins
        
        // Use booking's turn_time_minutes if available, otherwise fall back to restaurant's table_turnover_minutes
        const bookingTurnoverTime = b.turn_time_minutes || restaurantTurnoverTime
        
        // Forward-only turnover: table occupied from booking_time to booking_time + turnover
        const unavailableEndMin = bookingStartMin + bookingTurnoverTime
        
        return selectedTimeMinutes >= bookingStartMin && selectedTimeMinutes < unavailableEndMin
      })

      if (activeBooking) {
          // Check if physically present but past the turnover window — show green
          const abTime = new Date(activeBooking.booking_time)
          const abStartMin = abTime.getHours() * 60 + abTime.getMinutes()
          const abTurnover = activeBooking.turn_time_minutes || restaurantTurnoverTime
          const abEndMin = abStartMin + abTurnover
          const isPhysicallyPresent = physicallyPresentStatuses.includes(activeBooking.status)

          if (isPhysicallyPresent && selectedTimeMinutes >= abEndMin) {
            // Seated but past turnover — table is available for future bookings
            colors[table.id] = 'green'
          } else {
            colors[table.id] = 'red'
          }
          // Check if late arrival (confirmed + past time, today only)
          if (isToday(selectedDate) && activeBooking.status === 'confirmed') {
            const bookingTime = new Date(activeBooking.booking_time)
            if (bookingTime < now) {
              lateArrivals[table.id] = true
            }
          }
        continue
      }

      // Check for upcoming reservation (starts after selected time, within next 60 min)
      // But only if its turnover window doesn't already overlap selected time (that's handled above as red)
      const upcomingBooking = tableBookings.find(b => {
        if (b.status === 'pending') return false
        const bookingTime = new Date(b.booking_time)
        const bookingHours = bookingTime.getHours()
        const bookingMins = bookingTime.getMinutes()
        const startMin = bookingHours * 60 + bookingMins
        return startMin > selectedTimeMinutes && startMin <= selectedTimeMinutes + 60
      })

      if (upcomingBooking) {
        upcomingRes[table.id] = true
        colors[table.id] = 'orange'
        continue
      }

      colors[table.id] = 'green'
    }

    return { 
      tableDisplayColors: colors, 
      tableUpcomingReservations: upcomingRes, 
      tableLateArrivals: lateArrivals,
      filteredTables: sectionFilteredTables 
    }
  }, [tables, bookings, selectedDateStr, selectedTime, selectedDate, activeSection, currentRestaurant])

  // Per-table progress (elapsed → expected end) for the currently-seated booking.
  // Computed at the selected time so it's consistent with the rest of the snapshot view.
  const tableProgress = useMemo(() => {
    const selectedTimeMinutes = timeToMinutes(selectedTime)
    const fallbackTurnover = currentRestaurant?.restaurant?.table_turnover_minutes || 90
    const map: Record<string, TableProgress | null> = {}

    // Group seated/arrived bookings by tableId, then pick the most recent one per table
    const bookingsByTable: Record<string, Booking> = {}
    for (const b of bookings) {
      if (!isSeatedStatus(b.status) && b.status !== 'arrived') continue
      const tableIds: string[] = (b.tables?.map((bt: any) => bt.table?.id).filter(Boolean) || [])
      const startTs = new Date(b.seated_at || b.checked_in_at || b.booking_time).getTime()
      for (const tid of tableIds) {
        const existing = bookingsByTable[tid]
        if (!existing) {
          bookingsByTable[tid] = b
        } else {
          const existingTs = new Date(
            existing.seated_at || existing.checked_in_at || existing.booking_time
          ).getTime()
          if (startTs > existingTs) bookingsByTable[tid] = b
        }
      }
    }

    for (const [tid, booking] of Object.entries(bookingsByTable)) {
      map[tid] = computeTableProgress(booking, selectedDate, selectedTimeMinutes, fallbackTurnover)
    }

    return map
  }, [bookings, selectedTime, selectedDate, currentRestaurant])

  // Compute shift-aware pills and per-table bookings when a shift is active.
  // Includes boundary bookings (those that span into/out of the shift window).
  // Excludes pending bookings (they haven't been accepted).
  const restaurantTurnover = currentRestaurant?.restaurant?.table_turnover_minutes || 90
  const { tableShiftPills, tableShiftBookingsMap } = useMemo(() => {
    if (!selectedShift) return { tableShiftPills: {} as Record<string, ShiftBookingPill[]>, tableShiftBookingsMap: {} as Record<string, Booking[]> }

    const pills: Record<string, ShiftBookingPill[]> = {}
    const bookingsByTable: Record<string, Booking[]> = {}

    for (const booking of bookings) {
      if (isTerminalStatus(booking.status)) continue
      if (booking.status === 'pending') continue
      const klass = classifyBookingInShift(booking, selectedShift, restaurantTurnover)
      if (klass === 'outside') continue

      const tableIds: string[] = (booking.tables?.map((bt: any) => bt.table?.id).filter(Boolean) || [])
      if (tableIds.length === 0) continue

      const bTime = new Date(booking.booking_time)
      const pill: ShiftBookingPill = {
        bookingId: booking.id,
        time: `${String(bTime.getHours()).padStart(2, '0')}:${String(bTime.getMinutes()).padStart(2, '0')}`,
        status: booking.status,
        classification: klass,
      }

      for (const tid of tableIds) {
        if (!pills[tid]) pills[tid] = []
        pills[tid].push(pill)
        if (!bookingsByTable[tid]) bookingsByTable[tid] = []
        bookingsByTable[tid].push(booking)
      }
    }

    // Sort pills by start time
    for (const tid of Object.keys(pills)) {
      pills[tid].sort((a, b) => a.time.localeCompare(b.time))
      bookingsByTable[tid].sort(
        (a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime()
      )
    }

    return { tableShiftPills: pills, tableShiftBookingsMap: bookingsByTable }
  }, [selectedShift, bookings, restaurantTurnover])

  // Selected table and booking
  const selectedTable = useMemo(
    () => tables.find(t => t.id === selectedTableId) || null,
    [tables, selectedTableId]
  )

  const selectedBooking = useMemo(
    () => bookings.find(b => b.id === selectedBookingId) || null,
    [bookings, selectedBookingId]
  )

  // Compute section capacities for display on canvas tabs
  // Split into "seated" (physically present) vs "booked" (confirmed, not yet arrived)
  const restaurantTurnoverTime = currentRestaurant?.restaurant?.table_turnover_minutes || 90
  const sectionCapacities = useMemo(() => {
    const caps: Record<string, { seated: number; booked: number; max: number }> = {}
    const selectedTimeMinutes = timeToMinutes(selectedTime)

    // Statuses where the guest is physically in the restaurant (arrived + all dining statuses)
    const physicallyPresentStatuses: readonly string[] = ['arrived', ...SEATED_STATUSES]

    for (const section of sections) {
      const { maxCovers } = getSectionMaxCovers(section, tables)

      const sectionTables = tables.filter(t => t.section_id === section.id)
      const sectionTableIds = new Set(sectionTables.map(t => t.id))

      let seatedCovers = 0
      let bookedCovers = 0
      const countedBookings = new Set<string>()

      for (const b of bookings) {
        if (countedBookings.has(b.id)) continue
        if (isTerminalStatus(b.status) || b.status === 'pending') continue

        const bTableIds = b.tables?.map((bt: any) => bt.table?.id).filter(Boolean) || []
        const isInSection = bTableIds.some((id: string) => sectionTableIds.has(id))
        if (!isInSection) continue

        // Check time overlap — forward-only: booking_time to booking_time + turnover
        const bookingTime = new Date(b.booking_time)
        const bookingStartMin = bookingTime.getHours() * 60 + bookingTime.getMinutes()
        const bookingTurnoverTime = b.turn_time_minutes || restaurantTurnoverTime
        const unavailableEndMin = bookingStartMin + bookingTurnoverTime
        if (selectedTimeMinutes >= bookingStartMin && selectedTimeMinutes < unavailableEndMin) {
          const covers = b.party_size || 1
          if (physicallyPresentStatuses.includes(b.status)) {
            seatedCovers += covers
          } else if (b.status === 'confirmed') {
            bookedCovers += covers
          }
          countedBookings.add(b.id)
        }
      }

      caps[section.id] = { seated: seatedCovers, booked: bookedCovers, max: maxCovers }
    }

    return caps
  }, [sections, tables, bookings, selectedTime, restaurantTurnoverTime])

  // Get booking assigned to selected table
  // Uses same time window logic as tableDisplayColors to avoid mismatch between
  // a red-colored table and the "assigned booking" detail sheet showing nothing
  const assignedBookingForTable = useMemo(() => {
    if (!selectedTable) return null
    const restaurantTurnoverTime = currentRestaurant?.restaurant?.table_turnover_minutes || 90
    const selectedTimeMinutes = timeToMinutes(selectedTime)
    const physicallyPresentStatuses = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment']

    return bookings.find(b => {
      const bookingTables = b.tables?.map((bt: any) => bt.table?.id) || []
      const isAssigned = bookingTables.includes(selectedTable.id)
      const isActive = (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(b.status)

      if (!isAssigned || !isActive) return false

      // If guest is physically present, always show as assigned
      if (physicallyPresentStatuses.includes(b.status)) return true

      // Check if booking covers the selected time — forward-only window matching tableDisplayColors
      const bookingTime = new Date(b.booking_time)
      const bookingStartMin = bookingTime.getHours() * 60 + bookingTime.getMinutes()
      const bookingTurnoverTime = b.turn_time_minutes || restaurantTurnoverTime
      const unavailableEndMin = bookingStartMin + bookingTurnoverTime
      return selectedTimeMinutes >= bookingStartMin && selectedTimeMinutes < unavailableEndMin
    }) || null
  }, [selectedTable, bookings, selectedTime, currentRestaurant])

  // Get upcoming bookings for selected table
  const upcomingBookingsForTable = useMemo(() => {
    if (!selectedTable) return []
    return bookings.filter(b => {
      const bookingTables = b.tables?.map((bt: any) => bt.table?.id) || []
      return bookingTables.includes(selectedTable.id) &&
             ['confirmed', 'arrived'].includes(b.status)
    }).sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
  }, [selectedTable, bookings])

  // Suggested tables for selected booking
  const suggestedTables = useMemo(() => {
    if (!selectedBooking) return []
    const restaurantTurnoverTime = currentRestaurant?.restaurant?.table_turnover_minutes || 90

    return filteredTables
      .filter(t => {
        if (!t.is_active) return false
        // Use shared conflict check — includes arrived/seated short-circuit + turnover overlap
        return !findTableConflict(t.id, selectedBooking, bookings, restaurantTurnoverTime)
      })
      .sort((a, b) => {
        // Prefer exact fits (min <= partySize <= max) first
        const aMin = a.min_capacity || 1
        const bMin = b.min_capacity || 1
        const aIsExactFit = aMin <= selectedBooking.party_size && a.max_capacity >= selectedBooking.party_size
        const bIsExactFit = bMin <= selectedBooking.party_size && b.max_capacity >= selectedBooking.party_size
        
        if (aIsExactFit && !bIsExactFit) return -1
        if (!aIsExactFit && bIsExactFit) return 1
        
        // For same fit type, sort by how close to party size (smallest waste)
        return (a.max_capacity - selectedBooking.party_size) - (b.max_capacity - selectedBooking.party_size)
      })
  }, [selectedBooking, filteredTables, bookings, currentRestaurant])

  const highlightedTableIds = useMemo(() => suggestedTables.map(t => t.id), [suggestedTables])

  // Best-fit table for selected booking (first suggestion)
  const recommendedTableId = useMemo(() => suggestedTables.length > 0 ? suggestedTables[0].id : null, [suggestedTables])

  // Build a map of table ID -> guest name for seated/arrived bookings only (shown on canvas tables)
  const tableGuestNames = useMemo(() => {
    const names: Record<string, string> = {}
    for (const b of bookings) {
      if (isTerminalStatus(b.status) || b.status === 'pending') continue
      // Only show guest name if they're physically present (arrived or seated)
      if (b.status !== 'arrived' && !isSeatedStatus(b.status)) continue
      const guestName = resolveGuestName(b)
      const tableIds = b.tables?.map((bt: any) => bt.table?.id).filter(Boolean) || []
      for (const tid of tableIds) {
        names[tid as string] = guestName
      }
    }
    return names
  }, [bookings])

  // Handlers

  const handleSelectBooking = useCallback((bookingId: string | null) => {
    setSelectedBookingId(bookingId)
    setFloorplanFocusTableIds([])
    if (bookingId) {
      const booking = [...bookings, ...pendingAcrossDates].find(b => b.id === bookingId)
      if (booking && booking.status === 'pending') {
        // Sync floorplan to booking's date and time
        const bookingTime = new Date(booking.booking_time)
        setSelectedDate(bookingTime)
        setSelectedTime(format(bookingTime, 'HH:mm'))
        setSelectedTableId(null)
      } else {
        setIsBookingDrawerOpen(true)
        setSelectedTableId(null)
      }
    }
  }, [bookings, pendingAcrossDates])

  const handleNow = useCallback(() => {
    // "Now" always takes priority: clear any active shift filter so the time
    // isn't clamped back into the shift window.
    setSelectedShiftId(null)
    userSetTimeRef.current = false
    setSelectedDate(new Date())
    setSelectedTime(format(new Date(), 'HH:mm'))
  }, [])

  const handleAddWalkIn = useCallback(() => {
    setIsWalkInMode(true)
    setWalkInTableId(null)
    setIsNewBookingModalOpen(true)
  }, [])

  const handleAddToWaitlist = useCallback(() => {
    toast('Waitlist feature coming soon', { icon: 'ℹ️' })
  }, [])

  // Accept & Assign step 1: do the actual DB confirm + open drawer
  const doAcceptBooking = useCallback(async (bookingId: string) => {
    const staffId = currentRestaurant?.id
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        updated_at: now,
      })
      .eq('id', bookingId)

    if (error) {
      toast.error('Failed to accept booking')
      console.error(error)
      return
    }

    // Stop alarm immediately on accept (booking left pending state)
    bookingAlarmService.stopAlarm(bookingId)

    // Write audit trail
    if (staffId) {
      supabase.from('booking_history').insert({
        booking_id: bookingId,
        previous_status: 'pending',
        new_status: 'confirmed',
        changed_by: staffId,
        changed_at: now,
        notes: 'Booking accepted by staff via floorplan',
      }).then(({ error: histErr }) => {
        if (histErr) console.error('Failed to write booking history:', histErr)
      })
    }

    await queryClient.invalidateQueries({ queryKey: ['floorplan-bookings', restaurantId] })
    await queryClient.invalidateQueries({ queryKey: ['pending-requests', restaurantId] })

    const booking = [...bookings, ...pendingAcrossDates].find(b => b.id === bookingId)
    if (booking) {
      const bookingTime = new Date(booking.booking_time)
      setSelectedDate(bookingTime)
      setSelectedTime(format(bookingTime, 'HH:mm'))
      if (booking.preferred_section) {
        const matchingSection = sections.find(s => s.name === booking.preferred_section)
        if (matchingSection) setActiveSection(matchingSection.id)
      }
    }

    setPendingAcceptAssignId(bookingId)
    // Enter assign mode directly — same flow as clicking "Assign" on a booking
    setAssigningBookingId(bookingId)
    setAssignSelectedTableIds([])
    toast.success('Booking accepted — tap a table or use Auto Assign')
  }, [supabase, bookings, pendingAcrossDates, sections, refetchBookings, refetchPendingAcross, queryClient, restaurantId, currentRestaurant])

  // Accept the booking and switch to an alternative section for assignment
  const doAcceptToSection = useCallback(async (bookingId: string, sectionId: string) => {
    // Update booking's section_id to the alternative section
    await supabase
      .from('bookings')
      .update({ section_id: sectionId })
      .eq('id', bookingId)

    // Accept and enter assign mode
    await doAcceptBooking(bookingId)

    // Switch canvas to the alternative section
    setActiveSection(sectionId)
    const sectionName = sections.find(s => s.id === sectionId)?.name || 'section'
    toast.success(`Booking moved to ${sectionName} — tap a table to assign`)
  }, [doAcceptBooking, supabase, sections])

  // Accept & Assign step 2: check table availability first, then call doAcceptBooking
  const handleAcceptAndAssign = useCallback(async (bookingId: string) => {
    const bookingToAccept = [...bookings, ...pendingAcrossDates].find(b => b.id === bookingId)
    if (!bookingToAccept) {
      await doAcceptBooking(bookingId)
      return
    }

    const restaurantTurnoverTime = currentRestaurant?.restaurant?.table_turnover_minutes || 90
    const bookingTurnoverTime = bookingToAccept.turn_time_minutes || restaurantTurnoverTime
    const bookingTime = new Date(bookingToAccept.booking_time)
    const bookingStartMin = bookingTime.getHours() * 60 + bookingTime.getMinutes()
    const unavailableStartMin = bookingStartMin - bookingTurnoverTime + 1
    const unavailableEndMin = bookingStartMin + bookingTurnoverTime
    const partySize = bookingToAccept.party_size || 1
    const bookingDateStr = format(bookingTime, 'yyyy-MM-dd')

    // Build set of occupied table IDs during the booking's time window
    const allBookingsToCheck = [...bookings, ...pendingAcrossDates]
    const occupiedTableIds = new Set<string>()
    for (const b of allBookingsToCheck) {
      if (b.id === bookingId) continue
      if (isTerminalStatus(b.status)) continue
      if (b.status === 'pending') continue
      if (format(new Date(b.booking_time), 'yyyy-MM-dd') !== bookingDateStr) continue
      const bStart = new Date(b.booking_time)
      const bStartMin = bStart.getHours() * 60 + bStart.getMinutes()
      const bTurnoverTime = b.turn_time_minutes || restaurantTurnoverTime
      const bUnavailableStartMin = bStartMin - bTurnoverTime + 1
      const bUnavailableEndMin = bStartMin + bTurnoverTime
      if (unavailableStartMin < bUnavailableEndMin && unavailableEndMin > bUnavailableStartMin) {
        const bTableIds = b.tables?.map((bt: any) => bt.table?.id).filter(Boolean) || []
        bTableIds.forEach((id: string) => occupiedTableIds.add(id))
      }
    }

    // Helper: count free tables in a section that can fit the party
    const getFreeTables = (sectionId: string) =>
      tables.filter(t =>
        t.section_id === sectionId &&
        t.is_active !== false &&
        !occupiedTableIds.has(t.id) &&
        t.max_capacity >= partySize
      )

    // Check preferred section for free tables
    // Try: booking's section_id → preferred_section as ID → preferred_section as name → active canvas section
    const preferredSectionId = bookingToAccept.section_id ||
      sections.find(s => s.id === bookingToAccept.preferred_section)?.id ||
      sections.find(s => s.name === bookingToAccept.preferred_section)?.id ||
      (activeSection !== 'all' ? activeSection : null)

    if (preferredSectionId) {
      const freeInSection = getFreeTables(preferredSectionId)
      if (freeInSection.length === 0) {
        // No free tables in this section — find alternatives
        const sectionName = sections.find(s => s.id === preferredSectionId)?.name || 'Section'
        const alternatives = sections
          .filter(s => s.id !== preferredSectionId && s.is_active)
          .map(s => {
            const free = getFreeTables(s.id)
            const allSectionTables = tables.filter(t => t.section_id === s.id && t.is_active !== false)
            return { section: s, freeCount: free.length, totalCount: allSectionTables.length }
          })
          .filter(a => a.freeCount > 0)
          .sort((a, b) => b.freeCount - a.freeCount)

        setSectionFullWarning({
          open: true,
          sectionName,
          sectionId: preferredSectionId,
          partySize,
          bookingId,
          mode: 'accept',
          alternatives,
        })
        return
      }
    }

    // Check overall restaurant — any free tables at all?
    const allFreeTables = tables.filter(t =>
      t.is_active !== false &&
      !occupiedTableIds.has(t.id) &&
      t.max_capacity >= partySize
    )

    if (allFreeTables.length === 0) {
      setFullRestaurantWarning({
        open: true,
        reasons: [`No available tables for a party of ${partySize} at ${format(bookingTime, 'h:mm a')}`],
        pendingAction: () => { doAcceptBooking(bookingId) }
      })
      return
    }

    await doAcceptBooking(bookingId)
  }, [doAcceptBooking, doAcceptToSection, bookings, pendingAcrossDates, tables, sections, currentRestaurant, restaurantId, activeSection])

  // Status update mutation
  const updateBookingStatus = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string, status: string }) => {
      const updates: any = { status }
      if (status === 'seated') {
        // Store actual UTC timestamp — Postgres `timestamp with time zone` handles conversion natively
        const now = new Date().toISOString()
        updates.seated_at = now
        updates.booking_time = now
      } else if (status === 'completed') {
        updates.actual_end_time = new Date().toISOString()
      }

      const { error } = await supabase
        .from('bookings')
        .update(updates)
        .eq('id', bookingId)

      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      // Stop alarm immediately when a pending booking transitions to a non-pending state.
      // Without this, the alarm only stops via the watcher's reconciliation loop after
      // the realtime event fires (sub-second but not instant).
      if (variables.status !== 'pending') {
        bookingAlarmService.stopAlarm(variables.bookingId)
      }
      queryClient.invalidateQueries({ queryKey: ['floorplan-bookings', restaurantId] })
      queryClient.invalidateQueries({ queryKey: ['pending-requests', restaurantId] })
      toast.success('Booking status updated')
    },
    onError: (error) => {
      toast.error('Failed to update booking status')
      console.error(error)
    }
  })

  const handleUpdateBookingStatus = useCallback((status: string) => {
    if (!selectedBookingId) return
    updateBookingStatus.mutate({ bookingId: selectedBookingId, status })
  }, [selectedBookingId, updateBookingStatus])

  const handleUpdateBookingStatusById = useCallback((bookingId: string, status: string) => {
    updateBookingStatus.mutate({ bookingId, status })
  }, [updateBookingStatus])

  // Accept only (no assign mode) — checks section availability first
  const handleAcceptBooking = useCallback(async (bookingId: string) => {
    const bookingToAccept = [...bookings, ...pendingAcrossDates].find(b => b.id === bookingId)
    if (!bookingToAccept) {
      updateBookingStatus.mutate({ bookingId, status: 'confirmed' })
      return
    }

    const restaurantTurnoverTime = currentRestaurant?.restaurant?.table_turnover_minutes || 90
    const bookingTurnoverTime = bookingToAccept.turn_time_minutes || restaurantTurnoverTime
    const bookingTime = new Date(bookingToAccept.booking_time)
    const bookingStartMin = bookingTime.getHours() * 60 + bookingTime.getMinutes()
    const unavailableStartMin = bookingStartMin - bookingTurnoverTime + 1
    const unavailableEndMin = bookingStartMin + bookingTurnoverTime
    const partySize = bookingToAccept.party_size || 1
    const bookingDateStr = format(bookingTime, 'yyyy-MM-dd')

    const allBookingsToCheck = [...bookings, ...pendingAcrossDates]
    const occupiedTableIds = new Set<string>()
    for (const b of allBookingsToCheck) {
      if (b.id === bookingId) continue
      if (isTerminalStatus(b.status)) continue
      if (b.status === 'pending') continue
      if (format(new Date(b.booking_time), 'yyyy-MM-dd') !== bookingDateStr) continue
      const bStart = new Date(b.booking_time)
      const bStartMin = bStart.getHours() * 60 + bStart.getMinutes()
      const bTurnoverTime = b.turn_time_minutes || restaurantTurnoverTime
      const bUnavailableStartMin = bStartMin - bTurnoverTime + 1
      const bUnavailableEndMin = bStartMin + bTurnoverTime
      if (unavailableStartMin < bUnavailableEndMin && unavailableEndMin > bUnavailableStartMin) {
        const bTableIds = b.tables?.map((bt: any) => bt.table?.id).filter(Boolean) || []
        bTableIds.forEach((id: string) => occupiedTableIds.add(id))
      }
    }

    const getFreeTables = (sectionId: string) =>
      tables.filter(t =>
        t.section_id === sectionId &&
        t.is_active !== false &&
        !occupiedTableIds.has(t.id) &&
        t.max_capacity >= partySize
      )

    const preferredSectionId = bookingToAccept.section_id ||
      sections.find(s => s.id === bookingToAccept.preferred_section)?.id ||
      sections.find(s => s.name === bookingToAccept.preferred_section)?.id ||
      (activeSection !== 'all' ? activeSection : null)

    if (preferredSectionId) {
      const freeInSection = getFreeTables(preferredSectionId)
      if (freeInSection.length === 0) {
        const sectionName = sections.find(s => s.id === preferredSectionId)?.name || 'Section'
        const alternatives = sections
          .filter(s => s.id !== preferredSectionId && s.is_active)
          .map(s => {
            const free = getFreeTables(s.id)
            const allSectionTables = tables.filter(t => t.section_id === s.id && t.is_active !== false)
            return { section: s, freeCount: free.length, totalCount: allSectionTables.length }
          })
          .filter(a => a.freeCount > 0)
          .sort((a, b) => b.freeCount - a.freeCount)

        setSectionFullWarning({
          open: true,
          sectionName,
          sectionId: preferredSectionId,
          partySize,
          bookingId,
          mode: 'accept-only',
          alternatives,
        })
        return
      }
    }

    updateBookingStatus.mutate({ bookingId, status: 'confirmed' })
  }, [bookings, pendingAcrossDates, tables, sections, currentRestaurant, activeSection, updateBookingStatus])

  // Toggle table active/disabled
  const handleToggleTableActive = useCallback(async (tableId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('restaurant_tables')
      .update({ is_active: isActive })
      .eq('id', tableId)
    if (error) {
      toast.error('Failed to update table')
      console.error(error)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['floorplan-tables', restaurantId] })
    toast.success(isActive ? 'Table enabled' : 'Table disabled')
  }, [supabase, queryClient, restaurantId])

  // Table assignment mutation — supports single or multiple tables (merging)
  const assignTableMutation = useMutation({
    mutationFn: async ({ bookingId, tableIds, addToExisting }: { bookingId: string, tableIds: string[], addToExisting?: boolean }) => {
      if (!addToExisting) {
        // Remove existing table assignments first
        const { error: deleteError } = await supabase
          .from('booking_tables')
          .delete()
          .eq('booking_id', bookingId)
        if (deleteError) throw deleteError
      }

      // Insert all table assignments
      const rows = tableIds.map(tableId => ({ booking_id: bookingId, table_id: tableId }))
      const { error } = await supabase
        .from('booking_tables')
        .insert(rows)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floorplan-bookings', restaurantId] })
      queryClient.invalidateQueries({ queryKey: ['pending-requests', restaurantId] })
      toast.success('Table assigned successfully')
    },
    onError: (error) => {
      toast.error('Failed to assign table')
      console.error(error)
    }
  })

  // Unassign table mutation
  const unassignTableMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from('booking_tables')
        .delete()
        .eq('booking_id', bookingId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floorplan-bookings', restaurantId] })
      queryClient.invalidateQueries({ queryKey: ['pending-requests', restaurantId] })
      toast.success('Table unassigned')
    },
    onError: (error) => {
      toast.error('Failed to unassign table')
      console.error(error)
    }
  })



  const handleDropBookingOnTable = useCallback(async (tableId: string) => {
    const bookingId = draggingBookingId || selectedBookingId
    if (!bookingId) return

    const booking = bookings.find(b => b.id === bookingId)
    const table = tables.find(t => t.id === tableId)

    if (!booking || !table) return

    // Block assignment to inactive/blocked tables
    if (!table.is_active) {
      toast.error(`Table ${table.table_number} is inactive and cannot be assigned`)
      setDraggingBookingId(null)
      return
    }

    // Block assignment if table has a turnover conflict (occupied or upcoming reservation overlap)
    const restaurantTurnoverTime = currentRestaurant?.restaurant?.table_turnover_minutes || 90
    const conflict = findTableConflict(tableId, booking, bookings, restaurantTurnoverTime)
    if (conflict) {
      const conflictName = resolveGuestName(conflict)
      if (conflict.status === 'arrived' || isSeatedStatus(conflict.status)) {
        toast.error(`Table ${table.table_number} is currently occupied by ${conflictName}`)
      } else {
        const conflictTime = format(new Date(conflict.booking_time), 'HH:mm')
        toast.error(`Table ${table.table_number} has a reservation at ${conflictTime} (${conflictName}) — turnover conflict`)
      }
      setDraggingBookingId(null)
      return
    }

    // Check if booking already has tables assigned — if so, add to existing (merge)
    const existingTableIds = (booking.tables?.map((bt: any) => bt.table?.id).filter(Boolean) || []) as string[]
    const isAlreadyAssigned = existingTableIds.includes(tableId)
    if (isAlreadyAssigned) {
      toast.error(`Table ${table.table_number} is already assigned to this booking`)
      return
    }

    const addToExisting = existingTableIds.length > 0
    // For new assignment (no existing tables), check if table is suitable
    // If too small, assign anyway so the user can merge additional tables via subsequent drags
    let needsMerge = false
    if (!addToExisting) {
      const canAccommodate = table.max_capacity >= booking.party_size
      if (!canAccommodate) {
        needsMerge = true
      }
    }

    // When merging into a booking with an existing table, validate that
    // the resulting table set forms a defined combination.
    if (addToExisting) {
      if (existingTableIds.length >= 2) {
        toast.error('Only pairs of tables can be combined.')
        setDraggingBookingId(null)
        return
      }
      const otherId = existingTableIds[0]
      const combo = tableCombinations.find((c: any) =>
        (c.primary_table_id === otherId && c.secondary_table_id === tableId) ||
        (c.primary_table_id === tableId && c.secondary_table_id === otherId)
      )
      if (!combo) {
        const tA = tables.find(t => t.id === otherId)?.table_number
        toast.error(`Table ${table.table_number} cannot be combined with T${tA}. Define this combination in the section editor first.`)
        setDraggingBookingId(null)
        return
      }
      if (booking.party_size > combo.combined_capacity) {
        toast.error(`Party of ${booking.party_size} exceeds the combined max of ${combo.combined_capacity}.`)
        setDraggingBookingId(null)
        return
      }
    }

    // Check section capacity before assigning (skip for merges — same party, no new guests)
    if (table.section_id && !addToExisting) {
      try {
        const bookingTime = new Date(booking.booking_time)
        const timeSlot = `${bookingTime.getHours().toString().padStart(2, '0')}:${bookingTime.getMinutes().toString().padStart(2, '0')}`
        const impact = await checkCapacityImpact(
          table.section_id,
          booking.party_size,
          bookingTime,
          timeSlot,
          restaurantId,
          sections,
          tables
        )

        if (impact.wouldExceed || impact.afterPercentage > 90) {
          const sectionName = sections.find(s => s.id === table.section_id)?.name || 'Section'
          setCapacityWarning({
            open: true,
            impact,
            sectionName,
            partySize: booking.party_size,
            pendingAction: () => {
              assignTableMutation.mutate({ bookingId, tableIds: [tableId] })
              setDraggingBookingId(null)
            }
          })
          return
        }
      } catch (error) {
        console.error('Error checking capacity:', error)
      }
    }

    if (addToExisting) {
      assignTableMutation.mutate({ bookingId, tableIds: [tableId], addToExisting: true })
      toast.success(`Merged Table ${table.table_number} into booking`)
    } else {
      assignTableMutation.mutate({ bookingId, tableIds: [tableId] })
      if (needsMerge) {
        toast(`Table ${table.table_number} only fits ${table.max_capacity} guests — drag booking to another table to merge`, { icon: '⚠️' })
      }
    }
    setDraggingBookingId(null)
  }, [draggingBookingId, selectedBookingId, bookings, tables, sections, restaurantId, currentRestaurant, assignTableMutation, tableCombinations])

  const handleAssignTableFromDrawer = useCallback(async (tableId: string) => {
    await handleDropBookingOnTable(tableId)
    setIsBookingDrawerOpen(false)
  }, [handleDropBookingOnTable])

  const handleSelectTable = useCallback((tableId: string | null) => {
    // If in assign mode, toggle table selection (multi-select)
    if (assigningBookingId && tableId) {
      const table = tables.find(t => t.id === tableId)
      const booking = bookings.find(b => b.id === assigningBookingId)

      // Allow deselection always
      if (assignSelectedTableIds.includes(tableId)) {
        setAssignSelectedTableIds(prev => prev.filter(id => id !== tableId))
        return
      }

      // Block inactive tables
      if (table && !table.is_active) {
        toast.error(`Table ${table.table_number} is inactive`)
        return
      }

      // Block occupied or turnover-conflicting tables
      if (table && booking) {
        const restaurantTurnoverTime = currentRestaurant?.restaurant?.table_turnover_minutes || 90
        const conflict = findTableConflict(tableId, booking, bookings, restaurantTurnoverTime)
        if (conflict) {
          const conflictName = resolveGuestName(conflict)
          if (conflict.status === 'arrived' || isSeatedStatus(conflict.status)) {
            toast.error(`Table ${table.table_number} is occupied by ${conflictName}`)
          } else {
            const conflictTime = format(new Date(conflict.booking_time), 'HH:mm')
            toast.error(`Table ${table.table_number} has a reservation at ${conflictTime} (${conflictName}) — turnover conflict`)
          }
          return
        }
      }

      setAssignSelectedTableIds(prev => [...prev, tableId])
      return
    }

    // If a booking is being "carried" (mobile tap-to-assign flow), treat table tap as a drop
    if (draggingBookingId && tableId) {
      handleDropBookingOnTable(tableId)
      return
    }

    setFloorplanFocusTableIds([])
    setSelectedTableId(tableId)
    if (tableId) {
      setIsTableSheetOpen(true)
      setSelectedBookingId(null)
    }
  }, [assigningBookingId, draggingBookingId, handleDropBookingOnTable, tables, bookings, assignSelectedTableIds, currentRestaurant])

  const handleConfirmAssign = useCallback(() => {
    if (!assigningBookingId || assignSelectedTableIds.length === 0) return
    const booking = bookings.find(b => b.id === assigningBookingId)
    if (!booking) return

    // Re-validate all selected tables against current booking data (may have changed since selection)
    const restaurantTurnoverTime = currentRestaurant?.restaurant?.table_turnover_minutes || 90
    for (const tableId of assignSelectedTableIds) {
      const table = tables.find(t => t.id === tableId)
      if (!table) continue
      if (!table.is_active) {
        toast.error(`Table ${table.table_number} is no longer active`)
        return
      }
      const conflict = findTableConflict(tableId, booking, bookings, restaurantTurnoverTime)
      if (conflict) {
        const conflictName = resolveGuestName(conflict)
        toast.error(`Table ${table.table_number} now has a conflict with ${conflictName} — please re-select`)
        // Remove the conflicting table from selection
        setAssignSelectedTableIds(prev => prev.filter(id => id !== tableId))
        return
      }
    }

    // Multi-table assignments must match a defined combination.
    if (assignSelectedTableIds.length > 1) {
      if (assignSelectedTableIds.length > 2) {
        toast.error('Only pairs of tables can be combined. Define more combinations in the section editor for larger groups.')
        return
      }
      const [a, b] = assignSelectedTableIds
      const combo = tableCombinations.find((c: any) =>
        (c.primary_table_id === a && c.secondary_table_id === b) ||
        (c.primary_table_id === b && c.secondary_table_id === a)
      )
      if (!combo) {
        const tA = tables.find(t => t.id === a)?.table_number
        const tB = tables.find(t => t.id === b)?.table_number
        toast.error(`Tables T${tA} + T${tB} are not configured to combine. Define this combination in the section editor first.`)
        return
      }
      if (booking.party_size > combo.combined_capacity) {
        toast.error(`Party of ${booking.party_size} exceeds this combination's max of ${combo.combined_capacity}.`)
        return
      }
    }

    assignTableMutation.mutate({ bookingId: assigningBookingId, tableIds: assignSelectedTableIds })
    setAssigningBookingId(null)
    setAssignSelectedTableIds([])
    setPendingAcceptAssignId(null)
    setIsBookingsPanelCollapsed(false)
    setTimeout(() => window.dispatchEvent(new Event('resize')), 250)
  }, [assigningBookingId, assignSelectedTableIds, bookings, tables, currentRestaurant, assignTableMutation, tableCombinations])

  const handleUnassignTable = useCallback((bookingId: string) => {
    unassignTableMutation.mutate(bookingId)
  }, [unassignTableMutation])

  const handleGoToFloorplan = useCallback(async (bookingId: string) => {
    // Find booking in current bookings or pending requests
    const booking = bookings.find(b => b.id === bookingId) ||
                    pendingAcrossDates.find((b: Booking) => b.id === bookingId)

    if (!booking) {
      toast.error('Booking not found')
      return
    }

    const allTableIds = (booking.tables?.map((bt: any) => bt.table?.id).filter(Boolean) || []) as string[]
    if (allTableIds.length === 0) return

    // Determine correct section — switch to it if needed
    const assignedTables = allTableIds.map(id => tables.find(t => t.id === id)).filter(Boolean)
    const sectionIds = new Set(assignedTables.map(t => t!.section_id).filter(Boolean))
    if (sectionIds.size === 1) {
      setActiveSection(Array.from(sectionIds)[0] as string)
    } else if (sectionIds.size > 1) {
      setActiveSection('all')
    }

    // If already on canvas view and the booking is on the current selected date,
    // just highlight and open the table detail sheet — no navigation needed
    const bookingTime = new Date(booking.booking_time)
    const bookingDateStr = format(bookingTime, 'yyyy-MM-dd')
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
    const isAlreadyOnDate = bookingDateStr === selectedDateStr

    if (viewMode === 'canvas' && isAlreadyOnDate) {
      // Highlight the assigned tables on the canvas and sync time to the booking
      userSetTimeRef.current = true
      setSelectedTime(format(bookingTime, 'HH:mm'))
      setSelectedTableId(allTableIds[0])
      setFloorplanFocusTableIds(allTableIds)
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = setTimeout(() => setFloorplanFocusTableIds([]), 5000)
      return
    }

    // List view: stay on the list and just highlight the booking's table row
    if (viewMode === 'list' && isAlreadyOnDate) {
      userSetTimeRef.current = true
      setSelectedTime(format(bookingTime, 'HH:mm'))
      setSelectedBookingId(bookingId)
      setSelectedTableId(allTableIds[0])
      return
    }

    // Different date or unknown view — do the full navigation flow
    userSetTimeRef.current = true
    setSelectedDate(bookingTime)
    setSelectedTime(format(bookingTime, 'HH:mm'))

    if (viewMode !== 'canvas' && viewMode !== 'list') {
      router.push('/floorplan/tables')
    } else if (viewMode === 'canvas') {
      // already on canvas; no nav needed
    }
    // viewMode === 'list' and different date: stay on list (don't navigate)

    // Wait for bookings to refetch with new date
    try {
      await refetchBookings()
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.error('Error refetching bookings:', error)
    }

    // Highlight the table on canvas
    setFloorplanFocusTableIds(allTableIds)
    setSelectedTableId(allTableIds[0])
    setSelectedBookingId(bookingId)

    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = setTimeout(() => setFloorplanFocusTableIds([]), 5000)
  }, [bookings, pendingAcrossDates, tables, viewMode, selectedDate, router, refetchBookings])

  const handleStartAssignBooking = useCallback(async (bookingId: string, skipSectionCheck = false) => {
    // Find booking in current bookings or pending requests
    const booking = bookings.find(b => b.id === bookingId) || 
                    pendingAcrossDates.find((b: Booking) => b.id === bookingId)
    
    if (!booking) {
      toast.error('Booking not found')
      return
    }
    
    // Sync floorplan to booking date/time FIRST
    const bookingTime = new Date(booking.booking_time)
    const bookingDate = new Date(bookingTime)
    const bookingTimeStr = format(bookingTime, 'HH:mm')

    // --- Table-based section availability check ---
    if (!skipSectionCheck) {
    const restaurantTurnoverTime = currentRestaurant?.restaurant?.table_turnover_minutes || 90
    const bookingTurnoverTime = booking.turn_time_minutes || restaurantTurnoverTime
    const bookingStartMin = bookingTime.getHours() * 60 + bookingTime.getMinutes()
    const unavailableStartMin = bookingStartMin - bookingTurnoverTime + 1
    const unavailableEndMin = bookingStartMin + bookingTurnoverTime
    const partySize = booking.party_size || 1
    const bookingDateStr = format(bookingTime, 'yyyy-MM-dd')

    const allBookingsToCheck = [...bookings, ...pendingAcrossDates]
    const occupiedTableIds = new Set<string>()
    for (const b of allBookingsToCheck) {
      if (b.id === bookingId) continue
      if (isTerminalStatus(b.status)) continue
      if (b.status === 'pending') continue
      if (format(new Date(b.booking_time), 'yyyy-MM-dd') !== bookingDateStr) continue
      const bStart = new Date(b.booking_time)
      const bStartMin = bStart.getHours() * 60 + bStart.getMinutes()
      const bTurnoverTime = b.turn_time_minutes || restaurantTurnoverTime
      const bUnavailableStartMin = bStartMin - bTurnoverTime + 1
      const bUnavailableEndMin = bStartMin + bTurnoverTime
      if (unavailableStartMin < bUnavailableEndMin && unavailableEndMin > bUnavailableStartMin) {
        const bTableIds = b.tables?.map((bt: any) => bt.table?.id).filter(Boolean) || []
        bTableIds.forEach((id: string) => occupiedTableIds.add(id))
      }
    }

    const getFreeTables = (sectionId: string) =>
      tables.filter(t =>
        t.section_id === sectionId &&
        t.is_active !== false &&
        !occupiedTableIds.has(t.id) &&
        t.max_capacity >= partySize
      )

    const preferredSectionId = booking.section_id ||
      sections.find(s => s.id === booking.preferred_section)?.id ||
      sections.find(s => s.name === booking.preferred_section)?.id ||
      (activeSection !== 'all' ? activeSection : null)

    if (preferredSectionId) {
      const freeInSection = getFreeTables(preferredSectionId)
      if (freeInSection.length === 0) {
        const sectionName = sections.find(s => s.id === preferredSectionId)?.name || 'Section'
        const alternatives = sections
          .filter(s => s.id !== preferredSectionId && s.is_active)
          .map(s => {
            const free = getFreeTables(s.id)
            const allSectionTables = tables.filter(t => t.section_id === s.id && t.is_active !== false)
            return { section: s, freeCount: free.length, totalCount: allSectionTables.length }
          })
          .filter(a => a.freeCount > 0)
          .sort((a, b) => b.freeCount - a.freeCount)

        setSectionFullWarning({
          open: true,
          sectionName,
          sectionId: preferredSectionId,
          partySize,
          bookingId,
          mode: 'assign',
          alternatives,
        })
        return
      }
    }
    } // end skipSectionCheck
    // --- End section availability check ---
    
    // Set assigning booking ID FIRST to pause the auto-sync timer
    // (prevents it from resetting selectedTime back to "now" during the async refetch)
    setAssigningBookingId(bookingId)
    setAssignSelectedTableIds([])
    setSelectedBookingId(bookingId)
    
    // Set date and time - this will trigger bookings query refetch
    setSelectedDate(bookingDate)
    setSelectedTime(bookingTimeStr)
    
    // Ensure we're in canvas view for assigning tables
    if (viewMode !== 'canvas') {
      router.push('/floorplan/tables')
    }
    
    // Wait for bookings to refetch with new date, then proceed
    try {
      await refetchBookings()
      
      // Small delay to ensure UI has updated
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.error('Error refetching bookings:', error)
    }
    
    setIsTableSheetOpen(false)
    setIsBookingDrawerOpen(false)
    setIsBookingsPanelCollapsed(true)
    // Trigger canvas re-fit after the panel collapse transition (200ms) completes
    setTimeout(() => window.dispatchEvent(new Event('resize')), 250)
    setTimeout(() => window.dispatchEvent(new Event('resize')), 500)
    toast('Tap tables to assign (select multiple if needed)', { icon: '📍' })
  }, [bookings, pendingAcrossDates, tables, sections, currentRestaurant, activeSection, viewMode, router, refetchBookings])

  const handleCancelAssign = useCallback(async () => {
    // If the booking was just accepted and no table assigned yet, revert to pending
    if (pendingAcceptAssignId && assignSelectedTableIds.length === 0) {
      const booking = bookings.find(b => b.id === pendingAcceptAssignId)
      if (booking && booking.status === 'confirmed' && (!booking.tables || booking.tables.length === 0)) {
        const { error } = await supabase
          .from('bookings')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', pendingAcceptAssignId)

        if (!error) {
          // Booking reverted to pending — restart alarm to match state
          bookingAlarmService.startAlarm(pendingAcceptAssignId)

          // Write audit trail
          const staffId = currentRestaurant?.id
          if (staffId) {
            supabase.from('booking_history').insert({
              booking_id: pendingAcceptAssignId,
              previous_status: 'confirmed',
              new_status: 'pending',
              changed_by: staffId,
              changed_at: new Date().toISOString(),
              notes: 'Accept cancelled — reverted to pending (no table assigned)',
            }).then(({ error: histErr }) => {
              if (histErr) console.error('Failed to write booking history:', histErr)
            })
          }
          await queryClient.invalidateQueries({ queryKey: ['floorplan-bookings', restaurantId] })
          await queryClient.invalidateQueries({ queryKey: ['pending-requests', restaurantId] })
          toast.success('Booking reverted to pending')
        } else {
          console.error('Failed to revert booking:', error)
          toast.error('Failed to revert booking')
        }
      }
    }
    setAssigningBookingId(null)
    setAssignSelectedTableIds([])
    setPendingAcceptAssignId(null)
    setSelectedBookingId(null)
    setIsBookingsPanelCollapsed(false)
    setTimeout(() => window.dispatchEvent(new Event('resize')), 250)
  }, [pendingAcceptAssignId, assignSelectedTableIds, bookings, supabase, currentRestaurant, queryClient, restaurantId])

  // Auto-assign: find the best-fit available table for the assigning booking and assign it
  const autoAssignSuggestion = useMemo(() => {
    if (!assigningBookingId) return null
    const booking = bookings.find(b => b.id === assigningBookingId)
    if (!booking) return null
    const restaurantTurnoverTime = currentRestaurant?.restaurant?.table_turnover_minutes || 90

    const available = filteredTables
      .filter(t => {
        if (!t.is_active) return false
        if (t.max_capacity < booking.party_size) return false
        // Use shared conflict check — includes arrived/seated + turnover overlap
        return !findTableConflict(t.id, booking, bookings, restaurantTurnoverTime)
      })
      .sort((a, b) => {
        const aMin = a.min_capacity || 1
        const bMin = b.min_capacity || 1
        const aIsExactFit = aMin <= booking.party_size && a.max_capacity >= booking.party_size
        const bIsExactFit = bMin <= booking.party_size && b.max_capacity >= booking.party_size
        if (aIsExactFit && !bIsExactFit) return -1
        if (!aIsExactFit && bIsExactFit) return 1
        return (a.max_capacity - booking.party_size) - (b.max_capacity - booking.party_size)
      })

    return available.length > 0 ? available[0] : null
  }, [assigningBookingId, bookings, filteredTables, currentRestaurant])

  // In assign mode, compute IDs of all conflict-free tables so the canvas can highlight them
  const assignAvailableTableIds = useMemo(() => {
    if (!assigningBookingId) return [] as string[]
    const booking = bookings.find(b => b.id === assigningBookingId)
    if (!booking) return [] as string[]
    const restaurantTurnoverTime = currentRestaurant?.restaurant?.table_turnover_minutes || 90
    return filteredTables
      .filter(t => t.is_active && !findTableConflict(t.id, booking, bookings, restaurantTurnoverTime))
      .map(t => t.id)
  }, [assigningBookingId, bookings, filteredTables, currentRestaurant])

  // In assign mode, override display colors: tables with turnover conflicts show red
  const assignModeDisplayColors = useMemo(() => {
    if (!assigningBookingId) return tableDisplayColors
    const overrides: Record<string, TableDisplayColor> = { ...tableDisplayColors }
    const availableSet = new Set(assignAvailableTableIds)
    for (const table of filteredTables) {
      if (!table.is_active) continue
      if (!availableSet.has(table.id)) {
        overrides[table.id] = 'red'
      }
    }
    return overrides
  }, [assigningBookingId, assignAvailableTableIds, filteredTables, tableDisplayColors])

  const handleAutoAssign = useCallback(() => {
    if (!assigningBookingId || !autoAssignSuggestion) return
    assignTableMutation.mutate({ bookingId: assigningBookingId, tableIds: [autoAssignSuggestion.id] })
    toast.success(`Auto-assigned table ${autoAssignSuggestion.table_number}`)
    setAssigningBookingId(null)
    setAssignSelectedTableIds([])
    setPendingAcceptAssignId(null)
  }, [assigningBookingId, autoAssignSuggestion, assignTableMutation])

  const handleVisualizeBooking = useCallback((bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId) || pendingAcrossDates.find(b => b.id === bookingId)
    if (!booking) return
    const bookingTime = new Date(booking.booking_time)
    userSetTimeRef.current = true
    setSelectedDate(bookingTime)
    setSelectedTime(format(bookingTime, 'HH:mm'))

    // Navigate to canvas view if not already there (highlights only visible on canvas)
    if (viewMode !== 'canvas') {
      router.push('/floorplan/tables')
    }

    const allTableIds = (booking.tables?.map((bt: any) => bt.table?.id).filter(Boolean) || []) as string[]
    if (allTableIds.length > 0) {
      const assignedTables = allTableIds.map(id => tables.find(t => t.id === id)).filter(Boolean)
      const sectionIds = new Set(assignedTables.map(t => t!.section_id).filter(Boolean))
      if (sectionIds.size === 1) {
        setActiveSection(Array.from(sectionIds)[0] as string)
      } else if (sectionIds.size > 1) {
        setActiveSection('all')
      }
      setFloorplanFocusTableIds(allTableIds)
      setSelectedTableId(allTableIds[0])
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = setTimeout(() => setFloorplanFocusTableIds([]), 5000)
    }
  }, [bookings, pendingAcrossDates, tables, viewMode, router])

  if (contextLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="motion-safe:animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-background flex flex-col">
      {/* Date Row - Full width bar from menu to right edge, normal container */}
      {selectedDate && (
        <div className="bg-muted/50 backdrop-blur-sm border-b border-border/50 py-1 flex items-center justify-center flex-shrink-0">
          <div className="flex items-center gap-2 w-full px-4">
            <div className="flex-1 flex items-center justify-center gap-1">
              {/* Chevron left to go back */}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {/* Date display - Clickable to open calendar */}
              <Popover open={isDateCalendarOpen} onOpenChange={setIsDateCalendarOpen}>
                <PopoverTrigger asChild>
                  <button className="text-sm font-medium px-2 min-w-[120px] text-center hover:bg-muted/50 rounded transition-colors cursor-pointer flex items-center justify-center gap-1">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    {format(selectedDate, 'MMM d, yyyy')}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(date)
                        setIsDateCalendarOpen(false)
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {/* Chevron right to go forward */}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {(!isToday(selectedDate) || selectedTime !== format(new Date(), 'HH:mm')) && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs px-2"
                  onClick={handleNow}
                >
                  Now
                </Button>
              )}
              {/* Mobile bookings toggle */}
              {viewMode === 'canvas' && (
                <button
                  type="button"
                  className="min-[701px]:hidden h-7 px-3 rounded-full bg-card border shadow-card text-[11px] font-medium text-muted-foreground hover:bg-muted transition-colors"
                  onClick={() => setIsMobileBookingsOpen(true)}
                >
                  Bookings
                </button>
              )}
              {/* Info Button - Opens legend, on the right */}
              <div className="flex-shrink-0">
                <button
                  className="w-7 h-7 bg-card border rounded-lg shadow-card hover:bg-muted flex items-center justify-center transition-colors touch-target"
                  onClick={() => setIsLegendExpanded(!isLegendExpanded)}
                  title="Toggle legend"
                >
                  <Info className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content area - flex row */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Panel - Bookings: visible in both canvas and list views */}
        {(viewMode === 'canvas' || viewMode === 'list') && (
          <div
            className={cn(
              "hidden min-[701px]:flex flex-shrink-0 border-r bg-card shadow-xl flex-col transition-[width] duration-200 ease-out",
              isBookingsPanelCollapsed ? "w-[72px]" : "w-[340px] lg:w-[400px]"
            )}
          >
            <div className="h-full bg-card flex flex-col overflow-hidden">
              <BookingsPanel
                bookings={bookings}
                sections={sections}
                selectedBookingId={selectedBookingId}
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                selectedShift={selectedShift}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onDateChange={setSelectedDate}
                onTimeChange={setSelectedTime}
                onSelectBooking={handleSelectBooking}
                onDragBookingStart={setDraggingBookingId}
                onNewBooking={() => setIsNewBookingModalOpen(true)}
                onAddWalkIn={handleAddWalkIn}
                onAddToWaitlist={handleAddToWaitlist}
                onUpdateBookingStatus={handleUpdateBookingStatusById}
                onUnassignBooking={handleUnassignTable}
                onGoToFloorplan={handleGoToFloorplan}
                onStartAssign={handleStartAssignBooking}
                onVisualizeBooking={handleVisualizeBooking}
                onAcceptAndAssign={handleAcceptAndAssign}
                onAcceptBooking={handleAcceptBooking}
                allPendingRequests={pendingAcrossDates}
                onNow={handleNow}
                onClose={() => {}} // No-op since panel is always visible
                restaurantTurnoverTime={currentRestaurant?.restaurant?.table_turnover_minutes || 90}
                allBookings={[...bookings, ...pendingAcrossDates]}
                isCollapsed={isBookingsPanelCollapsed}
                onToggleCollapsed={() => setIsBookingsPanelCollapsed((prev) => !prev)}
              />
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex min-h-0">
          {/* Floorplan Canvas/List - Adjusts width when panel is open */}
          <div className="flex-1 min-w-0 flex flex-col relative">

            {viewMode === 'canvas' ? (
              <>
                <FloorplanCanvas
                  tables={filteredTables}
                  sections={sections}
                  activeSection={activeSection}
                  onSectionChange={setActiveSection}
                  selectedTableId={selectedTableId}
                  selectedBookingId={selectedBookingId}
                  highlightedTableIds={assigningBookingId ? assignSelectedTableIds : (floorplanFocusTableIds.length > 0 ? floorplanFocusTableIds : highlightedTableIds)}
                  recommendedTableId={recommendedTableId}
                  showDecor={showDecor}
                  onToggleDecor={() => setShowDecor(!showDecor)}
                  tableDisplayColors={assigningBookingId ? assignModeDisplayColors : tableDisplayColors}
                  tableGuestNames={tableGuestNames}
                  tableUpcomingReservations={tableUpcomingReservations}
                  tableLateArrivals={tableLateArrivals}
                  sectionCapacities={sectionCapacities}
                  onSelectTable={handleSelectTable}
                  onDropBookingOnTable={handleDropBookingOnTable}
                  onDeselectBooking={() => { setSelectedBookingId(null); setDraggingBookingId(null) }}
                  isAssignMode={!!assigningBookingId}
                  viewMode={viewMode}
                  onViewModeChange={(mode) => {
                    setViewMode(mode)
                    router.push(mode === 'canvas' ? '/floorplan/tables' : '/floorplan/list')
                  }}
                  isBookingsPanelOpen={true}
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                  onDateChange={setSelectedDate}
                  onTimeChange={setSelectedTime}
                  onNow={handleNow}
                  isLegendExpanded={isLegendExpanded}
                  shifts={shifts}
                  selectedShiftId={selectedShiftId}
                  onShiftChange={setSelectedShiftId}
                  selectedShift={selectedShift}
                  tableShiftPills={tableShiftPills}
                  tableProgress={tableProgress}
                />
              </>
            ) : (
              <FloorplanListView
                tables={filteredTables}
                sections={sections}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                selectedTableId={selectedTableId}
                tableDisplayColors={tableDisplayColors}
                tableGuestNames={tableGuestNames}
                tableUpcomingReservations={tableUpcomingReservations}
                tableLateArrivals={tableLateArrivals}
                sectionCapacities={sectionCapacities}
                bookings={bookings}
                selectedTime={selectedTime}
                onSelectTable={handleSelectTable}
                onDropBookingOnTable={handleDropBookingOnTable}
                viewMode={viewMode}
                onViewModeChange={(mode) => {
                  setViewMode(mode)
                  router.push(mode === 'canvas' ? '/floorplan/tables' : '/floorplan/list')
                }}
                isBookingsPanelOpen={true}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onTimeChange={setSelectedTime}
                onNow={handleNow}
                isLegendExpanded={isLegendExpanded}
                selectedBookingId={selectedBookingId}
                onSelectBooking={handleSelectBooking}
                shifts={shifts}
                selectedShiftId={selectedShiftId}
                onShiftChange={setSelectedShiftId}
                selectedShift={selectedShift}
                tableShiftPills={tableShiftPills}
                tableProgress={tableProgress}
              />
            )}

            {/* Assignment Mode Banner */}
            {assigningBookingId && (() => {
              const assigningBooking = bookings.find(b => b.id === assigningBookingId)
              const selectedAssignTables = tables.filter(t => assignSelectedTableIds.includes(t.id))
              const combinedCapacity = selectedAssignTables.reduce((sum, t) => sum + (t.max_capacity || 0), 0)
              return assigningBooking ? (
                <AssignModeBanner
                  booking={assigningBooking}
                  selectedTables={selectedAssignTables}
                  combinedCapacity={combinedCapacity}
                  onConfirm={handleConfirmAssign}
                  onCancel={handleCancelAssign}
                  onAutoAssign={handleAutoAssign}
                  hasAutoAssignSuggestion={!!autoAssignSuggestion}
                />
              ) : null
            })()}
          </div>
        </div>
      </div>

      {/* Mobile Bookings Overlay - replaces bottom sheet on small screens */}
      <div
        className={cn(
          "min-[701px]:hidden fixed inset-0 z-40",
          isMobileBookingsOpen ? "flex" : "hidden"
        )}
      >
        {/* Backdrop */}
        <button
          type="button"
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={() => setIsMobileBookingsOpen(false)}
          aria-label="Close bookings"
        />
        {/* Panel */}
        <div className="relative z-10 mt-8 mx-2 mb-4 flex-1 flex flex-col rounded-2xl border shadow-2xl bg-card overflow-hidden">
          <div className="flex justify-center py-2 border-b">
            <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
          </div>
          <div className="flex-1 overflow-hidden">
            <BookingsPanel
              bookings={bookings}
              sections={sections}
              selectedBookingId={selectedBookingId}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              selectedShift={selectedShift}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onDateChange={setSelectedDate}
              onTimeChange={setSelectedTime}
              onSelectBooking={handleSelectBooking}
              onDragBookingStart={(id) => { setDraggingBookingId(id); setIsMobileBookingsOpen(false); toast('Tap a table to assign this booking', { icon: '📍' }) }}
              onNewBooking={() => setIsNewBookingModalOpen(true)}
              onAddWalkIn={handleAddWalkIn}
              onAddToWaitlist={handleAddToWaitlist}
              onUpdateBookingStatus={handleUpdateBookingStatusById}
              onUnassignBooking={handleUnassignTable}
              onGoToFloorplan={(id) => { handleGoToFloorplan(id); setIsMobileBookingsOpen(false) }}
              onStartAssign={(id) => { handleStartAssignBooking(id); setIsMobileBookingsOpen(false) }}
              onVisualizeBooking={(id) => { handleVisualizeBooking(id); setIsMobileBookingsOpen(false) }}
              onAcceptAndAssign={handleAcceptAndAssign}
              onAcceptBooking={handleAcceptBooking}
              allPendingRequests={pendingAcrossDates}
              onNow={handleNow}
              onClose={() => setIsMobileBookingsOpen(false)}
              restaurantTurnoverTime={currentRestaurant?.restaurant?.table_turnover_minutes || 90}
              allBookings={[...bookings, ...pendingAcrossDates]}
            />
          </div>
        </div>
      </div>

      {/* Table Detail Sheet */}
      <TableDetailSheet
        table={selectedTable}
        assignedBooking={assignedBookingForTable}
        upcomingBookings={upcomingBookingsForTable}
        isOpen={isTableSheetOpen}
        onClose={() => setIsTableSheetOpen(false)}
        selectedTime={selectedTime}
        restaurantTurnoverTime={currentRestaurant?.restaurant?.table_turnover_minutes || 90}
        allBookings={[...bookings, ...pendingAcrossDates]}
        selectedShift={selectedShift}
        shiftBookings={selectedTableId ? tableShiftBookingsMap[selectedTableId] : undefined}
        onSeatWalkIn={() => { setIsTableSheetOpen(false); setIsWalkInMode(true); setWalkInTableId(selectedTableId); setIsNewBookingModalOpen(true) }}
        onNewReservation={() => { setIsTableSheetOpen(false); setIsNewBookingModalOpen(true) }}
        onCompleteAndFree={(bookingId) => handleUpdateBookingStatusById(bookingId, 'completed')}
        onToggleActive={handleToggleTableActive}
      />

      {/* Booking Details Drawer */}
      <BookingDetailsDrawer
        booking={selectedBooking}
        suggestedTables={suggestedTables}
        allTables={filteredTables}
        isOpen={isBookingDrawerOpen}
        onClose={() => {
          if (pendingAcceptAssignId) {
            toast('You can assign a table later from the Arriving tab', { icon: 'ℹ️' })
            setPendingAcceptAssignId(null)
          }
          setIsBookingDrawerOpen(false)
        }}
        onAssignTable={handleAssignTableFromDrawer}
        onAssignMultipleTables={(tableIds) => {
          if (!selectedBookingId) return
          assignTableMutation.mutate({ bookingId: selectedBookingId, tableIds })
          setIsBookingDrawerOpen(false)
        }}
        onUpdateStatus={handleUpdateBookingStatus}
      />

      {/* New Booking Modal */}
      <NewBookingModal
        isOpen={isNewBookingModalOpen}
        onClose={() => { setIsNewBookingModalOpen(false); setIsWalkInMode(false); setWalkInTableId(null) }}
        restaurantId={restaurantId}
        availableTables={filteredTables}
        allBookings={[...bookings, ...pendingAcrossDates]}
        isWalkIn={isWalkInMode}
        preselectedTableId={walkInTableId}
        hasGuestCRM={hasFeature('customer_management')}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['floorplan-bookings', restaurantId] })
          queryClient.invalidateQueries({ queryKey: ['pending-requests', restaurantId] })
          setIsNewBookingModalOpen(false)
          setIsWalkInMode(false)
          setWalkInTableId(null)
        }}
      />

      {/* Full Restaurant Warning Dialog */}
      <AlertDialog open={fullRestaurantWarning.open} onOpenChange={(open) => setFullRestaurantWarning(prev => ({ ...prev, open }))}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="text-red-500">⚠</span> Restaurant Fully Booked
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">This booking cannot be accommodated without overbooking:</p>
                <ul className="space-y-1.5">
                  {fullRestaurantWarning.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 text-red-500">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm font-medium">Do you still want to accept this booking?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFullRestaurantWarning({ open: false, reasons: [], pendingAction: null })}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                fullRestaurantWarning.pendingAction?.()
                setFullRestaurantWarning({ open: false, reasons: [], pendingAction: null })
              }}
            >
              Accept Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Section Full Warning Dialog — table-based, with alternative sections */}
      <AlertDialog open={sectionFullWarning.open} onOpenChange={(open) => setSectionFullWarning(prev => ({ ...prev, open }))}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="text-amber-500">⚠</span> No Tables Available in {sectionFullWarning.sectionName}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  All tables in <strong>{sectionFullWarning.sectionName}</strong> are occupied or reserved during this booking&apos;s time.
                </p>

                {sectionFullWarning.alternatives.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Sections with available tables:</p>
                    <div className="space-y-1.5">
                      {sectionFullWarning.alternatives.map((alt) => (
                        <button
                          key={alt.section.id}
                          onClick={async () => {
                            const bId = sectionFullWarning.bookingId
                            const mode = sectionFullWarning.mode
                            setSectionFullWarning({ open: false, sectionName: '', sectionId: '', partySize: 0, bookingId: '', mode: 'accept', alternatives: [] })
                            if (mode === 'assign') {
                              // Already confirmed — just switch section and enter assign mode
                              setActiveSection(alt.section.id)
                              handleStartAssignBooking(bId, true)
                            } else if (mode === 'accept-only') {
                              // Accept and set section — no assign mode
                              await supabase.from('bookings').update({ section_id: alt.section.id }).eq('id', bId)
                              updateBookingStatus.mutate({ bookingId: bId, status: 'confirmed' })
                            } else {
                              doAcceptToSection(bId, alt.section.id)
                            }
                          }}
                          className="w-full flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: alt.section.color }}
                            />
                            <span className="text-sm font-medium">{alt.section.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {alt.freeCount} of {alt.totalCount} tables free
                            </span>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {sectionFullWarning.alternatives.length === 0 && (
                  <p className="text-sm text-muted-foreground">No other sections have available tables either.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSectionFullWarning({ open: false, sectionName: '', sectionId: '', partySize: 0, bookingId: '', mode: 'accept', alternatives: [] })}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                const bId = sectionFullWarning.bookingId
                const mode = sectionFullWarning.mode
                const secId = sectionFullWarning.sectionId
                setSectionFullWarning({ open: false, sectionName: '', sectionId: '', partySize: 0, bookingId: '', mode: 'accept', alternatives: [] })
                if (mode === 'assign') {
                  // Already confirmed — switch to preferred section and enter assign mode
                  if (secId) setActiveSection(secId)
                  handleStartAssignBooking(bId, true)
                } else if (mode === 'accept-only') {
                  // Just accept without entering assign mode
                  updateBookingStatus.mutate({ bookingId: bId, status: 'confirmed' })
                } else {
                  doAcceptBooking(bId)
                }
              }}
            >
              {sectionFullWarning.mode === 'assign' ? 'Assign Anyway' : 'Accept Anyway'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Capacity Warning Dialog */}
      <CapacityWarningDialog
        open={capacityWarning.open}
        onOpenChange={(open) => {
          if (!open) capacityWarningBookingRef.current = null
          setCapacityWarning(prev => ({ ...prev, open }))
        }}
        impact={capacityWarning.impact}
        sectionName={capacityWarning.sectionName}
        partySize={capacityWarning.partySize}
        onProceed={() => {
          capacityWarningBookingRef.current = null
          capacityWarning.pendingAction?.()
          setCapacityWarning({ open: false, impact: null, sectionName: '', partySize: 0, pendingAction: null })
        }}
        onSelectAlternative={(sectionId) => {
          const pendingBookingId = capacityWarningBookingRef.current
          setCapacityWarning({ open: false, impact: null, sectionName: '', partySize: 0, pendingAction: null })
          if (pendingBookingId) {
            // Accept the booking and assign to the alternative section
            capacityWarningBookingRef.current = null
            doAcceptToSection(pendingBookingId, sectionId)
          } else {
            // Regular flow: just switch to the section
            setActiveSection(sectionId)
            toast.success('Switched to alternative section')
          }
        }}
      />

      {/* FAB - Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {/* Expanded Options */}
        {isFabExpanded && (
          <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2">
            <button
              onClick={() => {
                setIsNewBookingModalOpen(true)
                setIsFabExpanded(false)
              }}
              className="flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all touch-target"
            >
              <Plus className="w-5 h-5" />
              <span className="text-sm font-medium">Booking</span>
            </button>
            <button
              onClick={() => {
                handleAddWalkIn()
                setIsFabExpanded(false)
              }}
              className="flex items-center gap-2 px-4 py-3 bg-secondary text-secondary-foreground rounded-full shadow-lg hover:bg-secondary/90 transition-all touch-target"
            >
              <UserPlus className="w-5 h-5" />
              <span className="text-sm font-medium">Walk-in</span>
            </button>
          </div>
        )}
        
        {/* Main FAB Button */}
        <button
          onClick={() => setIsFabExpanded(!isFabExpanded)}
          className={cn(
            "w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all touch-target",
            isFabExpanded 
              ? "bg-destructive hover:bg-destructive/90 rotate-45" 
              : "bg-primary hover:bg-primary/90"
          )}
          aria-label={isFabExpanded ? "Close menu" : "Open menu"}
        >
          {isFabExpanded ? (
            <X className="w-6 h-6 text-primary-foreground" />
          ) : (
            <Plus className="w-6 h-6 text-primary-foreground" />
          )}
        </button>
      </div>
    </div>
  )
}
