// app/(dashboard)/sections/page.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { 
  useRestaurantSections, 
  useCreateSection, 
  useUpdateSection, 
  useDeleteSection,
  useReorderSections,
  type RestaurantSection,
  type CreateSectionData 
} from "@/hooks/use-restaurant-sections"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { SectionClosuresManager } from "@/components/basic/section-closures-manager"
import { toast } from "react-hot-toast"
import { cn } from "@/lib/utils"
import { 
  Plus,
  Edit,
  Trash2,
  Grid,
  ArrowUp,
  ArrowDown,
  Palette,
  Ban,
  GripVertical,
  Users
} from "lucide-react"

interface SectionFormData {
  name: string
  description: string
  color: string
  icon: string
  is_active: boolean
  min_party_size: string
  max_party_size: string
}

const PRESET_COLORS = [
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#10b981", // Green
  "#f59e0b", // Yellow
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#84cc16", // Lime
  "#f97316", // Orange
  "#6b7280"  // Gray
]

const PRESET_ICONS = [
  { value: "grid", label: "Grid" },
  { value: "home", label: "Home" },
  { value: "users", label: "Family" },
  { value: "wine", label: "Bar" },
  { value: "coffee", label: "Cafe" },
  { value: "sun", label: "Outdoor" },
  { value: "shield", label: "VIP" },
  { value: "star", label: "Premium" }
]

