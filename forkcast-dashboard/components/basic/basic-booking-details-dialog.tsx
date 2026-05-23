// components/basic/basic-booking-details-dialog.tsx
"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { format, parseISO, differenceInDays, addYears, isBefore, startOfDay, formatDistanceToNow } from "date-fns"
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select"
import {
 Calendar as CalendarIcon,
 Clock,
 Users,
 Phone,
 Mail,
 Star,
 AlertTriangle,
 MessageSquare,
 Gift,
 Cake,
 User,
 History,
 Tag,
 FileText,
 CheckCircle,
 XCircle,
 MapPin,
 Utensils,
 AlertCircle,
 PartyPopper,
 Copy,
 DollarSign,
 Heart,
 UserPlus,
 Crown,
 Shield,
 Ban,
 Sparkles,
 Link2,
 CalendarDays,
 Loader2,
 Plus,
 X,
 Trash2,
 StickyNote,
 Settings,
 ExternalLink,
 CreditCard,
} from "lucide-react"
import { toast } from "react-hot-toast"
import { cn } from "@/lib/utils"

// Types for tags and customers
interface CustomerTag {
 id: string
 name: string
 color: string
 description?: string
}

interface CustomerForSelection {
 id: string
 guest_name?: string | null
 guest_email?: string | null
 profile?: {
 id: string
 full_name: string
 avatar_url?: string | null
 } | null
}

interface BasicBookingDetailsDialogProps {
 open: boolean
 onOpenChange: (open: boolean) => void
 booking: any
 restaurantId: string
 hasGuestCRM?: boolean
 onStatusChange?: () => void
}

interface CustomerData {
 id: string
 user_id: string | null
 guest_name: string | null
 guest_email: string | null
 guest_phone: string | null
 total_bookings: number
 total_spent: number
 average_party_size: number
 first_visit: string | null
 last_visit: string | null
 no_show_count: number
 cancelled_count: number
 vip_status: boolean
 blacklisted: boolean
 blacklist_reason: string | null
 preferred_table_types: string[] | null
 preferred_time_slots: string[] | null
 notes: Array<{
 id: string
 note: string
 category: string
 is_important: boolean
 created_at: string
 created_by_name?: string
 }>
 tags: Array<{
 id: string
 name: string
 color: string
 description?: string
 }>
 relationships: Array<{
 id: string
 related_customer_id: string
 relationship_type: string
 relationship_details: string | null
 related_customer: {
 id: string
 guest_name: string | null
 vip_status: boolean
 }
 }>
 profile: {
 full_name: string
 email?: string
 phone_number?: string
 avatar_url?: string
 date_of_birth?: string
 allergies?: string[]
 dietary_restrictions?: string[]
 favorite_cuisines?: string[]
 preferred_party_size?: number
 user_rating?: number
 loyalty_points?: number
 membership_tier?: string
 } | null
}

interface BookingHistoryItem {
 id: string
 booking_time: string
 party_size: number
 status: string
 occasion?: string
 special_requests?: string
 created_at: string
 source?: string
}

// Helper function to check if birthday is upcoming
const getBirthdayInfo = (dateOfBirth: string | null | undefined) => {
 if (!dateOfBirth) return null
 
 const today = startOfDay(new Date())
 const birthDate = new Date(dateOfBirth)
 
 let nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())
 
 if (isBefore(nextBirthday, today)) {
 nextBirthday = addYears(nextBirthday, 1)
 }
 
 const daysUntil = differenceInDays(nextBirthday, today)
 
 return {
 daysUntil,
 isToday: daysUntil === 0,
 isSoon: daysUntil > 0 && daysUntil <= 14
 }
}

// Function to determine if a color is light
const isLightColor = (hexColor: string): boolean => {
 const hex = hexColor.replace('#', '')
 if (hex.length !== 6) return false
 const r = parseInt(hex.substr(0, 2), 16)
 const g = parseInt(hex.substr(2, 2), 16)
 const b = parseInt(hex.substr(4, 2), 16)
 const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
 return luminance > 0.6
}

const formatStatus = (status: string) => {
 const statusMap: Record<string, string> = {
 "pending": "Pending",
 "pending_payment": "Awaiting Payment",
 "cancelled_by_user": "Cancelled",
 "cancelled_by_restaurant": "Cancelled by Restaurant",
 "confirmed": "Confirmed",
 "declined_by_restaurant": "Declined",
 "auto_declined": "Auto-Declined",
 "completed": "Completed",
 "no_show": "No Show",
 "arrived": "Arrived",
 "seated": "Seated"
 }
 return statusMap[status] || status
}

const getStatusColor = (status: string) => {
 switch (status) {
 case "completed": return "bg-green-100 text-green-800 border-green-200"
 case "confirmed": return "bg-blue-100 text-blue-800 border-blue-200"
 case "pending": return "bg-orange-100 text-orange-800 border-orange-200"
 case "pending_payment": return "bg-amber-100 text-amber-800 border-amber-200"
 case "arrived":
 case "seated": return "bg-purple-100 text-purple-800 border-purple-200"
 case "declined_by_restaurant":
 case "auto_declined":
 case "cancelled_by_user":
 case "cancelled_by_restaurant":
 case "no_show": return "bg-red-100 text-red-800 border-red-200"
 default: return "bg-gray-100 text-gray-800 border-gray-200"
 }
}

// Generate automatic insights based on customer data
const generateInsights = (customer: CustomerData, bookingHistory: BookingHistoryItem[]) => {
 const insights: Array<{ type: 'positive' | 'warning' | 'neutral' | 'info'; icon: any; text: string }> = []
 
 // Loyalty insights
 if (customer.total_bookings >= 10) {
 insights.push({
 type: 'positive',
 icon: Crown,
 text: `Loyal customer with ${customer.total_bookings} bookings`
 })
 } else if (customer.total_bookings === 1) {
 insights.push({
 type: 'info',
 icon: UserPlus,
 text: 'First-time guest - make a great impression!'
 })
 }
 
 // Reliability score
 const totalAttempted = customer.total_bookings + customer.cancelled_count + customer.no_show_count
 if (totalAttempted > 0) {
 const reliabilityScore = Math.round((customer.total_bookings / totalAttempted) * 100)
 if (reliabilityScore === 100 && customer.total_bookings > 3) {
 insights.push({
 type: 'positive',
 icon: CheckCircle,
 text: 'Perfect attendance record - very reliable guest'
 })
 } else if (reliabilityScore < 70) {
 insights.push({
 type: 'warning',
 icon: AlertTriangle,
 text: `${100 - reliabilityScore}% cancellation/no-show rate`
 })
 }
 }
 
 // No-show warning
 if (customer.no_show_count >= 2) {
 insights.push({
 type: 'warning',
 icon: Ban,
 text: `${customer.no_show_count} previous no-shows - consider confirmation call`
 })
 }
 
 // High spender
 if (customer.total_spent > 500) {
 insights.push({
 type: 'positive',
 icon: DollarSign,
 text: `High-value customer - $${customer.total_spent.toLocaleString()} total spend`
 })
 }
 
 // Average party size pattern
 if (customer.average_party_size >= 4) {
 insights.push({
 type: 'neutral',
 icon: Users,
 text: `Usually brings larger groups (avg ${customer.average_party_size.toFixed(1)} guests)`
 })
 }
 
 // Recent activity
 if (customer.last_visit) {
 const daysSinceLastVisit = differenceInDays(new Date(), new Date(customer.last_visit))
 if (daysSinceLastVisit > 90) {
 insights.push({
 type: 'info',
 icon: CalendarDays,
 text: `Returning after ${Math.round(daysSinceLastVisit / 30)} months - welcome back!`
 })
 }
 }
 
 // Occasion patterns from history
 const occasions = bookingHistory.filter(b => b.occasion).map(b => b.occasion!)
 if (occasions.length > 0) {
 const uniqueOccasions = [...new Set(occasions)]
 if (uniqueOccasions.length > 0) {
 insights.push({
 type: 'neutral',
 icon: Gift,
 text: `Often celebrates: ${uniqueOccasions.slice(0, 3).join(', ')}`
 })
 }
 }
 
 return insights
}

// Generate automatic tags based on behavior
const generateAutoTags = (customer: CustomerData, bookingHistory: BookingHistoryItem[]) => {
 const autoTags: Array<{ name: string; color: string }> = []
 
 if (customer.total_bookings >= 10) {
 autoTags.push({ name: 'Regular', color: '#22c55e' })
 }
 if (customer.total_bookings >= 25) {
 autoTags.push({ name: 'Frequent', color: '#3b82f6' })
 }
 if (customer.total_bookings === 1) {
 autoTags.push({ name: 'New Guest', color: '#8b5cf6' })
 }
 if (customer.no_show_count >= 2) {
 autoTags.push({ name: 'No-Show Risk', color: '#ef4444' })
 }
 if (customer.average_party_size >= 6) {
 autoTags.push({ name: 'Large Groups', color: '#f59e0b' })
 }
 if (customer.total_spent > 1000) {
 autoTags.push({ name: 'High Spender', color: '#10b981' })
 }
 
 // Weekend preference
 const weekendBookings = bookingHistory.filter(b => {
 const day = new Date(b.booking_time).getDay()
 return day === 0 || day === 6
 }).length
 
 if (weekendBookings > bookingHistory.length * 0.7 && bookingHistory.length >= 3) {
 autoTags.push({ name: 'Weekend Regular', color: '#6366f1' })
 }
 
 return autoTags
}

// Calculated booking stats (matching customer-details-dialog approach)
interface CalculatedStats {
 totalBookings: number
 completed: number
 cancelled: number
 declined: number
 noShow: number
 reliabilityScore: number
}

