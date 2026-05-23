// components/customers/customer-details-dialog.tsx

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { customerUtils } from '@/lib/customer-utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  User,
  Mail,
  Phone,
  Calendar,
  CalendarDays,
  DollarSign,
  Users,
  Star,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  XCircle,
  CheckCircle,
  Link2,
  StickyNote,
  Clock,
  Ban,
  Shield,
  ShieldCheck,
  Copy,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import type { RestaurantCustomer, CustomerNote, CustomerRelationship, CustomerTag } from '@/types/customer'

// Function to determine if a color is light and needs dark text
const isLightColor = (hexColor: string): boolean => {
  // Convert hex to RGB
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  
  // Return true if light (needs dark text)
  return luminance > 0.6
}

type CustomerForSelection = {
  id: string
  guest_name?: string | null
  guest_email?: string | null
  profile?: {
    id: string
    full_name: string
    avatar_url?: string | null
  } | null
}

interface CustomerDetailsDialogProps {
  customer: RestaurantCustomer
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => void
  restaurantId: string
  currentUserId: string
  canManage: boolean
  currentBooking?: any // The booking that was clicked to open this dialog
  onBookingStatusChange?: (bookingId: string, status: string) => void
  onRequestDecline?: (booking: any) => void
  onCancelBooking?: (booking: any) => void
}

