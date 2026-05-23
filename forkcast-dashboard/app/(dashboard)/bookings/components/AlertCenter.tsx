"use client"

import { useState } from "react"
import { format, differenceInMinutes } from "date-fns"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  AlertTriangle,
  Timer,
  Table2,
  CheckCircle2,
  XCircle,
  X,
  Clock,
  Zap,
  ChevronUp,
  ChevronDown
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Booking } from "@/types"

interface AlertCenterProps {
  bookings: Booking[]
  bookingStats: {
    pending: number
    withoutTables: number
    upcoming: number
  }
  onBulkConfirm: (bookingIds: string[]) => void
  onSelectBookings: (bookingIds: string[]) => void
  onAssignTable: (bookingId: string) => void
  className?: string
}

type AlertType = "critical" | "warning" | "info"

interface AlertItem {
  id: string
  type: AlertType
  title: string
  description: string
  count?: number
  icon: any
  actions?: Array<{
    label: string
    variant?: "default" | "destructive" | "outline"
    onClick: () => void
  }>
  bookings?: Booking[]
  dismissible?: boolean
}

export function AlertCenter({
  bookings,
  bookingStats,
  onBulkConfirm,
  onSelectBookings,
  onAssignTable,
  className
}: AlertCenterProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([])
  const [isCollapsed, setIsCollapsed] = useState(false)
  const now = new Date()

  // Generate alerts based on current data
  const generateAlerts = (): AlertItem[] => {
    const alerts: AlertItem[] = []

    // Critical: Bookings without tables
    const bookingsWithoutTables = bookings.filter(b =>
      b.status === "confirmed" && (!b.tables || b.tables.length === 0)
    )

    if (bookingsWithoutTables.length > 0) {
      alerts.push({
        id: "no-tables",
        type: "critical",
        title: `🚨 URGENT: ${bookingsWithoutTables.length} confirmed booking${bookingsWithoutTables.length > 1 ? 's' : ''} need table assignment`,
        description: "Guests may arrive without tables ready! Assign tables immediately.",
        count: bookingsWithoutTables.length,
        icon: Table2,
        bookings: bookingsWithoutTables.slice(0, 3),
        actions: [
          {
            label: `🎯 Assign Tables (${bookingsWithoutTables.length})`,
            variant: "default",
            onClick: () => onSelectBookings(bookingsWithoutTables.map(b => b.id))
          }
        ]
      })
    }

    // Critical: Urgent bookings (within 1 hour)
    const urgentBookings = bookings.filter(b =>
      b.status === "confirmed" &&
      new Date(b.booking_time).getTime() - now.getTime() < 3600000 &&
      new Date(b.booking_time).getTime() > now.getTime()
    )

    if (urgentBookings.length > 0) {
      const nextBookingTime = format(new Date(urgentBookings[0].booking_time), "HH:mm")
      alerts.push({
        id: "urgent-bookings",
        type: "critical",
        title: `🔥 NEXT HOUR: ${urgentBookings.length} booking${urgentBookings.length > 1 ? 's' : ''} starting soon (first at ${nextBookingTime})`,
        description: "Ensure tables are ready and staff is prepared",
        count: urgentBookings.length,
        icon: Clock,
        bookings: urgentBookings.slice(0, 3),
        dismissible: true
      })
    }

    // Warning: Pending bookings
    const pendingBookings = bookings.filter(b => b.status === "pending")
    if (pendingBookings.length > 0) {
      alerts.push({
        id: "pending-bookings",
        type: "warning",
        title: `⏰ ${pendingBookings.length} booking request${pendingBookings.length > 1 ? 's' : ''} awaiting your response`,
        description: "Accept or decline quickly to avoid automatic expiration",
        count: pendingBookings.length,
        icon: Timer,
        actions: [
          {
            label: `⚡ Quick Accept All (${pendingBookings.length})`,
            variant: "default",
            onClick: () => onBulkConfirm(pendingBookings.map(b => b.id))
          },
          {
            label: "Review Each",
            variant: "outline",
            onClick: () => onSelectBookings(pendingBookings.map(b => b.id))
          }
        ]
      })
    }

    // Warning: Expiring requests
    const expiringBookings = bookings.filter(b => {
      if (b.status !== "pending" || !(b as any).request_expires_at) return false
      const hoursLeft = differenceInMinutes(new Date((b as any).request_expires_at), now) / 60
      return hoursLeft < 2
    })

    if (expiringBookings.length > 0) {
      alerts.push({
        id: "expiring-requests",
        type: "warning",
        title: `${expiringBookings.length} request${expiringBookings.length > 1 ? 's' : ''} expiring soon`,
        description: "Less than 2 hours remaining",
        count: expiringBookings.length,
        icon: AlertTriangle,
        dismissible: true
      })
    }

    return alerts.filter(alert => !dismissedAlerts.includes(alert.id))
  }

  const alerts = generateAlerts()

  if (alerts.length === 0) {
    return null
  }

  const getAlertStyles = (type: AlertType) => {
    switch (type) {
      case "critical":
        return "border-red-200 bg-gradient-to-r from-red-50 to-red-100/50 shadow-red-100/50"
      case "warning":
        return "border-yellow-200 bg-gradient-to-r from-yellow-50 to-yellow-100/50 shadow-yellow-100/50"
      case "info":
        return "border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100/50 shadow-blue-100/50"
      default:
        return "border-border bg-card"
    }
  }

  const getIconColor = (type: AlertType) => {
    switch (type) {
      case "critical":
        return "text-red-600"
      case "warning":
        return "text-yellow-600"
      case "info":
        return "text-blue-600"
      default:
        return "text-muted-foreground"
    }
  }

  const getTextColor = (type: AlertType) => {
    switch (type) {
      case "critical":
        return "text-red-800"
      case "warning":
        return "text-yellow-800"
      case "info":
        return "text-blue-800"
      default:
        return "text-foreground"
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Collapse/Expand toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-semibold">
            Alert Center ({alerts.length})
          </h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="min-h-touch"
        >
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
          <span className="ml-2">{isCollapsed ? "Show" : "Hide"}</span>
        </Button>
      </div>

      {!isCollapsed && (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const Icon = alert.icon

            return (
              <Alert
                key={alert.id}
                className={cn(
                  "border-2 shadow-lg transition-all duration-300",
                  getAlertStyles(alert.type)
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Icon className={cn("h-5 w-5", getIconColor(alert.type))} />
                    {alert.type === "critical" && (
                      <div className="h-2 w-2 bg-red-500 rounded-full motion-safe:animate-pulse" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-3">
                    <AlertDescription>
                      <div className={cn("font-bold text-base", getTextColor(alert.type))}>
                        {alert.title}
                      </div>
                      <div className={cn("text-sm mt-1", getTextColor(alert.type).replace("800", "700"))}>
                        {alert.description}
                      </div>
                    </AlertDescription>

                    {/* Sample bookings */}
                    {alert.bookings && alert.bookings.length > 0 && (
                      <div className="space-y-2">
                        {alert.bookings.map((booking) => (
                          <div
                            key={booking.id}
                            className="flex items-center gap-3 p-3 bg-background/50 rounded-lg"
                          >
                            <span className="font-bold text-sm">
                              {format(new Date(booking.booking_time), "HH:mm")}
                            </span>
                            <span className="font-semibold text-sm">
                              {booking.guest_name || booking.user?.full_name}
                            </span>
                            <span className="text-sm">Party of {booking.party_size}</span>
                            {alert.id === "no-tables" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onAssignTable(booking.id)}
                                className="ml-auto"
                              >
                                <Table2 className="h-3 w-3 mr-1" />
                                Assign Table
                              </Button>
                            )}
                          </div>
                        ))}
                        {alert.count && alert.count > 3 && (
                          <div className="text-sm text-muted-foreground text-center py-2">
                            +{alert.count - 3} more...
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    {alert.actions && alert.actions.length > 0 && (
                      <div className="flex gap-3 flex-wrap">
                        {alert.actions.map((action, index) => (
                          <Button
                            key={index}
                            variant={action.variant || "default"}
                            size="default"
                            onClick={action.onClick}
                            className="h-9"
                          >
                            {action.label === "Confirm All" && (
                              <Zap className="mr-2 h-4 w-4" />
                            )}
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Dismiss button */}
                  {alert.dismissible && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDismissedAlerts(prev => [...prev, alert.id])}
                      className="flex-shrink-0 min-h-touch"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Alert>
            )
          })}
        </div>
      )}
    </div>
  )
}
