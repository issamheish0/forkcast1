"use client"

import { useState } from "react"
import { format } from "date-fns"
import {
  useSectionClosures,
  useCreateClosure,
  useUpdateClosure,
  useDeleteClosure,
  type SectionClosure,
  type CreateClosureData,
  type RestaurantSection
} from "@/hooks/use-restaurant-sections"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "react-hot-toast"
import { cn } from "@/lib/utils"
import {
  Plus,
  Edit,
  Trash2,
  CalendarIcon,
  Clock,
  AlertCircle,
  Ban,
  Calendar as CalendarDaysIcon
} from "lucide-react"

interface SectionClosuresManagerProps {
  restaurantId: string
  sections: RestaurantSection[]
  compact?: boolean
}

interface ClosureFormData {
  section_id: string
  start_date: Date
  end_date: Date
  is_full_day: boolean
  start_time: string
  end_time: string
  reason: string
}

export function SectionClosuresManager({ restaurantId, sections, compact = false }: SectionClosuresManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingClosure, setEditingClosure] = useState<(SectionClosure & { section: { id: string, name: string, color: string } }) | null>(null)
  const [formData, setFormData] = useState<ClosureFormData>({
    section_id: "",
    start_date: new Date(),
    end_date: new Date(),
    is_full_day: true,
    start_time: "09:00",
    end_time: "17:00",
    reason: ""
  })

  const { data: closures, isLoading } = useSectionClosures(restaurantId)
  const createClosureMutation = useCreateClosure(restaurantId)
  const updateClosureMutation = useUpdateClosure(restaurantId)
  const deleteClosureMutation = useDeleteClosure(restaurantId)

  const resetForm = () => {
    setFormData({
      section_id: "",
      start_date: new Date(),
      end_date: new Date(),
      is_full_day: true,
      start_time: "09:00",
      end_time: "17:00",
      reason: ""
    })
  }

  const handleCreate = () => {
    if (!formData.section_id) {
      toast.error("Please select a section")
      return
    }
    if (!formData.reason.trim()) {
      toast.error("Please provide a reason for the closure")
      return
    }

    // Format dates in YYYY-MM-DD without timezone conversion
    const formatDate = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const closureData: CreateClosureData = {
      section_id: formData.section_id,
      start_date: formatDate(formData.start_date),
      end_date: formatDate(formData.end_date),
      start_time: formData.is_full_day ? null : formData.start_time,
      end_time: formData.is_full_day ? null : formData.end_time,
      reason: formData.reason
    }

    createClosureMutation.mutate(closureData, {
      onSuccess: () => {
        setIsCreateDialogOpen(false)
        resetForm()
      }
    })
  }

  const handleEdit = (closure: SectionClosure & { section: { id: string, name: string, color: string } }) => {
    setEditingClosure(closure)
    setFormData({
      section_id: closure.section_id,
      start_date: new Date(closure.start_date),
      end_date: new Date(closure.end_date),
      is_full_day: !closure.start_time || !closure.end_time,
      start_time: closure.start_time || "09:00",
      end_time: closure.end_time || "17:00",
      reason: closure.reason
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdate = () => {
    if (!editingClosure) return
    if (!formData.reason.trim()) {
      toast.error("Please provide a reason for the closure")
      return
    }

    // Format dates in YYYY-MM-DD without timezone conversion
    const formatDate = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    updateClosureMutation.mutate({
      id: editingClosure.id,
      data: {
        start_date: formatDate(formData.start_date),
        end_date: formatDate(formData.end_date),
        start_time: formData.is_full_day ? null : formData.start_time,
        end_time: formData.is_full_day ? null : formData.end_time,
        reason: formData.reason
      }
    }, {
      onSuccess: () => {
        setIsEditDialogOpen(false)
        setEditingClosure(null)
        resetForm()
      }
    })
  }

  const handleDelete = (closure: SectionClosure & { section: { id: string, name: string, color: string } }) => {
    if (confirm(`Are you sure you want to delete this closure for ${closure.section.name}?`)) {
      deleteClosureMutation.mutate(closure.id)
    }
  }

  const isClosureActive = (closure: SectionClosure) => {
    const today = new Date().toISOString().split("T")[0]
    return closure.start_date <= today && closure.end_date >= today
  }

  const isClosureFuture = (closure: SectionClosure) => {
    const today = new Date().toISOString().split("T")[0]
    return closure.start_date > today
  }

  const renderClosureForm = (isEdit: boolean = false) => (
    <div className="space-y-4">
      {!isEdit && (
        <div>
          <Label htmlFor="section">Section *</Label>
          <Select
            value={formData.section_id}
            onValueChange={(value) => setFormData({ ...formData, section_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a section" />
            </SelectTrigger>
            <SelectContent>
              {sections.map((section) => (
                <SelectItem key={section.id} value={section.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: section.color }}
                    />
                    {section.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Start Date *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formData.start_date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.start_date ? format(formData.start_date, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.start_date}
                onSelect={(date) => {
                  if (date) {
                    setFormData({ ...formData, start_date: date })
                    // Auto-adjust end date if it's before start date
                    if (formData.end_date < date) {
                      setFormData({ ...formData, start_date: date, end_date: date })
                    }
                  }
                }}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Label>End Date *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formData.end_date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.end_date ? format(formData.end_date, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.end_date}
                onSelect={(date) => date && setFormData({ ...formData, end_date: date })}
                disabled={(date) => date < formData.start_date}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex items-center space-x-2 rounded-lg border p-4 bg-muted/50">
        <Switch
          id="is_full_day"
          checked={formData.is_full_day}
          onCheckedChange={(checked) => setFormData({ ...formData, is_full_day: checked })}
        />
        <div className="flex-1">
          <Label htmlFor="is_full_day" className="cursor-pointer">
            Full Day Closure
          </Label>
          <p className="text-xs text-muted-foreground">Section will be unavailable for the entire day(s)
          </p>
        </div>
      </div>

      {!formData.is_full_day && (
        <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-blue-50">
          <div>
            <Label htmlFor="start_time">Start Time *</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="end_time">End Time *</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="reason">Reason for Closure *</Label>
        <Textarea
          id="reason"
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          placeholder="e.g., Private event rental, Maintenance, Special booking"
          rows={3}
        />
      </div>

      <Alert className="bg-amber-50 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-900">
          <strong>Note:</strong> This section will not appear as an option for bookings during the closure period.
          The restaurant will remain open, but this specific section will be unavailable.
        </AlertDescription>
      </Alert>

      <div className="flex gap-2">
        <Button
          onClick={isEdit ? handleUpdate : handleCreate}
          disabled={isEdit ? updateClosureMutation.isPending : createClosureMutation.isPending}
        >
          {isEdit
            ? updateClosureMutation.isPending ? "Updating..." : "Update Closure"
            : createClosureMutation.isPending ? "Creating..." : "Create Closure"
          }
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (isEdit) {
              setIsEditDialogOpen(false)
              setEditingClosure(null)
            } else {
              setIsCreateDialogOpen(false)
            }
            resetForm()
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  )

  if (sections.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You need to create sections first before you can manage closures.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className={cn("space-y-3", compact && "w-full overflow-hidden")}>
      <div className="flex items-center justify-end">
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size={compact ? "sm" : "default"} className={compact ? "w-full text-xs h-8" : ""}>
              <Plus className="h-4 w-4 mr-1" />
              Add Closure
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Section Closure</DialogTitle>
              <DialogDescription>
                Schedule a closure for a section during specific dates and times
              </DialogDescription>
            </DialogHeader>
            {renderClosureForm(false)}
          </DialogContent>
        </Dialog>
      </div>

      <Card className={compact ? "shadow-none" : ""}>
        <CardContent className={compact ? "p-3" : "pt-6"}>
          {isLoading ? (
            <div className="text-center py-3 text-xs text-muted-foreground">Loading closures...</div>
          ) : !closures || closures.length === 0 ? (
            <div className={cn("text-center", compact ? "py-3" : "py-4")}>
              <Ban className={cn("mx-auto text-muted-foreground", compact ? "h-8 w-8 mb-2" : "h-12 w-12 mb-4")} />
              <h3 className={cn("font-medium", compact ? "text-sm mb-1" : "text-lg mb-2")}>No closures scheduled</h3>
              <p className={cn("text-muted-foreground", compact ? "text-xs mb-2" : "mb-4")}>
                Create a closure to temporarily make a section unavailable for bookings
              </p>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                size={compact ? "sm" : "default"}
                className={compact ? "w-full text-xs h-8" : ""}
              >
                <Plus className="h-4 w-4 mr-1" />
                Schedule First Closure
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closures.map((closure) => (
                  <TableRow key={closure.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: closure.section.color }}
                        />
                        <span className="font-medium">{closure.section.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <CalendarDaysIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        {format(new Date(closure.start_date), "MMM d, yyyy")}
                        {closure.start_date !== closure.end_date && (
                          <>
                            <span className="text-muted-foreground">→</span>
                            {format(new Date(closure.end_date), "MMM d, yyyy")}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {closure.start_time && closure.end_time ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {closure.start_time.substring(0, 5)} - {closure.end_time.substring(0, 5)}
                        </div>
                      ) : (
                        <Badge variant="outline">All Day</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{closure.reason}</TableCell>
                    <TableCell>
                      {isClosureActive(closure) ? (
                        <Badge variant="destructive">Active Now</Badge>
                      ) : isClosureFuture(closure) ? (
                        <Badge variant="secondary">Scheduled</Badge>
                      ) : (
                        <Badge variant="outline">Past</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(closure)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(closure)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Section Closure</DialogTitle>
            <DialogDescription>
              Update the closure details for {editingClosure?.section.name}
            </DialogDescription>
          </DialogHeader>
          {renderClosureForm(true)}
        </DialogContent>
      </Dialog>
    </div>
  )
}
