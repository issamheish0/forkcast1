"use client"

import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CalendarIcon,
  Plus,
  RefreshCw,
  BarChart3,
  Settings,
  Zap
} from "lucide-react"

interface BookingsHeaderProps {
  bookingStats: {
    upcoming: number
    pending: number
    needingAttention: number
    confirmed: number
  }
  autoRefresh: boolean
  lastRefresh: Date
  showAnalytics: boolean
  onRefresh: () => void
  onToggleAnalytics: () => void
  onAddBooking: () => void
}

export function BookingsHeader({
  bookingStats,
  autoRefresh,
  lastRefresh,
  showAnalytics,
  onRefresh,
  onToggleAnalytics,
  onAddBooking
}: BookingsHeaderProps) {
  const now = new Date()

  return (
    <div className="relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 rounded-lg" />

      <div className="relative backdrop-blur-sm border border-border/50 rounded-lg p-4 tablet:p-6">
        <div className="flex flex-col tablet:flex-row items-start tablet:items-center justify-between gap-4">

          {/* Left side - Title and status */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CalendarIcon className="h-5 w-5 tablet:h-8 tablet:w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl tablet:text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                  Bookings Control
                </h1>
                <p className="text-sm tablet:text-lg text-muted-foreground font-medium">
                  Live restaurant operations • {format(now, 'EEEE, MMMM do')}
                </p>
              </div>
            </div>

            {/* Status bar */}
            <div className="flex items-center gap-4 tablet:gap-4 text-xs tablet:text-sm">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 tablet:h-3 tablet:w-3 rounded-full ${
                  autoRefresh
                    ? 'bg-green-500 motion-safe:animate-pulse shadow-lg shadow-green-500/50'
                    : 'bg-gray-400'
                }`} />
                <span className="font-medium">{autoRefresh ? 'LIVE' : 'PAUSED'}</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <span className="font-mono bg-muted px-2 py-1 rounded text-xs">
                {format(lastRefresh, 'HH:mm:ss')}
              </span>
              <div className="h-4 w-px bg-border" />
              <span className="font-medium">
                {bookingStats.upcoming || 0} upcoming today
              </span>

              {/* Attention indicator */}
              {bookingStats.needingAttention > 0 && (
                <>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 bg-red-500 rounded-full motion-safe:animate-pulse" />
                    <Badge variant="destructive" className="px-2 py-0.5 text-xs font-bold">
                      {bookingStats.needingAttention} need attention
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex flex-wrap gap-3 tablet:gap-4">

            {/* Refresh button */}
            <Button
              variant="outline"
              size="default"
              onClick={onRefresh}
              className="h-9 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <RefreshCw className="mr-2 h-5 w-5" />
              <span className="hidden tablet:inline">Refresh</span>
            </Button>

            {/* Analytics toggle */}
            <Button
              variant={showAnalytics ? "default" : "outline"}
              size="default"
              onClick={onToggleAnalytics}
              className="h-9 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <BarChart3 className="mr-2 h-5 w-5" />
              <span className="hidden tablet:inline">Analytics</span>
            </Button>

            {/* Settings button */}
            <Button
              variant="outline"
              size="default"
              className="h-9 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <Settings className="mr-2 h-5 w-5" />
              <span className="hidden tablet:inline">Settings</span>
            </Button>

            {/* Add booking - primary CTA */}
            <Button
              onClick={onAddBooking}
              size="default"
              className="h-9 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 font-semibold"
            >
              <Plus className="mr-2 h-5 w-5" />
              <span>Add Booking</span>
              <Zap className="ml-2 h-4 w-4 opacity-80" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
