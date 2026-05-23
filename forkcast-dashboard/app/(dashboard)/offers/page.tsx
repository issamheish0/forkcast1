// app/(dashboard)/offers/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "react-hot-toast"
import { Plus, Gift, Calendar as CalendarIcon, Users, Percent, Clock, Edit, Trash2, Tag } from "lucide-react"
import { format, addDays, isAfter, isBefore, isWithinInterval } from "date-fns"
import { cn } from "@/lib/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import type { SpecialOffer } from "@/types"

const offerFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  discountPercentage: z.number().min(5).max(100),
  validFrom: z.date(),
  validUntil: z.date(),
  minimumPartySize: z.number().min(1).max(20),
  applicableDays: z.array(z.number()).min(1, "Select at least one day"),
  termsConditions: z.string().optional(),
})

type OfferFormData = z.infer<typeof offerFormSchema>

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
]

export default function OffersPage() {
  const [selectedOffer, setSelectedOffer] = useState<SpecialOffer | null>(null)
  const [isAddingOffer, setIsAddingOffer] = useState(false)
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "upcoming" | "expired">("all")
  
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { currentRestaurant } = useRestaurantContext()

  // Get restaurant ID
  const [restaurantId, setRestaurantId] = useState<string>("")
  
  // Set restaurant ID from current restaurant context
  useEffect(() => {
    if (currentRestaurant) {
      setRestaurantId(currentRestaurant.restaurant.id)
    } else {
      setRestaurantId("")
    }
  }, [currentRestaurant])

  // Fetch offers
  const { data: offers, isLoading } = useQuery({
    queryKey: ["special-offers", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("special_offers")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })

      if (error) throw error
      return data as SpecialOffer[]
    },
    enabled: !!restaurantId,
  })

  // Form setup
  const form = useForm<OfferFormData>({
    resolver: zodResolver(offerFormSchema),
    defaultValues: {
      title: "",
      description: "",
      discountPercentage: 10,
      validFrom: new Date(),
      validUntil: addDays(new Date(), 30),
      minimumPartySize: 1,
      applicableDays: [0, 1, 2, 3, 4, 5, 6],
      termsConditions: "",
    },
  })

  // Create/Update offer mutation
  const offerMutation = useMutation({
    mutationFn: async (data: OfferFormData) => {
      const offerData = {
        restaurant_id: restaurantId,
        title: data.title,
        description: data.description,
        discount_percentage: data.discountPercentage,
        valid_from: data.validFrom.toISOString(),
        valid_until: data.validUntil.toISOString(),
        minimum_party_size: data.minimumPartySize,
        applicable_days: data.applicableDays,
        terms_conditions: data.termsConditions ? [data.termsConditions] : [],
      }

      if (selectedOffer) {
        // Update existing offer
        const { error } = await supabase
          .from("special_offers")
          .update(offerData)
          .eq("id", selectedOffer.id)

        if (error) throw error
      } else {
        // Create new offer
        const { error } = await supabase
          .from("special_offers")
          .insert(offerData)

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-offers"] })
      toast.success(selectedOffer ? "Offer updated" : "Offer created")
      setSelectedOffer(null)
      setIsAddingOffer(false)
      resetFormToDefaults()
    },
    onError: () => {
      toast.error("Failed to save offer")
    },
  })

  // Delete offer mutation
  const deleteOfferMutation = useMutation({
    mutationFn: async (offerId: string) => {
      const { error } = await supabase
        .from("special_offers")
        .delete()
        .eq("id", offerId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-offers"] })
      toast.success("Offer deleted")
    },
    onError: () => {
      toast.error("Failed to delete offer")
    },
  })

  // Filter offers based on status
  const filteredOffers = offers?.filter((offer) => {
    const now = new Date()
    const validFrom = new Date(offer.valid_from)
    const validUntil = new Date(offer.valid_until)
    
    switch (filterStatus) {
      case "active":
        return isWithinInterval(now, { start: validFrom, end: validUntil })
      case "upcoming":
        return isAfter(validFrom, now)
      case "expired":
        return isBefore(validUntil, now)
      default:
        return true
    }
  })

  // Get offer statistics
  const getOfferStats = () => {
    if (!offers) return { total: 0, active: 0, upcoming: 0, expired: 0 }
    
    const now = new Date()
    const stats = {
      total: offers.length,
      active: 0,
      upcoming: 0,
      expired: 0,
    }

    offers.forEach(offer => {
      const validFrom = new Date(offer.valid_from)
      const validUntil = new Date(offer.valid_until)
      
      if (isWithinInterval(now, { start: validFrom, end: validUntil })) {
        stats.active++
      } else if (isAfter(validFrom, now)) {
        stats.upcoming++
      } else if (isBefore(validUntil, now)) {
        stats.expired++
      }
    })

    return stats
  }

  const stats = getOfferStats()

  // Reset form to default values
  const resetFormToDefaults = () => {
    form.reset({
      title: "",
      description: "",
      discountPercentage: 10,
      validFrom: new Date(),
      validUntil: addDays(new Date(), 30),
      minimumPartySize: 1,
      applicableDays: [0, 1, 2, 3, 4, 5, 6],
      termsConditions: "",
    })
  }

  // Get offer status
  const getOfferStatus = (offer: SpecialOffer) => {
    const now = new Date()
    const validFrom = new Date(offer.valid_from)
    const validUntil = new Date(offer.valid_until)
    
    if (isWithinInterval(now, { start: validFrom, end: validUntil })) {
      return { label: "Active", variant: "default" as const }
    } else if (isAfter(validFrom, now)) {
      return { label: "Upcoming", variant: "secondary" as const }
    } else {
      return { label: "Expired", variant: "outline" as const }
    }
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Compact Header Bar */}
      <div className="flex-shrink-0 px-3 py-2 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-amber-500 flex items-center justify-center">
              <Gift className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Offers</h1>
              <p className="text-xs text-muted-foreground">{stats.total} offers • Discounts & promotions</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Dialog open={isAddingOffer || !!selectedOffer} onOpenChange={(open) => {
              if (!open) {
                setIsAddingOffer(false)
                setSelectedOffer(null)
                resetFormToDefaults()
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 px-3 text-xs" onClick={() => {
                  setIsAddingOffer(true)
                  resetFormToDefaults()
                }}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Create Offer
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>
                  {selectedOffer ? "Edit Offer" : "Create New Offer"}
                </DialogTitle>
                <DialogDescription>
                  Set up a special discount or promotion for your customers
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => offerMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Offer Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Weekend Special - 20% Off"
                            {...field}
                            disabled={offerMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enjoy a special discount on weekend dining..."
                            {...field}
                            disabled={offerMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="discountPercentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount Percentage</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="20"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              disabled={offerMutation.isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="minimumPartySize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minimum Party Size</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="2"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              disabled={offerMutation.isPending}
                            />
                          </FormControl>
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
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                  disabled={offerMutation.isPending}
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
                          <FormLabel>Valid Until</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                  disabled={offerMutation.isPending}
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
                  
                  <FormField
                    control={form.control}
                    name="applicableDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Applicable Days</FormLabel>
                        <FormDescription>
                          Select which days of the week this offer is valid
                        </FormDescription>
                        <div className="grid grid-cols-7 gap-2">
                          {DAYS_OF_WEEK.map((day) => (
                            <div key={day.value} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`day-${day.value}`}
                                checked={field.value.includes(day.value)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    field.onChange([...field.value, day.value])
                                  } else {
                                    field.onChange(field.value.filter(d => d !== day.value))
                                  }
                                }}
                                className="h-4 w-4"
                                disabled={offerMutation.isPending}
                              />
                              <label
                                htmlFor={`day-${day.value}`}
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
                  
                  <FormField
                    control={form.control}
                    name="termsConditions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Terms & Conditions (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Not valid with other offers. Subject to availability..."
                            {...field}
                            disabled={offerMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsAddingOffer(false)
                        setSelectedOffer(null)
                        resetFormToDefaults()
                      }}
                      disabled={offerMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={offerMutation.isPending}>
                      {offerMutation.isPending 
                        ? "Saving..." 
                        : selectedOffer 
                          ? "Update Offer" 
                          : "Create Offer"
                      }
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
     </div>

      {/* Quick Stats Row */}
      <div className="flex-shrink-0 px-3 py-2 border-b">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs transition-colors hover:bg-amber-500/20">
            <Gift className="h-3.5 w-3.5 text-amber-600" />
            <span className="font-semibold text-amber-700">{stats.total}</span>
            <span className="text-amber-600/80">Total</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-xs transition-colors hover:bg-green-500/20">
             <Clock className="h-3.5 w-3.5 text-green-600" />
             <span className="font-semibold text-green-700">{stats.active}</span>
             <span className="text-green-600/80">Active</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs transition-colors hover:bg-blue-500/20">
             <CalendarIcon className="h-3.5 w-3.5 text-blue-600" />
             <span className="font-semibold text-blue-700">{stats.upcoming}</span>
             <span className="text-blue-600/80">Upcoming</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border text-xs">
            <Percent className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground">
              {offers && offers.length > 0
                ? Math.round(
                    offers.reduce((sum, o) => sum + o.discount_percentage, 0) / offers.length
                  )
                : 0}%
            </span>
            <span className="text-muted-foreground">Avg Discount</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Sticky Header with Filters */}
        <div className="flex-shrink-0 border-b bg-background z-10 sticky top-0">
          <div className="px-4 py-3">
             {/* Filter Tabs */}
             <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Status:</span>
                <div className="flex p-1 bg-muted/50 rounded-lg">
                   {(["all", "active", "upcoming", "expired"] as const).map((status) => (
                     <button
                       key={status}
                       onClick={() => setFilterStatus(status)}
                       className={cn(
                         "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 capitalize",
                         filterStatus === status
                           ? "bg-background text-foreground shadow-sm"
                           : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                       )}
                     >
                       {status}
                     </button>
                   ))}
                </div>
             </div>
          </div>
        </div>

        {/* Offers Grid - Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted/5">
          {isLoading ? (
             <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
               {Array.from({ length: 6 }).map((_, i) => (
                 <Card key={i} className="overflow-hidden border-border/40">
                    <div className="h-32 bg-muted motion-safe:animate-pulse" />
                    <CardContent className="p-4 space-y-3">
                        <div className="h-4 w-3/4 bg-muted rounded motion-safe:animate-pulse" />
                        <div className="h-3 w-1/2 bg-muted rounded motion-safe:animate-pulse" />
                        <div className="flex gap-2 mt-4">
                           <div className="h-6 w-16 bg-muted rounded motion-safe:animate-pulse" />
                           <div className="h-6 w-16 bg-muted rounded motion-safe:animate-pulse" />
                        </div>
                    </CardContent>
                 </Card>
               ))}
            </div>
          ) : filteredOffers?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Tag className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {filterStatus === "all" ? "No offers created" : `No ${filterStatus} offers`}
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                {filterStatus === "all" 
                  ? "Create special offers to attract more customers and boost sales during slow periods."
                  : `There are currently no offers marked as ${filterStatus}.`}
              </p>
              {filterStatus === "all" ? (
                <Button onClick={() => {
                    setIsAddingOffer(true)
                    resetFormToDefaults()
                }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Offer
                </Button>
              ) : (
                 <Button variant="outline" onClick={() => setFilterStatus("all")}>
                    View All Offers
                 </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-20">
              {filteredOffers?.map((offer) => {
                const status = getOfferStatus(offer)
                const applicableDays = DAYS_OF_WEEK.filter(d => 
                  offer.applicable_days?.includes(d.value)
                ).map(d => d.label.slice(0, 3))
                
                // Determine card border/accent color based on status
                const statusColor = 
                    status.label === "Active" ? "border-green-500/20 bg-green-500/5" :
                    status.label === "Upcoming" ? "border-blue-500/20 bg-blue-500/5" :
                    "border-border bg-card";

                return (
                  <Card key={offer.id} className={cn(
                      "group relative flex flex-col overflow-hidden transition-all duration-300 hover:shadow-md border-border/60 hover:border-border",
                      status.label === "Expired" && "opacity-75"
                  )}>
                    <div className={cn("absolute top-0 left-0 w-1 h-full", 
                        status.label === "Active" ? "bg-green-500" :
                        status.label === "Upcoming" ? "bg-blue-500" :
                        "bg-muted"
                    )} />
                    
                    <CardContent className="p-5 pl-7 flex-1 flex flex-col space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                           <div className="flex items-center gap-2">
                              <Badge variant={status.variant} className="text-[10px] px-1.5 h-5 font-normal">
                                {status.label}
                              </Badge>
                              {offer.discount_percentage >= 50 && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 h-5 font-normal motion-safe:animate-pulse">
                                    Hot Deal
                                </Badge>
                              )}
                           </div>
                          <h3 className="font-semibold text-base truncate pr-2 pt-1">{offer.title}</h3>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-xl font-bold text-amber-600 leading-none">
                                {offer.discount_percentage}%
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">OFF</span>
                        </div>
                      </div>
                      
                      {offer.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                          {offer.description}
                        </p>
                      )}
                      
                      <div className="pt-2 mt-auto border-t border-dashed space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5 shrink-0" />
                          <span>Min. {offer.minimum_party_size} guests</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {format(new Date(offer.valid_from), "MMM d")} - {format(new Date(offer.valid_until), "MMM d, yyyy")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{applicableDays.join(", ")}</span>
                        </div>
                      </div>

                      {offer.terms_conditions && offer.terms_conditions.length > 0 && (
                        <div className="bg-muted/30 p-2 rounded text-[10px] text-muted-foreground mt-2">
                             <p className="line-clamp-1 italic text-muted-foreground/80">"{offer.terms_conditions[0]}"</p>
                        </div>
                      )}
                      
                      <div className="flex gap-2 pt-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs flex-1 hover:bg-muted"
                          onClick={() => {
                            setSelectedOffer(offer)
                            form.reset({
                              title: offer.title,
                              description: offer.description || "",
                              discountPercentage: offer.discount_percentage,
                              validFrom: new Date(offer.valid_from),
                              validUntil: new Date(offer.valid_until),
                              minimumPartySize: offer.minimum_party_size,
                              applicableDays: offer.applicable_days || [],
                              termsConditions: offer.terms_conditions?.[0] || "",
                            })
                          }}
                        >
                          <Edit className="mr-1.5 h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs flex-1 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this offer?")) {
                              deleteOfferMutation.mutate(offer.id)
                            }
                          }}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

