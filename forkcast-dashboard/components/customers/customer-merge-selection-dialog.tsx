'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Users, AlertTriangle, Star, Ban, Search, ChevronsUpDown, Check, Smartphone, UserPlus, Mail, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { RestaurantCustomer } from '@/types/customer'
import { mergeCustomers } from '@/app/(dashboard)/customers/actions'
import { cn } from '@/lib/utils'

interface CustomerMergeSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  primaryCustomer: RestaurantCustomer | null
  restaurantId: string
  onSuccess: () => void
}

export default function CustomerMergeSelectionDialog({
  open,
  onOpenChange,
  primaryCustomer,
  restaurantId,
  onSuccess,
}: CustomerMergeSelectionDialogProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [eligibleCustomers, setEligibleCustomers] = useState<RestaurantCustomer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [merging, setMerging] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [chosenEmail, setChosenEmail] = useState<string>('')
  const [chosenPhone, setChosenPhone] = useState<string>('')

  // Load eligible customers for merging
  useEffect(() => {
    if (open && primaryCustomer && restaurantId) {
      loadEligibleCustomers()
      setSelectedCustomerId('')
      setSearchQuery('')
      setChosenEmail('')
      setChosenPhone('')
    }
  }, [open, primaryCustomer, restaurantId])

  const loadEligibleCustomers = async () => {
    try {
      setLoading(true)

      if (!primaryCustomer) return

      // Get all customers from the same restaurant
      const { data: customersData, error: customersError } = await supabase
        .from('restaurant_customers')
        .select(`
          *,
          profile:profiles!restaurant_customers_user_id_fkey(
            id,
            full_name,
            email,
            phone_number,
            avatar_url
          )
        `)
        .eq('restaurant_id', restaurantId)
        .neq('id', primaryCustomer.id) // Exclude the primary customer

      if (customersError) throw customersError

      // Filter customers that can be merged:
      // 1. At least one must be a guest (user_id is null)
      // 2. Cannot merge two registered users
      const eligible = customersData?.filter(customer => {
        const primaryIsGuest = !primaryCustomer.user_id
        const customerIsGuest = !customer.user_id
        
        // At least one must be a guest
        return primaryIsGuest || customerIsGuest
      }) || []

      // Transform the data
      const transformedData = eligible.map(customer => ({
        ...customer,
        tags: [], // We'll load tags separately if needed
      }))

      setEligibleCustomers(transformedData)
    } catch (error) {
      console.error('Error loading eligible customers:', error)
      toast.error('Failed to load customers for merging')
    } finally {
      setLoading(false)
    }
  }

  const handleMerge = async () => {
    if (!primaryCustomer || !selectedCustomerId) return

    try {
      setMerging(true)

      const selectedCustomer = eligibleCustomers.find(c => c.id === selectedCustomerId)
      if (!selectedCustomer) {
        toast.error('Selected customer not found')
        return
      }

      // Determine which customer should be the target (keep registered user if available)
      const targetCustomer = primaryCustomer.user_id ? primaryCustomer : selectedCustomer
      const sourceCustomer = primaryCustomer.user_id ? selectedCustomer : primaryCustomer

      // Validate merge rules
      if (targetCustomer.user_id && sourceCustomer.user_id) {
        toast.error('Cannot merge two registered users')
        return
      }

      // Use server action instead of API route
      const contactOverrides: { guest_email?: string; guest_phone?: string } = {}
      if (chosenEmail) contactOverrides.guest_email = chosenEmail
      if (chosenPhone) contactOverrides.guest_phone = chosenPhone

      const result = await mergeCustomers(
        targetCustomer.id,
        sourceCustomer.id,
        restaurantId,
        Object.keys(contactOverrides).length > 0 ? contactOverrides : undefined
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to merge customers')
      }

      toast.success('Customers merged successfully')
      onSuccess()
      onOpenChange(false)
      
    } catch (error) {
      console.error('Error merging customers:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to merge customers')
    } finally {
      setMerging(false)
    }
  }

  const selectedCustomer = eligibleCustomers.find(c => c.id === selectedCustomerId)

  const getCustomerDisplayName = (customer: RestaurantCustomer) => {
    return customer.profile?.full_name || customer.guest_name || 'Unknown'
  }

  const getCustomerEmail = (customer: RestaurantCustomer) => {
    return customer.profile?.email || customer.guest_email || ''
  }

  const getCustomerPhone = (customer: RestaurantCustomer) => {
    return customer.profile?.phone_number || customer.guest_phone || ''
  }

  // Determine if there are conflicting emails/phones between the two customers
  const primaryEmail = primaryCustomer ? getCustomerEmail(primaryCustomer) : ''
  const primaryPhone = primaryCustomer ? getCustomerPhone(primaryCustomer) : ''
  const secondaryEmail = selectedCustomer ? getCustomerEmail(selectedCustomer) : ''
  const secondaryPhone = selectedCustomer ? getCustomerPhone(selectedCustomer) : ''

  const hasEmailConflict = !!(primaryEmail && secondaryEmail && primaryEmail !== secondaryEmail)
  const hasPhoneConflict = !!(primaryPhone && secondaryPhone && primaryPhone !== secondaryPhone)

  // Auto-select when there's no conflict or only one has a value
  useEffect(() => {
    if (!selectedCustomer || !primaryCustomer) return
    
    // Email: auto-pick if no conflict
    if (!hasEmailConflict) {
      setChosenEmail(primaryEmail || secondaryEmail)
    } else {
      // Default to primary's email, user can change
      setChosenEmail(primaryEmail)
    }
    
    // Phone: auto-pick if no conflict
    if (!hasPhoneConflict) {
      setChosenPhone(primaryPhone || secondaryPhone)
    } else {
      // Default to primary's phone, user can change
      setChosenPhone(primaryPhone)
    }
  }, [selectedCustomerId])

  // Source indicator helper
  const getCustomerSource = (customer: RestaurantCustomer): { isApp: boolean; label: string } => {
    // If customer has a user_id, they registered via the app
    if (customer.user_id) {
      return { isApp: true, label: 'App User' }
    }
    // Guest customers are manually added by staff
    return { isApp: false, label: 'Manual' }
  }

  // Filter customers based on search query
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return eligibleCustomers
    
    const query = searchQuery.toLowerCase()
    return eligibleCustomers.filter(customer => {
      const name = getCustomerDisplayName(customer).toLowerCase()
      const email = getCustomerEmail(customer).toLowerCase()
      const phone = getCustomerPhone(customer).toLowerCase()
      return name.includes(query) || email.includes(query) || phone.includes(query)
    })
  }, [eligibleCustomers, searchQuery])

  const canMerge = primaryCustomer && selectedCustomer && 
    (!primaryCustomer.user_id || !selectedCustomer.user_id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Merge Customers
          </DialogTitle>
          <DialogDescription>
            Merge customer records to consolidate their booking history and information.
            You can only merge guest customers (those without accounts) with other customers.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 motion-safe:animate-spin" />
            <span className="ml-2">Loading customers...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Primary Customer Info */}
            {primaryCustomer && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">Primary Customer</h3>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Avatar>
                    <AvatarImage src={primaryCustomer.profile?.avatar_url} />
                    <AvatarFallback>
                      {getCustomerDisplayName(primaryCustomer)
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">
                        {getCustomerDisplayName(primaryCustomer)}
                      </p>
                      {primaryCustomer.user_id ? (
                        <Badge variant="default">Registered</Badge>
                      ) : (
                        <Badge variant="secondary">Guest</Badge>
                      )}
                      {/* Source indicator */}
                      {(() => {
                        const source = getCustomerSource(primaryCustomer)
                        return (
                          <Badge variant="outline" className={cn(
                            "text-xs",
                            source.isApp 
                              ? "text-blue-600 border-blue-300 bg-blue-50" 
                              : "text-gray-600 border-gray-300 bg-gray-50"
                          )}>
                            {source.isApp ? (
                              <Smartphone className="h-3 w-3 mr-1" />
                            ) : (
                              <UserPlus className="h-3 w-3 mr-1" />
                            )}
                            {source.label}
                          </Badge>
                        )
                      })()}
                      {primaryCustomer.vip_status && (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                          <Star className="h-3 w-3 mr-1" />
                          VIP
                        </Badge>
                      )}
                      {primaryCustomer.blacklisted && (
                        <Badge variant="destructive">
                          <Ban className="h-3 w-3 mr-1" />
                          Blacklisted
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {getCustomerEmail(primaryCustomer)} • {getCustomerPhone(primaryCustomer)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {primaryCustomer.total_bookings} bookings
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Customer Selection - Searchable */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Select Customer to Merge With</h3>
              {eligibleCustomers.length === 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No eligible customers found for merging. You can only merge guest customers 
                    (those without accounts) with other customers.
                  </AlertDescription>
                </Alert>
              ) : (
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={popoverOpen}
                      className="w-full justify-between h-auto min-h-10 py-2"
                    >
                      {selectedCustomer ? (
                        <div className="flex items-center gap-2 text-left">
                          <span className="font-medium truncate">
                            {getCustomerDisplayName(selectedCustomer)}
                          </span>
                          {selectedCustomer.user_id ? (
                            <Badge variant="default" className="text-xs">Registered</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Guest</Badge>
                          )}
                          <span className="text-sm text-gray-500">
                            • {selectedCustomer.total_bookings} bookings
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Search and select a customer...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[500px] p-0" align="start">
                    <div className="p-2 border-b">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search by name, email, or phone..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <ScrollArea className="h-[300px]">
                      {filteredCustomers.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">
                          No customers found matching "{searchQuery}"
                        </div>
                      ) : (
                        <div className="p-1">
                          {filteredCustomers.map((customer) => {
                            const source = getCustomerSource(customer)
                            return (
                              <button
                                key={customer.id}
                                onClick={() => {
                                  setSelectedCustomerId(customer.id)
                                  setPopoverOpen(false)
                                  setSearchQuery('')
                                }}
                                className={cn(
                                  "w-full flex items-center gap-3 p-3 rounded-md text-left transition-colors",
                                  "hover:bg-gray-100",
                                  selectedCustomerId === customer.id && "bg-gray-100"
                                )}
                              >
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={customer.profile?.avatar_url} />
                                  <AvatarFallback className="text-xs">
                                    {getCustomerDisplayName(customer)
                                      .split(' ')
                                      .map(n => n[0])
                                      .join('')
                                      .toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm truncate">
                                      {getCustomerDisplayName(customer)}
                                    </span>
                                    {customer.user_id ? (
                                      <Badge variant="default" className="text-xs">Registered</Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-xs">Guest</Badge>
                                    )}
                                    <Badge variant="outline" className={cn(
                                      "text-xs",
                                      source.isApp 
                                        ? "text-blue-600 border-blue-300" 
                                        : "text-gray-600 border-gray-300"
                                    )}>
                                      {source.isApp ? (
                                        <Smartphone className="h-2.5 w-2.5 mr-1" />
                                      ) : (
                                        <UserPlus className="h-2.5 w-2.5 mr-1" />
                                      )}
                                      {source.label}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-gray-500 truncate">
                                    {getCustomerEmail(customer) || getCustomerPhone(customer) || 'No contact info'}
                                    {' • '}{customer.total_bookings} bookings
                                  </p>
                                </div>
                                {selectedCustomerId === customer.id && (
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Selected Customer Preview */}
            {selectedCustomer && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">Selected Customer</h3>
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <Avatar>
                    <AvatarImage src={selectedCustomer.profile?.avatar_url} />
                    <AvatarFallback>
                      {getCustomerDisplayName(selectedCustomer)
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">
                        {getCustomerDisplayName(selectedCustomer)}
                      </p>
                      {selectedCustomer.user_id ? (
                        <Badge variant="default">Registered</Badge>
                      ) : (
                        <Badge variant="secondary">Guest</Badge>
                      )}
                      {/* Source indicator */}
                      {(() => {
                        const source = getCustomerSource(selectedCustomer)
                        return (
                          <Badge variant="outline" className={cn(
                            "text-xs",
                            source.isApp 
                              ? "text-blue-600 border-blue-300 bg-blue-50" 
                              : "text-gray-600 border-gray-300 bg-gray-50"
                          )}>
                            {source.isApp ? (
                              <Smartphone className="h-3 w-3 mr-1" />
                            ) : (
                              <UserPlus className="h-3 w-3 mr-1" />
                            )}
                            {source.label}
                          </Badge>
                        )
                      })()}
                      {selectedCustomer.vip_status && (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                          <Star className="h-3 w-3 mr-1" />
                          VIP
                        </Badge>
                      )}
                      {selectedCustomer.blacklisted && (
                        <Badge variant="destructive">
                          <Ban className="h-3 w-3 mr-1" />
                          Blacklisted
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {getCustomerEmail(selectedCustomer)} • {getCustomerPhone(selectedCustomer)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedCustomer.total_bookings} bookings
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Contact Info Selection - show when there are conflicts */}
            {selectedCustomer && (hasEmailConflict || hasPhoneConflict) && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700">Choose Contact Info to Keep</h3>
                <div className="rounded-lg border p-3 space-y-3">
                  {hasEmailConflict && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" /> Email
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setChosenEmail(primaryEmail)}
                          className={cn(
                            "text-left p-2 rounded-md border text-sm transition-colors",
                            chosenEmail === primaryEmail
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "hover:bg-gray-50"
                          )}
                        >
                          <p className="text-xs text-muted-foreground mb-0.5">{getCustomerDisplayName(primaryCustomer!)}</p>
                          <p className="font-medium truncate">{primaryEmail}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setChosenEmail(secondaryEmail)}
                          className={cn(
                            "text-left p-2 rounded-md border text-sm transition-colors",
                            chosenEmail === secondaryEmail
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "hover:bg-gray-50"
                          )}
                        >
                          <p className="text-xs text-muted-foreground mb-0.5">{getCustomerDisplayName(selectedCustomer)}</p>
                          <p className="font-medium truncate">{secondaryEmail}</p>
                        </button>
                      </div>
                    </div>
                  )}
                  {hasPhoneConflict && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" /> Phone Number
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setChosenPhone(primaryPhone)}
                          className={cn(
                            "text-left p-2 rounded-md border text-sm transition-colors",
                            chosenPhone === primaryPhone
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "hover:bg-gray-50"
                          )}
                        >
                          <p className="text-xs text-muted-foreground mb-0.5">{getCustomerDisplayName(primaryCustomer!)}</p>
                          <p className="font-medium truncate">{primaryPhone}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setChosenPhone(secondaryPhone)}
                          className={cn(
                            "text-left p-2 rounded-md border text-sm transition-colors",
                            chosenPhone === secondaryPhone
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "hover:bg-gray-50"
                          )}
                        >
                          <p className="text-xs text-muted-foreground mb-0.5">{getCustomerDisplayName(selectedCustomer)}</p>
                          <p className="font-medium truncate">{secondaryPhone}</p>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Merge Preview */}
            {canMerge && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Merge Result:</strong> The guest customer's data will be merged into the 
                  {primaryCustomer?.user_id ? ' registered' : selectedCustomer?.user_id ? ' registered' : ''} customer's 
                  record. Booking counts, spending totals, and other metrics will be combined. This action cannot be undone.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={merging}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleMerge}
            disabled={!canMerge || merging}
          >
            {merging ? (
              <>
                <Loader2 className="h-4 w-4 motion-safe:animate-spin mr-2" />
                Merging...
              </>
            ) : (
              'Merge Customers'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
