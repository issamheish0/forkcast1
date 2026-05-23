// components/bookings/booking-customer-details.tsx
"use client"

import { useMemo, memo } from "react"
import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  User,
  Mail,
  Phone,
  Calendar,
  Star,
  AlertCircle,
  StickyNote,
  Users,
  Clock,
  DollarSign,
  Link2,
  TrendingUp,
  Ban
} from "lucide-react"
import type { Booking } from "@/types"
import { QuickCustomerNote } from "./quick-customer-note"
import { CustomerBookingHistory } from "./customer-booking-history"
import { LowRatingFlag, CustomerRatingDisplay } from "@/components/ui/low-rating-flag"
import { titleCase } from "@/lib/utils"
import { customerUtils } from "@/lib/customer-utils"
import { useCustomerDetails } from "@/lib/hooks/use-customer-details"

// Function to determine if a color is light and needs dark text
const isLightColor = (hexColor: string): boolean => {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6
}

interface BookingCustomerDetailsProps {
  booking: Booking
  restaurantId: string
  currentUserId?: string
}

function BookingCustomerDetailsComponent({ booking, restaurantId, currentUserId }: BookingCustomerDetailsProps) {
  // Use optimized React Query hook with caching and parallel queries
  const { data: customerData, isLoading, refetch } = useCustomerDetails({
    booking,
    restaurantId,
    enabled: true,
  })

  // Memoize expensive calculations
  const customerStats = useMemo(() => {
    if (!customerData) return null

    const totalBookingCount = customerData.total_booking_count || 0
    const successfulBookings = totalBookingCount - customerData.no_show_count - customerData.cancelled_count
    const successRate = totalBookingCount > 0
      ? ((successfulBookings / totalBookingCount) * 100).toFixed(1)
      : 'N/A'
    const avgSpend = totalBookingCount > 0
      ? (customerData.total_spent / totalBookingCount).toFixed(2)
      : '0.00'

    return {
      totalBookingCount,
      successRate,
      avgSpend,
    }
  }, [customerData])

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="motion-safe:animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Fallback for no customer data (walk-ins, anonymous guests, or staff members)
  if (!customerData) {
    const hasGuestInfo = booking.guest_name || booking.guest_email || booking.guest_phone
    const isAnonymous = !hasGuestInfo || booking.guest_name?.toLowerCase().includes('anonymous')

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            {isAnonymous ? 'Anonymous Guest / Walk-in' : 'Guest Booking'}
          </CardTitle>
          {(booking.guest_name || booking.guest_email || booking.guest_phone) && (
            <CardDescription>
              <span className="block text-sm">{booking.guest_name}</span>
              {booking.guest_email && (
                <span className="flex items-center gap-2 text-sm mt-1">
                  <Mail className="h-3 w-3" />
                  {booking.guest_email}
                </span>
              )}
              {booking.guest_phone && (
                <span className="flex items-center gap-2 text-sm mt-1">
                  <Phone className="h-3 w-3" />
                  {booking.guest_phone}
                </span>
              )}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground text-sm">{isAnonymous
                ? 'This is an anonymous booking or walk-in. No customer profile data is available.'
                : 'This guest has not been added to the restaurant\'s customer database yet.'
              }
            </div>

            {/* Show booking details */}
            <div className="border-t pt-3 mt-3">
              <h4 className="text-sm font-medium mb-2">Booking Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{format(new Date(booking.booking_time), 'MMM d, yyyy - h:mm a')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Party of {booking.party_size}</span>
                </div>
                {booking.special_requests && (
                  <div className="flex items-start gap-2 mt-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="font-medium">Special Requests:</div>
                      <div className="text-muted-foreground">{booking.special_requests}</div>
                    </div>
                  </div>
                )}
                {booking.occasion && (
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-muted-foreground" />
                    <span>Occasion: {booking.occasion}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Customer Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={customerData.profile?.avatar_url} />
                <AvatarFallback>
                  {(customerData.profile?.full_name || customerData.guest_name || 'G')
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">
                  {customerData.profile?.full_name || customerData.guest_name}
                  {customerData.profile?.date_of_birth && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({customerUtils.formatAge(customerData.profile.date_of_birth)})
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Customer since {customerData.first_visit ? format(new Date(customerData.first_visit), 'MMM d, yyyy') : 'Unknown'}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {customerData.profile?.user_rating && (
                <CustomerRatingDisplay
                  rating={customerData.profile.user_rating}
                  size="md"
                  className="bg-white border border-gray-200 px-2 py-1 rounded"
                />
              )}
              {customerData.vip_status && (
                <Badge variant="default" className="bg-gold text-gold-foreground">
                  <Star className="h-3 w-3 mr-1" />
                  VIP
                </Badge>
              )}
              {customerData.blacklisted && (
                <Badge variant="destructive">
                  <Ban className="h-3 w-3 mr-1" />
                  Blacklisted
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Contact Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              {(customerData.profile?.phone_number || customerData.guest_phone) && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{customerData.profile?.phone_number || customerData.guest_phone}</span>
                </div>
              )}
              {customerData.guest_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{customerData.guest_email}</span>
                </div>
              )}
              {customerData.last_visit && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Last Visit: {format(new Date(customerData.last_visit), 'MMM d, yyyy')}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span>Total Bookings: {customerStats?.totalBookingCount}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>Total Spent: ${customerData.total_spent?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>Avg Party Size: {customerData.average_party_size}</span>
              </div>
            </div>
          </div>

          {/* Customer Tags */}
          {customerData.tags && customerData.tags.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Customer Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {customerData.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      style={{
                        borderColor: tag.color,
                        color: isLightColor(tag.color) ? '#000000' : tag.color
                      }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Dietary & Allergies */}
          {(customerData.profile?.allergies || customerData.profile?.dietary_restrictions) && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  Dietary Information
                </h4>
                <div className="space-y-1 text-sm">
                  {customerData.profile?.allergies && customerData.profile.allergies.length > 0 && (
                    <div>
                      <span className="font-medium text-red-600">Allergies: </span>
                      <span>{customerData.profile.allergies.join(', ')}</span>
                    </div>
                  )}
                  {customerData.profile?.dietary_restrictions && customerData.profile.dietary_restrictions.length > 0 && (
                    <div>
                      <span className="font-medium text-orange-600">Dietary Restrictions: </span>
                      <span>{customerData.profile.dietary_restrictions.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Blacklist Information */}
          {customerData.blacklisted && customerData.blacklist_reason && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-red-600">
                  <Ban className="h-4 w-4" />
                  Blacklist Reason
                </h4>
                <div className="text-sm text-red-700 bg-red-50 p-2 rounded border border-red-200">
                  {customerData.blacklist_reason}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Low Rating Alert */}
      {customerData.profile?.user_rating && customerData.profile.user_rating <= 2 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <LowRatingFlag
                  rating={customerData.profile.user_rating}
                  size="sm"
                  showValue={true}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">
                  Customer has a low rating ({customerData.profile.user_rating.toFixed(1)}/5.0)
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Please provide exceptional service and monitor this booking closely.
                  Consider reviewing previous visit notes and any reported issues.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Notes */}
      {customerData.notes && customerData.notes.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <CardTitle className="text-lg flex items-center gap-2 flex-shrink-0">
                <StickyNote className="h-5 w-5" />
                Customer Notes
              </CardTitle>
              {currentUserId && (
                <div className="flex-shrink-0">
                  <QuickCustomerNote
                    key={`note-add-${customerData.id}`}
                    customerId={customerData.id}
                    currentUserId={currentUserId}
                    onNoteAdded={refetch}
                  />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-32">
              <div className="space-y-3 pr-2">
                {customerData.notes
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((note) => (
                    <div key={note.id} className="border-l-2 border-gray-200 pl-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm break-words">{note.note}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge
                              variant="outline"
                              className="text-xs"
                            >
                              {titleCase(note.category)}
                            </Badge>
                            {note.is_important && (
                              <Badge variant="destructive" className="text-xs">
                                Important
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground text-sm">
                        {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                        {note.created_by_profile && (
                          <span> by {note.created_by_profile.full_name}</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Add Note Section for customers without notes */}
      {(!customerData.notes || customerData.notes.length === 0) && currentUserId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              Customer Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">No notes for this customer yet.</p>
              <QuickCustomerNote
                key={`note-add-empty-${customerData.id}`}
                customerId={customerData.id}
                currentUserId={currentUserId}
                onNoteAdded={refetch}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Relationships */}
      {customerData.relationships && customerData.relationships.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Relationships
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customerData.relationships.map((rel) => {
                const isCurrentCustomerTheCreator = rel.customer_id === customerData.id
                const relatedCustomer = isCurrentCustomerTheCreator ? rel.related_customer : rel.customer

                return (
                  <div key={rel.id} className="flex items-center gap-3 p-2 border rounded">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={relatedCustomer?.profile?.avatar_url} />
                      <AvatarFallback>
                        {(relatedCustomer?.profile?.full_name || relatedCustomer?.guest_name || 'G')[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {relatedCustomer?.profile?.full_name || relatedCustomer?.guest_name}
                      </p>
                      <p className="text-xs text-muted-foreground text-sm">{rel.relationship_type}
                        {rel.relationship_details && ` - ${rel.relationship_details}`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Booking History */}
      {customerData.bookings && customerData.bookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {customerData.bookings.map((pastBooking) => (
                <div key={pastBooking.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(pastBooking.booking_time), 'MMM d, yyyy - h:mm a')}
                    </p>
                    <p className="text-xs text-muted-foreground text-sm">Party of {pastBooking.party_size}
                    </p>
                  </div>
                  <Badge
                    variant={
                      pastBooking.status === 'completed' ? 'default' :
                      pastBooking.status === 'cancelled_by_user' ? 'destructive' :
                      pastBooking.status === 'no_show' ? 'destructive' :
                      'secondary'
                    }
                  >
                    {titleCase(pastBooking.status)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Booking History */}
      <CustomerBookingHistory
        customerId={customerData.id}
        currentBookingId={booking.id}
        restaurantId={restaurantId}
      />

      {/* Customer Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">No Shows</div>
              <div className="font-medium">{customerData.no_show_count}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Cancellations</div>
              <div className="font-medium">{customerData.cancelled_count}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Success Rate</div>
              <div className="font-medium">{customerStats?.successRate}%</div>
            </div>
            <div>
              <div className="text-muted-foreground">Avg Spend</div>
              <div className="font-medium">${customerStats?.avgSpend}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
export const BookingCustomerDetails = memo(BookingCustomerDetailsComponent)
export default BookingCustomerDetails
