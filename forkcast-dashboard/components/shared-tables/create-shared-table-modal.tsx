// components/shared-tables/create-shared-table-modal.tsx
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { useCreateSharedTable } from "@/hooks/use-shared-tables"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Loader2, X } from "lucide-react"

const formSchema = z.object({
  tableNumber: z.string().min(1, "Table number is required"),
  capacity: z.number().min(2, "Shared tables must have at least 2 seats").max(20, "Maximum capacity is 20"),
  sectionId: z.string().optional(),
  shape: z.enum(["rectangle", "circle", "square"]),
  features: z.array(z.string()),
})

type FormData = z.infer<typeof formSchema>

interface CreateSharedTableModalProps {
  restaurantId: string
  isOpen: boolean
  onClose: () => void
}

const COMMON_FEATURES = [
  "High chairs available",
  "Wheelchair accessible", 
  "Near window",
  "Quiet area",
  "High-top",
  "Bar seating",
  "Booth style",
  "Outdoor",
  "Private dining",
  "Family friendly"
]

export function CreateSharedTableModal({ 
  restaurantId, 
  isOpen, 
  onClose 
}: CreateSharedTableModalProps) {
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const createSharedTable = useCreateSharedTable()
  const supabase = createClient()

  // Fetch restaurant sections
  const { data: sections } = useQuery({
    queryKey: ["restaurant-sections", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("restaurant_sections")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("display_order")

      if (error) throw error
      return data || []
    },
    enabled: !!restaurantId && isOpen,
  })

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tableNumber: "",
      capacity: 4,
      shape: "rectangle",
      features: [],
    },
  })

  const onSubmit = async (data: FormData) => {
    try {
      await createSharedTable.mutateAsync({
        restaurantId,
        tableNumber: data.tableNumber,
        capacity: data.capacity,
        sectionId: data.sectionId === "no-section" ? undefined : data.sectionId,
        features: selectedFeatures,
        shape: data.shape,
      })
      
      // Reset form and close modal
      form.reset()
      setSelectedFeatures([])
      onClose()
    } catch (error) {
      console.error("Error creating shared table:", error)
    }
  }

  const toggleFeature = (feature: string) => {
    setSelectedFeatures(prev => 
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    )
  }

  const removeFeature = (feature: string) => {
    setSelectedFeatures(prev => prev.filter(f => f !== feature))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Shared Table</DialogTitle>
          <DialogDescription>
            Create a new shared table where multiple parties can book seats together
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="tableNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Table Number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., S1, Shared-1, Community-1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Capacity (Seats)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="2"
                      max="20"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {sections && sections.length > 0 && (
              <FormField
                control={form.control}
                name="sectionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a section" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="no-section">No section</SelectItem>
                        {sections.map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="shape"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Table Shape</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="rectangle">Rectangle</SelectItem>
                      <SelectItem value="circle">Circle</SelectItem>
                      <SelectItem value="square">Square</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <FormLabel>Table Features</FormLabel>
              
              {selectedFeatures.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedFeatures.map((feature) => (
                    <Badge key={feature} variant="secondary" className="flex items-center gap-1">
                      {feature}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => removeFeature(feature)}
                      />
                    </Badge>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                {COMMON_FEATURES.filter(feature => !selectedFeatures.includes(feature)).map((feature) => (
                  <div key={feature} className="flex items-center space-x-2">
                    <Checkbox
                      id={feature}
                      checked={selectedFeatures.includes(feature)}
                      onCheckedChange={() => toggleFeature(feature)}
                    />
                    <label
                      htmlFor={feature}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {feature}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createSharedTable.isPending}>
                {createSharedTable.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 motion-safe:animate-spin" />
                )}
                Create Shared Table
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
