// components/floorplan/floorplan-list-view.tsx
"use client"

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Users,
  Search,
  MapPin,
  ArrowUpDown,
  Timer,
  Clock,
  Calendar as CalendarIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, differenceInMinutes } from 'date-fns'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { isTerminalStatus } from '@/lib/constants/floorplan'
import type { RestaurantTable, RestaurantSection, Booking, RestaurantShift } from '@/types'
import type { TableDisplayColor, SectionCapacity } from '@/app/(dashboard)/floorplan/page'
import { ShiftSelector } from './shift-selector'
import { getShiftWindow, parseTimeToMinutes } from '@/lib/utils/shifts'
import type { ShiftBookingPill } from './floorplan-table'
import type { TableProgress } from '@/lib/utils/table-progress'

interface FloorplanListViewProps {
  tables: RestaurantTable[]
  sections: RestaurantSection[]
  activeSection: string
  onSectionChange: (section: string) => void
  selectedTableId: string | null
  tableDisplayColors: Record<string, TableDisplayColor>
  tableGuestNames?: Record<string, string>
  tableUpcomingReservations: Record<string, boolean>
  tableLateArrivals?: Record<string, boolean>
  sectionCapacities?: Record<string, SectionCapacity>
  bookings: Booking[]
  selectedTime: string
  onSelectTable: (tableId: string | null) => void
  onDropBookingOnTable: (tableId: string) => void
  viewMode?: 'canvas' | 'list'
  onViewModeChange?: (mode: 'canvas' | 'list') => void
  isBookingsPanelOpen?: boolean
  selectedDate?: Date
  onDateChange?: (date: Date) => void
  onTimeChange?: (time: string) => void
  onNow?: () => void
  isLegendExpanded?: boolean
  restaurantTurnoverTime?: number
  allBookings?: Booking[]
  selectedBookingId?: string | null
  onSelectBooking?: (bookingId: string | null) => void
  // Shift filtering
  shifts?: RestaurantShift[]
  selectedShiftId?: string | null
  onShiftChange?: (shiftId: string | null) => void
  selectedShift?: RestaurantShift | null
  tableShiftPills?: Record<string, ShiftBookingPill[]>
  tableProgress?: Record<string, TableProgress | null>
}

const statusLabels: Record<TableDisplayColor, string> = {
  green: 'Available',
  red: 'Occupied',
  orange: 'Upcoming / Overstay',
  grey: 'Blocked',
  yellow: 'Ending Soon',
  'flashing-red': 'Past Expected End',
  'reserved-upcoming': 'Reserved',
}

const statusColors: Record<TableDisplayColor, string> = {
  green: 'bg-[hsl(var(--status-available)/.12)] text-[hsl(var(--status-available))]',
  red: 'bg-[hsl(var(--status-taken)/.12)] text-[hsl(var(--status-taken))]',
  orange: 'bg-[hsl(var(--status-overstay)/.12)] text-[hsl(var(--status-overstay))]',
  grey: 'bg-muted text-muted-foreground',
  yellow: 'bg-[hsl(var(--status-highlight)/.15)] text-[hsl(var(--status-highlight))]',
  'flashing-red': 'bg-[hsl(var(--status-taken)/.12)] text-[hsl(var(--status-taken))] motion-safe:animate-pulse',
  'reserved-upcoming': 'bg-[hsl(var(--booking-seated)/.12)] text-[hsl(var(--booking-seated))]',
}

type SortKey = 'table_number' | 'status' | 'section' | 'capacity' | 'guest' | 'time'
type SortDir = 'asc' | 'desc'

