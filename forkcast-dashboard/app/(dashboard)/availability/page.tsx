// app/(dashboard)/availability/page.tsx
"use client"
export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  Plus,
  X,
  Pencil,
  Trash2,
  Clock,
  CalendarClock,
  CalendarCheck,
  CalendarX,
  BookOpen,
} from "lucide-react"
import { OpenHoursForm } from "@/components/settings/open-hours-form"
import { formatTimeRange12Hour } from "@/lib/utils/time-utils"

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
  "Fully Booked",
  "Maintenance",
  "Renovation",
  "Vacation",
  "Temporarily Closed",
] as const

export default function AvailabilityPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { currentRestaurant } = useRestaurantContext()
  const [restaurantId, setRestaurantId] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [showSpecialHoursDialog, setShowSpecialHoursDialog] = useState(false)
  const [showClosureDialog, setShowClosureDialog] = useState(false)
  const [editingSpecialHours, setEditingSpecialHours] = useState<any | null>(null)
  const [editingClosure, setEditingClosure] = useState<any | null>(null)

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

  // Update special hours mutation
  const updateSpecialHoursMutation = useMutation({
    mutationFn: async (data: SpecialHoursFormData) => {
      if (!editingSpecialHours?.id) throw new Error("No item to update")

      const { error } = await supabase
        .from("restaurant_special_hours")
        .update({
          date: format(data.dates[0], 'yyyy-MM-dd'),
          is_closed: data.is_closed,
          open_time: !data.is_closed ? data.open_time : null,
          close_time: !data.is_closed ? data.close_time : null,
          reason: data.reason,
        })
        .eq("id", editingSpecialHours.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-availability-all", restaurantId] })
      toast.success("Special hours updated successfully")
      setShowSpecialHoursDialog(false)
      setEditingSpecialHours(null)
      specialHoursForm.reset()
    },
    onError: (error: any) => {
      toast.error(`Failed to update special hours: ${error.message}`)
    },
  })

  // Update closure mutation
  const updateClosureMutation = useMutation({
    mutationFn: async (data: ClosureFormData) => {
      if (!editingClosure?.id) throw new Error("No closure to update")

      const { error } = await supabase
        .from("restaurant_closures")
        .update({
          start_date: format(data.start_date, 'yyyy-MM-dd'),
          end_date: format(data.end_date, 'yyyy-MM-dd'),
          reason: data.reason,
          start_time: data.is_all_day ? null : data.start_time,
          end_time: data.is_all_day ? null : data.end_time,
        })
        .eq("id", editingClosure.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-availability-all", restaurantId] })
      toast.success("Closure updated successfully")
      setShowClosureDialog(false)
      setEditingClosure(null)
      closureForm.reset()
    },
    onError: (error: any) => {
      toast.error(`Failed to update closure: ${error.message}`)
    },
  })

  const handleEditSpecialHours = (special: any) => {
    setEditingSpecialHours(special)
    specialHoursForm.reset({
      dates: [new Date(special.date + 'T12:00:00')],
      is_closed: special.is_closed,
      open_time: special.open_time || "09:00",
      close_time: special.close_time || "21:00",
      reason: special.reason || "",
    })
    setShowSpecialHoursDialog(true)
  }

  const handleEditClosure = (closure: any) => {
    setEditingClosure(closure)
    closureForm.reset({
      start_date: new Date(closure.start_date + 'T12:00:00'),
      end_date: new Date(closure.end_date + 'T12:00:00'),
      reason: closure.reason,
      is_all_day: !closure.start_time,
      start_time: closure.start_time || "09:00",
      end_time: closure.end_time || "17:00",
    })
    setShowClosureDialog(true)
  }

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
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex-shrink-0 px-3 py-2 border-b bg-card">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-teal-500 flex items-center justify-center">
              <CalendarClock className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Availability</h1>
              <p className="text-xs text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="flex flex-col items-center gap-3">
            <CalendarClock className="h-8 w-8 animate-pulse" />
            <p className="text-sm">Loading availability...</p>
          </div>
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
            <div className="w-8 h-8 rounded-md bg-teal-500 flex items-center justify-center">
              <CalendarClock className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Availability</h1>
              <p className="text-xs text-muted-foreground">Hours, special occasions &amp; closures</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-3">

      <Tabs defaultValue="regular" className="space-y-3">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-1">
          <TabsList className="w-full grid grid-cols-4 h-auto p-1 gap-0.5">
            <TabsTrigger value="regular" className="flex items-center gap-1.5 text-xs px-2 py-1.5">
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Booking Hours</span>
              <span className="sm:hidden">Booking</span>
            </TabsTrigger>
            <TabsTrigger value="open" className="flex items-center gap-1.5 text-xs px-2 py-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Open Hours</span>
              <span className="sm:hidden">Open</span>
            </TabsTrigger>
            <TabsTrigger value="special" className="flex items-center gap-1.5 text-xs px-2 py-1.5">
              <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Special Hours</span>
              <span className="sm:hidden">Special</span>
            </TabsTrigger>
            <TabsTrigger value="closures" className="flex items-center gap-1.5 text-xs px-2 py-1.5">
              <CalendarX className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Closures</span>
              <span className="sm:hidden">Closures</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Regular Hours Tab */}
        <TabsContent value="regular" className="mt-0">
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <CardTitle className="text-xs font-semibold">Booking Hours</CardTitle>
              </div>
              <CardDescription className="text-[11px]">
                Set when you accept online bookings. Add multiple shifts per day (e.g., Lunch &amp; Dinner).
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <Form {...regularHoursForm}>
                <form onSubmit={regularHoursForm.handleSubmit((data) => updateRegularHoursMutation.mutate(data))}>
                  <div className="divide-y">
                    {DAYS_OF_WEEK.map((day) => {
                      const shifts = regularHoursForm.watch(day) || []
                      const isAnyOpen = shifts.some(s => s.is_open)
                      return (
                        <div key={day} className="py-2.5 first:pt-0 last:pb-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAnyOpen ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                              <h3 className="font-semibold capitalize text-xs">{day}</h3>
                              {!isAnyOpen && <Badge variant="secondary" className="text-[10px] h-4 px-1">Closed</Badge>}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px] px-2"
                              onClick={() => {
                                const currentShifts = regularHoursForm.getValues(day)
                                regularHoursForm.setValue(day, [
                                  ...currentShifts,
                                  { name: "", is_open: true, open_time: "17:00", close_time: "21:00" }
                                ])
                              }}
                            >
                              <Plus className="h-2.5 w-2.5 mr-1" />
                              Add Shift
                            </Button>
                          </div>

                          <div className="space-y-1.5 pl-3">
                            {shifts.map((_, shiftIndex) => (
                              <div
                                key={shiftIndex}
                                className={`flex flex-col gap-1.5 p-2 rounded-lg border transition-colors ${
                                  shifts[shiftIndex]?.is_open
                                    ? 'bg-green-50/50 dark:bg-green-950/10 border-green-100 dark:border-green-900/30'
                                    : 'bg-muted/20 border-dashed'
                                }`}
                              >
                                {/* Row 1: toggle + name + delete */}
                                <div className="flex items-center gap-1.5">
                                  <FormField
                                    control={regularHoursForm.control}
                                    name={`${day}.${shiftIndex}.is_open`}
                                    render={({ field }) => (
                                      <FormItem className="flex items-center space-x-1.5 shrink-0">
                                        <FormControl>
                                          <Switch checked={field.value} onCheckedChange={field.onChange} className="scale-90" />
                                        </FormControl>
                                        <FormLabel className={`!mt-0 text-[10px] font-medium ${
                                          field.value ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'
                                        }`}>
                                          {field.value ? 'Open' : 'Closed'}
                                        </FormLabel>
                                      </FormItem>
                                    )}
                                  />

                                  <FormField
                                    control={regularHoursForm.control}
                                    name={`${day}.${shiftIndex}.name`}
                                    render={({ field }) => (
                                      <FormItem className="flex-1 min-w-0">
                                        <FormControl>
                                          <Input
                                            placeholder="Shift name (e.g., Lunch)"
                                            {...field}
                                            className="h-7 text-xs w-full"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  {shifts.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => {
                                        const currentShifts = regularHoursForm.getValues(day)
                                        regularHoursForm.setValue(day, currentShifts.filter((_, i) => i !== shiftIndex))
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>

                                {/* Row 2: time range (only when open) */}
                                {shifts[shiftIndex]?.is_open && (
                                  <div className="flex items-center gap-1.5 pl-1">
                                    <FormField
                                      control={regularHoursForm.control}
                                      name={`${day}.${shiftIndex}.open_time`}
                                      render={({ field }) => (
                                        <FormItem className="flex-1">
                                          <FormControl>
                                            <TimeInput12H
                                              value={field.value || ""}
                                              onChange={field.onChange}
                                              className="h-7 text-xs w-full"
                                              name={field.name}
                                              placeholder="9:00 AM"
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <span className="text-muted-foreground text-[10px] font-medium shrink-0">→</span>
                                    <FormField
                                      control={regularHoursForm.control}
                                      name={`${day}.${shiftIndex}.close_time`}
                                      render={({ field }) => (
                                        <FormItem className="flex-1">
                                          <FormControl>
                                            <TimeInput12H
                                              value={field.value || ""}
                                              onChange={field.onChange}
                                              className="h-7 text-xs w-full"
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
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="pt-4 mt-1 border-t">
                    <Button
                      type="submit"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      disabled={updateRegularHoursMutation.isPending}
                    >
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      {updateRegularHoursMutation.isPending ? 'Saving...' : 'Save Booking Hours'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Open Hours Tab */}
        <TabsContent value="open" className="mt-0">
          <OpenHoursForm
            restaurantId={restaurantId}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["restaurant-availability-all", restaurantId] })
              toast.success("Open hours updated successfully")
            }}
          />
        </TabsContent>

        {/* Special Hours Tab */}
        <TabsContent value="special" className="mt-0">
          <Card>
            <CardHeader className="pt-4 px-4 pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-sm">Special Hours</CardTitle>
                    <CardDescription className="mt-0.5 text-xs">
                      Override hours for specific dates — holidays, events, etc.
                    </CardDescription>
                  </div>
                </div>
                <Button onClick={() => setShowSpecialHoursDialog(true)} size="sm" className="h-8 px-3 text-xs shrink-0">
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {!availabilityData?.specialHours?.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CalendarCheck className="h-10 w-10 mb-3 opacity-25" />
                  <p className="text-sm font-medium">No special hours set</p>
                  <p className="text-xs mt-1 opacity-60">Add special hours for holidays or events</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availabilityData.specialHours.map((special: any) => (
                    <div key={special.id} className="flex items-center justify-between p-3.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                          special.is_closed
                            ? 'bg-red-100 dark:bg-red-950/30'
                            : 'bg-green-100 dark:bg-green-950/30'
                        }`}>
                          {special.is_closed
                            ? <CalendarX className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                            : <CalendarCheck className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{format(new Date(special.date), 'EEEE, MMMM d, yyyy')}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {special.is_closed ? (
                              <Badge variant="destructive" className="text-xs px-1.5 h-5">Closed</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs px-1.5 h-5 font-normal">
                                <Clock className="h-2.5 w-2.5 mr-1" />
                                {formatTimeRange12Hour(special.open_time, special.close_time)}
                              </Badge>
                            )}
                            {special.reason && (
                              <span className="text-xs text-muted-foreground truncate">{special.reason}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 ml-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditSpecialHours(special)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteSpecialHours(special.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Closures Tab */}
        <TabsContent value="closures" className="mt-0">
          <Card>
            <CardHeader className="pt-4 px-4 pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <CalendarX className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-sm">Temporary Closures</CardTitle>
                    <CardDescription className="mt-0.5 text-xs">
                      Block off date ranges for renovations, vacations, etc.
                    </CardDescription>
                  </div>
                </div>
                <Button onClick={() => setShowClosureDialog(true)} size="sm" variant="destructive" className="h-8 px-3 text-xs shrink-0">
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {!availabilityData?.closures?.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CalendarX className="h-10 w-10 mb-3 opacity-25" />
                  <p className="text-sm font-medium">No closures scheduled</p>
                  <p className="text-xs mt-1 opacity-60">Add closures for planned shutdowns</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availabilityData.closures.map((closure: any) => (
                    <div key={closure.id} className="flex items-center justify-between p-3.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 p-1.5 rounded-lg bg-red-100 dark:bg-red-950/50 shrink-0">
                          <CalendarX className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">
                            {format(new Date(closure.start_date), 'MMM d, yyyy')} → {format(new Date(closure.end_date), 'MMM d, yyyy')}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs px-1.5 h-5 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">
                              {closure.reason}
                            </Badge>
                            {closure.start_time && closure.end_time && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                Partial: {formatTimeRange12Hour(closure.start_time, closure.end_time)} daily
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 ml-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditClosure(closure)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteClosure(closure.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </div>
      </div>

      {/* Special Hours Dialog */}
      <Dialog open={showSpecialHoursDialog} onOpenChange={(open) => {
        setShowSpecialHoursDialog(open)
        if (!open) {
          setEditingSpecialHours(null)
          specialHoursForm.reset()
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSpecialHours ? "Edit Special Hours" : "Add Special Hours"}</DialogTitle>
            <DialogDescription>
              {editingSpecialHours ? "Update the hours for this date." : "Set different operating hours for specific date(s)."}
            </DialogDescription>
          </DialogHeader>
          <Form {...specialHoursForm}>
            <form onSubmit={specialHoursForm.handleSubmit((data) =>
              editingSpecialHours
                ? updateSpecialHoursMutation.mutate(data)
                : addSpecialHoursMutation.mutate(data)
            )} className="space-y-4">
              <FormField
                control={specialHoursForm.control}
                name="dates"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{editingSpecialHours ? "Date" : "Dates"}</FormLabel>
                    {editingSpecialHours ? (
                      <Calendar
                        mode="single"
                        selected={field.value?.[0]}
                        onSelect={(date) => field.onChange(date ? [date] : [])}
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0, 0, 0, 0))
                        }
                        className="rounded-md border"
                      />
                    ) : (
                      <Calendar
                        mode="multiple"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0, 0, 0, 0))
                        }
                        className="rounded-md border"
                      />
                    )}
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
                disabled={addSpecialHoursMutation.isPending || updateSpecialHoursMutation.isPending}
              >
                {editingSpecialHours ? "Save Changes" : "Add Special Hours"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Closure Dialog */}
      <Dialog open={showClosureDialog} onOpenChange={(open) => {
        setShowClosureDialog(open)
        if (!open) {
          setEditingClosure(null)
          closureForm.reset()
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClosure ? "Edit Closure" : "Add Temporary Closure"}</DialogTitle>
            <DialogDescription>
              {editingClosure ? "Update the details for this closure." : "Mark your restaurant as closed for a period of time."}
            </DialogDescription>
          </DialogHeader>
          <Form {...closureForm}>
            <form onSubmit={closureForm.handleSubmit((data) =>
              editingClosure
                ? updateClosureMutation.mutate(data)
                : addClosureMutation.mutate(data)
            )} className="space-y-4">
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
                    <Select onValueChange={field.onChange} value={field.value || ""}>
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
                disabled={addClosureMutation.isPending || updateClosureMutation.isPending}
              >
                {editingClosure ? "Save Changes" : "Add Closure"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