export function CustomerDetailsDialog({
  customer,
  open,
  onOpenChange,
  onUpdate,
  restaurantId,
  currentUserId,
  canManage,
  currentBooking,
  onBookingStatusChange,
  onRequestDecline,
  onCancelBooking
}: CustomerDetailsDialogProps) {
  const supabase = createClient()
  
  // State
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState<CustomerNote[]>(customer.notes || [])
  const [relationships, setRelationships] = useState<CustomerRelationship[]>([])
  const [bookingHistory, setBookingHistory] = useState<any[]>([])
  const [totalBookingCount, setTotalBookingCount] = useState<number>(customer.total_bookings)
  const [calculatedStats, setCalculatedStats] = useState<{
    completed: number
    cancelled: number
    declined: number
    noShow: number
  }>({ completed: 0, cancelled: 0, declined: 0, noShow: 0 })
  const [availableTags, setAvailableTags] = useState<CustomerTag[]>([])
  const [customerTags, setCustomerTags] = useState<CustomerTag[]>(customer.tags || [])
  const [availableCustomers, setAvailableCustomers] = useState<CustomerForSelection[]>([])
  const [customerWithEmail, setCustomerWithEmail] = useState<RestaurantCustomer>(customer)
  
  // Forms
  const [newNote, setNewNote] = useState({ note: '', category: 'general', is_important: false })
  const [newRelationship, setNewRelationship] = useState({
    related_customer_id: '',
    relationship_type: 'friend' as const,
    relationship_details: ''
  })

  // Payment link state (for pending_payment bookings)
  const [generatingPaymentLink, setGeneratingPaymentLink] = useState(false)
  const [paymentLink, setPaymentLink] = useState<string | null>(null)
  const [paymentLinkCopied, setPaymentLinkCopied] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Reset customer data when customer changes
  useEffect(() => {
    setCustomerTags(customer.tags || [])
    setCustomerWithEmail(customer)
    setNotes(customer.notes || [])
      setCalculatedStats({ completed: 0, cancelled: 0, declined: 0, noShow: 0 })
      setTotalBookingCount(customer.total_bookings)
  }, [customer])

  // Load additional data when dialog opens
  useEffect(() => {
    if (open) {
      loadAdditionalData()
    }
  }, [open, customer.id])

  const loadAdditionalData = async () => {
    try {
      setLoading(true)

      // Email is already included in the customer data from profiles
      setCustomerWithEmail(customer)

      // Load notes
      const { data: notesData } = await supabase
        .from('customer_notes')
        .select(`
          *,
          created_by_profile:profiles!customer_notes_created_by_fkey(
            full_name,
            avatar_url
          )
        `)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })

      // Load relationships
      const { data: relationshipsData } = await supabase
        .from('customer_relationships')
        .select(`
          *,
          related_customer:restaurant_customers!customer_relationships_related_customer_id_fkey(
            *,
            profile:profiles(full_name, avatar_url)
          ),
          customer:restaurant_customers!customer_relationships_customer_id_fkey(
            *,
            profile:profiles(full_name, avatar_url)
          )
        `)
        .or(`customer_id.eq.${customer.id},related_customer_id.eq.${customer.id}`)

      // Load booking history - comprehensive approach for all customer types
      let allBookings: any[] = []
      
      // For registered users with profiles, prioritize user_id matching
      if (customer.user_id && customer.profile) {
        const { data: userBookings, error: userBookingsError } = await supabase
          .from('bookings')
          .select('*')
          .eq('user_id', customer.user_id)
          .eq('restaurant_id', restaurantId)
          .neq('status', 'payment_pending')

        if (userBookingsError) {
          console.error('Error loading user bookings:', userBookingsError)
        } else {
          allBookings = [...allBookings, ...(userBookings || [])]
        }
      }

      // For guest customers or when user_id matching fails, try multiple approaches
      if (!customer.profile || allBookings.length === 0) {
        // Method 1: Query by guest_email (most reliable for guest customers)
        if (customer.guest_email) {
          const { data: emailBookings, error: emailBookingsError } = await supabase
            .from('bookings')
            .select('*')
            .eq('guest_email', customer.guest_email)
            .eq('restaurant_id', restaurantId)
            .neq('status', 'payment_pending')

          if (emailBookingsError) {
            console.error('Error loading email bookings:', emailBookingsError)
          } else {
            // Add bookings that aren't already in the list (by ID)
            const existingIds = new Set(allBookings.map(b => b.id))
            const newBookings = (emailBookings || []).filter(b => !existingIds.has(b.id))
            allBookings = [...allBookings, ...newBookings]
          }
        }

        // Method 2: Query by guest_name and guest_email combination (high confidence match)
        if (customer.guest_name && customer.guest_email) {
          const { data: nameEmailBookings, error: nameEmailError } = await supabase
            .from('bookings')
            .select('*')
            .eq('guest_name', customer.guest_name)
            .eq('guest_email', customer.guest_email)
            .eq('restaurant_id', restaurantId)
            .neq('status', 'payment_pending')

          if (nameEmailError) {
            console.error('Error loading name+email bookings:', nameEmailError)
          } else {
            // Add bookings that aren't already in the list (by ID)
            const existingIds = new Set(allBookings.map(b => b.id))
            const newBookings = (nameEmailBookings || []).filter(b => !existingIds.has(b.id))
            allBookings = [...allBookings, ...newBookings]
          }
        }

        // Method 3: Query by guest_name only (lower confidence, use carefully)
        if (customer.guest_name && allBookings.length === 0) {
          const { data: nameBookings, error: nameBookingsError } = await supabase
            .from('bookings')
            .select('*')
            .eq('guest_name', customer.guest_name)
            .eq('restaurant_id', restaurantId)
            .neq('status', 'payment_pending')

          if (nameBookingsError) {
            console.error('Error loading name bookings:', nameBookingsError)
          } else {
            // For name-only matches, be more selective to avoid false positives
            // Only include if guest_email matches or is null in both records
            const filteredBookings = (nameBookings || []).filter(booking => {
              if (!customer.guest_email && !booking.guest_email) return true
              if (customer.guest_email && booking.guest_email === customer.guest_email) return true
              return false
            })

            const existingIds = new Set(allBookings.map(b => b.id))
            const newBookings = filteredBookings.filter(b => !existingIds.has(b.id))
            allBookings = [...allBookings, ...newBookings]
          }
        }
      }

      // Sort and limit bookings
      const bookingsData = allBookings
        .sort((a, b) => new Date(b.booking_time).getTime() - new Date(a.booking_time).getTime())
        .slice(0, 10)


      // Use the deduplicated count from allBookings.length instead of double-counting
      // This ensures accuracy by avoiding double-counting bookings that exist under both user_id and email
      const actualTotalBookings = allBookings.length

      // Calculate booking statistics from actual bookings
      const completedCount = allBookings.filter(b => b.status === 'completed').length
      // Cancelled = only user-initiated cancellations
      const cancelledCount = allBookings.filter(b => b.status === 'cancelled_by_user').length
      // Declined = restaurant rejected (declined, auto_declined, or restaurant cancelled)
      const declinedCount = allBookings.filter(b => 
        b.status === 'declined_by_restaurant' || 
        b.status === 'auto_declined' || 
        b.status === 'cancelled_by_restaurant'
      ).length
      const noShowCount = allBookings.filter(b => b.status === 'no_show').length

      // Load available tags
      const { data: tagsData } = await supabase
        .from('customer_tags')
        .select('*')
        .eq('restaurant_id', restaurantId)

      // Load available customers (excluding current customer)
      const { data: customersData } = await supabase
        .from('restaurant_customers')
        .select(`
          id,
          guest_name,
          guest_email,
          profile:profiles(
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('restaurant_id', restaurantId)
        .neq('id', customer.id)
        .order('guest_name')

      setNotes(notesData || [])
      setRelationships(relationshipsData || [])
      setBookingHistory(bookingsData || [])
      setTotalBookingCount(actualTotalBookings)
      setCalculatedStats({
        completed: completedCount,
        cancelled: cancelledCount,
        declined: declinedCount,
        noShow: noShowCount
      })
      setAvailableTags(tagsData || [])
      // Transform customers data to fix profile array issue
      const transformedCustomers = (customersData || []).map((c: any) => ({
        id: c.id,
        guest_name: c.guest_name,
        guest_email: c.guest_email,
        profile: Array.isArray(c.profile) ? c.profile[0] : c.profile
      }))
      
      setAvailableCustomers(transformedCustomers)

    } catch (error) {
      console.error('Error loading additional data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Add note
  const handleAddNote = async () => {
    if (!newNote.note.trim()) return
    
    if (!currentUserId) {
      toast.error('Unable to add note: User not authenticated')
      return
    }

    try {
      const { data, error } = await supabase
        .from('customer_notes')
        .insert({
          customer_id: customer.id,
          note: newNote.note,
          category: newNote.category,
          is_important: newNote.is_important,
          created_by: currentUserId
        })
        .select(`
          *,
          created_by_profile:profiles!customer_notes_created_by_fkey(
            full_name,
            avatar_url
          )
        `)
        .single()

      if (error) throw error

      setNotes([data, ...notes])
      setNewNote({ note: '', category: 'general', is_important: false })
      toast.success('Note added successfully')
    } catch (error) {
      console.error('Error adding note:', error)
      toast.error('Failed to add note')
    }
  }

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('customer_notes')
        .delete()
        .eq('id', noteId)

      if (error) throw error

      setNotes(notes.filter(n => n.id !== noteId))
      toast.success('Note deleted successfully')
    } catch (error) {
      console.error('Error deleting note:', error)
      toast.error('Failed to delete note')
    }
  }

  // Add relationship
  const handleAddRelationship = async () => {
    if (!newRelationship.related_customer_id) return
    
    if (!currentUserId) {
      toast.error('Unable to add relationship: User not authenticated')
      return
    }

    try {
      const { data, error } = await supabase
        .from('customer_relationships')
        .insert({
          customer_id: customer.id,
          related_customer_id: newRelationship.related_customer_id,
          relationship_type: newRelationship.relationship_type,
          relationship_details: newRelationship.relationship_details,
          created_by: currentUserId
        })
        .select(`
          *,
          related_customer:restaurant_customers!customer_relationships_related_customer_id_fkey(
            *,
            profile:profiles(full_name, avatar_url)
          ),
          customer:restaurant_customers!customer_relationships_customer_id_fkey(
            *,
            profile:profiles(full_name, avatar_url)
          )
        `)
        .single()

      if (error) throw error

      setRelationships([...relationships, data])
      setNewRelationship({
        related_customer_id: '',
        relationship_type: 'friend',
        relationship_details: ''
      })
      toast.success('Relationship added successfully')
    } catch (error) {
      console.error('Error adding relationship:', error)
      toast.error('Failed to add relationship')
    }
  }

  // Toggle tag
  const handleToggleTag = async (tag: CustomerTag) => {
    if (!currentUserId) {
      toast.error('Unable to update tags: User not authenticated')
      return
    }

    if ((tag as any).is_system || (tag as any).system_key) {
      toast.message('Automated tags are managed by the system.', {
        description: 'They update automatically from booking activity.',
      })
      return
    }

    try {
      const hasTag = customerTags.some(t => t.id === tag.id)

      if (hasTag) {
        // Remove tag
        const { error } = await supabase
          .from('customer_tag_assignments')
          .delete()
          .eq('customer_id', customer.id)
          .eq('tag_id', tag.id)

        if (error) throw error

        setCustomerTags(customerTags.filter(t => t.id !== tag.id))
      } else {
        // Add tag
        const { error } = await supabase
          .from('customer_tag_assignments')
          .insert({
            customer_id: customer.id,
            tag_id: tag.id,
            assigned_by: currentUserId
          })

        if (error) throw error

        setCustomerTags([...customerTags, tag])
      }

      onUpdate()
      toast.success(`Tag ${hasTag ? 'removed' : 'added'} successfully`)
    } catch (error) {
      console.error('Error toggling tag:', error)
      toast.error('Failed to update tag')
    }
  }

  // Generate payment link for pending_payment bookings
  const handleGeneratePaymentLink = async () => {
    if (!currentBooking) return

    setGeneratingPaymentLink(true)
    setPaymentLinkCopied(false)

    try {
      const response = await fetch('/api/bookings/' + currentBooking.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_payment_link' })
      })

      if (!response.ok) {
        throw new Error('Failed to generate payment link')
      }

      const data = await response.json()
      if (data.checkoutData?.redirect_url) {
        setPaymentLink(data.checkoutData.redirect_url)
        toast.success('Payment link generated!')
      } else {
        toast.error('Failed to generate payment link')
      }
    } catch (error) {
      console.error('Error generating payment link:', error)
      toast.error('Failed to generate payment link')
    } finally {
      setGeneratingPaymentLink(false)
    }
  }

  // Copy payment link to clipboard
  const handleCopyPaymentLink = async () => {
    if (!paymentLink) return

    try {
      await navigator.clipboard.writeText(paymentLink)
      setPaymentLinkCopied(true)
      toast.success('Payment link copied to clipboard!')
      setTimeout(() => setPaymentLinkCopied(false), 3000)
    } catch (error) {
      console.error('Failed to copy:', error)
      toast.error('Failed to copy link')
    }
  }

  // Handle booking status change
  const handleConfirmBooking = () => {
    if (!currentBooking || !onBookingStatusChange) return
    setIsActionLoading(true)
    onBookingStatusChange(currentBooking.id, 'confirmed')
    setIsActionLoading(false)
    onUpdate()
  }

  const handleDeclineBooking = () => {
    if (!currentBooking) return
    setIsActionLoading(true)
    if (onRequestDecline) {
      onRequestDecline(currentBooking)
    } else if (onBookingStatusChange) {
      onBookingStatusChange(currentBooking.id, 'declined_by_restaurant')
    }
    setIsActionLoading(false)
    onUpdate()
  }

  const handleCancelBookingAction = () => {
    if (!currentBooking || !onCancelBooking) return
    setIsActionLoading(true)
    onCancelBooking(currentBooking)
    setIsActionLoading(false)
    onUpdate()
  }

  const getInitials = () => {
    const name = customerWithEmail.guest_name || customerWithEmail.profile?.full_name || 'G'
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const getNoteIcon = (category: string) => {
    switch (category) {
      case 'dietary': return '🍽️'
      case 'preference': return '⭐'
      case 'behavior': return '👤'
      case 'special_occasion': return '🎉'
      default: return '📝'
    }
  }

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId)
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[85%] md:w-[70%] lg:w-[50%] xl:w-[40%] max-w-none sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-lg font-semibold">Customer Details</SheetTitle>
        </SheetHeader>

        {/* Current Booking Actions - Show when a booking is selected */}
        {currentBooking && (
          <Card className={`mb-4 ${currentBooking.status === 'pending' ? 'border-yellow-300 bg-yellow-50/50' : currentBooking.status === 'pending_payment' ? 'border-amber-300 bg-amber-50/50' : 'border-blue-200 bg-blue-50/30'}`}>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Current Booking
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {currentBooking.status?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                {format(new Date(currentBooking.booking_time), 'MMM d, yyyy')} at {format(new Date(currentBooking.booking_time), 'h:mm a')} · Party of {currentBooking.party_size}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-3">
              {/* Pending booking actions */}
              {currentBooking.status === 'pending' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 text-xs"
                    disabled={isActionLoading}
                    onClick={handleDeclineBooking}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 text-xs bg-green-600 hover:bg-green-700"
                    disabled={isActionLoading}
                    onClick={handleConfirmBooking}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Confirm
                  </Button>
                </div>
              )}

              {/* Payment link section for pending_payment */}
              {currentBooking.status === 'pending_payment' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-amber-700">
                    <Link2 className="h-3 w-3" />
                    <span className="font-medium">Payment Link</span>
                  </div>
                  {paymentLink ? (
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={paymentLink}
                        className="text-xs h-8 flex-1"
                      />
                      <Button
                        size="sm"
                        variant={paymentLinkCopied ? "default" : "outline"}
                        className={`h-8 text-xs ${paymentLinkCopied && "bg-emerald-600 hover:bg-emerald-700"}`}
                        onClick={handleCopyPaymentLink}
                      >
                        {paymentLinkCopied ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs"
                      onClick={handleGeneratePaymentLink}
                      disabled={generatingPaymentLink}
                    >
                      {generatingPaymentLink ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 motion-safe:animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Link2 className="h-3 w-3 mr-1" />
                          Generate Payment Link
                        </>
                      )}
                    </Button>
                  )}
                  {paymentLink && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full h-7 text-xs text-muted-foreground"
                      onClick={handleGeneratePaymentLink}
                      disabled={generatingPaymentLink}
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${generatingPaymentLink ? 'motion-safe:animate-spin' : ''}`} />
                      Regenerate Link
                    </Button>
                  )}
                </div>
              )}

              {/* Confirmed booking actions */}
              {currentBooking.status === 'confirmed' && onCancelBooking && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  disabled={isActionLoading}
                  onClick={handleCancelBookingAction}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Cancel Booking
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <div className="space-y-4 text-sm">
          {/* Customer Header */}
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={customerWithEmail.profile?.avatar_url} />
              <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold">
                  {customerWithEmail.guest_name || customerWithEmail.profile?.full_name || 'Guest Customer'}
                </h2>
                {customerWithEmail.vip_status && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                    <Star className="h-3 w-3 mr-1" />
                    VIP
                  </Badge>
                )}
                {customerWithEmail.blacklisted && (
                  <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                    <Ban className="h-3 w-3 mr-1" />
                    Blacklisted
                  </Badge>
                )}
              </div>
              
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground text-sm">{(customerWithEmail.profile?.email || customerWithEmail.guest_email) && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    <span>{customerWithEmail.guest_email || customerWithEmail.profile?.email}</span>
                  </span>
                )}
                {(customerWithEmail.profile?.phone_number || customerWithEmail.guest_phone) && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {customerWithEmail.guest_phone || customerWithEmail.profile?.phone_number}
                  </span>
                )}
                {customerWithEmail.profile?.date_of_birth && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {format(new Date(customerWithEmail.profile.date_of_birth), 'MMM d, yyyy')} ({customerUtils.formatAge(customerWithEmail.profile.date_of_birth)})
                  </span>
                )}
                {customerWithEmail.first_visit && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Customer since {format(new Date(customerWithEmail.first_visit), 'MMM yyyy')}
                  </span>
                )}
                {customerWithEmail.profile?.membership_tier && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    {customerWithEmail.profile.membership_tier.charAt(0).toUpperCase() + customerWithEmail.profile.membership_tier.slice(1)} Member
                  </span>
                )}
              </div>

              {/* Tags (system tags first, with bolt) */}
              <div className="flex flex-wrap gap-2 mt-3">
                {[...customerTags]
                  .sort((a: any, b: any) => {
                    const aSys = (a?.is_system || a?.system_key) ? 0 : 1
                    const bSys = (b?.is_system || b?.system_key) ? 0 : 1
                    if (aSys !== bSys) return aSys - bSys
                    return (a?.priority ?? 999) - (b?.priority ?? 999)
                  })
                  .map((tag: any) => {
                    const sys = Boolean(tag?.is_system || tag?.system_key)
                    return (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="inline-flex items-center gap-1"
                        style={{
                          borderColor: tag.color,
                          color: isLightColor(tag.color) ? '#000000' : tag.color,
                        }}
                        title={sys ? `Auto: ${tag.description ?? tag.name}` : tag.description ?? tag.name}
                      >
                        {sys && <Sparkles className="h-3 w-3 opacity-70" />}
                        {tag.name}
                      </Badge>
                    )
                  })}
                {canManage && availableTags.some(tag => !customerTags.some(ct => ct.id === tag.id)) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6"
                    onClick={() => scrollToSection('section-tags')}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-2">
            <Card>
              <CardContent className="p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Bookings</p>
                <p className="text-lg font-semibold mt-1">{totalBookingCount}</p>
                {calculatedStats.completed > 0 && (
                  <p className="text-[11px] text-green-600 mt-0.5">
                    {calculatedStats.completed} completed
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Loyalty Points</p>
                <p className="text-lg font-semibold mt-1">
                  {customer.profile?.loyalty_points || 0}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">points earned</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Reliability</p>
                <p className="text-lg font-semibold mt-1">
                  {customer.profile?.user_rating?.toFixed(1) || '5.0'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">out of 5.0</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Issues</p>
                <p className="text-lg font-semibold text-red-600 mt-1">
                  {calculatedStats.noShow + calculatedStats.cancelled}
                </p>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {calculatedStats.noShow} no-shows, {calculatedStats.cancelled} cancelled
                </div>
                {calculatedStats.declined > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {calculatedStats.declined} declined
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Tabbed Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-9">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
              <TabsTrigger value="relationships" className="text-xs">Links</TabsTrigger>
              <TabsTrigger value="bookings" className="text-xs">Bookings</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Tags Section */}
              <Card>
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-sm font-medium">Customer Tags</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-2">
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {customerTags.length > 0 ? (
                        [...customerTags]
                          .sort((a: any, b: any) => {
                            const aSys = (a?.is_system || a?.system_key) ? 0 : 1
                            const bSys = (b?.is_system || b?.system_key) ? 0 : 1
                            if (aSys !== bSys) return aSys - bSys
                            return (a?.priority ?? 999) - (b?.priority ?? 999)
                          })
                          .map((tag: any) => {
                            const sys = Boolean(tag?.is_system || tag?.system_key)
                            return (
                              <Badge
                                key={tag.id}
                                variant="default"
                                className={`text-[10px] h-5 px-2 inline-flex items-center gap-1 ${sys ? 'cursor-default' : 'cursor-pointer hover:opacity-80'}`}
                                style={{ backgroundColor: tag.color }}
                                onClick={() => {
                                  if (sys) return
                                  if (canManage) handleToggleTag(tag)
                                }}
                                title={sys ? `Auto: ${tag.description ?? tag.name}` : undefined}
                              >
                                {sys && <Sparkles className="h-2.5 w-2.5 opacity-90" />}
                                {tag.name}
                                {canManage && !sys && <X className="h-2.5 w-2.5 ml-0.5" />}
                              </Badge>
                            )
                          })
                      ) : (
                        <p className="text-xs text-muted-foreground">No tags assigned</p>
                      )}
                    </div>
                    {canManage && availableTags.some(tag => !customerTags.some(ct => ct.id === tag.id) && !((tag as any).is_system || (tag as any).system_key)) && (
                      <div>
                        <Label className="text-xs font-medium">Add Tags</Label>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {availableTags
                            .filter(tag => !customerTags.some(ct => ct.id === tag.id))
                            .filter(tag => !((tag as any).is_system || (tag as any).system_key))
                            .map(tag => (
                              <Badge
                                key={tag.id}
                                variant="outline"
                                className="cursor-pointer hover:bg-muted text-[10px] h-5 px-2"
                                style={{ borderColor: tag.color, color: isLightColor(tag.color) ? '#000000' : tag.color }}
                                onClick={() => handleToggleTag(tag)}
                              >
                                <Plus className="h-2.5 w-2.5 mr-1" />
                                {tag.name}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Customer Profile Information */}
              {customer.profile && (
                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm font-medium">Dietary Information</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-2">
                    <div className="space-y-2">
                      {customer.profile.dietary_restrictions && customer.profile.dietary_restrictions.length > 0 && (
                        <div>
                          <Label className="text-xs font-medium">Dietary Restrictions</Label>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {customer.profile.dietary_restrictions.map((restriction, idx) => (
                              <Badge key={idx} variant="outline" className="text-[10px] h-4 px-1.5 text-orange-600 border-orange-600">
                                {restriction}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {customer.profile.allergies && customer.profile.allergies.length > 0 && (
                        <div>
                          <Label className="text-xs font-medium">Allergies</Label>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {customer.profile.allergies.map((allergy, idx) => (
                              <Badge key={idx} variant="destructive" className="text-[10px] h-4 px-1.5">
                                {allergy}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {customer.profile.favorite_cuisines && customer.profile.favorite_cuisines.length > 0 && (
                        <div>
                          <Label className="text-xs font-medium">Favorite Cuisines</Label>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {customer.profile.favorite_cuisines.map((cuisine, idx) => (
                              <Badge key={idx} variant="secondary" className="text-[10px] h-4 px-1.5 bg-blue-50 text-blue-700">
                                {cuisine}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {(!customer.profile.dietary_restrictions || customer.profile.dietary_restrictions.length === 0) &&
                       (!customer.profile.allergies || customer.profile.allergies.length === 0) &&
                       (!customer.profile.favorite_cuisines || customer.profile.favorite_cuisines.length === 0) && (
                        <p className="text-xs text-muted-foreground">No dietary information available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Customer Insights */}
              <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm font-medium">Customer Insights</CardTitle>
                <CardDescription className="text-xs">
                  Key information and behavioral patterns
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-2">
                <div className="grid gap-4">
                  {/* Visit Information */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-xs text-foreground">Visit History</h4>
                    <div className="space-y-2 text-xs">
                      {customer.last_visit && (
                        <div className="space-y-0.5">
                          <span className="text-muted-foreground">Last Visit</span>
                          <div className="text-foreground font-medium">
                            {format(new Date(customer.last_visit), 'MMM d, yyyy')}
                          </div>
                        </div>
                      )}
                      {customer.first_visit && (
                        <div className="space-y-0.5">
                          <span className="text-muted-foreground">First Visit</span>
                          <div className="text-foreground font-medium">
                            {format(new Date(customer.first_visit), 'MMM d, yyyy')}
                          </div>
                        </div>
                      )}
                      {totalBookingCount > 0 && (
                        <div className="space-y-0.5">
                          <span className="text-muted-foreground">Completion Rate</span>
                          <div className="text-foreground font-medium">
                            {((calculatedStats.completed / totalBookingCount) * 100).toFixed(0)}%
                          </div>
                          <div className="text-[11px] text-muted-foreground text-sm">{calculatedStats.completed} of {totalBookingCount} completed
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Preferences */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-xs text-foreground">Preferences</h4>
                    <div className="space-y-2 text-xs">
                      {customer.preferred_table_types && customer.preferred_table_types.length > 0 && (
                        <div className="space-y-0.5">
                          <span className="text-muted-foreground">Preferred Tables</span>
                          <div className="text-foreground font-medium">
                            {customer.preferred_table_types.map(type => type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ')}
                          </div>
                        </div>
                      )}
                      {customer.preferred_time_slots && customer.preferred_time_slots.length > 0 && (
                        <div className="space-y-0.5">
                          <span className="text-muted-foreground">Preferred Times</span>
                          <div className="text-foreground font-medium">
                            {customer.preferred_time_slots.map(slot => slot.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Special Notes */}
                {customer.blacklisted && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertCircle className="h-3 w-3" />
                      <span className="font-medium text-xs">Blacklisted Customer</span>
                    </div>
                    {customer.blacklist_reason && (
                      <p className="text-xs text-red-700 mt-1">
                        Reason: {customer.blacklist_reason}
                      </p>
                    )}
                  </div>
                )}
                
                {customer.vip_status && (
                  <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="flex items-center gap-2 text-yellow-800">
                      <Star className="h-3 w-3" />
                      <span className="font-medium text-xs">VIP Customer</span>
                    </div>
                    <p className="text-xs text-yellow-700 mt-1">
                      This customer receives priority booking and special treatment.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="space-y-4 mt-4">
              {/* Add Note Form */}
              {canManage && (
                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm font-medium">Add Note</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-2">
                    <div className="space-y-3">
                      <Textarea
                        placeholder="Add a note about this customer..."
                        value={newNote.note}
                        onChange={(e) => setNewNote({ ...newNote, note: e.target.value })}
                        rows={3}
                        className="text-sm"
                      />
                      
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex gap-2">
                          <Select
                            value={newNote.category}
                            onValueChange={(value: any) => setNewNote({ ...newNote, category: value })}
                          >
                            <SelectTrigger className="w-[140px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="general">General</SelectItem>
                              <SelectItem value="dietary">Dietary</SelectItem>
                              <SelectItem value="preference">Preference</SelectItem>
                              <SelectItem value="behavior">Behavior</SelectItem>
                              <SelectItem value="special_occasion">Special Occasion</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <label className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={newNote.is_important}
                              onChange={(e) => setNewNote({ ...newNote, is_important: e.target.checked })}
                              className="rounded"
                            />
                            <span className="text-xs">Important</span>
                          </label>
                        </div>
                        
                        <Button 
                          onClick={handleAddNote} 
                          disabled={!newNote.note.trim()} 
                          size="icon"
                          className="h-7 w-7 rounded-full"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notes List */}
              <div className="space-y-2">
                {notes.map((note) => (
                  <Card key={note.id} className={note.is_important ? 'border-orange-300' : ''}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-sm">{getNoteIcon(note.category)}</span>
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                              {note.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Badge>
                            {note.is_important && (
                              <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                                Important
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-xs">{note.note}</p>
                          
                          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                            <span>{note.created_by_profile?.full_name}</span>
                            <span>•</span>
                            <span>{format(new Date(note.created_at), 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                        
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteNote(note.id)}
                            className="h-7 w-7"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {notes.length === 0 && (
                  <Card>
                    <CardContent className="p-4 text-center text-muted-foreground text-xs">
                      No notes yet. Add a note to keep track of important information about this customer.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Relationships Tab */}
            <TabsContent value="relationships" className="space-y-4 mt-4">
              {/* Add Relationship Form */}
              {canManage && (
                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm font-medium">Add Relationship</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-2">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs font-medium">Select Customer</Label>
                        <Select
                          value={newRelationship.related_customer_id}
                          onValueChange={(value) => 
                            setNewRelationship({ ...newRelationship, related_customer_id: value })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs mt-1">
                            <SelectValue placeholder="Choose a customer..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {availableCustomers.length === 0 ? (
                              <div className="px-2 py-1.5 text-xs text-muted-foreground">No other customers found</div>
                            ) : (
                              availableCustomers.map((cust) => (
                                <SelectItem key={cust.id} value={cust.id}>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-5 w-5">
                                      <AvatarImage src={cust.profile?.avatar_url || undefined} />
                                      <AvatarFallback className="text-[10px]">
                                        {(cust.profile?.full_name || cust.guest_name || 'G').split(' ').map(n => n[0]).join('').toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs">{cust.profile?.full_name || cust.guest_name || 'Guest'}</span>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs font-medium">Relationship Type</Label>
                        <Select
                          value={newRelationship.relationship_type}
                          onValueChange={(value: any) => 
                            setNewRelationship({ ...newRelationship, relationship_type: value })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="spouse">Spouse</SelectItem>
                            <SelectItem value="parent">Parent</SelectItem>
                            <SelectItem value="child">Child</SelectItem>
                            <SelectItem value="sibling">Sibling</SelectItem>
                            <SelectItem value="friend">Friend</SelectItem>
                            <SelectItem value="colleague">Colleague</SelectItem>
                            <SelectItem value="partner">Partner</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button 
                        onClick={handleAddRelationship}
                        disabled={!newRelationship.related_customer_id}
                        size="sm"
                        className="h-8 text-xs w-full"
                      >
                        <Link2 className="h-3 w-3 mr-1.5" />
                        Add Relationship
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Relationships List */}
              <div className="space-y-2">
                {relationships.map((rel) => {
                  const isCurrentCustomerTheCreator = rel.customer_id === customer.id
                  const relatedCustomer = isCurrentCustomerTheCreator ? rel.related_customer : rel.customer
                  
                  return (
                    <Card key={rel.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={relatedCustomer?.profile?.avatar_url} />
                              <AvatarFallback className="text-xs">
                                {(relatedCustomer?.profile?.full_name || relatedCustomer?.guest_name || 'G')[0]}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div>
                              <p className="font-medium text-xs">
                                {relatedCustomer?.profile?.full_name || relatedCustomer?.guest_name}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {rel.relationship_type.charAt(0).toUpperCase() + rel.relationship_type.slice(1)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
                
                {relationships.length === 0 && (
                  <Card>
                    <CardContent className="p-4 text-center text-muted-foreground text-xs">
                      No relationships defined yet.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Bookings Tab */}
            <TabsContent value="bookings" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-sm font-medium">Recent Bookings</CardTitle>
                  <CardDescription className="text-xs">
                    Showing last 10 of {totalBookingCount} total bookings
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-2">
                  <div className="space-y-2">
                    {bookingHistory.map((booking) => (
                      <div
                        key={booking.id}
                        className="flex items-start justify-between p-2.5 border rounded-md hover:bg-muted/50 transition-colors"
                      >
                        <div className="space-y-1 flex-1">
                          <p className="font-medium text-xs">
                            {format(new Date(booking.booking_time), 'MMM d, yyyy - h:mm a')}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Party of {booking.party_size}
                            </span>
                          </div>
                        </div>
                        
                        <Badge
                          variant={
                            booking.status === 'completed' ? 'default' :
                            booking.status === 'confirmed' ? 'secondary' :
                            booking.status === 'cancelled_by_user' || booking.status === 'cancelled_by_restaurant' ? 'destructive' :
                            booking.status === 'no_show' ? 'destructive' :
                            'outline'
                          }
                          className="text-[10px] h-4 px-1.5"
                        >
                          {booking.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </Badge>
                      </div>
                    ))}
                    
                    {bookingHistory.length === 0 && (
                      <div className="text-center py-4">
                        <Calendar className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">No booking history found.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
