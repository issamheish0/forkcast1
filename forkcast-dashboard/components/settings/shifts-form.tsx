// components/settings/shifts-form.tsx
// CRUD UI for restaurant_shifts. Lets managers define named time windows
// (breakfast/lunch/dinner/walkin/custom) that the floorplan can filter by.
"use client"

import { useEffect, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { TimeInput12H } from "@/components/ui/time-input-12h"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "react-hot-toast"
import {
  Plus,
  Trash2,
  Save,
  Coffee,
  Utensils,
  Moon,
  Footprints,
  Clock,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { RestaurantShift } from "@/types"
import {
  useRestaurantShifts,
  useBulkSaveShifts,
} from "@/lib/hooks/use-restaurant-shifts"
import { formatShiftRange, getDefaultShiftColor } from "@/lib/utils/shifts"

const SHIFT_TYPES = [
  { value: "breakfast", label: "Breakfast", icon: Coffee, color: "#f59e0b" },
  { value: "lunch",     label: "Lunch",     icon: Utensils, color: "#10b981" },
  { value: "dinner",    label: "Dinner",    icon: Moon, color: "#8b5cf6" },
  { value: "walkin",    label: "Walk-in",   icon: Footprints, color: "#3b82f6" },
  { value: "custom",    label: "Custom",    icon: Clock, color: "#6366f1" },
] as const

const DAYS_OF_WEEK: { value: number; label: string; short: string }[] = [
  { value: 0, label: "Sunday",    short: "Sun" },
  { value: 1, label: "Monday",    short: "Mon" },
  { value: 2, label: "Tuesday",   short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday",  short: "Thu" },
  { value: 5, label: "Friday",    short: "Fri" },
  { value: 6, label: "Saturday",  short: "Sat" },
]

const shiftSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Name is required").max(40),
    shift_type: z.enum(["breakfast", "lunch", "dinner", "walkin", "custom"]),
    start_time: z.string().min(1, "Required"),
    end_time: z.string().min(1, "Required"),
    is_active: z.boolean(),
    display_order: z.number(),
    color: z.string().nullable().optional(),
    applicable_days: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day"),
  })
  .refine((v) => v.end_time > v.start_time, {
    message: "End time must be after start time",
    path: ["end_time"],
  })

const formSchema = z.object({
  shifts: z.array(shiftSchema),
})

type FormValues = z.infer<typeof formSchema>

interface ShiftsFormProps {
  restaurantId: string
}

// Normalise DB time (may be "HH:mm:ss") to HH:mm for TimeInput12H
function toHHmm(t: string | null | undefined): string {
  if (!t) return ""
  return t.slice(0, 5)
}

export function ShiftsForm({ restaurantId }: ShiftsFormProps) {
  const { data: existingShifts, isLoading } = useRestaurantShifts(restaurantId)
  const bulkSave = useBulkSaveShifts()
  const [isDirty, setIsDirty] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { shifts: [] },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "shifts",
  })

  // Hydrate with existing data
  useEffect(() => {
    if (existingShifts) {
      form.reset({
        shifts: existingShifts.map((s) => ({
          id: s.id,
          name: s.name,
          shift_type: s.shift_type,
          start_time: toHHmm(s.start_time),
          end_time: toHHmm(s.end_time),
          is_active: s.is_active,
          display_order: s.display_order,
          color: s.color,
          applicable_days: s.applicable_days,
        })),
      })
      setIsDirty(false)
    }
  }, [existingShifts, form])

  // Track dirty state
  useEffect(() => {
    const subscription = form.watch(() => setIsDirty(true))
    return () => subscription.unsubscribe()
  }, [form])

  const addShift = () => {
    const nextOrder = fields.length
    append({
      name: "",
      shift_type: "custom",
      start_time: "12:00",
      end_time: "14:00",
      is_active: true,
      display_order: nextOrder,
      color: getDefaultShiftColor("custom"),
      applicable_days: [0, 1, 2, 3, 4, 5, 6],
    })
  }

  const addPresetShift = (type: typeof SHIFT_TYPES[number]["value"]) => {
    const preset = SHIFT_TYPES.find((s) => s.value === type)!
    const defaults: Record<typeof type, { start: string; end: string; name: string }> = {
      breakfast: { start: "07:00", end: "11:00", name: "Breakfast" },
      lunch:     { start: "11:30", end: "15:00", name: "Lunch" },
      dinner:    { start: "17:00", end: "22:00", name: "Dinner" },
      walkin:    { start: "15:00", end: "17:00", name: "Walk-in Window" },
      custom:    { start: "12:00", end: "14:00", name: "New Shift" },
    } as any
    const d = defaults[type]
    append({
      name: d.name,
      shift_type: type,
      start_time: d.start,
      end_time: d.end,
      is_active: true,
      display_order: fields.length,
      color: preset.color,
      applicable_days: [0, 1, 2, 3, 4, 5, 6],
    })
  }

  const onSubmit = async (values: FormValues) => {
    if (!restaurantId) return
    try {
      // Ensure display_order matches current position
      const withOrder = values.shifts.map((s, i) => ({
        ...s,
        display_order: i,
        restaurant_id: restaurantId,
        color: s.color || null,
      }))
      // Strip client-side id, DB regenerates
      const payload = withOrder.map(({ id: _id, ...rest }) => rest) as Omit<
        RestaurantShift,
        "id" | "created_at" | "updated_at"
      >[]
      await bulkSave.mutateAsync({ restaurantId, shifts: payload })
      setIsDirty(false)
    } catch {
      // toast handled by hook
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading shifts…
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Service Shifts
                </CardTitle>
                <CardDescription className="mt-1">
                  Named time windows used to filter the floorplan view. Staff can pick a shift to see
                  only the bookings in that window.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No shifts configured. Add your usual service windows below — you can start from a preset.
                </AlertDescription>
              </Alert>
            )}

            {/* Existing shifts */}
            <div className="space-y-3">
              {fields.map((field, index) => {
                const type = form.watch(`shifts.${index}.shift_type`)
                const preset = SHIFT_TYPES.find((t) => t.value === type) ?? SHIFT_TYPES[4]
                const Icon = preset.icon
                const color = form.watch(`shifts.${index}.color`) || preset.color
                const isActive = form.watch(`shifts.${index}.is_active`)
                return (
                  <Card
                    key={field.id}
                    className={cn(
                      "border-2 transition-all",
                      isActive ? "border-border" : "border-dashed border-border/60 opacity-70"
                    )}
                    style={{ borderLeftColor: color, borderLeftWidth: 4 }}
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* Row 1: icon, name, type, active toggle, delete */}
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${color}18` }}
                        >
                          <Icon className="w-5 h-5" style={{ color }} />
                        </div>

                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr,auto] gap-2">
                          <FormField
                            control={form.control}
                            name={`shifts.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input placeholder="Shift name" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`shifts.${index}.shift_type`}
                            render={({ field }) => (
                              <FormItem className="sm:w-40">
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {SHIFT_TYPES.map((t) => (
                                      <SelectItem key={t.value} value={t.value}>
                                        <span className="flex items-center gap-2">
                                          <t.icon className="w-4 h-4" />
                                          {t.label}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <FormField
                            control={form.control}
                            name={`shifts.${index}.is_active`}
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-1.5 space-y-0">
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <FormLabel className="text-xs m-0">Active</FormLabel>
                              </FormItem>
                            )}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10"
                            onClick={() => remove(index)}
                            aria-label="Delete shift"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Row 2: times + color */}
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr,1fr,auto] gap-3">
                        <FormField
                          control={form.control}
                          name={`shifts.${index}.start_time`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Start time</FormLabel>
                              <FormControl>
                                <TimeInput12H
                                  value={field.value}
                                  onChange={field.onChange}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`shifts.${index}.end_time`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">End time</FormLabel>
                              <FormControl>
                                <TimeInput12H
                                  value={field.value}
                                  onChange={field.onChange}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`shifts.${index}.color`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Color</FormLabel>
                              <FormControl>
                                <Input
                                  type="color"
                                  className="h-9 w-14 p-1 cursor-pointer"
                                  value={field.value || preset.color}
                                  onChange={(e) => field.onChange(e.target.value)}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Row 3: applicable days */}
                      <FormField
                        control={form.control}
                        name={`shifts.${index}.applicable_days`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Active on</FormLabel>
                            <div className="flex flex-wrap gap-1.5">
                              {DAYS_OF_WEEK.map((day) => {
                                const isOn = field.value.includes(day.value)
                                return (
                                  <button
                                    key={day.value}
                                    type="button"
                                    onClick={() => {
                                      const next = isOn
                                        ? field.value.filter((d: number) => d !== day.value)
                                        : [...field.value, day.value].sort((a, b) => a - b)
                                      field.onChange(next)
                                    }}
                                    className={cn(
                                      "min-h-[44px] min-w-[44px] px-2.5 text-xs font-medium rounded-md border transition-colors",
                                      isOn
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                                    )}
                                    style={{ touchAction: 'manipulation' }}
                                    aria-pressed={isOn}
                                  >
                                    {day.short}
                                  </button>
                                )
                              })}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Add preset / custom */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs text-muted-foreground mr-1">Add preset:</span>
              {SHIFT_TYPES.filter((t) => t.value !== "custom").map((t) => {
                const Icon = t.icon
                return (
                  <Button
                    key={t.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addPresetShift(t.value)}
                    className="h-8 text-xs"
                  >
                    <Icon className="w-3.5 h-3.5 mr-1.5" style={{ color: t.color }} />
                    {t.label}
                  </Button>
                )
              })}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addShift}
                className="h-8 text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Custom
              </Button>
            </div>

            {/* Save */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              {isDirty && (
                <span className="text-xs text-muted-foreground">Unsaved changes</span>
              )}
              <Button
                type="submit"
                disabled={bulkSave.isPending || !isDirty}
                className="gap-1.5"
              >
                <Save className="w-4 h-4" />
                {bulkSave.isPending ? "Saving…" : "Save shifts"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  )
}
