'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { findPotentialDuplicates } from '@/lib/services/customer-merge'
import { RestaurantCustomer } from '@/types/customer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AlertTriangle, Users, Merge, RefreshCw } from 'lucide-react'
import { CustomerMergeDialog } from './customer-merge-dialog'

interface DuplicateDetectorProps {
  restaurantId: string
  onCustomersUpdated: () => void
}

export function DuplicateDetector({ restaurantId, onCustomersUpdated }: DuplicateDetectorProps) {
  const [duplicates, setDuplicates] = useState<RestaurantCustomer[]>([])
  const [loading, setLoading] = useState(false)
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [selectedCustomers, setSelectedCustomers] = useState<{
    source: RestaurantCustomer | null
    target: RestaurantCustomer | null
  }>({ source: null, target: null })

  const loadDuplicates = async () => {
    setLoading(true)
    try {
      const duplicateCustomers = await findPotentialDuplicates(restaurantId)
      setDuplicates(duplicateCustomers)
    } catch (error) {
      console.error('Error loading duplicates:', error)
      toast.error('Failed to load duplicate customers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDuplicates()
  }, [restaurantId])

  const handleMergeCustomers = (customer: RestaurantCustomer) => {
    // For simplicity, we'll let the user manually select which customer to merge into
    setSelectedCustomers({ source: customer, target: null })
    setMergeDialogOpen(true)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-4 w-4 motion-safe:animate-spin mr-2" />
            <span>Scanning for duplicates...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (duplicates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Duplicate Detection
          </CardTitle>
          <CardDescription>
            No duplicate customers detected
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="text-green-600 mb-2">
              ✓ All customers appear to be unique
            </div>
            <Button variant="outline" onClick={loadDuplicates}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Scan Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Duplicate Customers Detected
          </CardTitle>
          <CardDescription>
            Found {duplicates.length} potential duplicate customers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {duplicates.map((customer) => (
            <div key={customer.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {customer.guest_name?.charAt(0) || customer.guest_email?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">
                    {customer.guest_name || 'Unknown Name'}
                  </div>
                  <div className="text-sm text-muted-foreground text-sm">{customer.guest_email || customer.guest_phone || 'No contact info'}
                  </div>
                  <div className="text-xs text-muted-foreground text-sm">{customer.total_bookings} bookings
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-amber-600">
                  Potential Duplicate
                </Badge>
                <Button 
                  size="sm" 
                  onClick={() => handleMergeCustomers(customer)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Merge className="h-3 w-3 mr-1" />
                  Merge
                </Button>
              </div>
            </div>
          ))}
          
          <div className="pt-4 border-t">
            <Button variant="outline" onClick={loadDuplicates} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Scan
            </Button>
          </div>
        </CardContent>
      </Card>

      <CustomerMergeDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        sourceCustomer={selectedCustomers.source}
        targetCustomer={selectedCustomers.target}
        onMergeComplete={() => {
          loadDuplicates()
          onCustomersUpdated()
        }}
      />
    </>
  )
}
