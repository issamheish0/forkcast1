// app/(dashboard)/settings/page.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "react-hot-toast"
import { 
  Settings, 
  Store, 
  Clock, 
  DollarSign, 
  Globe,
  Bell,
  Shield,
  Calendar,
  MapPin,
  Phone,
  Instagram,
  Link2,
  Save,
  ChevronRight,
  Smartphone,
  Download,
  Copy,
  Check,
  CreditCard,
  Banknote
} from "lucide-react"
import Link from "next/link"
import { PushNotificationManager } from "@/components/pwa/push-notification-manager"
import { InstallPrompt } from "@/components/pwa/install-prompt"
import { LocationManager } from "@/components/location/location-manager"
import { EnhancedAddressSearch } from "@/components/location/enhanced-address-search"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { CUISINE_TYPES, DIETARY_OPTIONS, AMBIANCE_TAGS } from "@/lib/constants/cuisines"
import { EnhancedRestaurantImageUpload } from "@/components/ui/enhanced-restaurant-image-upload"

// Type definitions
type Restaurant = {
  id: string
  name: string
  description?: string
  address: string
  phone_number?: string
  whatsapp_number?: string
  website_url?: string
  instagram_handle?: string
  email?: string
  menu_url?: string
  main_image_url?: string | null
  image_urls?: string[] | null
  booking_window_days: number
  cancellation_window_hours: number
  table_turnover_minutes: number
  booking_policy: "instant" | "request"
  price_range: number
  cuisine_type: string
  secondary_cuisines?: string[]
  dietary_options?: string[]
  ambiance_tags?: string[]
  parking_available: boolean
  valet_parking: boolean
  outdoor_seating: boolean
  shisha_available: boolean
  minimum_age?: number
  min_party_size?: number
  max_party_size?: number
  show_dining_duration: boolean
  status?: "active" | "inactive" | "suspended"
  auto_decline_enabled?: boolean
  request_expiry_hours?: number
}

// Form schemas
const generalSettingsSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  phone_number: z.string().optional(),
  whatsapp_number: z.string().optional(),
  website_url: z.string().trim().optional(),
  instagram_handle: z.string().optional(),
  address: z.string().min(5, "Address is required"),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /.+@.+/.test(v), { message: "Enter a valid email" }),
  menu_url: z.string().trim().optional(),
})

const operationalSettingsSchema = z.object({
  booking_window_days: z.number().min(1).max(90),
  cancellation_window_hours: z.number().min(1).max(48),
  table_turnover_minutes: z.number().min(30).max(240),
  booking_policy: z.enum(["instant", "request"]),
  minimum_age: z.number().max(99).nullable().optional(),
  show_dining_duration: z.boolean(),
  min_party_size: z.number().min(1).max(500),
  max_party_size: z.number().min(1).max(500),
  status: z.enum(["active", "inactive", "suspended"]),
  auto_decline_enabled: z.boolean(),
  request_expiry_hours: z.number().min(1).max(168),
})

const pricingSettingsSchema = z.object({
  price_range: z.number().min(1).max(4),
  cuisine_type: z.string(),
  secondary_cuisines: z.array(z.string()).optional(),
  dietary_options: z.array(z.string()),
  ambiance_tags: z.array(z.string()),
  parking_available: z.boolean(),
  valet_parking: z.boolean(),
  outdoor_seating: z.boolean(),
  shisha_available: z.boolean(),
})

type GeneralSettingsData = z.infer<typeof generalSettingsSchema>
type OperationalSettingsData = z.infer<typeof operationalSettingsSchema>
type PricingSettingsData = z.infer<typeof pricingSettingsSchema>

