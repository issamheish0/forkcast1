'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Clock,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  Calendar
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { getRestaurantTier, isBasicTier } from '@/lib/utils/tier'

// Lebanon timezone helper functions
const LEBANON_TIMEZONE = 'Asia/Beirut'

const getTodayInLebanon = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: LEBANON_TIMEZONE })
}

const getTomorrowInLebanon = () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow.toLocaleDateString('en-CA', { timeZone: LEBANON_TIMEZONE })
}

const formatDateForLebanon = (dateString: string) => {
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString('en', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: LEBANON_TIMEZONE
  })
}

// Types
interface WaitlistSchedule {
  id: string
  restaurant_id: string
  waitlist_date: string // ISO date format (YYYY-MM-DD)
  start_time: string    // HH:MM:SS format
  end_time: string      // HH:MM:SS format
  is_active: boolean
  name?: string         // Optional field (defaults to empty string in DB)
  notes?: string        // Optional notes
  max_entries_per_hour?: number // Optional entry limit
  created_by?: string   // UUID of staff who created schedule
  created_at: string
  updated_at?: string   // Optional in case it's not always returned
}

// Form schema
const waitlistScheduleSchema = z.object({
  waitlist_date: z.string().min(1, 'Date is required').refine((date) => {
    // Compare with Lebanon timezone date
    const selectedDate = new Date(date + 'T00:00:00')
    const todayInLebanon = getTodayInLebanon()
    return date >= todayInLebanon
  }, {
    message: "Date must be today or in the future (Lebanon time)"
  }),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  name: z.string().optional(),
  notes: z.string().optional(),
  max_entries_per_hour: z.number().min(1).max(50).optional(),
  is_active: z.boolean(),
}).refine((data) => {
  // Handle both HH:MM and HH:MM:SS formats
  const startTime = data.start_time.includes(':') ? data.start_time : `${data.start_time}:00`
  const endTime = data.end_time.includes(':') ? data.end_time : `${data.end_time}:00`
  
  const start = new Date(`2000-01-01T${startTime}`)
  const end = new Date(`2000-01-01T${endTime}`)
  return end > start
}, {
  message: "End time must be after start time",
  path: ["end_time"]
})

type WaitlistScheduleFormData = z.infer<typeof waitlistScheduleSchema>

interface WaitlistScheduleManagerProps {
  restaurantId: string
  tier: string
}

