// components/waitlist/waitlist-entry-card.tsx

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { 
  Clock, 
  Users, 
  Calendar,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  MoreVertical,
  User,
  CalendarPlus,
  Undo2,
  AlertTriangle
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent } from '@/components/ui/card'
import { formatTimeRange, getTableTypeDisplay, getStatusColor } from '@/lib/utils/time-utils'
import { titleCase } from '@/lib/utils'
import { ContextualActions, QuickActionBar } from '@/components/workflow/contextual-actions'
import type { WaitlistEntry } from '@/types'

interface WaitlistEntryCardProps {
  entry: WaitlistEntry
  onStatusUpdate: (entryId: string, newStatus: string) => Promise<void>
  onCreateBooking?: (entry: WaitlistEntry) => void
  previousStatus?: string // Track previous status for undo functionality
  onUndo?: (entryId: string) => Promise<void>
  undoExpiresAt?: number // Timestamp when undo expires
  restaurantId?: string // For integrated workflow actions
}

export function WaitlistEntryCard({ entry, onStatusUpdate, onCreateBooking, previousStatus, onUndo, restaurantId }:any) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleStatusUpdate = async (newStatus: string) => {
    setIsUpdating(true)
    try {
      await onStatusUpdate(entry.id, newStatus)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleUndo = async () => {
    if (onUndo) {
      setIsUpdating(true)
      try {
        await onUndo(entry.id)
      } finally {
        setIsUpdating(false)
      }
    }
  }

  const canUndo = previousStatus && previousStatus !== entry.status && 
                  ['notified', 'booked'].includes(entry.status) &&
                  ['active', 'notified'].includes(previousStatus) && // Only allow undo from these states
                  onUndo

  const getUndoText = () => {
    if (!previousStatus) return ''
    switch (previousStatus) {
      case 'active': return 'Back to Active'
      case 'notified': return 'Back to Notified'
      default: return 'Undo'
    }
  }

  const getStatusChangeDescription = () => {
    if (!canUndo || !previousStatus) return ''
    return `Changed from "${previousStatus}" to "${entry.status}"`
  }

  const handleCreateBooking = () => {
    if (onCreateBooking) {
      onCreateBooking(entry)
    }
  }

  return (
    <Card className={`hover:shadow-md transition-shadow ${canUndo ? 'ring-2 ring-orange-200 bg-orange-50/30' : ''}`}>
      <CardContent className="p-6">
        {canUndo && (
          <div className="mb-4 p-2 bg-orange-100 border border-orange-200 rounded-md flex items-center justify-between">
            <div className="flex items-center text-sm text-orange-800">
              <AlertTriangle className="h-4 w-4 mr-2" />
              {getStatusChangeDescription()}. You can undo this action.
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleUndo}
              disabled={isUpdating}
              className="text-orange-700 hover:bg-orange-200 h-6 px-2"
            >
              <Undo2 className="h-3 w-3 mr-1" />
              Undo
            </Button>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={entry.user?.avatar_url} />
              <AvatarFallback>
                <User className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="flex items-center space-x-3">
                <h3 className="font-semibold text-lg">
                  {entry.user?.full_name || 'Unknown Customer'}
                </h3>
                <Badge className={getStatusColor(entry.status)}>
                  {titleCase(entry.status)}
                </Badge>
              </div>
              <div className="flex items-center space-x-6 text-sm text-muted-foreground text-sm"><div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4" />
                  <span>{format(parseISO(entry.desired_date), 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>{formatTimeRange(entry.desired_time_range)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Users className="h-4 w-4" />
                  <span>{entry.party_size} {entry.party_size === 1 ? 'guest' : 'guests'}</span>
                </div>
              </div>
              <div className="flex items-center space-x-6 text-sm text-muted-foreground text-sm">{entry.user?.phone_number && (
                  <div className="flex items-center space-x-1">
                    <Phone className="h-4 w-4" />
                    <span>{entry.user.phone_number}</span>
                  </div>
                )}
                <div>
                  <span className="font-medium">Table Preference:</span> {getTableTypeDisplay(entry.table_type)}
                </div>
              </div>
              <div className="text-xs text-muted-foreground text-sm">Added on {format(parseISO(entry.created_at), 'MMM dd, yyyy at HH:mm')}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Undo Button - Show for recently changed statuses */}
            {canUndo && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleUndo}
                disabled={isUpdating}
                className="border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                <Undo2 className="h-4 w-4 mr-2" />
                {getUndoText()}
              </Button>
            )}

            {/* Integrated Workflow Actions */}
            {entry.status === 'booked' && entry.booking_id && restaurantId && (
              <div className="w-full mb-3">
                <QuickActionBar
                  bookingId={entry.booking_id}
                  currentStatus="confirmed" // Waitlist bookings start as confirmed
                  restaurantId={restaurantId}
                  onActionComplete={(action, result) => {
                    if ((result as any).success) {
                      // Refresh the waitlist or update UI as needed
                      console.log(`Workflow action ${action} completed:`, result)
                    }
                  }}
                  className="bg-green-50 border border-green-200"
                />
              </div>
            )}

            {/* Quick Action Buttons */}
            {entry.status === 'active' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusUpdate('notified')}
                  disabled={isUpdating}
                >
                  Mark Notified
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleStatusUpdate('booked')}
                  disabled={isUpdating}
                >
                  Mark as Booked
                </Button>
              </>
            )}
            {entry.status === 'notified' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCreateBooking}
                  disabled={isUpdating}
                >
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Create Booking
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleStatusUpdate('booked')}
                  disabled={isUpdating}
                >
                  Mark as Booked
                </Button>
              </>
            )}
            {entry.status === 'booked' && canUndo && (
              <div className="text-sm text-green-600 flex items-center">
                <CheckCircle className="h-4 w-4 mr-2" />
                Successfully booked
              </div>
            )}
            
            {/* More Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isUpdating}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {canUndo && (
                  <>
                    <DropdownMenuItem onClick={handleUndo} className="text-orange-700">
                      <Undo2 className="h-4 w-4 mr-2" />
                      {getUndoText()}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                
                {onCreateBooking && !['booked', 'expired'].includes(entry.status) && (
                  <DropdownMenuItem onClick={handleCreateBooking}>
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Create Booking
                  </DropdownMenuItem>
                )}
                
                {entry.status !== 'notified' && !['booked', 'expired'].includes(entry.status) && (
                  <DropdownMenuItem
                    onClick={() => handleStatusUpdate('notified')}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Mark as Notified
                  </DropdownMenuItem>
                )}
                
                {!['booked', 'expired'].includes(entry.status) && (
                  <DropdownMenuItem
                    onClick={() => handleStatusUpdate('booked')}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Booked
                  </DropdownMenuItem>
                )}
                
                {!['expired', 'booked'].includes(entry.status) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleStatusUpdate('expired')}
                      className="text-red-600"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Mark as Expired
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
