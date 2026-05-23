"use client"

import { useState, useEffect, useMemo, useRef, useCallback, memo } from "react"
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronLeft, ChevronRight, Plus, Clock, Users, User, Trash2 } from "lucide-react"
import { staffSchedulingService } from "@/lib/services/staff-scheduling"
import type { StaffShift, RestaurantStaff } from "@/types"
import { cn } from "@/lib/utils"

interface ScheduleCalendarProps {
  restaurantId: string
  staffMembers: RestaurantStaff[]
  onCreateShift?: (date: string, staffId?: string) => void
  onEditShift?: (shift: StaffShift) => void
  onDeleteShift?: (shift: StaffShift) => void
  selectedStaffId?: string
  refreshTrigger?: number // Add this to force refresh
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  completed: 'bg-gray-100 text-gray-800 border-gray-200',
  no_show: 'bg-orange-100 text-orange-800 border-orange-200'
}

// Memoized shift card component for better performance
const ShiftCard = memo(({ shift, onEditShift, onDeleteShift }: { 
  shift: StaffShift
  onEditShift?: (shift: StaffShift) => void
  onDeleteShift?: (shift: StaffShift) => void
}) => {
  const hasActiveTimeEntry = shift.time_clock_entries?.some(entry => entry.status === 'active')
  
  return (
    <div
      className={cn(
        "p-2 rounded border text-xs hover:shadow-sm transition-shadow group relative cursor-pointer",
        STATUS_COLORS[shift.status]
      )}
      onClick={() => onEditShift?.(shift)}
    >
      <div className="font-medium truncate">
        {shift.start_time} - {shift.end_time}
        {hasActiveTimeEntry && (
          <span className="ml-1 inline-block w-2 h-2 bg-green-500 rounded-full motion-safe:animate-pulse" title="Currently clocked in" />
        )}
      </div>
      {shift.role && (
        <div className="text-xs opacity-75 truncate">
          {shift.role}
        </div>
      )}
      {shift.station && (
        <div className="text-xs opacity-75 truncate">
          📍 {shift.station}
        </div>
      )}
      
      {/* Delete button - show on hover */}
      {onDeleteShift && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDeleteShift(shift)
            }}
            className={cn(
              "p-1 rounded",
              hasActiveTimeEntry 
                ? "opacity-50 cursor-not-allowed" 
                : "hover:bg-red-100 text-red-600"
            )}
            title={hasActiveTimeEntry ? "Cannot delete - staff is clocked in" : "Delete shift"}
            disabled={hasActiveTimeEntry}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
})

ShiftCard.displayName = 'ShiftCard'

