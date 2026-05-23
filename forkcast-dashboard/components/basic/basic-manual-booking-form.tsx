// components/basic/basic-manual-booking-form.tsx
"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useForm, SubmitHandler, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
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
import { Calendar } from "@/components/ui/calendar"
import {
 Popover,
 PopoverContent,
 PopoverTrigger,
} from "@/components/ui/popover"
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
 DialogFooter,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import PhoneInput from "react-phone-number-input"
import "react-phone-number-input/style.css"
import { 
 CalendarIcon, 
 Clock, 
 AlertCircle, 
 Users,
 UserCheck,
 UserPlus,
 MapPin,
 Gift,
 Search,
 Star,
 Crown,
 X,
 Loader2,
 CheckCircle,
 Phone,
 Mail,
 Cake,
 TrendingUp,
 TrendingDown,
 AlertTriangle,
 History,
 DollarSign,
 CreditCard,
 Link2,
 ShieldCheck,
 Table2,
} from "lucide-react"
import { toast } from "react-hot-toast"
import { useDebounce } from "@/hooks/use-debounce"

// Simplified form schema for basic restaurants (no tables, no existing customers)
const formSchema = z.object({
 guest_name: z.string().min(1, "Guest name is required"),
 guest_email: z.string().email("Valid email is required").optional().or(z.literal("")),
 guest_phone: z.string().optional(), // Made optional
 booking_date: z.date(),
 booking_time: z.string(),
 party_size: z.number().min(1, "At least 1 guest required").max(50, "Maximum 50 guests"),
 special_requests: z.string().optional(),
 occasion: z.string().optional(),
 assigned_table: z.string().optional(),
 preferred_section: z.string().optional(),
 dietary_notes: z.string().optional(),
 event_occurrence_id: z.string().optional(), // For event bookings
 applied_offer_id: z.string().optional(), // Special offer
 status: z.enum(["pending", "confirmed"]),
 // Payment requirement fields
 require_payment: z.boolean().optional(),
 payment_type: z.enum(["deposit", "card_guarantee"]).optional(),
 deposit_amount: z.number().min(0.01, "Deposit amount must be greater than 0").optional(),
}).refine((data) => {
 // If require_payment is true, payment_type must be set
 if (data.require_payment && !data.payment_type) {
 return false
 }
 // If payment_type is deposit, deposit_amount must be set
 if (data.require_payment && data.payment_type === "deposit" && (!data.deposit_amount || data.deposit_amount <= 0)) {
 return false
 }
 return true
}, {
 message: "Please complete payment configuration",
 path: ["payment_type"]
})

type FormData = z.infer<typeof formSchema>

interface BasicManualBookingFormProps {
 restaurantId: string
 onSubmit: (data: any) => void
 onCancel: () => void
 isLoading: boolean
 hasGuestCRM?: boolean // Whether restaurant has Guest CRM addon
 hasFloorPlan?: boolean // Whether restaurant has Floor Plan addon
}

// Customer type from restaurant_customers table (matches search_customers_fuzzy RPC return type)
interface CustomerTag {
 id: string
 name: string
 color: string
 description?: string
}

interface RestaurantCustomer {
 id: string
 user_id: string | null
 guest_name: string | null
 guest_email: string | null
 guest_phone: string | null
 total_bookings: number
 total_spent: number
 vip_status: boolean
 blacklisted: boolean
 preferred_table_types: string[] | null
 preferred_time_slots: string[] | null
 last_visit: string | null
 first_visit: string | null
 no_show_count: number
 cancelled_count: number
 average_party_size?: number | null
 notes?: string | null
 similarity_score?: number
 date_of_birth?: string | null
 dietary_restrictions?: string[] | null
 allergies?: string[] | null
 tags?: CustomerTag[] | null
 // Legacy profile field for backward compatibility
 profile?: {
 dietary_restrictions?: string[] | null
 allergies?: string[] | null
 date_of_birth?: string | null
 } | null
}

// Helper: Check if birthday is within N days from today
function isBirthdaySoon(dateOfBirth: string | null | undefined, withinDays: number = 7): boolean {
 if (!dateOfBirth) return false
 
 const today = new Date()
 const dob = new Date(dateOfBirth)
 
 // Create this year's birthday
 const thisYearBirthday = new Date(
 today.getFullYear(),
 dob.getMonth(),
 dob.getDate()
 )
 
 // If birthday already passed this year, check next year
 if (thisYearBirthday < today) {
 thisYearBirthday.setFullYear(today.getFullYear() + 1)
 }
 
 // Calculate days until birthday
 const diffTime = thisYearBirthday.getTime() - today.getTime()
 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
 
 return diffDays >= 0 && diffDays <= withinDays
}

