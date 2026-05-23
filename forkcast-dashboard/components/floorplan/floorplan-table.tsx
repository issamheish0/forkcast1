// components/floorplan/floorplan-table.tsx
"use client"

import { useState, memo } from 'react'
import { cn } from '@/lib/utils'
import { Users } from 'lucide-react'
import type { RestaurantTable } from '@/types'
import type { TableDisplayColor } from '@/app/(dashboard)/floorplan/page'
import type { BookingShiftClassification } from '@/lib/utils/shifts'
import type { TableProgress } from '@/lib/utils/table-progress'

export interface ShiftBookingPill {
  bookingId: string
  time: string // HH:mm
  status: string
  classification: BookingShiftClassification
}

interface FloorplanTableProps {
  table: RestaurantTable
  isSelected: boolean
  isHighlighted: boolean
  isRecommended?: boolean
  isDimmed: boolean
  isAssignMode?: boolean
  displayColor: TableDisplayColor
  hasUpcomingReservation?: boolean
  isLateArrival?: boolean
  guestName?: string
  shiftPills?: ShiftBookingPill[]
  progress?: TableProgress | null
  onSelect: () => void
  onDrop: () => void
  onDoubleTap?: () => void
}

// Status -> HSL CSS var token for pill color (maps to --booking-* in globals.css)
const pillStatusStyle: Record<string, { bg: string; fg: string; ring: string }> = {
  pending:            { bg: 'bg-[hsl(var(--booking-pending)/.18)]',   fg: 'text-[hsl(var(--booking-pending))]',   ring: 'ring-[hsl(var(--booking-pending)/.3)]' },
  confirmed:          { bg: 'bg-[hsl(var(--booking-confirmed)/.18)]', fg: 'text-[hsl(var(--booking-confirmed))]', ring: 'ring-[hsl(var(--booking-confirmed)/.3)]' },
  arrived:            { bg: 'bg-[hsl(var(--booking-seated)/.18)]',    fg: 'text-[hsl(var(--booking-seated))]',    ring: 'ring-[hsl(var(--booking-seated)/.3)]' },
  seated:             { bg: 'bg-primary/20',                           fg: 'text-primary',                          ring: 'ring-primary/30' },
  ordered:            { bg: 'bg-primary/20',                           fg: 'text-primary',                          ring: 'ring-primary/30' },
  appetizers:         { bg: 'bg-primary/20',                           fg: 'text-primary',                          ring: 'ring-primary/30' },
  main_course:        { bg: 'bg-primary/20',                           fg: 'text-primary',                          ring: 'ring-primary/30' },
  dessert:            { bg: 'bg-primary/20',                           fg: 'text-primary',                          ring: 'ring-primary/30' },
  payment:            { bg: 'bg-primary/20',                           fg: 'text-primary',                          ring: 'ring-primary/30' },
}

function getPillStyle(status: string) {
  return pillStatusStyle[status] || pillStatusStyle.confirmed
}

function formatPillTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return time
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  // On the canvas, omit AM/PM and leading zero for compactness
  return `${hour12}:${String(m).padStart(2, '0')}`
}

const colorClasses: Record<string, string> = {
  green: 'bg-status-available',
  red: 'bg-status-taken',
  orange: 'bg-status-overstay',
  grey: 'bg-status-blocked',
  neutral: 'bg-muted-foreground/60',
  yellow: 'bg-[hsl(var(--status-highlight))]',
  'flashing-red': 'bg-status-taken motion-safe:animate-pulse',
  'reserved-upcoming': 'bg-status-available',
}

