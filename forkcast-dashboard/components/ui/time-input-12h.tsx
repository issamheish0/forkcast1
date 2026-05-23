"use client"

import { forwardRef, useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Clock } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { convertTo12Hour, convertTo24Hour, parseTime12Hour } from "@/lib/utils/time-utils"

interface TimeInput12HProps {
  value?: string // 24-hour format (e.g., "14:30")
  onChange?: (value: string) => void // Returns 24-hour format
  disabled?: boolean
  placeholder?: string
  className?: string
  error?: boolean
  "aria-label"?: string
  name?: string
}

// Common time presets
const TIME_PRESETS = [
  { label: "6:00 AM", value: "06:00" },
  { label: "7:00 AM", value: "07:00" },
  { label: "8:00 AM", value: "08:00" },
  { label: "9:00 AM", value: "09:00" },
  { label: "10:00 AM", value: "10:00" },
  { label: "11:00 AM", value: "11:00" },
  { label: "12:00 PM", value: "12:00" },
  { label: "1:00 PM", value: "13:00" },
  { label: "2:00 PM", value: "14:00" },
  { label: "3:00 PM", value: "15:00" },
  { label: "4:00 PM", value: "16:00" },
  { label: "5:00 PM", value: "17:00" },
  { label: "6:00 PM", value: "18:00" },
  { label: "7:00 PM", value: "19:00" },
  { label: "8:00 PM", value: "20:00" },
  { label: "9:00 PM", value: "21:00" },
  { label: "10:00 PM", value: "22:00" },
  { label: "11:00 PM", value: "23:00" },
]

export const TimeInput12H = forwardRef<HTMLInputElement, TimeInput12HProps>(
  ({ value, onChange, disabled, placeholder, className, error, name, ...props }, ref) => {
    const [isOpen, setIsOpen] = useState(false)
    const [inputValue, setInputValue] = useState("")
    const [selectedHour, setSelectedHour] = useState(9)
    const [selectedMinute, setSelectedMinute] = useState(0)
    const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM')
    const inputRef = useRef<HTMLInputElement>(null)

    // Update display value when prop changes
    useEffect(() => {
      if (value) {
        const time12h = convertTo12Hour(value)
        setInputValue(`${time12h.time} ${time12h.period}`)

        const [h, m] = time12h.time.split(':').map(Number)
        setSelectedHour(h)
        setSelectedMinute(m)
        setSelectedPeriod(time12h.period)
      } else {
        setInputValue("")
      }
    }, [value])

    // Remove input change handlers since component is read-only
    // const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    //   // Component is read-only, no manual input
    // }

    // const handleInputBlur = () => {
    //   // Component is read-only, no manual input
    // }

    const handlePresetSelect = (preset: string) => {
      onChange?.(preset)
      setIsOpen(false)
      inputRef.current?.focus()
    }

    const handleTimePickerChange = () => {
      const time24h = convertTo24Hour(selectedHour, selectedMinute, selectedPeriod)
      onChange?.(time24h)
      setIsOpen(false)
      inputRef.current?.focus()
    }

    const displayValue = inputValue || (value ? `${convertTo12Hour(value).time} ${convertTo12Hour(value).period}` : "")

    return (
      <div className={cn("relative", className)}>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <div className="relative">
              <Input
                ref={inputRef}
                type="text"
                value={displayValue}
                placeholder={placeholder || "9:00 AM"}
                disabled={disabled}
                name={name}
                className={cn(
                  "pr-10 text-center",
                  "h-11 min-h-[44px]", // Touch-friendly
                  "cursor-pointer",
                  error && "border-red-500 focus:border-red-500"
                )}
                style={{ touchAction: 'manipulation' }}
                readOnly={true} // Make it click-to-open only
                onClick={() => !disabled && setIsOpen(true)}
                {...props}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                tabIndex={-1}
              >
                <Clock className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </PopoverTrigger>

          <PopoverContent className="w-[90vw] sm:w-72 max-w-sm p-3" align="start">
            <div className="space-y-3">
              {/* Quick Common Times */}
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: "8:00 AM", value: "08:00" },
                    { label: "9:00 AM", value: "09:00" },
                    { label: "10:00 AM", value: "10:00" },
                    { label: "11:00 AM", value: "11:00" },
                    { label: "12:00 PM", value: "12:00" },
                    { label: "1:00 PM", value: "13:00" },
                    { label: "2:00 PM", value: "14:00" },
                    { label: "3:00 PM", value: "15:00" },
                    { label: "5:00 PM", value: "17:00" },
                    { label: "6:00 PM", value: "18:00" },
                    { label: "7:00 PM", value: "19:00" },
                    { label: "8:00 PM", value: "20:00" },
                    { label: "9:00 PM", value: "21:00" },
                    { label: "10:00 PM", value: "22:00" },
                    { label: "11:00 PM", value: "23:00" },
                    { label: "12:00 AM", value: "00:00" },
                  ].map((preset) => (
                    <Button
                      key={preset.value}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-10 text-sm",
                        value === preset.value && "bg-primary text-primary-foreground"
                      )}
                      onClick={() => handlePresetSelect(preset.value)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom Time Picker */}
              <div className="border-t pt-3">
                <div className="flex items-center justify-center gap-2">
                  {/* Hour Picker */}
                  <select
                    value={selectedHour}
                    onChange={(e) => setSelectedHour(Number(e.target.value))}
                    className="px-3 py-2 border rounded-md text-center font-medium min-w-[65px] h-10"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(hour => (
                      <option key={hour} value={hour}>{hour}</option>
                    ))}
                  </select>

                  <span className="text-lg font-medium text-muted-foreground">:</span>

                  {/* Minute Picker */}
                  <select
                    value={selectedMinute}
                    onChange={(e) => setSelectedMinute(Number(e.target.value))}
                    className="px-3 py-2 border rounded-md text-center font-medium min-w-[65px] h-10"
                  >
                    {[0, 15, 30, 45].map(minute => (
                      <option key={minute} value={minute}>{minute.toString().padStart(2, '0')}</option>
                    ))}
                  </select>

                  {/* Period Picker */}
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant={selectedPeriod === 'AM' ? 'default' : 'outline'}
                      size="sm"
                      className="h-10 px-3"
                      onClick={() => setSelectedPeriod('AM')}
                    >
                      AM
                    </Button>
                    <Button
                      type="button"
                      variant={selectedPeriod === 'PM' ? 'default' : 'outline'}
                      size="sm"
                      className="h-10 px-3"
                      onClick={() => setSelectedPeriod('PM')}
                    >
                      PM
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={handleTimePickerChange}
                  className="w-full mt-3 h-10"
                >
                  Set {selectedHour}:{selectedMinute.toString().padStart(2, '0')} {selectedPeriod}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    )
  }
)

TimeInput12H.displayName = "TimeInput12H"