// Helper: Get days until birthday
function getDaysUntilBirthday(dateOfBirth: string | null | undefined): number | null {
 if (!dateOfBirth) return null
 
 const today = new Date()
 const dob = new Date(dateOfBirth)
 
 const thisYearBirthday = new Date(
 today.getFullYear(),
 dob.getMonth(),
 dob.getDate()
 )
 
 if (thisYearBirthday < today) {
 thisYearBirthday.setFullYear(today.getFullYear() + 1)
 }
 
 const diffTime = thisYearBirthday.getTime() - today.getTime()
 return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

// Helper: Format date for display
function formatRelativeDate(dateStr: string | null | undefined): string {
 if (!dateStr) return 'Never'
 
 const date = new Date(dateStr)
 const now = new Date()
 const diffTime = now.getTime() - date.getTime()
 const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
 
 if (diffDays === 0) return 'Today'
 if (diffDays === 1) return 'Yesterday'
 if (diffDays < 7) return `${diffDays} days ago`
 if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
 if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
 return `${Math.floor(diffDays / 365)} years ago`
}

export function BasicManualBookingForm({
 restaurantId,
 onSubmit,
 onCancel,
 isLoading,
 hasGuestCRM = false,
 hasFloorPlan = false,
}: BasicManualBookingFormProps) {
 const supabase = createClient()

 // Table selection state (for Floor Plan addon)
 const [selectedTableIds, setSelectedTableIds] = useState<string[]>([])

 // Customer search state (for Guest CRM addon)
 const [customerSearch, setCustomerSearch] = useState("")
 const [showCustomerResults, setShowCustomerResults] = useState(false)
 const [selectedCustomer, setSelectedCustomer] = useState<RestaurantCustomer | null>(null)
 const debouncedSearch = useDebounce(customerSearch, 300)
 
 // Matching customer dialog state (for prompting to use existing or add new)
 const [showMatchingDialog, setShowMatchingDialog] = useState(false)
 const [matchingCustomers, setMatchingCustomers] = useState<RestaurantCustomer[]>([])
 const [pendingBookingData, setPendingBookingData] = useState<any>(null)
 const [isCheckingMatches, setIsCheckingMatches] = useState(false)
 const [showAddToGuestPrompt, setShowAddToGuestPrompt] = useState(false)

 const {
 register,
 handleSubmit,
 formState: { errors },
 setValue,
 watch,
 control,
 } = useForm<FormData>({
 resolver: zodResolver(formSchema),
 defaultValues: {
 guest_name: "",
 guest_email: "",
 guest_phone: "",
 party_size: undefined, // No default - admin must input manually
 status: "confirmed",
 booking_date: new Date(),
 booking_time: "", // No default - admin must input manually
 special_requests: "",
 occasion: "",
 assigned_table: "",
 preferred_section: "",
 dietary_notes: "",
 event_occurrence_id: "",
 require_payment: false,
 payment_type: undefined,
 deposit_amount: undefined,
 },
 })

 const bookingDate = watch("booking_date")
 const bookingTime = watch("booking_time")
 const partySize = watch("party_size")
 const selectedEventId = watch("event_occurrence_id")
 const requirePayment = watch("require_payment")
 const paymentType = watch("payment_type")

 // Fetch available special offers
 const { data: specialOffers } = useQuery({
 queryKey: ["special-offers", restaurantId, bookingDate, partySize],
 queryFn: async () => {
 if (!bookingDate) return []

 const now = new Date()
 const bookingDateObj = new Date(bookingDate)

 const { data, error } = await supabase
 .from("special_offers")
 .select("*")
 .eq("restaurant_id", restaurantId)
 .lte("valid_from", bookingDateObj.toISOString())
 .gte("valid_until", bookingDateObj.toISOString())
 .lte("minimum_party_size", partySize || 1)
 .order("title")

 if (error) throw error

 // Filter by applicable days if specified
 const dayOfWeek = bookingDateObj.getDay() // 0 = Sunday, 6 = Saturday
 const filtered = (data || []).filter(offer => {
 if (!offer.applicable_days || offer.applicable_days.length === 0) return true
 return offer.applicable_days.includes(dayOfWeek)
 })

 return filtered
 },
 enabled: !!restaurantId && !!bookingDate,
 })

 // Fetch restaurant sections with closure filtering
 const { data: sections } = useQuery({
 queryKey: ["restaurant-sections-with-closures", restaurantId, bookingDate, bookingTime],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("restaurant_sections")
 .select("*")
 .eq("restaurant_id", restaurantId)
 .eq("is_active", true)
 .order("name")

 if (error) throw error

 const allSections = data || []

 // If no booking date/time, return all active sections
 if (!bookingDate || !bookingTime) return allSections

 // Format date in YYYY-MM-DD format without timezone conversion
 const year = bookingDate.getFullYear()
 const month = String(bookingDate.getMonth() + 1).padStart(2, '0')
 const day = String(bookingDate.getDate()).padStart(2, '0')
 const bookingDateStr = `${year}-${month}-${day}`

 const { data: closures, error: closuresError } = await supabase
 .from("section_closures")
 .select("*")
 .in("section_id", allSections.map(s => s.id))
 .lte("start_date", bookingDateStr)
 .gte("end_date", bookingDateStr)

 if (closuresError) throw closuresError

 // If no closures, return all sections
 if (!closures || closures.length === 0) return allSections

 // Filter out sections with active closures
 const filteredSections = allSections.filter((section) => {
 const sectionClosures = closures.filter(
 (c) => c.section_id === section.id
 )

 // Check if any closure applies to this section
 return !sectionClosures.some((closure) => {
 // If no time range specified, closure applies all day
 if (!closure.start_time || !closure.end_time) {
 return true // Section is closed all day
 }

 // Check if booking time falls within closure time range
 const bookingTimeFormatted = bookingTime.substring(0, 5) // HH:mm
 const startTimeFormatted = closure.start_time.substring(0, 5)
 const endTimeFormatted = closure.end_time.substring(0, 5)

 return (
 bookingTimeFormatted >= startTimeFormatted &&
 bookingTimeFormatted < endTimeFormatted
 )
 })
 })

 return filteredSections
 },
 enabled: !!restaurantId,
 })

 // Fetch restaurant tables for Floor Plan addon
 const { data: availableTables = [] } = useQuery({
 queryKey: ["restaurant-tables-for-booking", restaurantId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("restaurant_tables")
 .select(`
 *,
 section:restaurant_sections(id, name, color)
 `)
 .eq("restaurant_id", restaurantId)
 .eq("is_active", true)
 .order("table_number", { ascending: true })

 if (error) throw error
 return data || []
 },
 enabled: !!restaurantId && hasFloorPlan,
 staleTime: 5 * 60 * 1000,
 })

 // Group tables by section for display
 const tablesBySection = useMemo(() => {
 const sections: Record<string, any[]> = {}
 availableTables.forEach((table: any) => {
 const sectionName = table.section?.name || 'No Section'
 if (!sections[sectionName]) {
 sections[sectionName] = []
 }
 sections[sectionName].push(table)
 })
 return sections
 }, [availableTables])

 // Calculate selected table capacity
 const selectedTableCapacity = useMemo(() => {
 return selectedTableIds.reduce((total, tableId) => {
 const table = availableTables.find((t: any) => t.id === tableId)
 return total + (table?.capacity || 0)
 }, 0)
 }, [selectedTableIds, availableTables])

 // Fetch upcoming events for optional event booking
 const { data: upcomingEvents } = useQuery({
 queryKey: ["upcoming-events", restaurantId, bookingDate],
 queryFn: async () => {
 if (!bookingDate) return []

 const today = new Date().toISOString().split("T")[0]

 const { data, error } = await supabase
 .from("event_occurrences")
 .select(`
 id,
 occurrence_date,
 start_time,
 end_time,
 status,
 max_capacity,
 current_bookings,
 event:restaurant_events!event_occurrences_event_id_fkey (
 id,
 title,
 description,
 event_type,
 restaurant_id,
 is_active
 )
 `)
 .eq("status", "scheduled")
 .gte("occurrence_date", today)
 .order("occurrence_date")
 .order("start_time")

 if (error) throw error
 
 // Filter by restaurant_id, ensure event exists, and event is active
 const filtered = (data || []).filter(
 (occurrence: any) => 
 occurrence.event && 
 occurrence.event.restaurant_id === restaurantId &&
 occurrence.event.is_active === true
 )
 
 return filtered.slice(0, 10)
 },
 enabled: !!restaurantId && !!bookingDate,
 })

 // Fetch card guarantee settings for the restaurant
 const { data: guaranteeSettings } = useQuery({
 queryKey: ["guarantee-settings", restaurantId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("card_guarantee_settings")
 .select("*")
 .eq("restaurant_id", restaurantId)
 .maybeSingle()

 if (error) throw error
 return data
 },
 enabled: !!restaurantId,
 })

 // Fetch restaurant service fee percentages (MontyPay and Whish)
 const { data: restaurantData } = useQuery({
 queryKey: ["restaurant-service-fee", restaurantId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("restaurants")
 .select("service_fee_percentage, whish_service_fee_percentage")
 .eq("id", restaurantId)
 .single()

 if (error) throw error
 return data
 },
 enabled: !!restaurantId,
 })

 // Calculate service fee and total for deposit
 const depositAmount = watch("deposit_amount")
 
 // Use Whish service fee for deposits (default 1%), MontyPay service fee for card guarantees
 const serviceFeePercentage = paymentType === "deposit" 
 ? (restaurantData?.whish_service_fee_percentage ?? 1) // Default 1% for Whish deposits
 : (restaurantData?.service_fee_percentage || 0) // MontyPay fee for card guarantees
 
 const serviceFeeAmount = depositAmount && serviceFeePercentage > 0 
 ? depositAmount * (serviceFeePercentage / 100) 
 : 0
 const totalWithServiceFee = depositAmount 
 ? depositAmount + serviceFeeAmount 
 : 0

 // Search customers when Guest CRM addon is enabled - using fuzzy search RPC
 const { data: searchResults, isLoading: isSearchingCustomers } = useQuery({
 queryKey: ["customer-search-fuzzy", restaurantId, debouncedSearch],
 queryFn: async () => {
 if (!debouncedSearch || debouncedSearch.length < 2) return []
 
 // Use fuzzy search RPC for better matching (handles typos and similar names)
 const { data, error } = await supabase.rpc('search_customers_fuzzy', {
 p_restaurant_id: restaurantId,
 p_search_term: debouncedSearch,
 p_limit: 10
 })
 
 let customers: RestaurantCustomer[] = []
 
 if (error) {
 console.error('Fuzzy customer search error:', error)
 // Fallback to basic search if RPC fails
 const { data: fallbackData, error: fallbackError } = await supabase
 .from("restaurant_customers")
 .select(`
 id, user_id, guest_name, guest_email, guest_phone,
 total_bookings, total_spent, vip_status, blacklisted,
 preferred_table_types, preferred_time_slots,
 last_visit, first_visit, no_show_count, cancelled_count,
 average_party_size, notes,
 tags:customer_tag_assignments(tag:customer_tags(id, name, color, description))
 `)
 .eq("restaurant_id", restaurantId)
 .eq("blacklisted", false)
 .or(`guest_name.ilike.%${debouncedSearch}%,guest_email.ilike.%${debouncedSearch}%,guest_phone.ilike.%${debouncedSearch}%`)
 .order("total_bookings", { ascending: false })
 .limit(10)
 
 if (fallbackError) {
 console.error('Fallback search error:', fallbackError)
 return []
 }
 
 // Transform tags from nested structure
 customers = (fallbackData || []).map((c: any) => ({
 ...c,
 tags: c.tags?.map((t: any) => t.tag).filter(Boolean) || []
 }))
 } else {
 customers = (data || []) as RestaurantCustomer[]
 }
 
 // Fetch tags for customers if not already present
 if (customers.length > 0) {
 const customerIds = customers.map(c => c.id)
 const { data: tagsData } = await supabase
 .from('customer_tag_assignments')
 .select('customer_id, tag:customer_tags(id, name, color, description)')
 .in('customer_id', customerIds)
 
 if (tagsData) {
 // Group tags by customer_id
 const tagsByCustomer = tagsData.reduce((acc: Record<string, CustomerTag[]>, item: any) => {
 if (item.tag) {
 if (!acc[item.customer_id]) acc[item.customer_id] = []
 acc[item.customer_id].push(item.tag)
 }
 return acc
 }, {})
 
 // Merge tags into customers
 customers = customers.map(c => ({
 ...c,
 tags: tagsByCustomer[c.id] || c.tags || []
 }))
 }
 }
 
 return customers
 },
 enabled: hasGuestCRM && !!restaurantId && debouncedSearch.length >= 2,
 })

 // Handle customer selection from search results
 const handleSelectCustomer = useCallback((customer: RestaurantCustomer) => {
 setSelectedCustomer(customer)
 setShowCustomerResults(false)
 setCustomerSearch("")
 
 // Auto-fill form fields with customer data
 setValue("guest_name", customer.guest_name || "")
 setValue("guest_email", customer.guest_email || "")
 
 // Handle phone: PhoneInput can handle full international format, so use it as-is
 if (customer.guest_phone) {
 setValue("guest_phone", customer.guest_phone)
 } else {
 setValue("guest_phone", "")
 }
 
 // Auto-fill dietary notes from either new flat fields or legacy profile
 const dietaryPrefs: string[] = []
 const dietaryRestrictions = customer.dietary_restrictions || customer.profile?.dietary_restrictions
 const allergies = customer.allergies || customer.profile?.allergies
 
 if (dietaryRestrictions?.length) {
 dietaryPrefs.push(...dietaryRestrictions)
 }
 if (allergies?.length) {
 dietaryPrefs.push(...allergies.map(a => `Allergy: ${a}`))
 }
 if (dietaryPrefs.length > 0) {
 setValue("dietary_notes", dietaryPrefs.join(", "))
 }
 
 toast.success(`Selected ${customer.guest_name}${customer.vip_status ? ' (VIP)' : ''}`)
 }, [setValue])

 // Clear selected customer
 const handleClearCustomer = useCallback(() => {
 setSelectedCustomer(null)
 setValue("guest_name", "")
 setValue("guest_email", "")
 setValue("guest_phone", "")
 setValue("dietary_notes", "")
 }, [setValue])

 // Get the selected event details
 const selectedEvent = upcomingEvents?.find(e => e.id === selectedEventId)

 // Update date and time when event is selected
 useEffect(() => {
 if (selectedEvent) {
 // Set date to event's occurrence date
 const eventDate = new Date(selectedEvent.occurrence_date)
 setValue("booking_date", eventDate)
 
 // Set time to event's start time
 setValue("booking_time", selectedEvent.start_time)
 }
 }, [selectedEvent, setValue])

 // Check for matching customers in the database
 const checkForMatchingCustomers = async (name: string, email: string | null, phone: string | null) => {
 if (!hasGuestCRM) return []
 
 const conditions: string[] = []
 
 // Build search conditions
 if (name) {
 conditions.push(`guest_name.ilike.%${name}%`)
 }
 if (email) {
 conditions.push(`guest_email.eq.${email}`)
 }
 if (phone) {
 conditions.push(`guest_phone.eq.${phone}`)
 }
 
 if (conditions.length === 0) return []
 
 const { data, error } = await supabase
 .from("restaurant_customers")
 .select(`
 id,
 user_id,
 guest_name,
 guest_email,
 guest_phone,
 total_bookings,
 total_spent,
 vip_status,
 blacklisted,
 preferred_table_types,
 preferred_time_slots,
 last_visit,
 first_visit,
 no_show_count,
 cancelled_count
 `)
 .eq("restaurant_id", restaurantId)
 .eq("blacklisted", false)
 .or(conditions.join(','))
 .limit(5)
 
 if (error) {
 console.error('Error checking for matching customers:', error)
 return []
 }
 
 return (data || []) as RestaurantCustomer[]
 }

 // Add new customer to restaurant_customers
 const addNewCustomer = async (name: string, email: string | null, phone: string | null) => {
 const { data, error } = await supabase
 .from("restaurant_customers")
 .insert({
 restaurant_id: restaurantId,
 guest_name: name,
 guest_email: email,
 guest_phone: phone,
 total_bookings: 0,
 total_spent: 0,
 vip_status: false,
 blacklisted: false,
 })
 .select()
 .single()
 
 if (error) {
 console.error('Error adding new customer:', error)
 toast.error('Failed to add customer to database')
 return null
 }
 
 toast.success(`Added ${name} to your guest database!`)
 return data as RestaurantCustomer
 }

 const handleFormSubmit: SubmitHandler<FormData> = async (data: FormData): Promise<void> => {
 // Validate required fields
 if (!data.guest_name?.trim()) {
 toast.error("Guest name is required")
 return
 }

 // Combine date and time to create booking datetime
 const [hours, minutes] = data.booking_time.split(":")
 const bookingDateTime = new Date(data.booking_date)
 bookingDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)

 // PhoneInput already includes the country code, so use it directly
 const guestPhone = data.guest_phone?.trim() || null

 // Prepare booking data
 const processedData = {
 guest_name: data.guest_name.trim(),
 guest_email: data.guest_email?.trim() || null,
 guest_phone: guestPhone,
 booking_time: bookingDateTime.toISOString(),
 party_size: data.party_size,
 status: data.status,
 special_requests: data.special_requests?.trim() || null,
 occasion: data.occasion?.trim() || null,
 assigned_table: hasFloorPlan ? null : (data.assigned_table?.trim() || null),
 table_ids: hasFloorPlan ? selectedTableIds : [],
 preferred_section: data.preferred_section?.trim() || null,
 dietary_notes: data.dietary_notes?.trim() || null,
 event_occurrence_id: data.event_occurrence_id || null,
 is_event_booking: !!data.event_occurrence_id,
 turn_time_minutes: 120, // Default 2 hours
 // Include selected customer info if using Guest CRM
 customer_id: selectedCustomer?.id || null,
 user_id: selectedCustomer?.user_id || null,
 // Special offer
 applied_offer_id: data.applied_offer_id && data.applied_offer_id !== "none" && data.applied_offer_id !== "" ? data.applied_offer_id : null,
 // Payment requirement fields
 require_payment: data.require_payment || false,
 payment_type: data.require_payment ? data.payment_type : null,
 deposit_amount: data.require_payment && data.payment_type === "deposit" ? data.deposit_amount : null,
 // Guarantee settings for card_guarantee type
 guarantee_settings: data.require_payment && data.payment_type === "card_guarantee" ? {
 no_show_fee: guaranteeSettings?.no_show_fee || 0,
 cancellation_fee: guaranteeSettings?.late_cancel_fee || 0,
 fee_type: guaranteeSettings?.fee_type || "per_cover",
 } : null,
 }

 // If a customer is already selected from CRM, just submit
 if (selectedCustomer) {
 onSubmit(processedData)
 return
 }

 // For Guest CRM users, check for matching customers before creating
 if (hasGuestCRM) {
 setIsCheckingMatches(true)
 const matches = await checkForMatchingCustomers(
 data.guest_name.trim(),
 data.guest_email?.trim() || null,
 guestPhone
 )
 setIsCheckingMatches(false)

 if (matches.length > 0) {
 // Show dialog to select existing customer or create new
 setMatchingCustomers(matches)
 setPendingBookingData(processedData)
 setShowMatchingDialog(true)
 return
 } else {
 // No matches found - ask if they want to add as new guest
 setPendingBookingData(processedData)
 setShowAddToGuestPrompt(true)
 return
 }
 }

 // Non-CRM users just submit directly
 onSubmit(processedData)
 }

 // Handle selecting an existing customer from matches
 const handleSelectExistingCustomer = (customer: RestaurantCustomer) => {
 if (!pendingBookingData) return
 
 const updatedData = {
 ...pendingBookingData,
 customer_id: customer.id,
 user_id: customer.user_id,
 }
 
 setShowMatchingDialog(false)
 setMatchingCustomers([])
 setPendingBookingData(null)
 onSubmit(updatedData)
 }

 // Handle creating booking without linking to existing customer
 const handleCreateWithoutLinking = () => {
 if (!pendingBookingData) return
 
 setShowMatchingDialog(false)
 setMatchingCustomers([])
 // Show prompt to add as new guest
 setShowAddToGuestPrompt(true)
 }

 // Handle adding new guest and creating booking
 const handleAddNewGuestAndSubmit = async () => {
 if (!pendingBookingData) return
 
 setIsCheckingMatches(true)
 const newCustomer = await addNewCustomer(
 pendingBookingData.guest_name,
 pendingBookingData.guest_email,
 pendingBookingData.guest_phone
 )
 setIsCheckingMatches(false)
 
 const updatedData = {
 ...pendingBookingData,
 customer_id: newCustomer?.id || null,
 user_id: newCustomer?.user_id || null,
 }
 
 setShowAddToGuestPrompt(false)
 setPendingBookingData(null)
 onSubmit(updatedData)
 }

 // Handle skipping adding to guest database
 const handleSkipAddGuest = () => {
 if (!pendingBookingData) return
 
 setShowAddToGuestPrompt(false)
 setPendingBookingData(null)
 onSubmit(pendingBookingData)
 }

 return (
 <div className="basic-manual-booking-form max-w-full overflow-x-hidden">
 <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 max-w-full overflow-x-hidden pb-24">
 
 {/* Guest CRM Search Section - Only shown when addon is enabled */}
 {hasGuestCRM && (
 <div className="space-y-4 rounded-lg border border-amber-200 p-6 bg-amber-50 shadow-sm">
 <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
 <Crown className="h-5 w-5 text-amber-600" />
 Search Existing Guest
 <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-700 border-amber-300">
 Guest CRM
 </Badge>
 </h3>
 <p className="text-sm text-slate-600">
 Search your customer database to auto-fill guest details
 </p>
 
 {selectedCustomer ? (
 // Show selected customer card with stats
 <div className="space-y-4">
 {/* Customer Header Card */}
 <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-white border border-amber-200">
 <div className="flex items-center gap-3">
 <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
 {selectedCustomer.vip_status ? (
 <Crown className="h-5 w-5 text-amber-600" />
 ) : (
 <UserCheck className="h-5 w-5 text-amber-600" />
 )}
 </div>
 <div>
 <div className="flex items-center gap-2">
 <span className="font-medium text-slate-900">
 {selectedCustomer.guest_name}
 </span>
 {selectedCustomer.vip_status && (
 <Badge className="bg-amber-500 text-white">
 VIP
 </Badge>
 )}
 </div>
 <div className="flex items-center gap-3 text-sm text-slate-500">
 <span>{selectedCustomer.total_bookings} visits</span>
 {selectedCustomer.guest_email && <span>• {selectedCustomer.guest_email}</span>}
 </div>
 </div>
 </div>
 <Button
 type="button"
 variant="ghost"
 size="sm"
 onClick={handleClearCustomer}
 className="text-slate-500 hover:text-red-600"
 >
 <X className="h-4 w-4" />
 </Button>
 </div>

 {/* Birthday Alert - if birthday is within 7 days */}
 {(() => {
 const dob = selectedCustomer.date_of_birth || selectedCustomer.profile?.date_of_birth
 if (isBirthdaySoon(dob, 7)) {
 const daysUntil = getDaysUntilBirthday(dob)
 const birthdayDate = dob ? new Date(dob) : null
 return (
 <Alert className="bg-pink-50 border-pink-200">
 <Cake className="h-4 w-4 text-pink-600" />
 <AlertDescription className="text-pink-900">
 <strong>🎂 Birthday {daysUntil === 0 ? 'Today!' : `in ${daysUntil} day${daysUntil === 1 ? '' : 's'}!`}</strong>
 {birthdayDate && ` (${format(birthdayDate, 'MMMM d')})`}
 {' - Consider adding a special touch to their booking!'}
 </AlertDescription>
 </Alert>
 )
 }
 return null
 })()}

 {/* Customer Stats Card */}
 <Card className="bg-slate-50 border-slate-200">
 <CardContent className="p-4">
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
 {/* Total Visits */}
 <div className="text-center p-2 rounded-lg bg-white">
 <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
 <History className="h-4 w-4" />
 </div>
 <p className="text-lg font-semibold text-slate-900">
 {selectedCustomer.total_bookings}
 </p>
 <p className="text-xs text-slate-500">Total Visits</p>
 </div>

 {/* Last Visit */}
 <div className="text-center p-2 rounded-lg bg-white">
 <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
 <CalendarIcon className="h-4 w-4" />
 </div>
 <p className="text-sm font-semibold text-slate-900">
 {formatRelativeDate(selectedCustomer.last_visit)}
 </p>
 <p className="text-xs text-slate-500">Last Visit</p>
 </div>

 {/* Avg Party Size */}
 <div className="text-center p-2 rounded-lg bg-white">
 <div className="flex items-center justify-center gap-1 text-purple-600 mb-1">
 <Users className="h-4 w-4" />
 </div>
 <p className="text-lg font-semibold text-slate-900">
 {selectedCustomer.average_party_size 
 ? Number(selectedCustomer.average_party_size).toFixed(1) 
 : '-'}
 </p>
 <p className="text-xs text-slate-500">Avg Party</p>
 </div>

 {/* No-Show Rate */}
 {(() => {
 const total = selectedCustomer.total_bookings || 0
 const noShows = selectedCustomer.no_show_count || 0
 const rate = total > 0 ? Math.round((noShows / total) * 100) : 0
 const isWarning = rate > 20
 return (
 <div className="text-center p-2 rounded-lg bg-white">
 <div className={cn(
 "flex items-center justify-center gap-1 mb-1",
 isWarning ? "text-red-600" : "text-slate-600"
 )}>
 {isWarning ? <AlertTriangle className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
 </div>
 <p className={cn(
 "text-lg font-semibold",
 isWarning ? "text-red-600" : "text-slate-900"
 )}>
 {rate}%
 </p>
 <p className="text-xs text-slate-500">No-Shows</p>
 </div>
 )
 })()}
 </div>

 {/* Additional Stats Row */}
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-200">
 {/* Total Spent */}
 {selectedCustomer.total_spent > 0 && (
 <div className="flex items-center gap-2">
 <DollarSign className="h-4 w-4 text-green-600" />
 <div>
 <p className="text-sm font-medium text-slate-900">
 ${Number(selectedCustomer.total_spent).toLocaleString()}
 </p>
 <p className="text-xs text-slate-500">Total Spent</p>
 </div>
 </div>
 )}

 {/* First Visit */}
 {selectedCustomer.first_visit && (
 <div className="flex items-center gap-2">
 <Star className="h-4 w-4 text-amber-600" />
 <div>
 <p className="text-sm font-medium text-slate-900">
 {format(new Date(selectedCustomer.first_visit), 'MMM d, yyyy')}
 </p>
 <p className="text-xs text-slate-500">First Visit</p>
 </div>
 </div>
 )}

 {/* Cancellation Count */}
 {selectedCustomer.cancelled_count > 0 && (
 <div className="flex items-center gap-2">
 <X className="h-4 w-4 text-orange-600" />
 <div>
 <p className="text-sm font-medium text-slate-900">
 {selectedCustomer.cancelled_count}
 </p>
 <p className="text-xs text-slate-500">Cancellations</p>
 </div>
 </div>
 )}
 </div>

 {/* Preferred Times/Tables */}
 {(selectedCustomer.preferred_time_slots?.length || selectedCustomer.preferred_table_types?.length) && (
 <div className="mt-4 pt-4 border-t border-slate-200">
 <p className="text-xs font-medium text-slate-600 mb-2">Preferences</p>
 <div className="flex flex-wrap gap-2">
 {selectedCustomer.preferred_time_slots?.map((slot, idx) => (
 <Badge key={`time-${idx}`} variant="outline" className="text-xs">
 <Clock className="h-3 w-3 mr-1" />
 {slot}
 </Badge>
 ))}
 {selectedCustomer.preferred_table_types?.map((type, idx) => (
 <Badge key={`table-${idx}`} variant="outline" className="text-xs">
 <MapPin className="h-3 w-3 mr-1" />
 {type}
 </Badge>
 ))}
 </div>
 </div>
 )}

 {/* Customer Notes */}
 {selectedCustomer.notes && (
 <div className="mt-4 pt-4 border-t border-slate-200">
 <p className="text-xs font-medium text-slate-600 mb-2">Staff Notes</p>
 <p className="text-sm text-slate-700 bg-white p-2 rounded">
 {selectedCustomer.notes}
 </p>
 </div>
 )}
 </CardContent>
 </Card>
 </div>
 ) : (
 // Show search input
 <div className="relative">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 placeholder="Search by name, email, or phone..."
 value={customerSearch}
 onChange={(e) => {
 setCustomerSearch(e.target.value)
 setShowCustomerResults(true)
 }}
 onFocus={() => setShowCustomerResults(true)}
 className="pl-10"
 disabled={isLoading}
 />
 {isSearchingCustomers && (
 <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 motion-safe:animate-spin text-amber-600" />
 )}
 
 {/* Search Results Dropdown */}
 {showCustomerResults && searchResults && searchResults.length > 0 && (
 <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
 {searchResults.map((customer) => {
 const customerDob = customer.date_of_birth || customer.profile?.date_of_birth
 const hasBirthdaySoon = isBirthdaySoon(customerDob, 7)
 
 return (
 <button
 key={customer.id}
 type="button"
 onClick={() => handleSelectCustomer(customer)}
 className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-left"
 >
 <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center">
 {customer.vip_status ? (
 <Crown className="h-4 w-4 text-amber-500" />
 ) : (
 <UserCheck className="h-4 w-4 text-slate-500" />
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="font-medium text-slate-900 truncate">
 {customer.guest_name}
 </span>
 {customer.vip_status && (
 <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
 VIP
 </Badge>
 )}
 {hasBirthdaySoon && (
 <Badge variant="outline" className="text-xs bg-pink-50 text-pink-700 border-pink-300">
 <Cake className="h-3 w-3 mr-1" />
 {getDaysUntilBirthday(customerDob) === 0 ? 'Today!' : `${getDaysUntilBirthday(customerDob)}d`}
 </Badge>
 )}
 {/* Customer Tags */}
 {customer.tags && customer.tags.length > 0 && customer.tags.slice(0, 3).map((tag) => (
 <Badge 
 key={tag.id} 
 variant="outline" 
 className="text-xs"
 style={{ 
 backgroundColor: `${tag.color}20`,
 borderColor: tag.color,
 color: tag.color
 }}
 >
 {tag.name}
 </Badge>
 ))}
 {customer.tags && customer.tags.length > 3 && (
 <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600">
 +{customer.tags.length - 3}
 </Badge>
 )}
 </div>
 <div className="flex items-center gap-2 text-xs text-slate-500">
 <span>{customer.total_bookings} visits</span>
 {customer.guest_email && <span>• {customer.guest_email}</span>}
 {customer.guest_phone && <span>• {customer.guest_phone}</span>}
 </div>
 </div>
 </button>
 )
 })}
 </div>
 )}
 
 {/* No Results Message */}
 {showCustomerResults && debouncedSearch.length >= 2 && searchResults?.length === 0 && !isSearchingCustomers && (
 <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-4 text-center text-sm text-slate-500">
 No customers found. You can enter details manually below.
 </div>
 )}
 </div>
 )}
 </div>
 )}

 {/* Guest Information */}
 <div className="space-y-4 rounded-lg border border-slate-200 p-6 bg-white shadow-sm">
 <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
 <UserCheck className="h-5 w-5 text-blue-600" />
 Guest Information
 {selectedCustomer && (
 <Badge variant="secondary" className="ml-2">
 Auto-filled from CRM
 </Badge>
 )}
 </h3>
 <p className="text-sm text-slate-600">
 {hasGuestCRM && !selectedCustomer 
 ? "Enter guest details manually or search above to auto-fill"
 : "Enter the guest's contact details for this booking"
 }
 </p>
 
 <div>
 <Label htmlFor="guest_name">Guest Name *</Label>
 <Input
 id="guest_name"
 placeholder="Enter guest's full name"
 {...register("guest_name")}
 disabled={isLoading}
 />
 {errors.guest_name && (
 <p className="text-sm text-red-600 mt-1">{errors.guest_name.message}</p>
 )}
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <Label htmlFor="guest_phone">Phone Number (Optional)</Label>
 {selectedCustomer ? (
 <Input
 id="guest_phone"
 type="tel"
 value={selectedCustomer.guest_phone || ""}
 disabled={true}
 placeholder="Auto-filled from selected customer"
 />
 ) : (
 <Controller
 name="guest_phone"
 control={control}
 render={({ field }) => (
 <PhoneInput
 international
 defaultCountry="LB"
 value={field.value || ""}
 onChange={(value) => field.onChange(value || "")}
 disabled={isLoading}
 placeholder="Enter phone number"
 className={cn(
 errors.guest_phone && "PhoneInput--error"
 )}
 inputComponent={Input}
 />
 )}
 />
 )}
 {errors.guest_phone && (
 <p className="text-sm text-red-600 mt-1">{errors.guest_phone.message}</p>
 )}
 </div>

 <div>
 <Label htmlFor="guest_email">Email (Optional)</Label>
 <Input
 id="guest_email"
 type="email"
 placeholder="Enter email address"
 {...register("guest_email")}
 disabled={isLoading}
 />
 {errors.guest_email && (
 <p className="text-sm text-red-600 mt-1">{errors.guest_email.message}</p>
 )}
 </div>
 </div>
 </div>

 {/* Booking Details */}
 <div className="space-y-4 rounded-lg border border-slate-200 p-6 bg-white shadow-sm">
 <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
 <CalendarIcon className="h-5 w-5 text-blue-600" />
 Booking Details
 </h3>
 
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <Label>Date *</Label>
 <Popover>
 <PopoverTrigger asChild>
 <Button
 variant="outline"
 className={cn(
 "w-full justify-start text-left font-normal",
 !bookingDate && "text-muted-foreground"
 )}
 disabled={isLoading || !!selectedEvent}
 >
 <CalendarIcon className="mr-2 h-4 w-4" />
 {bookingDate ? format(bookingDate, "PPP") : <span>Pick a date</span>}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-0">
 <Calendar
 mode="single"
 selected={bookingDate}
 onSelect={(date) => date && setValue("booking_date", date)}
 disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
 />
 </PopoverContent>
 </Popover>
 {selectedEvent && (
 <p className="text-xs text-slate-500 mt-1">
 Using event date
 </p>
 )}
 </div>

 <div>
 <Label htmlFor="booking_time">Time *</Label>
 <div className="relative">
 <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 id="booking_time"
 type="time"
 {...register("booking_time")}
 className="pl-10"
 disabled={isLoading || !!selectedEvent}
 />
 </div>
 {selectedEvent && (
 <p className="text-xs text-slate-500 mt-1">
 Using event time
 </p>
 )}
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <Label htmlFor="party_size">Party Size *</Label>
 <div className="relative">
 <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 id="party_size"
 type="number"
 min="1"
 max="50"
 placeholder="Enter number of guests"
 {...register("party_size", { valueAsNumber: true })}
 className="pl-10"
 disabled={isLoading}
 />
 </div>
 {errors.party_size && (
 <p className="text-sm text-red-600 mt-1">{errors.party_size.message}</p>
 )}
 </div>

 <div>
 <Label htmlFor="status">Status</Label>
 <Select
 value={watch("status")}
 onValueChange={(value: any) => setValue("status", value)}
 disabled={isLoading}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="pending">Pending</SelectItem>
 <SelectItem value="confirmed">Confirmed</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 </div>

 {/* Optional Event Selection */}
 {upcomingEvents && upcomingEvents.length > 0 && (
 <div className="space-y-4 rounded-lg border border-purple-200 p-6 bg-purple-50 shadow-sm">
 <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
 <Gift className="h-5 w-5 text-purple-600" />
 Book for Event (Optional)
 </h3>
 <p className="text-sm text-slate-600">
 Select an event if this booking is for a special restaurant event
 </p>

 <div>
 <Label htmlFor="event_occurrence_id">Select Event</Label>
 <Select
 value={watch("event_occurrence_id") || "none"}
 onValueChange={(value) => setValue("event_occurrence_id", value === "none" ? "" : value)}
 disabled={isLoading}
 >
 <SelectTrigger>
 <SelectValue placeholder="No event (regular booking)" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="none">No event (regular booking)</SelectItem>
 {upcomingEvents.map((occurrence: any) => {
 // Skip if event is null or missing title
 if (!occurrence.event || !occurrence.event.title) return null
 
 const event = occurrence.event
 const currentBookings = occurrence.current_bookings || 0
 const maxCapacity = occurrence.max_capacity || 0
 const availableSeats = maxCapacity - currentBookings
 const isFull = maxCapacity > 0 && availableSeats < partySize

 return (
 <SelectItem 
 key={occurrence.id} 
 value={occurrence.id}
 disabled={isFull}
 >
 {event.title} - {format(new Date(occurrence.occurrence_date), "MMM d")} at {occurrence.start_time}
 {isFull ? " (Full)" : maxCapacity > 0 ? ` (${availableSeats} seats left)` : ""}
 </SelectItem>
 )
 })}
 </SelectContent>
 </Select>
 {watch("event_occurrence_id") && watch("event_occurrence_id") !== "" && (
 <p className="text-sm text-purple-700 mt-2 flex items-center gap-1">
 <AlertCircle className="h-3.5 w-3.5" />
 This booking will use the event's date and time
 </p>
 )}
 </div>
 </div>
 )}

 {/* Additional Information */}
 <div className="space-y-4 rounded-lg border border-slate-200 p-6 bg-white shadow-sm">
 <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
 <AlertCircle className="h-5 w-5 text-blue-600" />
 Additional Information (Optional)
 </h3>
 
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <Label htmlFor="occasion">Occasion</Label>
 <Input
 id="occasion"
 placeholder="Birthday, Anniversary, etc."
 {...register("occasion")}
 disabled={isLoading}
 />
 </div>

 {hasFloorPlan ? (
 <div className="sm:col-span-2">
 <Label className="flex items-center gap-2 mb-2">
 <Table2 className="h-4 w-4 text-emerald-600" />
 Select Tables
 </Label>
 {selectedTableIds.length > 0 && (
 <div className="flex items-center gap-2 mb-2 flex-wrap">
 {selectedTableIds.map((tableId) => {
 const table = availableTables.find((t: any) => t.id === tableId)
 if (!table) return null
 return (
 <Badge
 key={tableId}
 variant="secondary"
 className="bg-blue-50 text-blue-700 border border-blue-200 gap-1"
 >
 T{table.table_number}
 <span className="text-[10px] opacity-70">({table.capacity} seats)</span>
 <button
 type="button"
 onClick={() => setSelectedTableIds(prev => prev.filter(id => id !== tableId))}
 className="ml-1 hover:text-red-500 transition-colors"
 >
 <X className="h-3 w-3" />
 </button>
 </Badge>
 )
 })}
 <span className="text-xs text-muted-foreground">
 Total: {selectedTableCapacity} seats
 {watch("party_size") > selectedTableCapacity && (
 <span className="text-red-500 ml-1">
 (need {watch("party_size") - selectedTableCapacity} more)
 </span>
 )}
 </span>
 </div>
 )}
 <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-3">
 {Object.entries(tablesBySection).map(([sectionName, tables]) => (
 <div key={sectionName}>
 <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
 <MapPin className="h-3 w-3" />
 {sectionName}
 </p>
 <div className="flex flex-wrap gap-1.5">
 {(tables as any[]).map((table: any) => {
 const isSelected = selectedTableIds.includes(table.id)
 const isSuitable = table.capacity >= (watch("party_size") || 1)
 return (
 <button
 key={table.id}
 type="button"
 disabled={isLoading}
 onClick={() => {
 setSelectedTableIds(prev =>
 isSelected
 ? prev.filter(id => id !== table.id)
 : [...prev, table.id]
 )
 }}
 className={cn(
 "h-10 px-3 rounded-md border text-xs font-medium transition-all flex flex-col items-center justify-center",
 isSelected
 ? "bg-blue-600 text-white border-blue-600"
 : isSuitable
 ? "bg-green-50 border-green-300 text-green-800 hover:bg-green-100"
 : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
 )}
 >
 <span>T{table.table_number}</span>
 <span className="text-[10px] opacity-70 flex items-center gap-0.5">
 <Users className="h-2.5 w-2.5" />{table.capacity}
 </span>
 </button>
 )
 })}
 </div>
 </div>
 ))}
 {availableTables.length === 0 && (
 <p className="text-sm text-muted-foreground text-center py-2">
 No tables configured. Add tables in the Tables page.
 </p>
 )}
 </div>
 </div>
 ) : (
 <div>
 <Label htmlFor="assigned_table">Assigned Table</Label>
 <Input
 id="assigned_table"
 placeholder="Table number (e.g., 5, 12, A1)"
 {...register("assigned_table")}
 disabled={isLoading}
 />
 </div>
 )}
 </div>

 {/* Special Offer Selection */}
 {specialOffers && specialOffers.length > 0 && (
 <div>
 <Label htmlFor="applied_offer_id">
 <Gift className="inline h-4 w-4 mr-1 text-green-600" />
 Special Offer (Optional)
 </Label>
 <Select
 value={watch("applied_offer_id") || "none"}
 onValueChange={(value) => setValue("applied_offer_id", value === "none" ? "" : value)}
 disabled={isLoading}
 >
 <SelectTrigger>
 <SelectValue placeholder="No special offer" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="none">No special offer</SelectItem>
 {specialOffers.map((offer: any) => (
 <SelectItem key={offer.id} value={offer.id}>
 <div className="flex items-center gap-2">
 <Gift className="h-3 w-3 text-green-600" />
 <span className="font-medium">{offer.title}</span>
 {offer.discount_percentage && (
 <span className="text-xs text-green-600 font-bold">
 ({offer.discount_percentage}% OFF)
 </span>
 )}
 </div>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 {watch("applied_offer_id") && watch("applied_offer_id") !== "none" && watch("applied_offer_id") !== "" && (
 <p className="text-sm text-green-700 mt-2 flex items-center gap-1">
 <Gift className="h-3.5 w-3.5" />
 Special offer will be applied to this booking
 </p>
 )}
 </div>
 )}

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 {sections && sections.length > 0 && (
 <div>
 <Label htmlFor="preferred_section">
 <MapPin className="inline h-4 w-4 mr-1" />
 Preferred Section
 </Label>
 <Select
 value={watch("preferred_section") || "none"}
 onValueChange={(value) => setValue("preferred_section", value === "none" ? "" : value)}
 disabled={isLoading}
 >
 <SelectTrigger>
 <SelectValue placeholder="No preference" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="none">No preference</SelectItem>
 {sections.map((section: any) => (
 <SelectItem key={section.id} value={section.name}>
 {section.name}
 {section.description && ` - ${section.description}`}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}
 </div>

 <div>
 <Label htmlFor="dietary_notes">Dietary Restrictions/Notes</Label>
 <Textarea
 id="dietary_notes"
 placeholder="Allergies, dietary restrictions, etc."
 {...register("dietary_notes")}
 disabled={isLoading}
 rows={2}
 />
 </div>

 <div>
 <Label htmlFor="special_requests">Special Requests</Label>
 <Textarea
 id="special_requests"
 placeholder="Any special requirements or requests..."
 {...register("special_requests")}
 disabled={isLoading}
 rows={3}
 />
 </div>
 </div>

 {/* Payment Requirement Section */}
 <div className="space-y-4 rounded-lg border border-emerald-200 p-6 bg-emerald-50 shadow-sm">
 <div className="flex items-center justify-between">
 <div className="space-y-1">
 <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
 <CreditCard className="h-5 w-5 text-emerald-600" />
 Payment Requirement
 </h3>
 <p className="text-sm text-slate-600">
 Require the guest to pay a deposit or provide a card guarantee
 </p>
 </div>
 <Switch
 checked={requirePayment || false}
 onCheckedChange={(checked) => {
 setValue("require_payment", checked)
 if (!checked) {
 setValue("payment_type", undefined)
 setValue("deposit_amount", undefined)
 }
 }}
 disabled={isLoading}
 />
 </div>

 {requirePayment && (
 <div className="space-y-4 pt-4 border-t border-emerald-200">
 {/* Payment Type Selection */}
 <div className="space-y-3">
 <Label>Payment Type</Label>
 <RadioGroup
 value={paymentType || ""}
 onValueChange={(value) => setValue("payment_type", value as "deposit" | "card_guarantee")}
 className="grid grid-cols-1 sm:grid-cols-2 gap-3"
 >
 <Label
 htmlFor="deposit"
 className={cn(
 "flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
 paymentType === "deposit"
 ? "border-emerald-500 bg-emerald-100/50"
 : "border-slate-200 hover:border-emerald-300"
 )}
 >
 <RadioGroupItem value="deposit" id="deposit" className="mt-0.5" />
 <div className="space-y-1">
 <div className="font-medium text-slate-900 flex items-center gap-2">
 <DollarSign className="h-4 w-4 text-emerald-600" />
 Deposit Payment
 </div>
 <p className="text-sm text-slate-600">
 Charge a specific amount upfront to secure the booking
 </p>
 </div>
 </Label>

 <Label
 htmlFor="card_guarantee"
 className={cn(
 "flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
 paymentType === "card_guarantee"
 ? "border-emerald-500 bg-emerald-100/50"
 : "border-slate-200 hover:border-emerald-300"
 )}
 >
 <RadioGroupItem value="card_guarantee" id="card_guarantee" className="mt-0.5" />
 <div className="space-y-1">
 <div className="font-medium text-slate-900 flex items-center gap-2">
 <ShieldCheck className="h-4 w-4 text-emerald-600" />
 Card Guarantee
 </div>
 <p className="text-sm text-slate-600">
 Hold card on file for no-show or late cancellation fees
 </p>
 </div>
 </Label>
 </RadioGroup>
 {errors.payment_type && (
 <p className="text-sm text-red-600">{errors.payment_type.message}</p>
 )}
 </div>

 {/* Deposit Amount Input */}
 {paymentType === "deposit" && (
 <div className="space-y-2">
 <Label htmlFor="deposit_amount">Deposit Amount *</Label>
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
 $
 </span>
 <Input
 id="deposit_amount"
 type="number"
 step="0.01"
 min="0.01"
 placeholder="0.00"
 {...register("deposit_amount", { valueAsNumber: true })}
 className="pl-8"
 disabled={isLoading}
 />
 </div>
 {errors.deposit_amount && (
 <p className="text-sm text-red-600">{errors.deposit_amount.message}</p>
 )}
 </div>
 )}

 {/* Card Guarantee Fee Info */}
 {paymentType === "card_guarantee" && (
 <div className="p-4 rounded-lg bg-white border border-slate-200">
 <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
 <ShieldCheck className="h-4 w-4 text-emerald-600" />
 Guarantee Fee Configuration
 </h4>
 {guaranteeSettings ? (
 <div className="grid grid-cols-2 gap-4 text-sm">
 <div>
 <p className="text-slate-500">No-Show Fee</p>
 <p className="font-semibold text-slate-900">
 ${guaranteeSettings.no_show_fee || 0}
 {guaranteeSettings.fee_type === "per_cover" && " per guest"}
 </p>
 </div>
 <div>
 <p className="text-slate-500">Late Cancellation Fee</p>
 <p className="font-semibold text-slate-900">
 ${guaranteeSettings.late_cancel_fee || 0}
 {guaranteeSettings.fee_type === "per_cover" && " per guest"}
 </p>
 </div>
 </div>
 ) : (
 <p className="text-sm text-amber-600">
 No guarantee fees configured. Configure them in Settings → Card Guarantees.
 </p>
 )}
 </div>
 )}

 {/* Payment Link Info */}
 <Alert className="bg-emerald-100/50 border-emerald-300">
 <Link2 className="h-4 w-4 text-emerald-600" />
 <AlertDescription className="text-emerald-900">
 A payment link will be generated after creating the booking. You can share this link with the guest to complete the{" "}
 {paymentType === "deposit" ? "deposit payment" : "card verification"}.
 </AlertDescription>
 </Alert>
 </div>
 )}
 </div>

 {/* Info Alert */}
 <Alert className="bg-blue-50 border-blue-200">
 <AlertCircle className="h-4 w-4 text-blue-600" />
 <AlertDescription className="text-blue-900">
 <strong>Basic Tier Booking:</strong> This booking will be created without table assignment. 
 You can manage seating arrangements when the guest arrives.
 </AlertDescription>
 </Alert>

 {/* Actions */}
 <div className="sticky bottom-0 border-t border-slate-200 pt-4 pb-4 flex justify-end gap-3 shadow-lg">
 <Button
 type="button"
 variant="outline"
 onClick={onCancel}
 disabled={isLoading || isCheckingMatches}
 className="px-4 border-slate-300 hover:bg-slate-100"
 >
 Cancel
 </Button>
 <Button
 type="submit"
 disabled={isLoading || isCheckingMatches}
 className="bg-blue-600 hover:bg-blue-700 text-white shadow-md px-8 font-semibold"
 >
 {isLoading || isCheckingMatches ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 motion-safe:animate-spin" />
 {isCheckingMatches ? "Checking..." : "Creating..."}
 </>
 ) : (
 "Create Booking"
 )}
 </Button>
 </div>
 </form>

 {/* Matching Customers Dialog */}
 <Dialog open={showMatchingDialog} onOpenChange={setShowMatchingDialog}>
 <DialogContent className="max-w-lg">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Users className="h-5 w-5 text-amber-600" />
 Similar Guests Found
 </DialogTitle>
 <DialogDescription>
 We found existing guests that match the information you entered. Would you like to link this booking to one of them?
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-3 py-4 max-h-64 overflow-y-auto">
 {matchingCustomers.map((customer) => (
 <Card 
 key={customer.id}
 className="cursor-pointer hover:border-amber-400 transition-colors"
 onClick={() => handleSelectExistingCustomer(customer)}
 >
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
 {customer.vip_status ? (
 <Crown className="h-5 w-5 text-amber-600" />
 ) : (
 <UserCheck className="h-5 w-5 text-slate-500" />
 )}
 </div>
 <div>
 <div className="flex items-center gap-2">
 <span className="font-medium">{customer.guest_name}</span>
 {customer.vip_status && (
 <Badge className="bg-amber-500 text-white text-xs">VIP</Badge>
 )}
 </div>
 <div className="text-sm text-muted-foreground space-y-0.5">
 {customer.guest_email && (
 <div className="flex items-center gap-1">
 <Mail className="h-3 w-3" />
 <span>{customer.guest_email}</span>
 </div>
 )}
 {customer.guest_phone && (
 <div className="flex items-center gap-1">
 <Phone className="h-3 w-3" />
 <span>{customer.guest_phone}</span>
 </div>
 )}
 </div>
 </div>
 </div>
 <div className="text-right">
 <p className="text-lg font-semibold text-amber-600">{customer.total_bookings}</p>
 <p className="text-xs text-muted-foreground">bookings</p>
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>

 <DialogFooter className="flex-col sm:flex-row gap-2">
 <Button
 variant="outline"
 onClick={handleCreateWithoutLinking}
 className="w-full sm:w-auto"
 >
 <UserPlus className="h-4 w-4 mr-2" />
 Create as New Guest
 </Button>
 <Button
 variant="ghost"
 onClick={() => {
 setShowMatchingDialog(false)
 setMatchingCustomers([])
 setPendingBookingData(null)
 }}
 className="w-full sm:w-auto"
 >
 Cancel
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Add to Guest Database Prompt */}
 <Dialog open={showAddToGuestPrompt} onOpenChange={setShowAddToGuestPrompt}>
 <DialogContent className="max-w-md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <UserPlus className="h-5 w-5 text-blue-600" />
 Add to Guest Database?
 </DialogTitle>
 <DialogDescription>
 Would you like to save this guest's information to your customer database? This will help you track their visit history and preferences.
 </DialogDescription>
 </DialogHeader>

 {pendingBookingData && (
 <Card className="bg-slate-50">
 <CardContent className="p-4">
 <div className="space-y-2">
 <div className="flex items-center gap-2">
 <UserCheck className="h-4 w-4 text-slate-500" />
 <span className="font-medium">{pendingBookingData.guest_name}</span>
 </div>
 {pendingBookingData.guest_email && (
 <div className="flex items-center gap-2 text-sm text-muted-foreground text-sm"><Mail className="h-3 w-3" />
 <span>{pendingBookingData.guest_email}</span>
 </div>
 )}
 {pendingBookingData.guest_phone && (
 <div className="flex items-center gap-2 text-sm text-muted-foreground text-sm"><Phone className="h-3 w-3" />
 <span>{pendingBookingData.guest_phone}</span>
 </div>
 )}
 </div>
 </CardContent>
 </Card>
 )}

 <DialogFooter className="flex-col sm:flex-row gap-2">
 <Button
 onClick={handleAddNewGuestAndSubmit}
 disabled={isCheckingMatches}
 className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
 >
 {isCheckingMatches ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 motion-safe:animate-spin" />
 Adding...
 </>
 ) : (
 <>
 <CheckCircle className="h-4 w-4 mr-2" />
 Yes, Add to Database
 </>
 )}
 </Button>
 <Button
 variant="outline"
 onClick={handleSkipAddGuest}
 disabled={isCheckingMatches}
 className="w-full sm:w-auto"
 >
 Skip, Just Book
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 )
}