export default function SettingsPage() {
  const { tier, currentRestaurant } = useRestaurantContext()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState("profile")
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [mainImageUrl, setMainImageUrl] = useState<string>("")
  const [imageUrls, setImageUrls] = useState<string[]>([])

  // Get restaurant data
  const [restaurantId, setRestaurantId] = useState<string>("")
  
  // Set restaurant ID from current restaurant context
  useEffect(() => {
    if (currentRestaurant) {
      setRestaurantId(currentRestaurant.restaurant.id)
    } else {
      setRestaurantId("")
    }
  }, [currentRestaurant])

  // Fetch restaurant data — disable refetch-on-focus so unsaved edits aren't clobbered
  const { data: restaurant, isLoading } = useQuery({
    queryKey: ["restaurant", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null

      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .single()

      if (error) throw error
      return data as Restaurant
    },
    enabled: !!restaurantId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000,
  })

  // Forms
  const generalForm = useForm<GeneralSettingsData>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      name: "",
      description: "",
      phone_number: "",
      whatsapp_number: "",
      website_url: "",
      instagram_handle: "",
      address: "",
      email: "",
      menu_url: "",
    },
  })

  const operationalForm = useForm<OperationalSettingsData>({
    resolver: zodResolver(operationalSettingsSchema),
    defaultValues: {
      booking_window_days: 30,
      cancellation_window_hours: 24,
      table_turnover_minutes: 120,
      booking_policy: "instant",
      minimum_age: null,
      show_dining_duration: false,
      min_party_size: 1,
      max_party_size: 10,
      status: "active",
      auto_decline_enabled: true,
      request_expiry_hours: 24,
    },
  })

  const pricingForm = useForm<PricingSettingsData>({
    resolver: zodResolver(pricingSettingsSchema),
    defaultValues: {
      price_range: 2,
      cuisine_type: "",
      secondary_cuisines: [],
      dietary_options: [],
      ambiance_tags: [],
      parking_available: false,
      valet_parking: false,
      outdoor_seating: false,
      shisha_available: false,
    },
  })

  // Reset forms ONCE per restaurant so refetches don't clobber unsaved edits.
  const lastResetForId = useRef<string | null>(null)
  useEffect(() => {
    if (!restaurant || !restaurantId) return
    if (lastResetForId.current === restaurantId) return
    lastResetForId.current = restaurantId

    generalForm.reset({
      name: restaurant.name,
      description: restaurant.description || "",
      phone_number: restaurant.phone_number || "",
      whatsapp_number: restaurant.whatsapp_number || "",
      website_url: restaurant.website_url || "",
      instagram_handle: restaurant.instagram_handle || "",
      address: restaurant.address,
      email: restaurant.email || "",
      menu_url: restaurant.menu_url || "",
    })

    operationalForm.reset({
      booking_window_days: restaurant.booking_window_days,
      cancellation_window_hours: restaurant.cancellation_window_hours,
      table_turnover_minutes: restaurant.table_turnover_minutes,
      booking_policy: restaurant.booking_policy,
      minimum_age: restaurant.minimum_age ?? null,
      show_dining_duration: restaurant.show_dining_duration ?? false,
      min_party_size: restaurant.min_party_size ?? 1,
      max_party_size: restaurant.max_party_size ?? 10,
      status: restaurant.status ?? "active",
      auto_decline_enabled: restaurant.auto_decline_enabled ?? true,
      request_expiry_hours: restaurant.request_expiry_hours ?? 24,
    })

    pricingForm.reset({
      price_range: restaurant.price_range,
      cuisine_type: restaurant.cuisine_type,
      secondary_cuisines: restaurant.secondary_cuisines || [],
      dietary_options: restaurant.dietary_options || [],
      ambiance_tags: restaurant.ambiance_tags || [],
      parking_available: restaurant.parking_available,
      valet_parking: restaurant.valet_parking,
      outdoor_seating: restaurant.outdoor_seating,
      shisha_available: restaurant.shisha_available,
    })

    setMainImageUrl(restaurant.main_image_url || "")
    setImageUrls(Array.isArray(restaurant.image_urls) ? restaurant.image_urls : [])
  }, [restaurant, restaurantId, generalForm, operationalForm, pricingForm])

  // Update mutations
  const updateRestaurantMutation = useMutation({
    mutationFn: async (data: Partial<Restaurant>) => {
      const trimToNull = (v?: string | null) => {
        const t = (v || "").trim()
        return t === "" ? null : t
      }
      const normalizeUrl = (v?: string | null) => {
        const t = trimToNull(v)
        if (!t) return null
        if (/^https?:\/\//i.test(t)) return t
        return `https://${t}`
      }
      const normalizeInstagram = (v?: string | null) => {
        const t = trimToNull(v)
        if (!t) return null
        return t.replace(/^@/, "")
      }

      const payload: Record<string, unknown> = { ...data, updated_at: new Date().toISOString() }
      if ("description" in payload) payload.description = trimToNull(data.description as string)
      if ("phone_number" in payload) payload.phone_number = trimToNull(data.phone_number as string)
      if ("whatsapp_number" in payload) payload.whatsapp_number = trimToNull(data.whatsapp_number as string)
      if ("instagram_handle" in payload) payload.instagram_handle = normalizeInstagram(data.instagram_handle as string)
      if ("email" in payload) payload.email = trimToNull(data.email as string)
      if ("website_url" in payload) payload.website_url = normalizeUrl(data.website_url as string)
      if ("menu_url" in payload) payload.menu_url = normalizeUrl(data.menu_url as string)

      const { error } = await supabase
        .from("restaurants")
        .update(payload)
        .eq("id", restaurantId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant"] })
      toast.success("Settings updated successfully")
    },
    onError: () => {
      toast.error("Failed to update settings")
    },
  })

  // Handle form submissions
  const handleGeneralSubmit = (data: GeneralSettingsData) => {
    updateRestaurantMutation.mutate(data)
  }

  const handleImagesSave = () => {
    updateRestaurantMutation.mutate({
      main_image_url: mainImageUrl || null,
      image_urls: imageUrls.length > 0 ? imageUrls : null,
    } as Partial<Restaurant>)
  }

  const handleOperationalSubmit = (data: OperationalSettingsData) => {
    // Force request booking policy for Basic tier
    const submitData = tier === 'basic' 
      ? { ...data, booking_policy: 'request' as const }
      : data
    
    updateRestaurantMutation.mutate(submitData)
  }

  const handlePricingSubmit = (data: PricingSettingsData) => {
    updateRestaurantMutation.mutate(data)
  }

  // Copy link to clipboard
  const copyToClipboard = async (text: string, linkType: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedLink(linkType)
      toast.success("Link copied to clipboard!")
      setTimeout(() => setCopiedLink(null), 2000)
    } catch (err) {
      toast.error("Failed to copy link")
    }
  }

  // Using imported CUISINE_TYPES and DIETARY_OPTIONS from lib/constants/cuisines.ts

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex-shrink-0 px-3 py-2 border-b bg-card">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-slate-500 flex items-center justify-center">
              <Settings className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Settings</h1>
              <p className="text-xs text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading settings...</div>
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
            <div className="w-8 h-8 rounded-md bg-slate-500 flex items-center justify-center">
              <Settings className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Settings</h1>
              <p className="text-xs text-muted-foreground">Manage restaurant preferences</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-4">
          {/* Quick Access Section - Organized by Category */}
          <div className="space-y-3">
            {/* Scheduling Section */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2 px-1">Scheduling</h3>
              <div className="grid gap-2 md:grid-cols-2">
                <Link href="/settings/availability">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-2 border-l-blue-500">
                    <CardHeader className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-md bg-blue-100 dark:bg-blue-800/50 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                          </div>
                          <div>
                            <CardTitle className="text-xs font-medium">Operating Hours</CardTitle>
                            <CardDescription className="text-xs">
                              Regular hours, closures & special dates
                            </CardDescription>
                          </div>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                  </Card>
                </Link>

                <Link href="/settings/events">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-2 border-l-purple-500">
                    <CardHeader className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-md bg-purple-100 dark:bg-purple-800/50 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-purple-700 dark:text-purple-300" />
                          </div>
                          <div>
                            <CardTitle className="text-xs font-medium">Events & Holidays</CardTitle>
                            <CardDescription className="text-xs">
                              Special events & holiday schedules
                            </CardDescription>
                          </div>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              </div>
            </div>

            {/* Payments Section */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2 px-1">Payments & Security</h3>
              <div className="grid gap-2 md:grid-cols-2">
                <Link href="/settings/deposits">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-2 border-l-green-500">
                    <CardHeader className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-md bg-green-100 dark:bg-green-800/50 flex items-center justify-center">
                            <Banknote className="h-5 w-5 text-green-700 dark:text-green-300" />
                          </div>
                          <div>
                            <CardTitle className="text-xs font-medium">Deposits</CardTitle>
                            <CardDescription className="text-xs">
                              Require upfront deposits for bookings
                            </CardDescription>
                          </div>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                  </Card>
                </Link>

                <Link href="/settings/guarantees">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-2 border-l-amber-500">
                    <CardHeader className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-md bg-amber-100 dark:bg-amber-800/50 flex items-center justify-center">
                            <CreditCard className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                          </div>
                          <div>
                            <CardTitle className="text-xs font-medium">Card Guarantees</CardTitle>
                            <CardDescription className="text-xs">
                              No-show fees & card requirements
                            </CardDescription>
                          </div>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                  </Card>
                </Link>

                <Link href="/settings/notifications">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-2 border-l-rose-500">
                    <CardHeader className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-md bg-rose-100 dark:bg-rose-800/50 flex items-center justify-center">
                            <Bell className="h-5 w-5 text-rose-700 dark:text-rose-300" />
                          </div>
                          <div>
                            <CardTitle className="text-xs font-medium">Notifications</CardTitle>
                            <CardDescription className="text-xs">
                              Email, SMS & push notification preferences
                            </CardDescription>
                          </div>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              </div>
            </div>
          </div>

          <Separator />

          {/* Main Settings Tabs - Consolidated to 4 clear categories */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex w-full h-10 p-1 gap-0.5">
              <TabsTrigger value="profile" className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs h-full">
                <Store className="h-3.5 w-3.5 shrink-0" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="bookings" className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs h-full">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                Bookings
              </TabsTrigger>
              <TabsTrigger value="amenities" className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs h-full">
                <Settings className="h-3.5 w-3.5 shrink-0" />
                Amenities
              </TabsTrigger>
              <TabsTrigger value="share" className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs h-full">
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                Share
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-3 mt-3">
              {/* Restaurant Images */}
              <Card>
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-sm">Restaurant Images</CardTitle>
                  <CardDescription className="text-xs">
                    Upload and manage your restaurant images. Pick any image as the main image and reorder the gallery as needed.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-3">
                  {restaurantId && (
                    <EnhancedRestaurantImageUpload
                      restaurantId={restaurantId}
                      mainImageUrl={mainImageUrl}
                      images={imageUrls}
                      onMainImageChange={setMainImageUrl}
                      onImagesChange={setImageUrls}
                      maxImages={10}
                      maxFileSize={5}
                    />
                  )}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleImagesSave}
                      disabled={updateRestaurantMutation.isPending}
                    >
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      {updateRestaurantMutation.isPending ? "Saving..." : "Save Images"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-sm">Restaurant Profile</CardTitle>
                  <CardDescription className="text-xs">
                    Basic information and contact details
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <Form {...generalForm}>
                    <form onSubmit={generalForm.handleSubmit(handleGeneralSubmit)} className="space-y-3">
                      <FormField
                        control={generalForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Restaurant Name</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={updateRestaurantMutation.isPending} className="h-8 text-sm" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={generalForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Description</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                disabled={updateRestaurantMutation.isPending}
                                rows={3}
                                className="text-sm"
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              A brief description of your restaurant
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={generalForm.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Address</FormLabel>
                            <FormControl>
                              <EnhancedAddressSearch
                                value={field.value}
                                onChange={(address) => {
                                  field.onChange(address)
                                }}
                                placeholder="Search for your restaurant address..."
                                disabled={updateRestaurantMutation.isPending}
                                showCurrentLocation={false}
                                maxResults={6}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <Separator />
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField
                          control={generalForm.control}
                          name="phone_number"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Phone Number</FormLabel>
                              <FormControl>
                                <div className="flex">
                                  <Phone className="mr-2 h-3.5 w-3.5 mt-2 text-muted-foreground" />
                                  <Input {...field} disabled={updateRestaurantMutation.isPending} className="h-8 text-sm" />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={generalForm.control}
                          name="whatsapp_number"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">WhatsApp Number</FormLabel>
                              <FormControl>
                                <div className="flex">
                                  <Phone className="mr-2 h-3.5 w-3.5 mt-2 text-muted-foreground" />
                                  <Input {...field} disabled={updateRestaurantMutation.isPending} className="h-8 text-sm" />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField
                          control={generalForm.control}
                          name="website_url"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Website URL</FormLabel>
                              <FormControl>
                                <div className="flex">
                                  <Globe className="mr-2 h-3.5 w-3.5 mt-2 text-muted-foreground" />
                                  <Input {...field} disabled={updateRestaurantMutation.isPending} className="h-8 text-sm" />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={generalForm.control}
                          name="instagram_handle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Instagram Handle</FormLabel>
                              <FormControl>
                                <div className="flex">
                                  <Instagram className="mr-2 h-3.5 w-3.5 mt-2 text-muted-foreground" />
                                  <Input
                                    {...field}
                                    disabled={updateRestaurantMutation.isPending}
                                    placeholder="restaurant"
                                    className="h-8 text-sm"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField
                          control={generalForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Restaurant Email</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  {...field}
                                  disabled={updateRestaurantMutation.isPending}
                                  placeholder="contact@restaurant.com"
                                  className="h-8 text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={generalForm.control}
                          name="menu_url"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Online Menu URL</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={updateRestaurantMutation.isPending}
                                  placeholder="https://menu.restaurant.com"
                                  className="h-8 text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button type="submit" size="sm" disabled={updateRestaurantMutation.isPending}>
                          <Save className="mr-1.5 h-3.5 w-3.5" />
                          {updateRestaurantMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {/* Location Section - Merged into Profile */}
              <Card>
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    Location
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Set your restaurant's precise location for directions
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <LocationManager restaurantId={restaurantId} currentAddress={restaurant?.address} />
                </CardContent>
              </Card>
              
            </TabsContent>

            <TabsContent value="bookings" className="space-y-3 mt-3">
              <Card>
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-sm">Booking Rules</CardTitle>
                  <CardDescription className="text-xs">
                    Configure how bookings are handled at your restaurant
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <Form {...operationalForm}>
                    <form onSubmit={operationalForm.handleSubmit(handleOperationalSubmit)} className="space-y-3">
                  
                      <FormField
                        control={operationalForm.control}
                        name="booking_policy"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs flex items-center gap-2">
                              Booking Policy
                              {tier === 'basic' && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  Basic - Request Only
                                </Badge>
                              )}
                            </FormLabel>
                            {tier === 'basic' ? (
                              <div className="p-2 bg-muted rounded-md">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="text-xs font-medium">Request Only</div>
                                  <Badge variant="default" className="text-[10px] px-1 py-0">Active</Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Basic tier uses request-based booking. Upgrade to Pro for instant bookings.
                                </div>
                              </div>
                            ) : (
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={updateRestaurantMutation.isPending}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="instant">
                                    <div>
                                      <div className="text-xs font-medium">Instant Confirmation</div>
                                      <div className="text-xs text-muted-foreground">
                                        Bookings are automatically confirmed
                                      </div>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="request">
                                    <div>
                                      <div className="text-xs font-medium">Request Based</div>
                                      <div className="text-xs text-muted-foreground">
                                        You manually approve each booking
                                      </div>
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={operationalForm.control}
                        name="show_dining_duration"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 mb-3">
                            <div className="space-y-0.5">
                              <FormLabel className="text-xs">Show Dining Duration</FormLabel>
                              <FormDescription className="text-xs">
                                Display the dining duration on the booking
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={updateRestaurantMutation.isPending}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField
                          control={operationalForm.control}
                          name="booking_window_days"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Booking Window</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  disabled={updateRestaurantMutation.isPending}
                                  className="h-8 text-sm"
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Days in advance
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={operationalForm.control}
                          name="cancellation_window_hours"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Cancellation Window</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  disabled={updateRestaurantMutation.isPending}
                                  className="h-8 text-sm"
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Hours before booking
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField
                          control={operationalForm.control}
                          name="table_turnover_minutes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Table Turnover</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  disabled={updateRestaurantMutation.isPending}
                                  className="h-8 text-sm"
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Minutes per booking
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={operationalForm.control}
                          name="minimum_age"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Minimum Age</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="No minimum (leave empty)"
                                  value={field.value ?? ""}
                                  onChange={(e) => {
                                    const value = e.target.value.trim()
                                    if (value === "") {
                                      field.onChange(null)
                                    } else {
                                      const numValue = parseInt(value)
                                      field.onChange(isNaN(numValue) ? null : numValue)
                                    }
                                  }}
                                  disabled={updateRestaurantMutation.isPending}
                                  className="h-8 text-sm"
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Leave empty for no age restriction
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField
                          control={operationalForm.control}
                          name="min_party_size"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Minimum Party Size</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  max={500}
                                  value={field.value ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    field.onChange(v === "" ? 1 : Math.max(1, parseInt(v) || 1))
                                  }}
                                  disabled={updateRestaurantMutation.isPending}
                                  className="h-8 text-sm"
                                  placeholder="e.g. 1"
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Smallest party accepted
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={operationalForm.control}
                          name="max_party_size"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Maximum Party Size</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  max={500}
                                  value={field.value ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    field.onChange(v === "" ? 1 : Math.max(1, parseInt(v) || 1))
                                  }}
                                  disabled={updateRestaurantMutation.isPending}
                                  className="h-8 text-sm"
                                  placeholder="e.g. 12"
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Largest party accepted
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField
                          control={operationalForm.control}
                          name="request_expiry_hours"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Request Expiry (hours)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  max={168}
                                  value={field.value ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    field.onChange(v === "" ? 1 : Math.max(1, parseInt(v) || 1))
                                  }}
                                  disabled={updateRestaurantMutation.isPending}
                                  className="h-8 text-sm"
                                  placeholder="e.g. 24"
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                How long booking requests stay valid
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={operationalForm.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Restaurant Status</FormLabel>
                              <Select
                                value={field.value || "active"}
                                onValueChange={field.onChange}
                                disabled={updateRestaurantMutation.isPending}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="inactive">Inactive</SelectItem>
                                  <SelectItem value="suspended">Suspended</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription className="text-xs">
                                Current operational status
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={operationalForm.control}
                        name="auto_decline_enabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                              <FormLabel className="text-xs">Auto-decline Requests</FormLabel>
                              <FormDescription className="text-xs">
                                Automatically decline expired booking requests
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={updateRestaurantMutation.isPending}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end">
                        <Button type="submit" size="sm" disabled={updateRestaurantMutation.isPending}>
                          <Save className="mr-1.5 h-3.5 w-3.5" />
                          {updateRestaurantMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="amenities" className="space-y-3 mt-3">
              <Card>
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-sm">Cuisine & Facilities</CardTitle>
                  <CardDescription className="text-xs">
                    Restaurant type, dietary options, and amenities
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <Form {...pricingForm}>
                    <form onSubmit={pricingForm.handleSubmit(handlePricingSubmit)} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField
                          control={pricingForm.control}
                          name="cuisine_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Cuisine Type</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={updateRestaurantMutation.isPending}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="Select cuisine" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {CUISINE_TYPES.map((cuisine) => (
                                    <SelectItem key={cuisine} value={cuisine} className="text-xs">
                                      {cuisine}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={pricingForm.control}
                          name="price_range"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Price Range</FormLabel>
                              <Select
                                value={field.value.toString()}
                                onValueChange={(value) => field.onChange(parseInt(value))}
                                disabled={updateRestaurantMutation.isPending}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="1" className="text-xs">$ - Budget Friendly</SelectItem>
                                  <SelectItem value="2" className="text-xs">$$ - Moderate</SelectItem>
                                  <SelectItem value="3" className="text-xs">$$$ - Upscale</SelectItem>
                                  <SelectItem value="4" className="text-xs">$$$$ - Fine Dining</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={pricingForm.control}
                        name="secondary_cuisines"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Secondary Cuisines</FormLabel>
                            <FormDescription className="text-xs">
                              Select additional cuisine types (optional)
                            </FormDescription>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {CUISINE_TYPES.filter(cuisine => cuisine !== pricingForm.getValues('cuisine_type')).map((cuisine) => (
                                <Badge
                                  key={cuisine}
                                  variant={(field.value || []).includes(cuisine) ? "default" : "outline"}
                                  className="cursor-pointer text-xs px-2 py-0.5"
                                  onClick={() => {
                                    if (!updateRestaurantMutation.isPending) {
                                      const current = field.value || []
                                      if (current.includes(cuisine)) {
                                        field.onChange(current.filter((c) => c !== cuisine))
                                      } else {
                                        field.onChange([...current, cuisine])
                                      }
                                    }
                                  }}
                                >
                                  {cuisine}
                                </Badge>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                  
                      <FormField
                        control={pricingForm.control}
                        name="dietary_options"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Dietary Options</FormLabel>
                            <FormDescription className="text-xs">
                              Select all dietary options your restaurant accommodates
                            </FormDescription>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {DIETARY_OPTIONS.map((option) => (
                                <Badge
                                  key={option}
                                  variant={field.value.includes(option) ? "default" : "outline"}
                                  className="cursor-pointer capitalize text-xs px-2 py-0.5"
                                  onClick={() => {
                                    if (field.value.includes(option)) {
                                      field.onChange(field.value.filter((o) => o !== option))
                                    } else {
                                      field.onChange([...field.value, option])
                                    }
                                  }}
                                >
                                  {option}
                                </Badge>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={pricingForm.control}
                        name="ambiance_tags"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Ambiance Tags</FormLabel>
                            <FormDescription className="text-xs">
                              Tags that describe your restaurant&apos;s atmosphere
                            </FormDescription>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {AMBIANCE_TAGS.map((tag) => (
                                <Badge
                                  key={tag}
                                  variant={field.value.includes(tag) ? "default" : "outline"}
                                  className="cursor-pointer capitalize text-xs px-2 py-0.5"
                                  onClick={() => {
                                    if (field.value.includes(tag)) {
                                      field.onChange(field.value.filter((t) => t !== tag))
                                    } else {
                                      field.onChange([...field.value, tag])
                                    }
                                  }}
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Separator />
                      
                      <div className="space-y-3">
                        <FormField
                          control={pricingForm.control}
                          name="parking_available"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                              <div className="space-y-0.5">
                                <FormLabel className="text-xs">Parking Available</FormLabel>
                                <FormDescription className="text-xs">
                                  On-site parking for customers
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={updateRestaurantMutation.isPending}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={pricingForm.control}
                          name="valet_parking"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                              <div className="space-y-0.5">
                                <FormLabel className="text-xs">Valet Parking</FormLabel>
                                <FormDescription className="text-xs">
                                  Valet parking service available
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={updateRestaurantMutation.isPending}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={pricingForm.control}
                          name="outdoor_seating"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                              <div className="space-y-0.5">
                                <FormLabel className="text-xs">Outdoor Seating</FormLabel>
                                <FormDescription className="text-xs">
                                  Patio or terrace seating available
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={updateRestaurantMutation.isPending}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={pricingForm.control}
                          name="shisha_available"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                              <div className="space-y-0.5">
                                <FormLabel className="text-xs">Shisha Available</FormLabel>
                                <FormDescription className="text-xs">
                                  Hookah/shisha service offered
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={updateRestaurantMutation.isPending}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="flex justify-end">
                        <Button type="submit" size="sm" disabled={updateRestaurantMutation.isPending}>
                          <Save className="mr-1.5 h-3.5 w-3.5" />
                          {updateRestaurantMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="share" className="space-y-3 mt-3">
              {/* Shareable Links Card */}
              <Card>
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Link2 className="h-3.5 w-3.5" />
                    Shareable Links
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Share your menu and booking widget with customers
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-3">
                  {/* Menu Link */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium leading-none">
                      Menu Link
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Share this link to display your restaurant menu
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={restaurantId ? `https://plate-app.com/menu/${restaurantId}` : ''}
                        className="font-mono text-xs h-8"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => copyToClipboard(`https://plate-app.com/menu/${restaurantId}`, 'menu')}
                        disabled={!restaurantId}
                      >
                        {copiedLink === 'menu' ? (
                          <>
                            <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 mr-1.5" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Widget Link */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium leading-none">
                      Booking Widget Link
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Share this link to allow customers to make bookings directly
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={restaurantId ? `https://plate-app.com/widget/${restaurantId}` : ''}
                        className="font-mono text-xs h-8"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => copyToClipboard(`https://plate-app.com/widget/${restaurantId}`, 'widget')}
                        disabled={!restaurantId}
                      >
                        {copiedLink === 'widget' ? (
                          <>
                            <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 mr-1.5" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* PWA Install Prompt */}
              <InstallPrompt variant="card" />
              
              {/* Push Notifications */}
              <PushNotificationManager />
              
              {/* PWA Status Card */}
              <Card>
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Smartphone className="h-3.5 w-3.5" />
                    App Installation
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Install the app on your device for the best experience
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-xs font-medium">✅ Offline Support</div>
                      <div className="text-xs text-muted-foreground">
                        Works without internet connection
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-medium">✅ Push Notifications</div>
                      <div className="text-xs text-muted-foreground">
                        Real-time booking alerts
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-medium">✅ Home Screen</div>
                      <div className="text-xs text-muted-foreground">
                        Quick access from your device
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-medium">✅ Fast & Smooth</div>
                      <div className="text-xs text-muted-foreground">
                        Native app-like performance
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
