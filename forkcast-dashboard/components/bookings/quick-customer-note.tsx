// components/bookings/quick-customer-note.tsx
"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Plus, StickyNote } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface QuickCustomerNoteProps {
  customerId: string
  currentUserId: string
  onNoteAdded?: () => void
}

export function QuickCustomerNote({ customerId, currentUserId, onNoteAdded }: QuickCustomerNoteProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState("")
  const [category, setCategory] = useState<"general" | "dietary" | "preference" | "behavior" | "special_occasion">("general")
  const [isImportant, setIsImportant] = useState(false)

  const supabase = createClient()

  const handleAddNote = async () => {
    if (!note.trim()) {
      toast.error("Please enter a note")
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase
        .from('customer_notes')
        .insert({
          customer_id: customerId,
          note: note.trim(),
          category,
          is_important: isImportant,
          created_by: currentUserId
        })

      if (error) throw error

      toast.success("Note added successfully")
      setNote("")
      setCategory("general")
      setIsImportant(false)
      setOpen(false)
      onNoteAdded?.()

    } catch (error) {
      console.error('Error adding note:', error)
      toast.error("Failed to add note")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add Customer Note
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Add Customer Note
          </DialogTitle>
          <DialogDescription>
            Add a note about this customer that will be visible for future bookings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              placeholder="Enter your note about the customer..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={(value: any) => setCategory(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="dietary">Dietary Requirements</SelectItem>
                <SelectItem value="preference">Preferences</SelectItem>
                <SelectItem value="behavior">Behavior</SelectItem>
                <SelectItem value="special_occasion">Special Occasion</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="important"
              checked={isImportant}
              onChange={(e) => setIsImportant(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="important" className="text-sm">
              Mark as important
            </Label>
            {isImportant && (
              <Badge variant="destructive" className="text-xs">
                Important
              </Badge>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleAddNote} disabled={loading} className="flex-1">
              {loading ? "Adding..." : "Add Note"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
