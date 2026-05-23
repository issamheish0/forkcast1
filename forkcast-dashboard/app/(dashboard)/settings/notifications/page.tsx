// app/(dashboard)/settings/notifications/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "react-hot-toast"
import { 
  Bell,
  Mail,
  MessageSquare,
  Calendar,
  UserPlus,
  Star,
  AlertCircle,
  TrendingUp,
  Clock,
  Save,
  ArrowLeft,
  Smartphone,
  Volume2,
  Heart,
  Users
} from "lucide-react"

const notificationSettingsSchema = z.object({
  // Core notification preferences (stored in profiles.notification_preferences JSONB)
  email: z.boolean(),
  sms: z.boolean(), 
  push: z.boolean(),
  
  // Booking notifications
  booking_confirmations: z.boolean(),
  booking_reminders: z.boolean(),
  booking_cancellations: z.boolean(),
  booking_modifications: z.boolean(),
  
  // Social notifications
  friend_requests: z.boolean(),
  friend_activity: z.boolean(),
  group_invites: z.boolean(),
  
  // Restaurant notifications
  special_offers: z.boolean(),
  new_restaurants: z.boolean(),
  loyalty_updates: z.boolean(),
  
  // Marketing preferences (from user_privacy_settings table)
  marketing_emails: z.boolean(),
  promotional_sms: z.boolean(),
  
  // Timing preferences
  quiet_hours_enabled: z.boolean(),
  quiet_hours_start: z.string(),
  quiet_hours_end: z.string(),
  
  // Summary preferences
  weekly_summary: z.boolean(),
  monthly_highlights: z.boolean(),
})

type NotificationSettingsData = z.infer<typeof notificationSettingsSchema>

const NOTIFICATION_CATEGORIES = [
  {
    id: "bookings",
    title: "Booking Updates",
    icon: Calendar,
    description: "Stay informed about your restaurant reservations",
    notifications: [
      {
        id: "booking_confirmations",
        label: "Booking confirmations",
        description: "When your reservation is confirmed by the restaurant",
        channels: ["email", "sms", "push"],
      },
      {
        id: "booking_reminders", 
        label: "Booking reminders",
        description: "Reminders 2 hours before your reservation",
        channels: ["push", "sms"],
      },
      {
        id: "booking_cancellations",
        label: "Cancellation alerts",
        description: "If a restaurant cancels or needs to reschedule",
        channels: ["email", "sms", "push"],
      },
      {
        id: "booking_modifications",
        label: "Booking changes",
        description: "When restaurants modify your reservation details",
        channels: ["email", "push"],
      },
    ],
  },
  {
    id: "social",
    title: "Social & Friends",
    icon: Users,
    description: "Connect and share experiences with friends",
    notifications: [
      {
        id: "friend_requests",
        label: "Friend requests",
        description: "When someone sends you a friend request",
        channels: ["push", "email"],
      },
      {
        id: "friend_activity",
        label: "Friend activity",
        description: "When friends share reviews or favorite new restaurants",
        channels: ["push"],
      },
      {
        id: "group_invites",
        label: "Group booking invites",
        description: "When friends invite you to join their reservations",
        channels: ["push", "email"],
      },
    ],
  },
  {
    id: "restaurants",
    title: "Restaurant Updates",
    icon: Star,
    description: "Discover new places and special offers",
    notifications: [
      {
        id: "special_offers",
        label: "Special offers",
        description: "Exclusive deals from your favorite restaurants",
        channels: ["email", "push"],
      },
      {
        id: "new_restaurants",
        label: "New restaurants",
        description: "When new restaurants join in your area",
        channels: ["email"],
      },
      {
        id: "loyalty_updates",
        label: "Loyalty rewards",
        description: "Updates about your points and available rewards",
        channels: ["push", "email"],
      },
    ],
  },
]

