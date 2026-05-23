"use client"

import { useState, useEffect, useCallback } from "react"
import { format, differenceInMinutes } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Clock, 
  LogIn, 
  LogOut, 
  Coffee, 
  Play, 
  Pause,
  User,
  MapPin,
  Timer,
  DollarSign,
  CheckCircle2,
  AlertCircle
} from "lucide-react"
import { staffSchedulingService } from "@/lib/services/staff-scheduling"
import type { TimeClockEntry, StaffShift, RestaurantStaff } from "@/types"
import { cn } from "@/lib/utils"
import { toast } from "react-hot-toast"

interface TimeClockProps {
  restaurantId: string
  currentStaff: RestaurantStaff
  onTimeClockChange?: () => void
}

export function TimeClock({ restaurantId, currentStaff, onTimeClockChange }: TimeClockProps) {
  const [currentEntry, setCurrentEntry] = useState<TimeClockEntry | null>(null)
  const [todayShifts, setTodayShifts] = useState<StaffShift[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [notes, setNotes] = useState("")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [onBreak, setOnBreak] = useState(false)

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    return () => clearInterval(timer)
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Load current active time clock entry
      const activeEntry = await staffSchedulingService.getCurrentTimeClockEntry(currentStaff.id)
      setCurrentEntry(activeEntry)

      // Load today's shifts for this staff member
      const today = format(new Date(), 'yyyy-MM-dd')
      const shifts = await staffSchedulingService.getStaffShifts(restaurantId, {
        staffId: currentStaff.id,
        startDate: today,
        endDate: today
      })
      setTodayShifts(shifts)
    } catch (error) {
      console.error('Error loading time clock data:', error)
      toast.error('Failed to load time clock data')
    } finally {
      setLoading(false)
    }
  }, [restaurantId, currentStaff.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    // Check if currently on break
    if (currentEntry?.break_start_time && !currentEntry?.break_end_time) {
      setOnBreak(true)
    } else {
      setOnBreak(false)
    }
  }, [currentEntry])

  const handleClockIn = async (shiftId?: string) => {
    try {
      setActionLoading(true)
      
      const payload: any = {
        restaurant_id: restaurantId,
        staff_id: currentStaff.id,
        clock_in_time: new Date().toISOString(),
        total_break_minutes: 0,
        overtime_hours: 0,
        status: 'active'
      }
      if (shiftId) payload.shift_id = shiftId

      const entry = await staffSchedulingService.clockIn(payload)

      setCurrentEntry(entry)
      toast.success('Clocked in successfully')
      
      // Notify parent component
      onTimeClockChange?.()
    } catch (error: any) {
      console.error('Error clocking in:', error)
      toast.error(error.message || 'Failed to clock in')
    } finally {
      setActionLoading(false)
    }
  }

  const handleClockOut = async () => {
    if (!currentEntry) return

    try {
      setActionLoading(true)
      
      const updatedEntry = await staffSchedulingService.clockOut(currentEntry.id, notes || undefined)
      setCurrentEntry(null)
      setNotes("")
      toast.success('Clocked out successfully')
      
      // Reload data to get updated shifts
      await loadData()
      
      // Notify parent component
      onTimeClockChange?.()
    } catch (error: any) {
      console.error('Error clocking out:', error)
      toast.error(error.message || 'Failed to clock out')
    } finally {
      setActionLoading(false)
    }
  }

  const handleStartBreak = async () => {
    if (!currentEntry) return

    try {
      setActionLoading(true)
      
      const updatedEntry = await staffSchedulingService.startBreak(currentEntry.id)
      setCurrentEntry(updatedEntry)
      setOnBreak(true)
      toast.success('Break started')
      
      // Notify parent component
      onTimeClockChange?.()
    } catch (error: any) {
      console.error('Error starting break:', error)
      toast.error(error.message || 'Failed to start break')
    } finally {
      setActionLoading(false)
    }
  }

  const handleEndBreak = async () => {
    if (!currentEntry) return

    try {
      setActionLoading(true)
      
      const updatedEntry = await staffSchedulingService.endBreak(currentEntry.id)
      setCurrentEntry(updatedEntry)
      setOnBreak(false)
      toast.success('Break ended')
      
      // Notify parent component
      onTimeClockChange?.()
    } catch (error: any) {
      console.error('Error ending break:', error)
      toast.error(error.message || 'Failed to end break')
    } finally {
      setActionLoading(false)
    }
  }

  const calculateWorkedTime = () => {
    if (!currentEntry?.clock_in_time) return "0h 0m"
    
    const clockInTime = new Date(currentEntry.clock_in_time)
    const now = new Date()
    const totalMinutes = differenceInMinutes(now, clockInTime)
    const workMinutes = totalMinutes - (currentEntry.total_break_minutes || 0)
    
    const hours = Math.floor(workMinutes / 60)
    const minutes = workMinutes % 60
    
    return `${hours}h ${minutes}m`
  }

  const calculateBreakTime = () => {
    if (!currentEntry) return "0m"
    
    let totalBreakMinutes = currentEntry.total_break_minutes || 0
    
    // Add current break time if on break
    if (onBreak && currentEntry.break_start_time) {
      const breakStart = new Date(currentEntry.break_start_time)
      const now = new Date()
      const currentBreakMinutes = differenceInMinutes(now, breakStart)
      totalBreakMinutes += currentBreakMinutes
    }
    
    const hours = Math.floor(totalBreakMinutes / 60)
    const minutes = totalBreakMinutes % 60
    
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isClocked = !!currentEntry

  return (
    <div className="space-y-4">
      {/* Current Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Time Clock</span>
            <Badge variant={isClocked ? "default" : "secondary"}>
              {isClocked ? "Clocked In" : "Not Clocked In"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Time Display */}
          <div className="text-center">
            <div className="text-3xl font-mono font-bold">
              {format(currentTime, 'HH:mm:ss')}
            </div>
            <div className="text-muted-foreground text-sm">{format(currentTime, 'EEEE, MMMM d, yyyy')}
            </div>
          </div>

          {/* Status Information */}
          {isClocked && currentEntry && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Clocked in at:</span>
                  <div className="font-medium">
                    {format(new Date(currentEntry.clock_in_time), 'HH:mm')}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Worked time:</span>
                  <div className="font-medium">{calculateWorkedTime()}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Break time:</span>
                  <div className="font-medium">{calculateBreakTime()}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div className="flex items-center space-x-1">
                    {onBreak ? (
                      <>
                        <Pause className="h-3 w-3 text-orange-500" />
                        <span className="text-orange-600">On Break</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 text-green-500" />
                        <span className="text-green-600">Working</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Shift Information */}
              {currentEntry.shift && (
                <div className="border-t pt-3">
                  <h4 className="font-medium text-sm mb-2">Scheduled Shift</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Time:</span>
                      <div className="font-medium">
                        {currentEntry.shift.start_time} - {currentEntry.shift.end_time}
                      </div>
                    </div>
                    {currentEntry.shift.role && (
                      <div>
                        <span className="text-muted-foreground">Role:</span>
                        <div className="font-medium">{currentEntry.shift.role}</div>
                      </div>
                    )}
                    {currentEntry.shift.station && (
                      <div>
                        <span className="text-muted-foreground">Station:</span>
                        <div className="font-medium">{currentEntry.shift.station}</div>
                      </div>
                    )}
                    {currentEntry.shift.hourly_rate && (
                      <div>
                        <span className="text-muted-foreground">Rate:</span>
                        <div className="font-medium">${currentEntry.shift.hourly_rate}/hr</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-4">
            {!isClocked ? (
              <div className="space-y-3">
                {/* Clock in without shift */}
                <Button
                  onClick={() => handleClockIn()}
                  disabled={actionLoading}
                  className="w-full"
                  size="sm"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Clock In
                </Button>

                {/* Clock in with specific shift */}
                {todayShifts.length > 0 && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">
                      Or clock in for a scheduled shift:
                    </div>
                    <div className="space-y-2">
                      {todayShifts.map(shift => (
                        <Button
                          key={shift.id}
                          variant="outline"
                          onClick={() => handleClockIn(shift.id)}
                          disabled={actionLoading}
                          className="w-full justify-start"
                        >
                          <div className="flex items-center space-x-2 w-full">
                            <Timer className="h-4 w-4" />
                            <div className="flex-1 text-left">
                              <div className="font-medium">
                                {shift.start_time} - {shift.end_time}
                              </div>
                              {shift.role && (
                                <div className="text-xs text-muted-foreground text-sm">{shift.role} {shift.station && `• ${shift.station}`}
                                </div>
                              )}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Break buttons */}
                <div className="grid grid-cols-2 gap-3">
                  {!onBreak ? (
                    <Button
                      variant="outline"
                      onClick={handleStartBreak}
                      disabled={actionLoading}
                    >
                      <Coffee className="mr-2 h-4 w-4" />
                      Start Break
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={handleEndBreak}
                      disabled={actionLoading}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      End Break
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    onClick={() => loadData()}
                    disabled={actionLoading}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>

                {/* Notes for clock out */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Notes (optional)
                  </label>
                  <Textarea
                    placeholder="Any notes about your shift..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Clock out button */}
                <Button
                  onClick={handleClockOut}
                  disabled={actionLoading}
                  className="w-full"
                  size="sm"
                  variant="destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Clock Out
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Today's Shifts */}
      {todayShifts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Today's Shifts</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayShifts.map(shift => (
                <div
                  key={shift.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">
                        {shift.start_time} - {shift.end_time}
                      </div>
                      <div className="text-sm text-muted-foreground text-sm">{shift.role && <span>{shift.role}</span>}
                        {shift.station && <span> • {shift.station}</span>}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={
                      shift.status === 'completed' ? 'default' :
                      shift.status === 'confirmed' ? 'secondary' :
                      'outline'
                    }
                  >
                    {shift.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
