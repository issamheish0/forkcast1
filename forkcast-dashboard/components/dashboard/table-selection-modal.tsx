// components/dashboard/table-selection-modal.tsx
"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Table2, 
  Users, 
  Clock, 
  CheckCircle, 
  X, 
  AlertTriangle,
  MapPin
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format, addMinutes } from "date-fns"
import { getTableAssignmentWarnings, sortWarnings, type BookingWarning } from "@/lib/booking-warnings"
import { BookingWarningsDialog } from "@/components/bookings/booking-warnings-dialog"

interface TableSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  booking: any
  allTables: any[]
  allBookings: any[]
  onConfirmSelection: (tableIds: string[]) => void
  isProcessing: boolean
}

export function TableSelectionModal({
  isOpen,
  onClose,
  booking,
  allTables,
  allBookings,
  onConfirmSelection,
  isProcessing
}: TableSelectionModalProps) {
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([])
  const [assignWarnings, setAssignWarnings] = useState<{
    isOpen: boolean
    warnings: BookingWarning[]
    isChecking: boolean
  }>({
    isOpen: false,
    warnings: [],
    isChecking: false
  })

  const bookingTime = useMemo(() => booking ? new Date(booking.booking_time) : null, [booking])
  const bookingEndTime = useMemo(() => 
    bookingTime ? addMinutes(bookingTime, booking?.turn_time_minutes || 120) : null, 
    [bookingTime, booking?.turn_time_minutes]
  )

  // Calculate table availability and status
  const tablesWithStatus = useMemo(() => {
    if (!booking || !bookingTime || !bookingEndTime) return []
    return allTables.map(table => {
      // Check if table is occupied during the request time
      const conflictingBooking = allBookings.find(existingBooking => {
        if (existingBooking.id === booking.id) return false // Skip self
        if (!existingBooking.tables || existingBooking.tables.length === 0) return false
        if (!existingBooking.tables.some((t: any) => t.id === table.id)) return false
        
        const existingBookingTime = new Date(existingBooking.booking_time)
        const existingBookingEndTime = addMinutes(existingBookingTime, existingBooking.turn_time_minutes || 120)
        
        // Check for time overlap
        return (bookingTime < existingBookingEndTime && bookingEndTime > existingBookingTime)
      })
      
      // Check if table is currently occupied
      const currentlyOccupied = allBookings.find(existingBooking => {
        const occupiedStatuses = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment']
        return occupiedStatuses.includes(existingBooking.status) && 
               existingBooking.tables?.some((t: any) => t.id === table.id)
      })
      
      return {
        ...table,
        isAvailable: !conflictingBooking && !currentlyOccupied,
        conflictingBooking,
        currentlyOccupied,
        canBeSelected: !conflictingBooking && !currentlyOccupied
      }
    })
  }, [allTables, allBookings, booking?.id, bookingTime, bookingEndTime])

  // Group tables by section
  const tablesBySection = useMemo(() => {
    const sections: Record<string, any[]> = {}
    tablesWithStatus.forEach(table => {
      const sectionName = table.section?.name || 'No Section'
      if (!sections[sectionName]) {
        sections[sectionName] = []
      }
      sections[sectionName].push(table)
    })
    
    // Sort tables within each section by table number
    Object.keys(sections).forEach(sectionName => {
      sections[sectionName].sort((a, b) => a.table_number - b.table_number)
    })
    
    return sections
  }, [tablesWithStatus])

  // Calculate selected capacity
  const selectedCapacity = useMemo(() => {
    return selectedTableIds.reduce((total, tableId) => {
      const table = tablesWithStatus.find(t => t.id === tableId)
      return total + (table?.capacity || 0)
    }, 0)
  }, [selectedTableIds, tablesWithStatus])

  const handleTableToggle = (tableId: string) => {
    setSelectedTableIds(prev => {
      if (prev.includes(tableId)) {
        return prev.filter(id => id !== tableId)
      } else {
        return [...prev, tableId]
      }
    })
  }

  const handleConfirm = async () => {
    // Check for warnings before confirming table assignment
    setAssignWarnings(prev => ({ ...prev, isChecking: true }))
    try {
      const warnings = await getTableAssignmentWarnings(
        booking,
        selectedTableIds,
        booking.restaurant_id,
        allTables
      )
      if (warnings.length > 0) {
        setAssignWarnings({
          isOpen: true,
          warnings: sortWarnings(warnings),
          isChecking: false
        })
        return // Wait for user decision in warning dialog
      }
    } catch {
      // Non-blocking: proceed on error
    }
    setAssignWarnings(prev => ({ ...prev, isChecking: false }))
    onConfirmSelection(selectedTableIds)
    setSelectedTableIds([])
  }

  const handleCancel = () => {
    onClose()
    setSelectedTableIds([])
  }

  const availableTablesCount = tablesWithStatus.filter(t => t.canBeSelected).length
  const suitableTablesCount = tablesWithStatus.filter(t => t.canBeSelected && t.capacity >= (booking?.party_size || 0)).length

  if (!booking) return null

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-4xl w-[95vw] tablet:w-[90vw] max-h-[95vh] h-auto p-0 overflow-auto flex flex-col">
        <DialogHeader className="p-4 pb-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Table2 className="h-5 w-5" />
            Select Tables for Booking
          </DialogTitle>
          <DialogDescription className="text-sm">
            Booking details for table assignment
          </DialogDescription>
          <div className="flex items-center gap-4 text-sm mt-2">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {booking.party_size} guests
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {bookingTime && format(bookingTime, 'MMM d, h:mm a')}
            </span>
          </div>
          <div className="text-xs text-gray-600 mt-2">
            Guest: <span className="font-medium">{booking.guest_name || booking.user?.full_name || 'Anonymous'}</span>
          </div>
        </DialogHeader>

        {/* Status Bar */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>{availableTablesCount} available</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>{suitableTablesCount} suitable</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4 text-gray-600" />
                <span>Selected capacity: {selectedCapacity}</span>
              </div>
            </div>
            {selectedCapacity < booking.party_size && selectedTableIds.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                Need {booking.party_size - selectedCapacity} more seats
              </Badge>
            )}
            {selectedCapacity >= booking.party_size && selectedTableIds.length > 0 && (
              <Badge variant="default" className="bg-green-600 text-xs">
                Sufficient capacity
              </Badge>
            )}
          </div>
        </div>

        {/* No tables warning */}
        {availableTablesCount === 0 && (
          <div className="px-4 pb-4">
            <Alert className="border-red-300 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-red-800">
                No tables are available for the requested time slot. All tables are either occupied or already booked.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Table Selection */}
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 pb-6">
            {Object.entries(tablesBySection).map(([sectionName, tables]) => (
              <div key={sectionName} className="space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-900">{sectionName}</h3>
                  <Badge variant="outline" className="text-xs">
                    {tables.filter(t => t.canBeSelected).length} available
                  </Badge>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  {tables.map(table => {
                    const isSelected = selectedTableIds.includes(table.id)
                    const minCap = table.min_capacity || 1
                    const isExactFit = table.capacity >= booking.party_size && minCap <= booking.party_size
                    const canAccommodate = table.capacity >= booking.party_size && minCap > booking.party_size
                    const isSuitable = isExactFit || canAccommodate
                    const tableText = `T${table.table_number}`
                    
                    return (
                      <Button
                        key={table.id}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "h-16 flex flex-col items-center justify-center p-3 relative min-w-fit",
                          isSelected && "bg-blue-600 hover:bg-blue-700 border-blue-600",
                          !table.canBeSelected && "opacity-50 cursor-not-allowed bg-gray-100",
                          table.currentlyOccupied && "bg-red-100 border-red-300 text-red-700",
                          table.conflictingBooking && "bg-orange-100 border-orange-300 text-orange-700",
                          isSuitable && table.canBeSelected && !isSelected && "border-green-300 bg-green-50"
                        )}
                        style={{
                          minWidth: `${Math.max(4, tableText.length * 0.7 + 2)}rem`
                        }}
                        onClick={() => table.canBeSelected && handleTableToggle(table.id)}
                        disabled={!table.canBeSelected}
                        title={
                          table.currentlyOccupied ? "Currently occupied" :
                          table.conflictingBooking ? "Booked during this time" :
                          `Table ${table.table_number} (${table.capacity} seats)`
                        }
                      >
                        <span className="font-semibold text-sm whitespace-nowrap">{tableText}</span>
                        <span className="text-xs opacity-70 flex items-center gap-1 whitespace-nowrap">
                          <Users className="h-3 w-3" />
                          {table.capacity}
                        </span>
                        {isSuitable && table.canBeSelected && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></div>
                        )}
                        {!table.canBeSelected && (
                          <div className="absolute inset-0 bg-gray-200 opacity-60 rounded" />
                        )}
                      </Button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <Separator />

        {/* Footer with Actions */}
        <div className="p-4 pt-4 flex-shrink-0 bg-white border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-50 border border-green-300 rounded"></div>
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
                <span>Occupied</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-orange-100 border border-orange-300 rounded"></div>
                <span>Booked</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Suitable</span>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isProcessing}
                aria-label="Close"
              >
                <X className="h-4 w-4" />

              </Button>
              <Button
                onClick={handleConfirm}
                disabled={selectedTableIds.length === 0 || isProcessing || assignWarnings.isChecking || selectedCapacity < booking.party_size}
                className="bg-green-600 hover:bg-green-700"
                aria-label="Confirm selection"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
            
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Table Assignment Warnings Dialog */}
    <BookingWarningsDialog
      open={assignWarnings.isOpen}
      onOpenChange={(open) => {
        if (!open) setAssignWarnings(prev => ({ ...prev, isOpen: false }))
      }}
      warnings={assignWarnings.warnings}
      actionLabel="Assign Tables"
      description="Review these warnings about the selected table assignment."
      isLoading={isProcessing}
      onConfirm={() => {
        setAssignWarnings({ isOpen: false, warnings: [], isChecking: false })
        onConfirmSelection(selectedTableIds)
        setSelectedTableIds([])
      }}
      onCancel={() => {
        setAssignWarnings({ isOpen: false, warnings: [], isChecking: false })
      }}
    />
    </>
  )
}
