// app/(dashboard)/loyalty/rules/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
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
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "react-hot-toast"
import {
  Plus,
  Edit,
  Trash2,
  Calendar as CalendarIcon,
  Clock,
  Users,
  Award,
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import type { RestaurantLoyaltyRule } from "@/types"

const loyaltyRuleFormSchema = z.object({
  ruleName: z.string().min(3, "Rule name must be at least 3 characters"),
  pointsToAward: z.number().min(10).max(1000),
  minimumPartySize: z.number().min(1).max(20),
  maximumPartySize: z.number().min(1).max(50).optional(),
  applicableDays: z.array(z.number()).min(1, "Select at least one day"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  validFrom: z.date(),
  validUntil: z.date().optional(),
  maxUsesPerUser: z.number().min(1).optional(),
  maxUsesTotal: z.number().min(1).optional(),
  isActive: z.boolean(),
})

type LoyaltyRuleFormData = z.infer<typeof loyaltyRuleFormSchema>

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
]

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2)
  const minute = i % 2 === 0 ? "00" : "30"
  return {
    value: `${hour.toString().padStart(2, "0")}:${minute}`,
    label: `${hour.toString().padStart(2, "0")}:${minute}`,
  }
})

export default function LoyaltyRulesPage() {
  const [selectedRule, setSelectedRule] =
    useState<RestaurantLoyaltyRule | null>(null)
  const [isAddingRule, setIsAddingRule] = useState(false)

  const supabase = createClient()
  const queryClient = useQueryClient()

  const [restaurantId, setRestaurantId] = useState<string>("")

  useEffect(() => {
    async function getRestaurantId() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: staffData } = await supabase
          .from("restaurant_staff")
          .select("restaurant_id")
          .eq("user_id", user.id)
          .single()

        if (staffData) {
          setRestaurantId(staffData.restaurant_id)
        }
      }
    }
    getRestaurantId()
  }, [supabase])

  const { data: loyaltyRules, isLoading } = useQuery({
    queryKey: ["loyalty-rules", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []

      const { data, error } = await supabase
        .from("restaurant_loyalty_rules")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("priority", { ascending: true })

      if (error) throw error
      return data as RestaurantLoyaltyRule[]
    },
    enabled: !!restaurantId,
  })

  const form = useForm<LoyaltyRuleFormData>({
    resolver: zodResolver(loyaltyRuleFormSchema),
    defaultValues: {
      ruleName: "",
      pointsToAward: 100,
      minimumPartySize: 1,
      applicableDays: [0, 1, 2, 3, 4, 5, 6],
      validFrom: new Date(),
      isActive: true,
    },
  })

  const ruleMutation = useMutation({
    mutationFn: async (data: LoyaltyRuleFormData) => {
      const ruleData = {
        restaurant_id: restaurantId,
        rule_name: data.ruleName,
        points_to_award: data.pointsToAward,
        minimum_party_size: data.minimumPartySize,
        maximum_party_size: data.maximumPartySize,
        applicable_days: data.applicableDays,
        start_time_minutes: data.startTime
          ? parseInt(data.startTime.split(":")[0]) * 60 +
            parseInt(data.startTime.split(":")[1])
          : null,
        end_time_minutes: data.endTime
          ? parseInt(data.endTime.split(":")[0]) * 60 +
            parseInt(data.endTime.split(":")[1])
          : null,
        valid_from: data.validFrom.toISOString(),
        valid_until: data.validUntil?.toISOString(),
        max_uses_per_user: data.maxUsesPerUser,
        max_uses_total: data.maxUsesTotal,
        is_active: data.isActive,
      }

      if (selectedRule) {
        const { error } = await supabase
          .from("restaurant_loyalty_rules")
          .update({
            ...ruleData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedRule.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from("restaurant_loyalty_rules")
          .insert(ruleData)

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty-rules"] })
      toast.success(selectedRule ? "Rule updated" : "Rule created")
      setSelectedRule(null)
      setIsAddingRule(false)
      form.reset()
    },
    onError: () => {
      toast.error("Failed to save loyalty rule")
    },
  })

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase
        .from("restaurant_loyalty_rules")
        .delete()
        .eq("id", ruleId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty-rules"] })
      toast.success("Rule deleted")
    },
    onError: () => {
      toast.error("Failed to delete rule")
    },
  })

  const toggleRuleMutation = useMutation({
    mutationFn: async ({
      ruleId,
      isActive,
    }: {
      ruleId: string
      isActive: boolean
    }) => {
      const { error } = await supabase
        .from("restaurant_loyalty_rules")
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ruleId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty-rules"] })
      toast.success("Rule status updated")
    },
    onError: () => {
      toast.error("Failed to update rule status")
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loyalty Rules</h1>
          <p className="text-muted-foreground text-sm">Manage loyalty rules for your customers
          </p>
        </div>
        <Dialog
          open={isAddingRule || !!selectedRule}
          onOpenChange={open => {
            if (!open) {
              setIsAddingRule(false)
              setSelectedRule(null)
              form.reset()
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setIsAddingRule(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedRule ? "Edit Loyalty Rule" : "Create Loyalty Rule"}
              </DialogTitle>
              <DialogDescription>
                Set up rules for awarding loyalty points to customers
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(data => ruleMutation.mutate(data))}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="ruleName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rule Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Happy Hour Bonus"
                          {...field}
                          disabled={ruleMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pointsToAward"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Points to Award</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground text-sm">{field.value} points
                            </span>
                            <Input
                              type="number"
                              className="w-20"
                              {...field}
                              onChange={e =>
                                field.onChange(parseInt(e.target.value))
                              }
                              disabled={ruleMutation.isPending}
                            />
                          </div>
                          <Slider
                            value={[field.value]}
                            onValueChange={([value]) => field.onChange(value)}
                            min={10}
                            max={1000}
                            step={10}
                            disabled={ruleMutation.isPending}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="minimumPartySize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Party Size</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="1"
                            {...field}
                            onChange={e =>
                              field.onChange(parseInt(e.target.value))
                            }
                            disabled={ruleMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maximumPartySize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Party Size (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="No limit"
                            {...field}
                            value={field.value || ""}
                            onChange={e =>
                              field.onChange(
                                e.target.value
                                  ? parseInt(e.target.value)
                                  : undefined
                              )
                            }
                            disabled={ruleMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="applicableDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Applicable Days</FormLabel>
                      <FormDescription>
                        Select which days of the week this rule applies
                      </FormDescription>
                      <div className="grid grid-cols-7 gap-2">
                        {DAYS_OF_WEEK.map(day => (
                          <div
                            key={day.value}
                            className="flex items-center space-x-2"
                          >
                            <input
                              type="checkbox"
                              id={`rule-day-${day.value}`}
                              checked={field.value.includes(day.value)}
                              onChange={e => {
                                if (e.target.checked) {
                                  field.onChange([...field.value, day.value])
                                } else {
                                  field.onChange(
                                    field.value.filter(d => d !== day.value)
                                  )
                                }
                              }}
                              className="h-4 w-4"
                              disabled={ruleMutation.isPending}
                            />
                            <label
                              htmlFor={`rule-day-${day.value}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {day.label.slice(0, 3)}
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time (Optional)</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={ruleMutation.isPending}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Any time" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TIME_SLOTS.map(slot => (
                              <SelectItem key={slot.value} value={slot.value}>
                                {slot.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time (Optional)</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={ruleMutation.isPending}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Any time" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TIME_SLOTS.map(slot => (
                              <SelectItem key={slot.value} value={slot.value}>
                                {slot.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="validFrom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valid From</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                                disabled={ruleMutation.isPending}
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
                          <PopoverContent
                            className="w-auto p-0"
                            align="start"
                          >
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="validUntil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valid Until (Optional)</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                                disabled={ruleMutation.isPending}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>No end date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto p-0"
                            align="start"
                          >
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={date =>
                                date < form.getValues("validFrom")
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="maxUsesPerUser"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Uses Per User (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Unlimited"
                            {...field}
                            value={field.value || ""}
                            onChange={e =>
                              field.onChange(
                                e.target.value
                                  ? parseInt(e.target.value)
                                  : undefined
                              )
                            }
                            disabled={ruleMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxUsesTotal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Total Uses (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Unlimited"
                            {...field}
                            value={field.value || ""}
                            onChange={e =>
                              field.onChange(
                                e.target.value
                                  ? parseInt(e.target.value)
                                  : undefined
                              )
                            }
                            disabled={ruleMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active</FormLabel>
                        <FormDescription>
                          Enable this rule to start awarding points
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={ruleMutation.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddingRule(false)
                      setSelectedRule(null)
                      form.reset()
                    }}
                    disabled={ruleMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={ruleMutation.isPending}>
                    {ruleMutation.isPending
                      ? "Saving..."
                      : selectedRule
                      ? "Update Rule"
                      : "Create Rule"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Loyalty Rules</CardTitle>
          <CardDescription>
            A complete list of all loyalty rules for your restaurant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule Name</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Party Size</TableHead>
                <TableHead>Applicable Days</TableHead>
                <TableHead>Time Range</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (
                loyaltyRules?.map(rule => {
                  const applicableDays = DAYS_OF_WEEK.filter(d =>
                    rule.applicable_days.includes(d.value)
                  )
                    .map(d => d.label.slice(0, 3))
                    .join(", ")

                  const timeRange =
                    rule.start_time_minutes != null &&
                    rule.end_time_minutes != null
                      ? `${Math.floor(rule.start_time_minutes / 60)
                          .toString()
                          .padStart(2, "0")}:${(rule.start_time_minutes % 60)
                          .toString()
                          .padStart(2, "0")} - ${Math.floor(
                          rule.end_time_minutes / 60
                        )
                          .toString()
                          .padStart(2, "0")}:${(rule.end_time_minutes % 60)
                          .toString()
                          .padStart(2, "0")}`
                      : "Any time"

                  return (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">
                        {rule.rule_name}
                      </TableCell>
                      <TableCell>{rule.points_to_award}</TableCell>
                      <TableCell>
                        {rule.minimum_party_size}
                        {rule.maximum_party_size
                          ? `-${rule.maximum_party_size}`
                          : "+"}
                      </TableCell>
                      <TableCell>{applicableDays}</TableCell>
                      <TableCell>{timeRange}</TableCell>
                      <TableCell>
                        <Badge
                          variant={rule.is_active ? "default" : "secondary"}
                        >
                          {rule.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.is_active}
                            onCheckedChange={checked =>
                              toggleRuleMutation.mutate({
                                ruleId: rule.id,
                                isActive: checked,
                              })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedRule(rule)
                              form.reset({
                                ruleName: rule.rule_name,
                                pointsToAward: rule.points_to_award,
                                minimumPartySize: rule.minimum_party_size,
                                maximumPartySize:
                                  rule.maximum_party_size || undefined,
                                applicableDays: rule.applicable_days,
                                startTime:
                                  rule.start_time_minutes != null
                                    ? `${Math.floor(
                                        rule.start_time_minutes / 60
                                      )
                                        .toString()
                                        .padStart(2, "0")}:${(
                                        rule.start_time_minutes % 60
                                      )
                                        .toString()
                                        .padStart(2, "0")}`
                                    : undefined,
                                endTime:
                                  rule.end_time_minutes != null
                                    ? `${Math.floor(
                                        rule.end_time_minutes / 60
                                      )
                                        .toString()
                                        .padStart(2, "0")}:${(
                                        rule.end_time_minutes % 60
                                      )
                                        .toString()
                                        .padStart(2, "0")}`
                                    : undefined,
                                validFrom: new Date(rule.valid_from),
                                validUntil: rule.valid_until
                                  ? new Date(rule.valid_until)
                                  : undefined,
                                maxUsesPerUser:
                                  rule.max_uses_per_user || undefined,
                                maxUsesTotal:
                                  rule.max_uses_total || undefined,
                                isActive: rule.is_active,
                              })
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (
                                confirm(
                                  "Are you sure you want to delete this rule?"
                                )
                              ) {
                                deleteRuleMutation.mutate(rule.id)
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

