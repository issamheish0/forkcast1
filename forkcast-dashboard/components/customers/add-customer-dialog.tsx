// components/customers/add-customer-dialog.tsx

'use client'

import { useState } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { 
  UserPlus,
  Mail,
  Phone,
  User,
  Star
} from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CustomerTermsCheckbox } from '@/components/ui/terms-checkbox'
import PhoneInput from 'react-phone-number-input'
import flags from 'react-phone-number-input/flags'
import 'react-phone-number-input/style.css'
import { cn } from '@/lib/utils'

interface AddCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurantId: string
  onSuccess: () => void
}

const customerSchema = z.object({
  guest_name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  guest_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  guest_phone: z.string().optional(),
  notes: z.string().optional(),
  vip_status: z.boolean().default(false).optional(),
  dietary_restrictions: z.string().optional(),
  allergies: z.string().optional(),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: "You must consent to data processing to add this customer",
  }),
})

type CustomerFormData = z.infer<typeof customerSchema>

export function AddCustomerDialog({
  open,
  onOpenChange,
  restaurantId,
  onSuccess
}: AddCustomerDialogProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    control
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      vip_status: false,
      acceptTerms: false
    }
  })

  const onSubmit = async (data: CustomerFormData) => {
    try {
      setLoading(true)

      // Create customer record
      const { data: customer, error: customerError } = await supabase
        .from('restaurant_customers')
        .insert({
          restaurant_id: restaurantId,
          guest_name: data.guest_name,
          guest_email: data.guest_email || null,
          guest_phone: data.guest_phone || null,
          vip_status: data.vip_status,
          first_visit: new Date().toISOString(),
          total_bookings: 0,
          total_spent: 0,
          average_party_size: 0,
          no_show_count: 0,
          cancelled_count: 0
        })
        .select()
        .single()

      if (customerError) throw customerError

      // Add initial note if provided
      if (data.notes?.trim()) {
        const { data: { user } } = await supabase.auth.getUser()
        
        await supabase
          .from('customer_notes')
          .insert({
            customer_id: customer.id,
            note: data.notes.trim(),
            category: 'general',
            is_important: false,
            created_by: user?.id
          })
      }

      // Add dietary information as notes
      if (data.dietary_restrictions?.trim() || data.allergies?.trim()) {
        const { data: { user } } = await supabase.auth.getUser()
        const notes = []

        if (data.dietary_restrictions?.trim()) {
          notes.push({
            customer_id: customer.id,
            note: `Dietary Restrictions: ${data.dietary_restrictions}`,
            category: 'dietary',
            is_important: true,
            created_by: user?.id
          })
        }

        if (data.allergies?.trim()) {
          notes.push({
            customer_id: customer.id,
            note: `Allergies: ${data.allergies}`,
            category: 'dietary',
            is_important: true,
            created_by: user?.id
          })
        }

        if (notes.length > 0) {
          await supabase.from('customer_notes').insert(notes)
        }
      }

      toast.success('Customer added successfully')
      reset()
      onOpenChange(false)
      onSuccess()
    } catch (error: any) {
      console.error('Error adding customer:', error)
      toast.error(error.message || 'Failed to add customer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) reset()
      onOpenChange(open)
    }}>
      <DialogContent 
        className="sm:max-w-[500px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add New Customer
          </DialogTitle>
          <DialogDescription>
            Manually add a customer to your restaurant's database
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-4">
            {/* Name */}
            <div>
              <Label htmlFor="guest_name" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Customer Name *
              </Label>
              <Input
                id="guest_name"
                placeholder="John Doe"
                {...register('guest_name')}
                className={errors.guest_name ? 'border-red-500' : ''}
              />
              {errors.guest_name && (
                <p className="text-sm text-red-500 mt-1">{errors.guest_name.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="guest_email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address
              </Label>
              <Input
                id="guest_email"
                type="email"
                placeholder="john@example.com"
                {...register('guest_email')}
                className={errors.guest_email ? 'border-red-500' : ''}
              />
              {errors.guest_email && (
                <p className="text-sm text-red-500 mt-1">{errors.guest_email.message}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <Label htmlFor="guest_phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Number
              </Label>
              <Controller
                name="guest_phone"
                control={control}
                render={({ field }) => (
                  <PhoneInput
                    international
                    defaultCountry="LB"
                    flags={flags}
                    value={field.value || ""}
                    onChange={(value) => field.onChange(value || "")}
                    placeholder="Enter phone number"
                    className={cn(
                      "PhoneInput",
                      errors.guest_phone && "PhoneInput--error"
                    )}
                    inputComponent={Input}
                  />
                )}
              />
              {errors.guest_phone && (
                <p className="text-sm text-red-500 mt-1">{errors.guest_phone.message}</p>
              )}
            </div>

            {/* VIP Status */}
            <div className="flex items-center justify-between">
              <Label htmlFor="vip_status" className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                VIP Customer
              </Label>
              <Switch
                id="vip_status"
                checked={watch('vip_status')}
                onCheckedChange={(checked) => setValue('vip_status', checked)}
              />
            </div>

            {/* Dietary Restrictions */}
            <div>
              <Label htmlFor="dietary_restrictions">Dietary Restrictions</Label>
              <Input
                id="dietary_restrictions"
                placeholder="e.g., Vegetarian, Gluten-free"
                {...register('dietary_restrictions')}
              />
              <p className="text-xs text-gray-600 mt-1">
                Separate multiple restrictions with commas
              </p>
            </div>

            {/* Allergies */}
            <div>
              <Label htmlFor="allergies">Allergies</Label>
              <Input
                id="allergies"
                placeholder="e.g., Nuts, Shellfish"
                {...register('allergies')}
              />
              <p className="text-xs text-gray-600 mt-1">
                Separate multiple allergies with commas
              </p>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Initial Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional information about this customer..."
                rows={3}
                {...register('notes')}
              />
            </div>

            {/* Terms Acceptance */}
            <div>
              <CustomerTermsCheckbox
                checked={watch('acceptTerms')}
                onCheckedChange={(checked) => setValue('acceptTerms', checked)}
                disabled={loading}
              />
              {errors.acceptTerms && (
                <p className="text-sm text-red-500 mt-1">{errors.acceptTerms.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !watch('acceptTerms')}>
              {loading ? 'Adding...' : 'Add Customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
