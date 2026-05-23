// components/customers/edit-customer-dialog.tsx

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { 
  User, 
  Mail, 
  Phone, 
  Users,
  Star,
  AlertCircle,
  Save,
  X,
  Clock,
  Ban,
  Shield
} from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { RestaurantCustomer } from '@/types/customer'

// Define editable fields schema
const editCustomerSchema = z.object({
  guest_name: z.string().optional(),
  guest_email: z.string().email('Invalid email').optional().or(z.literal('')),
  guest_phone: z.string().optional(),
  vip_status: z.boolean(),
  blacklisted: z.boolean(),
  blacklist_reason: z.string().optional(),
  preferred_table_types: z.array(z.string()).optional(),
  preferred_time_slots: z.array(z.string()).optional(),
  // Note: Cannot edit user_id, restaurant_id, total_bookings, 
  // average_party_size, last_visit, first_visit, no_show_count, cancelled_count
  // as these are calculated/system fields
})

type EditCustomerForm = z.infer<typeof editCustomerSchema>

interface EditCustomerDialogProps {
  customer: RestaurantCustomer
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  restaurantId: string
}

const TABLE_TYPES = [
  'booth', 'window', 'patio', 'standard', 'bar', 'private'
]

const TIME_SLOTS = [
  'breakfast', 'brunch', 'lunch', 'afternoon', 'dinner', 'late_night'
]

