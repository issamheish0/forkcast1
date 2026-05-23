// components/floorplan/shift-selector.tsx
// Compact shift picker for the floorplan. Next to the time picker.
// Optimized for 8-inch tablets: 44px touch targets, popover with shift cards.
"use client"

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Clock,
  Coffee,
  Utensils,
  Moon,
  Footprints,
  Settings,
  X,
  Check,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RestaurantShift } from '@/types'
import { getShiftsForDate, formatShiftRange, getDefaultShiftColor } from '@/lib/utils/shifts'

interface ShiftSelectorProps {
  shifts: RestaurantShift[] | undefined
  selectedShiftId: string | null
  selectedDate: Date
  onShiftChange: (shiftId: string | null) => void
  className?: string
  compact?: boolean
}

const ICON_MAP = {
  breakfast: Coffee,
  lunch: Utensils,
  dinner: Moon,
  walkin: Footprints,
  custom: Clock,
} as const

export function ShiftSelector({
  shifts,
  selectedShiftId,
  selectedDate,
  onShiftChange,
  className,
  compact = false,
}: ShiftSelectorProps) {
  const [open, setOpen] = useState(false)

  const availableShifts = useMemo(
    () => getShiftsForDate(shifts, selectedDate),
    [shifts, selectedDate]
  )

  const selectedShift = useMemo(
    () => shifts?.find((s) => s.id === selectedShiftId) ?? null,
    [shifts, selectedShiftId]
  )

  const SelectedIcon = selectedShift
    ? ICON_MAP[selectedShift.shift_type] ?? Clock
    : Clock

  const triggerTint = selectedShift?.color || (selectedShift ? getDefaultShiftColor(selectedShift.shift_type) : null)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={selectedShift ? `Shift: ${selectedShift.name}. Click to change.` : 'Select a shift'}
          className={cn(
            'flex-shrink-0 min-h-[44px] flex items-center gap-1.5 px-2.5 rounded-md transition-colors border',
            selectedShift
              ? 'bg-primary/10 border-primary/30 text-foreground hover:bg-primary/15'
              : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            className
          )}
          style={{
            touchAction: 'manipulation',
            // Softer tint so the selector doesn't out-weight the section tabs
            ...(selectedShift && triggerTint
              ? { backgroundColor: `${triggerTint}10`, borderColor: `${triggerTint}30` }
              : {}),
          }}
        >
          <SelectedIcon
            className="w-4 h-4 flex-shrink-0"
            style={selectedShift && triggerTint ? { color: triggerTint } : undefined}
          />
          {/* Label only when no shift is selected — once picked, the icon + tint convey state
              and saves horizontal space on the 8-inch sections bar. */}
          {!compact && !selectedShift && (
            <span className="text-sm font-medium whitespace-nowrap">Shift</span>
          )}
          <ChevronDown className="w-3 h-3 text-muted-foreground/70 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-1.5 z-[60]"
        align="end"
        sideOffset={8}
        avoidCollisions
        collisionPadding={{ bottom: 20 }}
        // Prevent the floorplan canvas's pointer handlers (which call
        // setPointerCapture on pointerdown) from stealing clicks on portaled
        // popover content. Mirrors the pattern used by the time-picker popover.
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <div className="px-2 py-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Filter by shift
            </span>
            {selectedShift && (
              <button
                type="button"
                onClick={() => {
                  onShiftChange(null)
                  setOpen(false)
                }}
                className="min-h-[36px] px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded flex items-center gap-1"
                style={{ touchAction: 'manipulation' }}
                aria-label="Clear shift filter"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {availableShifts.length === 0 ? (
            <div className="px-2 py-4 text-center">
              <Clock className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground mb-1">
                {(shifts?.length ?? 0) === 0
                  ? 'No shifts configured yet'
                  : `No shifts scheduled for ${selectedDate.toLocaleDateString(undefined, { weekday: 'long' })}`}
              </p>
              {(shifts?.length ?? 0) > 0 && availableShifts.length === 0 && (
                <p className="text-[10px] text-muted-foreground/80 mb-2">
                  Your configured shifts don&apos;t apply to this day
                </p>
              )}
              <Link
                href="/settings/availability?tab=shifts"
                className="inline-flex items-center gap-1 min-h-[44px] px-3 text-xs text-primary hover:underline"
                style={{ touchAction: 'manipulation' }}
                onClick={() => setOpen(false)}
              >
                <Settings className="w-3.5 h-3.5" />
                {(shifts?.length ?? 0) === 0 ? 'Configure shifts' : 'Manage shifts'}
              </Link>
            </div>
          ) : (
            <div className="space-y-0.5">
              {availableShifts.map((shift) => {
                const Icon = ICON_MAP[shift.shift_type] ?? Clock
                const isSelected = shift.id === selectedShiftId
                const tint = shift.color || getDefaultShiftColor(shift.shift_type)
                return (
                  <button
                    key={shift.id}
                    type="button"
                    onClick={() => {
                      onShiftChange(isSelected ? null : shift.id)
                      setOpen(false)
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 p-2 min-h-[48px] rounded-md transition-colors text-left',
                      isSelected
                        ? 'bg-primary/10 text-foreground'
                        : 'hover:bg-muted/60 text-foreground'
                    )}
                    style={{ touchAction: 'manipulation' }}
                    aria-pressed={isSelected}
                  >
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${tint}20` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: tint }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{shift.name}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {formatShiftRange(shift)}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          )}

          {availableShifts.length > 0 && (
            <div className="border-t pt-1 mt-1">
              <Link
                href="/settings/availability?tab=shifts"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-2 min-h-[40px] text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                <Settings className="w-3.5 h-3.5" />
                Manage shifts
              </Link>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