export default function SectionsPage() {
  const router = useRouter()
  const { currentRestaurant } = useRestaurantContext()
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<RestaurantSection | null>(null)
  const [activeTab, setActiveTab] = useState("sections")
  const [draggedSection, setDraggedSection] = useState<RestaurantSection | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [formData, setFormData] = useState<SectionFormData>({
    name: "",
    description: "",
    color: "#3b82f6",
    icon: "grid",
    is_active: true,
    min_party_size: "",
    max_party_size: "",
  })

  const restaurantId = currentRestaurant?.restaurant.id

  // Use the custom hooks
  const { data: sections, isLoading } = useRestaurantSections(restaurantId)
  const createSectionMutation = useCreateSection(restaurantId)
  const updateSectionMutation = useUpdateSection(restaurantId)
  const deleteSectionMutation = useDeleteSection(restaurantId)
  const reorderSectionsMutation = useReorderSections(restaurantId)

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      color: "#3b82f6",
      icon: "grid",
      is_active: true,
      min_party_size: "",
      max_party_size: "",
    })
  }

  const handleCreate = () => {
    if (!formData.name.trim()) {
      toast.error("Section name is required")
      return
    }

    const minParty = formData.min_party_size ? parseInt(formData.min_party_size) : undefined
    const maxParty = formData.max_party_size ? parseInt(formData.max_party_size) : undefined

    if (minParty && maxParty && minParty > maxParty) {
      toast.error("Minimum party size cannot exceed maximum")
      return
    }
    
    createSectionMutation.mutate({
      name: formData.name,
      description: formData.description || undefined,
      color: formData.color,
      icon: formData.icon,
      is_active: formData.is_active,
      min_party_size: minParty ?? null,
      max_party_size: maxParty ?? null,
    }, {
      onSuccess: () => {
        setIsCreateDialogOpen(false)
        resetForm()
      }
    })
  }

  const handleEdit = (section: RestaurantSection) => {
    setEditingSection(section)
    setFormData({
      name: section.name,
      description: section.description || "",
      color: section.color,
      icon: section.icon,
      is_active: section.is_active,
      min_party_size: section.min_party_size?.toString() || "",
      max_party_size: section.max_party_size?.toString() || "",
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdate = () => {
    if (!editingSection || !formData.name.trim()) {
      toast.error("Section name is required")
      return
    }

    const minParty = formData.min_party_size ? parseInt(formData.min_party_size) : undefined
    const maxParty = formData.max_party_size ? parseInt(formData.max_party_size) : undefined

    if (minParty && maxParty && minParty > maxParty) {
      toast.error("Minimum party size cannot exceed maximum")
      return
    }
    
    updateSectionMutation.mutate({
      id: editingSection.id,
      data: {
        name: formData.name,
        description: formData.description || undefined,
        color: formData.color,
        icon: formData.icon,
        is_active: formData.is_active,
        min_party_size: minParty ?? null,
        max_party_size: maxParty ?? null,
      }
    }, {
      onSuccess: () => {
        setIsEditDialogOpen(false)
        setEditingSection(null)
        resetForm()
      }
    })
  }

  const handleDelete = (section: RestaurantSection) => {
    if (confirm(`Are you sure you want to delete the section "${section.name}"?`)) {
      deleteSectionMutation.mutate(section.id)
    }
  }

  const moveSection = (section: RestaurantSection, direction: 'up' | 'down') => {
    if (!sections) return

    const currentIndex = sections.findIndex(s => s.id === section.id)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= sections.length) return

    const newSections = [...sections]
    const [movedSection] = newSections.splice(currentIndex, 1)
    newSections.splice(targetIndex, 0, movedSection)

    // Update display orders
    const updates = newSections.map((s, index) => ({
      id: s.id,
      display_order: index + 1
    }))

    reorderSectionsMutation.mutate(updates)
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, section: RestaurantSection) => {
    setDraggedSection(section)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (!draggedSection || !sections) return

    const currentIndex = sections.findIndex(s => s.id === draggedSection.id)
    if (currentIndex === targetIndex) {
      setDraggedSection(null)
      setDragOverIndex(null)
      return
    }

    const newSections = [...sections]
    const [movedSection] = newSections.splice(currentIndex, 1)
    newSections.splice(targetIndex, 0, movedSection)

    const updates = newSections.map((s, index) => ({
      id: s.id,
      display_order: index + 1
    }))

    reorderSectionsMutation.mutate(updates)
    setDraggedSection(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedSection(null)
    setDragOverIndex(null)
  }

  if (!currentRestaurant) {
    return <div>Loading...</div>
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Grid className="h-5 w-5 text-purple-600" />
            </div>
            <h1 className="text-2xl font-bold">Restaurant Sections</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Organize your restaurant into sections and manage closures
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 h-auto gap-0 bg-transparent p-1">
          <TabsTrigger 
            value="sections" 
            className="flex items-center justify-center gap-2 text-sm data-[state=active]:bg-pink-100 data-[state=active]:text-purple-900 rounded-lg transition-colors"
          >
            <Grid className="h-4 w-4" />
            Sections
          </TabsTrigger>
          <TabsTrigger 
            value="closures" 
            className="flex items-center justify-center gap-2 text-sm data-[state=active]:bg-pink-100 data-[state=active]:text-purple-900 rounded-lg transition-colors"
          >
            <Ban className="h-4 w-4" />
            Closures
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sections" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Manage your restaurant sections. Customers can specify their preferred section when making bookings.
            </p>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-9">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Section
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Section</DialogTitle>
                  <DialogDescription>
                    Add a new section to organize your restaurant layout
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Section Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Main Dining, Patio, Bar Area"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of this section"
                    />
                  </div>

                  <div>
                    <Label>Color</Label>
                    <div className="flex gap-2 mt-2">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          className={cn(
                            "w-8 h-8 rounded-full border-2",
                            formData.color === color ? "border-gray-900" : "border-gray-300"
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => setFormData({ ...formData, color })}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label htmlFor="is_active">Active</Label>
                  </div>

                  <div>
                    <Label className="flex items-center gap-1.5 mb-1.5">
                      <Users className="h-3.5 w-3.5" />
                      Party Size (Optional)
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Override the restaurant default for this section. Shown to customers when booking.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="min_party_size" className="text-xs">Minimum</Label>
                        <Input
                          id="min_party_size"
                          type="number"
                          min={1}
                          value={formData.min_party_size}
                          onChange={(e) => setFormData({ ...formData, min_party_size: e.target.value })}
                          placeholder="e.g. 1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="max_party_size" className="text-xs">Maximum</Label>
                        <Input
                          id="max_party_size"
                          type="number"
                          min={1}
                          value={formData.max_party_size}
                          onChange={(e) => setFormData({ ...formData, max_party_size: e.target.value })}
                          placeholder="e.g. 8"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleCreate}
                      disabled={createSectionMutation.isPending}
                    >
                      {createSectionMutation.isPending ? "Creating..." : "Create Section"}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsCreateDialogOpen(false)
                        resetForm()
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="bg-background">
            <CardContent className="p-3">
              {isLoading ? (
                <div className="p-6 text-center">Loading sections...</div>
              ) : !sections || sections.length === 0 ? (
                <div className="text-center py-8">
                  <Grid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No sections yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create sections to organize your restaurant for better booking management
                  </p>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Section
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sections.map((section, index) => (
                    <div
                      key={section.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, section)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border bg-card cursor-grab active:cursor-grabbing transition-colors hover:bg-muted/50",
                        draggedSection?.id === section.id && "opacity-50",
                        dragOverIndex === index && draggedSection?.id !== section.id && "border-primary ring-1 ring-primary/20"
                      )}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: section.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{section.name}</p>
                          <Badge variant={section.is_active ? "default" : "secondary"} className="text-[10px] h-5 px-1.5 shrink-0">
                            {section.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        {section.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{section.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleEdit(section)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(section)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Section</DialogTitle>
                <DialogDescription>
                  Update the section details
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-name">Section Name</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Main Dining, Patio, Bar Area"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-description">Description (Optional)</Label>
                  <Textarea
                    id="edit-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this section"
                  />
                </div>

                <div>
                  <Label>Color</Label>
                  <div className="flex gap-2 mt-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        className={cn(
                          "w-8 h-8 rounded-full border-2",
                          formData.color === color ? "border-gray-900" : "border-gray-300"
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, color })}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="edit-is_active">Active</Label>
                </div>

                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Party Size (Optional)
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Override the restaurant default for this section. Shown to customers when booking.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="edit-min_party_size" className="text-xs">Minimum</Label>
                      <Input
                        id="edit-min_party_size"
                        type="number"
                        min={1}
                        value={formData.min_party_size}
                        onChange={(e) => setFormData({ ...formData, min_party_size: e.target.value })}
                        placeholder="e.g. 1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-max_party_size" className="text-xs">Maximum</Label>
                      <Input
                        id="edit-max_party_size"
                        type="number"
                        min={1}
                        value={formData.max_party_size}
                        onChange={(e) => setFormData({ ...formData, max_party_size: e.target.value })}
                        placeholder="e.g. 8"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleUpdate}
                    disabled={updateSectionMutation.isPending}
                  >
                    {updateSectionMutation.isPending ? "Updating..." : "Update Section"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsEditDialogOpen(false)
                      setEditingSection(null)
                      resetForm()
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="closures">
          <SectionClosuresManager
            restaurantId={restaurantId!}
            sections={sections || []}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
