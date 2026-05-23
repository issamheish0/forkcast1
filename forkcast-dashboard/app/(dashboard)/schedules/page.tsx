"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format, startOfWeek, endOfWeek } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Calendar,
  CalendarClock,
  Clock,
  Users,
  Plus,
  Search,
  Filter,
  BarChart3,
  UserCheck,
  Timer,
  DollarSign,
  Settings,
  Download
} from "lucide-react"
import { restaurantAuth } from "@/lib/restaurant-auth"
import { createClient } from "@/lib/supabase/client"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { staffSchedulingService } from "@/lib/services/staff-scheduling"
import { ScheduleCalendar } from "@/components/staff/schedule-calendar"
import { ShiftForm } from "@/components/staff/shift-form"
import { TimeClock } from "@/components/staff/time-clock"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import type { StaffShift, RestaurantStaff, TimeClockEntry, StaffPosition } from "@/types"
import { toast } from "react-hot-toast"

export default function SchedulesPage() {
  const router = useRouter()
  const supabase = createClient()
  const { currentRestaurant, isLoading: contextLoading } = useRestaurantContext()
  const restaurantId = currentRestaurant?.restaurant.id
  
  // State
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [currentStaff, setCurrentStaff] = useState<any>(null)
  const [staffMembers, setStaffMembers] = useState<RestaurantStaff[]>([])
  const [shifts, setShifts] = useState<StaffShift[]>([])
  const [timeClockEntries, setTimeClockEntries] = useState<TimeClockEntry[]>([])
  const [positions, setPositions] = useState<StaffPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState("calendar")
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStaffId, setSelectedStaffId] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  
  // Modal states
  const [isShiftFormOpen, setIsShiftFormOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<StaffShift | null>(null)
  const [shiftFormInitialDate, setShiftFormInitialDate] = useState<string>("")
  const [shiftFormInitialStaffId, setShiftFormInitialStaffId] = useState<string>("")
  const [shiftToDelete, setShiftToDelete] = useState<StaffShift | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const loadStaffMembers = useCallback(async (restaurantId: string) => {
    try {
      const data = await staffSchedulingService.getRestaurantStaff(restaurantId)
      setStaffMembers(data)
    } catch (error) {
      console.error('Error loading staff members:', error)
      toast.error('Failed to load staff members')
    }
  }, [])

  const loadShifts = useCallback(async (restaurantId: string) => {
    try {
      const weekStart = startOfWeek(new Date())
      const weekEnd = endOfWeek(new Date())
      
      const data = await staffSchedulingService.getStaffShifts(restaurantId, {
        startDate: format(weekStart, 'yyyy-MM-dd'),
        endDate: format(weekEnd, 'yyyy-MM-dd')
      })
      setShifts(data)
    } catch (error) {
      console.error('Error loading shifts:', error)
      toast.error('Failed to load shifts')
    }
  }, [])

  const loadTimeClockEntries = useCallback(async (restaurantId: string) => {
    try {
      // Load today's entries for general display
      const today = format(new Date(), 'yyyy-MM-dd')
      const todayData = await staffSchedulingService.getTimeClockEntries(restaurantId, {
        startDate: today,
        endDate: today
      })
      
      // Also load all active entries (regardless of date) for accurate stats
      const activeData = await staffSchedulingService.getTimeClockEntries(restaurantId, {
        status: 'active'
      })
      
      // Combine both datasets, removing duplicates
      const allEntries = [...todayData]
      activeData.forEach(activeEntry => {
        if (!allEntries.find(entry => entry.id === activeEntry.id)) {
          allEntries.push(activeEntry)
        }
      })
      
      setTimeClockEntries(allEntries)
    } catch (error) {
      console.error('Error loading time clock entries:', error)
      toast.error('Failed to load time clock entries')
    }
  }, [])

  const loadPositions = useCallback(async (restaurantId: string) => {
    try {
      const data = await staffSchedulingService.getStaffPositions(restaurantId)
      setPositions(data)
    } catch (error) {
      console.error('Error loading positions:', error)
    }
  }, [])

  // Check permissions on mount
  useEffect(() => {
    if (!contextLoading && currentRestaurant) {
      const hasPermission = restaurantAuth.hasPermission(
        currentRestaurant.permissions,
        'schedules.view',
        currentRestaurant.role
      )
      
      if (!hasPermission) {
        toast.error("You don't have permission to view schedules")
        router.push('/bookings')
      }
    } else if (!contextLoading && !currentRestaurant) {
      router.push('/bookings')
    }
  }, [contextLoading, currentRestaurant, router])

  const loadInitialData = useCallback(async () => {
    if (!restaurantId) return
    
    try {
      setLoading(true)

      // Get current user
      const { data: { user } }:any = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUser(user)

      // Get current staff data for this restaurant
      const { data: staffData, error: staffError } = await supabase
        .from('restaurant_staff')
        .select(`
          id,
          role,
          permissions,
          restaurant_id,
          user_id
        `)
        .eq('user_id', user.id)
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .single()

      if (staffError || !staffData) {
        toast.error("You don't have access to schedules")
        router.push('/bookings')
        return
      }

      setCurrentStaff(staffData)

      // Load data in parallel
      await Promise.all([
        loadStaffMembers(restaurantId),
        loadShifts(restaurantId),
        loadTimeClockEntries(restaurantId),
        loadPositions(restaurantId)
      ])

    } catch (error) {
      console.error('Error loading initial data:', error)
      toast.error('Failed to load schedule data')
    } finally {
      setLoading(false)
    }
  }, [restaurantId, supabase, router, loadStaffMembers, loadShifts, loadTimeClockEntries, loadPositions])

  useEffect(() => {
    if (restaurantId) {
      loadInitialData()
    }
  }, [loadInitialData])

  const handleCreateShift = (date?: string, staffId?: string) => {
    setShiftFormInitialDate(date || "")
    setShiftFormInitialStaffId(staffId || "")
    setEditingShift(null)
    setIsShiftFormOpen(true)
  }

  const handleEditShift = (shift: StaffShift) => {
    setEditingShift(shift)
    setShiftFormInitialDate("")
    setShiftFormInitialStaffId("")
    setIsShiftFormOpen(true)
  }

  const handleShiftFormSuccess = () => {
    // Trigger refresh of the calendar
    setRefreshTrigger(prev => prev + 1)
    
    // Also reload the parent data
    if (restaurantId) {
      loadShifts(restaurantId)
      loadTimeClockEntries(restaurantId)
    }
  }

  const handleDeleteShift = async (shift: StaffShift) => {
    if (!canManageSchedules) {
      toast.error("You don't have permission to delete shifts")
      return
    }

    // Check if the shift has any time clock entries
    try {
      const { data: entries, error } = await supabase
        .from('time_clock_entries')
        .select('id, status')
        .eq('shift_id', shift.id)

      if (error) {
        console.error('Error checking time clock entries:', error)
        toast.error('Failed to check shift dependencies')
        return
      }

      // If there are active time clock entries, prevent deletion
      if (entries && entries.length > 0) {
        const activeEntries = entries.filter(entry => entry.status === 'active')
        if (activeEntries.length > 0) {
          toast.error('Cannot delete shift: Staff member is currently clocked in for this shift')
          return
        }
        
        // If there are completed time clock entries, show a warning
        if (entries.length > 0) {
          const confirmed = window.confirm(
            `This shift has ${entries.length} time clock entries. Deleting the shift will also remove these time tracking records. Are you sure you want to continue?`
          )
          if (!confirmed) return
        }
      }
    } catch (error) {
      console.error('Error checking shift dependencies:', error)
      toast.error('Failed to verify shift can be deleted')
      return
    }

    setShiftToDelete(shift)
  }

  const confirmDeleteShift = async () => {
    if (!shiftToDelete || !restaurantId) return

    try {
      setIsDeleting(true)
      await staffSchedulingService.deleteStaffShift(shiftToDelete.id)
      toast.success('Shift deleted successfully')
      
      // Trigger refresh of the calendar
      setRefreshTrigger(prev => prev + 1)
      
      // Also reload the parent data
      loadShifts(restaurantId)
      loadTimeClockEntries(restaurantId)
      setShiftToDelete(null)
    } catch (error: any) {
      console.error('Error deleting shift:', error)
      toast.error(error.message || 'Failed to delete shift')
    } finally {
      setIsDeleting(false)
    }
  }

  // Filtered staff members
  const filteredStaffMembers = useMemo(() => {
    return staffMembers.filter(staff => {
      const matchesSearch = !searchQuery || 
        staff.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.user?.email?.toLowerCase().includes(searchQuery.toLowerCase())
      
      return matchesSearch
    })
  }, [staffMembers, searchQuery])

  // Current staff member for time clock
  const currentStaffMember = staffMembers.find(staff => staff.user_id === currentUser?.id)

  // Permission checks
  // For basic tier, allow staff with schedules.view permission to manage schedules
  // For pro tier, require schedules.manage permission
  const canManageSchedules = !!(currentRestaurant && (
    currentRestaurant.restaurant.tier === 'basic'
      ? restaurantAuth.hasPermission(
          currentRestaurant.permissions,
          'schedules.view',
          currentRestaurant.role
        )
      : restaurantAuth.hasPermission(
          currentRestaurant.permissions,
          'schedules.manage',
          currentRestaurant.role
        )
  ))

  // Statistics
  const stats = useMemo(() => {
    const totalShifts = shifts.length
    const activeClockIns = timeClockEntries.filter(entry => entry.status === 'active').length
    const scheduledToday = shifts.filter(shift => 
      shift.shift_date === format(new Date(), 'yyyy-MM-dd')
    ).length
    const totalHours = timeClockEntries.reduce((sum, entry) => 
      sum + (entry.total_hours || 0), 0
    )

    return {
      totalShifts,
      activeClockIns,
      scheduledToday,
      totalHours: Number(totalHours.toFixed(1))
    }
  }, [shifts, timeClockEntries])

  if (contextLoading || loading) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex-shrink-0 px-3 py-2 border-b bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-md" />
              <div>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        
        <div className="flex-shrink-0 px-3 py-2 border-b">
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-full" />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!currentRestaurant || !restaurantId) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-gray-600">No restaurant selected.</p>
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
            <div className="w-8 h-8 rounded-md bg-rose-500 flex items-center justify-center">
              <CalendarClock className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Staff Schedules</h1>
              <p className="text-xs text-muted-foreground">Shifts & time tracking</p>
            </div>
          </div>
          {canManageSchedules && (
            <Button size="sm" className="h-8 text-xs" onClick={() => handleCreateShift()}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create Shift
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats Pills */}
      <div className="flex-shrink-0 px-3 py-2 border-b">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <div className="px-3 py-1.5 rounded-full bg-rose-100 text-rose-700 text-xs font-medium whitespace-nowrap">
            {stats.totalShifts} This Week
          </div>
          <div className="px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-medium whitespace-nowrap">
            {stats.activeClockIns} Clocked In
          </div>
          <div className="px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium whitespace-nowrap">
            {stats.scheduledToday} Today
          </div>
          <div className="px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium whitespace-nowrap">
            {stats.totalHours}h Worked
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="h-full flex flex-col">
          <div className="flex-shrink-0 px-3 py-2 border-b">
            <TabsList className="w-full h-10">
              <TabsTrigger value="calendar" className="flex-1 flex items-center justify-center gap-1.5 text-xs">
                <Calendar className="h-3.5 w-3.5" />
                <span>Calendar</span>
              </TabsTrigger>
              <TabsTrigger value="timeclock" className="flex-1 flex items-center justify-center gap-1.5 text-xs">
                <Clock className="h-3.5 w-3.5" />
                <span>Time Clock</span>
              </TabsTrigger>
              {canManageSchedules && (
                <TabsTrigger value="management" className="flex-1 flex items-center justify-center gap-1.5 text-xs">
                  <Settings className="h-3.5 w-3.5" />
                  <span>Manage</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {/* Schedule Calendar Tab */}
          <TabsContent value="calendar" className="flex-1 flex flex-col overflow-hidden m-0">
            {/* Compact Filters */}
            <div className="flex-shrink-0 px-3 py-2 border-b bg-muted/30">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search staff..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-7 h-8 text-xs"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                    <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs flex-1 sm:flex-none">
                      <SelectValue placeholder="All Staff" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Staff</SelectItem>
                      {filteredStaffMembers.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.user?.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-full sm:w-[120px] h-8 text-xs flex-1 sm:flex-none">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Schedule Calendar */}
            <div className="flex-1 overflow-y-auto p-3">
              <ScheduleCalendar
            restaurantId={restaurantId}
            staffMembers={filteredStaffMembers}
            selectedStaffId={selectedStaffId === "all" ? undefined : selectedStaffId}
            onCreateShift={canManageSchedules ? handleCreateShift : undefined}
            onEditShift={canManageSchedules ? handleEditShift : undefined}
                onDeleteShift={canManageSchedules ? handleDeleteShift : undefined}
                refreshTrigger={refreshTrigger}
              />
            </div>
          </TabsContent>

          {/* Time Clock Tab */}
          <TabsContent value="timeclock" className="flex-1 overflow-y-auto p-3 m-0">
            {currentStaffMember && restaurantId ? (
              <TimeClock
                restaurantId={restaurantId}
                currentStaff={currentStaffMember}
                onTimeClockChange={() => {
                  // Refresh time clock entries when clock in/out happens
                  if (restaurantId) loadTimeClockEntries(restaurantId)
                }}
              />
            ) : (
              <Card>
                <CardContent className="p-4 text-center">
                  <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <h3 className="text-sm font-semibold mb-1">Time Clock Unavailable</h3>
                  <p className="text-muted-foreground text-xs">
                    You need to be registered as a staff member to use the time clock.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Management Tab */}
          {canManageSchedules && (
            <TabsContent value="management" className="flex-1 overflow-y-auto p-3 m-0">
              <div className="grid gap-3 md:grid-cols-2">
                {/* Quick Actions */}
                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-2">
                    <Button 
                      onClick={() => handleCreateShift()}
                      className="w-full justify-start h-8 text-xs"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Create New Shift
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => restaurantId && loadShifts(restaurantId)}
                      className="w-full justify-start h-8 text-xs"
                    >
                      <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                      View Reports
                    </Button>
                    <Button 
                      variant="outline"
                      className="w-full justify-start h-8 text-xs"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Export Schedule
                    </Button>
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="space-y-2">
                      {timeClockEntries.slice(0, 5).map(entry => (
                        <div key={entry.id} className="flex items-center justify-between text-xs">
                          <div>
                            <span className="font-medium">{entry.staff?.user?.full_name}</span>
                            <span className="text-muted-foreground ml-1.5">
                              clocked {entry.clock_out_time ? 'out' : 'in'}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs h-5">
                            {format(new Date(entry.clock_in_time), 'HH:mm')}
                          </Badge>
                        </div>
                      ))}
                      {timeClockEntries.length === 0 && (
                        <p className="text-muted-foreground text-center py-3 text-xs">
                          No recent activity
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Shift Form Modal */}
      <ShiftForm
        open={isShiftFormOpen}
        onOpenChange={setIsShiftFormOpen}
        restaurantId={restaurantId}
        staffMembers={staffMembers}
        positions={positions}
        shift={editingShift}
        initialDate={shiftFormInitialDate}
        initialStaffId={shiftFormInitialStaffId}
        onSuccess={handleShiftFormSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!shiftToDelete}
        onOpenChange={(open) => !open && setShiftToDelete(null)}
        title="Delete Shift"
        description={
          shiftToDelete 
            ? `Are you sure you want to delete the shift for ${shiftToDelete.staff?.user?.full_name || 'Unknown'} on ${format(new Date(shiftToDelete.shift_date), 'MMM d, yyyy')} from ${shiftToDelete.start_time} to ${shiftToDelete.end_time}? This action cannot be undone.`
            : "Are you sure you want to delete this shift?"
        }
        confirmText="Delete Shift"
        onConfirm={confirmDeleteShift}
        isLoading={isDeleting}
      />
    </div>
  )
}

