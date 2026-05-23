// components/floorplan/assign-mode-banner.tsx
"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, Check, Users, X, Sparkles, AlertTriangle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { format } from 'date-fns'
import type { Booking, RestaurantTable } from '@/types'

interface AssignModeBannerProps {
  booking: Booking
  selectedTables?: RestaurantTable[]
  combinedCapacity?: number
  onConfirm: () => void
  onCancel: () => void
  onAutoAssign: () => void
  hasAutoAssignSuggestion?: boolean
}

export function AssignModeBanner({
  booking,
  selectedTables = [],
  combinedCapacity = 0,
  onConfirm,
  onCancel,
  onAutoAssign,
  hasAutoAssignSuggestion = false,
}: AssignModeBannerProps) {
  const [showCapacityWarning, setShowCapacityWarning] = useState(false)
  const guestName =
    booking.guest_name ||
    (Array.isArray(booking.profiles) ? booking.profiles[0]?.full_name : booking.profiles?.full_name) ||
    booking.user?.full_name ||
    'Guest'
  const partySize = booking.party_size ?? booking.attendees ?? 1
  const timeStr = format(new Date(booking.booking_time), 'h:mm a')
  const hasSelection = selectedTables.length > 0
  const capacityMet = combinedCapacity >= partySize

  return (
    <>
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-card border-2 border-[hsl(var(--status-available))] rounded-xl shadow-elevated px-3 py-2 flex flex-col gap-1.5 max-w-[360px] w-[calc(100%-2rem)]"
      data-ui
    >
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-[hsl(var(--status-available))] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold">
            {hasSelection ? 'Tap more tables or confirm' : 'Tap on tables to assign'}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
            <span className="font-medium text-foreground">{guestName}</span>
            <span>•</span>
            <span className="flex items-center gap-0.5">
              <Users className="w-3 h-3" />
              {partySize} guests
            </span>
            <span>•</span>
            <span>{timeStr}</span>
          </div>
        </div>
        {!hasSelection && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 touch-target"
            onClick={onCancel}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1.5 border-t pt-1.5">
        {!hasSelection && hasAutoAssignSuggestion && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs touch-target border-[hsl(var(--status-available)/.5)] text-[hsl(var(--status-available))] hover:bg-[hsl(var(--status-available)/.08)] active:scale-[0.97] transition-transform"
            onClick={onAutoAssign}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Auto Assign
          </Button>
        )}
        <div className="flex-1" />
        {hasSelection && (
          <>
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              {selectedTables.map(t => (
                <Badge key={t.id} variant="secondary" className="text-xs px-2 py-0.5">
                  T{t.table_number}
                  <span className="text-muted-foreground ml-1">({t.max_capacity})</span>
                </Badge>
              ))}
              <span className={`text-xs font-bold ml-1 inline-flex items-center gap-1 ${capacityMet ? 'text-[hsl(var(--status-available))]' : 'text-[hsl(var(--status-overstay))]'}`}>
                {capacityMet ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                = {combinedCapacity}/{partySize} seats
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs touch-target"
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-8 px-4 text-xs touch-target bg-[hsl(var(--booking-confirmed))] hover:bg-[hsl(var(--booking-confirmed)/.85)] text-white active:scale-[0.97] transition-transform"
                onClick={() => {
                  if (!capacityMet) {
                    setShowCapacityWarning(true)
                  } else {
                    onConfirm()
                  }
                }}
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Assign {selectedTables.length > 1 ? `${selectedTables.length} tables` : 'table'}
              </Button>
            </div>
          </>
        )}
        {!hasSelection && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs touch-target"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>

    {/* Capacity warning dialog */}
    <AlertDialog open={showCapacityWarning} onOpenChange={setShowCapacityWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[hsl(var(--status-overstay))]" />
            Insufficient Table Capacity
          </AlertDialogTitle>
          <AlertDialogDescription>
            The selected {selectedTables.length > 1 ? 'tables have' : 'table has'} a combined capacity of {combinedCapacity} seats, but {guestName}&apos;s party needs {partySize}. Assign anyway?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Select Different Table</AlertDialogCancel>
          <AlertDialogAction
            className="bg-[hsl(var(--status-overstay))] text-white hover:bg-[hsl(var(--status-overstay)/.85)] active:scale-[0.97] transition-transform"
            onClick={() => { setShowCapacityWarning(false); onConfirm() }}
          >
            Assign Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
