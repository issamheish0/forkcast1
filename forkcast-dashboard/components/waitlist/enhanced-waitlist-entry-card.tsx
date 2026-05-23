// components/waitlist/enhanced-waitlist-entry-card.tsx

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
  Bell,
  MessageSquare,
  Zap,
  Timer
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatTimeRange, getTableTypeDisplay, getStatusColor } from '@/lib/utils/time-utils'
import { QuickBookingDialog } from './quick-booking-dialog'
import { NotificationDialog } from './notification-dialog'
import type { WaitlistEntry } from '@/types'

interface EnhancedWaitlistEntryCardProps {
  entry: WaitlistEntry
  onStatusUpdate: (entryId: string, newStatus: string) => Promise<void>
  onBookingCreated?: (bookingId: string) => void
  onNotificationSent?: (entryId: string, method: string) => void
}

export function EnhancedWaitlistEntryCard({ 
  entry, 
  onStatusUpdate, 
  onBookingCreated,
  onNotificationSent 
}: EnhancedWaitlistEntryCardProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [showQuickBooking, setShowQuickBooking] = useState(false)
  const [showNotification, setShowNotification] = useState(false)

  const handleStatusUpdate = async (newStatus: string) => {
    setIsUpdating(true)
    try {
      await onStatusUpdate(entry.id, newStatus)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleQuickBook = () => {
    setShowQuickBooking(true)
  }

  const handleNotify = () => {
    setShowNotification(true)
  }

  const getWaitingTime = () => {
    const now = new Date()
    const created = parseISO(entry.created_at)
    const diffMs = now.getTime() - created.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins}m`
    }
    return `${diffMins}m`
  }

  const getPriorityLevel = () => {
    const waitingTime = new Date().getTime() - parseISO(entry.created_at).getTime()
    const hoursWaiting = waitingTime / (1000 * 60 * 60)
    
    if (hoursWaiting > 4) return 'high'
    if (hoursWaiting > 2) return 'medium'
    return 'low'
  }

  const priorityLevel = getPriorityLevel()
  const priorityColors = {
    high: 'border-red-200 bg-red-50',
    medium: 'border-yellow-200 bg-yellow-50',
    low: 'border-green-200 bg-green-50'
  }

  return (
    <>
      <Card className={`transition-all hover:shadow-md ${priorityColors[priorityLevel]}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4 flex-1">
              {/* Customer Info */}
              <Avatar className="h-12 w-12">
                <AvatarImage src={entry.user?.avatar_url} />
                <AvatarFallback>
                  {entry.user?.full_name ? 
                    entry.user.full_name.split(' ').map(n => n[0]).join('').toUpperCase() :
                    <User className="h-5 w-5" />
                  }
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-lg">
                    {entry.user?.full_name || 'Guest'}
                  </h3>
                  <Badge 
                    variant="secondary" 
                    className={`${getStatusColor(entry.status)} text-white`}
                  >
                    {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                  </Badge>
                  {priorityLevel === 'high' && (
                    <Badge variant="destructive" className="motion-safe:animate-pulse">
                      <Timer className="h-3 w-3 mr-1" />
                      Priority
                    </Badge>
                  )}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground mb-3">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    {entry.party_size} {entry.party_size === 1 ? 'guest' : 'guests'}
                  </div>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    {format(parseISO(entry.desired_date), 'MMM dd, yyyy')}
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    {formatTimeRange(entry.desired_time_range)}
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium">Table:</span> 
                    <span className="ml-1">{getTableTypeDisplay(entry.table_type)}</span>
                  </div>
                </div>
                
                {entry.user?.phone_number && (
                  <div className="flex items-center text-sm text-muted-foreground mb-2">
                    <Phone className="h-4 w-4 mr-2" />
                    {entry.user.phone_number}
                  </div>
                )}
                
                <div className="flex items-center justify-between text-xs text-muted-foreground text-sm"><span>Waiting for {getWaitingTime()}</span>
                  <span>Added {format(parseISO(entry.created_at), 'MMM dd, HH:mm')}</span>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-2 ml-4">
              {entry.status === 'active' && (
                <>
                  {/* Quick Actions for Active Status */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleNotify}
                    disabled={isUpdating}
                    className="hidden md:flex"
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    Notify
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleQuickBook}
                    disabled={isUpdating}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Quick Book
                  </Button>
                </>
              )}
              
              {entry.status === 'notified' && (
                <>
                  {/* Actions for Notified Status */}
                  <Button
                    size="sm"
                    onClick={handleQuickBook}
                    disabled={isUpdating}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Confirm Booking
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusUpdate('expired')}
                    disabled={isUpdating}
                  >
                    No Show
                  </Button>
                </>
              )}
              
              {['booked', 'expired'].includes(entry.status) && (
                <Badge variant="outline" className="text-xs">
                  {entry.status === 'booked' ? 'Completed' : 'Expired'}
                </Badge>
              )}
              
              {/* More Actions Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={isUpdating}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>More Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  {!['booked', 'expired'].includes(entry.status) && (
                    <>
                      <DropdownMenuItem onClick={handleQuickBook}>
                        <CalendarPlus className="h-4 w-4 mr-2" />
                        Create Booking
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleNotify}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Send Notification
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  
                  {entry.user?.phone_number && (
                    <DropdownMenuItem>
                      <Phone className="h-4 w-4 mr-2" />
                      Call Customer
                    </DropdownMenuItem>
                  )}
                  
                  {!['expired', 'booked'].includes(entry.status) && (
                    <DropdownMenuItem
                      onClick={() => handleStatusUpdate('expired')}
                      className="text-red-600"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Mark as No Show
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Booking Dialog */}
      <QuickBookingDialog
        open={showQuickBooking}
        onOpenChange={setShowQuickBooking}
        waitlistEntry={entry}
        onBookingCreated={(bookingId) => {
          onBookingCreated?.(bookingId)
          setShowQuickBooking(false)
        }}
      />

      {/* Notification Dialog */}
      <NotificationDialog
        open={showNotification}
        onOpenChange={setShowNotification}
        waitlistEntry={entry}
        onNotificationSent={(method) => {
          onNotificationSent?.(entry.id, method)
          setShowNotification(false)
        }}
      />
    </>
  )
}
