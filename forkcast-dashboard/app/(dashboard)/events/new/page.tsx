"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { useCreateEvent } from "@/lib/hooks/use-events"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, PartyPopper, Upload, X, Image as ImageIcon, FileText } from "lucide-react"
import { EVENT_TYPES, type CreateEventInput } from "@/types/events"
import { toast } from "sonner"
import { uploadEventImage, uploadEventMenuPdf, validateImageFile } from "@/lib/utils/event-image-upload"
import Image from "next/image"

export default function NewEventPage() {
  const router = useRouter()
  const { currentRestaurant } = useRestaurantContext()
  const createEventMutation = useCreateEvent()

  const [formData, setFormData] = useState<CreateEventInput & { price_per_person: number; special_menu_url: string | null }>({
    restaurant_id: currentRestaurant?.restaurant.id || "",
    title: "",
    description: "",
    event_type: "",
    image_url: "",
    minimum_age: null,
    minimum_party_size: 1,
    maximum_party_size: null,
    special_requirements: "",
    terms_and_conditions: [],
    price_per_person: 0,
    requires_in_app_payment: false,
    special_menu_url: null,
  })

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  // PDF menu file state
  const [menuPdfFile, setMenuPdfFile] = useState<File | null>(null)
  const [isUploadingPdf, setIsUploadingPdf] = useState(false)

  // PDF menu handlers
  const handleMenuPdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast.error("Please select a PDF file")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("PDF file must be less than 10MB")
      return
    }

    setMenuPdfFile(file)
  }

  const handleRemoveMenuPdf = () => {
    setMenuPdfFile(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title) {
      toast.error("Please enter an event title")
      return
    }

    if (!currentRestaurant) {
      toast.error("Restaurant not found")
      return
    }

    try {
      let finalImageUrl = formData.image_url
      let finalMenuPdfUrl = formData.special_menu_url

      // Upload image if a file is selected
      if (imageFile) {
        setIsUploadingImage(true)
        const uploadResult = await uploadEventImage(
          imageFile,
          currentRestaurant.restaurant.id
        )
        setIsUploadingImage(false)

        if (!uploadResult.success) {
          toast.error(uploadResult.error || "Failed to upload image")
          return
        }

        finalImageUrl = uploadResult.url || ""
      }

      // Upload PDF menu if a file is selected
      if (menuPdfFile) {
        setIsUploadingPdf(true)
        const pdfUploadResult = await uploadEventMenuPdf(
          menuPdfFile,
          currentRestaurant.restaurant.id
        )
        setIsUploadingPdf(false)

        if (!pdfUploadResult.success) {
          toast.error(pdfUploadResult.error || "Failed to upload menu PDF")
          return
        }

        finalMenuPdfUrl = pdfUploadResult.url || null
      }

      const event = await createEventMutation.mutateAsync({
        ...formData,
        restaurant_id: currentRestaurant.restaurant.id,
        image_url: finalImageUrl,
        special_menu_url: finalMenuPdfUrl,
        event_type: formData.event_type || null,
      })

      toast.success("Event created successfully!")
      
      // Clear all form fields
      setFormData({
        restaurant_id: currentRestaurant.restaurant.id,
        title: "",
        description: "",
        event_type: "",
        image_url: "",
        minimum_age: null,
        minimum_party_size: 1,
        maximum_party_size: null,
        special_requirements: "",
        terms_and_conditions: [],
        price_per_person: 0,
        requires_in_app_payment: false,
        special_menu_url: null,
      })
      setImageFile(null)
      setImagePreview(null)
      setMenuPdfFile(null)
      
      router.push(`/events/${event.id}`)
    } catch (error) {
      console.error("Error creating event:", error)
      setIsUploadingImage(false)
    }
  }

  const updateField = (field: keyof CreateEventInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateImageFile(file)
    if (!validation.valid) {
      toast.error(validation.error || "Invalid file")
      return
    }

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }
  }

  return (
    <div className="space-y-4 px-2 sm:px-4 pb-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-2 sm:-mx-4 px-2 sm:px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-primary shrink-0" />
              <span className="truncate">Create New Event</span>
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              Set up a new event for your restaurant
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Basic Information</CardTitle>
            <CardDescription className="text-xs">
              Provide the essential details about your event
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="title" className="text-sm">Event Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="e.g., Sunday Brunch, Live Jazz Night"
                required
                className="mt-1 h-9"
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-sm">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Describe your event..."
                rows={3}
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="event_type" className="text-sm">Event Type</Label>
              <Select
                value={formData.event_type || ""}
                onValueChange={(value) => updateField('event_type', value)}
              >
                <SelectTrigger id="event_type" className="mt-1 h-9">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Image Upload */}
            <div>
              <Label className="text-sm">Event Image</Label>
              <div className="mt-1">
                {imagePreview ? (
                  <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden border bg-muted">
                    <Image
                      src={imagePreview}
                      alt="Event preview"
                      fill
                      className="object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={handleRemoveImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                    <input
                      type="file"
                      id="event-image"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <label htmlFor="event-image" className="cursor-pointer">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="p-2 rounded-full bg-muted">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Click to upload image</p>
                          <p className="text-xs text-muted-foreground">
                            JPEG, PNG or WebP (Max 5MB)
                          </p>
                        </div>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Constraints */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Requirements & Constraints</CardTitle>
            <CardDescription className="text-xs">
              Set age and party size requirements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="minimum_age" className="text-xs">Min Age</Label>
                <Input
                  id="minimum_age"
                  type="number"
                  min="13"
                  max="25"
                  value={formData.minimum_age || ""}
                  onChange={(e) => updateField('minimum_age', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Any"
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="minimum_party_size" className="text-xs">Min Party</Label>
                <Input
                  id="minimum_party_size"
                  type="number"
                  min="1"
                  value={formData.minimum_party_size}
                  onChange={(e) => updateField('minimum_party_size', parseInt(e.target.value))}
                  className="mt-1 h-9 text-sm"
                  required
                />
              </div>

              <div>
                <Label htmlFor="maximum_party_size" className="text-xs">Max Party</Label>
                <Input
                  id="maximum_party_size"
                  type="number"
                  min="1"
                  value={formData.maximum_party_size || ""}
                  onChange={(e) => updateField('maximum_party_size', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Any"
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="special_requirements" className="text-sm">Special Requirements</Label>
              <Textarea
                id="special_requirements"
                value={formData.special_requirements}
                onChange={(e) => updateField('special_requirements', e.target.value)}
                placeholder="Any special requirements or notes..."
                rows={2}
                className="mt-1 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pricing & Payments</CardTitle>
            <CardDescription className="text-xs">
              Set price per person (0 for free event)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="price_per_person" className="text-sm">Price per Person ($)</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2 text-muted-foreground text-sm">$</span>
                <Input
                  id="price_per_person"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price_per_person || 0}
                  onChange={(e) => updateField('price_per_person', parseFloat(e.target.value) || 0)}
                  className="pl-7 h-9"
                />
              </div>
            </div>

            {/* In-App Payment Toggle */}
            {(formData.price_per_person || 0) > 0 && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="requires_in_app_payment" className="text-sm font-medium">
                    In-App Payment
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {formData.requires_in_app_payment
                      ? "Guests pay online when booking"
                      : "Guests pay at the restaurant"}
                  </p>
                </div>
                <Switch
                  id="requires_in_app_payment"
                  checked={formData.requires_in_app_payment ?? true}
                  onCheckedChange={(checked) => updateField('requires_in_app_payment', checked)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Special Menu (PDF Upload) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Special Menu (PDF)
            </CardTitle>
            <CardDescription className="text-xs">
              Upload a PDF menu for this event
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {menuPdfFile ? (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100">
                    <FileText className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{menuPdfFile.name}</p>
                    <p className="text-xs text-muted-foreground">New file selected</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={handleRemoveMenuPdf}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  id="menu-pdf"
                  accept="application/pdf"
                  onChange={handleMenuPdfSelect}
                  className="hidden"
                />
                <label htmlFor="menu-pdf" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="p-2 rounded-full bg-muted">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Click to upload menu PDF</p>
                      <p className="text-xs text-muted-foreground">
                        PDF format (Max 10MB)
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions - Sticky bottom */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-2 sm:-mx-4 px-2 sm:px-4 py-3 border-t flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={createEventMutation.isPending || isUploadingImage}
            className="flex-1 h-10"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createEventMutation.isPending || isUploadingImage}
            className="flex-1 h-10"
          >
            {isUploadingImage
              ? "Uploading..."
              : createEventMutation.isPending
              ? "Creating..."
              : "Create Event"}
          </Button>
        </div>
      </form>
    </div>
  )
}