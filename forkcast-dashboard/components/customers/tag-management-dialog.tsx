// components/customers/tag-management-dialog.tsx

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Tag,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import type { CustomerTag } from '@/types/customer'

interface TagManagementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurantId: string
  tags: CustomerTag[]
  onUpdate: () => void
}

const TAG_COLORS = [
  { name: 'Mulberry Velvet', value: '#7A2E4A' }, // Primary brand color
  { name: 'Lavender Fog', value: '#D4C4E0' }, // Accent brand color
  { name: 'Blushed Linen', value: '#FFF0E6' }, // Secondary brand color
  { name: 'Charcoal Mood', value: '#787878' }, // Muted foreground
  { name: 'Sage Green', value: '#10B981' },
  { name: 'Warm Orange', value: '#F97316' },
  { name: 'Golden Yellow', value: '#F59E0B' },
  { name: 'Deep Purple', value: '#8B5CF6' },
  { name: 'Pure White', value: '#FFFFFF' },
]

// Function to determine if a color is light and needs dark text
const isLightColor = (hexColor: string): boolean => {
  // Convert hex to RGB
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  
  // Return true if light (needs dark text)
  return luminance > 0.6
}

export function TagManagementDialog({
  open,
  onOpenChange,
  restaurantId,
  tags,
  onUpdate
}: TagManagementDialogProps) {
  const supabase = createClient()
  
  // State
  const [loading, setLoading] = useState(false)
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [deleteConfirmTag, setDeleteConfirmTag] = useState<string | null>(null)
  
  // New tag form
  const [newTag, setNewTag] = useState({
    name: '',
    color: '#7A2E4A', // Default to primary brand color
    description: ''
  })
  
  // Edit tag form
  const [editForm, setEditForm] = useState({
    name: '',
    color: '',
    description: ''
  })

  // Create new tag
  const handleCreateTag = async () => {
    if (!newTag.name.trim()) return

    const nameLower = newTag.name.trim().toLowerCase()
    if (tags.some(t => t.name.toLowerCase() === nameLower)) {
      toast.error('A tag with this name already exists')
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase
        .from('customer_tags')
        .insert({
          restaurant_id: restaurantId,
          name: newTag.name.trim(),
          color: newTag.color,
          description: newTag.description.trim()
        })

      if (error) throw error

      toast.success('Tag created successfully')
      setNewTag({ name: '', color: '#7A2E4A', description: '' })
      onUpdate()
    } catch (error: any) {
      console.error('Error creating tag:', error)
      toast.error(error.message || 'Failed to create tag')
    } finally {
      setLoading(false)
    }
  }

  // Update tag
  const handleUpdateTag = async (tagId: string) => {
    if (!editForm.name.trim()) return

    try {
      setLoading(true)
      
      const { error } = await supabase
        .from('customer_tags')
        .update({
          name: editForm.name.trim(),
          color: editForm.color,
          description: editForm.description.trim()
        })
        .eq('id', tagId)

      if (error) throw error

      toast.success('Tag updated successfully')
      setEditingTag(null)
      onUpdate()
    } catch (error: any) {
      console.error('Error updating tag:', error)
      toast.error(error.message || 'Failed to update tag')
    } finally {
      setLoading(false)
    }
  }

  // Delete tag
  const handleDeleteTag = async (tagId: string) => {
    try {
      setLoading(true)
      
      const { error } = await supabase
        .from('customer_tags')
        .delete()
        .eq('id', tagId)

      if (error) throw error

      toast.success('Tag deleted successfully')
      setDeleteConfirmTag(null)
      onUpdate()
    } catch (error: any) {
      console.error('Error deleting tag:', error)
      toast.error(error.message || 'Failed to delete tag')
    } finally {
      setLoading(false)
    }
  }

  // Start editing
  const startEditing = (tag: CustomerTag) => {
    setEditingTag(tag.id)
    setEditForm({
      name: tag.name,
      color: tag.color,
      description: tag.description || ''
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Customer Tags</DialogTitle>
            <DialogDescription>
              Create and manage tags to categorize your customers
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Create New Tag */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-medium flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create New Tag
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tag Name</Label>
                  <Input
                    placeholder="e.g., VIP, Regular, Birthday"
                    value={newTag.name}
                    onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                    maxLength={50}
                  />
                </div>
                
                <div>
                  <Label>Color</Label>
                  <Select
                    value={newTag.color}
                    onValueChange={(value) => setNewTag({ ...newTag, color: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a color">
                        <span className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full border border-gray-300 inline-block shrink-0"
                            style={{ backgroundColor: newTag.color }}
                          />
                          {TAG_COLORS.find(c => c.value === newTag.color)?.name ?? 'Select a color'}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {TAG_COLORS.map((color) => (
                        <SelectItem key={color.value} value={color.value}>
                          <span className="flex items-center gap-2">
                            <span
                              className="w-4 h-4 rounded-full border border-gray-300 inline-block shrink-0"
                              style={{ backgroundColor: color.value }}
                            />
                            {color.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label>Description (Optional)</Label>
                <Input
                  placeholder="Describe when to use this tag"
                  value={newTag.description}
                  onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
                  maxLength={200}
                />
              </div>
              
              <Button 
                onClick={handleCreateTag} 
                disabled={loading || !newTag.name.trim()}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Tag
              </Button>
            </div>

            {/* Existing Tags (manual first, then system/auto) */}
            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Your Tags ({tags.filter(t => !(t as any).is_system && !(t as any).system_key).length})
              </h3>

              {tags.filter(t => !(t as any).is_system && !(t as any).system_key).length === 0 ? (
                <div className="text-center py-4 text-gray-500 border rounded-lg">
                  No manual tags yet. Create your first tag above.
                </div>
              ) : (
                <div className="space-y-2">
                  {tags.filter(t => !(t as any).is_system && !(t as any).system_key).map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      {editingTag === tag.id ? (
                        // Edit mode
                        <div className="flex-1 space-y-2">
                          <div className="flex gap-2">
                            <Input
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="flex-1"
                            />
                            <Select
                              value={editForm.color}
                              onValueChange={(value) => setEditForm({ ...editForm, color: value })}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue>
                                  <span className="flex items-center gap-2">
                                    <span
                                      className="w-4 h-4 rounded-full border border-gray-300 inline-block shrink-0"
                                      style={{ backgroundColor: editForm.color }}
                                    />
                                    {TAG_COLORS.find(c => c.value === editForm.color)?.name ?? 'Color'}
                                  </span>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {TAG_COLORS.map((color) => (
                                  <SelectItem key={color.value} value={color.value}>
                                    <span className="flex items-center gap-2">
                                      <span
                                        className="w-4 h-4 rounded-full border border-gray-300 inline-block shrink-0"
                                        style={{ backgroundColor: color.value }}
                                      />
                                      {color.name}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Input
                            placeholder="Description"
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleUpdateTag(tag.id)}
                              disabled={loading || !editForm.name.trim()}
                            >
                              <Save className="h-3 w-3 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingTag(null)}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // View mode
                        <>
                          <div className="flex items-center gap-3">
                            <Badge
                              variant="outline"
                              style={{ 
                                borderColor: tag.color, 
                                color: isLightColor(tag.color) ? '#000000' : tag.color,
                                backgroundColor: `${tag.color}20`
                              }}
                            >
                              {tag.name}
                            </Badge>
                            {tag.description && (
                              <span className="text-sm text-gray-600">
                                {tag.description}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => startEditing(tag)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirmTag(tag.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Automated Tags (system-managed, read-only) */}
            {(() => {
              const systemTags = tags.filter(t => (t as any).is_system || (t as any).system_key)
              if (systemTags.length === 0) return null
              return (
                <div className="space-y-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Automated Tags ({systemTags.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    These tags are managed automatically and update from booking activity, profile data, and VIP/blacklist flags. Names and colors can be edited but the rule that drives assignment is fixed.
                  </p>
                  <div className="flex flex-wrap gap-1.5 p-3 border rounded-lg bg-muted/30">
                    {[...systemTags]
                      .sort((a: any, b: any) => (a?.priority ?? 999) - (b?.priority ?? 999))
                      .map(tag => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          className="inline-flex items-center gap-1 text-xs"
                          style={{
                            borderColor: tag.color,
                            color: isLightColor(tag.color) ? '#000' : tag.color,
                            backgroundColor: `${tag.color}20`,
                          }}
                          title={tag.description ?? tag.name}
                        >
                          <Sparkles className="h-3 w-3 opacity-70" />
                          {tag.name}
                        </Badge>
                      ))}
                  </div>
                </div>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={deleteConfirmTag !== null} 
        onOpenChange={() => setDeleteConfirmTag(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tag? This will remove it from all customers.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmTag && handleDeleteTag(deleteConfirmTag)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
