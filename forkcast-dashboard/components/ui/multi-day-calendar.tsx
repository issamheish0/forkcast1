"use client"

import { useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Calendar as CalendarIcon, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface MultiDayCalendarProps {
  selectedDates: Date[]
  onDatesChange: (dates: Date[]) => void
  placeholder?: string
  className?: string
}

export function MultiDayCalendar({
  selectedDates,
  onDatesChange,
  placeholder = "Select dates",
  className
}: MultiDayCalendarProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return

    const dateExists = selectedDates.some(d =>
      d.toDateString() === date.toDateString()
    )

    if (dateExists) {
      // Remove date if already selected
      onDatesChange(selectedDates.filter(d =>
        d.toDateString() !== date.toDateString()
      ))
    } else {
      // Add date if not selected
      onDatesChange([...selectedDates, date])
    }
  }

  const removeDate = (dateToRemove: Date) => {
    onDatesChange(selectedDates.filter(d =>
      d.toDateString() !== dateToRemove.toDateString()
    ))
  }

  const clearAll = () => {
    onDatesChange([])
  }

  const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime())

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
          <div className="flex flex-wrap gap-1 items-center overflow-hidden">
            {selectedDates.length === 0 ? (
              placeholder
            ) : selectedDates.length === 1 ? (
              format(selectedDates[0], "PPP")
            ) : (
              <>
                <span className="text-sm">{selectedDates.length} dates selected</span>
                <div className="flex flex-wrap gap-1 ml-2">
                  {sortedDates.slice(0, 3).map((date, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="text-xs px-1 py-0 h-5"
                    >
                      {format(date, "MMM d")}
                    </Badge>
                  ))}
                  {selectedDates.length > 3 && (
                    <Badge variant="outline" className="text-xs px-1 py-0 h-5">
                      +{selectedDates.length - 3}
                    </Badge>
                  )}
                </div>
              </>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3">
          {selectedDates.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  Selected Dates ({selectedDates.length})
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAll}
                  className="h-6 px-2 text-xs"
                >
                  Clear All
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {sortedDates.map((date, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="text-xs px-2 py-1 flex items-center gap-1"
                  >
                    {format(date, "MMM d")}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-red-500"
                      onClick={() => removeDate(date)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <Calendar
            mode="single"
            selected={undefined}
            onSelect={handleDateSelect}
            modifiers={{
              selected: (date) => selectedDates.some(d =>
                d.toDateString() === date.toDateString()
              )
            }}
            modifiersStyles={{
              selected: {
                backgroundColor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))'
              }
            }}
            className="rounded-md border-0"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
