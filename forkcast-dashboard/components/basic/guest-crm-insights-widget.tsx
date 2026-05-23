// components/basic/guest-crm-insights-widget.tsx
"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { differenceInDays, startOfDay, addDays, addYears, isBefore } from "date-fns"
import {
 Card,
 CardContent,
 CardDescription,
 CardHeader,
 CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
 Tooltip,
 TooltipContent,
 TooltipProvider,
 TooltipTrigger,
} from "@/components/ui/tooltip"
import {
 Cake,
 Crown,
 AlertTriangle,
 ChevronRight,
 Sparkles,
 PartyPopper,
 UserPlus,
 RefreshCw,
} from "lucide-react"
import Link from "next/link"

interface GuestCrmInsightsWidgetProps {
 restaurantId: string
}

interface CustomerInsight {
 id: string
 guest_name: string | null
 total_bookings: number
 total_spent: number
 vip_status: boolean
 no_show_count: number
 last_visit: string | null
 first_visit: string | null
 date_of_birth: string | null
 created_at: string
}

// Helper: Get days until next birthday
function getDaysUntilBirthday(dateOfBirth: string | null): number | null {
 if (!dateOfBirth) return null
 
 const today = startOfDay(new Date())
 const dob = new Date(dateOfBirth)
 
 const thisYearBirthday = new Date(
 today.getFullYear(),
 dob.getMonth(),
 dob.getDate()
 )
 
 if (thisYearBirthday < today) {
 thisYearBirthday.setFullYear(today.getFullYear() + 1)
 }
 
 return differenceInDays(thisYearBirthday, today)
}

// Helper: Get anniversary info
function getAnniversaryInfo(firstVisit: string | null): { daysUntil: number, yearsWithUs: number } | null {
 if (!firstVisit) return null
 
 try {
 const today = startOfDay(new Date())
 const firstVisitDate = new Date(firstVisit)
 
 let nextAnniversary = new Date(
 today.getFullYear(),
 firstVisitDate.getMonth(),
 firstVisitDate.getDate()
 )
 
 if (isBefore(nextAnniversary, today)) {
 nextAnniversary = addYears(nextAnniversary, 1)
 }
 
 const daysUntil = differenceInDays(nextAnniversary, today)
 const yearsWithUs = nextAnniversary.getFullYear() - firstVisitDate.getFullYear()
 
 if (yearsWithUs >= 1) {
 return { daysUntil, yearsWithUs }
 }
 return null
 } catch {
 return null
 }
}

