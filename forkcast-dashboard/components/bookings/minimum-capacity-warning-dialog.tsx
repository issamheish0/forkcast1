"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Users, Table2 } from "lucide-react"

interface MinimumCapacityWarningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  onCancel: () => void
  partySize: number
  violatingTables: Array<{
    id: string
    table_number: string
    min_capacity: number
    capacity: number
  }>
  guestName?: string
  isLoading?: boolean
}

export function MinimumCapacityWarningDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  partySize,
  violatingTables,
  guestName,
  isLoading = false
}: MinimumCapacityWarningDialogProps) {
  const totalMinCapacity = violatingTables.reduce((sum, table) => sum + table.min_capacity, 0)
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-5 w-5" />
            Table Minimum Capacity Override
          </DialogTitle>
          <DialogDescription>
            The selected table(s) require more guests than this booking party size.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Booking Info */}
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
            <Users className="h-4 w-4 text-slate-600" />
            <span className="font-medium">
              {guestName && `${guestName} • `}Party of {partySize} guests
            </span>
          </div>

          {/* Warning Alert */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              The selected tables require a minimum of{" "}
              <strong>{totalMinCapacity} guests</strong>, but this booking is for{" "}
              <strong>{partySize} guests</strong> ({totalMinCapacity - partySize} guests short).
            </AlertDescription>
          </Alert>

          {/* Violating Tables */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-700">
              Tables with minimum capacity violations:
            </div>
            <div className="space-y-2">
              {violatingTables.map((table) => (
                <div
                  key={table.id}
                  className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded"
                >
                  <div className="flex items-center gap-2">
                    <Table2 className="h-4 w-4 text-red-600" />
                    <span className="font-medium">Table {table.table_number}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      Min: {table.min_capacity}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Max: {table.capacity}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Override Warning */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Are you sure you want to proceed?</strong>
              <br />
              This will override restaurant table minimum capacity rules. The table(s) may appear underutilized during this booking.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancel Assignment
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? "Assigning..." : "Override & Assign Tables"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
