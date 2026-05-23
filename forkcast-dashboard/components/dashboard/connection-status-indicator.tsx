"use client"

import { useEffect, useState } from 'react'
import { type RealtimeHealthStatus } from '@/hooks/use-realtime-health'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Activity,
  Clock,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface ConnectionStatusIndicatorProps {
  healthStatus: RealtimeHealthStatus
  onForceReconnect?: () => void
  showDetails?: boolean
  compact?: boolean
  isAggressivePolling?: boolean
  unhealthyDurationMinutes?: number
}

export function ConnectionStatusIndicator({
  healthStatus,
  onForceReconnect,
  showDetails = false,
  compact = false,
  isAggressivePolling = false,
  unhealthyDurationMinutes = 0
}: ConnectionStatusIndicatorProps) {
  const [isReconnecting, setIsReconnecting] = useState(false)

  // Handle reconnection loading state
  useEffect(() => {
    if (healthStatus.connectionState === 'reconnecting') {
      setIsReconnecting(true)
    } else {
      setIsReconnecting(false)
    }
  }, [healthStatus.connectionState])

  const getStatusInfo = () => {
    // If aggressive polling is active, show recovery mode
    if (isAggressivePolling) {
      return {
        icon: Zap,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        label: 'Recovery Mode',
        variant: 'secondary'
      }
    }

    switch (healthStatus.connectionState) {
      case 'connected':
        return {
          icon: healthStatus.isHealthy ? CheckCircle : AlertTriangle,
          color: healthStatus.isHealthy ? 'text-green-500' : 'text-yellow-500',
          bgColor: healthStatus.isHealthy ? 'bg-green-50' : 'bg-yellow-50',
          borderColor: healthStatus.isHealthy ? 'border-green-200' : 'border-yellow-200',
          label: healthStatus.isHealthy ? 'Connected' : 'Degraded',
          variant: healthStatus.isHealthy ? 'default' : 'secondary'
        }
      case 'disconnected':
        return {
          icon: WifiOff,
          color: 'text-red-500',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          label: 'Disconnected',
          variant: 'destructive'
        }
      case 'reconnecting':
        return {
          icon: RefreshCw,
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          label: 'Reconnecting',
          variant: 'secondary'
        }
      default:
        return {
          icon: Activity,
          color: 'text-gray-500',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          label: 'Unknown',
          variant: 'outline'
        }
    }
  }

  const statusInfo = getStatusInfo()
  const Icon = statusInfo.icon

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-5 w-5 p-0 rounded-full",
              statusInfo.bgColor,
              statusInfo.borderColor,
              "border"
            )}
          >
            <Icon
              className={cn(
                "h-3 w-3",
                statusInfo.color,
                isReconnecting && "motion-safe:animate-spin"
              )}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <ConnectionStatusDetails
            healthStatus={healthStatus}
            onForceReconnect={onForceReconnect}
            isAggressivePolling={isAggressivePolling}
            unhealthyDurationMinutes={unhealthyDurationMinutes}
          />
        </PopoverContent>
      </Popover>
    )
  }

  if (showDetails) {
    return (
      <div className={cn(
        "border rounded-lg p-3",
        statusInfo.bgColor,
        statusInfo.borderColor
      )}>
        <ConnectionStatusDetails
          healthStatus={healthStatus}
          onForceReconnect={onForceReconnect}
          isAggressivePolling={isAggressivePolling}
          unhealthyDurationMinutes={unhealthyDurationMinutes}
        />
      </div>
    )
  }

  return (
    <Badge
      variant={statusInfo.variant as any}
      className={cn(
        "gap-1 px-2 py-1",
        statusInfo.bgColor,
        statusInfo.color
      )}
    >
      <Icon
        className={cn(
          "h-3 w-3",
          isReconnecting && "motion-safe:animate-spin"
        )}
      />
      {statusInfo.label}
    </Badge>
  )
}

function ConnectionStatusDetails({
  healthStatus,
  onForceReconnect,
  isAggressivePolling,
  unhealthyDurationMinutes
}: {
  healthStatus: RealtimeHealthStatus
  onForceReconnect?: () => void
  isAggressivePolling?: boolean
  unhealthyDurationMinutes?: number
}) {
  const handleReconnect = () => {
    if (onForceReconnect) {
      onForceReconnect()
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Connection</h4>
        <Badge variant={healthStatus.isHealthy ? "default" : "destructive"} className="text-xs">
          {healthStatus.connectionState}
        </Badge>
      </div>

      <div className="text-xs text-muted-foreground text-sm"><div className="flex items-center justify-between">
          <span>Status:</span>
          <div className="flex items-center gap-1">
            {healthStatus.isHealthy ? (
              <CheckCircle className="h-3 w-3 text-green-500" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-red-500" />
            )}
            <span className={healthStatus.isHealthy ? "text-green-700" : "text-red-700"}>
              {healthStatus.isHealthy ? "Healthy" : "Unhealthy"}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span>Channels:</span>
          <span>{healthStatus.channelCount}</span>
        </div>
      </div>

      {!healthStatus.isHealthy && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          {isAggressivePolling
            ? `Recovery mode (${Math.round(unhealthyDurationMinutes || 0)}m)`
            : "Updates may be delayed"
          }
        </div>
      )}

      <div className="flex gap-1">
        <Button
          onClick={handleReconnect}
          size="sm"
          variant="outline"
          className="flex-1 h-6 text-xs px-2"
          disabled={healthStatus.connectionState === 'reconnecting'}
        >
          <RefreshCw className={cn(
            "h-3 w-3 mr-1",
            healthStatus.connectionState === 'reconnecting' && "motion-safe:animate-spin"
          )} />
          {healthStatus.connectionState === 'reconnecting' ? 'Reconnecting' : 'Reconnect'}
        </Button>
      </div>
    </div>
  )
}
