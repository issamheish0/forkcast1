// components/customers/customer-bulk-actions.tsx

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  MoreHorizontal, 
  Tag, 
  Star, 
  Download
} from 'lucide-react'
import { toast } from 'sonner'
import type { RestaurantCustomer, CustomerTag } from '@/types/customer'

// Function to determine if a color is light and needs dark text
const isLightColor = (hexColor: string): boolean => {
  // Convert hex to RGB
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  
  // Return true if light (needs dark text)
  return luminance > 0.6
}

interface CustomerBulkActionsProps {
  selectedCustomers: RestaurantCustomer[]
  tags: CustomerTag[]
  onUpdate: () => void
  onClearSelection: () => void
  currentUserId: string
}

export function CustomerBulkActions({
  selectedCustomers,
  tags,
  onUpdate,
  onClearSelection,
  currentUserId
}: CustomerBulkActionsProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // Bulk tag assignment
  const handleBulkTagAssignment = async () => {
    if (selectedTags.length === 0) return

    try {
      setLoading(true)
      
      // Create tag assignments for each customer-tag combination
      const assignments = selectedCustomers.flatMap(customer =>
        selectedTags.map(tagId => ({
          customer_id: customer.id,
          tag_id: tagId,
          assigned_by: currentUserId
        }))
      )

      const { error } = await supabase
        .from('customer_tag_assignments')
        .upsert(assignments, { 
          onConflict: 'customer_id,tag_id',
          ignoreDuplicates: true 
        })

      if (error) throw error

      toast.success(`Tags assigned to ${selectedCustomers.length} customers`)
      setShowTagDialog(false)
      setSelectedTags([])
      onClearSelection()
      onUpdate()
    } catch (error) {
      console.error('Error assigning tags:', error)
      toast.error('Failed to assign tags')
    } finally {
      setLoading(false)
    }
  }

  // Bulk VIP status update
  const handleBulkVIPUpdate = async (vipStatus: boolean) => {
    try {
      setLoading(true)
      
      // Filter out guest customers (customers without user_id) for VIP operations
      const customersWithAccounts = selectedCustomers.filter(customer => customer.user_id)
      const guestCustomers = selectedCustomers.filter(customer => !customer.user_id)
      
      if (guestCustomers.length > 0) {
        toast.error(`${guestCustomers.length} guest customer${guestCustomers.length > 1 ? 's' : ''} cannot be ${vipStatus ? 'marked as VIP' : 'removed from VIP'}. Only registered customers can have VIP status.`)
      }
      
      if (customersWithAccounts.length === 0) {
        setLoading(false)
        return
      }

      // Handle VIP operations for registered customers only
      if (vipStatus) {
        // Adding VIP status - need to handle both restaurant_vip_users and restaurant_customers tables
        const restaurantId = customersWithAccounts[0]?.restaurant_id
        
        if (!restaurantId) {
          throw new Error('Restaurant ID not found')
        }

        // First, delete any existing VIP records to avoid constraint issues
        await supabase
          .from('restaurant_vip_users')
          .delete()
          .eq('restaurant_id', restaurantId)
          .in('user_id', customersWithAccounts.map(c => c.user_id))

        // Insert new VIP records
        const vipRecords = customersWithAccounts.map(customer => ({
          restaurant_id: restaurantId,
          user_id: customer.user_id,
          extended_booking_days: 60,
          priority_booking: true,
          valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year from now
        }))

        const { error: vipInsertError } = await supabase
          .from('restaurant_vip_users')
          .insert(vipRecords)

        if (vipInsertError) throw vipInsertError
      } else {
        // Removing VIP status - delete from restaurant_vip_users table
        const restaurantId = customersWithAccounts[0]?.restaurant_id
        
        if (restaurantId) {
          // For each customer, find and delete their specific VIP record (matching individual logic)
          for (const customer of customersWithAccounts) {
            try {
              // First find the VIP record
              const { data: vipRecord, error: findError } = await supabase
                .from('restaurant_vip_users')
                .select('id')
                .eq('restaurant_id', restaurantId)
                .eq('user_id', customer.user_id)
                .single()

              if (findError && findError.code !== 'PGRST116') { // PGRST116 is "not found"
                console.error('Error finding VIP record for customer:', customer.id, findError)
                // Continue with other customers instead of failing completely
                continue
              }

              // Delete the VIP record if it exists
              if (vipRecord) {
                const { error: deleteError } = await supabase
                  .from('restaurant_vip_users')
                  .delete()
                  .eq('id', vipRecord.id)

                if (deleteError) {
                  console.error('Error deleting VIP record for customer:', customer.id, deleteError)
                  // Continue with other customers instead of failing completely
                  continue
                }
              }
            } catch (error) {
              console.error('Error processing VIP removal for customer:', customer.id, error)
              // Continue with other customers
              continue
            }
          }
        }
      }

      // Update restaurant_customers table for registered customers only
      const { error } = await supabase
        .from('restaurant_customers')
        .update({ 
          vip_status: vipStatus,
          updated_at: new Date().toISOString()
        })
        .in('id', customersWithAccounts.map(c => c.id))

      if (error) throw error

      const successMessage = customersWithAccounts.length > 0 
        ? `${customersWithAccounts.length} registered customer${customersWithAccounts.length > 1 ? 's' : ''} ${vipStatus ? 'marked as' : 'removed from'} VIP`
        : ''

      if (successMessage) {
        toast.success(successMessage)
      }
      
      onClearSelection()
      onUpdate()
    } catch (error) {
      console.error('Error updating VIP status:', error)
      toast.error('Failed to update VIP status')
    } finally {
      setLoading(false)
    }
  }

  // Export selected customers
  const handleExportSelected = () => {
    const headers = ['Name', 'Email', 'Phone', 'Total Bookings', 'Last Visit', 'VIP', 'Tags']
    const rows = selectedCustomers.map((customer:any) => [
      customer.profile?.full_name || customer.guest_name || '',
      customer.profile?.email || customer.guest_email || '',
      customer.profile?.phone_number || customer.guest_phone || '',
      customer.total_bookings,
      customer.last_visit ? new Date(customer.last_visit).toLocaleDateString() : '',
      customer.vip_status ? 'Yes' : 'No',
      customer.tags?.map((t: { name: any }) => t.name).join(', ') || ''
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `selected-customers-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }


  if (selectedCustomers.length === 0) return null

  // Calculate customer type counts for better UX
  const registeredCustomers = selectedCustomers.filter(c => c.user_id)
  const guestCustomers = selectedCustomers.filter(c => !c.user_id)

  return (
    <>
      <div className="flex items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            {selectedCustomers.length} customer{selectedCustomers.length > 1 ? 's' : ''} selected
          </span>
          {guestCustomers.length > 0 && (
            <span className="text-xs text-gray-600">
              {registeredCustomers.length} registered, {guestCustomers.length} guest
            </span>
          )}
        </div>
        
        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSelection}
          >
            Clear Selection
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <MoreHorizontal className="h-4 w-4 mr-2" />
                Bulk Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={() => setShowTagDialog(true)}>
                <Tag className="mr-2 h-4 w-4" />
                Assign Tags
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={() => handleBulkVIPUpdate(true)}
                disabled={registeredCustomers.length === 0}
              >
                <Star className="mr-2 h-4 w-4" />
                Mark as VIP
                {registeredCustomers.length === 0 && (
                  <span className="ml-2 text-xs text-gray-400">(registered only)</span>
                )}
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={() => handleBulkVIPUpdate(false)}
                disabled={registeredCustomers.length === 0}
              >
                <Star className="mr-2 h-4 w-4" />
                Remove VIP Status
                {registeredCustomers.length === 0 && (
                  <span className="ml-2 text-xs text-gray-400">(registered only)</span>
                )}
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={handleExportSelected}>
                <Download className="mr-2 h-4 w-4" />
                Export Selected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tag Assignment Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Tags to Customers</DialogTitle>
            <DialogDescription>
              Select tags to assign to {selectedCustomers.length} selected customers
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              {tags.map(tag => (
                <label
                  key={tag.id}
                  className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-gray-400"
                >
                  <Checkbox
                    checked={selectedTags.includes(tag.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTags([...selectedTags, tag.id])
                      } else {
                        setSelectedTags(selectedTags.filter(id => id !== tag.id))
                      }
                    }}
                  />
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
                    <span className="text-sm text-gray-600">{tag.description}</span>
                  )}
                </label>
              ))}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTagDialog(false)
                setSelectedTags([])
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkTagAssignment}
              disabled={loading || selectedTags.length === 0}
            >
              Assign Tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  )
}
