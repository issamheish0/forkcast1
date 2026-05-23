// components/floorplan/rule-form-dialog.tsx — Booking rule editing UI
"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2 } from "lucide-react"
import type { TableBookingRule, TableBookingCondition } from "@/types"

interface RuleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: TableBookingRule | null
  onSave: (rule: {
    name: string
    booking_type: "instant" | "request"
    priority: number
    conditions: TableBookingCondition[]
  }) => void
  onDelete?: () => void
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function RuleFormDialog({ open, onOpenChange, rule, onSave, onDelete }: RuleFormDialogProps) {
  const [name, setName] = useState("")
  const [bookingType, setBookingType] = useState<"instant" | "request">("request")
  const [priority, setPriority] = useState(0)
  const [conditions, setConditions] = useState<TableBookingCondition[]>([])

  useEffect(() => {
    if (rule) {
      setName(rule.name)
      setBookingType(rule.booking_type)
      setPriority(rule.priority)
      setConditions(rule.conditions || [])
    } else {
      setName("")
      setBookingType("request")
      setPriority(0)
      setConditions([])
    }
  }, [rule, open])

  const addCondition = (type: TableBookingCondition["type"]) => {
    switch (type) {
      case "party_size":
        setConditions(prev => [...prev, { type: "party_size", operator: "gte", value: 6 }])
        break
      case "day_of_week":
        setConditions(prev => [...prev, { type: "day_of_week", days: [5, 6] }])
        break
      case "time_range":
        setConditions(prev => [...prev, { type: "time_range", start: "18:00", end: "22:00" }])
        break
      case "date_range":
        setConditions(prev => [...prev, { type: "date_range", start: "", end: "" }])
        break
    }
  }

  const removeCondition = (index: number) => {
    setConditions(prev => prev.filter((_, i) => i !== index))
  }

  const updateCondition = (index: number, updates: Partial<TableBookingCondition>) => {
    setConditions(prev =>
      prev.map((c, i) => (i === index ? { ...c, ...updates } as TableBookingCondition : c))
    )
  }

  const toggleDay = (index: number, day: number) => {
    const condition = conditions[index]
    if (condition.type !== "day_of_week") return
    const days = condition.days.includes(day)
      ? condition.days.filter(d => d !== day)
      : [...condition.days, day].sort()
    updateCondition(index, { days })
  }

  const handleSave = () => {
    if (!name.trim()) return
    // Validate: day_of_week conditions must have at least one day selected
    const hasEmptyDays = conditions.some(c => c.type === 'day_of_week' && c.days.length === 0)
    if (hasEmptyDays) return
    onSave({ name, booking_type: bookingType, priority, conditions })
    onOpenChange(false)
  }

  // Check which condition types are already added
  const usedTypes = new Set(conditions.map(c => c.type))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit" : "Add"} Booking Rule</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Rule Name */}
          <div className="space-y-1.5">
            <Label>Rule Name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Weekend dinner large parties"
            />
          </div>

          {/* Booking Type */}
          <div className="space-y-1.5">
            <Label>Booking Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={bookingType === "instant" ? "default" : "outline"}
                size="sm"
                onClick={() => setBookingType("instant")}
                className="flex-1"
              >
                Instant
              </Button>
              <Button
                type="button"
                variant={bookingType === "request" ? "default" : "outline"}
                size="sm"
                onClick={() => setBookingType("request")}
                className="flex-1"
              >
                Request
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {bookingType === "instant"
                ? "Bookings matching this rule are confirmed automatically"
                : "Bookings matching this rule require staff approval"}
            </p>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={priority}
              onChange={e => setPriority(parseInt(e.target.value) || 0)}
              className="w-24"
            />
            <p className="text-xs text-muted-foreground">
              Higher priority rules are evaluated first. First matching rule wins.
            </p>
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Conditions (all must match)</Label>
            </div>

            {conditions.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">
                No conditions — this rule will match all bookings for this table.
              </p>
            )}

            {conditions.map((condition, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="capitalize">
                    {condition.type.replace("_", " ")}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeCondition(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Party Size Condition */}
                {condition.type === "party_size" && (
                  <div className="flex items-center gap-2">
                    <Select
                      value={condition.operator}
                      onValueChange={v => updateCondition(index, { operator: v as any })}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gte">At least</SelectItem>
                        <SelectItem value="lte">At most</SelectItem>
                        <SelectItem value="eq">Exactly</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={condition.value}
                      onChange={e => updateCondition(index, { value: parseInt(e.target.value) || 1 })}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">guests</span>
                  </div>
                )}

                {/* Day of Week Condition */}
                {condition.type === "day_of_week" && (
                  <div className="flex flex-wrap gap-1">
                    {DAY_NAMES.map((day, dayIndex) => (
                      <Button
                        key={day}
                        type="button"
                        variant={condition.days.includes(dayIndex) ? "default" : "outline"}
                        size="sm"
                        className="h-11 w-11 text-xs"
                        onClick={() => toggleDay(index, dayIndex)}
                      >
                        {day}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Time Range Condition */}
                {condition.type === "time_range" && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={condition.start}
                      onChange={e => updateCondition(index, { start: e.target.value })}
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={condition.end}
                      onChange={e => updateCondition(index, { end: e.target.value })}
                      className="w-32"
                    />
                  </div>
                )}

                {/* Date Range Condition */}
                {condition.type === "date_range" && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={condition.start}
                      onChange={e => updateCondition(index, { start: e.target.value })}
                      className="w-40"
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      type="date"
                      value={condition.end}
                      onChange={e => updateCondition(index, { end: e.target.value })}
                      className="w-40"
                    />
                  </div>
                )}
              </div>
            ))}

            {/* Add Condition Buttons */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {!usedTypes.has("party_size") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => addCondition("party_size")}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Party Size
                </Button>
              )}
              {!usedTypes.has("day_of_week") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => addCondition("day_of_week")}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Day of Week
                </Button>
              )}
              {!usedTypes.has("time_range") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => addCondition("time_range")}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Time Range
                </Button>
              )}
              {!usedTypes.has("date_range") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => addCondition("date_range")}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Date Range
                </Button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {rule && onDelete && (
            <Button
              variant="destructive"
              onClick={() => { onDelete(); onOpenChange(false) }}
              className="sm:mr-auto"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete Rule
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {rule ? "Update" : "Add"} Rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