export default function NotificationSettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Fetch user notification settings
  const { data: userSettings, isLoading } = useQuery({
    queryKey: ["user-notification-settings"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Fetch from profiles table (notification_preferences JSONB)
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("id", user.id)
        .single()

      if (profileError) throw profileError

      // Fetch from user_privacy_settings table
      const { data: privacyData, error: privacyError } = await supabase
        .from("user_privacy_settings")
        .select("marketing_emails, push_notifications")
        .eq("user_id", user.id)
        .single()

      // Combine the data with defaults
      const notificationPrefs = profileData?.notification_preferences || {}
      const privacySettings:any = privacyData || {}

      return {
        // Core preferences from JSONB
        email: notificationPrefs.email ?? true,
        sms: notificationPrefs.sms ?? false,
        push: notificationPrefs.push ?? true,
        
        // Specific notification types (with defaults)
        booking_confirmations: notificationPrefs.booking_confirmations ?? true,
        booking_reminders: notificationPrefs.booking_reminders ?? true,
        booking_cancellations: notificationPrefs.booking_cancellations ?? true,
        booking_modifications: notificationPrefs.booking_modifications ?? true,
        
        friend_requests: notificationPrefs.friend_requests ?? true,
        friend_activity: notificationPrefs.friend_activity ?? false,
        group_invites: notificationPrefs.group_invites ?? true,
        
        special_offers: notificationPrefs.special_offers ?? true,
        new_restaurants: notificationPrefs.new_restaurants ?? false,
        loyalty_updates: notificationPrefs.loyalty_updates ?? true,
        
        // Marketing from privacy settings
        marketing_emails: privacySettings.marketing_emails ?? true,
        promotional_sms: notificationPrefs.promotional_sms ?? false,
        
        // Timing
        quiet_hours_enabled: notificationPrefs.quiet_hours_enabled ?? false,
        quiet_hours_start: notificationPrefs.quiet_hours_start ?? "22:00",
        quiet_hours_end: notificationPrefs.quiet_hours_end ?? "08:00",
        
        // Summaries
        weekly_summary: notificationPrefs.weekly_summary ?? true,
        monthly_highlights: notificationPrefs.monthly_highlights ?? true,
      }
    },
  })

  // Form
  const form = useForm<NotificationSettingsData>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      email: true,
      sms: false,
      push: true,
      booking_confirmations: true,
      booking_reminders: true,
      booking_cancellations: true,
      booking_modifications: true,
      friend_requests: true,
      friend_activity: false,
      group_invites: true,
      special_offers: true,
      new_restaurants: false,
      loyalty_updates: true,
      marketing_emails: true,
      promotional_sms: false,
      quiet_hours_enabled: false,
      quiet_hours_start: "22:00",
      quiet_hours_end: "08:00",
      weekly_summary: true,
      monthly_highlights: true,
    },
  })

  // Update form when settings load
  useEffect(() => {
    if (userSettings) {
      form.reset(userSettings)
    }
  }, [userSettings, form])

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: NotificationSettingsData) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Separate the data for different tables
      const { marketing_emails, ...notificationPrefs } = data

      // Update notification_preferences JSONB in profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          notification_preferences: notificationPrefs,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (profileError) throw profileError

      // Update user_privacy_settings table
      const { error: privacyError } = await supabase
        .from("user_privacy_settings")
        .upsert({
          user_id: user.id,
          marketing_emails,
          push_notifications: data.push,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        })

      if (privacyError) throw privacyError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notification-settings"] })
      toast.success("Notification settings updated")
    },
    onError: (error) => {
      console.error("Error updating settings:", error)
      toast.error("Failed to update settings")
    },
  })

  const watchQuietHours = form.watch("quiet_hours_enabled")
  const watchEmail = form.watch("email")
  const watchSMS = form.watch("sms")
  const watchPush = form.watch("push")

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="motion-safe:animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading notification settings...</p>
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => router.push("/settings")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="w-8 h-8 rounded-md bg-rose-500 flex items-center justify-center">
              <Bell className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Notifications</h1>
              <p className="text-xs text-muted-foreground">Alerts & communication settings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3">
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => updateSettingsMutation.mutate(data))} className="space-y-4 max-w-4xl mx-auto">
          
          {/* Global Notification Channels */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Channels
              </CardTitle>
              <CardDescription>
                Choose your preferred ways to receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email
                        </FormLabel>
                        <FormDescription>
                          Notifications via email
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={updateSettingsMutation.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          SMS
                        </FormLabel>
                        <FormDescription>
                          Text message alerts
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={updateSettingsMutation.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="push"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base flex items-center gap-2">
                          <Smartphone className="h-4 w-4" />
                          Push Notifications
                        </FormLabel>
                        <FormDescription>
                          Mobile app notifications
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={updateSettingsMutation.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notification Categories */}
          {NOTIFICATION_CATEGORIES.map((category) => (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <category.icon className="h-5 w-5" />
                  {category.title}
                </CardTitle>
                <CardDescription>
                  {category.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {category.notifications.map((notification) => (
                  <div key={notification.id} className="space-y-3">
                    <FormField
                      control={form.control}
                      name={notification.id as keyof NotificationSettingsData}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              {notification.label}
                            </FormLabel>
                            <FormDescription>
                              {notification.description}
                            </FormDescription>
                            <div className="flex gap-2 mt-2">
                              {notification.channels.map((channel) => {
                                const isEnabled = channel === "email" ? watchEmail : 
                                                channel === "sms" ? watchSMS : watchPush
                                const Icon = channel === "email" ? Mail : 
                                           channel === "sms" ? MessageSquare : Smartphone
                                return (
                                  <Badge 
                                    key={channel} 
                                    variant={isEnabled ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    <Icon className="h-3 w-3 mr-1" />
                                    {channel.toUpperCase()}
                                  </Badge>
                                )
                              })}
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value as boolean}
                              onCheckedChange={field.onChange}
                              disabled={updateSettingsMutation.isPending}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          {/* Marketing & Promotions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Marketing & Promotions
              </CardTitle>
              <CardDescription>
                Control promotional and marketing communications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="marketing_emails"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Marketing emails</FormLabel>
                      <FormDescription>
                        Promotional offers, newsletters, and restaurant features
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={updateSettingsMutation.isPending || !watchEmail}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="promotional_sms"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Promotional SMS</FormLabel>
                      <FormDescription>
                        Last-minute deals and flash offers via text
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={updateSettingsMutation.isPending || !watchSMS}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Quiet Hours */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Quiet Hours
              </CardTitle>
              <CardDescription>
                Set times when you don't want to receive non-urgent notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="quiet_hours_enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Quiet Hours</FormLabel>
                      <FormDescription>
                        Booking confirmations and urgent alerts will still come through
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={updateSettingsMutation.isPending}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              {watchQuietHours && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quiet_hours_start"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <input
                            type="time"
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            disabled={updateSettingsMutation.isPending}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="quiet_hours_end"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <FormControl>
                          <input
                            type="time"
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            disabled={updateSettingsMutation.isPending}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Summary & Highlights
              </CardTitle>
              <CardDescription>
                Periodic summaries of your dining activity and recommendations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="weekly_summary"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Weekly Summary</FormLabel>
                      <FormDescription>
                        Your week in dining - bookings, reviews, and new discoveries
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={updateSettingsMutation.isPending || !watchEmail}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="monthly_highlights"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Monthly Highlights</FormLabel>
                      <FormDescription>
                        Personal dining stats and recommendations for next month
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={updateSettingsMutation.isPending || !watchEmail}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={updateSettingsMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </Form>
      </div>
    </div>
  )
}

