"use client"

import { useState, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
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
  FormDescription,
} from "@/components/ui/form"
import {
  Plus,
  X,
  Clock,
  Save,
  Coffee,
  Utensils,
  Wine,
  ChefHat,
  AlertCircle,
  Store,
  Calendar,
  Users,
} from "lucide-react"
import { toast } from "react-hot-toast"
import { RestaurantOpenHours } from "@/types"
import { useOpenHours, useBulkUpdateOpenHours } from "@/lib/hooks/use-open-hours"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { TimeInput12H } from "@/components/ui/time-input-12h"

// Service type configurations with better UX
const SERVICE_TYPES = [
  { value: 'general', label: 'All Day', icon: Store, color: 'bg-blue-500', desc: 'Full restaurant service' },
  { value: 'breakfast', label: 'Breakfast', icon: Coffee, color: 'bg-orange-500', desc: 'Morning service' },
  { value: 'lunch', label: 'Lunch', icon: Utensils, color: 'bg-green-500', desc: 'Midday service' },
  { value: 'dinner', label: 'Dinner', icon: Utensils, color: 'bg-purple-500', desc: 'Evening service' },
  { value: 'bar', label: 'Bar Only', icon: Wine, color: 'bg-red-500', desc: 'Drinks only' },
  { value: 'kitchen', label: 'Kitchen', icon: ChefHat, color: 'bg-yellow-500', desc: 'Food prep hours' },
] as const

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday', short: 'Mon' },
  { value: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { value: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { value: 'thursday', label: 'Thursday', short: 'Thu' },
  { value: 'friday', label: 'Friday', short: 'Fri' },
  { value: 'saturday', label: 'Saturday', short: 'Sat' },
  { value: 'sunday', label: 'Sunday', short: 'Sun' },
] as const

// Schema for a single shift entry
const shiftSchema = z.object({
  id: z.string().optional(),
  day_of_week: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  service_type: z.enum(['breakfast', 'lunch', 'dinner', 'general', 'bar', 'kitchen']),
  is_open: z.boolean(),
  open_time: z.string().optional(),
  close_time: z.string().optional(),
  name: z.string().optional(),
  accepts_walkins: z.boolean(),
})

// Main form schema
const openHoursFormSchema = z.object({
  shifts: z.array(shiftSchema)
})

type OpenHoursFormData = z.infer<typeof openHoursFormSchema>

interface OpenHoursFormProps {
  restaurantId: string
  onSuccess?: () => void
}

export function OpenHoursForm({ restaurantId, onSuccess }: OpenHoursFormProps) {
  const { data: existingOpenHours, isLoading } = useOpenHours(restaurantId)
  const updateOpenHours = useBulkUpdateOpenHours()

  const form = useForm<OpenHoursFormData>({
    resolver: zodResolver(openHoursFormSchema),
    defaultValues: {
      shifts: []
    }
  })

  const { fields, append, remove, update, replace } = useFieldArray({
    control: form.control,
    name: "shifts"
  })

  // Initialize form with existing data
  useEffect(() => {
    if (existingOpenHours && existingOpenHours.length > 0) {
      const formData: OpenHoursFormData = {
        shifts: existingOpenHours.map(hours => ({
          id: hours.id,
          day_of_week: hours.day_of_week,
          service_type: hours.service_type,
          is_open: hours.is_open,
          open_time: hours.open_time || undefined,
          close_time: hours.close_time || undefined,
          name: hours.name || undefined,
          accepts_walkins: hours.accepts_walkins,
        }))
      }
      form.reset(formData)
    } else {
      // Initialize with default general service for each day
      const defaultShifts: OpenHoursFormData['shifts'] = []
      DAYS_OF_WEEK.forEach(day => {
        defaultShifts.push({
          day_of_week: day.value,
          service_type: 'general',
          is_open: true,
          open_time: '08:00',
          close_time: '21:00',
          name: 'All Day Service',
          accepts_walkins: true,
        })
      })
      form.reset({ shifts: defaultShifts })
    }
  }, [existingOpenHours, form])

  const onSubmit = async (data: OpenHoursFormData) => {
    try {
      const openHoursData = data.shifts.map(shift => ({
        restaurant_id: restaurantId,
        day_of_week: shift.day_of_week,
        service_type: shift.service_type,
        is_open: shift.is_open,
        open_time: shift.is_open ? shift.open_time || null : null,
        close_time: shift.is_open ? shift.close_time || null : null,
        name: shift.name || null,
        accepts_walkins: shift.accepts_walkins,
        notes: null,
      }))

      await updateOpenHours.mutateAsync({
        restaurantId,
        openHoursData
      })

      onSuccess?.()
    } catch (error) {
      console.error('Error updating open hours:', error)
    }
  }

  const addShift = (day: string, serviceType: string = 'general') => {
    const defaultTimes = {
      breakfast: { open: '07:00', close: '11:00' },
      lunch: { open: '11:30', close: '15:00' },
      dinner: { open: '17:00', close: '21:00' },
      bar: { open: '16:00', close: '23:00' },
      kitchen: { open: '08:00', close: '21:00' },
      general: { open: '08:00', close: '21:00' },
    }

    const times = defaultTimes[serviceType as keyof typeof defaultTimes] || defaultTimes.general

    const newShift = {
      day_of_week: day as any,
      service_type: serviceType as any,
      is_open: true,
      open_time: times.open,
      close_time: times.close,
      name: SERVICE_TYPES.find(s => s.value === serviceType)?.label || serviceType,
      accepts_walkins: true,
    }
    append(newShift)
  }


  const getShiftsForDay = (day: string) => {
    return fields.filter(f => f.day_of_week === day)
  }

  const getServiceConfig = (serviceType: string) => {
    return SERVICE_TYPES.find(s => s.value === serviceType) || SERVICE_TYPES[0]
  }


  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Clock className="h-4 w-4 motion-safe:animate-spin" />
            <span>Loading open hours...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          When Are You Open?
        </CardTitle>
        <CardDescription>
          Set the hours when your restaurant is physically open for business.
          This is separate from when you accept online bookings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Simple explanation */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Quick Setup:</strong> Set your open hours for each day.
                You can be physically open for walk-ins even when not accepting online bookings.
              </AlertDescription>
            </Alert>

            {/* Weekly Schedule - Linear Layout like Operating Hours */}
            <div className="space-y-4">
              {DAYS_OF_WEEK.map((day) => {
                const shifts = getShiftsForDay(day.value) || []
                return (
                  <div key={day.value} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium capitalize">{day.label}</h3>
                      <div className="flex gap-2">
                        <Select onValueChange={(serviceType) => addShift(day.value, serviceType)}>
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Add Service" />
                          </SelectTrigger>
                          <SelectContent>
                            {SERVICE_TYPES.map((service) => {
                              const Icon = service.icon
                              return (
                                <SelectItem key={service.value} value={service.value}>
                                  <div className="flex items-center gap-2">
                                    <div className={cn("w-3 h-3 rounded-full", service.color)} />
                                    <Icon className="h-4 w-4" />
                                    <span>{service.label}</span>
                                  </div>
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {shifts.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-sm">No services scheduled. Add a service to get started.
                        </div>
                      ) : (
                        shifts.map((shift) => {
                          const actualIndex = fields.findIndex(f => f === shift)
                          const service = getServiceConfig(shift.service_type)
                          const Icon = service.icon

                          return (
                            <div key={actualIndex} className="flex items-center gap-4 p-4 border rounded-lg">
                              {/* Open/Closed Switch */}
                              <div className="flex items-center space-x-2">
                                <FormField
                                  control={form.control}
                                  name={`shifts.${actualIndex}.is_open`}
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

                              {/* Service Type & Name */}
                              <div className="flex items-center gap-2">
                                <div className={cn("w-3 h-3 rounded-full", service.color)} />
                                <Icon className="h-4 w-4" />
                                <FormField
                                  control={form.control}
                                  name={`shifts.${actualIndex}.name`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input
                                          placeholder={service.label}
                                          {...field}
                                          className="w-44"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              {/* Time Inputs */}
                              {form.watch(`shifts.${actualIndex}.is_open`) && (
                                <>
                                  <FormField
                                    control={form.control}
                                    name={`shifts.${actualIndex}.open_time`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <TimeInput12H
                                            value={field.value || ""}
                                            onChange={field.onChange}
                                            className="w-auto"
                                            name={field.name}
                                            placeholder="9:00 AM"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <span className="text-muted-foreground">to</span>

                                  <FormField
                                    control={form.control}
                                    name={`shifts.${actualIndex}.close_time`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <TimeInput12H
                                            value={field.value || ""}
                                            onChange={field.onChange}
                                            className="w-auto"
                                            name={field.name}
                                            placeholder="5:00 PM"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </>
                              )}

                              {/* Walk-ins Switch */}
                              {form.watch(`shifts.${actualIndex}.is_open`) && (
                                <FormField
                                  control={form.control}
                                  name={`shifts.${actualIndex}.accepts_walkins`}
                                  render={({ field }) => (
                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                      <Label className="text-sm whitespace-nowrap">
                                        Walk-ins
                                      </Label>
                                    </div>
                                  )}
                                />
                              )}

                              {/* Action Buttons */}
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => remove(actualIndex)}
                                  title="Remove shift"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Submit Button - Centered to avoid PWA modal conflicts */}
            <div className="flex justify-center pt-6">
              <Button
                type="submit"
                disabled={updateOpenHours.isPending}
                className="min-w-48 h-12 text-base shadow-lg"
                size="sm"
              >
                {updateOpenHours.isPending ? (
                  <Clock className="mr-2 h-5 w-5 motion-safe:animate-spin" />
                ) : (
                  <Save className="mr-2 h-5 w-5" />
                )}
                Save Open Hours
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
