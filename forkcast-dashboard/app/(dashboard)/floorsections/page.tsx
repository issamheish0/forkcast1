// app/(dashboard)/floorsections/page.tsx - Floor Plans & Sections Management
"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRestaurantContext } from '@/lib/contexts/restaurant-context'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Ban,
  Layout,
  Settings2,
  Eye,
  EyeOff,
  Users,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { getSectionMaxCovers } from '@/lib/section-capacity'
import { SectionClosuresManager } from '@/components/basic/section-closures-manager'
import type { RestaurantSection, RestaurantTable } from '@/types'

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

interface FloorPlanWithCounts extends RestaurantSection {
  table_count: number
  combination_count: number
  max_capacity: number
  is_manual_override: boolean
  schedules: {
    days: string[]
    shifts: string[]
  }
}

interface SectionPropertiesForm {
  description: string
  color: string
  is_active: boolean
  min_party_size: string
  max_party_size: string
}

export default function FloorPlansPage() {
  const router = useRouter()
  const { currentRestaurant, tier, hasFeature } = useRestaurantContext()
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [restaurantId, setRestaurantId] = useState<string>('')
  const [activeTab, setActiveTab] = useState('floorplans')
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; section: RestaurantSection | null }>({
    open: false,
    section: null
  })
  const [renameState, setRenameState] = useState<{ open: boolean; section: RestaurantSection | null; value: string }>({
    open: false,
    section: null,
    value: ''
  })
  const [isRenaming, setIsRenaming] = useState(false)

  // Section properties dialog state
  const [propertiesState, setPropertiesState] = useState<{
    open: boolean
    section: RestaurantSection | null
    form: SectionPropertiesForm
  }>({
    open: false,
    section: null,
    form: { description: '', color: '#3b82f6', is_active: true, min_party_size: '', max_party_size: '' }
  })
  const [isSavingProperties, setIsSavingProperties] = useState(false)

  // Create section dialog state
  const [createState, setCreateState] = useState<{
    open: boolean
    name: string
    description: string
    color: string
    is_active: boolean
  }>({
    open: false,
    name: '',
    description: '',
    color: '#3b82f6',
    is_active: true
  })
  const [isCreating, setIsCreating] = useState(false)

  // Tier restrictions removed — all restaurants have access to floor sections

  // Set restaurant ID from context
  useEffect(() => {
    if (currentRestaurant) {
      setRestaurantId(currentRestaurant.restaurant.id)
    }
  }, [currentRestaurant])

  // Fetch sections (floor plans) with table counts
  const { data: floorPlans = [], isLoading } = useQuery({
    queryKey: ['floor-plans', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []

      // Fetch sections
      const { data: sections, error: sectionsError } = await supabase
        .from('restaurant_sections')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('display_order', { ascending: true })

      if (sectionsError) throw sectionsError
      if (!sections) return []

      // Fetch table counts per section (including capacity data)
      const { data: tables, error: tablesError } = await supabase
        .from('restaurant_tables')
        .select('id, section_id, max_capacity, capacity, is_active')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)

      if (tablesError) throw tablesError

      // Fetch combinations per section — scoped to restaurant's tables
      const tableIds = tables?.map(t => t.id) || []
      const { data: combinations } = tableIds.length > 0
        ? await supabase
            .from('table_combinations')
            .select(`
              id,
              primary_table:restaurant_tables!primary_table_id(section_id)
            `)
            .in('primary_table_id', tableIds)
        : { data: [] }

      // Count tables per section
      const tableCounts: Record<string, number> = {}
      tables?.forEach(table => {
        if (table.section_id) {
          tableCounts[table.section_id] = (tableCounts[table.section_id] || 0) + 1
        }
      })

      // Count combinations per section
      const comboCounts: Record<string, number> = {}
      combinations?.forEach((combo: any) => {
        const sectionId = combo.primary_table?.section_id
        if (sectionId) {
          comboCounts[sectionId] = (comboCounts[sectionId] || 0) + 1
        }
      })

      return sections.map(section => {
        // Compute max covers: manual override or sum of table capacities
        const sectionTables = (tables || []).filter(t => t.section_id === section.id) as RestaurantTable[]
        const { maxCovers, isManualOverride } = getSectionMaxCovers(section, sectionTables)

        return {
          ...section,
          table_count: tableCounts[section.id] || 0,
          combination_count: comboCounts[section.id] || 0,
          max_capacity: maxCovers,
          is_manual_override: isManualOverride,
          schedules: {
            days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            shifts: ['Lunch', 'Dinner']
          }
        }
      }) as FloorPlanWithCounts[]
    },
    enabled: !!restaurantId
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      const { error } = await supabase
        .from('restaurant_sections')
        .delete()
        .eq('id', sectionId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor-plans'] })
      toast.success('Floor plan deleted')
      setDeleteConfirm({ open: false, section: null })
    },
    onError: (error) => {
      toast.error('Failed to delete floor plan')
      console.error(error)
    }
  })

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: async (section: RestaurantSection) => {
      // Create new section
      const { data: newSection, error: sectionError } = await supabase
        .from('restaurant_sections')
        .insert({
          restaurant_id: restaurantId,
          name: `${section.name} (Copy)`,
          description: section.description,
          display_order: Math.max(0, ...floorPlans.map(fp => fp.display_order || 0)) + 1,
          is_active: true,
          color: section.color,
          icon: section.icon
        })
        .select()
        .single()

      if (sectionError) throw sectionError

      // Copy tables if any — scoped by restaurant_id for multi-tenant isolation
      const { data: tables, error: tablesError } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('section_id', section.id)
        .eq('restaurant_id', restaurantId)

      if (tablesError) {
        console.error('Failed to fetch tables for duplication:', tablesError)
      }

      if (tables && tables.length > 0) {
        const newTables = tables.map(table => ({
          restaurant_id: restaurantId,
          section_id: newSection.id,
          table_number: `${table.table_number}_copy`,
          table_type: table.table_type,
          capacity: table.capacity,
          min_capacity: table.min_capacity,
          max_capacity: table.max_capacity,
          x_position: table.x_position,
          y_position: table.y_position,
          width: table.width,
          height: table.height,
          shape: table.shape,
          is_active: table.is_active,
          features: table.features,
          is_combinable: table.is_combinable,
          combinable_with: [],
          priority_score: table.priority_score,
          default_booking_type: table.default_booking_type || 'request',
        }))

        const { error: insertError } = await supabase.from('restaurant_tables').insert(newTables)
        if (insertError) {
          console.error('Failed to duplicate tables:', insertError)
          // Section was created but tables failed — still return so the user can add tables manually
        }
      }

      return newSection
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor-plans'] })
      toast.success('Floor plan duplicated')
    },
    onError: (error) => {
      toast.error('Failed to duplicate floor plan')
      console.error(error)
    }
  })

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ sectionId, isActive }: { sectionId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('restaurant_sections')
        .update({ is_active: isActive })
        .eq('id', sectionId)
      if (error) throw error
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['floor-plans'] })
      toast.success(isActive ? 'Floor plan activated' : 'Floor plan deactivated')
    },
    onError: () => {
      toast.error('Failed to update floor plan status')
    }
  })

  const handleNewFloorPlan = () => {
    router.push('/floorsections/new/edit')
  }

  const handleCreateSection = async () => {
    const trimmedName = createState.name.trim()
    if (!trimmedName) {
      toast.error('Floor plan name is required')
      return
    }
    setIsCreating(true)
    try {
      const { error } = await supabase
        .from('restaurant_sections')
        .insert({
          restaurant_id: restaurantId,
          name: trimmedName,
          description: createState.description || null,
          color: createState.color,
          icon: 'grid',
          is_active: createState.is_active,
          display_order: Math.max(0, ...floorPlans.map(fp => fp.display_order || 0)) + 1,
        })
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['floor-plans'] })
      toast.success('Floor plan created')
      setCreateState({ open: false, name: '', description: '', color: '#3b82f6', is_active: true })
    } catch (e) {
      toast.error('Failed to create floor plan')
      console.error(e)
    } finally {
      setIsCreating(false)
    }
  }

  const handleEdit = (sectionId: string) => {
    router.push(`/floorsections/${sectionId}/edit`)
  }

  const handleDuplicate = (section: RestaurantSection) => {
    duplicateMutation.mutate(section)
  }

  const handleDelete = (section: RestaurantSection) => {
    setDeleteConfirm({ open: true, section })
  }

  const handleRenameOpen = (section: RestaurantSection) => {
    setRenameState({ open: true, section, value: section.name })
  }

  const handleRenameConfirm = async () => {
    const trimmed = renameState.value.trim()
    if (!trimmed || !renameState.section) return
    setIsRenaming(true)
    try {
      const { error } = await supabase
        .from('restaurant_sections')
        .update({ name: trimmed })
        .eq('id', renameState.section.id)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['floor-plans'] })
      toast.success('Floor plan renamed')
      setRenameState({ open: false, section: null, value: '' })
    } catch (e) {
      toast.error('Failed to rename floor plan')
      console.error(e)
    } finally {
      setIsRenaming(false)
    }
  }

  const handlePropertiesOpen = (section: RestaurantSection) => {
    setPropertiesState({
      open: true,
      section,
      form: {
        description: section.description || '',
        color: section.color,
        is_active: section.is_active,
        min_party_size: section.min_party_size?.toString() || '',
        max_party_size: section.max_party_size?.toString() || '',
      }
    })
  }

  const handlePropertiesSave = async () => {
    if (!propertiesState.section) return
    const minParty = propertiesState.form.min_party_size ? parseInt(propertiesState.form.min_party_size) : null
    const maxParty = propertiesState.form.max_party_size ? parseInt(propertiesState.form.max_party_size) : null
    if (minParty && maxParty && minParty > maxParty) {
      toast.error('Minimum party size cannot exceed maximum')
      return
    }
    setIsSavingProperties(true)
    try {
      const { error } = await supabase
        .from('restaurant_sections')
        .update({
          description: propertiesState.form.description || null,
          color: propertiesState.form.color,
          is_active: propertiesState.form.is_active,
          min_party_size: minParty,
          max_party_size: maxParty,
        })
        .eq('id', propertiesState.section.id)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['floor-plans'] })
      toast.success('Properties updated')
      setPropertiesState({ open: false, section: null, form: { description: '', color: '#3b82f6', is_active: true, min_party_size: '', max_party_size: '' } })
    } catch (e) {
      toast.error('Failed to update properties')
      console.error(e)
    } finally {
      setIsSavingProperties(false)
    }
  }

  const confirmDelete = () => {
    if (deleteConfirm.section) {
      deleteMutation.mutate(deleteConfirm.section.id)
    }
  }

  // Map FloorPlanWithCounts to the shape SectionClosuresManager expects
  const sectionsForClosures = floorPlans.map(fp => ({
    id: fp.id,
    restaurant_id: fp.restaurant_id,
    name: fp.name,
    description: fp.description,
    display_order: fp.display_order,
    is_active: fp.is_active,
    color: fp.color,
    icon: fp.icon,
    created_at: fp.created_at,
    updated_at: fp.updated_at,
  }))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="motion-safe:animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Compact Header Bar */}
      <div className="flex-shrink-0 px-3 py-2 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-violet-500 flex items-center justify-center">
              <Layout className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Sections</h1>
              <p className="text-xs text-muted-foreground">
                Manage sections & closures
              </p>
            </div>
          </div>
          {activeTab === 'floorplans' && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateState(s => ({ ...s, open: true }))}
                className="h-8 gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="text-xs">Quick Create</span>
              </Button>
              <Button onClick={handleNewFloorPlan} size="sm" className="h-8 gap-1">
                <Plus className="h-3.5 w-3.5" />
                <span className="text-xs">New</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-auto px-3 py-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full max-w-md h-10">
            <TabsTrigger value="floorplans" className="flex-1 flex items-center justify-center gap-2 text-sm">
              <Layout className="h-4 w-4" />
              Sections
            </TabsTrigger>
            <TabsTrigger value="closures" className="flex-1 flex items-center justify-center gap-2 text-sm">
              <Ban className="h-4 w-4" />
              Closures
            </TabsTrigger>
          </TabsList>

          {/* Floor Plans Tab */}
          <TabsContent value="floorplans" className="space-y-3">
            {/* Column header */}
            {floorPlans.length > 0 && (
              <div className="grid grid-cols-[1fr_100px_100px_100px_140px_48px] gap-4 items-center px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span className="text-left">SECTION</span>
                <span className="text-right">TABLES</span>
                <span className="text-right">COMBOS</span>
                <span className="text-center">STATUS</span>
                <span className="text-right">LAST EDITED</span>
                <span />
              </div>
            )}

            {floorPlans.map((plan) => (
              <div
                key={plan.id}
                className="grid grid-cols-[1fr_100px_100px_100px_140px_48px] gap-4 items-center bg-card rounded-xl px-5 py-4 shadow-sm border border-border/50 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleEdit(plan.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-4 h-4 rounded-full shrink-0 ring-1 ring-border"
                    style={{ backgroundColor: plan.color }}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{plan.name}</p>
                    {plan.description && (
                      <p className="text-xs text-muted-foreground truncate">{plan.description}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm text-muted-foreground">
                    {plan.table_count}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm text-muted-foreground">
                    {plan.combination_count}
                  </span>
                </div>
                <div className="text-center">
                  <Badge
                    variant={plan.is_active ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {plan.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="text-right">
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(plan.updated_at), 'yyyy-MM-dd')}
                  </span>
                </div>
                <div className="text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(plan.id)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Layout
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleRenameOpen(plan)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handlePropertiesOpen(plan)}>
                        <Settings2 className="h-4 w-4 mr-2" />
                        Properties
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => toggleActiveMutation.mutate({ sectionId: plan.id, isActive: !plan.is_active })}
                      >
                        {plan.is_active ? (
                          <>
                            <EyeOff className="h-4 w-4 mr-2" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 mr-2" />
                            Activate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(plan)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(plan)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}

            {floorPlans.length === 0 && (
              <div className="text-center py-20 text-muted-foreground">
                <Layout className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <p className="text-lg font-medium">No sections yet</p>
                <p className="text-sm mt-1 mb-4">Create your first section to get started.</p>
                <div className="flex items-center gap-2 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setCreateState(s => ({ ...s, open: true }))}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Quick Create
                  </Button>
                  <Button onClick={handleNewFloorPlan}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Floor Plan
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Closures Tab */}
          <TabsContent value="closures">
            <SectionClosuresManager
              restaurantId={restaurantId}
              sections={sectionsForClosures}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Quick Create Dialog */}
      <Dialog
        open={createState.open}
        onOpenChange={(open) => !open && setCreateState({ open: false, name: '', description: '', color: '#3b82f6', is_active: true })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Floor Plan</DialogTitle>
            <DialogDescription>
              Add a new section to your restaurant layout
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="fp-create-name">Name *</Label>
              <Input
                id="fp-create-name"
                value={createState.name}
                onChange={(e) => setCreateState(s => ({ ...s, name: e.target.value }))}
                placeholder="e.g., Main Dining, Patio, Bar Area"
                autoFocus
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="fp-create-desc">Description</Label>
              <Textarea
                id="fp-create-desc"
                value={createState.description}
                onChange={(e) => setCreateState(s => ({ ...s, description: e.target.value }))}
                placeholder="Brief description of this section"
                rows={2}
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-transform",
                      createState.color === color ? "border-foreground scale-110" : "border-border"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setCreateState(s => ({ ...s, color }))}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="fp-create-active"
                checked={createState.is_active}
                onCheckedChange={(checked) => setCreateState(s => ({ ...s, is_active: checked }))}
              />
              <Label htmlFor="fp-create-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateState({ open: false, name: '', description: '', color: '#3b82f6', is_active: true })}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateSection} disabled={isCreating || !createState.name.trim()}>
              {isCreating && <span className="mr-1.5 h-3.5 w-3.5 motion-safe:animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Properties Dialog */}
      <Dialog
        open={propertiesState.open}
        onOpenChange={(open) => !open && setPropertiesState({ open: false, section: null, form: { description: '', color: '#3b82f6', is_active: true, min_party_size: '', max_party_size: '' } })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {propertiesState.section?.name} &mdash; Properties
            </DialogTitle>
            <DialogDescription>
              Edit section properties for this floor plan
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="fp-props-desc">Description</Label>
              <Textarea
                id="fp-props-desc"
                value={propertiesState.form.description}
                onChange={(e) => setPropertiesState(s => ({
                  ...s,
                  form: { ...s.form, description: e.target.value }
                }))}
                placeholder="Brief description of this section"
                rows={2}
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-transform",
                      propertiesState.form.color === color ? "border-foreground scale-110" : "border-border"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setPropertiesState(s => ({
                      ...s,
                      form: { ...s.form, color }
                    }))}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="fp-props-active"
                checked={propertiesState.form.is_active}
                onCheckedChange={(checked) => setPropertiesState(s => ({
                  ...s,
                  form: { ...s.form, is_active: checked }
                }))}
              />
              <Label htmlFor="fp-props-active">Active</Label>
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Users className="h-3.5 w-3.5" />
                Party Size (Optional)
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Override the restaurant default for this section.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="fp-props-min-party" className="text-xs">Minimum</Label>
                  <Input
                    id="fp-props-min-party"
                    type="number"
                    min={1}
                    value={propertiesState.form.min_party_size}
                    onChange={(e) => setPropertiesState(s => ({
                      ...s,
                      form: { ...s.form, min_party_size: e.target.value }
                    }))}
                    placeholder="e.g. 1"
                  />
                </div>
                <div>
                  <Label htmlFor="fp-props-max-party" className="text-xs">Maximum</Label>
                  <Input
                    id="fp-props-max-party"
                    type="number"
                    min={1}
                    value={propertiesState.form.max_party_size}
                    onChange={(e) => setPropertiesState(s => ({
                      ...s,
                      form: { ...s.form, max_party_size: e.target.value }
                    }))}
                    placeholder="e.g. 8"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPropertiesState({ open: false, section: null, form: { description: '', color: '#3b82f6', is_active: true, min_party_size: '', max_party_size: '' } })}
            >
              Cancel
            </Button>
            <Button onClick={handlePropertiesSave} disabled={isSavingProperties}>
              {isSavingProperties && <span className="mr-1.5 h-3.5 w-3.5 motion-safe:animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog
        open={renameState.open}
        onOpenChange={(open) => !open && setRenameState({ open: false, section: null, value: '' })}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Floor Plan</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="fp-rename-input" className="text-sm mb-2 block">Floor plan name</Label>
            <Input
              id="fp-rename-input"
              value={renameState.value}
              onChange={(e) => setRenameState(s => ({ ...s, value: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm() }}
              autoFocus
              className="h-9"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameState({ open: false, section: null, value: '' })}>Cancel</Button>
            <Button onClick={handleRenameConfirm} disabled={isRenaming || !renameState.value.trim()}>
              {isRenaming && <span className="mr-1.5 h-3.5 w-3.5 motion-safe:animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Floor Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteConfirm.section?.name}
              &quot;? This will also delete all tables in this floor plan. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