export function GuestCrmInsightsWidget({ restaurantId }: GuestCrmInsightsWidgetProps) {
 const supabase = createClient()

 const { data: customers, isLoading } = useQuery({
 queryKey: ["guest-crm-insights-minimal", restaurantId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("restaurant_customers")
 .select(`
 id,
 guest_name,
 total_bookings,
 total_spent,
 vip_status,
 no_show_count,
 last_visit,
 first_visit,
 created_at,
 user_id
 `)
 .eq("restaurant_id", restaurantId)
 .eq("blacklisted", false)
 .order("created_at", { ascending: false })
 
 if (error) throw error

 const customersWithUserId = data?.filter(c => c.user_id) || []
 const userIds = customersWithUserId.map(c => c.user_id)
 
 let profileMap: Record<string, string | null> = {}
 if (userIds.length > 0) {
 const { data: profiles } = await supabase
 .from("profiles")
 .select("id, date_of_birth")
 .in("id", userIds)
 
 profiles?.forEach(p => {
 profileMap[p.id] = p.date_of_birth
 })
 }

 return (data || []).map(c => ({
 ...c,
 date_of_birth: c.user_id ? profileMap[c.user_id] || null : null
 })) as CustomerInsight[]
 },
 enabled: !!restaurantId,
 staleTime: 5 * 60 * 1000,
 })

 const insights = useMemo(() => {
 if (!customers) return null

 const today = startOfDay(new Date())
 const sevenDaysAgo = addDays(today, -7)

 // Quick counts
 const totalCustomers = customers.length
 const vipCount = customers.filter(c => c.vip_status).length
 const newThisWeek = customers.filter(c => new Date(c.created_at) >= sevenDaysAgo).length
 
 // Upcoming birthdays (next 7 days only for widget)
 const upcomingBirthdays = customers.filter(c => {
 const days = getDaysUntilBirthday(c.date_of_birth)
 return days !== null && days >= 0 && days <= 7
 }).length

 // Upcoming anniversaries (next 7 days)
 const upcomingAnniversaries = customers.filter(c => {
 const info = getAnniversaryInfo(c.first_visit)
 return info !== null && info.daysUntil >= 0 && info.daysUntil <= 7
 }).length

 // At-risk (high no-show rate)
 const atRiskCount = customers.filter(c => {
 if (c.total_bookings < 3) return false
 return (c.no_show_count / c.total_bookings) > 0.25
 }).length

 // Win-back opportunities
 const winBackCount = customers.filter(c => {
 if (c.total_bookings < 3 || !c.last_visit) return false
 return differenceInDays(today, new Date(c.last_visit)) > 60
 }).length

 // Avg visits
 const avgVisits = customers.length > 0
 ? (customers.reduce((sum, c) => sum + c.total_bookings, 0) / customers.length).toFixed(1)
 : "0"

 return {
 totalCustomers,
 vipCount,
 newThisWeek,
 upcomingBirthdays,
 upcomingAnniversaries,
 atRiskCount,
 winBackCount,
 avgVisits,
 }
 }, [customers])

 if (isLoading) {
 return (
 <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
 <CardHeader className="pb-2">
 <div className="h-5 bg-muted rounded w-32 motion-safe:animate-pulse" />
 </CardHeader>
 <CardContent>
 <div className="h-16 bg-muted rounded motion-safe:animate-pulse" />
 </CardContent>
 </Card>
 )
 }

 if (!insights) return null

 // Calculate attention items (things that need action)
 const attentionItems = insights.upcomingBirthdays + insights.upcomingAnniversaries + insights.atRiskCount + insights.winBackCount

 return (
 <TooltipProvider>
 <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
 <CardHeader className="pb-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Sparkles className="h-4 w-4 text-amber-600" />
 <CardTitle className="text-base">Guest CRM</CardTitle>
 {attentionItems > 0 && (
 <Badge variant="destructive" className="text-xs h-5 px-1.5">
 {attentionItems} action{attentionItems > 1 ? 's' : ''}
 </Badge>
 )}
 </div>
 <Link href="/customers">
 <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
 Details
 <ChevronRight className="h-3 w-3" />
 </Button>
 </Link>
 </div>
 <CardDescription className="text-xs">
 {insights.totalCustomers} guests • {insights.vipCount} VIPs • {insights.avgVisits} avg visits
 </CardDescription>
 </CardHeader>

 <CardContent className="pt-0">
 {/* Quick Action Indicators */}
 <div className="flex flex-wrap gap-2">
 {insights.newThisWeek > 0 && (
 <Tooltip>
 <TooltipTrigger asChild>
 <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700 cursor-help">
 <UserPlus className="h-3 w-3 mr-1" />
 {insights.newThisWeek} new
 </Badge>
 </TooltipTrigger>
 <TooltipContent>
 <p className="text-xs">New guests this week</p>
 </TooltipContent>
 </Tooltip>
 )}

 {insights.upcomingBirthdays > 0 && (
 <Tooltip>
 <TooltipTrigger asChild>
 <Badge variant="outline" className="bg-pink-50 border-pink-200 text-pink-700 cursor-help">
 <Cake className="h-3 w-3 mr-1" />
 {insights.upcomingBirthdays} birthday{insights.upcomingBirthdays > 1 ? 's' : ''}
 </Badge>
 </TooltipTrigger>
 <TooltipContent>
 <p className="text-xs">Birthdays in next 7 days</p>
 </TooltipContent>
 </Tooltip>
 )}

 {insights.upcomingAnniversaries > 0 && (
 <Tooltip>
 <TooltipTrigger asChild>
 <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700 cursor-help">
 <PartyPopper className="h-3 w-3 mr-1" />
 {insights.upcomingAnniversaries} anniversary
 </Badge>
 </TooltipTrigger>
 <TooltipContent>
 <p className="text-xs">First visit anniversaries in next 7 days</p>
 </TooltipContent>
 </Tooltip>
 )}

 {insights.vipCount > 0 && (
 <Tooltip>
 <TooltipTrigger asChild>
 <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700 cursor-help">
 <Crown className="h-3 w-3 mr-1" />
 {insights.vipCount} VIP
 </Badge>
 </TooltipTrigger>
 <TooltipContent>
 <p className="text-xs">VIP guests</p>
 </TooltipContent>
 </Tooltip>
 )}

 {insights.atRiskCount > 0 && (
 <Tooltip>
 <TooltipTrigger asChild>
 <Badge variant="outline" className="bg-red-50 border-red-200 text-red-700 cursor-help">
 <AlertTriangle className="h-3 w-3 mr-1" />
 {insights.atRiskCount} at-risk
 </Badge>
 </TooltipTrigger>
 <TooltipContent>
 <p className="text-xs">High no-show rate guests</p>
 </TooltipContent>
 </Tooltip>
 )}

 {insights.winBackCount > 0 && (
 <Tooltip>
 <TooltipTrigger asChild>
 <Badge variant="outline" className="bg-orange-50 border-orange-200 text-orange-700 cursor-help">
 <RefreshCw className="h-3 w-3 mr-1" />
 {insights.winBackCount} win-back
 </Badge>
 </TooltipTrigger>
 <TooltipContent>
 <p className="text-xs">Haven&apos;t visited in 60+ days</p>
 </TooltipContent>
 </Tooltip>
 )}
 </div>

 {/* Empty state */}
 {insights.totalCustomers === 0 && (
 <p className="text-xs text-muted-foreground text-center py-2">
 No guests yet. Add customers when creating bookings.
 </p>
 )}
 </CardContent>
 </Card>
 </TooltipProvider>
 )
}
