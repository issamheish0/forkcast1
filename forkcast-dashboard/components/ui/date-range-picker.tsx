"use client"

import { useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, addDays, isAfter, isBefore, isEqual } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DateRange } from "react-day-picker"

interface DateRangePickerProps {
  selectedDates: Date[]
  onDatesChange: (dates: Date[]) => void
  placeholder?: string
  className?: string
}

export function DateRangePicker({
  selectedDates,
  onDatesChange,
  placeholder = "Select date range",
  className
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Convert the selectedDates array to DateRange format
  const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime())
  const dateRange: DateRange | undefined = sortedDates.length > 0 ? {
    from: sortedDates[0],
    to: sortedDates.length > 1 ? sortedDates[sortedDates.length - 1] : sortedDates[0]
  } : undefined

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

  const formatDisplayText = () => {
    if (!dateRange?.from) return placeholder

    if (!dateRange.to || isEqual(dateRange.from, dateRange.to)) {
      return format(dateRange.from, "PPP")
    }

    return `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")} (${selectedDates.length} days)`
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
        <div className="p-3">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={handleRangeSelect}
            numberOfMonths={1}
            className="rounded-md border-0"
          />
          {dateRange?.from && dateRange?.to && selectedDates.length > 1 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-sm text-muted-foreground text-center">
                {selectedDates.length} days selected
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
