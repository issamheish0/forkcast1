// components/floorplan/capacity-warning-dialog.tsx — Smart capacity warning UI
"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Users, ArrowRight } from "lucide-react"
import { getCapacityBgClass } from "@/lib/section-capacity"
import type { CapacityImpact } from "@/lib/section-capacity"

interface CapacityWarningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  impact: CapacityImpact | null
  sectionName: string
  partySize: number
  onProceed: () => void
  onSelectAlternative?: (sectionId: string) => void
}

export function CapacityWarningDialog({
  open,
  onOpenChange,
  impact,
  sectionName,
  partySize,
  onProceed,
  onSelectAlternative,
}: CapacityWarningDialogProps) {
  if (!impact) return null

  const isOver100 = impact.afterPercentage > 100

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${isOver100 ? "text-destructive" : "text-[hsl(var(--status-overstay))]"}`} />
            Section Capacity {isOver100 ? "Exceeded" : "Warning"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Adding {partySize} guests to <strong>{sectionName}</strong> will{" "}
                {isOver100 ? "exceed" : "approach"} the section&apos;s capacity limit.
              </p>

              {/* Current vs After capacity bar */}
              <div className="bg-muted rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current</span>
                  <span className="font-medium">
                    {impact.currentCovers}/{impact.maxCovers} covers ({impact.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-muted-foreground/20 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      impact.percentage >= 90
                        ? "bg-[hsl(var(--status-taken))]"
                        : impact.percentage >= 75
                          ? "bg-[hsl(var(--status-overstay))]"
                          : "bg-[hsl(var(--status-available))]"
                    }`}
                    style={{ width: `${Math.min(100, impact.percentage)}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">After booking</span>
                  <Badge
                    variant="secondary"
                    className={getCapacityBgClass(impact.afterPercentage)}
                  >
                    {impact.currentCovers + partySize}/{impact.maxCovers} ({impact.afterPercentage}%)
                  </Badge>
                </div>
              </div>

              {/* Alternative sections */}
              {impact.alternativeSections.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Alternative sections with availability:</p>
                  <div className="space-y-1.5">
                    {impact.alternativeSections.slice(0, 3).map((alt) => (
                      <button
                        key={alt.section.id}
                        onClick={() => onSelectAlternative?.(alt.section.id)}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: alt.section.color }}
                          />
                          <span className="text-sm font-medium">{alt.section.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={getCapacityBgClass(alt.percentage)}
                          >
                            <Users className="h-3 w-3 mr-1" />
                            {alt.availableCovers} available
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onProceed}
            className={isOver100 ? "bg-destructive hover:bg-destructive/90 text-white" : ""}
          >
            {isOver100 ? "Proceed Anyway" : "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
