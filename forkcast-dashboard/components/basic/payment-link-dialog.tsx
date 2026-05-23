// components/basic/payment-link-dialog.tsx
"use client"

import { useState } from "react"
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
 Copy,
 CheckCircle,
 Link2,
 CreditCard,
 DollarSign,
 ShieldCheck,
 Calendar,
 Clock,
 Users,
 User,
 Mail,
 Phone,
 ExternalLink,
 MessageCircle,
 Wallet,
 Building2,
} from "lucide-react"
import { toast } from "react-hot-toast"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"

interface PaymentLinkDialogProps {
 open: boolean
 onOpenChange: (open: boolean) => void
 paymentLinks: {
 montypay: string | null
 whish: string | null
 } | null
 booking: {
 id: string
 confirmation_code: string
 guest_name: string
 guest_email?: string | null
 guest_phone?: string | null
 booking_time: string
 party_size: number
 } | null
 paymentDetails: {
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
 } | null
 restaurantId: string
 onDone: () => void
}

export function PaymentLinkDialog({
 open,
 onOpenChange,
 paymentLinks,
 booking,
 paymentDetails,
 restaurantId,
 onDone,
}: PaymentLinkDialogProps) {
 const [copiedProvider, setCopiedProvider] = useState<"montypay" | "whish" | null>(null)
 const [sendingWhatsApp, setSendingWhatsApp] = useState<boolean>(false)
 const supabase = createClient()

 const handleCopyLink = async (provider: "montypay" | "whish") => {
 const link = provider === "montypay" ? paymentLinks?.montypay : paymentLinks?.whish
 if (!link) return

 try {
 await navigator.clipboard.writeText(link)
 setCopiedProvider(provider)
 toast.success(`${provider === "montypay" ? "MontyPay" : "Whish"} payment link copied!`)
 setTimeout(() => setCopiedProvider(null), 3000)
 } catch (error) {
 console.error("Failed to copy:", error)
 toast.error("Failed to copy link")
 }
 }

 const handleOpenLink = (provider: "montypay" | "whish") => {
 const link = provider === "montypay" ? paymentLinks?.montypay : paymentLinks?.whish
 if (link) {
 window.open(link, "_blank")
 }
 }

 const handleSendWhatsApp = async () => {
 if (!booking?.id || !booking?.guest_phone) {
 toast.error("Missing information to send WhatsApp message")
 return
 }

 // For deposits, both links are required
 if (isDeposit && (!paymentLinks?.montypay || !paymentLinks?.whish)) {
 toast.error("Both payment links are required to send")
 return
 }

 // For card guarantees, MontyPay link is required
 if (!isDeposit && !paymentLinks?.montypay) {
 toast.error("Payment link is required to send")
 return
 }

 // Validate phone number format (E.164: + followed by 10-15 digits)
 const cleanPhone = booking.guest_phone.replace(/\s+/g, '')
 const phoneRegex = /^\+[1-9]\d{9,14}$/
 if (!phoneRegex.test(cleanPhone)) {
 toast.error(`Invalid phone number format: ${booking.guest_phone}. Please use E.164 format (+country code + number)`)
 return
 }

 setSendingWhatsApp(true)

 try {
 // For card guarantees, use the card guarantee function
 if (!isDeposit) {
 const requestBody = {
 booking_id: booking.id,
 montypay_link: paymentLinks?.montypay || null,
 }

 const { data, error } = await supabase.functions.invoke('send-card-guarantee-link-whatsapp', {
 body: requestBody
 })

 if (error) {
 console.error('❌ Error sending card guarantee WhatsApp message:', error)
 toast.error('Failed to send WhatsApp message. Please try again.')
 return
 }

 if (data?.ok) {
 toast.success('Card guarantee WhatsApp message sent!')
 } else {
 toast.error(data?.error || 'Failed to send WhatsApp message')
 }
 } else {
 // For deposits, use the deposit payment link function
 const requestBody: any = {
 booking_id: booking.id,
 montypay_link: paymentLinks?.montypay || null,
 whish_link: paymentLinks?.whish || null,
 // Include amounts for the template
 montypay_total_amount: paymentDetails?.montypay_total_amount || paymentDetails?.deposit_amount || null,
 whish_total_amount: paymentDetails?.whish_total_amount || paymentDetails?.deposit_amount || null,
 }

 const { data, error } = await supabase.functions.invoke('send-payment-link-whatsapp', {
 body: requestBody
 })

 if (error) {
 console.error('❌ Error sending WhatsApp message:', error)
 toast.error('Failed to send WhatsApp message. Please try again.')
 return
 }

 if (data?.ok) {
 toast.success('WhatsApp message sent with both payment links!')
 } else {
 toast.error(data?.error || 'Failed to send WhatsApp message')
 }
 }
 } catch (error) {
 console.error('Error sending WhatsApp message:', error)
 toast.error('Failed to send WhatsApp message')
 } finally {
 setSendingWhatsApp(false)
 }
 }

 const formatCurrency = (amount: number) => {
 return new Intl.NumberFormat("en-US", {
 style: "currency",
 currency: "USD",
 }).format(amount)
 }

 const calculateTotalFee = (fee: number, partySize: number, feeType: string) => {
 return feeType === "per_cover" ? fee * partySize : fee
 }

 // Check if we have at least one payment link
 const hasMontyPay = !!paymentLinks?.montypay
 const hasWhish = !!paymentLinks?.whish
 const hasAnyLink = hasMontyPay || hasWhish

 if (!booking || !hasAnyLink || !paymentDetails) {
 return null
 }

 const isDeposit = paymentDetails.type === "deposit"
 const bookingDateTime = new Date(booking.booking_time)

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-lg">
 <DialogHeader>
 <div className="flex items-center gap-3">
 <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
 <CheckCircle className="h-5 w-5 text-emerald-600" />
 </div>
 <div>
 <DialogTitle className="text-xl">Booking Created Successfully!</DialogTitle>
 <DialogDescription>
 Confirmation Code: <span className="font-mono font-bold">{booking.confirmation_code}</span>
 </DialogDescription>
 </div>
 </div>
 </DialogHeader>

 {/* Booking Summary */}
 <Card className="bg-slate-50">
 <CardContent className="p-4 space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-sm text-slate-600 flex items-center gap-2">
 <User className="h-4 w-4" />
 Guest
 </span>
 <span className="font-medium text-slate-900">{booking.guest_name}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm text-slate-600 flex items-center gap-2">
 <Calendar className="h-4 w-4" />
 Date
 </span>
 <span className="font-medium text-slate-900">
 {format(bookingDateTime, "EEEE, MMMM d, yyyy")}
 </span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm text-slate-600 flex items-center gap-2">
 <Clock className="h-4 w-4" />
 Time
 </span>
 <span className="font-medium text-slate-900">
 {format(bookingDateTime, "h:mm a")}
 </span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm text-slate-600 flex items-center gap-2">
 <Users className="h-4 w-4" />
 Party Size
 </span>
 <span className="font-medium text-slate-900">{booking.party_size} guests</span>
 </div>
 </CardContent>
 </Card>

 <Separator />

 {/* Payment Details */}
 <div className="space-y-3">
 <div className="flex items-center gap-2">
 {isDeposit ? (
 <>
 <DollarSign className="h-5 w-5 text-emerald-600" />
 <span className="font-semibold text-slate-900">Deposit Payment Required</span>
 <Badge className="bg-emerald-100 text-emerald-700">
 {formatCurrency(paymentDetails.deposit_amount || 0)}
 </Badge>
 </>
 ) : (
 <>
 <ShieldCheck className="h-5 w-5 text-emerald-600" />
 <span className="font-semibold text-slate-900">Card Guarantee Required</span>
 </>
 )}
 </div>

 {!isDeposit && paymentDetails.no_show_fee !== undefined && (
 <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
 <p className="text-sm text-amber-900">
 <strong>Fee Structure:</strong>
 </p>
 <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
 <div>
 <span className="text-amber-700">No-Show Fee:</span>{" "}
 <span className="font-medium text-amber-900">
 {formatCurrency(calculateTotalFee(paymentDetails.no_show_fee || 0, booking.party_size, paymentDetails.fee_type || "fixed"))}
 </span>
 </div>
 <div>
 <span className="text-amber-700">Late Cancel:</span>{" "}
 <span className="font-medium text-amber-900">
 {formatCurrency(calculateTotalFee(paymentDetails.cancellation_fee || 0, booking.party_size, paymentDetails.fee_type || "fixed"))}
 </span>
 </div>
 </div>
 </div>
 )}
 </div>

 <Separator />

 {/* Payment Links Section - Always send both for deposits */}
 {isDeposit && hasMontyPay && hasWhish ? (
 <>
 {/* Send Payment Links Button - Always sends both */}
 {booking?.guest_phone && (
 <Button
 onClick={handleSendWhatsApp}
 disabled={sendingWhatsApp}
 className="w-full bg-green-600 hover:bg-green-700 text-white mb-4"
 size="sm"
 >
 {sendingWhatsApp ? (
 <>
 <MessageCircle className="h-5 w-5 mr-2 motion-safe:animate-spin" />
 Sending Payment Links...
 </>
 ) : (
 <>
 <MessageCircle className="h-5 w-5 mr-2" />
 Send Payment Links via WhatsApp
 </>
 )}
 </Button>
 )}
 
 <Tabs defaultValue="montypay" className="w-full">
 <TabsList className="grid w-full grid-cols-2">
 <TabsTrigger value="montypay" className="flex items-center gap-2">
 <CreditCard className="h-4 w-4" />
 MontyPay
 </TabsTrigger>
 <TabsTrigger value="whish" className="flex items-center gap-2">
 <Wallet className="h-4 w-4" />
 Whish
 </TabsTrigger>
 </TabsList>

 {/* MontyPay Tab */}
 <TabsContent value="montypay" className="space-y-3 mt-4">
 {/* MontyPay Fee Breakdown */}
 {paymentDetails.montypay_service_fee_percentage && paymentDetails.montypay_service_fee_percentage > 0 ? (
 <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 space-y-2">
 <div className="flex justify-between text-sm">
 <span className="text-slate-600">Deposit</span>
 <span className="text-slate-900">
 {formatCurrency(paymentDetails.deposit_amount || 0)}
 </span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-slate-600">
 Service Fee ({paymentDetails.montypay_service_fee_percentage}%)
 </span>
 <span className="text-slate-900">
 {formatCurrency(paymentDetails.montypay_service_fee_amount || 0)}
 </span>
 </div>
 <div className="flex justify-between text-sm font-semibold pt-2 border-t border-blue-200">
 <span className="text-slate-900">Total Charge</span>
 <span className="text-blue-600">
 {formatCurrency(paymentDetails.montypay_total_amount || 0)}
 </span>
 </div>
 </div>
 ) : (
 <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
 <div className="flex justify-between text-sm font-semibold">
 <span className="text-slate-900">Total Charge</span>
 <span className="text-blue-600">
 {formatCurrency(paymentDetails.deposit_amount || 0)}
 </span>
 </div>
 </div>
 )}

 {/* MontyPay Link */}
 <div className="space-y-2">
 <Label className="flex items-center gap-2 text-sm">
 <Link2 className="h-4 w-4 text-blue-600" />
 MontyPay Payment Link
 </Label>
 <div className="flex gap-2">
 <Input
 value={paymentLinks?.montypay || ""}
 readOnly
 className="font-mono text-xs bg-slate-50"
 />
 <Button
 type="button"
 variant="outline"
 size="icon"
 onClick={() => handleCopyLink("montypay")}
 className={copiedProvider === "montypay" ? "border-blue-500 text-blue-600" : ""}
 >
 {copiedProvider === "montypay" ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
 </Button>
 <Button
 type="button"
 variant="outline"
 size="icon"
 onClick={() => handleOpenLink("montypay")}
 title="Open in new tab"
 >
 <ExternalLink className="h-4 w-4" />
 </Button>
 </div>
 </div>

 </TabsContent>

 {/* Whish Tab */}
 <TabsContent value="whish" className="space-y-3 mt-4">
 {/* Whish Fee Breakdown */}
 {paymentDetails.whish_service_fee_percentage && paymentDetails.whish_service_fee_percentage > 0 ? (
 <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 space-y-2">
 <div className="flex justify-between text-sm">
 <span className="text-slate-600">Deposit</span>
 <span className="text-slate-900">
 {formatCurrency(paymentDetails.deposit_amount || 0)}
 </span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-slate-600">
 Service Fee ({paymentDetails.whish_service_fee_percentage}%)
 </span>
 <span className="text-slate-900">
 {formatCurrency(paymentDetails.whish_service_fee_amount || 0)}
 </span>
 </div>
 <div className="flex justify-between text-sm font-semibold pt-2 border-t border-purple-200">
 <span className="text-slate-900">Total Charge</span>
 <span className="text-purple-600">
 {formatCurrency(paymentDetails.whish_total_amount || 0)}
 </span>
 </div>
 </div>
 ) : (
 <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
 <div className="flex justify-between text-sm font-semibold">
 <span className="text-slate-900">Total Charge</span>
 <span className="text-purple-600">
 {formatCurrency(paymentDetails.deposit_amount || 0)}
 </span>
 </div>
 </div>
 )}

 {/* Whish Link */}
 <div className="space-y-2">
 <Label className="flex items-center gap-2 text-sm">
 <Link2 className="h-4 w-4 text-purple-600" />
 Whish Payment Link
 </Label>
 <div className="flex gap-2">
 <Input
 value={paymentLinks?.whish || ""}
 readOnly
 className="font-mono text-xs bg-slate-50"
 />
 <Button
 type="button"
 variant="outline"
 size="icon"
 onClick={() => handleCopyLink("whish")}
 className={copiedProvider === "whish" ? "border-purple-500 text-purple-600" : ""}
 >
 {copiedProvider === "whish" ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
 </Button>
 <Button
 type="button"
 variant="outline"
 size="icon"
 onClick={() => handleOpenLink("whish")}
 title="Open in new tab"
 >
 <ExternalLink className="h-4 w-4" />
 </Button>
 </div>
 </div>

 </TabsContent>
 </Tabs>
 </>
 ) : (
 /* Single provider fallback (card guarantee uses MontyPay only, or only one provider available) */
 <div className="space-y-3">
 <Label className="flex items-center gap-2">
 <Link2 className="h-4 w-4 text-emerald-600" />
 Payment Link {hasMontyPay ? "(MontyPay)" : hasWhish ? "(Whish)" : ""}
 </Label>
 <div className="flex gap-2">
 <Input
 value={paymentLinks?.montypay || paymentLinks?.whish || ""}
 readOnly
 className="font-mono text-sm bg-slate-50"
 />
 <Button
 type="button"
 variant="outline"
 size="icon"
 onClick={() => handleCopyLink(hasMontyPay ? "montypay" : "whish")}
 className={copiedProvider ? "border-emerald-500 text-emerald-600" : ""}
 >
 {copiedProvider ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
 </Button>
 <Button
 type="button"
 variant="outline"
 size="icon"
 onClick={() => handleOpenLink(hasMontyPay ? "montypay" : "whish")}
 title="Open in new tab"
 >
 <ExternalLink className="h-4 w-4" />
 </Button>
 </div>

 <Alert className="bg-blue-50 border-blue-200">
 <CreditCard className="h-4 w-4 text-blue-600" />
 <AlertDescription className="text-blue-900">
 Share this link with the guest to complete their{" "}
 {isDeposit ? "deposit payment" : "card verification"}.
 The booking status is <strong>Pending Payment</strong> until completed.
 </AlertDescription>
 </Alert>

 {booking?.guest_phone && (
 <Button
 onClick={handleSendWhatsApp}
 disabled={sendingWhatsApp}
 className="w-full bg-green-600 hover:bg-green-700 text-white"
 >
 {sendingWhatsApp ? (
 <>
 <MessageCircle className="h-4 w-4 mr-2 motion-safe:animate-spin" />
 Sending...
 </>
 ) : (
 <>
 <MessageCircle className="h-4 w-4 mr-2" />
 Send Payment Link via WhatsApp
 </>
 )}
 </Button>
 )}
 </div>
 )}

 {/* Info Alert for deposits with both providers */}
 {isDeposit && hasMontyPay && hasWhish && (
 <Alert className="bg-blue-50 border-blue-200">
 <CreditCard className="h-4 w-4 text-blue-600" />
 <AlertDescription className="text-blue-900">
 Both payment links (MontyPay and Whish) will be sent automatically. The guest can choose which payment method to use.
 Both links expire in 10 minutes. The booking status is <strong>Pending Payment</strong> until completed.
 </AlertDescription>
 </Alert>
 )}

 {/* Contact Info for Sharing */}
 {(booking.guest_email || booking.guest_phone) && (
 <div className="p-3 rounded-lg bg-slate-100">
 <p className="text-xs text-slate-500 mb-2">Guest Contact Info:</p>
 <div className="flex flex-wrap gap-4 text-sm">
 {booking.guest_email && (
 <span className="flex items-center gap-1 text-slate-700">
 <Mail className="h-3 w-3" />
 {booking.guest_email}
 </span>
 )}
 {booking.guest_phone && (
 <span className="flex items-center gap-1 text-slate-700">
 <Phone className="h-3 w-3" />
 {booking.guest_phone}
 </span>
 )}
 </div>
 </div>
 )}

 <DialogFooter>
 <Button onClick={onDone} className="w-full bg-emerald-600 hover:bg-emerald-700">
 Done
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
