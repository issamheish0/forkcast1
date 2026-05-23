"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar as CalendarIcon, Clock, User, MapPin, DollarSign } from "lucide-react"
import { staffSchedulingService } from "@/lib/services/staff-scheduling"
import type { StaffShift, RestaurantStaff, StaffPosition } from "@/types"
import { cn } from "@/lib/utils"
import { toast } from "react-hot-toast"

const shiftFormSchema = z.object({
  staff_id: z.string().min(1, "Please select a staff member"),
  shift_date: z.date(),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  break_duration_minutes: z.number().min(0).max(480),
  role: z.string().optional(),
  station: z.string().optional(),
  notes: z.string().optional(),
  hourly_rate: z.number().optional(),
  status: z.enum(['scheduled', 'confirmed', 'cancelled', 'completed', 'no_show']).default('scheduled'),
})

type ShiftFormData = z.input<typeof shiftFormSchema>

interface ShiftFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurantId: string
  staffMembers: RestaurantStaff[]
  positions?: StaffPosition[]
  shift?: StaffShift | null
  initialDate?: string
  initialStaffId?: string
  onSuccess: () => void
}

export function ShiftForm({
  open,
  onOpenChange,
  restaurantId,
  staffMembers,
  positions = [],
  shift,
  initialDate,
  initialStaffId,
  onSuccess
}: ShiftFormProps) {
  const [loading, setLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  const form = useForm<ShiftFormData>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: {
      staff_id: initialStaffId || shift?.staff_id || "",
      shift_date: initialDate ? new Date(initialDate) : shift ? new Date(shift.shift_date) : new Date(),
      start_time: shift?.start_time || "09:00",
      end_time: shift?.end_time || "17:00",
      break_duration_minutes: shift?.break_duration_minutes || 30,
      role: shift?.role || "",
      station: shift?.station || "",
      notes: shift?.notes || "",
      hourly_rate: shift?.hourly_rate || undefined,
      status: shift?.status || 'scheduled',
    },
  })

  const isEditing = !!shift

  const handleSubmit = async (data: ShiftFormData) => {
    try {
      setLoading(true)

      // Get current user for created_by field
      const user = await staffSchedulingService.getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      const currentStaff = await staffSchedulingService.getCurrentStaffMember(restaurantId)

      const shiftData = {
        restaurant_id: restaurantId,
        staff_id: data.staff_id,
        shift_date: format(data.shift_date, 'yyyy-MM-dd'),
        start_time: data.start_time,
        end_time: data.end_time,
        break_duration_minutes: data.break_duration_minutes,
        role: data.role || undefined,
        station: data.station || undefined,
        notes: data.notes || undefined,
        hourly_rate: typeof data.hourly_rate === 'number' ? data.hourly_rate : undefined,
        status: data.status ?? 'scheduled',
        created_by: currentStaff.user_id,
      }

      if (isEditing && shift) {
        await staffSchedulingService.updateStaffShift(shift.id, shiftData)
        toast.success('Shift updated successfully')
      } else {
        await staffSchedulingService.createStaffShift(shiftData)
        toast.success('Shift created successfully')
      }

      onSuccess()
      onOpenChange(false)
      form.reset()
    } catch (error: any) {
      console.error('Error saving shift:', error)
      toast.error(error.message || 'Failed to save shift')
    } finally {
      setLoading(false)
    }
  }

  const validateTimeRange = () => {
    const startTime = form.watch('start_time')
    const endTime = form.watch('end_time')
    
    if (startTime && endTime) {
      const start = new Date(`2000-01-01T${startTime}:00`)
      const end = new Date(`2000-01-01T${endTime}:00`)
      
      if (end <= start) {
        form.setError('end_time', {
          type: 'manual',
          message: 'End time must be after start time'
        })
        return false
      } else {
        form.clearErrors('end_time')
        return true
      }
    }
    return true
  }

  const selectedStaff = staffMembers.find(s => s.id === form.watch('staff_id'))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>{isEditing ? 'Edit Shift' : 'Create New Shift'}</span>
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update shift details' : 'Schedule a new shift for your staff'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Staff Selection */}
              <FormField
                control={form.control}
                name="staff_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span>Staff Member</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select staff member" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {staffMembers.map((staff) => (
                          <SelectItem key={staff.id} value={staff.id}>
                            <div className="flex items-center space-x-2">
                              <div className="font-medium">{staff.user?.full_name}</div>
                              <Badge variant="outline" className="text-xs">
                                {staff.role}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date Selection */}
              <FormField
                control={form.control}
                name="shift_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center space-x-1">
                      <CalendarIcon className="h-4 w-4" />
                      <span>Date</span>
                    </FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Start Time */}
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        onBlur={() => validateTimeRange()}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* End Time */}
              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        onBlur={() => validateTimeRange()}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Break Duration */}
              <FormField
                control={form.control}
                name="break_duration_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Break (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="480"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Role/Position */}
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span>Position/Role</span>
                    </FormLabel>
                    {positions.length > 0 ? (
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select position" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {positions.map((position) => (
                            <SelectItem key={position.id} value={position.name}>
                              <div className="flex items-center space-x-2">
                                <div 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: position.color }}
                                />
                                <span>{position.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <FormControl>
                        <Input
                          placeholder="e.g., Server, Cook, Host"
                          {...field}
                        />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Station */}
              <FormField
                control={form.control}
                name="station"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center space-x-1">
                      <MapPin className="h-4 w-4" />
                      <span>Station/Area</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Bar, Kitchen, Dining Room"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Hourly Rate */}
              <FormField
                control={form.control}
                name="hourly_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center space-x-1">
                      <DollarSign className="h-4 w-4" />
                      <span>Hourly Rate (optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status (for editing) */}
              {isEditing && (
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="no_show">No Show</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any special notes or instructions for this shift..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Selected Staff Info */}
            {selectedStaff && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Staff Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <span className="ml-2 font-medium">{selectedStaff.user?.full_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Role:</span>
                    <Badge variant="outline" className="ml-2">
                      {selectedStaff.role}
                    </Badge>
                  </div>
                  {selectedStaff.user?.email && (
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <span className="ml-2">{selectedStaff.user.email}</span>
                    </div>
                  )}
                  {selectedStaff.user?.phone_number && (
                    <div>
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="ml-2">{selectedStaff.user.phone_number}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    {isEditing ? 'Update Shift' : 'Create Shift'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
