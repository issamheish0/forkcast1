'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'react-hot-toast'
import { CalendarIcon, Loader2, Plus, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CreateWaitlistDialogProps {
  restaurantId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const TABLE_TYPES = [
  { value: 'any', label: 'Any Table' },
  { value: 'standard', label: 'Standard' },
  { value: 'booth', label: 'Booth' },
  { value: 'window', label: 'Window' },
  { value: 'patio', label: 'Patio' },
  { value: 'bar', label: 'Bar' },
  { value: 'private', label: 'Private' },
]

export function CreateWaitlistDialog({
  restaurantId,
  open,
  onOpenChange,
  onSuccess,
}: CreateWaitlistDialogProps) {
  const [formData, setFormData] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    party_size: '', // No default - admin must input manually
    desired_date: new Date(),
    start_time: '', // No default - admin must input manually
    end_time: '', // No default - admin must input manually
    table_type: 'any',
    special_requests: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Reset form when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setFormData({
        guest_name: '',
        guest_email: '',
        guest_phone: '',
        party_size: '', // No default - admin must input manually
        desired_date: new Date(),
        start_time: '', // No default - admin must input manually
        end_time: '', // No default - admin must input manually
        table_type: 'any',
        special_requests: '',
      })
      setErrors({})
    }
    onOpenChange(isOpen)
  }

  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    // Guest name is optional - will default to "Anonymous User" if empty

    if (!formData.start_time || !formData.end_time) {
      newErrors.time_range = 'Start and end times are required'
    } else {
      // Compare times directly (already in 24-hour format HH:MM)
      if (formData.start_time >= formData.end_time) {
        newErrors.time_range = 'End time must be after start time'
      }
    }

    const partySize = parseInt(formData.party_size)
    if (isNaN(partySize) || partySize < 1 || partySize > 20) {
      newErrors.party_size = 'Party size must be between 1 and 20'
    }

    if (formData.guest_email && !isValidEmail(formData.guest_email)) {
      newErrors.guest_email = 'Invalid email format'
    }

    if (formData.guest_phone && !isValidPhone(formData.guest_phone)) {
      newErrors.guest_phone = 'Invalid phone format'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const isValidPhone = (phone: string) => {
    return /^[\d\s\-\+\(\)]+$/.test(phone) && phone.replace(/\D/g, '').length >= 10
  }

  // Create waitlist entry mutation
  const createWaitlistMutation = useMutation({
    mutationFn: async () => {
      if (!validateForm()) {
        throw new Error('Validation failed')
      }

      // Time inputs already provide time in 24-hour format (HH:MM)
      const timeRange = `${formData.start_time}-${formData.end_time}`

      // Use "Anonymous User" if no guest name provided
      const guestName = formData.guest_name.trim() || 'Anonymous User'

      const { data, error } = await supabase
        .from('waitlist')
        .insert({
          restaurant_id: restaurantId,
          guest_name: guestName,
          guest_email: formData.guest_email.trim() || null,
          guest_phone: formData.guest_phone.trim() || null,
          party_size: parseInt(formData.party_size),
          desired_date: format(formData.desired_date, 'yyyy-MM-dd'),
          desired_time_range: timeRange,
          table_type: formData.table_type,
          special_requests: formData.special_requests.trim() || null,
          status: 'active',
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Waitlist entry created successfully')
      queryClient.invalidateQueries({ queryKey: ['basic-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['basic-analytics'] })
      onSuccess?.()
      handleOpenChange(false)
    },
    onError: (error: any) => {
      console.error('Error creating waitlist entry:', error)
      toast.error(`Failed to create waitlist entry: ${error.message}`)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createWaitlistMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Waitlist Entry
          </DialogTitle>
          <DialogDescription>
            Add a new customer to the waitlist manually. They will be notified when a table becomes available.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Guest Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Guest Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guest_name">
                  Guest Name
                </Label>
                <Input
                  id="guest_name"
                  value={formData.guest_name}
                  onChange={(e) =>
                    setFormData({ ...formData, guest_name: e.target.value })
                  }
                  placeholder="John Doe (optional - defaults to Anonymous User)"
                  className={cn(errors.guest_name && 'border-red-500')}
                />
                {errors.guest_name && (
                  <p className="text-sm text-red-500">{errors.guest_name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="party_size">
                  Party Size <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="party_size"
                  type="number"
                  min="1"
                  max="20"
                  placeholder="Enter number of guests"
                  value={formData.party_size}
                  onChange={(e) =>
                    setFormData({ ...formData, party_size: e.target.value })
                  }
                  className={cn(errors.party_size && 'border-red-500')}
                />
                {errors.party_size && (
                  <p className="text-sm text-red-500">{errors.party_size}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="guest_email">Guest Email</Label>
                <Input
                  id="guest_email"
                  type="email"
                  value={formData.guest_email}
                  onChange={(e) =>
                    setFormData({ ...formData, guest_email: e.target.value })
                  }
                  placeholder="john@example.com"
                  className={cn(errors.guest_email && 'border-red-500')}
                />
                {errors.guest_email && (
                  <p className="text-sm text-red-500">{errors.guest_email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="guest_phone">Guest Phone</Label>
                <Input
                  id="guest_phone"
                  type="tel"
                  value={formData.guest_phone}
                  onChange={(e) =>
                    setFormData({ ...formData, guest_phone: e.target.value })
                  }
                  placeholder="+1 (555) 123-4567"
                  className={cn(errors.guest_phone && 'border-red-500')}
                />
                {errors.guest_phone && (
                  <p className="text-sm text-red-500">{errors.guest_phone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Booking Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Booking Preferences</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Desired Date <span className="text-red-500">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !formData.desired_date && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.desired_date
                        ? format(formData.desired_date, 'PPP')
                        : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.desired_date}
                      onSelect={(date) =>
                        date && setFormData({ ...formData, desired_date: date })
                      }
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Time Range Inputs */}
              <div className="space-y-2 md:col-span-2">
                <Label>
                  Time Range <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  {/* Start Time */}
                  <div className="space-y-2">
                    <Label htmlFor="start_time" className="text-xs text-muted-foreground text-sm">Start Time
                    </Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="start_time"
                        type="time"
                        value={formData.start_time}
                        onChange={(e) =>
                          setFormData({ ...formData, start_time: e.target.value })
                        }
                        className={cn('pl-10', errors.time_range && 'border-red-500')}
                      />
                    </div>
                  </div>

                  {/* End Time */}
                  <div className="space-y-2">
                    <Label htmlFor="end_time" className="text-xs text-muted-foreground text-sm">End Time
                    </Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="end_time"
                        type="time"
                        value={formData.end_time}
                        onChange={(e) =>
                          setFormData({ ...formData, end_time: e.target.value })
                        }
                        className={cn('pl-10', errors.time_range && 'border-red-500')}
                      />
                    </div>
                  </div>
                </div>
                {errors.time_range && (
                  <p className="text-sm text-red-500">{errors.time_range}</p>
                )}
                <p className="text-xs text-muted-foreground text-sm">Time will be shown in 12-hour format based on your system settings
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="table_type">Table Type</Label>
                <Select
                  value={formData.table_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, table_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TABLE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Special Requests */}
          <div className="space-y-2">
            <Label htmlFor="special_requests">Special Requests</Label>
            <Textarea
              id="special_requests"
              value={formData.special_requests}
              onChange={(e) =>
                setFormData({ ...formData, special_requests: e.target.value })
              }
              placeholder="Any special requirements or notes..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createWaitlistMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createWaitlistMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createWaitlistMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Entry
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
