'use client'

import { useState, useEffect } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Users, 
  Mail, 
  Phone, 
  Calendar,
  AlertTriangle,
  Info
} from 'lucide-react'
import { RestaurantCustomer } from '@/types/customer'
import { 
  validateCustomerMerge,
  mergeCustomers,
  CustomerMergePreview, 
  CustomerMergeOptions,
  CustomerMergeConflict 
} from '@/lib/services/customer-merge'
import { toast } from 'sonner'

interface CustomerMergeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceCustomer: RestaurantCustomer | null
  targetCustomer: RestaurantCustomer | null
  onMergeComplete?: () => void
}

export function CustomerMergeDialog({
  open,
  onOpenChange,
  sourceCustomer,
  targetCustomer,
  onMergeComplete
}: CustomerMergeDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [mergePreview, setMergePreview] = useState<CustomerMergePreview | null>(null)
  const [options, setOptions] = useState<CustomerMergeOptions>({
    mergeBookingHistory: true,
    mergeContactInfo: true,
    mergePreferences: false,
    mergeTags: false,
    mergeNotes: false
  })
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, string>>({})

  // Load merge preview when customers are selected
  useEffect(() => {
    const loadPreview = async () => {
      if (!sourceCustomer || !targetCustomer || !open) return
      
      setIsLoading(true)
      try {
        const preview = await validateCustomerMerge(sourceCustomer.id, targetCustomer.id)
        setMergePreview(preview)
        
        // Initialize conflict resolutions
        const initialResolutions: Record<string, string> = {}
        preview.conflicts.forEach(conflict => {
          initialResolutions[conflict.field] = conflict.resolution === 'source' 
            ? conflict.sourceValue || ''
            : conflict.targetValue || ''
        })
        setConflictResolutions(initialResolutions)
      } catch (error) {
        toast.error('Failed to validate merge')
        console.error('Merge validation error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPreview()
  }, [sourceCustomer, targetCustomer, open])

  const handleMerge = async () => {
    if (!sourceCustomer || !targetCustomer || !mergePreview) return

    setIsLoading(true)
    try {
      await mergeCustomers(sourceCustomer.id, targetCustomer.id, options, conflictResolutions)
      toast.success('Customers merged successfully')
      onMergeComplete?.()
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to merge customers')
      console.error('Merge error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConflictResolution = (field: string, value: string) => {
    setConflictResolutions(prev => ({
      ...prev,
      [field]: value
    }))
  }

  if (!sourceCustomer || !targetCustomer) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Merge Customers
          </DialogTitle>
          <DialogDescription>
            Merge {sourceCustomer.guest_name || sourceCustomer.guest_email} into {targetCustomer.guest_name || targetCustomer.guest_email}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-4 text-center">
            <div className="motion-safe:animate-spin h-6 w-6 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Validating merge...</p>
          </div>
        ) : mergePreview ? (
          <div className="space-y-4">
            {/* Conflicts */}
            {mergePreview.conflicts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    Conflicts to Resolve ({mergePreview.conflicts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {mergePreview.conflicts.map((conflict, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <Label className="text-sm font-medium capitalize">
                        {conflict.field}
                      </Label>
                      <div className="mt-2 grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground text-sm">From {sourceCustomer.guest_name}:
                          </Label>
                          <div className="p-2 bg-muted rounded text-sm">
                            {conflict.sourceValue || 'No value'}
                          </div>
                          <Button
                            variant={conflictResolutions[conflict.field] === conflict.sourceValue ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleConflictResolution(conflict.field, conflict.sourceValue || '')}
                          >
                            Use This
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground text-sm">From {targetCustomer.guest_name}:
                          </Label>
                          <div className="p-2 bg-muted rounded text-sm">
                            {conflict.targetValue || 'No value'}
                          </div>
                          <Button
                            variant={conflictResolutions[conflict.field] === conflict.targetValue ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleConflictResolution(conflict.field, conflict.targetValue || '')}
                          >
                            Use This
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Label className="text-xs text-muted-foreground text-sm">Or enter custom value:
                        </Label>
                        <Input
                          className="mt-1"
                          value={
                            conflictResolutions[conflict.field] !== conflict.sourceValue &&
                            conflictResolutions[conflict.field] !== conflict.targetValue
                              ? conflictResolutions[conflict.field]
                              : ''
                          }
                          onChange={(e) => handleConflictResolution(conflict.field, e.target.value)}
                          placeholder="Enter custom value"
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Merge Options */}
            <Card>
              <CardHeader>
                <CardTitle>Merge Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mergeBookingHistory"
                    checked={options.mergeBookingHistory}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, mergeBookingHistory: checked as boolean }))
                    }
                  />
                  <Label htmlFor="mergeBookingHistory">
                    Merge booking history ({mergePreview.bookingCount} bookings)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mergeContactInfo"
                    checked={options.mergeContactInfo}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, mergeContactInfo: checked as boolean }))
                    }
                  />
                  <Label htmlFor="mergeContactInfo">
                    Merge contact information
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mergePreferences"
                    checked={options.mergePreferences}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, mergePreferences: checked as boolean }))
                    }
                  />
                  <Label htmlFor="mergePreferences">
                    Merge preferences
                  </Label>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                This operation will take approximately {mergePreview.estimatedDuration} and cannot be undone.
                The source customer will be deleted after merging.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="py-4 text-center text-muted-foreground text-sm">No merge preview available
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={isLoading || !mergePreview || mergePreview.conflicts.some(c => !conflictResolutions[c.field])}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading ? 'Merging...' : 'Merge Customers'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
