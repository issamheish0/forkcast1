"use client"

import { Clock, CheckCircle, AlertCircle, Utensils, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useRestaurantOperatingStatus } from "@/lib/hooks/use-open-hours"
import { cn } from "@/lib/utils"

interface RestaurantStatusBadgeProps {
  restaurantId: string
  compact?: boolean
}

export function RestaurantStatusBadge({ restaurantId, compact = false }: RestaurantStatusBadgeProps) {
  const {
    status,
    isOpen,
    serviceTypes,
    nextOpening,
    acceptsWalkins,
    isLoading
  } = useRestaurantOperatingStatus(restaurantId)

  if (isLoading) {
    return (
      <div className="flex items-center gap-1">
        <Clock className="h-3 w-3 motion-safe:animate-pulse" />
        <span className="text-xs">Loading...</span>
      </div>
    )
  }

  if (!status || !isOpen) {
    return null
  }

  const getStatusIcon = () => {
    if (isOpen?.isOpen && status.is_accepting_bookings) {
      return <CheckCircle className="h-3 w-3 text-green-400" />
    } else if (isOpen?.isOpen && !status.is_accepting_bookings) {
      return <Utensils className="h-3 w-3 text-orange-400" />
    } else {
      return <AlertCircle className="h-3 w-3 text-red-400" />
    }
  }

  const getStatusText = () => {
    if (isOpen?.isOpen && status.is_accepting_bookings) {
      return compact ? "Open" : "Open & Booking"
    } else if (isOpen?.isOpen && !status.is_accepting_bookings) {
      return compact ? "Walk-ins" : "Walk-ins Only"
    } else {
      return "Closed"
    }
  }

  const getStatusColor = () => {
    if (isOpen?.isOpen && status.is_accepting_bookings) {
      return "text-green-400"
    } else if (isOpen?.isOpen && !status.is_accepting_bookings) {
      return "text-orange-400"
    } else {
      return "text-red-400"
    }
  }

  const getDetailedTooltip = () => {
    if (!status) return "Status unknown"

    let tooltip = status.status_message

    if (status.current_service_type) {
      tooltip += `\nService: ${status.current_service_type.charAt(0).toUpperCase() + status.current_service_type.slice(1)}`
    }

    if (acceptsWalkins) {
      tooltip += "\n• Walk-ins welcome"
    }

    if (!status.is_accepting_bookings && status.next_booking_availability) {
      tooltip += `\nNext booking: ${status.next_booking_availability.day} ${status.next_booking_availability.time}`
    }

    if (!isOpen?.isOpen && nextOpening) {
      tooltip += `\nNext opening: ${nextOpening.day} ${nextOpening.time}`
    }

    return tooltip
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              {getStatusIcon()}
              <span className={cn("text-xs font-medium", getStatusColor())}>
                {getStatusText()}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="whitespace-pre-line text-sm max-w-xs">
              {getDetailedTooltip()}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "flex items-center gap-1 text-xs",
              isOpen?.isOpen && status.is_accepting_bookings
                ? "border-green-400/50 bg-green-400/10 text-green-400"
                : isOpen?.isOpen
                ? "border-orange-400/50 bg-orange-400/10 text-orange-400"
                : "border-red-400/50 bg-red-400/10 text-red-400"
            )}
          >
            {getStatusIcon()}
            <span>{getStatusText()}</span>
            {acceptsWalkins && isOpen?.isOpen && (
              <Users className="h-3 w-3 ml-1" />
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="whitespace-pre-line text-sm max-w-xs">
            {getDetailedTooltip()}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function RestaurantStatusIndicator({ restaurantId }: { restaurantId: string }) {
  const {
    status,
    isOpen,
    serviceTypes,
    acceptsWalkins,
    isLoading
  } = useRestaurantOperatingStatus(restaurantId)

  if (isLoading || !status || !isOpen) {
    return null
  }

  return (
    <div className="flex items-center gap-1">
      <div className={cn(
        "h-1.5 w-1.5 rounded-full",
        isOpen.isOpen && status.is_accepting_bookings
          ? "bg-green-400 motion-safe:animate-pulse"
          : isOpen.isOpen
          ? "bg-orange-400"
          : "bg-red-400"
      )} />
      <span className={cn(
        "text-xs font-bold",
        isOpen.isOpen && status.is_accepting_bookings
          ? "text-green-400"
          : isOpen.isOpen
          ? "text-orange-400"
          : "text-red-400"
      )}>
        {isOpen.isOpen ? "OPEN" : "CLOSED"}
      </span>
      {isOpen.isOpen && acceptsWalkins && (
        <span className="text-xs text-slate-400">• Walk-ins</span>
      )}
    </div>
  )
}
