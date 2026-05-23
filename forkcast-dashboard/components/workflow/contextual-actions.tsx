"use client"

// Stub: workflow actions removed in ForkCast (no orders/kitchen)

interface ContextualActionsProps {
  entityType: 'booking' | 'order' | 'table'
  entityId: string
  currentStatus: string
  restaurantId: string
  data?: unknown
  onActionComplete?: (action: string, result: unknown) => void
  triggeredBy?: string
  className?: string
}

export function ContextualActions(_props: ContextualActionsProps) {
  return null
}

interface QuickActionBarProps {
  bookingId: string
  currentStatus: string
  restaurantId: string
  onActionComplete?: (action: string, result: unknown) => void
  className?: string
}

export function QuickActionBar(_props: QuickActionBarProps) {
  return null
}