export function FloorplanListView({
  tables,
  sections,
  activeSection,
  onSectionChange,
  selectedTableId,
  tableDisplayColors,
  tableGuestNames = {},
  tableUpcomingReservations,
  tableLateArrivals = {},
  sectionCapacities = {},
  bookings,
  selectedTime,
  onSelectTable,
  onDropBookingOnTable,
  viewMode,
  onViewModeChange,
  isBookingsPanelOpen = false,
  selectedDate,
  onDateChange,
  onTimeChange,
  onNow,
  isLegendExpanded = false,
  restaurantTurnoverTime = 90,
  allBookings = [],
  selectedBookingId,
  onSelectBooking,
  shifts,
  selectedShiftId = null,
  onShiftChange,
  selectedShift = null,
  tableShiftPills,
  tableProgress,
}: FloorplanListViewProps) {
  const shiftWindow = useMemo(() => getShiftWindow(selectedShift), [selectedShift])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('table_number')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [isTimePopoverOpen, setIsTimePopoverOpen] = useState(false)
  const [tempHour, setTempHour] = useState(12)
  const [tempMinutes, setTempMinutes] = useState(0)
  const [tempAmPm, setTempAmPm] = useState<'AM' | 'PM'>('PM')
  // Refs mirror state so disabled checks inside inline render don't use stale values
  const tempHourRef = useRef(tempHour)
  const tempMinutesRef = useRef(tempMinutes)
  const tempAmPmRef = useRef(tempAmPm)
  tempHourRef.current = tempHour
  tempMinutesRef.current = tempMinutes
  tempAmPmRef.current = tempAmPm

  // Convert 24-hour to 12-hour format
  const get12HourTime = useCallback((time24: string) => {
    const [hours, minutes] = time24.split(':').map(Number)
    const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    const ampm = hours < 12 ? 'AM' : 'PM'
    return { hour12, minutes, ampm }
  }, [])
  
  // Convert 12-hour to 24-hour format
  const to24Hour = useCallback((hour12: number, minutes: number, ampm: string) => {
    let hour24 = hour12
    if (ampm === 'AM' && hour12 === 12) hour24 = 0
    if (ampm === 'PM' && hour12 !== 12) hour24 = hour12 + 12
    return `${String(hour24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }, [])
  
  // Update temp values when selectedTime changes or popover opens
  useEffect(() => {
    if (selectedTime && isTimePopoverOpen) {
      const { hour12, minutes, ampm } = get12HourTime(selectedTime)
      setTempHour(hour12)
      setTempMinutes(minutes)
      setTempAmPm(ampm as 'AM' | 'PM')
    }
  }, [selectedTime, isTimePopoverOpen, get12HourTime])

  // Build lookup: table id -> current booking (using restaurant turnover time)
  const tableBookingMap = useMemo(() => {
    const map: Record<string, Booking> = {}
    const selectedTimeMinutes = (() => {
      const [h, m] = selectedTime.split(':').map(Number)
      return h * 60 + m
    })()
    
    for (const b of bookings) {
      // If physically present, always show as current booking
      if (['seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment', 'arrived'].includes(b.status)) {
        const tableIds = (b.tables?.map((t: any) => t.table?.id || t.id).filter(Boolean) || 
                         b.booking_tables?.map((bt: any) => bt.table?.id).filter(Boolean) || []) as string[]
        for (const tid of tableIds) {
          map[tid] = b
        }
        continue
      }
      
      // For confirmed bookings, check if selected time is within unavailable window
      if (b.status === 'confirmed') {
        const bTime = new Date(b.booking_time)
        const bMin = bTime.getHours() * 60 + bTime.getMinutes()
        // Use booking's turn_time_minutes if available, otherwise fall back to restaurant's table_turnover_minutes
        const bookingTurnoverTime = b.turn_time_minutes || restaurantTurnoverTime
        // Unavailable window: (booking_time - turnover_time + 1 min) to (booking_time + turnover_time)
        const unavailableStartMin = bMin - bookingTurnoverTime + 1
        const unavailableEndMin = bMin + bookingTurnoverTime
        const tableIds = (b.tables?.map((t: any) => t.table?.id || t.id).filter(Boolean) || 
                         b.booking_tables?.map((bt: any) => bt.table?.id).filter(Boolean) || []) as string[]
        for (const tid of tableIds) {
          if (selectedTimeMinutes >= unavailableStartMin && selectedTimeMinutes < unavailableEndMin) {
            map[tid] = b
          }
        }
      }
    }
    return map
  }, [bookings, selectedTime, restaurantTurnoverTime])

  // Build upcoming per table (for finding next booking)
  const tableUpcomingMap = useMemo(() => {
    const map: Record<string, Booking> = {}
    const selectedTimeMinutes = (() => {
      const [h, m] = selectedTime.split(':').map(Number)
      return h * 60 + m
    })()
    // Use allBookings if available, otherwise fallback to bookings
    const allBookingsToCheck = allBookings.length > 0 ? allBookings : bookings
    for (const b of allBookingsToCheck) {
      if (!['pending', 'confirmed', 'arrived'].includes(b.status)) continue
      const bTime = new Date(b.booking_time)
      const bMin = bTime.getHours() * 60 + bTime.getMinutes()
      if (bMin > selectedTimeMinutes) {
        const tableIds = (b.tables?.map((t: any) => t.table?.id || t.id).filter(Boolean) || 
                         b.booking_tables?.map((bt: any) => bt.table?.id).filter(Boolean) || []) as string[]
        for (const tid of tableIds) {
          if (!map[tid] || new Date(map[tid].booking_time) > bTime) {
            map[tid] = b
          }
        }
      }
    }
    return map
  }, [bookings, allBookings, selectedTime])

  // Find bookings that have no table assigned
  const unassignedBookings = useMemo(() => {
    return bookings.filter(b => {
      if (isTerminalStatus(b.status)) return false
      const tableIds = (
        b.tables?.map((t: any) => t.table?.id || t.id).filter(Boolean) ||
        b.booking_tables?.map((bt: any) => bt.table?.id).filter(Boolean) ||
        []
      ) as string[]
      return tableIds.length === 0
    }).sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
  }, [bookings])

  const sectionMap = useMemo(() => {
    const m: Record<string, RestaurantSection> = {}
    for (const s of sections) m[s.id] = s
    return m
  }, [sections])

  // Filter tables
  const filtered = useMemo(() => {
    let list = tables
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(t => {
        const sName = (t.section_id ? sectionMap[t.section_id]?.name?.toLowerCase() : '') || ''
        const gName = (tableGuestNames[t.id] || '').toLowerCase()
        return (
          String(t.table_number).toLowerCase().includes(q) ||
          sName.includes(q) ||
          gName.includes(q) ||
          (t.table_type || '').toLowerCase().includes(q)
        )
      })
    }
    return list
  }, [tables, searchQuery, sectionMap, tableGuestNames])

  // Sort
  const sorted = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'table_number': {
          const aN = parseInt(a.table_number) || 0
          const bN = parseInt(b.table_number) || 0
          cmp = aN !== bN ? aN - bN : a.table_number.localeCompare(b.table_number)
          break
        }
        case 'status': {
          const aColor = tableDisplayColors[a.id] || 'green'
          const bColor = tableDisplayColors[b.id] || 'green'
          cmp = aColor.localeCompare(bColor)
          break
        }
        case 'section': {
          const aSec = a.section_id ? sectionMap[a.section_id]?.name || '' : ''
          const bSec = b.section_id ? sectionMap[b.section_id]?.name || '' : ''
          cmp = aSec.localeCompare(bSec)
          break
        }
        case 'capacity':
          cmp = a.max_capacity - b.max_capacity
          break
        case 'guest': {
          const aGuest = tableGuestNames[a.id] || ''
          const bGuest = tableGuestNames[b.id] || ''
          cmp = aGuest.localeCompare(bGuest)
          break
        }
        case 'time': {
          // Sort tables chronologically by their next relevant booking time:
          // current booking first, else upcoming. Tables with no booking sink to the end.
          const getRelevantTime = (id: string) => {
            const cur = tableBookingMap[id]
            const up = tableUpcomingMap[id]
            const t = cur?.booking_time || up?.booking_time
            return t ? new Date(t).getTime() : Number.POSITIVE_INFINITY
          }
          const aT = getRelevantTime(a.id)
          const bT = getRelevantTime(b.id)
          cmp = aT === bT ? 0 : aT < bT ? -1 : 1
          break
        }
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
    return list
  }, [filtered, sortKey, sortDir, tableDisplayColors, sectionMap, tableGuestNames, tableBookingMap, tableUpcomingMap])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const SortButton = ({ column, label }: { column: SortKey; label: string }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => toggleSort(column)}
    >
      {label}
      <ArrowUpDown className={cn(
        'w-3 h-3',
        sortKey === column ? 'text-foreground' : 'text-muted-foreground/50'
      )} />
    </button>
  )

  // Stats
  const totalTables = tables.length
  const availableCount = tables.filter(t => (tableDisplayColors[t.id] || 'green') === 'green').length
  const occupiedCount = tables.filter(t => {
    const c = tableDisplayColors[t.id]
    return c === 'red' || c === 'flashing-red'
  }).length
  const reservedCount = tables.filter(t => (tableDisplayColors[t.id]) === 'reserved-upcoming').length

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background relative">

      {/* Top Container - Row 2: Sections, Time, Info Button - All same height (h-10) */}
      <div className="border-b px-4 py-2 flex-shrink-0 bg-background" data-ui>
        {/* Row 2: Sections, Time (right), Info Button - All same height (h-10) */}
        <div className="flex items-center gap-2 h-10">
          {/* Section Selector - Scrollable text with underline for selected */}
          <div className="flex-1 min-w-0 h-10 relative">
            <div className="absolute inset-0 overflow-x-auto overflow-y-hidden scrollbar-hide touch-action-pan-x">
              <div className="flex items-center gap-4 h-10" style={{ width: 'max-content', minWidth: '100%' }}>
                {/* All Sections */}
                <button
                  onClick={() => onSectionChange('all')}
                  className={cn(
                    "text-sm font-medium whitespace-nowrap flex-shrink-0 h-10 flex items-center px-2 touch-target transition-colors",
                    activeSection === 'all'
                      ? "text-foreground underline decoration-2 underline-offset-4"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All
                </button>

                {/* Section items */}
                {sections.map((section) => {
                  const cap = sectionCapacities?.[section.id]
                  const hasCapacity = cap && cap.max > 0
                  const totalCommitted = cap ? cap.seated + cap.booked : 0
                  const committedPct = hasCapacity ? Math.round((totalCommitted / cap.max) * 100) : null
                  const seatedPct = hasCapacity ? (cap.seated / cap.max) * 100 : 0
                  const bookedPct = hasCapacity ? (cap.booked / cap.max) * 100 : 0
                  const isActive = activeSection === section.id
                  return (
                    <button
                      key={section.id}
                      onClick={() => onSectionChange(section.id)}
                      className={cn(
                        "text-sm font-medium whitespace-nowrap flex-shrink-0 h-10 flex flex-col items-center justify-center px-2 touch-target transition-colors",
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className={isActive ? 'underline decoration-2 underline-offset-4' : ''}>{section.name}</span>
                      {/* Segmented micro-bar: solid = seated, lighter = booked */}
                      {committedPct !== null && (
                        <span
                          className={cn(
                            'w-full h-[3px] rounded-full overflow-hidden flex mt-0.5',
                            committedPct < 70 ? 'bg-[hsl(var(--status-available)/.12)]' :
                            committedPct < 90 ? 'bg-[hsl(var(--status-overstay)/.12)]' :
                            'bg-[hsl(var(--status-taken)/.12)]'
                          )}
                        >
                          {seatedPct > 0 && (
                            <span
                              className={cn(
                                'h-full rounded-l-full',
                                committedPct < 70 ? 'bg-[hsl(var(--status-available))]' :
                                committedPct < 90 ? 'bg-[hsl(var(--status-overstay))]' :
                                'bg-[hsl(var(--status-taken))]'
                              )}
                              style={{ width: `${Math.min(seatedPct, 100)}%` }}
                            />
                          )}
                          {bookedPct > 0 && (
                            <span
                              className={cn(
                                'h-full',
                                seatedPct === 0 && 'rounded-l-full',
                                committedPct < 70 ? 'bg-[hsl(var(--status-available)/.45)]' :
                                committedPct < 90 ? 'bg-[hsl(var(--status-overstay)/.45)]' :
                                'bg-[hsl(var(--status-taken)/.45)]'
                              )}
                              style={{ width: `${Math.min(bookedPct, 100 - Math.min(seatedPct, 100))}%` }}
                            />
                          )}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Separator line */}
          {(selectedTime || (shifts && shifts.length > 0)) && (
            <div className="h-10 w-px bg-border flex-shrink-0" />
          )}

          {/* Shift Selector */}
          {onShiftChange && shifts && (
            <ShiftSelector
              shifts={shifts}
              selectedShiftId={selectedShiftId ?? null}
              selectedDate={selectedDate ?? new Date()}
              onShiftChange={onShiftChange}
            />
          )}

          {/* Time Selector - Right of sections, styled like date but clickable */}
          {selectedTime && onTimeChange && (() => {
            const { hour12, minutes, ampm } = get12HourTime(selectedTime)
            return (
              <Popover open={isTimePopoverOpen} onOpenChange={setIsTimePopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    aria-label={`Selected time: ${String(hour12)}:${String(minutes).padStart(2, '0')} ${ampm}. Click to change.`}
                    className="flex-shrink-0 h-10 flex items-center gap-1.5 px-2 hover:bg-muted/50 rounded transition-colors cursor-pointer"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium whitespace-nowrap tabular-nums">
                      {String(hour12)}:{String(minutes).padStart(2, '0')} {ampm}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-3 pointer-events-auto z-[60] max-h-[calc(100vh-120px-env(safe-area-inset-bottom,0px))] overflow-y-auto" 
                  align="end"
                  sideOffset={8}
                  avoidCollisions={true}
                  collisionPadding={{ bottom: 20 }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onPointerMove={(e) => e.stopPropagation()}
                >
                  <div className="space-y-3">
                    {shiftWindow && selectedShift && (
                      <div className="px-1 -mt-1 text-xs text-muted-foreground">
                        Clamped to <span className="font-semibold text-foreground">{selectedShift.name}</span> window
                      </div>
                    )}
                    <p className="text-xs font-medium text-muted-foreground">Hour</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {Array.from({ length: 12 }, (_, i) => {
                        const hour = i + 1
                        let hourDisabled = false
                        if (shiftWindow) {
                          const candidate = to24Hour(hour, tempMinutesRef.current, tempAmPmRef.current)
                          const candidateMin = parseTimeToMinutes(candidate)
                          hourDisabled = candidateMin < shiftWindow.start || candidateMin >= shiftWindow.end
                        }
                        return (
                          <button
                            key={hour}
                            type="button"
                            disabled={hourDisabled}
                            onClick={() => {
                              if (hourDisabled) return
                              const newHour = hour
                              setTempHour(newHour)
                              const newTime = to24Hour(newHour, tempMinutes, tempAmPm)
                              onTimeChange(newTime)
                            }}
                            className={cn(
                              "h-10 w-10 rounded-md text-sm font-medium transition-colors",
                              tempHour === hour ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground",
                              hourDisabled && "opacity-30 cursor-not-allowed hover:bg-transparent"
                            )}
                            aria-disabled={hourDisabled}
                          >
                            {hour}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">Minute</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[0, 15, 30, 45].map((m) => {
                        let minuteDisabled = false
                        if (shiftWindow) {
                          const candidate = to24Hour(tempHourRef.current, m, tempAmPmRef.current)
                          const candidateMin = parseTimeToMinutes(candidate)
                          minuteDisabled = candidateMin < shiftWindow.start || candidateMin >= shiftWindow.end
                        }
                        return (
                          <button
                            key={m}
                            type="button"
                            disabled={minuteDisabled}
                            onClick={() => {
                              if (minuteDisabled) return
                              const newMinutes = m
                              setTempMinutes(newMinutes)
                              const newTime = to24Hour(tempHour, newMinutes, tempAmPm)
                              onTimeChange(newTime)
                            }}
                            className={cn(
                              "h-10 rounded-md text-sm font-medium transition-colors",
                              tempMinutes === m ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground",
                              minuteDisabled && "opacity-30 cursor-not-allowed hover:bg-transparent"
                            )}
                            aria-disabled={minuteDisabled}
                          >
                            :{String(m).padStart(2, '0')}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">AM/PM</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['AM', 'PM'].map((period) => {
                        let ampmDisabled = false
                        if (shiftWindow) {
                          const candidate = to24Hour(tempHourRef.current, tempMinutesRef.current, period)
                          const candidateMin = parseTimeToMinutes(candidate)
                          ampmDisabled = candidateMin < shiftWindow.start || candidateMin >= shiftWindow.end
                        }
                        return (
                          <button
                            key={period}
                            type="button"
                            disabled={ampmDisabled}
                            onClick={() => {
                              if (ampmDisabled) return
                              const newAmPm = period as 'AM' | 'PM'
                              setTempAmPm(newAmPm)
                              const newTime = to24Hour(tempHour, tempMinutes, newAmPm)
                              onTimeChange(newTime)
                            }}
                            className={cn(
                              "h-10 rounded-md text-sm font-medium transition-colors",
                              tempAmPm === period ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground",
                              ampmDisabled && "opacity-30 cursor-not-allowed hover:bg-transparent"
                            )}
                            aria-disabled={ampmDisabled}
                          >
                            {period}
                          </button>
                        )
                      })}
                    </div>
                    {/* Now button — always jumps to the live current time.
                        When a shift is active, the parent's onNow clears the
                        shift filter so the time isn't immediately re-clamped. */}
                    <button
                      type="button"
                      onClick={() => {
                        if (onNow) {
                          onNow()
                        } else {
                          onTimeChange(format(new Date(), 'HH:mm'))
                        }
                        setIsTimePopoverOpen(false)
                      }}
                      className="w-full h-10 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mt-2"
                    >
                      Now
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            )
          })()}
        </div>
      </div>


      {/* Search + Stats bar - Same row, compact */}
      <div className="border-b px-4 py-1.5 flex items-center gap-3">
        <div className="relative flex-1 min-w-0 max-[640px]:w-full min-[641px]:max-w-[280px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
          <span className="font-medium text-foreground">{totalTables} tables</span>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-status-available" />
            {availableCount} available
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-status-taken" />
            {occupiedCount} occupied
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--booking-seated))]" />
            {reservedCount} reserved
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[100px]">
                <SortButton column="table_number" label="Table" />
              </TableHead>
              <TableHead className="w-[120px]">
                <SortButton column="status" label="Status" />
              </TableHead>
              <TableHead className="w-[140px]">
                <SortButton column="section" label="Section" />
              </TableHead>
              <TableHead className="w-[80px] text-center">
                <SortButton column="capacity" label="Seats" />
              </TableHead>
              <TableHead>
                <SortButton column="guest" label="Guest" />
              </TableHead>
              <TableHead className="w-[160px]">
                <SortButton column="time" label="Upcoming" />
              </TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((table) => {
              const displayColor = tableDisplayColors[table.id] || 'green'
              const guestName = tableGuestNames[table.id]
              const isLate = tableLateArrivals[table.id]
              const currentBooking = tableBookingMap[table.id]
              const upcomingBooking = tableUpcomingMap[table.id]
              const section = table.section_id ? sectionMap[table.section_id] : null
              const matchesSelectedBooking = !!selectedBookingId && (
                currentBooking?.id === selectedBookingId || upcomingBooking?.id === selectedBookingId
              )
              const isSelected = selectedTableId === table.id || matchesSelectedBooking

              // Seated timer logic with Expected End Time and color states
              let seatedDuration: string | null = null
              let timerColor: 'green' | 'yellow' | 'red' | 'flashing-red' = 'green'
              let isFlashing = false
              
              if (currentBooking?.seated_at) {
                const seatedAt = new Date(currentBooking.seated_at)
                // Use actual current time — seated timer is a real-time elapsed counter
                const now = new Date()

                // Calculate time seated (counting up) — floor to 0 to prevent negative display
                const minutesSeated = Math.max(0, differenceInMinutes(now, seatedAt))

                // Find next booking on this table
                const nextBooking = upcomingBooking || null

                // Determine Expected End Time
                let expectedEndTime: Date
                if (nextBooking) {
                  expectedEndTime = new Date(nextBooking.booking_time)
                } else {
                  const bookingTurnoverTime = currentBooking.turn_time_minutes || restaurantTurnoverTime
                  expectedEndTime = new Date(seatedAt.getTime() + bookingTurnoverTime * 60 * 1000)
                }

                // Calculate time remaining until Expected End
                const minutesRemaining = differenceInMinutes(expectedEndTime, now)

                // Determine timer color based on time remaining
                if (minutesRemaining < 0) {
                  timerColor = 'flashing-red'
                  isFlashing = true
                } else if (minutesRemaining < 15) {
                  timerColor = 'red'
                } else if (minutesRemaining < 30) {
                  timerColor = 'yellow'
                } else {
                  timerColor = 'green'
                }

                // Format seated duration
                const hours = Math.floor(minutesSeated / 60)
                const mins = minutesSeated % 60
                seatedDuration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
              }

              return (
                <TableRow
                  key={table.id}
                  className={cn(
                    'cursor-pointer transition-colors',
                    isSelected && 'bg-primary/5 border-l-2 border-l-primary',
                    !isSelected && 'hover:bg-muted/50'
                  )}
                  onClick={() => onSelectTable(table.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    onDropBookingOnTable(table.id)
                  }}
                >
                  <TableCell className="font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">T{table.table_number}</span>
                      <span className="text-[10px] text-muted-foreground capitalize">{table.table_type}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="secondary"
                        className={cn('text-[10px] px-2 py-0.5 font-medium', statusColors[displayColor])}
                      >
                        {statusLabels[displayColor]}
                      </Badge>
                      {isLate && (
                        <span className="text-[10px] text-destructive font-bold motion-safe:animate-pulse">LATE</span>
                      )}
                      {selectedShift && tableShiftPills?.[table.id] && tableShiftPills[table.id].length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {tableShiftPills[table.id].slice(0, 4).map((pill) => {
                            const spansBefore = pill.classification === 'spans_before' || pill.classification === 'spans_both'
                            const spansAfter = pill.classification === 'spans_after' || pill.classification === 'spans_both'
                            return (
                              <span
                                key={pill.bookingId}
                                className="inline-flex items-center gap-0.5 px-1.5 h-[18px] rounded-full bg-muted text-[10px] font-semibold text-foreground tabular-nums"
                                title={`${pill.status}${spansBefore ? ' (spans before shift)' : ''}${spansAfter ? ' (spans after shift)' : ''}`}
                              >
                                {spansBefore && <span aria-hidden>‹</span>}
                                {(() => {
                                  const [h, m] = pill.time.split(':').map(Number)
                                  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
                                  return `${hour12}:${String(m).padStart(2, '0')}`
                                })()}
                                {spansAfter && <span aria-hidden>›</span>}
                              </span>
                            )
                          })}
                          {tableShiftPills[table.id].length > 4 && (
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              +{tableShiftPills[table.id].length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {section ? (
                      <span className="text-sm text-muted-foreground">{section.name}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm tabular-nums">{table.max_capacity}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {guestName ? (
                      <div className="space-y-0.5">
                        <span className="font-medium text-sm">{guestName}</span>
                        {currentBooking && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="w-3 h-3" />
                            <span>{currentBooking.party_size}</span>
                            {seatedDuration && (
                              <>
                                <span>•</span>
                                <Timer className={cn(
                                  "w-3 h-3",
                                  timerColor === 'green' && 'text-[hsl(var(--status-available))]',
                                  timerColor === 'yellow' && 'text-[hsl(var(--status-highlight))]',
                                  timerColor === 'red' && 'text-[hsl(var(--status-taken))]',
                                  timerColor === 'flashing-red' && 'text-[hsl(var(--status-taken))]',
                                  isFlashing && 'motion-safe:animate-pulse'
                                )} />
                                <span className={cn(
                                  "tabular-nums",
                                  timerColor === 'green' && 'text-[hsl(var(--status-available))]',
                                  timerColor === 'yellow' && 'text-[hsl(var(--status-highlight))]',
                                  timerColor === 'red' && 'text-[hsl(var(--status-taken))]',
                                  timerColor === 'flashing-red' && 'text-[hsl(var(--status-taken))]',
                                  isFlashing && 'motion-safe:animate-pulse'
                                )}>{seatedDuration}</span>
                                {timerColor === 'flashing-red' && <Badge className="bg-destructive text-white text-[10px] ml-1 shadow-sm motion-safe:animate-pulse">Past Expected End</Badge>}
                              </>
                            )}
                          </div>
                        )}
                        {/* Inline progress bar: elapsed → expected end.
                            Neutral foreground fill (matches text color) so it doesn't
                            conflict with the red "Occupied" status badge above. */}
                        {tableProgress?.[table.id] && (() => {
                          const p = tableProgress[table.id]!
                          return (
                            <div
                              className="w-40 max-w-full mt-1"
                              role="progressbar"
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={Math.round(p.rawPercent)}
                              aria-label={
                                p.isOverstay
                                  ? `Overstay: ${Math.max(0, -p.minutesRemaining)} minutes past expected end`
                                  : `Seating progress ${Math.round(p.percent)}%, ${Math.max(0, p.minutesRemaining)} minutes remaining`
                              }
                            >
                              <div className={cn(
                                'h-[3px] rounded-full bg-muted overflow-hidden',
                                p.isOverstay && 'ring-1 ring-destructive/40'
                              )}>
                                <div
                                  className={cn(
                                    'h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300',
                                    p.isOverstay
                                      ? 'bg-destructive motion-safe:animate-pulse'
                                      : p.state === 'ending_soon'
                                        ? 'bg-[hsl(var(--status-highlight))]'
                                        : 'bg-foreground/70'
                                  )}
                                  style={{ width: p.isOverstay ? '100%' : `${p.percent}%` }}
                                />
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {upcomingBooking ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock className="w-3 h-3 text-primary" />
                          <span className="font-medium tabular-nums">
                            {format(new Date(upcomingBooking.booking_time), 'h:mm a')}
                          </span>
                          <span className="text-muted-foreground">
                            {upcomingBooking.guest_name || upcomingBooking.user?.full_name || 'Guest'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Users className="w-2.5 h-2.5" />
                          <span>{upcomingBooking.party_size}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs px-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectTable(table.id)
                      }}
                    >
                      <MapPin className="w-3.5 h-3.5 mr-1" />
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {searchQuery ? 'No tables matching your search' : 'No tables in this section'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Unassigned Bookings Section */}
        {unassignedBookings.length > 0 && (
          <div className="border-t">
            <div className="px-4 py-2 bg-muted/30 border-b">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Unassigned Bookings ({unassignedBookings.length})
              </span>
            </div>
            <Table>
              <TableHeader className="bg-background">
                <TableRow>
                  <TableHead className="w-[120px]">Time</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead className="w-[80px] text-center">Party</TableHead>
                  <TableHead className="w-[140px]">Section Pref</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unassignedBookings.map((booking) => {
                  const gName = booking.guest_name || booking.user?.full_name || 'Guest'
                  const bTime = new Date(booking.booking_time)
                  const isSelected = selectedBookingId === booking.id
                  const prefSection = booking.preferred_section || (booking.section_id ? sectionMap[booking.section_id]?.name : null)

                  const bookingStatusColors: Record<string, string> = {
                    pending: 'bg-[hsl(var(--booking-pending)/.12)] text-[hsl(var(--booking-pending))]',
                    confirmed: 'bg-[hsl(var(--booking-confirmed)/.12)] text-[hsl(var(--booking-confirmed))]',
                    arrived: 'bg-[hsl(var(--booking-seated)/.12)] text-[hsl(var(--booking-seated))]',
                  }

                  return (
                    <TableRow
                      key={booking.id}
                      className={cn(
                        'cursor-pointer transition-colors',
                        isSelected && 'bg-primary/5 border-l-2 border-l-primary',
                        !isSelected && 'hover:bg-muted/50'
                      )}
                      onClick={() => onSelectBooking?.(booking.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium tabular-nums">
                            {format(bTime, 'h:mm a')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn('text-[10px] px-2 py-0.5 font-medium capitalize', bookingStatusColors[booking.status] || 'bg-muted text-muted-foreground')}
                        >
                          {booking.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-sm">{gName}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm tabular-nums">{booking.party_size}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {prefSection ? (
                          <span className="text-sm text-muted-foreground">{prefSection}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectBooking?.(booking.id)
                          }}
                        >
                          Assign
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
