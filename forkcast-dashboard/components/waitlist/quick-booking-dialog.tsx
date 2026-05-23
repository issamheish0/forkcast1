// components/waitlist/quick-booking-dialog.tsx

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { 
  Calendar,
  Clock,
  Users,
  Check,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { formatTimeRange } from '@/lib/utils/time-utils'
import type { WaitlistEntry } from '@/types'

interface Table {
  id: string
  name: string
  capacity: number
  table_type: string
  position_x: number
  position_y: number
  is_available: boolean
}

interface QuickBookingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  waitlistEntry: WaitlistEntry
  onBookingCreated?: (bookingId: string) => void
}

export function QuickBookingDialog({
  open,
  onOpenChange,
  waitlistEntry,
  onBookingCreated
}: QuickBookingDialogProps) {
  const supabase = createClient()
  const [availableTables, setAvailableTables] = useState<Table[]>([])
  const [selectedTableId, setSelectedTableId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)
  const [restaurantId, setRestaurantId] = useState<string>('')

  // Get restaurant ID
  useEffect(() => {
    async function getRestaurantId() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: staffData } = await supabase
          .from("restaurant_staff")
          .select("restaurant_id")
          .eq("user_id", user.id)
          .single()
        
        if (staffData) {
          setRestaurantId(staffData.restaurant_id)
        }
      }
    }
    if (open) {
      getRestaurantId()
    }
  }, [open, supabase])

  const checkTableAvailability = useCallback(async () => {
    setIsCheckingAvailability(true)
    try {
      // First try: exact fit tables (min <= partySize <= max)
      let { data: tables, error: tablesError } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .lte('min_capacity', waitlistEntry.party_size)
        .gte('max_capacity', waitlistEntry.party_size)
        .eq('is_active', true)

      // Fallback: if no exact fit, find tables where party < min but can still fit
      if (!tables || tables.length === 0) {
        const { data: fallbackTables, error: fallbackError } = await supabase
          .from('restaurant_tables')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .gt('min_capacity', waitlistEntry.party_size)
          .gte('max_capacity', waitlistEntry.party_size)
          .eq('is_active', true)
          .order('min_capacity', { ascending: true })
        
        tables = fallbackTables
        tablesError = fallbackError
      }

      if (tablesError) throw tablesError

      if (tablesError) throw tablesError

      if (!tables || tables.length === 0) {
        toast.error('No suitable tables found for this party size')
        setAvailableTables([])
        return
      }

      // Filter by table type if specified
      let filteredTables = tables
      if (waitlistEntry.table_type !== 'any') {
        filteredTables = tables.filter(table => table.table_type === waitlistEntry.table_type)
      }

      // Check availability for the desired time slot
      const { data: conflictingBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          booking_tables!inner(table_id)
        `)
        .eq('date', waitlistEntry.desired_date)
        .eq('status', 'confirmed')
        .overlaps('time_range', waitlistEntry.desired_time_range)

      if (bookingsError) throw bookingsError

      // Get list of occupied table IDs
      const occupiedTableIds = new Set(
        conflictingBookings?.flatMap(booking => 
          booking.booking_tables.map(bt => bt.table_id)
        ) || []
      )

      // Mark tables as available or not
      const tablesWithAvailability = filteredTables.map(table => ({
        ...table,
        is_available: !occupiedTableIds.has(table.id)
      }))

      setAvailableTables(tablesWithAvailability)

      // Auto-select first available table
      const firstAvailable = tablesWithAvailability.find(t => t.is_available)
      if (firstAvailable) {
        setSelectedTableId(firstAvailable.id)
      }

    } catch (error) {
      console.error('Error checking availability:', error)
      toast.error('Failed to check table availability')
    } finally {
      setIsCheckingAvailability(false)
    }
  }, [restaurantId, waitlistEntry, supabase])

  // Check table availability when dialog opens
  useEffect(() => {
    if (open && restaurantId) {
      checkTableAvailability()
    }
  }, [open, restaurantId, checkTableAvailability])

  const handleCreateBooking = async () => {
    if (!selectedTableId) {
      toast.error('Please select a table')
      return
    }

    setIsLoading(true)
    try {
      // Create the booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          user_id: waitlistEntry.user_id,
          restaurant_id: restaurantId,
          date: waitlistEntry.desired_date,
          time_range: waitlistEntry.desired_time_range,
          party_size: waitlistEntry.party_size,
          status: 'confirmed',
          booking_type: 'regular',
          notes: notes || `Created from waitlist entry on ${format(new Date(), 'MMM dd, yyyy')}`,
          created_from_waitlist: true,
          waitlist_entry_id: waitlistEntry.id,
          source:'manual'
        })
        .select()
        .single()

      if (bookingError) throw bookingError

      // Assign the table to the booking
      const { error: tableAssignError } = await supabase
        .from('booking_tables')
        .insert({
          booking_id: booking.id,
          table_id: selectedTableId
        })

      if (tableAssignError) throw tableAssignError

      // Update waitlist status to 'booked'
      const { error: waitlistUpdateError } = await supabase
        .from('waitlist')
        .update({ status: 'booked' })
        .eq('id', waitlistEntry.id)

      if (waitlistUpdateError) throw waitlistUpdateError

      // Create status history entry
      await supabase
        .from('booking_status_history')
        .insert({
          booking_id: booking.id,
          old_status: null,
          new_status: 'confirmed',
          changed_by: (await supabase.auth.getUser()).data.user?.id,
          change_reason: 'Booking created from waitlist'
        })

      toast.success('Booking created successfully!')
      onBookingCreated?.(booking.id)
      
    } catch (error) {
      console.error('Error creating booking:', error)
      toast.error('Failed to create booking')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Quick Booking</DialogTitle>
          <DialogDescription>
            Create a booking for {waitlistEntry.user?.full_name || 'Guest'} from waitlist
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Booking Details Summary */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Booking Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                  {format(parseISO(waitlistEntry.desired_date), 'EEEE, MMM dd, yyyy')}
                </div>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                  {formatTimeRange(waitlistEntry.desired_time_range)}
                </div>
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                  {waitlistEntry.party_size} {waitlistEntry.party_size === 1 ? 'guest' : 'guests'}
                </div>
                <div className="flex items-center">
                  <span className="text-muted-foreground mr-2">Preference:</span>
                  {waitlistEntry.table_type}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table Selection */}
          <div className="space-y-3">
            <h3 className="font-semibold">Select Table</h3>
            
            {isCheckingAvailability ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 motion-safe:animate-spin mr-2" />
                <span>Checking table availability...</span>
              </div>
            ) : availableTables.length === 0 ? (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                    <span className="text-yellow-800">
                      No suitable tables available for the requested time slot
                    </span>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Select value={selectedTableId} onValueChange={setSelectedTableId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a table" />
                </SelectTrigger>
                <SelectContent>
                  {availableTables.map((table) => (
                    <SelectItem 
                      key={table.id} 
                      value={table.id}
                      disabled={!table.is_available}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>
                          {table.name} (Seats {table.capacity})
                        </span>
                        {table.is_available ? (
                          <Badge variant="outline" className="ml-2 text-green-600 border-green-600">
                            <Check className="h-3 w-3 mr-1" />
                            Available
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="ml-2 text-red-600 border-red-600">
                            Occupied
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Additional Notes */}
          <div className="space-y-3">
            <label className="font-semibold">Additional Notes</label>
            <Textarea
              placeholder="Any special requests or notes for this booking..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateBooking}
            disabled={isLoading || !selectedTableId || isCheckingAvailability}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 motion-safe:animate-spin" />
                Creating...
              </>
            ) : (
              'Create Booking'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
