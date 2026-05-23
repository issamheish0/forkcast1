"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useEvent, useUpdateEvent } from "@/lib/hooks/use-events"
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
import { ArrowLeft, PartyPopper, Loader2, Upload, X, FileText } from "lucide-react"
import { EVENT_TYPES, type UpdateEventInput } from "@/types/events"
import { toast } from "sonner"
import { uploadEventImage, uploadEventMenuPdf, validateImageFile } from "@/lib/utils/event-image-upload"
import Image from "next/image"
import { cn } from "@/lib/utils"

export default function EditEventPage() {
  const router = useRouter()
  const params = useParams()
  const eventId = params?.id as string

  const { data: event, isLoading } = useEvent(eventId)
  const updateEventMutation = useUpdateEvent()

  const [formData, setFormData] = useState<UpdateEventInput>({
    title: "",
    description: "",
    event_type: "",
    image_url: "",
    minimum_age: null,
    minimum_party_size: 1,
    maximum_party_size: null,
    special_requirements: "",
    price_per_person: 0,
    is_active: true,
    requires_in_app_payment: false,
    special_menu_url: null,
  })

  // PDF menu file state
  const [menuPdfFile, setMenuPdfFile] = useState<File | null>(null)
  const [isUploadingPdf, setIsUploadingPdf] = useState(false)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  // Populate form when event data loads
  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        description: event.description || "",
        event_type: event.event_type || "",
        image_url: event.image_url || "",
        minimum_age: event.minimum_age,
        minimum_party_size: event.minimum_party_size,
        maximum_party_size: event.maximum_party_size,
        special_requirements: event.special_requirements || "",
        price_per_person: event.price_per_person || 0,
        is_active: event.is_active,
        requires_in_app_payment: (event.price_per_person || 0) > 0 ? (event.requires_in_app_payment ?? true) : false,
        special_menu_url: event.special_menu_url || null,
      })
      if (event.image_url) {
        setImagePreview(event.image_url)
      }
    }
  }, [event])

  // PDF menu handlers
  const handleMenuPdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast.error("Please select a PDF file")
      return
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error("PDF file must be less than 10MB")
      return
    }

    setMenuPdfFile(file)
  }

  const handleRemoveMenuPdf = () => {
    setMenuPdfFile(null)
    setFormData(prev => ({ ...prev, special_menu_url: null }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title?.trim()) {
      toast.error("Please enter an event title")
      return
    }

    if (!event) {
      toast.error("Event not found")
      return
    }

    try {
      let finalImageUrl = formData.image_url
      let finalMenuPdfUrl = formData.special_menu_url

      // Upload new image if a file is selected
      if (imageFile) {
        setIsUploadingImage(true)
        try {
          const uploadResult = await uploadEventImage(
            imageFile,
            event.restaurant_id,
            event.image_url // Pass old image URL to delete it
          )

          if (!uploadResult.success) {
            toast.error(uploadResult.error || "Failed to upload image")
            setIsUploadingImage(false)
            return
          }

          finalImageUrl = uploadResult.url || ""
        } catch (uploadError) {
          console.error("Image upload error:", uploadError)
          toast.error("Failed to upload image. Please try again.")
          setIsUploadingImage(false)
          return
        }
        setIsUploadingImage(false)
      }

      // Upload PDF menu if a file is selected
      if (menuPdfFile) {
        setIsUploadingPdf(true)
        try {
          const pdfUploadResult = await uploadEventMenuPdf(
            menuPdfFile,
            event.restaurant_id
          )

          if (!pdfUploadResult.success) {
            toast.error(pdfUploadResult.error || "Failed to upload menu PDF")
            setIsUploadingPdf(false)
            return
          }

          finalMenuPdfUrl = pdfUploadResult.url || null
        } catch (uploadError) {
          console.error("PDF upload error:", uploadError)
          toast.error("Failed to upload PDF. Please try again.")
          setIsUploadingPdf(false)
          return
        }
        setIsUploadingPdf(false)
      }

      // Prepare the update payload - only include fields that exist in the database
      const updatePayload: UpdateEventInput = {
        title: formData.title,
        description: formData.description,
        event_type: formData.event_type || null,
        image_url: finalImageUrl,
        minimum_age: formData.minimum_age,
        minimum_party_size: formData.minimum_party_size,
        maximum_party_size: formData.maximum_party_size,
        special_requirements: formData.special_requirements,
        price_per_person: formData.price_per_person,
        is_active: formData.is_active,
        requires_in_app_payment: formData.requires_in_app_payment,
        special_menu_url: finalMenuPdfUrl,
      }

      await updateEventMutation.mutateAsync({
        eventId,
        updates: updatePayload,
      })

      toast.success("Event updated successfully!")
      router.push(`/events/${eventId}`)
    } catch (error) {
      console.error("Error updating event:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update event")
      setIsUploadingImage(false)
      setIsUploadingPdf(false)
    }
  }

  const updateField = (field: keyof UpdateEventInput, value: any) => {
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
    // Create preview URL for the new file
    const previewUrl = URL.createObjectURL(file)
    // Clean up old preview if it was a blob URL
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview)
    }
    setImagePreview(previewUrl)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    // Clean up preview if it's a blob URL
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview)
    }
    setImagePreview(null)
    // Clear the image_url in form data
    setFormData(prev => ({ ...prev, image_url: "" }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 motion-safe:animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm">Loading event...</p>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-lg font-bold mb-1">Event Not Found</h2>
        <p className="text-sm text-muted-foreground mb-3">
          The event doesn't exist
        </p>
        <Button size="sm" onClick={() => router.push("/events")}>
          Back to Events
        </Button>
      </div>
    )
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
              <span className="truncate">Edit Event</span>
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              Update your event details
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Label htmlFor="is_active" className="text-xs">
              Active
            </Label>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => updateField('is_active', checked)}
            />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Basic Information</CardTitle>
            <CardDescription className="text-xs">
              Update the essential details about your event
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
                {imageFile && (
                  <p className="text-xs text-muted-foreground mt-1">
                    New: {imageFile.name}
                  </p>
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
                  onChange={(e) => updateField('minimum_party_size', parseInt(e.target.value) || 1)}
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
                  checked={formData.requires_in_app_payment ?? false}
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
            {/* Current PDF / Upload */}
            {formData.special_menu_url || menuPdfFile ? (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100">
                    <FileText className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {menuPdfFile ? menuPdfFile.name : 'Menu PDF'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {menuPdfFile ? 'New file selected' : 'Currently uploaded'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {formData.special_menu_url && !menuPdfFile && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(formData.special_menu_url!, '_blank')}
                    >
                      View
                    </Button>
                  )}
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

        {/* Event Statistics (Read-only) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Event Statistics</CardTitle>
            <CardDescription className="text-xs">
              Current event performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <div className="text-xl font-bold">
                  {event.occurrences?.length || 0}
                </div>
                <div className="text-xs text-muted-foreground">Occurrences</div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <div className="text-xl font-bold">
                  {event.occurrences?.filter(o => 
                    o.status === 'scheduled' || o.status === 'full'
                  ).length || 0}
                </div>
                <div className="text-xs text-muted-foreground">Upcoming</div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <div className="text-xl font-bold">
                  {event.occurrences?.reduce((acc, o) => acc + o.current_bookings, 0) || 0}
                </div>
                <div className="text-xs text-muted-foreground">Bookings</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions - Sticky bottom */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-2 sm:-mx-4 px-2 sm:px-4 py-3 border-t flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={updateEventMutation.isPending || isUploadingImage}
            className="flex-1 h-10"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={updateEventMutation.isPending || isUploadingImage}
            className="flex-1 h-10"
          >
            {isUploadingImage ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 motion-safe:animate-spin" />
                Uploading...
              </>
            ) : updateEventMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 motion-safe:animate-spin" />
                Updating...
              </>
            ) : (
              "Update Event"
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}