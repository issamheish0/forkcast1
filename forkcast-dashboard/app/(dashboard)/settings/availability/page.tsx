// app/(dashboard)/settings/availability/page.tsx
"use client"
export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { TimeInput12H } from "@/components/ui/time-input-12h"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "react-hot-toast"
import {
  Save,
  ArrowLeft,
  Plus,
  X,
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
} from "lucide-react"
import { OpenHoursForm } from "@/components/settings/open-hours-form"
import { ShiftsForm } from "@/components/settings/shifts-form"
import { formatTimeRange12Hour } from "@/lib/utils/time-utils"
import { cn } from "@/lib/utils"

// Types
interface SpecialHours {
  id?: string
  date: Date
  is_closed: boolean
  open_time?: string
  close_time?: string
  reason?: string
}

interface Closure {
  id?: string
  start_date: Date
  end_date: Date
  reason: string
  is_all_day: boolean
  start_time?: string
  end_time?: string
}

// Schema for a single shift
const shiftSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  is_open: z.boolean(),
  open_time: z.string().optional(),
  close_time: z.string().optional(),
})

// Regular hours schema - now supports multiple shifts per day
const regularHoursSchema = z.object({
  monday: z.array(shiftSchema),
  tuesday: z.array(shiftSchema),
  wednesday: z.array(shiftSchema),
  thursday: z.array(shiftSchema),
  friday: z.array(shiftSchema),
  saturday: z.array(shiftSchema),
  sunday: z.array(shiftSchema),
})

// Special hours schema
const specialHoursSchema = z.object({
  dates: z.array(z.date()).min(1, "Select at least one date"),
  is_closed: z.boolean(),
  open_time: z.string().optional(),
  close_time: z.string().optional(),
  reason: z.string().optional(),
})

// Closure schema
const closureSchema = z.object({
  start_date: z.date(),
  end_date: z.date(),
  reason: z.string().min(1, "Reason is required"),
  is_all_day: z.boolean().default(true),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
}).refine(
  (data) => {
    // If it's not an all-day closure, start_time and end_time are required
    if (!data.is_all_day) {
      return data.start_time && data.end_time
    }
    return true
  },
  {
    message: "Start time and end time are required for partial-day closures",
    path: ["start_time"],
  }
)

type RegularHoursFormData = z.infer<typeof regularHoursSchema>
type SpecialHoursFormData = z.infer<typeof specialHoursSchema>
type ClosureFormData = z.infer<typeof closureSchema>

const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

const CLOSURE_REASONS = [
  "Fully Booed",
  "Maintenance",
  "Renovation",
  "Vacation",
  "Temporarily Closed",
] as const

export default function EnhancedAvailabilitySettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { currentRestaurant, hasFeature } = useRestaurantContext()
  const hasFloorPlan = hasFeature('floor_plan')
  const [restaurantId, setRestaurantId] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [showSpecialHoursDialog, setShowSpecialHoursDialog] = useState(false)
  const [showClosureDialog, setShowClosureDialog] = useState(false)

  // Set restaurant ID from current restaurant context
  useEffect(() => {
    if (currentRestaurant) {
      setRestaurantId(currentRestaurant.restaurant.id)
    } else {
      setRestaurantId("")
    }
  }, [currentRestaurant])

  // Fetch all availability data
  const { data: availabilityData, isLoading } = useQuery({
    queryKey: ["restaurant-availability-all", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null
      
      const [regularHours, specialHours, closures] = await Promise.all([
        supabase
          .from("restaurant_hours")
          .select("*")
          .eq("restaurant_id", restaurantId),
        supabase
          .from("restaurant_special_hours")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .gte("date", new Date().toISOString().split('T')[0]),
        supabase
          .from("restaurant_closures")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .gte("end_date", new Date().toISOString().split('T')[0])
      ])

      return {
        regularHours: regularHours.data || [],
        specialHours: specialHours.data || [],
        closures: closures.data || []
      }
    },
    enabled: !!restaurantId,
  })

  // Regular hours form - with default single shift per day
  const regularHoursForm = useForm<RegularHoursFormData>({
    resolver: zodResolver(regularHoursSchema),
    defaultValues: {
      monday: [{ name: "", is_open: true, open_time: "09:00", close_time: "21:00" }],
      tuesday: [{ name: "", is_open: true, open_time: "09:00", close_time: "21:00" }],
      wednesday: [{ name: "", is_open: true, open_time: "09:00", close_time: "21:00" }],
      thursday: [{ name: "", is_open: true, open_time: "09:00", close_time: "21:00" }],
      friday: [{ name: "", is_open: true, open_time: "09:00", close_time: "21:00" }],
      saturday: [{ name: "", is_open: true, open_time: "09:00", close_time: "21:00" }],
      sunday: [{ name: "", is_open: true, open_time: "09:00", close_time: "21:00" }],
    },
  })

  // Special hours form
  const specialHoursForm = useForm<SpecialHoursFormData>({
    resolver: zodResolver(specialHoursSchema),
    defaultValues: {
      dates: [],
      is_closed: false,
      open_time: "09:00",
      close_time: "21:00",
    },
  })

  // Closure form
  const closureForm:any = useForm<any>({
    resolver: zodResolver(closureSchema),
    defaultValues: {
      is_all_day: true,
      start_time: "09:00",
      end_time: "17:00",
    },
  })

  // Update forms when data loads
  useEffect(() => {
    if (availabilityData?.regularHours) {
      const formData: any = {}
      
      DAYS_OF_WEEK.forEach(day => {
        const dayShifts = availabilityData.regularHours.filter(h => h.day_of_week === day)
        if (dayShifts.length > 0) {
          formData[day] = dayShifts.map(shift => ({
            id: shift.id,
            name: shift.name || "",
            is_open: shift.is_open,
            open_time: shift.open_time || "09:00",
            close_time: shift.close_time || "22:00",
          }))
        } else {
          // Default closed day
          formData[day] = [{ name: "", is_open: false, open_time: "09:00", close_time: "22:00" }]
        }
      })
      
      regularHoursForm.reset(formData)
    }
  }, [availabilityData, regularHoursForm])

  // Update regular hours mutation - handles multiple shifts
  const updateRegularHoursMutation = useMutation({
    mutationFn: async (data: RegularHoursFormData) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // First, delete all existing hours for this restaurant
      const { error: deleteError } = await supabase
        .from("restaurant_hours")
        .delete()
        .eq("restaurant_id", restaurantId)

      if (deleteError) throw deleteError

      // Then insert all new shifts
      const allShifts: any[] = []
      
      DAYS_OF_WEEK.forEach(day => {
        data[day].forEach(shift => {
          allShifts.push({
            restaurant_id: restaurantId,
            day_of_week: day,
            name: shift.name || null,
            is_open: shift.is_open,
            open_time: shift.is_open ? shift.open_time : null,
            close_time: shift.is_open ? shift.close_time : null,
          })
        })
      })

      if (allShifts.length > 0) {
        const { error: insertError } = await supabase
          .from("restaurant_hours")
          .insert(allShifts)

        if (insertError) throw insertError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-availability-all", restaurantId] })
      toast.success("Regular hours updated successfully")
    },
    onError: (error: any) => {
      toast.error(`Failed to update hours: ${error.message}`)
    },
  })

  // Add special hours mutation
  const addSpecialHoursMutation = useMutation({
    mutationFn: async (data: SpecialHoursFormData) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const rows = (data.dates || []).map((d) => ({
        restaurant_id: restaurantId,
        date: format(d, 'yyyy-MM-dd'),
        is_closed: data.is_closed,
        open_time: !data.is_closed ? data.open_time : null,
        close_time: !data.is_closed ? data.close_time : null,
        reason: data.reason,
        created_by: user.id,
      }))

      if (rows.length === 0) {
        throw new Error("Please select at least one date")
      }

      const { error } = await supabase
        .from("restaurant_special_hours")
        .upsert(rows, {
          onConflict: "restaurant_id,date",
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-availability-all", restaurantId] })
      toast.success("Special hours added successfully")
      setShowSpecialHoursDialog(false)
      specialHoursForm.reset()
    },
    onError: (error: any) => {
      toast.error(`Failed to add special hours: ${error.message}`)
    },
  })

  // Add closure mutation
  const addClosureMutation = useMutation({
    mutationFn: async (data: ClosureFormData) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { error } = await supabase
        .from("restaurant_closures")
        .insert({
          restaurant_id: restaurantId,
          start_date: format(data.start_date, 'yyyy-MM-dd'),
          end_date: format(data.end_date, 'yyyy-MM-dd'),
          reason: data.reason,
          start_time: data.is_all_day ? null : data.start_time,
          end_time: data.is_all_day ? null : data.end_time,
          created_by: user.id,
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-availability-all", restaurantId] })
      toast.success("Closure added successfully")
      setShowClosureDialog(false)
      closureForm.reset()
    },
    onError: (error: any) => {
      toast.error(`Failed to add closure: ${error.message}`)
    },
  })

  // Delete special hours
  const deleteSpecialHours = async (id: string) => {
    const { error } = await supabase
      .from("restaurant_special_hours")
      .delete()
      .eq("id", id)

    if (error) {
      toast.error("Failed to delete special hours")
    } else {
      queryClient.invalidateQueries({ queryKey: ["restaurant-availability-all", restaurantId] })
      toast.success("Special hours deleted")
    }
  }

  // Delete closure
  const deleteClosure = async (id: string) => {
    const { error } = await supabase
      .from("restaurant_closures")
      .delete()
      .eq("id", id)

    if (error) {
      toast.error("Failed to delete closure")
    } else {
      queryClient.invalidateQueries({ queryKey: ["restaurant-availability-all", restaurantId] })
      toast.success("Closure deleted")
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Compact Header Bar */}
      <div className="flex-shrink-0 px-3 py-2 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => router.push("/settings")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="w-8 h-8 rounded-md bg-blue-500 flex items-center justify-center">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Availability</h1>
              <p className="text-xs text-muted-foreground">Operating hours & closures</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3">
        <Tabs defaultValue={(() => {
          const q = (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab')) || 'regular'
          // If deep-linked to shifts but the restaurant doesn't have floor plan, fall back
          if (q === 'shifts' && !hasFloorPlan) return 'regular'
          return q
        })()} className="space-y-4 sm:space-y-4">
          <TabsList className={cn("w-full sm:w-auto grid sm:flex gap-0 sm:gap-1 h-auto p-1", hasFloorPlan ? "grid-cols-5" : "grid-cols-4")}>
          <TabsTrigger value="regular" className="text-xs sm:text-sm px-2 sm:px-4 py-2">
            <span className="hidden sm:inline">Booking Hours</span>
            <span className="sm:hidden">Booking</span>
          </TabsTrigger>
          <TabsTrigger value="open" className="text-xs sm:text-sm px-2 sm:px-4 py-2">
            <span className="hidden sm:inline">Open Hours</span>
            <span className="sm:hidden">Open</span>
          </TabsTrigger>
          {hasFloorPlan && (
            <TabsTrigger value="shifts" className="text-xs sm:text-sm px-2 sm:px-4 py-2">
              <span className="hidden sm:inline">Shifts</span>
              <span className="sm:hidden">Shifts</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="special" className="text-xs sm:text-sm px-2 sm:px-4 py-2">
            <span className="hidden sm:inline">Special Hours</span>
            <span className="sm:hidden">Special</span>
          </TabsTrigger>
          <TabsTrigger value="closures" className="text-xs sm:text-sm px-2 sm:px-4 py-2">
            <span className="hidden sm:inline">Closures</span>
            <span className="sm:hidden">Closures</span>
          </TabsTrigger>
        </TabsList>

        {/* Regular Hours Tab */}
        <TabsContent value="regular">
          <Card>
            <CardHeader>
              <CardTitle>Booking Hours</CardTitle>
              <CardDescription>
                Set when you accept online bookings and reservations. You can add multiple shifts per day (e.g., lunch and dinner service).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...regularHoursForm}>
                <form onSubmit={regularHoursForm.handleSubmit((data) => updateRegularHoursMutation.mutate(data))} className="space-y-4">
                  {DAYS_OF_WEEK.map((day) => {
                    const shifts = regularHoursForm.watch(day) || []
                    return (
                      <div key={day} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-medium capitalize">{day}</h3>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const currentShifts = regularHoursForm.getValues(day)
                              regularHoursForm.setValue(day, [
                                ...currentShifts,
                                { name: "", is_open: true, open_time: "17:00", close_time: "21:00" }
                              ])
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Shift
                          </Button>
                        </div>
                        
                        <div className="space-y-3">
                          {shifts.map((_, shiftIndex) => (
                            <div key={shiftIndex} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border rounded-lg">
                              <div className="flex items-center space-x-2">
                                <FormField
                                  control={regularHoursForm.control}
                                  name={`${day}.${shiftIndex}.is_open`}
                                  render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2">
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                        />
                                      </FormControl>
                                      <FormLabel className="!mt-0">
                                        {field.value ? "Open" : "Closed"}
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <FormField
                                control={regularHoursForm.control}
                                name={`${day}.${shiftIndex}.name`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        placeholder="Shift name (e.g., Lunch, Dinner)"
                                        {...field}
                                        className="w-full sm:w-44"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              {shifts[shiftIndex]?.is_open && (
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
                                  <FormField
                                    control={regularHoursForm.control}
                                    name={`${day}.${shiftIndex}.open_time`}
                                    render={({ field }) => (
                                      <FormItem className="w-full sm:w-auto">
                                        <FormControl>
                                          <TimeInput12H
                                            value={field.value || ""}
                                            onChange={field.onChange}
                                            className="w-full sm:w-auto"
                                            name={field.name}
                                            placeholder="9:00 AM"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <span className="text-muted-foreground text-center sm:text-left">to</span>

                                  <FormField
                                    control={regularHoursForm.control}
                                    name={`${day}.${shiftIndex}.close_time`}
                                    render={({ field }) => (
                                      <FormItem className="w-full sm:w-auto">
                                        <FormControl>
                                          <TimeInput12H
                                            value={field.value || ""}
                                            onChange={field.onChange}
                                            className="w-full sm:w-auto"
                                            name={field.name}
                                            placeholder="5:00 PM"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              )}

                              {shifts.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const currentShifts = regularHoursForm.getValues(day)
                                    const newShifts = currentShifts.filter((_, i) => i !== shiftIndex)
                                    regularHoursForm.setValue(day, newShifts)
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}

                  <Button
                    type="submit"
                    className="w-full mt-4"
                    disabled={updateRegularHoursMutation.isPending}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Regular Hours
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Open Hours Tab */}
        <TabsContent value="open">
          <OpenHoursForm
            restaurantId={restaurantId}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["restaurant-availability-all", restaurantId] })
              toast.success("Open hours updated successfully")
            }}
          />
        </TabsContent>

        {/* Shifts Tab — drives the floorplan shift filter. Gated to restaurants
            that have the floor_plan addon. */}
        {hasFloorPlan && (
          <TabsContent value="shifts">
            <ShiftsForm restaurantId={restaurantId} />
          </TabsContent>
        )}

        {/* Special Hours Tab */}
        <TabsContent value="special">
          <Card>
            <CardHeader>
              <CardTitle>Special Hours</CardTitle>
              <CardDescription>
                Set different hours for specific dates (holidays, special events, etc.)
              </CardDescription>
              <Button
                onClick={() => setShowSpecialHoursDialog(true)}
                size="sm"
                className="w-fit"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Special Hours
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {availabilityData?.specialHours?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No special hours set. Add special hours for holidays or events.
                  </p>
                ) : (
                  availabilityData?.specialHours?.map((special: any) => (
                    <div key={special.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">
                          {format(new Date(special.date), 'EEEE, MMMM d, yyyy')}
                        </p>
                        {special.is_closed ? (
                          <p className="text-sm text-red-600">Closed</p>
                        ) : (
                          <p className="text-sm text-muted-foreground text-sm">{formatTimeRange12Hour(special.open_time, special.close_time)}
                          </p>
                        )}
                        {special.reason && (
                          <p className="text-sm text-muted-foreground text-sm">Reason: {special.reason}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSpecialHours(special.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Closures Tab */}
        <TabsContent value="closures">
          <Card>
            <CardHeader>
              <CardTitle>Temporary Closures</CardTitle>
              <CardDescription>
                Manage temporary closures for renovations, vacations, etc.
              </CardDescription>
              <Button
                onClick={() => setShowClosureDialog(true)}
                size="sm"
                className="w-fit"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Closure
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {availabilityData?.closures?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No closures scheduled.
                  </p>
                ) : (
                  availabilityData?.closures?.map((closure: any) => (
                    <div key={closure.id} className="flex items-center justify-between p-4 border rounded-lg bg-red-50">
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          Closed: {format(new Date(closure.start_date), 'MMM d, yyyy')} - {format(new Date(closure.end_date), 'MMM d, yyyy')}
                          {closure.start_time && closure.end_time && (
                            <span className="text-sm font-normal">
                              ({formatTimeRange12Hour(closure.start_time, closure.end_time)})
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground text-sm">Reason: {closure.reason}
                        </p>
                        {closure.start_time && closure.end_time && (
                          <p className="text-xs text-muted-foreground text-sm">Partial closure: {formatTimeRange12Hour(closure.start_time, closure.end_time)} daily
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteClosure(closure.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Special Hours Dialog */}
      <Dialog open={showSpecialHoursDialog} onOpenChange={setShowSpecialHoursDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Special Hours</DialogTitle>
            <DialogDescription>
              Set different operating hours for specific date(s).
            </DialogDescription>
          </DialogHeader>
          <Form {...specialHoursForm}>
            <form onSubmit={specialHoursForm.handleSubmit((data) => addSpecialHoursMutation.mutate(data))} className="space-y-4">
              <FormField
                control={specialHoursForm.control}
                name="dates"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Dates</FormLabel>
                    <Calendar
                      mode="multiple"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date < new Date(new Date().setHours(0, 0, 0, 0))
                      }
                      className="rounded-md border"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={specialHoursForm.control}
                name="is_closed"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">
                      Closed all day
                    </FormLabel>
                  </FormItem>
                )}
              />

              {!specialHoursForm.watch("is_closed") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={specialHoursForm.control}
                    name="open_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opening Time</FormLabel>
                        <FormControl>
                          <TimeInput12H
                            value={field.value || ""}
                            onChange={field.onChange}
                            name={field.name}
                            placeholder="9:00 AM"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={specialHoursForm.control}
                    name="close_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Closing Time</FormLabel>
                        <FormControl>
                          <TimeInput12H
                            value={field.value || ""}
                            onChange={field.onChange}
                            name={field.name}
                            placeholder="5:00 PM"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <FormField
                control={specialHoursForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Christmas Day, Private Event"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={addSpecialHoursMutation.isPending}
              >
                Add Special Hours
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Closure Dialog */}
      <Dialog open={showClosureDialog} onOpenChange={setShowClosureDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Temporary Closure</DialogTitle>
            <DialogDescription>
              Mark your restaurant as closed for a period of time.
            </DialogDescription>
          </DialogHeader>
          <Form {...closureForm}>
            <form onSubmit={closureForm.handleSubmit((data) => addClosureMutation.mutate(data))} className="space-y-4">
              <FormField
                control={closureForm.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date < new Date(new Date().setHours(0, 0, 0, 0))
                      }
                      className="rounded-md border"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={closureForm.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date < closureForm.watch("start_date")
                      }
                      className="rounded-md border"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={closureForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a reason for closure" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CLOSURE_REASONS.map((reason) => (
                          <SelectItem key={reason} value={reason}>
                            {reason}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={closureForm.control}
                name="is_all_day"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">
                      All day closure
                    </FormLabel>
                  </FormItem>
                )}
              />

              {!closureForm.watch("is_all_day") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={closureForm.control}
                    name="start_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <TimeInput12H
                            value={field.value || ""}
                            onChange={field.onChange}
                            name={field.name}
                            placeholder="9:00 AM"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={closureForm.control}
                    name="end_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <FormControl>
                          <TimeInput12H
                            value={field.value || ""}
                            onChange={field.onChange}
                            name={field.name}
                            placeholder="5:00 PM"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={addClosureMutation.isPending}
              >
                Add Closure
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}

