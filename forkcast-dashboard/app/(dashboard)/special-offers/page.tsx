// app/bookings/special-offers/page.tsx
"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { format, parseISO } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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
import { cn } from "@/lib/utils"
import {
  Gift,
  Plus,
  Edit,
  Trash2,
  CalendarIcon,
  AlertCircle,
  Loader2,
  Percent,
  Users,
  Calendar as CalendarDays,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { toast } from "react-hot-toast"

interface SpecialOffer {
  id: string
  restaurant_id: string
  title: string
  description: string | null
  discount_percentage: number | null
  valid_from: string
  valid_until: string
  terms_conditions: string[] | null
  minimum_party_size: number
  applicable_days: number[] | null
  img_url: string | null
  is_clickable: boolean
  created_at: string
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
]

export default function SpecialOffersPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { currentRestaurant } = useRestaurantContext()
  const restaurantId = currentRestaurant?.restaurant.id

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedOffer, setSelectedOffer] = useState<SpecialOffer | null>(null)

  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [discountPercentage, setDiscountPercentage] = useState<number | "">("")
  const [validFrom, setValidFrom] = useState<Date | undefined>(new Date())
  const [validUntil, setValidUntil] = useState<Date | undefined>()
  const [minimumPartySize, setMinimumPartySize] = useState(1)
  const [applicableDays, setApplicableDays] = useState<number[]>([])
  const [termsConditions, setTermsConditions] = useState("")
  const [isClickable, setIsClickable] = useState(true)

  // Fetch special offers
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

  // Reset form
  const resetForm = () => {
    setTitle("")
    setDescription("")
    setDiscountPercentage("")
    setValidFrom(new Date())
    setValidUntil(undefined)
    setMinimumPartySize(1)
    setApplicableDays([])
    setTermsConditions("")
    setIsClickable(true)
  }

  // Load offer into form for editing
  const loadOfferForEdit = (offer: SpecialOffer) => {
    setTitle(offer.title)
    setDescription(offer.description || "")
    setDiscountPercentage(offer.discount_percentage || "")
    setValidFrom(parseISO(offer.valid_from))
    setValidUntil(parseISO(offer.valid_until))
    setMinimumPartySize(offer.minimum_party_size)
    setApplicableDays(offer.applicable_days || [])
    setTermsConditions(offer.terms_conditions?.join("\n") || "")
    setIsClickable(offer.is_clickable)
    setSelectedOffer(offer)
    setIsEditDialogOpen(true)
  }

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("No restaurant selected")
      if (!title.trim()) throw new Error("Title is required")
      if (!validFrom) throw new Error("Start date is required")
      if (!validUntil) throw new Error("End date is required")

      const termsArray = termsConditions
        .split("\n")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      const { data, error } = await supabase
        .from("special_offers")
        .insert({
          restaurant_id: restaurantId,
          title: title.trim(),
          description: description.trim() || null,
          discount_percentage: discountPercentage || null,
          valid_from: validFrom.toISOString(),
          valid_until: validUntil.toISOString(),
          minimum_party_size: minimumPartySize,
          applicable_days: applicableDays.length > 0 ? applicableDays : null,
          terms_conditions: termsArray.length > 0 ? termsArray : null,
          is_clickable: isClickable,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-offers"] })
      toast.success("Special offer created successfully!")
      resetForm()
      setIsCreateDialogOpen(false)
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create special offer")
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOffer) throw new Error("No offer selected")
      if (!title.trim()) throw new Error("Title is required")
      if (!validFrom) throw new Error("Start date is required")
      if (!validUntil) throw new Error("End date is required")

      const termsArray = termsConditions
        .split("\n")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      const { data, error } = await supabase
        .from("special_offers")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          discount_percentage: discountPercentage || null,
          valid_from: validFrom.toISOString(),
          valid_until: validUntil.toISOString(),
          minimum_party_size: minimumPartySize,
          applicable_days: applicableDays.length > 0 ? applicableDays : null,
          terms_conditions: termsArray.length > 0 ? termsArray : null,
          is_clickable: isClickable,
        })
        .eq("id", selectedOffer.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-offers"] })
      toast.success("Special offer updated successfully!")
      resetForm()
      setIsEditDialogOpen(false)
      setSelectedOffer(null)
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update special offer")
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (offerId: string) => {
      const { error } = await supabase
        .from("special_offers")
        .delete()
        .eq("id", offerId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-offers"] })
      toast.success("Special offer deleted successfully!")
      setIsDeleteDialogOpen(false)
      setSelectedOffer(null)
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete special offer")
    },
  })

  const toggleDaySelection = (day: number) => {
    setApplicableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  const isOfferActive = (offer: SpecialOffer) => {
    const now = new Date()
    const from = parseISO(offer.valid_from)
    const until = parseISO(offer.valid_until)
    return now >= from && now <= until
  }

  if (!restaurantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading restaurant data...</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Compact Header Bar */}
      <div className="flex-shrink-0 px-3 py-2 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-green-500 flex items-center justify-center">
              <Gift className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Special Offers</h1>
              <p className="text-xs text-muted-foreground">Create and manage special offers for your customers</p>
            </div>
          </div>
          <Button
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => {
              resetForm()
              setIsCreateDialogOpen(true)
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Create Offer
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">

      {/* Offers Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : offers && offers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((offer) => {
            const active = isOfferActive(offer)
            return (
              <Card
                key={offer.id}
                className={cn(
                  "relative overflow-hidden transition-all hover:shadow-lg",
                  active
                    ? "border-green-300 bg-green-50/50"
                    : "border-gray-200 bg-gray-50/30"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Gift className="h-5 w-5 text-green-600" />
                        {offer.title}
                      </CardTitle>
                      {offer.discount_percentage && (
                        <Badge
                          variant="secondary"
                          className="mt-2 bg-green-600 text-white font-bold"
                        >
                          <Percent className="h-3 w-3 mr-1" />
                          {offer.discount_percentage}% OFF
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {active ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                  {offer.description && (
                    <CardDescription className="mt-2 line-clamp-2">
                      {offer.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm"><CalendarIcon className="h-4 w-4" />
                      <span>
                        {format(parseISO(offer.valid_from), "MMM d, yyyy")} -{" "}
                        {format(parseISO(offer.valid_until), "MMM d, yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm"><Users className="h-4 w-4" />
                      <span>Min. party size: {offer.minimum_party_size}</span>
                    </div>
                    {offer.applicable_days && offer.applicable_days.length > 0 && (
                      <div className="flex items-start gap-2 text-muted-foreground text-sm"><CalendarDays className="h-4 w-4 mt-0.5" />
                        <div className="flex flex-wrap gap-1">
                          {offer.applicable_days.map((day) => (
                            <Badge key={day} variant="outline" className="text-xs">
                              {DAYS_OF_WEEK[day].label.slice(0, 3)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadOfferForEdit(offer)}
                      className="flex-1"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setSelectedOffer(offer)
                        setIsDeleteDialogOpen(true)
                      }}
                      className="flex-1"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Gift className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No special offers yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first special offer to attract more customers
            </p>
            <Button
              onClick={() => {
                resetForm()
                setIsCreateDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Offer
            </Button>
          </CardContent>
        </Card>
      )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateDialogOpen || isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false)
            setIsEditDialogOpen(false)
            resetForm()
            setSelectedOffer(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditDialogOpen ? "Edit Special Offer" : "Create Special Offer"}
            </DialogTitle>
            <DialogDescription>
              {isEditDialogOpen
                ? "Update the details of your special offer"
                : "Create a new special offer for your customers"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Title */}
            <div>
              <Label htmlFor="title">
                Offer Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g., Happy Hour Special"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your special offer..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Discount Percentage */}
            <div>
              <Label htmlFor="discount">Discount Percentage</Label>
              <div className="relative">
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g., 20"
                  value={discountPercentage}
                  onChange={(e) =>
                    setDiscountPercentage(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="pr-8"
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>
                  Valid From <span className="text-red-500">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !validFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {validFrom ? format(validFrom, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={validFrom}
                      onSelect={setValidFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>
                  Valid Until <span className="text-red-500">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !validUntil && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {validUntil ? format(validUntil, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={validUntil}
                      onSelect={setValidUntil}
                      initialFocus
                      disabled={(date) =>
                        validFrom ? date < validFrom : false
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Minimum Party Size */}
            <div>
              <Label htmlFor="partySize">Minimum Party Size</Label>
              <Input
                id="partySize"
                type="number"
                min="1"
                value={minimumPartySize}
                onChange={(e) => setMinimumPartySize(Number(e.target.value))}
              />
            </div>

            {/* Applicable Days */}
            <div>
              <Label>Applicable Days (leave empty for all days)</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Button
                    key={day.value}
                    type="button"
                    variant={
                      applicableDays.includes(day.value) ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => toggleDaySelection(day.value)}
                    className="text-xs"
                  >
                    {day.label.slice(0, 3)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Terms & Conditions */}
            <div>
              <Label htmlFor="terms">Terms & Conditions (one per line)</Label>
              <Textarea
                id="terms"
                placeholder="e.g., Not valid on holidays&#10;Cannot be combined with other offers"
                value={termsConditions}
                onChange={(e) => setTermsConditions(e.target.value)}
                rows={4}
              />
            </div>

      
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false)
                setIsEditDialogOpen(false)
                resetForm()
                setSelectedOffer(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                isEditDialogOpen
                  ? updateMutation.mutate()
                  : createMutation.mutate()
              }
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                !title.trim() ||
                !validFrom ||
                !validUntil
              }
              className="bg-green-600 hover:bg-green-700"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditDialogOpen ? "Updating..." : "Creating..."}
                </>
              ) : isEditDialogOpen ? (
                "Update Offer"
              ) : (
                "Create Offer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Special Offer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedOffer?.title}"? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setSelectedOffer(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                selectedOffer && deleteMutation.mutate(selectedOffer.id)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}