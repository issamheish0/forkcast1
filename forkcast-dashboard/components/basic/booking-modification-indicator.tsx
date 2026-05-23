// components/basic/booking-modification-indicator.tsx
"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { AlertTriangle } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface ModificationLog {
  id: string
  old_values: Record<string, any>
  new_values: Record<string, any>
  created_at: string
  actor_type: string
}

interface BookingModificationIndicatorProps {
  bookingId: string
  modifications: ModificationLog[]
  className?: string
}

const FIELD_LABELS: Record<string, string> = {
  booking_time: "Booking Time",
  party_size: "Party Size",
  special_requests: "Special Requests",
  occasion: "Occasion",
  dietary_notes: "Dietary Notes",
  guest_name: "Guest Name",
  guest_email: "Guest Email",
  guest_phone: "Guest Phone",
  request_expires_at: "Request Expires At",
}

// Fields to ignore when comparing (these change automatically)
const IGNORED_FIELDS = new Set([
  'id',
  'updated_at',
  'created_at',
  'created_by',
  'last_modified_by',
])

function formatValue(field: string, value: any): string {
  if (value === null || value === undefined) return "—"
  
  if (field === "booking_time" || field === "request_expires_at") {
    try {
      return format(new Date(value), "MMM d, yyyy 'at' h:mm a")
    } catch {
      return String(value)
    }
  }
  
  return String(value)
}

// Compare old and new values to find only changed fields
function getChangedFields(oldValues: Record<string, any>, newValues: Record<string, any>): string[] {
  const changed: string[] = []
  const allFields = new Set([...Object.keys(oldValues || {}), ...Object.keys(newValues || {})])
  
  for (const field of allFields) {
    if (IGNORED_FIELDS.has(field)) continue
    
    const oldVal = oldValues?.[field]
    const newVal = newValues?.[field]
    
    // Compare values (handling null/undefined)
    if (oldVal !== newVal && JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changed.push(field)
    }
  }
  
  return changed
}

export function BookingModificationIndicator({
  bookingId,
  modifications,
  className,
}: BookingModificationIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!modifications || modifications.length === 0) {
    return null
  }

  // Get the most recent modification
  const latestModification = modifications[0]

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center gap-1.5 text-xs text-orange-700 cursor-pointer hover:text-orange-800 transition-colors",
            className
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="font-medium">Modified</span>
          {modifications.length > 1 && (
            <span className="text-orange-600">({modifications.length})</span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-[500px] overflow-y-auto" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="font-semibold text-sm">Booking Modifications</h4>
            <span className="text-xs text-muted-foreground text-sm">{modifications.length} change{modifications.length !== 1 ? "s" : ""}
            </span>
          </div>

          {modifications.map((mod, index) => {
            const changedFields = getChangedFields(mod.old_values || {}, mod.new_values || {})
            
            if (changedFields.length === 0) {
              return null
            }
            
            return (
              <div
                key={mod.id}
                className={cn(
                  "space-y-2 pb-3",
                  index < modifications.length - 1 && "border-b"
                )}
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground text-sm"><span>
                    {mod.created_at ? format(new Date(mod.created_at), "MMM d, yyyy 'at' h:mm a") : "Unknown date"}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {mod.actor_type === "user" ? "User" : mod.actor_type || "System"}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {changedFields.map((field) => {
                    const oldValue = mod.old_values?.[field]
                    const newValue = mod.new_values?.[field]
                    const fieldLabel = FIELD_LABELS[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

                    // Skip if both values are null/undefined/empty
                    if ((!oldValue && !newValue) || (oldValue === newValue)) {
                      return null;
                    }

                    return (
                      <div key={field} className="space-y-1">
                        <div className="text-xs font-medium text-slate-700">
                          {fieldLabel}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-red-50 border border-red-200 rounded p-2">
                            <div className="text-red-600 font-medium mb-1">Old</div>
                            <div className="text-red-800 break-words">
                              {formatValue(field, oldValue)}
                            </div>
                          </div>
                          <div className="bg-green-50 border border-green-200 rounded p-2">
                            <div className="text-green-600 font-medium mb-1">New</div>
                            <div className="text-green-800 break-words">
                              {formatValue(field, newValue)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