export const FloorplanTable = memo(function FloorplanTable({
  table,
  isSelected,
  isHighlighted,
  isRecommended,
  isDimmed,
  isAssignMode = false,
  displayColor,
  hasUpcomingReservation,
  isLateArrival,
  guestName,
  shiftPills,
  progress,
  onSelect,
  onDrop,
  onDoubleTap,
}: FloorplanTableProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  // Tablet-optimized sizes — larger touch targets (matches hostess-hub)
  const getTableDimensions = () => {
    const capacity = table.max_capacity ?? table.capacity ?? 4
    switch (table.shape) {
      case 'circle':
      case 'round':
        return capacity <= 2
          ? { width: 76, height: 76, borderRadius: '50%' }
          : { width: 92, height: 92, borderRadius: '50%' }
      case 'square':
        return capacity <= 2
          ? { width: 76, height: 76, borderRadius: '12px' }
          : { width: 92, height: 92, borderRadius: '12px' }
      case 'rectangle':
        return capacity <= 6
          ? { width: 130, height: 78, borderRadius: '12px' }
          : { width: 156, height: 86, borderRadius: '12px' }
      case 'banquet':
        return { width: 200, height: 78, borderRadius: '12px' }
      default:
        return { width: 92, height: 92, borderRadius: '12px' }
    }
  }

  const dimensions = getTableDimensions()

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragOver) setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    onDrop()
  }

  return (
    <div
      data-table
      data-table-id={table.id}
      className={cn(
        'absolute flex flex-col items-center justify-center cursor-pointer transition-all duration-150 active:scale-95',
        'select-none touch-target',
        colorClasses[displayColor],
        isSelected && 'outline-solid outline-[4px] outline-[hsl(var(--status-highlight))] outline-offset-2 z-20 scale-105',
        isHighlighted && !isSelected && 'outline-solid outline-[4px] outline-status-available outline-offset-2',
        isDimmed && !isSelected && !isHighlighted && (isAssignMode ? 'opacity-40' : 'opacity-40 pointer-events-none'),
        isDragOver && 'outline-solid outline-[4px] outline-primary outline-offset-2 scale-110',
      )}
      style={{
        left: table.x_position || 0,
        top: table.y_position || 0,
        width: dimensions.width,
        height: dimensions.height,
        borderRadius: dimensions.borderRadius,
        transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined,
        boxShadow: isSelected || isDragOver
          ? '0 8px 25px -5px rgba(0,0,0,0.3)'
          : '0 2px 8px rgba(0,0,0,0.15)',
      }}
      role="button"
      aria-roledescription="draggable table"
      aria-label={`Table ${(table as any).label || table.table_number}, ${table.max_capacity || table.capacity} seats, ${displayColor === 'green' ? 'available' : displayColor === 'red' ? 'occupied' : displayColor === 'orange' ? 'upcoming reservation' : displayColor === 'grey' ? 'blocked' : 'reserved'}${guestName ? `, guest: ${guestName}` : ''}${isLateArrival ? ', late arrival' : ''}${hasUpcomingReservation ? ', has upcoming reservation' : ''}`}
      tabIndex={0}
      onClick={onSelect}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (onDoubleTap) {
          onDoubleTap()
        }
      }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Shift booking pills — rendered BELOW the table (under the table-number badge)
          to avoid collision with LATE / ★ Best fit badges which live at -top-2.5/-top-3.
          Sizes tuned so text stays legible down to ~0.6 canvas zoom. */}
      {shiftPills && shiftPills.length > 0 && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 pointer-events-none z-10"
          style={{ top: 'calc(100% + 20px)' }}
          aria-hidden="true"
        >
          {shiftPills.slice(0, 3).map((pill) => {
            const style = getPillStyle(pill.status)
            const spansBefore = pill.classification === 'spans_before' || pill.classification === 'spans_both'
            const spansAfter = pill.classification === 'spans_after' || pill.classification === 'spans_both'
            return (
              <span
                key={pill.bookingId}
                className={cn(
                  'flex items-center gap-0.5 px-2 h-[22px] rounded-full border border-card/80 shadow-sm ring-1 tabular-nums whitespace-nowrap',
                  style.bg,
                  style.fg,
                  style.ring
                )}
                style={{ fontSize: '11px', fontWeight: 700, lineHeight: 1 }}
              >
                {spansBefore && <span aria-hidden>‹</span>}
                {formatPillTime(pill.time)}
                {spansAfter && <span aria-hidden>›</span>}
              </span>
            )
          })}
          {shiftPills.length > 3 && (
            <span
              className="flex items-center px-2 h-[22px] rounded-full bg-card/95 border border-border shadow-sm tabular-nums text-muted-foreground"
              style={{ fontSize: '11px', fontWeight: 700, lineHeight: 1 }}
            >
              +{shiftPills.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Guest name or capacity */}
      {guestName ? (
        <span className="text-[10px] font-semibold text-white/90 leading-none max-w-[90%] truncate">
          {guestName}
        </span>
      ) : (
        <div className="flex items-center gap-0.5 text-white/90">
          <Users className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{table.max_capacity || table.capacity}</span>
        </div>
      )}

      {/* Seated-progress bar — elapsed time from check-in to expected end.
          Sits above the half-in table-number badge (which occupies ~11px of
          the bottom-inside) so they never overlap. White track + state-colored fill.
          aria-valuenow uses the RAW percent so overstays (>100%) are conveyed to
          assistive tech, not silently clamped. */}
      {progress && (
        <div
          className="absolute left-3 right-3 pointer-events-none"
          style={{ bottom: 22 }}
          aria-label={
            progress.isOverstay
              ? `Overstay: ${Math.max(0, -progress.minutesRemaining)} minutes past expected end`
              : `Progress: ${Math.round(progress.percent)}%, ${Math.max(0, progress.minutesRemaining)} minutes remaining`
          }
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress.rawPercent)}
        >
          <div
            className={cn(
              'h-[3px] rounded-full bg-white/25 overflow-hidden',
              progress.isOverstay && 'ring-1 ring-destructive/50'
            )}
          >
            <div
              className={cn(
                'h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300',
                progress.isOverstay
                  ? 'bg-destructive motion-safe:animate-pulse'
                  : progress.state === 'ending_soon'
                    ? 'bg-[hsl(var(--status-highlight))]'
                    : 'bg-white/90'
              )}
              style={{ width: progress.isOverstay ? '100%' : `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Table number - Rounded badge half in/half out at bottom */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-10">
        <div className="bg-card border border-border rounded-full px-2.5 py-1 shadow-lg">
          <span className="text-xs font-bold text-foreground leading-none">
            {table.table_number}
          </span>
        </div>
      </div>

      {/* Table type badge */}
      {table.table_type === 'shared' && (
        <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center" title="Shared table">
          <Users className="w-3 h-3 text-muted-foreground" />
        </div>
      )}

      {/* Reserved upcoming pill */}
      {hasUpcomingReservation && displayColor === 'green' && (
        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-status-reserved text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
          RSV
        </div>
      )}

      {/* Late arrival indicator */}
      {isLateArrival && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-destructive text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap motion-safe:animate-pulse">
          LATE
        </div>
      )}

      {/* Recommended badge */}
      {isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-status-available text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap motion-safe:animate-pulse z-10 shadow-md">
          ★ Best fit
        </div>
      )}

      {/* Drop indicator */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ borderRadius: dimensions.borderRadius }}>
          <div className="absolute inset-0 bg-primary/30" style={{ borderRadius: dimensions.borderRadius }} />
          <span className="text-sm font-bold text-white z-10 drop-shadow-lg">Drop</span>
        </div>
      )}
    </div>
  )
})
