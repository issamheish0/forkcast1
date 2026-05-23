'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useRestaurantContext } from '@/lib/contexts/restaurant-context'
import { toast } from 'react-hot-toast'
import { CalendarDays, Plus, Trash2, Pencil, DollarSign, PartyPopper, Copy, ExternalLink } from 'lucide-react'
import { Label } from '@/components/ui/label'

interface RestaurantEvent {
  id: string
  restaurant_id: string
  title: string
  description: string | null
  special_pricing: {
    price_per_person?: number
    start_date?: string
    end_date?: string
  } | null
  is_active: boolean

}

interface EventFormData {
  title: string
  description: string
  price_per_person: number
  is_active: boolean
  start_date: string
  end_date: string
}

function EventEditorDialog({
  open,
  onOpenChange,
  event,
  onSave,
  isSaving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: RestaurantEvent | null
  onSave: (data: EventFormData) => void
  isSaving: boolean
}) {
  const [formData, setFormData] = useState<EventFormData>({
    title: event?.title || '',
    description: event?.description || '',
    price_per_person: event?.special_pricing?.price_per_person || 75,
    is_active: event?.is_active ?? true,
    start_date: event?.special_pricing?.start_date || '',
    end_date: event?.special_pricing?.end_date || '',
  })

  // Reset form when event or open changes
  useEffect(() => {
    if (open) {
      setFormData({
        title: event?.title || '',
        description: event?.description || '',
        price_per_person: event?.special_pricing?.price_per_person || 75,
        is_active: event?.is_active ?? true,
        start_date: event?.special_pricing?.start_date || '',
        end_date: event?.special_pricing?.end_date || '',
      })
    }
  }, [open, event])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const isValid = formData.title.trim() && formData.price_per_person > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{event ? 'Edit Event' : 'Create Event'}</DialogTitle>
            <DialogDescription>
              Set up a paid event that requires upfront payment per person.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Name *</Label>
              <Input
                id="title"
                placeholder="e.g., New Year's Eve Gala"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the event experience..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price Per Person *</Label>
              <div className="flex items-center">
                <span className="bg-muted px-3 py-2 border border-r-0 rounded-l-md text-sm text-muted-foreground">$</span>
                <Input
                  id="price"
                  type="number"
                  min={1}
                  step="0.01"
                  className="rounded-l-none"
                  value={formData.price_per_person}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_per_person: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date (Optional)</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date (Optional)</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground text-sm">Active events will be shown on your booking widget
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isSaving}>
              {isSaving ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EventCard({
  event,
  restaurantId,
  onEdit,
  onDelete,
}: {
  event: RestaurantEvent
  restaurantId: string
  onEdit: () => void
  onDelete: () => void
}) {
  const widgetUrl = `${typeof window !== 'undefined' ? window.location.origin.replace('rbs-restaurant', 'plate-landing-page') : ''}/widget/${restaurantId}`
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(widgetUrl)
    toast.success('Booking link copied!')
  }

  return (
    <div className={`border rounded-lg p-4 bg-card space-y-3 ${event.is_active ? '' : 'opacity-60'}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">{event.title}</h3>
            {event.is_active ? (
              <Badge variant="default" className="bg-green-500">Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </div>
          {event.description && (
            <p className="text-sm text-muted-foreground">{event.description}</p>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline" className="text-lg py-1 px-3">
          <DollarSign className="h-4 w-4 mr-1" />
          {event.special_pricing?.price_per_person || 0}/person
        </Badge>
        {event.special_pricing?.start_date && (
          <Badge variant="secondary">
            <CalendarDays className="h-3 w-3 mr-1" />
            {new Date(event.special_pricing.start_date).toLocaleDateString()}
            {event.special_pricing.end_date && ` - ${new Date(event.special_pricing.end_date).toLocaleDateString()}`}
          </Badge>
        )}
      </div>

      {event.is_active && (
        <div className="flex items-center gap-2 pt-2 border-t">
          <Input
            value={widgetUrl}
            readOnly
            className="text-xs bg-muted/50"
          />
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={widgetUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      )}
    </div>
  )
}

export default function EventsSettingsPage() {
  const { currentRestaurant } = useRestaurantContext()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const restaurantId = currentRestaurant?.restaurant.id

  const [editingEvent, setEditingEvent] = useState<RestaurantEvent | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Fetch events
  const { data: events, isLoading } = useQuery({
    queryKey: ['restaurant_events', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from('restaurant_events')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as RestaurantEvent[]
    },
    enabled: !!restaurantId
  })

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (formData: EventFormData) => {
      if (!restaurantId) throw new Error('No restaurant ID')

      const payload = {
        restaurant_id: restaurantId,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        is_active: formData.is_active,
        special_pricing: {
          price_per_person: formData.price_per_person,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
        }
      }

      if (editingEvent) {
        const { error } = await supabase
          .from('restaurant_events')
          .update(payload)
          .eq('id', editingEvent.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('restaurant_events')
          .insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant_events', restaurantId] })
      toast.success(editingEvent ? 'Event updated' : 'Event created')
      setIsDialogOpen(false)
      setEditingEvent(null)
    },
    onError: (err) => {
      console.error(err)
      toast.error('Failed to save event')
    }
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from('restaurant_events')
        .delete()
        .eq('id', eventId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant_events', restaurantId] })
      toast.success('Event deleted')
    },
    onError: (err) => {
      console.error(err)
      toast.error('Failed to delete event')
    }
  })

  const handleAddEvent = () => {
    setEditingEvent(null)
    setIsDialogOpen(true)
  }

  const handleEditEvent = (event: RestaurantEvent) => {
    setEditingEvent(event)
    setIsDialogOpen(true)
  }

  const handleDeleteEvent = (eventId: string) => {
    if (confirm('Are you sure you want to delete this event?')) {
      deleteMutation.mutate(eventId)
    }
  }

  const handleSaveEvent = (formData: EventFormData) => {
    saveMutation.mutate(formData)
  }

  if (isLoading) {
    return <div className="p-4 flex justify-center">Loading events...</div>
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Compact Header Bar */}
      <div className="flex-shrink-0 px-3 py-2 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-purple-500 flex items-center justify-center">
              <PartyPopper className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Special Events</h1>
              <p className="text-xs text-muted-foreground">Paid events & special occasions</p>
            </div>
          </div>
          <Button onClick={handleAddEvent} size="sm" className="h-8 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create Event
          </Button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Your Events
            </CardTitle>
            <CardDescription className="text-xs">
              Active events will appear on your booking widget. Guests pay the full amount before confirming.
            </CardDescription>
          </CardHeader>
          <CardContent>
          {events && events.length > 0 ? (
            <div className="space-y-4">
              {events.map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  restaurantId={restaurantId!}
                  onEdit={() => handleEditEvent(event)}
                  onDelete={() => handleDeleteEvent(event.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <PartyPopper className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No events yet</p>
              <p className="text-sm mb-4">Create your first paid event to get started.</p>
              <Button onClick={handleAddEvent} size="sm">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create Event
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      <EventEditorDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        event={editingEvent}
        onSave={handleSaveEvent}
        isSaving={saveMutation.isPending}
      />
    </div>
  )
}

