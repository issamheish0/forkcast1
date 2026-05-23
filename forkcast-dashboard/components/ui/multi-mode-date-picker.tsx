"use client"

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, addDays, isBefore, isEqual, startOfDay } from "date-fns"
import { Calendar as CalendarIcon, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DateRange } from "react-day-picker"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface MultiModeDatePickerProps {
  selectedDates: Date[]
  onDatesChange: (dates: Date[]) => void
  placeholder?: string
  className?: string
}

export function MultiModeDatePicker({
  selectedDates,
  onDatesChange,
  placeholder = "Select dates",
  className
}: MultiModeDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<"range" | "multiple">("range")
  
  // Internal state for range mode
  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  // Initialize internal state based on props when opening
  useEffect(() => {
    if (isOpen) {
      // Detect mode based on continuity of dates? 
      // For simplicity, default to range if dates are contiguous, else multiple
      // But user might want to switch modes manually.
      // Let's just keep the last used mode or default to range.
      
      const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime())
      if (sorted.length > 0) {
         setDateRange({
           from: sorted[0],
           to: sorted.length > 1 ? sorted[sorted.length - 1] : sorted[0]
         })
      } else {
        setDateRange(undefined)
      }
    }
  }, [isOpen, selectedDates])

  // Generate all dates between start and end (inclusive)
  const generateDateRange = (startDate: Date, endDate: Date): Date[] => {
    const dates: Date[] = []
    let currentDate = new Date(startDate)

    while (isBefore(currentDate, endDate) || isEqual(currentDate, endDate)) {
      dates.push(new Date(currentDate))
      currentDate = addDays(currentDate, 1)
    }

    return dates
  }

  const handleRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range)
    
    if (!range?.from) {
      onDatesChange([])
      return
    }

    if (!range.to) {
      // Only start date selected
      onDatesChange([range.from])
    } else {
      // Both start and end dates selected - generate all dates in between
      const allDatesInRange = generateDateRange(range.from, range.to)
      onDatesChange(allDatesInRange)
    }
  }

  const handleMultipleSelect = (dates: Date[] | undefined) => {
    if (dates) {
      // Sort dates for consistency
      const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
      onDatesChange(sorted)
    } else {
      onDatesChange([])
    }
  }

  const formatDisplayText = () => {
    if (selectedDates.length === 0) return placeholder

    const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime())
    
    if (sorted.length === 1) {
      return format(sorted[0], "PPP")
    }

    // Check if contiguous for display
    let isContiguous = true
    for (let i = 0; i < sorted.length - 1; i++) {
      const nextDay = addDays(sorted[i], 1)
      if (!isEqual(startOfDay(nextDay), startOfDay(sorted[i+1]))) {
        isContiguous = false
        break
      }
    }

    if (isContiguous) {
      return `${format(sorted[0], "MMM d")} - ${format(sorted[sorted.length - 1], "MMM d")} (${selectedDates.length} days)`
    }

    return `${selectedDates.length} days selected`
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal min-h-[40px]",
            !selectedDates.length && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
          <span className="truncate">{formatDisplayText()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "range" | "multiple")} className="w-full">
          <div className="p-3 pb-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="range">Range</TabsTrigger>
              <TabsTrigger value="multiple">Specific Dates</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="range" className="p-3 pt-2">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={handleRangeSelect}
              numberOfMonths={1}
              initialFocus
              className="rounded-md border-0"
            />
            <div className="mt-2 text-center text-xs text-muted-foreground text-sm">Select a start and end date
            </div>
          </TabsContent>
          
          <TabsContent value="multiple" className="p-3 pt-2">
            <Calendar
              mode="multiple"
              selected={selectedDates}
              onSelect={handleMultipleSelect}
              numberOfMonths={1}
              initialFocus
              className="rounded-md border-0"
            />
            <div className="mt-2 text-center text-xs text-muted-foreground text-sm">Click dates to toggle selection
            </div>
          </TabsContent>
        </Tabs>
        
        {selectedDates.length > 0 && (
          <div className="p-3 border-t bg-muted/50 flex justify-between items-center">
            <span className="text-xs text-muted-foreground text-sm">{selectedDates.length} {selectedDates.length === 1 ? 'day' : 'days'} selected
            </span>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setIsOpen(false)}>
              Done
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