export function BasicBookingDetailsDialog({
 open,
 onOpenChange,
 booking,
 restaurantId,
 hasGuestCRM = false,
 onStatusChange,
}: BasicBookingDetailsDialogProps) {
 const supabase = createClient()
 const { hasFeature } = useRestaurantContext()
 const hasCRM = hasGuestCRM || hasFeature('customer_management')

 const [loading, setLoading] = useState(false)
 const [customerData, setCustomerData] = useState<CustomerData | null>(null)
 const [bookingHistory, setBookingHistory] = useState<BookingHistoryItem[]>([])
 const [allBookingsForStats, setAllBookingsForStats] = useState<any[]>([])
 const [calculatedStats, setCalculatedStats] = useState<CalculatedStats | null>(null)
 const [activeTab, setActiveTab] = useState("overview")
 const [currentUserId, setCurrentUserId] = useState<string | null>(null)
 
 // State for tag and relationship management
 const [availableTags, setAvailableTags] = useState<CustomerTag[]>([])
 const [customerTags, setCustomerTags] = useState<CustomerTag[]>([])
 const [availableCustomers, setAvailableCustomers] = useState<CustomerForSelection[]>([])
 const [notes, setNotes] = useState<CustomerData['notes']>([])
 const [relationships, setRelationships] = useState<CustomerData['relationships']>([])
 
 // Forms for adding notes and relationships
 const [newNote, setNewNote] = useState({ note: '', category: 'general', is_important: false })
 const [newRelationship, setNewRelationship] = useState<{
 related_customer_id: string
 relationship_type: string
 relationship_details: string
 }>({
 related_customer_id: '',
 relationship_type: 'friend',
 relationship_details: ''
 })

 // Sections for resolving section names (handles ID vs name in preferred_section)
 const [sections, setSections] = useState<Array<{ id: string; name: string }>>([])

 // Payment link generation state
 const [generatingPaymentLink, setGeneratingPaymentLink] = useState(false)
 const [paymentLink, setPaymentLink] = useState<string | null>(null)
 const [paymentLinkCopied, setPaymentLinkCopied] = useState(false)

 // Get current user ID
 useEffect(() => {
 const getUser = async () => {
 const { data: { user } } = await supabase.auth.getUser()
 setCurrentUserId(user?.id || null)
 }
 getUser()
 }, [])

 // Fetch sections for resolving section names
 useEffect(() => {
 const fetchSections = async () => {
 if (!restaurantId) return
 const { data, error } = await supabase
 .from("restaurant_sections")
 .select("id, name")
 .eq("restaurant_id", restaurantId)
 .eq("is_active", true)
 if (!error && data) {
 setSections(data)
 }
 }
 fetchSections()
 }, [restaurantId])

 // Helper to resolve section display name (handles both ID and name stored in preferred_section)
 const resolveSectionName = (preferredSection: string | null | undefined): string | null => {
 if (!preferredSection) return null
 
 // Check if it looks like a UUID (section ID)
 const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
 if (uuidRegex.test(preferredSection)) {
 // It's an ID, look up the name
 const section = sections.find((s) => s.id === preferredSection)
 return section?.name || null
 }
 
 // It's already a name
 return preferredSection
 }

 // Load guest CRM data when dialog opens
 useEffect(() => {
 if (open && hasCRM && booking) {
 loadCustomerData()
 }
 // Reset state when dialog closes
 if (!open) {
 setCustomerData(null)
 setBookingHistory([])
 setAllBookingsForStats([])
 setCalculatedStats(null)
 setActiveTab("overview")
 setAvailableTags([])
 setCustomerTags([])
 setAvailableCustomers([])
 setNotes([])
 setRelationships([])
 setNewNote({ note: '', category: 'general', is_important: false })
 setNewRelationship({ related_customer_id: '', relationship_type: 'friend', relationship_details: '' })
 }
 }, [open, booking, hasCRM])

 // Sync tags, notes, relationships when customerData changes
 useEffect(() => {
 if (customerData) {
 setCustomerTags(customerData.tags || [])
 setNotes(customerData.notes || [])
 setRelationships(customerData.relationships || [])
 }
 }, [customerData])

 const loadCustomerData = async () => {
 if (!booking) return

 setLoading(true)
 try {
 // Build query to find customer (relationships queried separately due to dual FK)
 let customerQuery = supabase
 .from('restaurant_customers')
 .select(`
 id,
 user_id,
 guest_name,
 guest_email,
 guest_phone,
 total_bookings,
 total_spent,
 average_party_size,
 first_visit,
 last_visit,
 no_show_count,
 cancelled_count,
 vip_status,
 blacklisted,
 blacklist_reason,
 preferred_table_types,
 preferred_time_slots,
 notes:customer_notes(
 id,
 note,
 category,
 is_important,
 created_at,
 created_by
 ),
 tags:customer_tag_assignments(
 tag:customer_tags(
 id,
 name,
 color,
 description
 )
 ),
 profile:profiles!restaurant_customers_user_id_fkey(
 full_name,
 email,
 phone_number,
 avatar_url,
 date_of_birth,
 allergies,
 dietary_restrictions,
 favorite_cuisines,
 preferred_party_size,
 user_rating,
 loyalty_points,
 membership_tier
 )
 `)
 .eq('restaurant_id', restaurantId)

 // Match by user_id, email, phone, or name
 if (booking.user_id) {
 customerQuery = customerQuery.eq('user_id', booking.user_id)
 } else if (booking.guest_email) {
 customerQuery = customerQuery.eq('guest_email', booking.guest_email)
 } else if (booking.guest_phone) {
 customerQuery = customerQuery.eq('guest_phone', booking.guest_phone)
 } else if (booking.guest_name) {
 customerQuery = customerQuery.eq('guest_name', booking.guest_name)
 }

 const { data: customerResult, error } = await customerQuery.maybeSingle()

 if (error) {
 console.error('Error loading customer data:', error)
 }

 if (customerResult) {
 // Fetch relationships separately due to dual FK on customer_relationships table
 const { data: relationshipsData } = await supabase
 .from('customer_relationships')
 .select(`
 id,
 customer_id,
 related_customer_id,
 relationship_type,
 relationship_details,
 related_customer:restaurant_customers!customer_relationships_related_customer_id_fkey(
 id,
 guest_name,
 vip_status
 ),
 customer:restaurant_customers!customer_relationships_customer_id_fkey(
 id,
 guest_name,
 vip_status
 )
 `)
 .or(`customer_id.eq.${customerResult.id},related_customer_id.eq.${customerResult.id}`)

 // Process relationships - show the "other" person in the relationship
 const processedRelationships = (relationshipsData || []).map((rel: any) => {
 // If this customer is the "customer" in the relationship, show the related_customer
 // If this customer is the "related_customer", show the customer
 const isCustomer = rel.customer_id === customerResult.id
 const otherPerson = isCustomer ? rel.related_customer : rel.customer
 
 return {
 id: rel.id,
 related_customer_id: isCustomer ? rel.related_customer_id : rel.customer_id,
 relationship_type: rel.relationship_type,
 relationship_details: rel.relationship_details,
 related_customer: Array.isArray(otherPerson) ? otherPerson[0] : otherPerson
 }
 }).filter((r: any) => r.related_customer)

 // Transform nested data
 const transformedData: CustomerData = {
 ...customerResult,
 total_spent: Number(customerResult.total_spent) || 0,
 average_party_size: Number(customerResult.average_party_size) || 0,
 tags: customerResult.tags?.map((t: any) => t.tag).filter(Boolean) || [],
 relationships: processedRelationships,
 profile: Array.isArray(customerResult.profile) ? customerResult.profile[0] : customerResult.profile,
 notes: customerResult.notes || []
 }
 setCustomerData(transformedData)

 // Load available tags for this restaurant
 const { data: tagsData } = await supabase
 .from('customer_tags')
 .select('*')
 .eq('restaurant_id', restaurantId)
 .order('name')
 
 setAvailableTags(tagsData || [])

 // Load available customers for relationships (excluding current customer)
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
 .neq('id', customerResult.id)
 .order('guest_name')
 .limit(100)

 // Transform customers data to fix profile array issue
 const transformedCustomers = (customersData || []).map((c: any) => ({
 id: c.id,
 guest_name: c.guest_name,
 guest_email: c.guest_email,
 profile: Array.isArray(c.profile) ? c.profile[0] : c.profile
 }))
 
 setAvailableCustomers(transformedCustomers)

 // Load booking history
 await loadBookingHistory(transformedData)
 }
 } catch (error) {
 console.error('Error loading customer data:', error)
 } finally {
 setLoading(false)
 }
 }

 const loadBookingHistory = async (customer: CustomerData) => {
 try {
 // Comprehensive approach matching customer-details-dialog.tsx
 // Load bookings from multiple sources to ensure accuracy
 let allBookings: any[] = []
 
 // For registered users with profiles, prioritize user_id matching
 if (customer.user_id && customer.profile) {
 const { data: userBookings, error: userBookingsError } = await supabase
 .from('bookings')
 .select('id, booking_time, party_size, status, occasion, special_requests, created_at, source, guest_email')
 .eq('user_id', customer.user_id)
 .eq('restaurant_id', restaurantId)

 if (!userBookingsError && userBookings) {
 allBookings = [...allBookings, ...userBookings]
 }
 }

 // For guest customers or when user_id matching fails, try multiple approaches
 if (!customer.profile || allBookings.length === 0) {
 // Method 1: Query by guest_email (most reliable for guest customers)
 if (customer.guest_email) {
 const { data: emailBookings, error: emailBookingsError } = await supabase
 .from('bookings')
 .select('id, booking_time, party_size, status, occasion, special_requests, created_at, source, guest_email')
 .eq('guest_email', customer.guest_email)
 .eq('restaurant_id', restaurantId)

 if (!emailBookingsError && emailBookings) {
 const existingIds = new Set(allBookings.map(b => b.id))
 const newBookings = emailBookings.filter(b => !existingIds.has(b.id))
 allBookings = [...allBookings, ...newBookings]
 }
 }

 // Method 2: Query by guest_name and guest_email combination
 if (customer.guest_name && customer.guest_email) {
 const { data: nameEmailBookings, error: nameEmailError } = await supabase
 .from('bookings')
 .select('id, booking_time, party_size, status, occasion, special_requests, created_at, source, guest_email')
 .eq('guest_name', customer.guest_name)
 .eq('guest_email', customer.guest_email)
 .eq('restaurant_id', restaurantId)

 if (!nameEmailError && nameEmailBookings) {
 const existingIds = new Set(allBookings.map(b => b.id))
 const newBookings = nameEmailBookings.filter(b => !existingIds.has(b.id))
 allBookings = [...allBookings, ...newBookings]
 }
 }

 // Method 3: Query by guest_phone
 if (customer.guest_phone && allBookings.length === 0) {
 const { data: phoneBookings, error: phoneBookingsError } = await supabase
 .from('bookings')
 .select('id, booking_time, party_size, status, occasion, special_requests, created_at, source, guest_email')
 .eq('guest_phone', customer.guest_phone)
 .eq('restaurant_id', restaurantId)

 if (!phoneBookingsError && phoneBookings) {
 const existingIds = new Set(allBookings.map(b => b.id))
 const newBookings = phoneBookings.filter(b => !existingIds.has(b.id))
 allBookings = [...allBookings, ...newBookings]
 }
 }

 // Method 4: Query by guest_name only (lower confidence)
 if (customer.guest_name && allBookings.length === 0) {
 const { data: nameBookings, error: nameBookingsError } = await supabase
 .from('bookings')
 .select('id, booking_time, party_size, status, occasion, special_requests, created_at, source, guest_email')
 .eq('guest_name', customer.guest_name)
 .eq('restaurant_id', restaurantId)

 if (!nameBookingsError && nameBookings) {
 // For name-only matches, be selective to avoid false positives
 const filteredBookings = nameBookings.filter(b => {
 if (!customer.guest_email && !b.guest_email) return true
 if (customer.guest_email && b.guest_email === customer.guest_email) return true
 return false
 })
 const existingIds = new Set(allBookings.map(b => b.id))
 const newBookings = filteredBookings.filter(b => !existingIds.has(b.id))
 allBookings = [...allBookings, ...newBookings]
 }
 }
 }

 // Store all bookings for stats calculation
 setAllBookingsForStats(allBookings)

 // Calculate booking statistics from actual bookings (matching customer-details-dialog)
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
 
 // Calculate reliability score
 const totalAttempted = allBookings.length
 const issueCount = cancelledCount + noShowCount
 const reliabilityScore = totalAttempted > 0 
 ? Math.round(((totalAttempted - issueCount) / totalAttempted) * 100)
 : 100

 setCalculatedStats({
 totalBookings: allBookings.length,
 completed: completedCount,
 cancelled: cancelledCount,
 declined: declinedCount,
 noShow: noShowCount,
 reliabilityScore
 })

 // Sort and get recent history (excluding current booking)
 const sortedBookings = allBookings
 .filter(b => b.id !== booking.id)
 .sort((a, b) => new Date(b.booking_time).getTime() - new Date(a.booking_time).getTime())
 .slice(0, 10)

 setBookingHistory(sortedBookings)
 } catch (error) {
 console.error('Error loading booking history:', error)
 }
 }

 const handleCopyConfirmationCode = () => {
 if (booking?.confirmation_code) {
 navigator.clipboard.writeText(booking.confirmation_code)
 toast.success('Confirmation code copied!')
 }
 }

 // Generate or regenerate payment link for pending_payment bookings
 const handleGeneratePaymentLink = async () => {
 if (!booking?.id) return

 setGeneratingPaymentLink(true)
 setPaymentLinkCopied(false)

 try {
 // Determine payment type from booking metadata
 const paymentType = booking.booking_guarantee ? 'card_guarantee' : 'deposit'
 
 const checkoutPayload: Record<string, any> = {
 booking_id: booking.id,
 guest_name: booking.guest_name || 'Guest',
 guest_email: booking.guest_email,
 guest_phone: booking.guest_phone,
 source: 'manual', // Mark as manual booking
 }

 if (paymentType === 'deposit') {
 // Deposit payment
 checkoutPayload.is_event_payment = true
 checkoutPayload.amount = booking.payment_amount || booking.deposit_amount || '50'
 checkoutPayload.description = `Deposit for booking ${booking.confirmation_code}`
 } else {
 // Card guarantee
 checkoutPayload.is_widget_guarantee = true
 checkoutPayload.no_show_fee = booking.booking_guarantee?.no_show_fee || 0
 checkoutPayload.cancellation_fee = booking.booking_guarantee?.cancellation_fee || 0
 checkoutPayload.fee_type = booking.booking_guarantee?.fee_type || 'per_cover'
 checkoutPayload.party_size = booking.party_size
 }

 const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('stripe-checkout', {
 body: checkoutPayload
 })

 if (checkoutError) {
 console.error('❌ Error creating checkout session:', checkoutError)
 toast.error('Failed to generate payment link. Please try again.')
 return
 }

 if (checkoutData?.redirect_url) {
 setPaymentLink(checkoutData.redirect_url)
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
 // navigator.clipboard requires a secure context (HTTPS / localhost).
 // Fall back to the legacy execCommand approach for local dev over HTTP.
 if (navigator.clipboard?.writeText) {
 await navigator.clipboard.writeText(paymentLink)
 } else {
 const el = document.createElement('textarea')
 el.value = paymentLink
 el.style.position = 'fixed'
 el.style.opacity = '0'
 document.body.appendChild(el)
 el.focus()
 el.select()
 document.execCommand('copy')
 document.body.removeChild(el)
 }
 setPaymentLinkCopied(true)
 toast.success('Payment link copied to clipboard!')
 setTimeout(() => setPaymentLinkCopied(false), 3000)
 } catch (error) {
 console.error('Failed to copy:', error)
 toast.error('Failed to copy link')
 }
 }

 // Toggle tag on/off for customer
 const handleToggleTag = async (tag: CustomerTag) => {
 if (!customerData?.id || !currentUserId) {
 toast.error('Unable to update tags')
 return
 }

 try {
 const hasTag = customerTags.some(t => t.id === tag.id)

 if (hasTag) {
 // Remove tag
 const { error } = await supabase
 .from('customer_tag_assignments')
 .delete()
 .eq('customer_id', customerData.id)
 .eq('tag_id', tag.id)

 if (error) throw error

 setCustomerTags(customerTags.filter(t => t.id !== tag.id))
 toast.success('Tag removed')
 } else {
 // Add tag
 const { error } = await supabase
 .from('customer_tag_assignments')
 .insert({
 customer_id: customerData.id,
 tag_id: tag.id,
 assigned_by: currentUserId
 })

 if (error) throw error

 setCustomerTags([...customerTags, tag])
 toast.success('Tag added')
 }
 } catch (error) {
 console.error('Error toggling tag:', error)
 toast.error('Failed to update tag')
 }
 }

 // Add note to customer
 const handleAddNote = async () => {
 if (!newNote.note.trim() || !customerData?.id || !currentUserId) {
 toast.error('Unable to add note')
 return
 }

 try {
 const { data, error } = await supabase
 .from('customer_notes')
 .insert({
 customer_id: customerData.id,
 note: newNote.note,
 category: newNote.category,
 is_important: newNote.is_important,
 created_by: currentUserId
 })
 .select(`
 id,
 note,
 category,
 is_important,
 created_at,
 created_by
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
 toast.success('Note deleted')
 } catch (error) {
 console.error('Error deleting note:', error)
 toast.error('Failed to delete note')
 }
 }

 // Add relationship
 const handleAddRelationship = async () => {
 if (!newRelationship.related_customer_id || !customerData?.id || !currentUserId) {
 toast.error('Please select a customer')
 return
 }

 try {
 const { data, error } = await supabase
 .from('customer_relationships')
 .insert({
 customer_id: customerData.id,
 related_customer_id: newRelationship.related_customer_id,
 relationship_type: newRelationship.relationship_type,
 relationship_details: newRelationship.relationship_details || null,
 created_by: currentUserId
 })
 .select(`
 id,
 customer_id,
 related_customer_id,
 relationship_type,
 relationship_details,
 related_customer:restaurant_customers!customer_relationships_related_customer_id_fkey(
 id,
 guest_name,
 vip_status
 ),
 customer:restaurant_customers!customer_relationships_customer_id_fkey(
 id,
 guest_name,
 vip_status
 )
 `)
 .single()

 if (error) throw error

 // Process the new relationship
 const isCustomer = data.customer_id === customerData.id
 const otherPerson = isCustomer ? data.related_customer : data.customer
 
 const processedRelationship = {
 id: data.id,
 related_customer_id: isCustomer ? data.related_customer_id : data.customer_id,
 relationship_type: data.relationship_type,
 relationship_details: data.relationship_details,
 related_customer: Array.isArray(otherPerson) ? otherPerson[0] : otherPerson
 }

 setRelationships([...relationships, processedRelationship])
 setNewRelationship({ related_customer_id: '', relationship_type: 'friend', relationship_details: '' })
 toast.success('Relationship added successfully')
 } catch (error) {
 console.error('Error adding relationship:', error)
 toast.error('Failed to add relationship')
 }
 }

 // Delete relationship
 const handleDeleteRelationship = async (relationshipId: string) => {
 try {
 const { error } = await supabase
 .from('customer_relationships')
 .delete()
 .eq('id', relationshipId)

 if (error) throw error

 setRelationships(relationships.filter(r => r.id !== relationshipId))
 toast.success('Relationship removed')
 } catch (error) {
 console.error('Error deleting relationship:', error)
 toast.error('Failed to remove relationship')
 }
 }

 // Compute insights and auto tags - using calculated stats
 const insights = useMemo(() => {
 if (!customerData || !calculatedStats) return []
 // Create a modified customer with calculated stats for insights
 const customerWithStats = {
 ...customerData,
 total_bookings: calculatedStats.totalBookings,
 no_show_count: calculatedStats.noShow,
 cancelled_count: calculatedStats.cancelled
 }
 return generateInsights(customerWithStats, bookingHistory)
 }, [customerData, calculatedStats, bookingHistory])

 const autoTags = useMemo(() => {
 if (!customerData || !calculatedStats) return []
 // Create a modified customer with calculated stats for auto tags
 const customerWithStats = {
 ...customerData,
 total_bookings: calculatedStats.totalBookings,
 no_show_count: calculatedStats.noShow,
 cancelled_count: calculatedStats.cancelled
 }
 return generateAutoTags(customerWithStats, bookingHistory)
 }, [customerData, calculatedStats, bookingHistory])

 // Stats calculations - use calculated stats from actual bookings
 const stats = useMemo(() => {
 if (!customerData || !calculatedStats) return null
 
 return {
 totalBookings: calculatedStats.totalBookings,
 completedCount: calculatedStats.completed,
 cancelledCount: calculatedStats.cancelled,
 declinedCount: calculatedStats.declined,
 noShowCount: calculatedStats.noShow,
 reliabilityScore: calculatedStats.reliabilityScore,
 avgPartySize: customerData.average_party_size,
 totalSpent: customerData.total_spent,
 firstVisit: customerData.first_visit,
 lastVisit: customerData.last_visit,
 loyaltyPoints: customerData.profile?.loyalty_points || 0,
 userRating: customerData.profile?.user_rating || 5.0
 }
 }, [customerData, calculatedStats])

 if (!booking) return null

 const profile = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles
 const guestName = booking.guest_name || customerData?.guest_name || profile?.full_name || customerData?.profile?.full_name || 'Unknown Guest'
 const guestEmail = booking.guest_email || customerData?.guest_email || profile?.email || customerData?.profile?.email
 const guestPhone = booking.guest_phone || customerData?.guest_phone || profile?.phone_number || customerData?.profile?.phone_number
 const birthdayInfo = customerData?.profile?.date_of_birth ? getBirthdayInfo(customerData.profile.date_of_birth) : null

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
 {/* Fixed Header */}
 <DialogHeader className="px-4 py-4 border-b flex-shrink-0">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 {hasCRM && customerData?.profile?.avatar_url ? (
 <Avatar className="h-12 w-12">
 <AvatarImage src={customerData.profile.avatar_url} />
 <AvatarFallback className="text-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white">
 {guestName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
 </AvatarFallback>
 </Avatar>
 ) : (
 <Avatar className="h-12 w-12">
 <AvatarFallback className="text-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white">
 {guestName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
 </AvatarFallback>
 </Avatar>
 )}
 <div>
 <DialogTitle className="text-xl flex items-center gap-2">
 {guestName}
 {hasCRM && customerData?.vip_status && (
 <Badge className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-0">
 <Crown className="h-3 w-3 mr-1" />
 VIP
 </Badge>
 )}
 {hasCRM && customerData?.blacklisted && (
 <Badge variant="destructive">
 <Ban className="h-3 w-3 mr-1" />
 Blacklisted
 </Badge>
 )}
 </DialogTitle>
 <DialogDescription className="flex items-center gap-2">
 {booking.confirmation_code && (
 <span className="flex items-center gap-1">
 <code className="font-mono font-semibold">#{booking.confirmation_code}</code>
 <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCopyConfirmationCode}>
 <Copy className="h-3 w-3" />
 </Button>
 </span>
 )}
 </DialogDescription>
 </div>
 </div>
 <Badge className={cn("text-sm", getStatusColor(booking.status))}>
 {formatStatus(booking.status)}
 </Badge>
 </div>
 </DialogHeader>

 {/* Scrollable Content */}
 <div className="flex-1 overflow-y-auto min-h-0">
 {hasCRM ? (
 <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
 <div className="px-4 pt-4 border-b sticky top-0 bg-background z-10 flex-shrink-0">
 <TabsList className="grid w-full grid-cols-5">
 <TabsTrigger value="overview">Overview</TabsTrigger>
 <TabsTrigger value="history">History</TabsTrigger>
 <TabsTrigger value="insights">Insights</TabsTrigger>
 <TabsTrigger value="notes">Notes</TabsTrigger>
 <TabsTrigger value="manage">Manage</TabsTrigger>
 </TabsList>
 </div>

 {loading ? (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="h-6 w-6 motion-safe:animate-spin text-muted-foreground" />
 </div>
 ) : (
 <div className="flex-1 overflow-y-auto">
 {/* Overview Tab */}
 <TabsContent value="overview" className="px-4 py-4 space-y-4 mt-0">
 {/* Quick Stats Grid - Matching customer-details-dialog */}
 {stats && (
 <>
 {/* Primary Stats Row */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
 <CardContent className="p-4">
 <div className="flex items-center gap-2 text-blue-600 mb-1">
 <CalendarDays className="h-4 w-4" />
 <span className="text-xs font-medium">Total Bookings</span>
 </div>
 <p className="text-xl font-bold text-blue-900">{stats.totalBookings}</p>
 {stats.completedCount > 0 && (
 <p className="text-xs text-green-600 mt-1">{stats.completedCount} completed</p>
 )}
 </CardContent>
 </Card>
 
 <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
 <CardContent className="p-4">
 <div className="flex items-center gap-2 text-indigo-600 mb-1">
 <Star className="h-4 w-4" />
 <span className="text-xs font-medium">Loyalty Points</span>
 </div>
 <p className="text-xl font-bold text-indigo-900">{stats.loyaltyPoints}</p>
 <p className="text-xs text-muted-foreground text-sm">points earned</p>
 </CardContent>
 </Card>
 
 <Card className={cn(
 "border",
 stats.reliabilityScore >= 90 
 ? "bg-gradient-to-br from-green-50 to-green-100 border-green-200"
 : stats.reliabilityScore >= 70
 ? "bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200"
 : "bg-gradient-to-br from-red-50 to-red-100 border-red-200"
 )}>
 <CardContent className="p-4">
 <div className={cn(
 "flex items-center gap-2 mb-1",
 stats.reliabilityScore >= 90 ? "text-green-600" :
 stats.reliabilityScore >= 70 ? "text-yellow-600" :
 "text-red-600"
 )}>
 <Shield className="h-4 w-4" />
 <span className="text-xs font-medium">Reliability</span>
 </div>
 <p className={cn(
 "text-xl font-bold",
 stats.reliabilityScore >= 90 ? "text-green-900" :
 stats.reliabilityScore >= 70 ? "text-yellow-900" :
 "text-red-900"
 )}>{stats.userRating?.toFixed(1) || '5.0'}</p>
 <p className="text-xs text-muted-foreground text-sm">out of 5.0</p>
 </CardContent>
 </Card>
 
 <Card className={cn(
 "border",
 (stats.noShowCount + stats.cancelledCount) === 0
 ? "bg-gradient-to-br from-green-50 to-green-100 border-green-200"
 : (stats.noShowCount + stats.cancelledCount) <= 2
 ? "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200"
 : "bg-gradient-to-br from-red-50 to-red-100 border-red-200"
 )}>
 <CardContent className="p-4">
 <div className={cn(
 "flex items-center gap-2 mb-1",
 (stats.noShowCount + stats.cancelledCount) === 0 ? "text-green-600" :
 (stats.noShowCount + stats.cancelledCount) <= 2 ? "text-amber-600" :
 "text-red-600"
 )}>
 <AlertTriangle className="h-4 w-4" />
 <span className="text-xs font-medium">Issues</span>
 </div>
 <p className={cn(
 "text-xl font-bold",
 (stats.noShowCount + stats.cancelledCount) === 0 ? "text-green-900" :
 (stats.noShowCount + stats.cancelledCount) <= 2 ? "text-amber-900" :
 "text-red-900"
 )}>{stats.noShowCount + stats.cancelledCount}</p>
 <p className="text-xs text-muted-foreground text-sm">
 {stats.noShowCount} no-shows, {stats.cancelledCount} cancelled
 </p>
 {stats.declinedCount > 0 && (
 <p className="text-xs text-gray-500">{stats.declinedCount} declined</p>
 )}
 </CardContent>
 </Card>
 </div>

 {/* Secondary Stats Row */}
 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
 {stats.avgPartySize > 0 && (
 <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
 <CardContent className="p-4">
 <div className="flex items-center gap-2 text-purple-600 mb-1">
 <Users className="h-4 w-4" />
 <span className="text-xs font-medium">Avg Party Size</span>
 </div>
 <p className="text-xl font-bold text-purple-900">{stats.avgPartySize.toFixed(1)}</p>
 <p className="text-xs text-muted-foreground text-sm">actual average</p>
 </CardContent>
 </Card>
 )}
 
 

 {customerData?.profile?.preferred_party_size && customerData.profile.preferred_party_size !== 2 && (
 <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
 <CardContent className="p-4">
 <div className="flex items-center gap-2 text-cyan-600 mb-1">
 <Users className="h-4 w-4" />
 <span className="text-xs font-medium">Preferred Party</span>
 </div>
 <p className="text-xl font-bold text-cyan-900">{customerData.profile.preferred_party_size}</p>
 <p className="text-xs text-muted-foreground text-sm">typical group size</p>
 </CardContent>
 </Card>
 )}
 </div>
 </>
 )}

 {/* Current Booking Details */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <CalendarIcon className="h-4 w-4 text-blue-600" />
 Current Booking
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Date</p>
 <p className="font-semibold">{format(parseISO(booking.booking_time), "EEE, MMM d, yyyy")}</p>
 </div>
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Time</p>
 <p className="font-semibold">{format(parseISO(booking.booking_time), "h:mm a")}</p>
 </div>
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Party Size</p>
 <p className="font-semibold flex items-center gap-1">
 <Users className="h-4 w-4" />
 {booking.party_size} {booking.party_size === 1 ? 'guest' : 'guests'}
 </p>
 </div>
 {resolveSectionName(booking.preferred_section) && (
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Section</p>
 <p className="font-semibold flex items-center gap-1">
 <MapPin className="h-4 w-4" />
 {resolveSectionName(booking.preferred_section)}
 </p>
 </div>
 )}
 {booking.assigned_table && (
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Table</p>
 <p className="font-semibold">Table {booking.assigned_table}</p>
 </div>
 )}
 {booking.occasion && (
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Occasion</p>
 <Badge className="bg-pink-100 text-pink-800 border-pink-200">
 <Gift className="h-3 w-3 mr-1" />
 {booking.occasion}
 </Badge>
 </div>
 )}
 </div>

 {booking.special_requests && (
 <div className="mt-4 p-3 bg-muted/50 rounded-lg">
 <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Special Requests</p>
 <p className="text-sm">{booking.special_requests}</p>
 </div>
 )}

 {booking.dietary_notes && booking.dietary_notes.length > 0 && (
 <div className="mt-3">
 <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Dietary Notes</p>
 <div className="flex flex-wrap gap-1">
 {booking.dietary_notes.map((note: string, idx: number) => (
 <Badge key={idx} variant="outline" className="text-xs">
 <Utensils className="h-3 w-3 mr-1" />
 {note}
 </Badge>
 ))}
 </div>
 </div>
 )}

 {/* Special Offer - Enhanced visibility */}
 {booking.special_offers && (
 <div className="mt-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg shadow-sm">
 <div className="flex items-start gap-3">
 <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-md">
 <Gift className="h-5 w-5 text-white" />
 </div>
 <div className="flex-1">
 <div className="flex items-start justify-between gap-2 mb-2">
 <div>
 <p className="text-xs text-green-700 font-medium uppercase tracking-wide mb-1">Special Offer Applied</p>
 <h4 className="font-bold text-green-900 text-sm">
 {booking.special_offers.title}
 </h4>
 </div>
 {booking.special_offers.discount_percentage && (
 <Badge variant="secondary" className="bg-green-600 text-white font-bold text-xs px-2 py-1 shadow-sm">
 {booking.special_offers.discount_percentage}% OFF
 </Badge>
 )}
 </div>
 {booking.special_offers.description && (
 <p className="text-xs text-green-800 leading-relaxed">
 {booking.special_offers.description}
 </p>
 )}
 </div>
 </div>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Payment Information Card - Only show for bookings with payment info */}
 {(booking.status === 'pending_payment' || booking.payment_status === 'paid' || booking.booking_guarantee?.status === 'held') && (
 <Card className={cn(
 "border-2",
 booking.status === 'pending_payment' ? "border-amber-200 bg-amber-50/50" : 
 booking.payment_status === 'paid' ? "border-emerald-200 bg-emerald-50/50" :
 "border-blue-200 bg-blue-50/50"
 )}>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <DollarSign className={cn(
 "h-4 w-4",
 booking.status === 'pending_payment' ? "text-amber-600" :
 booking.payment_status === 'paid' ? "text-emerald-600" :
 "text-blue-600"
 )} />
 Payment Information
 {booking.status === 'pending_payment' && (
 <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-700 border-amber-300 motion-safe:animate-pulse">
 <Clock className="h-3 w-3 mr-1" />
 Awaiting Payment
 </Badge>
 )}
 {booking.payment_status === 'paid' && (
 <Badge variant="outline" className="ml-2 bg-emerald-100 text-emerald-700 border-emerald-300">
 <CheckCircle className="h-3 w-3 mr-1" />
 Paid
 </Badge>
 )}
 {booking.booking_guarantee?.status === 'held' && (
 <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-700 border-blue-300">
 <CreditCard className="h-3 w-3 mr-1" />
 Card Held
 </Badge>
 )}
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* Payment Details */}
 <div className="grid grid-cols-2 gap-4">
 {booking.payment_amount && (
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Amount</p>
 <p className="font-bold text-lg text-emerald-700">
 ${parseFloat(booking.payment_amount).toFixed(2)}
 </p>
 </div>
 )}
 {booking.booking_guarantee?.no_show_fee && (
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">No-Show Fee</p>
 <p className="font-semibold">${booking.booking_guarantee.no_show_fee} {booking.booking_guarantee.fee_type === 'per_cover' ? '/cover' : 'fixed'}</p>
 </div>
 )}
 {booking.booking_guarantee?.cancellation_fee && (
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Cancellation Fee</p>
 <p className="font-semibold">${booking.booking_guarantee.cancellation_fee} {booking.booking_guarantee.fee_type === 'per_cover' ? '/cover' : 'fixed'}</p>
 </div>
 )}
 {booking.payment_transaction_id && (
 <div className="space-y-1 col-span-2">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Transaction ID</p>
 <p className="font-mono text-xs text-muted-foreground">{booking.payment_transaction_id}</p>
 </div>
 )}
 </div>

 {/* Payment Link Section - Only for pending_payment status */}
 {booking.status === 'pending_payment' && (
 <div className="border-t pt-4">
 <p className="text-sm font-medium mb-3 flex items-center gap-2">
 <Link2 className="h-4 w-4 text-amber-600" />
 Payment Link
 </p>
 
 {paymentLink ? (
 <div className="space-y-3">
 <div className="relative">
 <Input
 value={paymentLink}
 readOnly
 className="pr-20 font-mono text-xs bg-white"
 />
 <Button
 size="sm"
 variant={paymentLinkCopied ? "default" : "outline"}
 className={cn(
 "absolute right-1 top-1/2 -translate-y-1/2 h-7",
 paymentLinkCopied && "bg-emerald-600 hover:bg-emerald-700"
 )}
 onClick={handleCopyPaymentLink}
 >
 {paymentLinkCopied ? (
 <>
 <CheckCircle className="h-3 w-3 mr-1" />
 Copied!
 </>
 ) : (
 <>
 <Copy className="h-3 w-3 mr-1" />
 Copy
 </>
 )}
 </Button>
 </div>
 <div className="flex gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={() => window.open(paymentLink, '_blank')}
 className="flex-1"
 >
 <ExternalLink className="h-3 w-3 mr-1" />
 Open Link
 </Button>
 <Button
 variant="outline"
 size="sm"
 onClick={handleGeneratePaymentLink}
 disabled={generatingPaymentLink}
 className="flex-1"
 >
 {generatingPaymentLink ? (
 <>
 <Loader2 className="h-3 w-3 mr-1 motion-safe:animate-spin" />
 Regenerating...
 </>
 ) : (
 <>
 <Link2 className="h-3 w-3 mr-1" />
 Regenerate
 </>
 )}
 </Button>
 </div>
 </div>
 ) : (
 <Button
 onClick={handleGeneratePaymentLink}
 disabled={generatingPaymentLink}
 className="w-full bg-amber-600 hover:bg-amber-700"
 >
 {generatingPaymentLink ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 motion-safe:animate-spin" />
 Generating Payment Link...
 </>
 ) : (
 <>
 <Link2 className="h-4 w-4 mr-2" />
 Generate Payment Link
 </>
 )}
 </Button>
 )}
 
 <p className="text-xs text-muted-foreground mt-2">
 Share this link with the guest to complete payment. All links remain valid until payment is completed.
 </p>
 </div>
 )}
 </CardContent>
 </Card>
 )}

 {/* Contact Info */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <User className="h-4 w-4 text-blue-600" />
 Contact Information
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {guestPhone && (
 <a href={`tel:${guestPhone}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
 <div className="p-2 bg-green-100 rounded-full">
 <Phone className="h-4 w-4 text-green-600" />
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Phone</p>
 <p className="font-medium">{guestPhone}</p>
 </div>
 </a>
 )}
 {guestEmail && (
 <a href={`mailto:${guestEmail}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
 <div className="p-2 bg-blue-100 rounded-full">
 <Mail className="h-4 w-4 text-blue-600" />
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Email</p>
 <p className="font-medium">{guestEmail}</p>
 </div>
 </a>
 )}
 {birthdayInfo && (
 <div className={cn(
 "flex items-center gap-3 p-2 rounded-lg",
 birthdayInfo.isToday ? "bg-pink-100" : birthdayInfo.isSoon ? "bg-pink-50" : ""
 )}>
 <div className={cn(
 "p-2 rounded-full",
 birthdayInfo.isToday ? "bg-pink-200" : "bg-pink-100"
 )}>
 <Cake className={cn(
 "h-4 w-4",
 birthdayInfo.isToday ? "text-pink-700" : "text-pink-600"
 )} />
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Birthday</p>
 <p className="font-medium">
 {birthdayInfo.isToday ? (
 <span className="text-pink-700">🎉 Today!</span>
 ) : birthdayInfo.isSoon ? (
 <span className="text-pink-600">In {birthdayInfo.daysUntil} days</span>
 ) : (
 format(new Date(customerData?.profile?.date_of_birth || ''), 'MMMM d')
 )}
 </p>
 </div>
 </div>
 )}
 </div>

 {/* Dietary Information */}
 {customerData?.profile && (customerData.profile.allergies?.length || customerData.profile.dietary_restrictions?.length || customerData.profile.favorite_cuisines?.length) && (
 <div className="mt-4 pt-4 border-t space-y-3">
 {customerData.profile.allergies && customerData.profile.allergies.length > 0 && (
 <div className="flex items-start gap-2 p-2 bg-red-50 rounded-lg">
 <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
 <div>
 <p className="text-xs font-semibold text-red-700">Allergies</p>
 <p className="text-sm text-red-600">{customerData.profile.allergies.join(', ')}</p>
 </div>
 </div>
 )}
 {customerData.profile.dietary_restrictions && customerData.profile.dietary_restrictions.length > 0 && (
 <div className="flex items-start gap-2 p-2 bg-orange-50 rounded-lg">
 <Utensils className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
 <div>
 <p className="text-xs font-semibold text-orange-700">Dietary Restrictions</p>
 <p className="text-sm text-orange-600">{customerData.profile.dietary_restrictions.join(', ')}</p>
 </div>
 </div>
 )}
 {customerData.profile.favorite_cuisines && customerData.profile.favorite_cuisines.length > 0 && (
 <div className="flex items-start gap-2 p-2 bg-green-50 rounded-lg">
 <Heart className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
 <div>
 <p className="text-xs font-semibold text-green-700">Favorite Cuisines</p>
 <p className="text-sm text-green-600">{customerData.profile.favorite_cuisines.join(', ')}</p>
 </div>
 </div>
 )}
 </div>
 )}

 {/* Membership Info */}
 {customerData?.profile?.membership_tier && (
 <div className="mt-4 pt-4 border-t">
 <div className="flex items-center gap-2 p-2 bg-indigo-50 rounded-lg">
 <Star className="h-4 w-4 text-indigo-500 flex-shrink-0" />
 <div>
 <p className="text-xs font-semibold text-indigo-700">Membership</p>
 <p className="text-sm text-indigo-600 capitalize">{customerData.profile.membership_tier} Member</p>
 </div>
 </div>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Tags */}
 {(customerData?.tags?.length || autoTags.length > 0) && (
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <Tag className="h-4 w-4 text-blue-600" />
 Tags
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="flex flex-wrap gap-2">
 {customerData?.tags?.map((tag) => (
 <Badge
 key={tag.id}
 variant="outline"
 className="text-sm"
 style={{ 
 backgroundColor: `${tag.color}20`,
 borderColor: tag.color,
 color: isLightColor(tag.color) ? '#000' : tag.color 
 }}
 >
 {tag.name}
 </Badge>
 ))}
 {autoTags.map((tag, idx) => (
 <Badge
 key={`auto-${idx}`}
 variant="outline"
 className="text-sm"
 style={{ 
 backgroundColor: `${tag.color}20`,
 borderColor: tag.color,
 color: isLightColor(tag.color) ? '#000' : tag.color 
 }}
 >
 <Sparkles className="h-3 w-3 mr-1 opacity-70" />
 {tag.name}
 </Badge>
 ))}
 </div>
 </CardContent>
 </Card>
 )}

 {/* Relationships */}
 {customerData?.relationships && customerData.relationships.length > 0 && (
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <Link2 className="h-4 w-4 text-blue-600" />
 Relationships
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-2">
 {customerData.relationships.map((rel) => (
 <div key={rel.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
 <Avatar className="h-6 w-6">
 <AvatarFallback className="text-xs">
 {rel.related_customer?.guest_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
 </AvatarFallback>
 </Avatar>
 <div className="flex-1">
 <div className="flex items-center gap-2">
 <p className="font-medium">{rel.related_customer?.guest_name || 'Unknown'}</p>
 {rel.related_customer?.vip_status && (
 <Crown className="h-3 w-3 text-amber-500" />
 )}
 </div>
 <p className="text-xs text-muted-foreground capitalize">{rel.relationship_type}</p>
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 )}
 </TabsContent>

 {/* History Tab */}
 <TabsContent value="history" className="px-4 py-4 space-y-4 mt-0">
 {stats && (
 <>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
 <div className="text-center p-4 rounded-lg bg-green-50">
 <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-2" />
 <p className="text-xl font-bold text-green-700">{stats.completedCount}</p>
 <p className="text-xs text-green-600">Completed</p>
 </div>
 <div className="text-center p-4 rounded-lg bg-amber-50">
 <XCircle className="h-5 w-5 text-amber-600 mx-auto mb-2" />
 <p className="text-xl font-bold text-amber-700">{stats.cancelledCount}</p>
 <p className="text-xs text-amber-600">Cancelled</p>
 </div>
 <div className="text-center p-4 rounded-lg bg-red-50">
 <Ban className="h-5 w-5 text-red-600 mx-auto mb-2" />
 <p className="text-xl font-bold text-red-700">{stats.noShowCount}</p>
 <p className="text-xs text-red-600">No-Shows</p>
 </div>
 <div className="text-center p-4 rounded-lg bg-gray-50">
 <AlertCircle className="h-5 w-5 text-gray-600 mx-auto mb-2" />
 <p className="text-xl font-bold text-gray-700">{stats.declinedCount}</p>
 <p className="text-xs text-gray-600">Declined</p>
 </div>
 </div>

 {/* Reliability Score */}
 <div className="flex items-center justify-center p-3 bg-muted/30 rounded-lg mb-4">
 <div className="text-center">
 <p className="text-xs text-muted-foreground mb-1">Overall Reliability Score</p>
 <p className={cn(
 "text-xl font-bold",
 stats.reliabilityScore >= 90 ? "text-green-600" :
 stats.reliabilityScore >= 70 ? "text-yellow-600" :
 "text-red-600"
 )}>
 {stats.reliabilityScore}%
 </p>
 </div>
 </div>
 </>
 )}

 {stats?.firstVisit && (
 <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg mb-4">
 <div>
 <p className="text-xs text-muted-foreground">First Visit</p>
 <p className="font-medium">{format(new Date(stats.firstVisit), 'MMM d, yyyy')}</p>
 </div>
 {stats?.lastVisit && (
 <div className="text-right">
 <p className="text-xs text-muted-foreground">Last Visit</p>
 <p className="font-medium">{formatDistanceToNow(new Date(stats.lastVisit), { addSuffix: true })}</p>
 </div>
 )}
 </div>
 )}

 <div className="space-y-2">
 {bookingHistory.length === 0 ? (
 <p className="text-center text-muted-foreground py-4">No previous bookings found</p>
 ) : (
 bookingHistory.map((historyItem) => (
 <div key={historyItem.id} className="flex items-start gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
 <div className={cn(
 "mt-1 w-2 h-2 rounded-full flex-shrink-0",
 historyItem.status === 'completed' ? "bg-green-500" :
 historyItem.status === 'no_show' ? "bg-red-500" :
 historyItem.status === 'cancelled_by_user' || historyItem.status === 'cancelled_by_restaurant' ? "bg-amber-500" :
 "bg-gray-400"
 )} />
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between gap-2">
 <p className="font-medium">
 {format(parseISO(historyItem.booking_time), "EEE, MMM d, yyyy")}
 </p>
 <Badge variant="outline" className={cn("text-xs", getStatusColor(historyItem.status))}>
 {formatStatus(historyItem.status)}
 </Badge>
 </div>
 <p className="text-sm text-muted-foreground text-sm">{format(parseISO(historyItem.booking_time), "h:mm a")} • {historyItem.party_size} guests
 {historyItem.occasion && ` • ${historyItem.occasion}`}
 </p>
 {historyItem.special_requests && (
 <p className="text-xs text-muted-foreground text-sm truncate">
 "{historyItem.special_requests}"
 </p>
 )}
 </div>
 </div>
 ))
 )}
 </div>
 </TabsContent>

 {/* Insights Tab */}
 <TabsContent value="insights" className="px-4 py-4 space-y-4 mt-0">
 {insights.length === 0 ? (
 <p className="text-center text-muted-foreground py-4">
 More insights will appear as you learn more about this guest
 </p>
 ) : (
 <div className="space-y-3">
 {insights.map((insight, idx) => (
 <div 
 key={idx} 
 className={cn(
 "flex items-start gap-3 p-4 rounded-lg border",
 insight.type === 'positive' && "bg-green-50 border-green-200",
 insight.type === 'warning' && "bg-amber-50 border-amber-200",
 insight.type === 'info' && "bg-blue-50 border-blue-200",
 insight.type === 'neutral' && "bg-gray-50 border-gray-200"
 )}
 >
 <insight.icon className={cn(
 "h-5 w-5 mt-0.5 flex-shrink-0",
 insight.type === 'positive' && "text-green-600",
 insight.type === 'warning' && "text-amber-600",
 insight.type === 'info' && "text-blue-600",
 insight.type === 'neutral' && "text-gray-600"
 )} />
 <p className={cn(
 "text-sm",
 insight.type === 'positive' && "text-green-800",
 insight.type === 'warning' && "text-amber-800",
 insight.type === 'info' && "text-blue-800",
 insight.type === 'neutral' && "text-gray-800"
 )}>
 {insight.text}
 </p>
 </div>
 ))}
 </div>
 )}

 {/* Preferences */}
 {customerData?.preferred_time_slots?.length || customerData?.preferred_table_types?.length ? (
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <Heart className="h-4 w-4 text-pink-600" />
 Preferences
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {customerData?.preferred_time_slots?.length ? (
 <div>
 <p className="text-xs text-muted-foreground mb-1">Preferred Times</p>
 <div className="flex flex-wrap gap-1">
 {customerData.preferred_time_slots.map((slot, idx) => (
 <Badge key={idx} variant="secondary" className="text-xs">
 <Clock className="h-3 w-3 mr-1" />
 {slot}
 </Badge>
 ))}
 </div>
 </div>
 ) : null}
 {customerData?.preferred_table_types?.length ? (
 <div>
 <p className="text-xs text-muted-foreground mb-1">Preferred Tables</p>
 <div className="flex flex-wrap gap-1">
 {customerData.preferred_table_types.map((type, idx) => (
 <Badge key={idx} variant="secondary" className="text-xs capitalize">
 {type}
 </Badge>
 ))}
 </div>
 </div>
 ) : null}
 </CardContent>
 </Card>
 ) : null}
 </TabsContent>

 {/* Notes Tab */}
 <TabsContent value="notes" className="px-4 py-4 space-y-4 mt-0">
 {!customerData?.notes?.length ? (
 <p className="text-center text-muted-foreground py-4">No notes for this guest yet</p>
 ) : (
 <div className="space-y-3">
 {customerData.notes.map((note) => (
 <div 
 key={note.id} 
 className={cn(
 "p-4 rounded-lg border",
 note.is_important ? "bg-yellow-50 border-yellow-200" : "bg-muted/30"
 )}
 >
 {note.is_important && (
 <Badge variant="outline" className="mb-2 text-xs text-yellow-700 border-yellow-300 bg-yellow-100">
 <AlertCircle className="h-3 w-3 mr-1" />
 Important
 </Badge>
 )}
 {note.category && (
 <Badge variant="secondary" className="mb-2 ml-2 text-xs capitalize">
 {note.category}
 </Badge>
 )}
 <p className="text-sm">{note.note}</p>
 <div className="flex items-center justify-between mt-2">
 <p className="text-xs text-muted-foreground text-sm">{format(new Date(note.created_at), "MMM d, yyyy 'at' h:mm a")}
 </p>
 <Button
 variant="ghost"
 size="sm"
 className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
 onClick={() => handleDeleteNote(note.id)}
 >
 <Trash2 className="h-3 w-3" />
 </Button>
 </div>
 </div>
 ))}
 </div>
 )}
 </TabsContent>

 {/* Manage Tab - Tag/Note/Relationship Management */}
 <TabsContent value="manage" className="px-4 py-4 space-y-4 mt-0">
 {/* Tags Section */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <Tag className="h-4 w-4 text-blue-600" />
 Manage Tags
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* Current Tags */}
 <div>
 <p className="text-sm text-muted-foreground mb-2">Current Tags</p>
 {customerTags.length > 0 ? (
 <div className="flex flex-wrap gap-2">
 {customerTags.map((tag) => (
 <Badge 
 key={tag.id} 
 style={{ backgroundColor: tag.color || '#6b7280' }}
 className="text-white cursor-pointer hover:opacity-80"
 onClick={() => handleToggleTag(tag)}
 >
 {tag.name}
 <X className="h-3 w-3 ml-1" />
 </Badge>
 ))}
 </div>
 ) : (
 <p className="text-sm text-muted-foreground italic">No tags assigned</p>
 )}
 </div>

 {/* Available Tags */}
 <div>
 <p className="text-sm text-muted-foreground mb-2">Add Tags</p>
 {availableTags.filter(t => !customerTags.some(ct => ct.id === t.id)).length > 0 ? (
 <div className="flex flex-wrap gap-2">
 {availableTags
 .filter(tag => !customerTags.some(ct => ct.id === tag.id))
 .map((tag) => (
 <Badge 
 key={tag.id} 
 variant="outline"
 style={{ borderColor: tag.color || '#6b7280', color: tag.color || '#6b7280' }}
 className="cursor-pointer hover:opacity-80"
 onClick={() => handleToggleTag(tag)}
 >
 <Plus className="h-3 w-3 mr-1" />
 {tag.name}
 </Badge>
 ))}
 </div>
 ) : (
 <p className="text-sm text-muted-foreground italic">All tags assigned</p>
 )}
 </div>
 </CardContent>
 </Card>

 {/* Add Note Section */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <FileText className="h-4 w-4 text-purple-600" />
 Add Note
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid gap-4">
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="note-category">Category</Label>
 <Select
 value={newNote.category}
 onValueChange={(value) => setNewNote(prev => ({ ...prev, category: value }))}
 >
 <SelectTrigger id="note-category">
 <SelectValue placeholder="Select category" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="general">General</SelectItem>
 <SelectItem value="preference">Preference</SelectItem>
 <SelectItem value="complaint">Complaint</SelectItem>
 <SelectItem value="compliment">Compliment</SelectItem>
 <SelectItem value="allergy">Allergy</SelectItem>
 <SelectItem value="dietary">Dietary</SelectItem>
 <SelectItem value="special_request">Special Request</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label>Mark as Important?</Label>
 <div className="flex items-center gap-2 pt-2">
 <input
 type="checkbox"
 id="note-important"
 checked={newNote.is_important}
 onChange={(e) => setNewNote(prev => ({ ...prev, is_important: e.target.checked }))}
 className="h-4 w-4 rounded border-gray-300"
 />
 <Label htmlFor="note-important" className="text-sm font-normal cursor-pointer">
 Important Note
 </Label>
 </div>
 </div>
 </div>
 <div className="space-y-2">
 <Label htmlFor="note-content">Note</Label>
 <Textarea
 id="note-content"
 placeholder="Add a note about this guest..."
 value={newNote.note}
 onChange={(e) => setNewNote(prev => ({ ...prev, note: e.target.value }))}
 rows={3}
 />
 </div>
 <Button 
 onClick={handleAddNote} 
 disabled={!newNote.note.trim()}
 className="w-full"
 >
 <Plus className="h-4 w-4 mr-2" />
 Add Note
 </Button>
 </div>
 </CardContent>
 </Card>

 {/* Add Relationship Section */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <Users className="h-4 w-4 text-green-600" />
 Add Relationship
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* Current Relationships */}
 {relationships.length > 0 && (
 <div className="space-y-2 mb-4">
 <p className="text-sm text-muted-foreground">Current Relationships</p>
 <div className="space-y-2">
 {relationships.map((rel) => (
 <div key={rel.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
 <div className="flex items-center gap-2">
 <Badge variant="secondary" className="capitalize">
 {rel.relationship_type}
 </Badge>
 <span className="text-sm">
 {rel.related_customer?.guest_name || 'Unknown'}
 </span>
 </div>
 <Button
 variant="ghost"
 size="sm"
 className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
 onClick={() => handleDeleteRelationship(rel.id)}
 >
 <Trash2 className="h-3 w-3" />
 </Button>
 </div>
 ))}
 </div>
 </div>
 )}

 <div className="grid gap-4">
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="rel-type">Relationship Type</Label>
 <Select
 value={newRelationship.relationship_type}
 onValueChange={(value) => setNewRelationship(prev => ({ ...prev, relationship_type: value }))}
 >
 <SelectTrigger id="rel-type">
 <SelectValue placeholder="Select type" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="spouse">Spouse</SelectItem>
 <SelectItem value="partner">Partner</SelectItem>
 <SelectItem value="family">Family</SelectItem>
 <SelectItem value="friend">Friend</SelectItem>
 <SelectItem value="colleague">Colleague</SelectItem>
 <SelectItem value="assistant">Assistant</SelectItem>
 <SelectItem value="child">Child</SelectItem>
 <SelectItem value="parent">Parent</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="rel-customer">Related Customer</Label>
 <Select
 value={newRelationship.related_customer_id}
 onValueChange={(value) => setNewRelationship(prev => ({ ...prev, related_customer_id: value }))}
 >
 <SelectTrigger id="rel-customer">
 <SelectValue placeholder="Select customer" />
 </SelectTrigger>
 <SelectContent>
 {availableCustomers
 .filter(c => c.id !== customerData?.id)
 .map((customer) => (
 <SelectItem key={customer.id} value={customer.id}>
 {customer.profile?.full_name || customer.guest_name || customer.guest_email || 'Unknown'}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>
 <div className="space-y-2">
 <Label htmlFor="rel-details">Details (Optional)</Label>
 <Input
 id="rel-details"
 placeholder="e.g., Usually books together, Anniversary on..."
 value={newRelationship.relationship_details}
 onChange={(e) => setNewRelationship(prev => ({ ...prev, relationship_details: e.target.value }))}
 />
 </div>
 <Button 
 onClick={handleAddRelationship} 
 disabled={!newRelationship.relationship_type || !newRelationship.related_customer_id}
 className="w-full"
 >
 <Plus className="h-4 w-4 mr-2" />
 Add Relationship
 </Button>
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </div>
 )}
 </Tabs>
 ) : (
 /* Non-CRM Basic View */
 <div className="px-4 py-4 space-y-4">
 {/* Basic Booking Details */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <CalendarIcon className="h-4 w-4 text-blue-600" />
 Booking Details
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Date</p>
 <p className="font-semibold">{format(parseISO(booking.booking_time), "EEE, MMM d, yyyy")}</p>
 </div>
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Time</p>
 <p className="font-semibold">{format(parseISO(booking.booking_time), "h:mm a")}</p>
 </div>
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Party Size</p>
 <p className="font-semibold flex items-center gap-1">
 <Users className="h-4 w-4" />
 {booking.party_size} guests
 </p>
 </div>
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Source</p>
 <Badge variant="outline" className="capitalize">{booking.source || 'manual'}</Badge>
 </div>
 {resolveSectionName(booking.preferred_section) && (
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Section</p>
 <p className="font-semibold">{resolveSectionName(booking.preferred_section)}</p>
 </div>
 )}
 {booking.assigned_table && (
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Table</p>
 <p className="font-semibold">Table {booking.assigned_table}</p>
 </div>
 )}
 {booking.occasion && (
 <div className="space-y-1 col-span-2">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Occasion</p>
 <Badge className="bg-pink-100 text-pink-800">
 <Gift className="h-3 w-3 mr-1" />
 {booking.occasion}
 </Badge>
 </div>
 )}
 </div>

 {booking.special_requests && (
 <div className="mt-4 p-3 bg-muted/50 rounded-lg">
 <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Special Requests</p>
 <p className="text-sm">{booking.special_requests}</p>
 </div>
 )}

 {/* Special Offer - Enhanced visibility */}
 {booking.special_offers && (
 <div className="mt-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg shadow-sm">
 <div className="flex items-start gap-3">
 <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-md">
 <Gift className="h-5 w-5 text-white" />
 </div>
 <div className="flex-1">
 <div className="flex items-start justify-between gap-2 mb-2">
 <div>
 <p className="text-xs text-green-700 font-medium uppercase tracking-wide mb-1">Special Offer Applied</p>
 <h4 className="font-bold text-green-900 text-sm">
 {booking.special_offers.title}
 </h4>
 </div>
 {booking.special_offers.discount_percentage && (
 <Badge variant="secondary" className="bg-green-600 text-white font-bold text-xs px-2 py-1 shadow-sm">
 {booking.special_offers.discount_percentage}% OFF
 </Badge>
 )}
 </div>
 {booking.special_offers.description && (
 <p className="text-xs text-green-800 leading-relaxed">
 {booking.special_offers.description}
 </p>
 )}
 </div>
 </div>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Payment Information Card - Only show for bookings with payment info */}
 {(booking.status === 'pending_payment' || booking.payment_status === 'paid' || booking.booking_guarantee?.status === 'held') && (
 <Card className={cn(
 "border-2",
 booking.status === 'pending_payment' ? "border-amber-200 bg-amber-50/50" : 
 booking.payment_status === 'paid' ? "border-emerald-200 bg-emerald-50/50" :
 "border-blue-200 bg-blue-50/50"
 )}>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <DollarSign className={cn(
 "h-4 w-4",
 booking.status === 'pending_payment' ? "text-amber-600" :
 booking.payment_status === 'paid' ? "text-emerald-600" :
 "text-blue-600"
 )} />
 Payment Information
 {booking.status === 'pending_payment' && (
 <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-700 border-amber-300 motion-safe:animate-pulse">
 <Clock className="h-3 w-3 mr-1" />
 Awaiting Payment
 </Badge>
 )}
 {booking.payment_status === 'paid' && (
 <Badge variant="outline" className="ml-2 bg-emerald-100 text-emerald-700 border-emerald-300">
 <CheckCircle className="h-3 w-3 mr-1" />
 Paid
 </Badge>
 )}
 {booking.booking_guarantee?.status === 'held' && (
 <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-700 border-blue-300">
 <CreditCard className="h-3 w-3 mr-1" />
 Card Held
 </Badge>
 )}
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* Payment Details */}
 <div className="grid grid-cols-2 gap-4">
 {booking.payment_amount && (
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Amount</p>
 <p className="font-bold text-lg text-emerald-700">
 ${parseFloat(booking.payment_amount).toFixed(2)}
 </p>
 </div>
 )}
 {booking.booking_guarantee?.no_show_fee && (
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">No-Show Fee</p>
 <p className="font-semibold">${booking.booking_guarantee.no_show_fee} {booking.booking_guarantee.fee_type === 'per_cover' ? '/cover' : 'fixed'}</p>
 </div>
 )}
 {booking.booking_guarantee?.cancellation_fee && (
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Cancellation Fee</p>
 <p className="font-semibold">${booking.booking_guarantee.cancellation_fee} {booking.booking_guarantee.fee_type === 'per_cover' ? '/cover' : 'fixed'}</p>
 </div>
 )}
 {booking.payment_transaction_id && (
 <div className="space-y-1 col-span-2">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Transaction ID</p>
 <p className="font-mono text-xs text-muted-foreground">{booking.payment_transaction_id}</p>
 </div>
 )}
 </div>

 {/* Payment Link Section - Only for pending_payment status */}
 {booking.status === 'pending_payment' && (
 <div className="border-t pt-4">
 <p className="text-sm font-medium mb-3 flex items-center gap-2">
 <Link2 className="h-4 w-4 text-amber-600" />
 Payment Link
 </p>
 
 {paymentLink ? (
 <div className="space-y-3">
 <div className="relative">
 <Input
 value={paymentLink}
 readOnly
 className="pr-20 font-mono text-xs bg-white"
 />
 <Button
 size="sm"
 variant={paymentLinkCopied ? "default" : "outline"}
 className={cn(
 "absolute right-1 top-1/2 -translate-y-1/2 h-7",
 paymentLinkCopied && "bg-emerald-600 hover:bg-emerald-700"
 )}
 onClick={handleCopyPaymentLink}
 >
 {paymentLinkCopied ? (
 <>
 <CheckCircle className="h-3 w-3 mr-1" />
 Copied!
 </>
 ) : (
 <>
 <Copy className="h-3 w-3 mr-1" />
 Copy
 </>
 )}
 </Button>
 </div>
 <div className="flex gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={() => window.open(paymentLink, '_blank')}
 className="flex-1"
 >
 <ExternalLink className="h-3 w-3 mr-1" />
 Open Link
 </Button>
 <Button
 variant="outline"
 size="sm"
 onClick={handleGeneratePaymentLink}
 disabled={generatingPaymentLink}
 className="flex-1"
 >
 {generatingPaymentLink ? (
 <>
 <Loader2 className="h-3 w-3 mr-1 motion-safe:animate-spin" />
 Regenerating...
 </>
 ) : (
 <>
 <Link2 className="h-3 w-3 mr-1" />
 Regenerate
 </>
 )}
 </Button>
 </div>
 </div>
 ) : (
 <Button
 onClick={handleGeneratePaymentLink}
 disabled={generatingPaymentLink}
 className="w-full bg-amber-600 hover:bg-amber-700"
 >
 {generatingPaymentLink ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 motion-safe:animate-spin" />
 Generating Payment Link...
 </>
 ) : (
 <>
 <Link2 className="h-4 w-4 mr-2" />
 Generate Payment Link
 </>
 )}
 </Button>
 )}
 
 <p className="text-xs text-muted-foreground mt-2">
 Share this link with the guest to complete payment. All links remain valid until payment is completed.
 </p>
 </div>
 )}
 </CardContent>
 </Card>
 )}

 {/* Contact Info */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <User className="h-4 w-4 text-blue-600" />
 Guest Contact
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {guestPhone && (
 <a href={`tel:${guestPhone}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
 <div className="p-2 bg-green-100 rounded-full">
 <Phone className="h-4 w-4 text-green-600" />
 </div>
 <span className="font-medium">{guestPhone}</span>
 </a>
 )}
 {guestEmail && (
 <a href={`mailto:${guestEmail}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
 <div className="p-2 bg-blue-100 rounded-full">
 <Mail className="h-4 w-4 text-blue-600" />
 </div>
 <span className="font-medium">{guestEmail}</span>
 </a>
 )}
 </div>
 </CardContent>
 </Card>

 {/* CRM Upsell */}
 <Card className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 border-blue-200">
 <CardContent className="py-4">
 <div className="flex items-start gap-4">
 <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-lg">
 <Crown className="h-5 w-5 text-white" />
 </div>
 <div className="flex-1">
 <h4 className="font-semibold text-blue-900 mb-1">Unlock Guest CRM</h4>
 <p className="text-sm text-blue-700 mb-3">
 Get detailed guest profiles, booking history, VIP management, automated insights, and more!
 </p>
 <ul className="text-xs text-blue-600 space-y-1">
 <li className="flex items-center gap-2">
 <CheckCircle className="h-3 w-3" /> Guest profiles & preferences
 </li>
 <li className="flex items-center gap-2">
 <CheckCircle className="h-3 w-3" /> Booking history & analytics
 </li>
 <li className="flex items-center gap-2">
 <CheckCircle className="h-3 w-3" /> VIP & loyalty management
 </li>
 <li className="flex items-center gap-2">
 <CheckCircle className="h-3 w-3" /> Smart tags & insights
 </li>
 </ul>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 )}
 </div>

 {/* Fixed Footer */}
 <div className="flex items-center justify-between gap-3 px-4 py-4 border-t flex-shrink-0 bg-background">
 {guestPhone && (
 <Button variant="outline" asChild>
 <a href={`tel:${guestPhone}`}>
 <Phone className="h-4 w-4 mr-2" />
 Call Guest
 </a>
 </Button>
 )}
 <Button variant="default" onClick={() => onOpenChange(false)} className="ml-auto">
 Close
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 )
}
