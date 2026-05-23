'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  ShieldCheck,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Clock,
  Search,
  Settings,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar as CalendarIcon,
  X
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { useRestaurantContext } from '@/lib/contexts/restaurant-context'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export function GuaranteesDashboard() {
  const { currentRestaurant } = useRestaurantContext()
  const supabase = createClient()
  const restaurantId = currentRestaurant?.restaurant.id

  const [activeTab, setActiveTab] = useState('transactions')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeHoldsSearch, setActiveHoldsSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [page, setPage] = useState(1)
  const ITEMS_PER_PAGE = 20

  // Fetch Stats
  const { data: stats } = useQuery({
    queryKey: ['guarantee_stats', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null

      const { data: holds } = await supabase
        .from('booking_guarantees')
        .select('id, booking!inner(restaurant_id)')
        .eq('status', 'held')
        .eq('booking.restaurant_id', restaurantId)
      
      const activeHoldsCount = holds?.length || 0

      const { data: transactions } = await supabase
        .from('penalty_transactions')
        .select('amount, transaction_type, montypay_status')
        .eq('restaurant_id', restaurantId)

      const totalCollected = transactions
        ?.filter(t => {
          const status = (t.montypay_status || '').toUpperCase()
          return t.transaction_type === 'charge' && (status === 'SETTLED' || status === 'SUCCESS')
        })
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0

      const totalWaived = transactions
        ?.filter(t => t.transaction_type === 'waiver')
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0

      const failedCharges = transactions
        ?.filter(t => {
          const status = (t.montypay_status || '').toUpperCase()
          return t.transaction_type === 'charge' && status !== 'SETTLED' && status !== 'SUCCESS'
        })
        .length || 0

      return {
        activeHolds: activeHoldsCount,
        totalCollected,
        totalWaived,
        failedCharges
      }
    },
    enabled: !!restaurantId
  })

  // Fetch Transactions
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['guarantee_transactions', restaurantId, page],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from('penalty_transactions')
        .select(`
          *,
          booking:bookings!inner(
            id,
            guest_name,
            confirmation_code,
            booking_time,
            party_size,
            restaurant_id,
            user_id,
            payment_methods(
              card_mask,
              card_brand,
              is_active
            )
          ),
          booking_guarantee:booking_guarantees(
            payment_method:payment_methods(
              card_mask,
              card_brand
            )
          )
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1)

      if (error) throw error
      
      // Fetch user profiles for bookings with user_id
      const userIds = Array.from(new Set(
        data
          .map(tx => tx.booking?.user_id)
          .filter(Boolean)
      ))

      if (userIds.length > 0) {
        const { data: profiles } = await supabase.rpc('get_public_profile_info', {
          user_ids: userIds
        })
        
        if (profiles) {
          return data.map(tx => {
             const profile = profiles.find((p: any) => p.user_id === tx.booking?.user_id)
             if (profile) {
               return {
                 ...tx,
                 booking: {
                   ...tx.booking,
                   guest_name: profile.full_name || tx.booking.guest_name
                 }
               }
             }
             return tx
          })
        }
      }

      return data
    },
    enabled: !!restaurantId
  })

  // Fetch Active Holds
  const { data: activeHolds } = useQuery({
    queryKey: ['active_guarantees', restaurantId, activeHoldsSearch],
    queryFn: async () => {
      if (!restaurantId) return []
      
      let query = supabase
        .from('booking_guarantees')
        .select(`
          *,
          booking:bookings!inner(
            id,
            guest_name,
            confirmation_code,
            booking_time,
            party_size,
            restaurant_id,
            user_id
          ),
          payment_method:payment_methods!inner(
            card_mask,
            card_brand
          )
        `)
        .eq('status', 'held')
        .eq('booking.restaurant_id', restaurantId)
        .not('payment_method.card_mask', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50)

      if (activeHoldsSearch) {
        query = query.ilike('booking.guest_name', `%${activeHoldsSearch}%`)
      }

      const { data, error } = await query

      if (error) throw error

      // Fetch user profiles for bookings with user_id
      const userIds = Array.from(new Set(
        data
          .map(hold => hold.booking?.user_id)
          .filter(Boolean)
      ))

      if (userIds.length > 0) {
        const { data: profiles } = await supabase.rpc('get_public_profile_info', {
          user_ids: userIds
        })
        
        if (profiles) {
          return data.map(hold => {
             const profile = profiles.find((p: any) => p.user_id === hold.booking?.user_id)
             if (profile) {
               return {
                 ...hold,
                 booking: {
                   ...hold.booking,
                   guest_name: profile.full_name || hold.booking.guest_name
                 }
               }
             }
             return hold
          })
        }
      }

      return data
    },
    enabled: !!restaurantId
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const filteredTransactions = transactions?.filter(tx => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        tx.booking?.guest_name?.toLowerCase().includes(query) ||
        tx.booking?.confirmation_code?.toLowerCase().includes(query)
      if (!matchesSearch) return false
    }

    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'success') {
        const status = (tx.montypay_status || '').toUpperCase()
        if (tx.transaction_type !== 'charge' || (status !== 'SETTLED' && status !== 'SUCCESS')) {
          return false
        }
      } else if (statusFilter === 'failed') {
        const status = (tx.montypay_status || '').toUpperCase()
        if (tx.transaction_type !== 'charge' || status === 'SETTLED' || status === 'SUCCESS') {
          return false
        }
      } else if (statusFilter === 'waived') {
        if (tx.transaction_type !== 'waiver') return false
      }
    }

    // Date range filter
    if (startDate) {
      const txDate = new Date(tx.created_at)
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      txDate.setHours(0, 0, 0, 0)
      if (txDate < start) return false
    }

    if (endDate) {
      const txDate = new Date(tx.created_at)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      if (txDate > end) return false
    }

    return true
  })

  const chargeTransactions = filteredTransactions?.filter(t => t.transaction_type === 'charge') || []
  const waiverTransactions = filteredTransactions?.filter(t => t.transaction_type === 'waiver') || []
  const failedTransactions = filteredTransactions?.filter(t => {
      const status = (t.montypay_status || '').toUpperCase()
      return t.transaction_type === 'charge' && status !== 'SETTLED' && status !== 'SUCCESS'
  }) || []

  const renderTransactionItem = (tx: any) => (
    <div key={tx.id} className="p-2 rounded-lg border hover:bg-accent transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 ${
            tx.transaction_type === 'charge' 
              ? (tx.montypay_status?.toUpperCase() === 'SETTLED' || tx.montypay_status?.toUpperCase() === 'SUCCESS' ? 'bg-green-100' : 'bg-red-100')
              : 'bg-blue-100'
          }`}>
            {tx.transaction_type === 'charge' ? (
              tx.montypay_status?.toUpperCase() === 'SETTLED' || tx.montypay_status?.toUpperCase() === 'SUCCESS'
                ? <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                : <AlertCircle className="h-3.5 w-3.5 text-red-600" />
            ) : (
              <CheckCircle className="h-3.5 w-3.5 text-blue-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-medium truncate">{tx.booking?.guest_name || 'Unknown'}</h4>
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                #{tx.booking?.confirmation_code}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>{tx.booking?.booking_time && format(new Date(tx.booking.booking_time), 'MMM d, h:mm a')}</span>
              <span>• {tx.booking?.party_size} guests</span>
              {(tx.booking_guarantee?.payment_method?.card_mask || (tx.booking?.payment_methods && tx.booking.payment_methods.length > 0)) && (
                <div className="flex items-center gap-1">
                  <CreditCard className="h-2.5 w-2.5" />
                  <span className="font-mono">
                    {tx.booking_guarantee?.payment_method?.card_mask || tx.booking.payment_methods[0].card_mask}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <div className="text-sm font-bold">{formatCurrency(tx.amount)}</div>
          </div>
          <Badge 
            className={`text-[10px] px-1.5 py-0 ${
              tx.transaction_type === 'waiver'
                ? 'bg-blue-100 text-blue-700 border-blue-200'
                : tx.montypay_status?.toUpperCase() === 'SETTLED' || tx.montypay_status?.toUpperCase() === 'SUCCESS'
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : 'bg-red-100 text-red-700 border-red-200'
            }`}
          >
            {tx.transaction_type === 'waiver' ? 'Waived' : 
              (tx.montypay_status?.toUpperCase() === 'SETTLED' || tx.montypay_status?.toUpperCase() === 'SUCCESS' ? 'Success' : 'Failed')}
          </Badge>
        </div>
      </div>
    </div>
  )

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Compact Header Bar */}
      <div className="flex-shrink-0 px-3 py-2 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-teal-500 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Credit Card Guarantees</h1>
              <p className="text-xs text-muted-foreground">Track holds & penalties</p>
            </div>
          </div>
          <Link href="/settings/guarantees">
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
              <Settings className="mr-1.5 h-3.5 w-3.5" />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Metric Cards */}
        <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
          <Card className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Collected</span>
              <TrendingUp className="h-3.5 w-3.5 text-green-600" />
            </div>
            <div className="text-lg font-bold text-green-600">{formatCurrency(stats?.totalCollected || 0)}</div>
            <p className="text-xs text-muted-foreground">From penalties</p>
          </Card>

          <Card className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Waived</span>
              <CheckCircle className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div className="text-lg font-bold text-blue-600">{formatCurrency(stats?.totalWaived || 0)}</div>
            <p className="text-xs text-muted-foreground">Forgiven</p>
          </Card>

          <Card className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Active Holds</span>
              <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div className="text-lg font-bold text-amber-600">{stats?.activeHolds || 0}</div>
            <p className="text-xs text-muted-foreground">Secured</p>
          </Card>

          <Card className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Failed</span>
              <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
            </div>
            <div className="text-lg font-bold text-rose-600">{stats?.failedCharges || 0}</div>
            <p className="text-xs text-muted-foreground">Unpaid</p>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-3 lg:grid-cols-3">
          {/* Transactions Section */}
          <Card className="lg:col-span-2">
            <CardHeader className="p-3 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Transactions</CardTitle>
                  <CardDescription className="text-xs">Charges & waivers</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-3">
              {/* Search Bar & Filters */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search guest or code..."
                      className="pl-8 h-8 text-xs"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-[120px] text-xs">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All</SelectItem>
                      <SelectItem value="success" className="text-xs">Success</SelectItem>
                      <SelectItem value="failed" className="text-xs">Failed</SelectItem>
                      <SelectItem value="waived" className="text-xs">Waived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 flex-1">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-8 text-xs justify-start text-left font-normal flex-1",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {startDate ? format(startDate, "dd/MM/yyyy") : "Start date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="text-xs text-muted-foreground">to</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-8 text-xs justify-start text-left font-normal flex-1",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {endDate ? format(endDate, "dd/MM/yyyy") : "End date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  {(statusFilter !== 'all' || startDate || endDate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => {
                        setStatusFilter('all')
                        setStartDate(undefined)
                        setEndDate(undefined)
                      }}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full h-10">
                  <TabsTrigger value="transactions" className="flex-1 text-xs">All ({filteredTransactions?.length || 0})</TabsTrigger>
                  <TabsTrigger value="charges" className="flex-1 text-xs">Charges ({chargeTransactions.length})</TabsTrigger>
                  <TabsTrigger value="waivers" className="flex-1 text-xs">Waivers ({waiverTransactions.length})</TabsTrigger>
                  <TabsTrigger value="failed" className="flex-1 text-xs">Failed ({failedTransactions.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="transactions" className="space-y-2">
                {filteredTransactions?.map(renderTransactionItem)}
                {!filteredTransactions?.length && (
                  <div className="text-center py-6">
                    <DollarSign className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <h3 className="font-medium text-xs mb-0.5">No transactions</h3>
                    <p className="text-[10px] text-muted-foreground">Transactions will appear here</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="charges" className="space-y-2">
                {chargeTransactions.map(renderTransactionItem)}
                {!chargeTransactions.length && (
                  <div className="text-center py-6">
                    <TrendingDown className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <h3 className="font-medium text-xs mb-0.5">No charges</h3>
                    <p className="text-[10px] text-muted-foreground">Charges will appear here</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="waivers" className="space-y-2">
                {waiverTransactions.map(renderTransactionItem)}
                {!waiverTransactions.length && (
                  <div className="text-center py-6">
                    <CheckCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <h3 className="font-medium text-xs mb-0.5">No waivers</h3>
                    <p className="text-[10px] text-muted-foreground">Waivers will appear here</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="failed" className="space-y-2">
                  {failedTransactions.map(renderTransactionItem)}
                  {!failedTransactions.length && (
                    <div className="text-center py-6">
                      <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                      <h3 className="font-medium text-xs mb-0.5">No failed transactions</h3>
                      <p className="text-[10px] text-muted-foreground">Failed transactions will appear here</p>
                    </div>
                  )}
                </TabsContent>
            </Tabs>
            
            {/* Pagination Controls */}
              <div className="flex items-center justify-between pt-2 border-t mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-xs" 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || transactionsLoading}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">Page {page}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!transactions?.length || transactions.length < ITEMS_PER_PAGE || transactionsLoading}
                >
                  Next
                </Button>
              </div>
          </CardContent>
        </Card>

          {/* Active Holds Sidebar */}
          <Card>
            <CardHeader className="p-3 pb-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <CardTitle className="text-sm font-semibold">Active Holds</CardTitle>
                  <CardDescription className="text-xs">Card authorizations</CardDescription>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search guest..."
                  className="pl-8 h-8 text-xs bg-background/50"
                  value={activeHoldsSearch}
                  onChange={(e) => setActiveHoldsSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              {activeHolds?.map((hold: any) => (
                <div key={hold.id} className="p-2 rounded-lg border bg-amber-50/50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                    <h4 className="font-medium text-xs truncate">{hold.booking?.guest_name || 'Unknown'}</h4>
                  </div>
                  <div className="space-y-0.5 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="h-2.5 w-2.5" />
                      {hold.booking?.booking_time && format(new Date(hold.booking.booking_time), 'MMM d, h:mm a')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-2.5 w-2.5" />
                      {hold.booking?.party_size} guests
                    </div>
                    <div className="flex items-center gap-1">
                      <CreditCard className="h-2.5 w-2.5" />
                      {hold.payment_method?.card_mask ? (
                        <span className="font-mono">{hold.payment_method.card_mask}</span>
                      ) : (
                        hold.card_last4 ? `•••• ${hold.card_last4}` : 'Card on file'
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {!activeHolds?.length && (
                <div className="text-center py-4">
                  <ShieldCheck className="h-6 w-6 text-muted-foreground mx-auto mb-1 opacity-50" />
                  <p className="text-[10px] text-muted-foreground">No active holds</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
