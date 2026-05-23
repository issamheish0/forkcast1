'use client'

import { useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type DatePreset = 'last_7' | 'last_30' | 'this_month' | 'last_month' | 'custom'

export type DateRange = {
  from: string // YYYY-MM-DD
  to: string   // YYYY-MM-DD
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function getPresetRange(preset: DatePreset): DateRange {
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = toDateStr(yesterday)

  switch (preset) {
    case 'last_7': {
      const from = new Date(yesterday)
      from.setDate(from.getDate() - 6)
      return { from: toDateStr(from), to: yesterdayStr }
    }
    case 'last_30': {
      const from = new Date(yesterday)
      from.setDate(from.getDate() - 29)
      return { from: toDateStr(from), to: yesterdayStr }
    }
    case 'this_month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: toDateStr(from), to: yesterdayStr }
    }
    case 'last_month': {
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: toDateStr(firstOfLastMonth), to: toDateStr(lastOfLastMonth) }
    }
    default:
      return { from: '', to: '' }
  }
}

const PRESET_LABELS: Record<DatePreset, string> = {
  last_7: 'Last 7 days',
  last_30: 'Last 30 days',
  this_month: 'This month',
  last_month: 'Last month',
  custom: 'Custom range',
}

type Props = {
  dateRange: DateRange
  preset: DatePreset
  onChange: (range: DateRange, preset: DatePreset) => void
  className?: string
}

export function DateRangeFilter({ dateRange, preset, onChange, className }: Props) {
  const [customFrom, setCustomFrom] = useState(dateRange.from)
  const [customTo, setCustomTo] = useState(dateRange.to)
  const [open, setOpen] = useState(false)

  const applyPreset = (p: DatePreset) => {
    if (p === 'custom') {
      setOpen(false)
      return
    }
    const range = getPresetRange(p)
    onChange(range, p)
    setOpen(false)
  }

  const applyCustom = () => {
    if (customFrom && customTo) {
      onChange({ from: customFrom, to: customTo }, 'custom')
      setOpen(false)
    }
  }

  const label =
    preset === 'custom' && dateRange.from && dateRange.to
      ? `${dateRange.from} → ${dateRange.to}`
      : PRESET_LABELS[preset]

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-1.5 font-normal text-sm', className)}
        >
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          {label}
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {(['last_7', 'last_30', 'this_month', 'last_month'] as DatePreset[]).map((p) => (
          <DropdownMenuItem
            key={p}
            onClick={() => applyPreset(p)}
            className={cn(preset === p && 'font-semibold bg-accent')}
          >
            {PRESET_LABELS[p]}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="p-2 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Custom range</p>
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            onClick={applyCustom}
            disabled={!customFrom || !customTo}
          >
            Apply
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
