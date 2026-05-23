"use client"

import { cn } from "@/lib/utils"
import { TimeInput12H } from "./time-input-12h"
import { useTimeValidation } from "@/lib/hooks/use-time-validation"
import { AlertCircle } from "lucide-react"

interface TimeRangeInputsProps {
  startTime?: string
  endTime?: string
  onStartTimeChange?: (time: string) => void
  onEndTimeChange?: (time: string) => void
  allowOvernight?: boolean
  disabled?: boolean
  className?: string
  startLabel?: string
  endLabel?: string
  startName?: string
  endName?: string
  showValidation?: boolean
}

export function TimeRangeInputs({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  allowOvernight = false,
  disabled = false,
  className,
  startLabel = "Start Time",
  endLabel = "End Time",
  startName,
  endName,
  showValidation = true
}: TimeRangeInputsProps) {
  // Only validate when both times are present and not empty
  const shouldValidate = showValidation &&
                        Boolean(startTime) &&
                        Boolean(endTime) &&
                        startTime.trim() !== "" &&
                        endTime.trim() !== ""

  const { error, hasError } = useTimeValidation({
    startTime,
    endTime,
    allowOvernight,
    enabled: shouldValidate
  })

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <TimeInput12H
            value={startTime}
            onChange={onStartTimeChange}
            placeholder="9:00 AM"
            disabled={disabled}
            name={startName}
            aria-label={startLabel}
            error={hasError}
          />
        </div>

        <span className="text-muted-foreground font-medium px-2">to</span>

        <div className="flex-1">
          <TimeInput12H
            value={endTime}
            onChange={onEndTimeChange}
            placeholder="5:00 PM"
            disabled={disabled}
            name={endName}
            aria-label={endLabel}
            error={hasError}
          />
        </div>
      </div>

      {hasError && error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
