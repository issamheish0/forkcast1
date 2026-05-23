// components/basic/manual-booking-dialog.tsx
"use client"

import { useState } from "react"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { BasicManualBookingForm } from "@/components/basic/basic-manual-booking-form"
import { PaymentLinkDialog } from "@/components/basic/payment-link-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "react-hot-toast"
import { format } from "date-fns"

interface ManualBookingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurantId: string
  currentBookings?: any[]
  hasGuestCRM?: boolean // Whether restaurant has Guest CRM addon
  hasFloorPlan?: boolean // Whether restaurant has Floor Plan addon
}

interface PaymentLinkState {
  links: {
    montypay: string | null
    whish: string | null
  }
  booking: {
    id: string
    confirmation_code: string
    guest_name: string
    guest_email?: string | null
    guest_phone?: string | null
    booking_time: string
    party_size: number
  }
  details: {
    type: "deposit" | "card_guarantee"
    deposit_amount?: number
    // MontyPay fee details
    montypay_service_fee_percentage?: number
    montypay_service_fee_amount?: number
    montypay_total_amount?: number
    // Whish fee details
    whish_service_fee_percentage?: number
    whish_service_fee_amount?: number
    whish_total_amount?: number
    // Card guarantee details
    no_show_fee?: number
    cancellation_fee?: number
    fee_type?: "per_cover" | "fixed"
  }
}

