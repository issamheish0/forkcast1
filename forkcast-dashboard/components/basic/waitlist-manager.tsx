'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, differenceInMinutes, isToday, isTomorrow } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn, titleCase } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { CreateWaitlistDialog } from './create-waitlist-dialog'
import {
  Clock,
  Users,
  Phone,
  Mail,
  AlertCircle,
  CheckCircle,
  XCircle,
  Timer,
  Search,
  Filter,
  RefreshCw,
  UserCheck,
  MessageSquare,
  Calendar,
  Star,
  Plus
} from 'lucide-react'

interface WaitlistEntry {
  id: string
  user_id: string | null
  restaurant_id: string
  desired_date: string
  desired_time_range: string
  party_size: number
  table_type: string
  status: 'active' | 'notified' | 'booked' | 'expired' | 'cancelled'
  guest_name?: string
  guest_email?: string
  guest_phone?: string
  special_requests?: string
  notified_at?: string
  notification_expires_at?: string
  expires_at?: string
  created_at: string
  user?: {
    id: string
    full_name: string
    phone_number?: string
    avatar_url?: string
  }
}

interface WaitlistManagerProps {
  restaurantId: string
  currentTime: Date
  className?: string
}

export function WaitlistManager({
  restaurantId,
  currentTime,
  className
}: WaitlistManagerProps) {
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Dialog states
  const [showConvertDialog, setShowConvertDialog] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null)
  const [isConverting, setIsConverting] = useState(false)

  const supabase = createClient()
  const queryClient = useQueryClient()

  // Load waitlist entries
  const loadWaitlist = async (silent = false) => {
    if (!restaurantId) return

    try {
      if (!silent) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      // Fetch entries for today and tomorrow
      const now = new Date()
      const today = format(now, 'yyyy-MM-dd')
      const tomorrow = format(new Date(now.getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd')

      const { data, error } = await supabase
        .from('waitlist')
        .select(`
          *,
          user:profiles(
            id,
            full_name,
            phone_number,
            avatar_url
          )
        `)
        .eq('restaurant_id', restaurantId)
        .in('desired_date', [today, tomorrow])
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading waitlist:', error)
        if (!silent) {
          toast.error('Failed to load waitlist')
        }
        return
      }

      setWaitlistEntries(data || [])
    } catch (error) {
      console.error('Error:', error)
      if (!silent) {
        toast.error('Failed to load waitlist')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Load on mount and when restaurant changes
  useEffect(() => {
    loadWaitlist()
  }, [restaurantId])

  // Auto-refresh every 3 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (restaurantId && !refreshing) {
        loadWaitlist(true) // Silent refresh
      }
    }, 180000) // 3 minutes

    return () => clearInterval(interval)
  }, [restaurantId, refreshing])

  // Convert waitlist entry to booking
  const convertToBookingMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Must be logged in")

      const { data, error } = await supabase
        .rpc('convert_waitlist_to_booking', {
          p_waitlist_id: entryId,
          p_staff_user_id: user.id
        })

      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success("Waitlist entry converted to booking")
      setShowConvertDialog(false)
      setSelectedEntry(null)
      loadWaitlist()
    },
    onError: (error) => {
      console.error("Conversion error:", error)
      toast.error("Failed to convert waitlist entry")
    }
  })

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ entryId, newStatus }: { entryId: string; newStatus: string }) => {
      const updateData: any = { status: newStatus }

      if (newStatus === 'notified') {
        updateData.notified_at = new Date().toISOString()
        updateData.notification_expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      }

      const { error } = await supabase
        .from('waitlist')
        .update(updateData)
        .eq('id', entryId)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      toast.success(`Status updated to ${titleCase(variables.newStatus.replace(/_/g, ' '))}`)
      loadWaitlist()
    },
    onError: (error) => {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    }
  })

  // Filter entries
  const filteredEntries = waitlistEntries.filter(entry => {
    // Status filter
    if (statusFilter !== 'all' && entry.status !== statusFilter) return false

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const name = (entry.user?.full_name || entry.guest_name || '').toLowerCase()
      const phone = (entry.user?.phone_number || entry.guest_phone || '').toLowerCase()
      return name.includes(search) || phone.includes(search)
    }

    return true
  })

  // Get entry urgency
  const getEntryUrgency = (entry: WaitlistEntry) => {
    const [startTime] = entry.desired_time_range.split('-')
    const desiredTime = new Date(`${entry.desired_date}T${startTime}:00`)
    const minutesUntil = differenceInMinutes(desiredTime, currentTime)

    if (minutesUntil < 0) return 'overdue'
    if (minutesUntil <= 15) return 'urgent'
    if (minutesUntil <= 30) return 'soon'
    return 'normal'
  }

  // Stats
  const stats = {
    active: waitlistEntries.filter(e => e.status === 'active').length,
    notified: waitlistEntries.filter(e => e.status === 'notified').length,
    total: waitlistEntries.length
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Timer className="h-5 w-5 text-orange-500" />
            Waitlist
          </h2>
          <p className="text-muted-foreground text-sm">{stats.active === 0
              ? "No active waitlist entries"
              : `${stats.active} ${stats.active === 1 ? 'person' : 'people'} waiting`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.total > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 bg-green-500 rounded-full" />
                <span>{stats.active} active</span>
              </div>
              {stats.notified > 0 && (
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 bg-blue-500 rounded-full motion-safe:animate-pulse" />
                  <span>{stats.notified} notified</span>
                </div>
              )}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadWaitlist(false)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "motion-safe:animate-spin")} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Entry
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="notified">Notified</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Waitlist entries */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-4">
            <Clock className="h-6 w-6 motion-safe:animate-spin mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Loading waitlist...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <Card>
            <CardContent className="py-4">
              <div className="text-center">
                <Timer className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-medium text-lg mb-2">No waitlist entries</h3>
                <p className="text-muted-foreground text-sm">{searchTerm || statusFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Customers will appear here when tables are full during busy times'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredEntries.map((entry) => {
            const urgency = getEntryUrgency(entry)

            return (
              <Card
                key={entry.id}
                className={cn(
                  "transition-all duration-200 hover:shadow-md",
                  urgency === 'overdue' && "border-red-300 bg-red-50",
                  urgency === 'urgent' && "border-orange-300 bg-orange-50",
                  urgency === 'soon' && "border-yellow-300 bg-yellow-50",
                  entry.status === 'notified' && "border-blue-300 bg-blue-50",
                  entry.status === 'expired' && "opacity-60"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Customer info */}
                    <div className="flex items-start gap-3 flex-1">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={entry.user?.avatar_url} />
                        <AvatarFallback>
                          {(entry.user?.full_name || entry.guest_name || 'G')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">
                            {entry.user?.full_name || entry.guest_name || 'Guest'}
                          </h3>
                          <Badge
                            variant={
                              entry.status === 'active' ? 'default' :
                              entry.status === 'notified' ? 'secondary' :
                              entry.status === 'expired' ? 'outline' : 'destructive'
                            }
                            className="text-xs"
                          >
                            {titleCase(entry.status)}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground text-sm"><div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{entry.desired_time_range}</span>
                            <span className="text-xs">
                              ({isToday(parseISO(entry.desired_date)) ? 'Today' :
                                isTomorrow(parseISO(entry.desired_date)) ? 'Tomorrow' :
                                format(parseISO(entry.desired_date), 'MMM d')})
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{entry.party_size} {entry.party_size === 1 ? 'person' : 'people'}</span>
                          </div>
                          {(entry.user?.phone_number || entry.guest_phone) && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-4 w-4" />
                              <span>{entry.user?.phone_number || entry.guest_phone}</span>
                            </div>
                          )}
                          {entry.guest_email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-4 w-4" />
                              <span>{entry.guest_email}</span>
                            </div>
                          )}
                        </div>

                        {entry.special_requests && (
                          <div className="flex items-start gap-1 mt-2 text-sm">
                            <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <span className="text-muted-foreground italic">
                              "{entry.special_requests}"
                            </span>
                          </div>
                        )}

                        {entry.status === 'notified' && entry.notification_expires_at && (
                          <div className="mt-2">
                            <Alert className="border-blue-200 bg-blue-50">
                              <AlertCircle className="h-4 w-4 text-blue-600" />
                              <AlertDescription className="text-sm text-blue-800">
                                Notified - Expires at {format(parseISO(entry.notification_expires_at), 'h:mm a')}
                              </AlertDescription>
                            </Alert>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      {entry.status === 'active' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedEntry(entry)
                              setShowConvertDialog(true)
                            }}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({
                              entryId: entry.id,
                              newStatus: 'notified'
                            })}
                            disabled={updateStatusMutation.isPending}
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            Notify
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({
                              entryId: entry.id,
                              newStatus: 'expired'
                            })}
                            disabled={updateStatusMutation.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Decline
                          </Button>
                        </>
                      )}

                      {entry.status === 'notified' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedEntry(entry)
                              setShowConvertDialog(true)
                            }}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({
                              entryId: entry.id,
                              newStatus: 'expired'
                            })}
                            disabled={updateStatusMutation.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Convert to Booking Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Waitlist Request</DialogTitle>
            <DialogDescription>
              Convert this waitlist entry to a confirmed booking.
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={selectedEntry.user?.avatar_url} />
                    <AvatarFallback>
                      {(selectedEntry.user?.full_name || selectedEntry.guest_name || 'G')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {selectedEntry.user?.full_name || selectedEntry.guest_name || 'Guest'}
                    </p>
                    <p className="text-sm text-muted-foreground text-sm">{selectedEntry.party_size} {selectedEntry.party_size === 1 ? 'person' : 'people'} • {selectedEntry.desired_time_range}
                    </p>
                  </div>
                </div>
                {selectedEntry.special_requests && (
                  <p className="text-sm text-muted-foreground italic">
                    "{selectedEntry.special_requests}"
                  </p>
                )}
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This will create a confirmed booking and remove the entry from the waitlist.
                  The customer will be notified of their booking confirmation.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedEntry && convertToBookingMutation.mutate(selectedEntry.id)}
              disabled={convertToBookingMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {convertToBookingMutation.isPending ? "Converting..." : "Accept & Create Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Waitlist Dialog */}
      <CreateWaitlistDialog
        restaurantId={restaurantId}
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => loadWaitlist(false)}
      />
    </div>
  )
}