export function ScheduleCalendar({ 
  restaurantId, 
  staffMembers, 
  onCreateShift, 
  onEditShift,
  onDeleteShift,
  selectedStaffId,
  refreshTrigger 
}: ScheduleCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [shifts, setShifts] = useState<StaffShift[]>([])
  const [loading, setLoading] = useState(true)
  const loadingRef = useRef(false)
  const lastLoadedWeekRef = useRef<string>('')

  // Memoize week calculations to prevent unnecessary re-renders
  const weekStart = useMemo(() => startOfWeek(currentDate), [currentDate])
  const weekEnd = useMemo(() => endOfWeek(currentDate), [currentDate])
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd])
  const weekStartFormatted = useMemo(() => format(weekStart, 'yyyy-MM-dd'), [weekStart])
  const weekEndFormatted = useMemo(() => format(weekEnd, 'yyyy-MM-dd'), [weekEnd])

  // Create a unique key for the current week to prevent duplicate loads
  const weekKey = useMemo(() => `${weekStartFormatted}-${weekEndFormatted}-${selectedStaffId || 'all'}`, [weekStartFormatted, weekEndFormatted, selectedStaffId])

  // Filtered staff members
  const displayStaff = useMemo(() => {
    if (selectedStaffId) {
      return staffMembers.filter(staff => staff.id === selectedStaffId)
    }
    return staffMembers
  }, [staffMembers, selectedStaffId])

  // Load shifts effect - only trigger when essential dependencies change
  useEffect(() => {
    // Reset cache when refresh is triggered
    if (refreshTrigger && refreshTrigger > 0) {
      lastLoadedWeekRef.current = ''
    }

    // Prevent duplicate loading (but allow refresh trigger to override)
    if (!restaurantId || (loadingRef.current && !refreshTrigger) || (!refreshTrigger && lastLoadedWeekRef.current === weekKey)) {
      return
    }

    const loadShifts = async () => {
      try {
        loadingRef.current = true
        setLoading(true)
        console.log('📅 Loading shifts for week:', weekStartFormatted, 'to', weekEndFormatted, refreshTrigger ? '(forced refresh)' : '')
        
        const data = await staffSchedulingService.getStaffShifts(restaurantId, {
          startDate: weekStartFormatted,
          endDate: weekEndFormatted,
          staffId: selectedStaffId
        })
        
        console.log('📅 Loaded shifts:', data.length)
        setShifts(data)
        lastLoadedWeekRef.current = weekKey
      } catch (error) {
        console.error('Error loading shifts:', error)
      } finally {
        setLoading(false)
        loadingRef.current = false
      }
    }

    loadShifts()
  }, [restaurantId, weekKey, weekStartFormatted, weekEndFormatted, selectedStaffId, refreshTrigger])

  const getShiftsForDay = useCallback((date: Date, staffId: string) => {
    return shifts.filter(shift => 
      isSameDay(parseISO(shift.shift_date), date) && 
      shift.staff_id === staffId
    )
  }, [shifts])

  const navigateWeek = useCallback((direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1))
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-6 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-6 w-6" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Array.from({ length: 16 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Desktop view with 8-column grid
  const DesktopCalendarView = () => (
    <>
      <div className="border-b bg-muted/30">
        <div className="grid grid-cols-8 gap-0">
          {/* Staff column header */}
          <div className="p-3 border-r font-medium text-sm">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>Staff</span>
            </div>
          </div>
          {/* Day headers */}
          {weekDays.map(day => (
            <div key={day.toISOString()} className="p-3 border-r font-medium text-sm text-center">
              <div>{DAYS_OF_WEEK[day.getDay()]}</div>
              <div className="text-lg">{format(day, 'd')}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto max-h-96">
        <div className="min-w-full">
          {displayStaff.map(staff => (
            <div key={staff.id} className="grid grid-cols-8 gap-0 border-b hover:bg-muted/20">
              {/* Staff member info */}
              <div className="p-3 border-r bg-muted/10 min-w-[120px]">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      {staff.user?.full_name}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize truncate">
                      {staff.role}
                    </div>
                  </div>
                </div>
              </div>

              {/* Daily shift columns */}
              {weekDays.map(day => {
                const dayShifts = getShiftsForDay(day, staff.id)
                const isToday = isSameDay(day, new Date())
                
                return (
                  <div 
                    key={`${staff.id}-${day.toISOString()}`}
                    className={cn(
                      "p-2 border-r min-h-[100px] relative",
                      isToday && "bg-blue-50/50"
                    )}
                  >
                    <div className="space-y-1">
                      {dayShifts.map(shift => (
                        <ShiftCard 
                          key={shift.id} 
                          shift={shift} 
                          onEditShift={onEditShift}
                          onDeleteShift={onDeleteShift}
                        />
                      ))}
                    </div>
                    
                    {onCreateShift && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute bottom-1 right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                        onClick={() => onCreateShift(format(day, 'yyyy-MM-dd'), staff.id)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  )

  // Mobile/Tablet view with card layout
  const MobileCalendarView = () => (
    <div className="space-y-4">
      {displayStaff.map(staff => (
        <div key={staff.id} className="border rounded-lg p-3 sm:p-4">
          {/* Staff header */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate">
                {staff.user?.full_name}
              </div>
              <div className="text-xs text-muted-foreground capitalize truncate">
                {staff.role}
              </div>
            </div>
          </div>

          {/* Days grid or list */}
          <div className="space-y-2 sm:grid sm:grid-cols-2 sm:gap-2 sm:space-y-0">
            {weekDays.map(day => {
              const dayShifts = getShiftsForDay(day, staff.id)
              const isToday = isSameDay(day, new Date())
              
              return (
                <div 
                  key={`${staff.id}-${day.toISOString()}`}
                  className={cn(
                    "p-2 rounded border text-xs",
                    isToday && "bg-blue-50/50 border-blue-200"
                  )}
                >
                  <div className="font-medium mb-1.5 text-xs sm:text-sm">
                    {DAYS_OF_WEEK[day.getDay()]} {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayShifts.length > 0 ? (
                      dayShifts.map(shift => (
                        <ShiftCard 
                          key={shift.id} 
                          shift={shift} 
                          onEditShift={onEditShift}
                          onDeleteShift={onDeleteShift}
                        />
                      ))
                    ) : (
                      <div className="text-muted-foreground text-xs py-2">
                        {onCreateShift ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-6 text-xs"
                            onClick={() => onCreateShift(format(day, 'yyyy-MM-dd'), staff.id)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Shift
                          </Button>
                        ) : (
                          'No shifts'
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3 sm:gap-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">Schedule Calendar</span>
            <span className="sm:hidden">Schedule</span>
            <Badge variant="outline" className="ml-auto sm:ml-2 text-xs sm:text-sm">
              {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d')}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1 sm:gap-2 ml-auto sm:ml-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('prev')}
              className="h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
              className="h-8 text-xs sm:text-sm px-2 sm:px-3"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('next')}
              className="h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        {/* Desktop view - hidden on small screens */}
        <div className="hidden lg:block">
          <DesktopCalendarView />
        </div>

        {/* Tablet view - show compact grid */}
        <div className="hidden sm:block lg:hidden">
          <div className="border-b bg-muted/30 p-3 text-sm font-medium">
            <div className="flex gap-2 overflow-x-auto pb-2">
              <span className="flex-shrink-0">Staff</span>
              {weekDays.map(day => (
                <div key={day.toISOString()} className="flex-shrink-0 text-center min-w-[50px]">
                  <div className="text-xs">{DAYS_OF_WEEK[day.getDay()]}</div>
                  <div className="text-sm font-bold">{format(day, 'd')}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto max-h-96">
            {displayStaff.map(staff => (
              <div key={staff.id} className="border-b p-3 hover:bg-muted/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-3 w-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      {staff.user?.full_name}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 overflow-x-auto">
                  {weekDays.map(day => {
                    const dayShifts = getShiftsForDay(day, staff.id)
                    const isToday = isSameDay(day, new Date())
                    
                    return (
                      <div 
                        key={`${staff.id}-${day.toISOString()}`}
                        className={cn(
                          "flex-shrink-0 min-w-[55px] p-1.5 rounded border text-xs",
                          isToday && "bg-blue-50/50 border-blue-200"
                        )}
                      >
                        {dayShifts.length > 0 ? (
                          <div className="space-y-0.5">
                            {dayShifts.slice(0, 2).map(shift => (
                              <div 
                                key={shift.id}
                                className="text-xs px-1 py-0.5 rounded bg-primary/10 cursor-pointer hover:bg-primary/20 truncate"
                                onClick={() => onEditShift?.(shift)}
                                title={`${shift.start_time} - ${shift.end_time}`}
                              >
                                {shift.start_time}
                              </div>
                            ))}
                            {dayShifts.length > 2 && (
                              <div className="text-xs text-muted-foreground">
                                +{dayShifts.length - 2}
                              </div>
                            )}
                          </div>
                        ) : (
                          onCreateShift && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => onCreateShift(format(day, 'yyyy-MM-dd'), staff.id)}
                              title="Add shift"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          )
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile view - card layout */}
        <div className="block sm:hidden p-3">
          <MobileCalendarView />
        </div>

        {displayStaff.length === 0 && (
          <div className="p-6 sm:p-8 text-center text-muted-foreground text-sm">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No staff members to display</p>
            <p className="text-xs">Select staff members to view their schedules</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