export function ManualBookingDialog({
  open,
  onOpenChange,
  restaurantId,
  currentBookings = [],
  hasGuestCRM = false,
  hasFloorPlan = false,
}: ManualBookingDialogProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  // Payment link dialog state
  const [paymentLinkData, setPaymentLinkData] = useState<PaymentLinkState | null>(null)
  const [showPaymentLinkDialog, setShowPaymentLinkDialog] = useState(false)

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
    enabled: !!restaurantId && open,
  })

  const serviceFeePercentage = restaurantData?.service_fee_percentage || 0
  const whishServiceFeePercentage = restaurantData?.whish_service_fee_percentage || 1 // Default 1% for Whish

  // Generate unique confirmation code
  const generateConfirmationCode = async () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length))
    }

    // Check if code already exists
    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('confirmation_code', code)
      .eq('restaurant_id', restaurantId)
      .single()

    // If exists, recursively generate new one
    if (existing) {
      return generateConfirmationCode()
    }

    return code
  }

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('🔄 Creating basic manual booking:', data)

      // Generate confirmation code
      const confirmationCode = await generateConfirmationCode()

      // Determine status based on payment requirement
      const requiresPayment = data.require_payment && data.payment_type
      const bookingStatus = requiresPayment ? 'pending_payment' : (data.status || 'confirmed')
      const paymentStatus = requiresPayment ? 'pending' : 'not_required'
      const paymentExpiresAt = requiresPayment 
        ? new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes from now
        : null

      // Prepare booking data for basic tier (no tables, no customer tracking by default)
      // If Guest CRM addon is enabled, we can link to customers
      const bookingData: Record<string, any> = {
        restaurant_id: restaurantId,
        user_id: data.user_id || null, // Link to user if selected from Guest CRM
        booking_time: data.booking_time,
        party_size: data.party_size,
        status: bookingStatus,
        payment_status: paymentStatus,
        payment_expires_at: paymentExpiresAt,
        special_requests: data.special_requests || null,
        occasion: data.occasion || null,
        assigned_table: data.assigned_table || null,
        preferred_section: data.preferred_section || null,
        dietary_notes: data.dietary_notes ? [data.dietary_notes] : null, // Convert string to array
        guest_name: data.guest_name,
        guest_email: data.guest_email || null,
        guest_phone: data.guest_phone || null,
        confirmation_code: confirmationCode,
        turn_time_minutes: data.turn_time_minutes || 120,
        is_event_booking: data.is_event_booking || false,
        event_occurrence_id: data.event_occurrence_id || null,
        applied_offer_id: data.applied_offer_id || null, // Special offer
        source: 'manual',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Add payment amount for deposit payments (store base deposit amount - fees vary by provider)
      if (requiresPayment && data.payment_type === 'deposit' && data.deposit_amount) {
        const depositAmount = Number(data.deposit_amount) || 0
        bookingData.payment_amount = depositAmount
      }

      console.log('📝 Basic booking data:', bookingData)

      // Create booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert(bookingData)
        .select(`
          id,
          booking_time,
          party_size,
          status,
          payment_status,
          payment_amount,
          special_requests,
          preferred_section,
          occasion,
          assigned_table,
          dietary_notes,
          guest_name,
          guest_email,
          guest_phone,
          created_at,
          confirmation_code,
          turn_time_minutes,
          is_event_booking,
          event_occurrence_id,
          applied_offer_id,
          user_id
        `)
        .single()

      if (bookingError) {
        console.error('❌ Error creating booking:', bookingError)
        throw new Error(bookingError.message || 'Failed to create booking')
      }

      console.log('✅ Basic booking created:', booking)

      // If floor plan addon is active and table_ids are provided, create booking_tables entries
      if (hasFloorPlan && data.table_ids && data.table_ids.length > 0) {
        // Validate tables belong to this restaurant
        const { data: validTables } = await supabase
          .from('restaurant_tables')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .in('id', data.table_ids)

        const validIds = new Set(validTables?.map((t: any) => t.id) || [])
        const validTableIds = data.table_ids.filter((id: string) => validIds.has(id))

        if (validTableIds.length > 0) {
          const tableAssignments = validTableIds.map((tableId: string) => ({
            booking_id: booking.id,
            table_id: tableId,
          }))

          const { error: tableError } = await supabase
            .from('booking_tables')
            .insert(tableAssignments)

          if (tableError) {
            console.warn('⚠️ Could not assign tables:', tableError)
          } else {
            console.log('✅ Tables assigned via booking_tables:', validTableIds)
          }
        }
      }

      // If offer was applied and user exists, create user_offers record
      if (booking.applied_offer_id && booking.user_id) {
        try {
          const { error: offerError } = await supabase
            .from('user_offers')
            .insert({
              user_id: booking.user_id,
              offer_id: booking.applied_offer_id,
              booking_id: booking.id,
              claimed_at: new Date().toISOString(),
              used_at: new Date().toISOString(),
              status: 'used',
            })

          if (offerError) {
            console.warn('⚠️ Could not create user_offers record:', offerError)
            // Don't fail the booking creation, just log the warning
          } else {
            console.log('✅ Special offer applied and tracked in user_offers')
          }
        } catch (err) {
          console.warn('⚠️ Error creating user_offers record:', err)
        }
      } else if (booking.applied_offer_id && !booking.user_id) {
        console.log('ℹ️ Special offer applied to guest booking (no user_offers record created)')
      }

      // Update event occurrence booking count if this is an event booking
      if (booking.is_event_booking && booking.event_occurrence_id) {
        const { error: eventError } = await supabase.rpc('increment_event_bookings', {
          occurrence_id: booking.event_occurrence_id,
          increment_by: booking.party_size
        })

        if (eventError) {
          console.warn('⚠️ Could not update event booking count:', eventError)
        }
      }

      // Log booking status history
      try {
        await supabase
          .from('booking_status_history')
          .insert({
            booking_id: booking.id,
            new_status: booking.status,
            changed_at: new Date().toISOString(),
            reason: requiresPayment 
              ? 'Manual booking created by staff (Basic tier) - awaiting payment' 
              : 'Manual booking created by staff (Basic tier)',
            metadata: {
              source: 'manual',
              created_via: 'basic_dashboard',
              tier: 'basic',
              requires_payment: requiresPayment,
              payment_type: data.payment_type || null,
            },
          })
      } catch (err) {
        console.warn('⚠️ Could not log status history:', err)
      }

      // If payment is required, generate payment link(s)
      let montyPayLink: string | null = null
      let whishLink: string | null = null
      
      if (requiresPayment) {
        console.log('💳 Generating payment link(s) for booking:', booking.id)
        
        const depositAmount = Number(data.deposit_amount) || 0

        if (data.payment_type === 'deposit') {
          // Deposit payment - generate BOTH MontyPay and Whish links in parallel
          
          // Calculate MontyPay totals
          const montyPayFeeAmount = serviceFeePercentage > 0 
            ? depositAmount * (serviceFeePercentage / 100) 
            : 0
          const montyPayTotalAmount = depositAmount + montyPayFeeAmount
          
          // Calculate Whish totals
          const whishFeeAmount = whishServiceFeePercentage > 0 
            ? depositAmount * (whishServiceFeePercentage / 100) 
            : 0
          const whishTotalAmount = depositAmount + whishFeeAmount
          
          // MontyPay payload for deposit
          const montyPayPayload = {
            booking_id: booking.id,
            source: 'manual' as const,
            is_event_payment: true, // This triggers deposit flow in MontyPay
            amount: String(montyPayTotalAmount.toFixed(2)),
            description: serviceFeePercentage > 0
              ? `Deposit $${depositAmount.toFixed(2)} + Service Fee $${montyPayFeeAmount.toFixed(2)} (${serviceFeePercentage}%) for booking ${confirmationCode}`
              : `Deposit for booking ${confirmationCode}`,
            guest_name: booking.guest_name,
            guest_email: booking.guest_email,
            guest_phone: booking.guest_phone,
          }
          
          // Whish payload for deposit
          const whishPayload = {
            booking_id: booking.id,
            source: 'manual' as const,
            amount: String(whishTotalAmount.toFixed(2)),
            deposit_amount: String(depositAmount.toFixed(2)),
            service_fee_amount: String(whishFeeAmount.toFixed(2)),
            service_fee_percentage: whishServiceFeePercentage,
            description: whishServiceFeePercentage > 0
              ? `Deposit $${depositAmount.toFixed(2)} + Service Fee $${whishFeeAmount.toFixed(2)} (${whishServiceFeePercentage}%) for booking ${confirmationCode}`
              : `Deposit for booking ${confirmationCode}`,
            guest_name: booking.guest_name,
            guest_email: booking.guest_email,
            guest_phone: booking.guest_phone,
          }

          // Call both payment providers in parallel
          const [montyPayResult, whishResult] = await Promise.allSettled([
            supabase.functions.invoke('montypay-checkout', { body: montyPayPayload }),
            supabase.functions.invoke('whish-checkout', { body: whishPayload })
          ])

          // Extract MontyPay link
          if (montyPayResult.status === 'fulfilled') {
            const { data: montyPayData, error: montyPayError } = montyPayResult.value
            if (montyPayError) {
              console.error('❌ Error creating MontyPay checkout session:', montyPayError)
            } else if (montyPayData?.redirect_url) {
              montyPayLink = montyPayData.redirect_url
              console.log('✅ MontyPay payment link generated:', montyPayLink)
            }
          } else {
            console.error('❌ MontyPay request failed:', montyPayResult.reason)
          }

          // Extract Whish link
          if (whishResult.status === 'fulfilled') {
            const { data: whishData, error: whishError } = whishResult.value
            if (whishError) {
              console.error('❌ Error creating Whish checkout session:', whishError)
            } else if (whishData?.collect_url) {
              whishLink = whishData.collect_url
              console.log('✅ Whish payment link generated:', whishLink)
            }
          } else {
            console.error('❌ Whish request failed:', whishResult.reason)
          }

          // Show warning if any provider failed but at least one succeeded
          if (!montyPayLink && !whishLink) {
            toast.error('Booking created but failed to generate payment links. Please try again.')
          } else if (!montyPayLink || !whishLink) {
            toast('One payment provider failed. You can still use the available payment link.', {
              icon: '⚠️',
              duration: 5000,
            })
          }
        } else {
          // Card guarantee - use MontyPay only for tokenization ($1 verification, will be voided)
          const checkoutPayload = {
            booking_id: booking.id,
            guest_name: booking.guest_name,
            guest_email: booking.guest_email,
            guest_phone: booking.guest_phone,
            source: 'manual' as const,
            is_widget_guarantee: true,
            no_show_fee: data.guarantee_settings?.no_show_fee || 0,
            cancellation_fee: data.guarantee_settings?.cancellation_fee || 0,
            fee_type: data.guarantee_settings?.fee_type || 'per_cover',
            party_size: data.party_size,
          }

          const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('test-montypay-checkout', {
            body: checkoutPayload
          })

          if (checkoutError) {
            console.error('❌ Error creating checkout session:', checkoutError)
            toast.error('Booking created but failed to generate payment link. Please try again.')
          } else if (checkoutData?.redirect_url) {
            montyPayLink = checkoutData.redirect_url
            console.log('✅ Card guarantee link generated:', montyPayLink)
          }
        }
      }

      // Calculate service fee breakdown for both providers
      const depositAmountNum = Number(data.deposit_amount) || 0
      
      // MontyPay fees
      const montyPayServiceFeeAmount = serviceFeePercentage > 0 
        ? depositAmountNum * (serviceFeePercentage / 100) 
        : 0
      const montyPayTotalAmount = depositAmountNum + montyPayServiceFeeAmount
      
      // Whish fees
      const whishServiceFeeAmount = whishServiceFeePercentage > 0 
        ? depositAmountNum * (whishServiceFeePercentage / 100) 
        : 0
      const whishTotalAmount = depositAmountNum + whishServiceFeeAmount

      return {
        booking,
        montyPayLink,
        whishLink,
        paymentType: data.payment_type,
        depositAmount: depositAmountNum,
        // MontyPay fee details
        montyPayServiceFeePercentage: serviceFeePercentage,
        montyPayServiceFeeAmount,
        montyPayTotalAmount,
        // Whish fee details
        whishServiceFeePercentage,
        whishServiceFeeAmount,
        whishTotalAmount,
        guaranteeSettings: data.guarantee_settings,
      }
    },
    onSuccess: (result) => {
      const { 
        booking, 
        montyPayLink, 
        whishLink, 
        paymentType, 
        depositAmount, 
        montyPayServiceFeePercentage,
        montyPayServiceFeeAmount,
        montyPayTotalAmount,
        whishServiceFeePercentage: whishSfp,
        whishServiceFeeAmount,
        whishTotalAmount,
        guaranteeSettings 
      } = result
      console.log('✅ Booking created successfully:', booking)

      // Invalidate queries to refetch bookings
      queryClient.invalidateQueries({ queryKey: ['basic-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['basic-analytics'] })

      const hasPaymentLink = montyPayLink || whishLink

      if (hasPaymentLink && paymentType) {
        // Show payment link dialog
        setPaymentLinkData({
          links: {
            montypay: montyPayLink,
            whish: whishLink,
          },
          booking: {
            id: booking.id,
            confirmation_code: booking.confirmation_code,
            guest_name: booking.guest_name,
            guest_email: booking.guest_email,
            guest_phone: booking.guest_phone,
            booking_time: booking.booking_time,
            party_size: booking.party_size,
          },
          details: {
            type: paymentType,
            deposit_amount: depositAmount,
            // MontyPay fee details
            montypay_service_fee_percentage: montyPayServiceFeePercentage,
            montypay_service_fee_amount: montyPayServiceFeeAmount,
            montypay_total_amount: montyPayTotalAmount,
            // Whish fee details
            whish_service_fee_percentage: whishSfp,
            whish_service_fee_amount: whishServiceFeeAmount,
            whish_total_amount: whishTotalAmount,
            // Card guarantee details
            no_show_fee: guaranteeSettings?.no_show_fee,
            cancellation_fee: guaranteeSettings?.cancellation_fee,
            fee_type: guaranteeSettings?.fee_type,
          }
        })
        setShowPaymentLinkDialog(true)
        // Close the main booking dialog
        onOpenChange(false)
      } else {
        // Regular booking - show success and close
        toast.success(
          `Booking created successfully! Confirmation code: ${booking.confirmation_code}`,
          { duration: 5000 }
        )
        onOpenChange(false)
      }
    },
    onError: (error: any) => {
      console.error('❌ Error creating booking:', error)
      toast.error(`Failed to create booking: ${error.message}`)
    },
  })

  const handleSubmit = async (data: any) => {
    await createBookingMutation.mutateAsync(data)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  const handlePaymentLinkDone = () => {
    setShowPaymentLinkDialog(false)
    setPaymentLinkData(null)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-4 pt-4 pb-3 border-b">
            <DialogTitle className="text-base font-semibold">New Booking</DialogTitle>
            <DialogDescription className="text-xs">
              Fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 pt-1">
            <BasicManualBookingForm
              restaurantId={restaurantId}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isLoading={createBookingMutation.isPending}
              hasGuestCRM={hasGuestCRM}
              hasFloorPlan={hasFloorPlan}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Link Dialog - shown after booking creation if payment required */}
      <PaymentLinkDialog
        open={showPaymentLinkDialog}
        onOpenChange={setShowPaymentLinkDialog}
        paymentLinks={paymentLinkData?.links || null}
        booking={paymentLinkData?.booking || null}
        paymentDetails={paymentLinkData?.details || null}
        restaurantId={restaurantId}
        onDone={handlePaymentLinkDone}
      />
    </>
  )
}