export function WaitlistScheduleManager({ restaurantId, tier }: WaitlistScheduleManagerProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<WaitlistSchedule | null>(null)
  const supabase = createClient()
  const queryClient = useQueryClient()

  const form = useForm<WaitlistScheduleFormData>({
    resolver: zodResolver(waitlistScheduleSchema),
    defaultValues: {
      waitlist_date: getTomorrowInLebanon(), // Tomorrow in Lebanon time
      start_time: '18:00',
      end_time: '21:00',
      name: '',
      notes: '',
      is_active: true,
    }
  })

  // Fetch waitlist schedules
  const { data: allSchedules, isLoading } = useQuery({
    queryKey: ['waitlist-schedules', restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_waitlist_schedules')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('waitlist_date', { ascending: false })
        .order('start_time')

      if (error) throw error
      return data as WaitlistSchedule[]
    },
    enabled: !!restaurantId
  })

  // Filter schedules to only show current and future dates (Lebanon timezone)
  // Sort by date ascending (earliest upcoming dates first)
  const schedules = allSchedules?.filter(schedule => {
    const todayInLebanon = getTodayInLebanon()
    return schedule.waitlist_date >= todayInLebanon
  }).sort((a, b) => {
    // Primary sort: by date (ascending)
    const dateCompare = a.waitlist_date.localeCompare(b.waitlist_date)
    if (dateCompare !== 0) return dateCompare
    // Secondary sort: by start time (ascending)
    return a.start_time.localeCompare(b.start_time)
  }) || []

  // Create schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (data: WaitlistScheduleFormData) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { error } = await supabase
        .from('restaurant_waitlist_schedules')
        .insert({
          restaurant_id: restaurantId,
          ...data,
          created_by: user.id,
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist-schedules', restaurantId] })
      toast.success('Waitlist schedule created successfully')
      setShowAddDialog(false)
      form.reset()
    },
    onError: (error) => {
      console.error('Error creating schedule:', error)
      toast.error('Failed to create waitlist schedule')
    }
  })

  // Update schedule mutation
  const updateScheduleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<WaitlistScheduleFormData> }) => {
      const { error } = await supabase
        .from('restaurant_waitlist_schedules')
        .update(data)
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist-schedules', restaurantId] })
      toast.success('Waitlist schedule updated successfully')
      setEditingSchedule(null)
      form.reset()
    },
    onError: (error) => {
      console.error('Error updating schedule:', error)
      toast.error('Failed to update waitlist schedule')
    }
  })

  // Delete schedule mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('restaurant_waitlist_schedules')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist-schedules', restaurantId] })
      toast.success('Waitlist schedule deleted successfully')
    },
    onError: (error) => {
      console.error('Error deleting schedule:', error)
      toast.error('Failed to delete waitlist schedule')
    }
  })

  // Toggle schedule active state
  const toggleSchedule = async (schedule: WaitlistSchedule) => {
    updateScheduleMutation.mutate({
      id: schedule.id,
      data: { is_active: !schedule.is_active }
    })
  }

  const handleSubmit = (data: WaitlistScheduleFormData) => {
    if (editingSchedule) {
      updateScheduleMutation.mutate({ id: editingSchedule.id, data })
    } else {
      createScheduleMutation.mutate(data)
    }
  }

  const openEditDialog = (schedule: WaitlistSchedule) => {
    setEditingSchedule(schedule)
    form.reset({
      waitlist_date: schedule.waitlist_date,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      name: schedule.name || '',
      notes: schedule.notes || '',
      max_entries_per_hour: schedule.max_entries_per_hour || undefined,
      is_active: schedule.is_active
    })
    setShowAddDialog(true)
  }

  const closeDialog = () => {
    setShowAddDialog(false)
    setEditingSchedule(null)
    form.reset()
  }

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (dateString: string) => {
    return formatDateForLebanon(dateString)
  }

  // Only show for basic tier - check after all hooks are called
  if (!isBasicTier(tier as any)) {
    return null
  }

  if (isLoading) {
    return <div className="animate-pulse">Loading waitlist schedules...</div>
  }

  return (
    <Card>
      <CardHeader className="p-3 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4" />
          Waitlist Scheduling
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            Basic Tier Only
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Configure when booking requests should automatically join the waitlist instead of being confirmed instantly.
          Only current and future schedules are shown (past schedules are kept for historical records).
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-3">

        {/* Info Alert */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h4 className="text-xs font-medium text-blue-900 dark:text-blue-100">
              How Waitlist Scheduling Works
            </h4>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
              During scheduled times, all booking requests will be added to your waitlist for manual approval.
              Outside these times, bookings work normally with instant confirmation.
            </p>
          </div>
        </div>

        {/* Existing Schedules */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Current Schedules</h3>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setEditingSchedule(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Schedule
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingSchedule ? 'Edit Waitlist Schedule' : 'Add Waitlist Schedule'}
                  </DialogTitle>
                  <DialogDescription>
                    Configure when booking requests should join the waitlist (times shown in Lebanon timezone).
                  </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">

                    <FormField
                      control={form.control}
                      name="waitlist_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              min={getTodayInLebanon()}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Select the specific date when bookings should go to waitlist (Lebanon timezone)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="start_time"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Time (Lebanon Time)</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="end_time"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Time (Lebanon Time)</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Schedule Name (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="e.g., Weekend Rush, Dinner Peak"
                            />
                          </FormControl>
                          <FormDescription>
                            Give this schedule a memorable name
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="max_entries_per_hour"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Entries Per Hour (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="50"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormDescription>
                            Limit how many people can join the waitlist per hour
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Internal notes about this schedule"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={closeDialog}>
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createScheduleMutation.isPending || updateScheduleMutation.isPending}
                      >
                        {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {schedules && schedules.length > 0 ? (
            <div className="space-y-2">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {formatDate(schedule.waitlist_date)}
                      </span>
                      <Badge variant={schedule.is_active ? "default" : "secondary"} className="text-[10px] h-5 px-1.5">
                        {schedule.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {schedule.name && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                          {schedule.name}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1"><div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                      </div>
                      {schedule.max_entries_per_hour && (
                        <div>Max: {schedule.max_entries_per_hour}/hour</div>
                      )}
                    </div>

                    {schedule.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {schedule.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={schedule.is_active}
                      onCheckedChange={() => toggleSchedule(schedule)}
                      disabled={updateScheduleMutation.isPending}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(schedule)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this schedule?')) {
                          deleteScheduleMutation.mutate(schedule.id)
                        }
                      }}
                      disabled={deleteScheduleMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground"><Calendar className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">No upcoming waitlist schedules</p>
              <p className="text-xs mt-1">
                Add your first schedule to start using time-based waitlisting
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