export function EditCustomerDialog({
  customer,
  open,
  onOpenChange,
  onSuccess,
  restaurantId
}: EditCustomerDialogProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<EditCustomerForm>({
    resolver: zodResolver(editCustomerSchema),
    defaultValues: {
      guest_name: customer.guest_name || '',
      guest_email: customer.guest_email || '',
      guest_phone: customer.guest_phone || '',
      vip_status: customer.vip_status,
      blacklisted: customer.blacklisted,
      blacklist_reason: customer.blacklist_reason || '',
      preferred_table_types: customer.preferred_table_types || [],
      preferred_time_slots: customer.preferred_time_slots || []
    }
  })

  const watchedBlacklisted = watch('blacklisted')
  const watchedVipStatus = watch('vip_status')
  const watchedTableTypes = watch('preferred_table_types')
  const watchedTimeSlots = watch('preferred_time_slots')

  // Reset form when customer changes
  useEffect(() => {
    if (customer) {
      reset({
        guest_name: customer.guest_name || '',
        guest_email: customer.guest_email || '',
        guest_phone: customer.guest_phone || '',
        vip_status: customer.vip_status,
        blacklisted: customer.blacklisted,
        blacklist_reason: customer.blacklist_reason || '',
        preferred_table_types: customer.preferred_table_types || [],
        preferred_time_slots: customer.preferred_time_slots || []
      })
    }
  }, [customer, reset])

  const onSubmit = async (data: EditCustomerForm) => {
    try {
      setLoading(true)

      // Prepare update data
      const updateData: any = {
        updated_at: new Date().toISOString()
      }

      // Only update guest name if this is a guest customer (no user_id)
      if (!customer.user_id) {
        if (data.guest_name !== customer.guest_name) {
          updateData.guest_name = data.guest_name || null
        }
      }
      // Allow phone and email updates for all customer types
      if (data.guest_email !== customer.guest_email) {
        updateData.guest_email = data.guest_email || null
      }
      if (data.guest_phone !== customer.guest_phone) {
        updateData.guest_phone = data.guest_phone || null
      }

      // Only allow VIP status updates for registered users (not guest customers)
      if (data.vip_status !== customer.vip_status) {
        if (!customer.user_id && data.vip_status) {
          throw new Error('Guest customers cannot be assigned VIP status. Customer must have a registered account.')
        }
        updateData.vip_status = data.vip_status
      }
      if (data.blacklisted !== customer.blacklisted) {
        updateData.blacklisted = data.blacklisted
        updateData.blacklist_reason = data.blacklisted ? data.blacklist_reason : null
      }
      if (data.blacklisted && data.blacklist_reason !== customer.blacklist_reason) {
        updateData.blacklist_reason = data.blacklist_reason
      }
      if (JSON.stringify(data.preferred_table_types) !== JSON.stringify(customer.preferred_table_types)) {
        updateData.preferred_table_types = data.preferred_table_types
      }
      if (JSON.stringify(data.preferred_time_slots) !== JSON.stringify(customer.preferred_time_slots)) {
        updateData.preferred_time_slots = data.preferred_time_slots
      }

      // Only update if there are changes
      if (Object.keys(updateData).length > 1) { // > 1 because updated_at is always included
        const { error } = await supabase
          .from('restaurant_customers')
          .update(updateData)
          .eq('id', customer.id)
          .eq('restaurant_id', restaurantId)

        if (error) throw error

        // Handle VIP status in restaurant_vip_users table if needed
        if (data.vip_status !== customer.vip_status && customer.user_id) {
          if (data.vip_status) {
            // Add VIP status
            await supabase
              .from('restaurant_vip_users')
              .insert({
                restaurant_id: restaurantId,
                user_id: customer.user_id,
                extended_booking_days: 60,
                priority_booking: true,
                valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year from now
              })
          } else {
            // Remove VIP status - set valid_until to current date
            await supabase
              .from('restaurant_vip_users')
              .update({ 
                valid_until: new Date().toISOString()
              })
              .eq('restaurant_id', restaurantId)
              .eq('user_id', customer.user_id)
              .gte('valid_until', new Date().toISOString())
          }
        }

        toast.success('Customer updated successfully')
        onSuccess()
        onOpenChange(false)
      } else {
        toast.info('No changes to save')
      }
    } catch (error) {
      console.error('Error updating customer:', error)
      toast.error('Failed to update customer')
    } finally {
      setLoading(false)
    }
  }

  const toggleTableType = (type: string) => {
    const current = watchedTableTypes || []
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type]
    setValue('preferred_table_types', updated)
  }

  const toggleTimeSlot = (slot: string) => {
    const current = watchedTimeSlots || []
    const updated = current.includes(slot)
      ? current.filter(s => s !== slot)
      : [...current, slot]
    setValue('preferred_time_slots', updated)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Edit Customer
          </DialogTitle>
          <DialogDescription>
            Update customer information. Some fields may be restricted based on customer type.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Customer Type Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Customer Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {customer.user_id ? (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Registered User
                  </Badge>
                ) : (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Guest Customer
                  </Badge>
                )}
                {customer.profile?.email && (
                  <Badge variant="secondary">
                    <Mail className="h-3 w-3 mr-1" />
                    {customer.profile.email}
                  </Badge>
                )}
              </div>
              {customer.user_id && (
                <p className="text-xs text-muted-foreground mt-2">
                  Name for registered users is managed in their profile.
                  You can update their contact info, VIP status, blacklist status, and preferences here.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{customer.user_id ? 'Contact Information' : 'Guest Information'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!customer.user_id && (
                <div>
                  <Label htmlFor="guest_name">Guest Name</Label>
                  <Input
                    id="guest_name"
                    {...register('guest_name')}
                    placeholder="Enter guest name"
                  />
                  {errors.guest_name && (
                    <p className="text-sm text-red-500 mt-1">{errors.guest_name.message}</p>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="guest_email">Email</Label>
                <Input
                  id="guest_email"
                  type="email"
                  {...register('guest_email')}
                  placeholder="Enter email"
                />
                {errors.guest_email && (
                  <p className="text-sm text-red-500 mt-1">{errors.guest_email.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="guest_phone">Phone</Label>
                <Input
                  id="guest_phone"
                  {...register('guest_phone')}
                  placeholder="Enter phone number"
                />
                {errors.guest_phone && (
                  <p className="text-sm text-red-500 mt-1">{errors.guest_phone.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Status Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Customer Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="vip_status"
                  checked={watchedVipStatus}
                  disabled={!customer.user_id}
                  onCheckedChange={(checked) => setValue('vip_status', !!checked)}
                />
                <Label 
                  htmlFor="vip_status" 
                  className={`flex items-center gap-2 ${!customer.user_id ? 'text-muted-foreground cursor-not-allowed' : ''}`}
                >
                  <Star className="h-4 w-4 text-yellow-500" />
                  VIP Customer
                </Label>
              </div>
              {!customer.user_id && (
                <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded-md">
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  Guest customers cannot be assigned VIP status. Customer must have a registered account.
                </p>
              )}
              {watchedVipStatus && customer.user_id && (
                <p className="text-xs text-muted-foreground text-sm">VIP customers get priority booking and extended booking windows.
                </p>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="blacklisted"
                  checked={watchedBlacklisted}
                  onCheckedChange={(checked) => setValue('blacklisted', !!checked)}
                />
                <Label htmlFor="blacklisted" className="flex items-center gap-2">
                  <Ban className="h-4 w-4 text-red-500" />
                  Blacklisted
                </Label>
              </div>

              {watchedBlacklisted && (
                <div>
                  <Label htmlFor="blacklist_reason">Blacklist Reason</Label>
                  <Textarea
                    id="blacklist_reason"
                    {...register('blacklist_reason')}
                    placeholder="Enter reason for blacklisting..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground text-sm">
                    Blacklisted customers cannot make new bookings.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Customer Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Preferred Table Types</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {TABLE_TYPES.map((type) => (
                    <div
                      key={type}
                      onClick={() => toggleTableType(type)}
                      className={`p-2 border rounded-md cursor-pointer text-center text-sm transition-colors ${
                        (watchedTableTypes || []).includes(type)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-muted'
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Preferred Time Slots</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {TIME_SLOTS.map((slot) => (
                    <div
                      key={slot}
                      onClick={() => toggleTimeSlot(slot)}
                      className={`p-2 border rounded-md cursor-pointer text-center text-sm transition-colors ${
                        (watchedTimeSlots || []).includes(slot)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-muted'
                      }`}
                    >
                      {slot.split('_').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ')}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Read-only Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Read-Only Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Bookings:</span>
                  <span className="ml-2 font-medium">{customer.total_bookings}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Completed:</span>
                  <span className="ml-2 font-medium text-green-600">{customer.profile?.completed_bookings || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Cancelled:</span>
                  <span className="ml-2 font-medium text-orange-600">{customer.profile?.cancelled_bookings || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">No Shows:</span>
                  <span className="ml-2 font-medium text-red-600">{customer.profile?.no_show_bookings || 0}</span>
                </div>
                {customer.profile?.user_rating && customer.profile.user_rating !== 5.0 && (
                  <div>
                    <span className="text-muted-foreground">Rating:</span>
                    <span className="ml-2 font-medium">{customer.profile.user_rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                These values are automatically calculated and cannot be edited.
              </p>
            </CardContent>
          </Card>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
