// components/bookings/booking-warnings-dialog.tsx
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  ShieldAlert,
  CheckCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { BookingWarning, WarningLevel } from "@/lib/booking-warnings"

const LEVEL_CONFIG: Record<WarningLevel, {
  icon: typeof AlertTriangle
  borderClass: string
  bgClass: string
  titleClass: string
  iconClass: string
}> = {
  critical: {
    icon: ShieldAlert,
    borderClass: "border-red-300 dark:border-red-800",
    bgClass: "bg-red-50 dark:bg-red-950/30",
    titleClass: "text-red-700 dark:text-red-400",
    iconClass: "text-red-600 dark:text-red-500"
  },
  warning: {
    icon: AlertTriangle,
    borderClass: "border-orange-300 dark:border-orange-800",
    bgClass: "bg-orange-50 dark:bg-orange-950/30",
    titleClass: "text-orange-700 dark:text-orange-400",
    iconClass: "text-orange-500 dark:text-orange-500"
  },
  info: {
    icon: Info,
    borderClass: "border-blue-200 dark:border-blue-800",
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
    titleClass: "text-blue-700 dark:text-blue-400",
    iconClass: "text-blue-500 dark:text-blue-500"
  }
}

interface BookingWarningsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called when user proceeds despite warnings */
  onConfirm: () => void
  /** Called when user cancels the action */
  onCancel: () => void
  warnings: BookingWarning[]
  /** The action being performed — used for dialog title/button labels */
  actionLabel: string
  /** Extra description shown below the title */
  description?: string
  isLoading?: boolean
}

export function BookingWarningsDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  warnings,
  actionLabel,
  description,
  isLoading = false
}: BookingWarningsDialogProps) {
  const hasCritical = warnings.some(w => w.level === "critical")
  const criticalCount = warnings.filter(w => w.level === "critical").length
  const warningCount = warnings.filter(w => w.level === "warning").length
  const infoCount = warnings.filter(w => w.level === "info").length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className={cn(
            "flex items-center gap-2",
            hasCritical ? "text-red-600" : "text-orange-600"
          )}>
            {hasCritical ? (
              <ShieldAlert className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
            {hasCritical ? "Action Requires Attention" : "Heads Up"}
          </DialogTitle>
          <DialogDescription>
            {description || `Review the following before proceeding to ${actionLabel.toLowerCase()}.`}
          </DialogDescription>
        </DialogHeader>

        {/* Summary pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
              <ShieldAlert className="h-3 w-3" />
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
              <AlertTriangle className="h-3 w-3" />
              {warningCount} warning{warningCount > 1 ? "s" : ""}
            </span>
          )}
          {infoCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
              <Info className="h-3 w-3" />
              {infoCount} info
            </span>
          )}
        </div>

        {/* Warning cards */}
        <ScrollArea className={cn(warnings.length > 3 ? "max-h-[320px]" : "")}>
          <div className="space-y-3 pr-2">
            {warnings.map((warning) => {
              const config = LEVEL_CONFIG[warning.level]
              const Icon = config.icon
              return (
                <Alert
                  key={warning.id}
                  className={cn(config.borderClass, config.bgClass)}
                >
                  <Icon className={cn("h-4 w-4", config.iconClass)} />
                  <AlertTitle className={cn("text-sm font-semibold", config.titleClass)}>
                    {warning.title}
                  </AlertTitle>
                  <AlertDescription className="mt-1 text-sm text-foreground/80">
                    {warning.message}
                    {warning.suggestion && (
                      <p className="mt-1 text-xs text-muted-foreground italic">
                        {warning.suggestion}
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => {
              onCancel()
              onOpenChange(false)
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant={hasCritical ? "destructive" : "default"}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              "Processing..."
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                {hasCritical ? `${actionLabel} Anyway` : `Proceed to ${actionLabel}`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
