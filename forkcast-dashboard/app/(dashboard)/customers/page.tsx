// app/(dashboard)/customers/page.tsx

'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDebounce } from '@/hooks/use-debounce'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useRestaurantContext } from '@/lib/contexts/restaurant-context'
import { 
  Search, 
  Plus, 
  Filter, 
  Download, 
  Users, 
  Star,
  AlertCircle,
  UserPlus,
  MoreVertical,
  Phone,
  Mail,
  Calendar,
  TrendingUp,
  X,
  Edit,
  Upload,
  Cake,
  Gift,
  Smartphone,
  Store,
  RefreshCw,
  ArrowUpDown,
  CheckSquare,
  Square,
  ArrowUp,
  ArrowDown,
  ChevronUp,
  ChevronDown,
  Tag,
  FileDown
} from 'lucide-react'
import { toast } from 'sonner'
import { format, differenceInDays, addYears, isBefore, startOfDay } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CustomerDetailsDialog } from '@/components/customers/customer-details-dialog'
import { TagManagementDialog } from '@/components/customers/tag-management-dialog'
import { AddCustomerDialog } from '@/components/customers/add-customer-dialog'
import CustomerMergeSelectionDialog from '@/components/customers/customer-merge-selection-dialog'
import { CustomerBulkActions } from '@/components/customers/customer-bulk-actions'
import { CustomerInsights } from '@/components/customers/customer-insights'
import { EditCustomerDialog } from '@/components/customers/edit-customer-dialog'
// MigrationButton removed - ServeMe migration no longer needed
import { ImportGuestsDialog } from '@/components/customers/import-guests-dialog'
import { restaurantAuth } from '@/lib/restaurant-auth'
import { customerUtils } from '@/lib/customer-utils'
import type { RestaurantCustomer, CustomerTag, CustomerFilters } from '@/types/customer'
import { getAutoTagMeta, isSystemTag } from '@/lib/customer-auto-tags'
import { Zap } from 'lucide-react'

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

// Helper function to check if birthday is upcoming
const getBirthdayInfo = (dateOfBirth: string | null | undefined): { daysUntil: number; isToday: boolean; isSoon: boolean } | null => {
  if (!dateOfBirth) return null
  
  const today = startOfDay(new Date())
  const birthDate = new Date(dateOfBirth)
  
  // Get this year's birthday
  let nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())
  
  // If birthday has passed this year, use next year's
  if (isBefore(nextBirthday, today)) {
    nextBirthday = addYears(nextBirthday, 1)
  }
  
  const daysUntil = differenceInDays(nextBirthday, today)
  
  return {
    daysUntil,
    isToday: daysUntil === 0,
    isSoon: daysUntil > 0 && daysUntil <= 7
  }
}

// Helper to check if a string is a UUID (filtering bad data where user_id was stored as guest_name)
const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)

// Helper to get customer display name, filtering out UUID values from guest_name
const getCustomerDisplayName = (customer: RestaurantCustomer, fallback: string = 'Guest'): string => {
  const guestName = customer.guest_name && !isUUID(customer.guest_name) ? customer.guest_name : null
  return guestName || customer.profile?.full_name || fallback
}

export default function CustomersPage() {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { currentRestaurant, hasFeature } = useRestaurantContext()
  const restaurantId = currentRestaurant?.restaurant.id
  
  // State
  const [customers, setCustomers] = useState<RestaurantCustomer[]>([])
  const [tags, setTags] = useState<CustomerTag[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingCustomers, setLoadingCustomers] = useState(false) // Separate loading state for customer list
  const [currentStaff, setCurrentStaff] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('customers')
  
  // Pagination state
  const [totalCustomerCount, setTotalCustomerCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const PAGE_SIZE = 50
  
  // Use ref for total count to avoid circular dependency in loadCustomers
  const totalCustomerCountRef = useRef(0)
  
  // Bulk selection
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set())
  const [isSelectMode, setIsSelectMode] = useState(false)
  
  // Filters
  const [filters, setFilters] = useState<CustomerFilters>({
    search: '',
    sort_by: 'total_bookings',
    sort_order: 'desc'
  })
  const [searchInput, setSearchInput] = useState('') // Separate state for input (doesn't trigger search)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const isSearchingRef = useRef(false) // Track if we're currently searching to prevent useEffect triggers
  
  // Dialogs
  const [selectedCustomer, setSelectedCustomer] = useState<RestaurantCustomer | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false)
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [customerToMerge, setCustomerToMerge] = useState<RestaurantCustomer | null>(null)
  const [customerToEdit, setCustomerToEdit] = useState<RestaurantCustomer | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [refreshingAutoTags, setRefreshingAutoTags] = useState(false)


  const loadCustomers = useCallback(async (
    restaurantId: string, 
    append: boolean = false, 
    currentCount: number = 0,
    searchOverride?: string // Allow passing search directly
  ) => {
    // Use search override if provided, otherwise use current filters from state
    const searchQuery = searchOverride !== undefined ? searchOverride : filters.search
    const tagIds = selectedTags
    const sortBy = filters.sort_by
    const sortOrder = filters.sort_order
    
    // Set loading state (only for customer list, not full page)
    if (!append) {
      setLoadingCustomers(true)
    } else {
      setLoadingMore(true)
    }
    
    try {
      const startIndex = append ? currentCount : 0
      const endIndex = startIndex + PAGE_SIZE - 1 // Supabase range is inclusive on both ends

      // Build the base query - optimize by loading only essential profile fields
      let query = supabase
        .from('restaurant_customers')
        .select(`
          *,
          profile:profiles!restaurant_customers_user_id_fkey(
            id,
            full_name,
            email,
            phone_number,
            avatar_url,
            loyalty_points,
            membership_tier,
            date_of_birth,
            allergies,
            dietary_restrictions
          ),
          tags:customer_tag_assignments(
            is_auto,
            last_auto_refreshed_at,
            tag:customer_tags(*)
          )
        `, { count: append ? undefined : 'exact' })
        .eq('restaurant_id', restaurantId)

      // Run tag filter and profile search in parallel for better performance
      // Only search profiles if search query is at least 2 characters (faster, less noise)
      const shouldSearchProfiles = searchQuery && searchQuery.trim().length >= 2
      
      // First, verify tags belong to this restaurant and get valid tag IDs
      let validTagIds: string[] = []
      if (tagIds && tagIds.length > 0) {
        const { data: validTags, error: tagError } = await supabase
          .from('customer_tags')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .in('id', tagIds)
        
        if (tagError) {
          console.error('Error validating tags:', tagError)
          throw tagError
        }
        
        if (!validTags || validTags.length === 0) {
          // No valid tags for this restaurant, return empty
          setCustomers([])
          setTotalCustomerCount(0)
          setHasMore(false)
          if (!append) {
            setLoadingCustomers(false)
          } else {
            setLoadingMore(false)
          }
          return
        }
        
        validTagIds = validTags.map(t => t.id)
      }

      const [tagFilterResult, profileSearchResult] = await Promise.all([
        // Tag filter query - get customer assignments for valid tags
        validTagIds.length > 0
          ? supabase
              .from('customer_tag_assignments')
              .select('customer_id')
              .in('tag_id', validTagIds)
          : Promise.resolve({ data: null, error: null }),
        // Use RPC to bypass RLS on 20k+ profiles (avoids statement timeout 57014)
        shouldSearchProfiles
          ? supabase.rpc('search_profiles_admin', { search_query: searchQuery.trim() })
          : Promise.resolve({ data: null, error: null })
      ])

      // Apply tag filter
      let tagFilteredCustomerIds: string[] | null = null
      if (validTagIds.length > 0) {
        tagFilteredCustomerIds = tagFilterResult.data?.map((ta: any) => ta.customer_id) || []
        
        if (tagFilteredCustomerIds.length === 0) {
          // No customers have these tags, return empty result
          setCustomers([])
          setTotalCustomerCount(0)
          setHasMore(false)
          if (!append) {
            setLoadingCustomers(false)
          } else {
            setLoadingMore(false)
          }
          return
        }
        query = query.in('id', tagFilteredCustomerIds)
      }

      // Apply search filter
      if (profileSearchResult.error) {
        console.error('search_profiles_admin RPC error:', profileSearchResult.error)
      }
      const matchingUserIds = profileSearchResult.data?.map((p: { id: string }) => p.id) || []
      if (searchQuery && searchQuery.trim()) {
        const search = `%${searchQuery.trim()}%`
        // Build search query: guest fields OR user_id in matching profiles
        // Only search profiles if we have matches and it's a reasonable number
        if (shouldSearchProfiles && matchingUserIds.length > 0 && matchingUserIds.length < 200) {
          // Only use user_id filter if we have a reasonable number of matches
          query = query.or(`guest_name.ilike.${search},guest_email.ilike.${search},guest_phone.ilike.${search},user_id.in.(${matchingUserIds.join(',')})`)
        } else {
          // If no profile search or too many matches, just search guest fields (faster)
          query = query.or(`guest_name.ilike.${search},guest_email.ilike.${search},guest_phone.ilike.${search}`)
        }
      }

      // Apply sorting (backend)
      if (sortBy === 'last_visit') {
        query = query.order('last_visit', { ascending: sortOrder === 'asc', nullsFirst: false })
      } else if (sortBy === 'total_bookings') {
        query = query.order('total_bookings', { ascending: sortOrder === 'asc' })
      } else {
        // Default: created_at desc, or name sorting will be done client-side
        query = query.order('created_at', { ascending: false })
      }

      // Get total count in parallel with main query (only on initial load)
      let countPromise: Promise<any> | null = null
      if (!append) {
        let countQuery = supabase
          .from('restaurant_customers')
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)

        if (searchQuery && searchQuery.trim()) {
          const search = `%${searchQuery.trim()}%`
          // Reuse matchingUserIds from above (check if profile search was done)
          const hasProfileMatches = shouldSearchProfiles && matchingUserIds.length > 0 && matchingUserIds.length < 200
          if (hasProfileMatches) {
            countQuery = countQuery.or(`guest_name.ilike.${search},guest_email.ilike.${search},guest_phone.ilike.${search},user_id.in.(${matchingUserIds.join(',')})`)
          } else {
            countQuery = countQuery.or(`guest_name.ilike.${search},guest_email.ilike.${search},guest_phone.ilike.${search}`)
          }
        }
        
        if (tagIds && tagIds.length > 0 && tagFilteredCustomerIds) {
          countQuery = countQuery.in('id', tagFilteredCustomerIds)
        }

        // Supabase queries are thenable, cast to Promise for TypeScript
        countPromise = countQuery as unknown as Promise<any>
      }

      // Apply pagination
      query = query.range(startIndex, endIndex)

      // Execute main query and count query in parallel
      const [customersResult, countResult] = await Promise.all([
        query,
        countPromise || Promise.resolve({ count: null, error: null })
      ])

      const { data: customersData, error: customersError } = customersResult
      if (customersError) throw customersError

      // Set count if we got it
      if (!append && countResult.count !== null) {
        const { count, error: countError } = countResult
        if (countError) throw countError
        setTotalCustomerCount(count || 0)
      }

      // Filter out admin and restaurant staff accounts (run in parallel for speed)
      let filteredCustomersData = customersData || []

      // Filter by tags (need to do this client-side since tags are in a separate table)
      if (selectedTags && selectedTags.length > 0) {
        filteredCustomersData = filteredCustomersData.filter(customer => {
          const customerTagIds = customer.tags?.map((ta: any) => ta.tag?.id).filter(Boolean) || []
          return selectedTags.some(tagId => customerTagIds.includes(tagId))
        })
      }
      
      if (filteredCustomersData.length > 0) {
        const customerUserIds = filteredCustomersData
          .map(c => c.user_id)
          .filter(id => id !== null)
        
        if (customerUserIds.length > 0) {
          // Check for admin and staff accounts in parallel
          const [adminResult, staffResult] = await Promise.all([
            supabase
              .from('rbs_admins')
              .select('user_id')
              .in('user_id', customerUserIds),
            supabase
              .from('restaurant_staff')
              .select('user_id')
              .in('user_id', customerUserIds)
              .eq('is_active', true)
          ])
          
          const adminUserIds = new Set(adminResult.data?.map(admin => admin.user_id) || [])
          const staffUserIds = new Set(staffResult.data?.map(staff => staff.user_id) || [])
          
          // Filter out customers who are admins or staff
          filteredCustomersData = filteredCustomersData.filter(customer => {
            if (!customer.user_id) return true
            return !adminUserIds.has(customer.user_id) && !staffUserIds.has(customer.user_id)
          })
        }
      }

      // Skip separate profile query - we already have profile data from the join
      // Only fetch missing profiles if absolutely necessary (shouldn't happen with proper join)
      const missingProfileUserIds = filteredCustomersData
        ?.filter(c => c.user_id && !c.profile)
        .map(c => c.user_id)
        .filter(id => id !== null) || []
      
      let profilesData: any[] = []
      if (missingProfileUserIds.length > 0) {
        const { data, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone_number, avatar_url, loyalty_points, membership_tier, date_of_birth, allergies, dietary_restrictions')
          .in('id', missingProfileUserIds)
        if (profilesError) throw profilesError
        profilesData = data || []
      }

      // Transform data to merge customer and profile information, and flatten tag structure
      const transformedData = filteredCustomersData?.map(customer => {
        // Transform tags from nested structure to flat array
        const flattenedTags = customer.tags?.map((tagAssignment: any) => ({
          ...tagAssignment.tag,
          is_auto: tagAssignment.is_auto,
        })) || []
        
        // Handle profile data
        let processedCustomer = {
          ...customer,
          tags: flattenedTags
        }
        
        // If profile is already included from the join, use it
        if (customer.profile) {
          processedCustomer.profile = customer.profile
        } else {
          // Otherwise, find the profile in the separate query
          const profile = profilesData?.find(p => p.id === customer.user_id)
          processedCustomer.profile = profile || null
        }
        
        return processedCustomer
      }) || []

      // Update customers - append if loading more, replace if initial load
      // Deduplicate by customer ID to prevent duplicates
      if (append) {
        // Calculate deduplicated customers first
        const existingIds = new Set(customers.map(c => c.id))
        const newCustomers = transformedData.filter(c => !existingIds.has(c.id))
        const finalCount = currentCount + newCustomers.length
        
        setCustomers(prev => {
          const existingIds = new Set(prev.map(c => c.id))
          const newCustomers = transformedData.filter(c => !existingIds.has(c.id))
          return [...prev, ...newCustomers]
        })
        
        // Calculate hasMore: only show if we got a full page AND there are more customers
        const gotFullPage = transformedData.length === PAGE_SIZE
        const hasMoreResults = gotFullPage && finalCount < totalCustomerCount
        setHasMore(totalCustomerCount > 0 && hasMoreResults)
      } else {
        setCustomers(transformedData)
        // Calculate hasMore for initial load
        const gotFullPage = transformedData.length === PAGE_SIZE
        const hasMoreResults = gotFullPage && transformedData.length < totalCustomerCount
        setHasMore(totalCustomerCount > 0 && hasMoreResults)
      }
      
    } catch (error) {
      console.error('Error loading customers:', error)
      toast.error('Failed to load customers')
    } finally {
      if (!append) {
        setLoadingCustomers(false)
      } else {
        setLoadingMore(false)
      }
    }
  }, [supabase, PAGE_SIZE, totalCustomerCount, filters.sort_by, filters.sort_order, selectedTags])

  const handleRefreshAutoTags = useCallback(async () => {
    if (!restaurantId || refreshingAutoTags) return
    setRefreshingAutoTags(true)
    try {
      const { data, error } = await supabase.rpc('refresh_all_customer_auto_tags', {
        p_restaurant_id: restaurantId,
      })
      if (error) throw error
      toast.success(`Recomputed auto-tags for ${data ?? 0} guests`)
      await loadCustomers(restaurantId)
    } catch (err: any) {
      console.error('Failed to refresh auto-tags:', err)
      const msg = typeof err?.message === 'string' && err.message.includes('access_denied')
        ? 'You are not authorised to refresh tags for this restaurant.'
        : 'Failed to refresh automated tags'
      toast.error(msg)
    } finally {
      setRefreshingAutoTags(false)
    }
  }, [restaurantId, refreshingAutoTags, supabase, loadCustomers])

  const loadTags = useCallback(async (restaurantId: string) => {
    try {
      const { data, error } = await supabase
        .from('customer_tags')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('name')

      if (error) throw error
      setTags(data || [])
    } catch (error) {
      console.error('Error loading tags:', error)
      toast.error('Failed to load tags')
    }
  }, [supabase])

  const hasInitializedRef = useRef(false)
  
  const loadInitialData = useCallback(async () => {
    // Only run once on mount
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true
    
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Use restaurant from context
      if (!currentRestaurant) {
        setLoading(false)
        hasInitializedRef.current = false // Reset if no restaurant
        return
      }

      // Get current staff data for permission checking
      const { data: staffData, error: staffError } = await supabase
        .from('restaurant_staff')
        .select(`
          id,
          role,
          permissions,
          restaurant_id,
          user_id
        `)
        .eq('user_id', user.id)
        .eq('restaurant_id', currentRestaurant.restaurant.id)
        .eq('is_active', true)
        .single()

      if (staffError || !staffData) {
        toast.error("You don't have access to view customers")
        router.push('/bookings')
        return
      }

      setCurrentStaff(staffData)

      // Check permissions
      if (!restaurantAuth.hasPermission(staffData.permissions, 'customers.view', staffData.role)) {
        toast.error("You don't have permission to view customers")
        router.push('/bookings')
        return
      }

      // Load customers and tags - call directly without dependencies
      // We'll get the functions from closure, but they may be stale - that's ok for initial load
      const restaurantId = currentRestaurant.restaurant.id
      
      // Load tags first
      const { data: tagsData, error: tagsError } = await supabase
        .from('customer_tags')
        .select('*')
        .eq('restaurant_id', restaurantId)
      
      if (!tagsError && tagsData) {
        setTags(tagsData)
      }
      
      // Load customers - call loadCustomers directly
      await loadCustomers(restaurantId, false, 0)

    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load customers')
      hasInitializedRef.current = false // Reset on error
    } finally {
      setLoading(false)
    }
  }, [router, supabase, currentRestaurant, loadCustomers]) // Keep loadCustomers but use ref to prevent re-runs

  // Load initial data
  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Reload customers when filters change (NOT search - search is triggered by button)
  useEffect(() => {
    if (!restaurantId || loading || !currentRestaurant || isSearchingRef.current) return
    
    loadCustomers(restaurantId, false, 0)
  }, [selectedTags, filters.sort_by, filters.sort_order, restaurantId, loadCustomers, loading, currentRestaurant])

  // Handle search button click
  const handleSearch = useCallback((e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault()
    e?.stopPropagation()
    
    const searchValue = searchInput.trim()
    // If search is empty and we have a current search, clear it immediately
    if (searchValue === '' && filters.search !== '') {
      setFilters(prev => ({ ...prev, search: '' }))
      if (restaurantId && !loading && currentRestaurant) {
        isSearchingRef.current = true
        loadCustomers(restaurantId, false, 0, '').finally(() => {
          setTimeout(() => {
            isSearchingRef.current = false
          }, 100)
        })
      }
      return
    }
    
    if (restaurantId && !loading && currentRestaurant && searchValue !== filters.search) {
      // Set flag to prevent useEffect from triggering
      isSearchingRef.current = true
      // Update filters and load customers with search value directly
      setFilters(prev => ({ ...prev, search: searchValue }))
      // Pass search value directly to avoid state timing issues
      loadCustomers(restaurantId, false, 0, searchValue).finally(() => {
        // Reset flag after search completes
        setTimeout(() => {
          isSearchingRef.current = false
        }, 100)
      })
    }
  }, [searchInput, filters.search, restaurantId, loading, currentRestaurant, loadCustomers])

  // Handle Enter key in search input
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Sort customers (client-side for name sorting only, other sorting is backend)
  const filteredCustomers = useMemo(() => {
    let filtered = [...customers]

    // Name sorting (client-side since it requires profile data and is complex with joins)
    if (filters.sort_by === 'name') {
      filtered.sort((a, b) => {
        const nameA = getCustomerDisplayName(a, '').toLowerCase()
        const nameB = getCustomerDisplayName(b, '').toLowerCase()
        const comparison = nameA.localeCompare(nameB)
        return filters.sort_order === 'asc' ? comparison : -comparison
      })
    }
    // Other sorting (last_visit, total_bookings) is done backend

    return filtered
  }, [customers, filters.sort_by, filters.sort_order])

  // Handle scroll indicator and table scroll
  useEffect(() => {
    const scrollContainer = document.getElementById('table-scroll-container')
    const scrollIndicator = document.getElementById('scroll-indicator-right')
    
    if (!scrollContainer || !scrollIndicator) return

    const updateScrollIndicator = () => {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainer
      const canScrollRight = scrollLeft < scrollWidth - clientWidth - 1
      
      if (canScrollRight) {
        scrollIndicator.classList.remove('opacity-0')
        scrollIndicator.classList.add('opacity-100')
      } else {
        scrollIndicator.classList.remove('opacity-100')
        scrollIndicator.classList.add('opacity-0')
      }
    }

    updateScrollIndicator()
    scrollContainer.addEventListener('scroll', updateScrollIndicator)
    window.addEventListener('resize', updateScrollIndicator)

    return () => {
      scrollContainer.removeEventListener('scroll', updateScrollIndicator)
      window.removeEventListener('resize', updateScrollIndicator)
    }
  }, [filteredCustomers.length])

  // Stats - use totalCustomerCount for total, calculate others from loaded customers
  const stats = useMemo(() => {
    const total = totalCustomerCount > 0 ? totalCustomerCount : customers.length
    const vip = customers.filter(c => c.vip_status).length
    const returning = customers.filter(c => (c.total_bookings || 0) > 1).length
    const returningRate = total > 0 ? ((returning / total) * 100) : 0

    return { total, vip, returning, returningRate }
  }, [customers, totalCustomerCount])

  // Handlers
  const handleCustomerClick = (customer: RestaurantCustomer) => {
    if (isSelectMode) {
      toggleCustomerSelection(customer.id)
    } else {
      setSelectedCustomer(customer)
      setShowDetailsDialog(true)
    }
  }

  const toggleCustomerSelection = (customerId: string) => {
    const newSelection = new Set(selectedCustomerIds)
    if (newSelection.has(customerId)) {
      newSelection.delete(customerId)
    } else {
      newSelection.add(customerId)
    }
    setSelectedCustomerIds(newSelection)
  }

  const toggleSelectAll = () => {
    const allFilteredIds = new Set(filteredCustomers.map(c => c.id))
    const allSelected = filteredCustomers.length > 0 && 
      filteredCustomers.every(c => selectedCustomerIds.has(c.id))
    
    if (allSelected) {
      // Deselect all filtered customers
      const newSelection = new Set(selectedCustomerIds)
      filteredCustomers.forEach(c => newSelection.delete(c.id))
      setSelectedCustomerIds(newSelection)
    } else {
      // Select all filtered customers
      const newSelection = new Set(selectedCustomerIds)
      filteredCustomers.forEach(c => newSelection.add(c.id))
      setSelectedCustomerIds(newSelection)
    }
  }

  // Check if all filtered customers are selected
  const allFilteredSelected = useMemo(() => {
    if (filteredCustomers.length === 0) return false
    return filteredCustomers.every(c => selectedCustomerIds.has(c.id))
  }, [filteredCustomers, selectedCustomerIds])

  // Check if some (but not all) filtered customers are selected
  const someFilteredSelected = useMemo(() => {
    if (filteredCustomers.length === 0) return false
    const selectedCount = filteredCustomers.filter(c => selectedCustomerIds.has(c.id)).length
    return selectedCount > 0 && selectedCount < filteredCustomers.length
  }, [filteredCustomers, selectedCustomerIds])

  const clearSelection = () => {
    setSelectedCustomerIds(new Set())
    setIsSelectMode(false)
  }

  const handleColumnSort = (column: 'name' | 'total_bookings' | 'last_visit') => {
    const newSortOrder = 
      filters.sort_by === column && filters.sort_order === 'asc' ? 'desc' : 'asc'
    setFilters({ ...filters, sort_by: column, sort_order: newSortOrder })
  }

  const selectedCustomers = useMemo(() => 
    customers.filter(c => selectedCustomerIds.has(c.id)),
    [customers, selectedCustomerIds]
  )

  const handleToggleVIP = async (customer: RestaurantCustomer) => {
    try {
      if (customer.vip_status) {
        // Remove VIP status - delete the record completely
        
        // First find the VIP record
        const { data: vipRecord, error: findError } = await supabase
          .from('restaurant_vip_users')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .eq('user_id', customer.user_id)
          .single()

        if (findError && findError.code !== 'PGRST116') { // PGRST116 is "not found"
          console.error('Error finding VIP record:', findError)
          throw findError
        }

        // Delete the VIP record if it exists
        if (vipRecord) {
          const { error: deleteError } = await supabase
            .from('restaurant_vip_users')
            .delete()
            .eq('id', vipRecord.id)

          if (deleteError) {
            console.error('Error deleting VIP record:', deleteError)
            throw deleteError
          }
        }

        // Update the restaurant_customers table
        const { error: customerError } = await supabase
          .from('restaurant_customers')
          .update({ 
            vip_status: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', customer.id)

        if (customerError) {
          console.error('Error updating customer VIP status:', customerError)
          throw customerError
        }

      } else {
        // Add VIP status
        if (!customer.user_id) {
          toast.error('Cannot make guest customers VIP. Customer must have an account.')
          return
        }

        // First, delete any existing VIP record to avoid constraint issues
        const { error: deleteError } = await supabase
          .from('restaurant_vip_users')
          .delete()
          .eq('restaurant_id', restaurantId)
          .eq('user_id', customer.user_id)

        // We don't check for error here since record might not exist

        // Now insert the new VIP record
        const { error: insertError } = await supabase
          .from('restaurant_vip_users')
          .insert({
            restaurant_id: restaurantId,
            user_id: customer.user_id,
            extended_booking_days: 60,
            priority_booking: true,
            valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year from now
          })

        if (insertError) {
          console.error('Error inserting VIP record:', insertError)
          throw insertError
        }

        // Update the restaurant_customers table
        const { error: customerError } = await supabase
          .from('restaurant_customers')
          .update({ 
            vip_status: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', customer.id)

        if (customerError) {
          console.error('Error updating customer VIP status:', customerError)
          throw customerError
        }
      }

      toast.success(`Customer ${customer.vip_status ? 'removed from' : 'added to'} VIP list`)
      
      // Refresh customers data
      await loadCustomers(restaurantId)
      
      // Invalidate VIP page queries so they refresh automatically
      
      // Add a small delay to ensure the database transaction is complete
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Try multiple invalidation strategies to ensure cache refresh
      queryClient.invalidateQueries({ queryKey: ["vip-users", restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["existing-customers", restaurantId] })
      
      // Also try invalidating by predicate to catch any variations
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const keys = query.queryKey as string[]
          return keys.includes("vip-users") || keys.includes("existing-customers")
        }
      })
      
      // Force refetch of VIP queries if they exist
      queryClient.refetchQueries({ queryKey: ["vip-users", restaurantId] })
      queryClient.refetchQueries({ queryKey: ["existing-customers", restaurantId] })
    } catch (error) {
      console.error('Error updating VIP status:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: (error as { code?: string })?.code,
        customerInfo: {
          id: customer.id,
          user_id: customer.user_id,
          current_vip_status: customer.vip_status,
          name: getCustomerDisplayName(customer)
        },
        restaurantId
      })
      
      // Show more specific error message based on error type
      if (error && typeof error === 'object') {
        const errorObj = error as any
        if (errorObj.code === '23505') {
          toast.error('VIP record conflict. Please refresh and try again.')
        } else if (errorObj.code === '42501') {
          toast.error('Permission denied. You may not have access to modify VIP status.')
        } else if (errorObj.message) {
          toast.error(`Failed to update VIP status: ${errorObj.message}`)
        } else {
          toast.error('Failed to update VIP status. Please try again.')
        }
      } else {
        toast.error('Failed to update VIP status. Please try again.')
      }
    }
  }

  const handleToggleBlacklist = async (customer: RestaurantCustomer, reason?: string) => {
    try {
      const { error } = await supabase
        .from('restaurant_customers')
        .update({ 
          blacklisted: !customer.blacklisted,
          blacklist_reason: !customer.blacklisted ? reason : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id)

      if (error) throw error

      toast.success(`Customer ${customer.blacklisted ? 'removed from' : 'added to'} blacklist`)
      await loadCustomers(restaurantId)
    } catch (error) {
      console.error('Error updating blacklist status:', error)
      toast.error('Failed to update blacklist status')
    }
  }

  const handleExportCustomers = () => {
    // Convert customers to CSV
    const headers = [
      'Name', 'Email', 'Email Verified', 'Phone', 'Total Bookings', 'Completed Bookings', 
      'Cancelled Bookings', 'No Shows', 'Last Visit', 'First Visit', 'VIP', 'Membership Tier',
      'Loyalty Points', 'Dietary Restrictions', 'Allergies', 'Favorite Cuisines', 'Tags'
    ]
    const rows = filteredCustomers.map(customer => [
      getCustomerDisplayName(customer, ''),
      customer.profile?.email || customer.guest_email || '',
      customer.profile?.email ? 'Yes' : 'No',
      customer.profile?.phone_number || customer.guest_phone || '',
      customer.total_bookings,
      customer.profile?.completed_bookings || 0,
      customer.profile?.cancelled_bookings || 0,
      customer.profile?.no_show_bookings || 0,
      customer.last_visit ? format(new Date(customer.last_visit), 'yyyy-MM-dd') : '',
      customer.first_visit ? format(new Date(customer.first_visit), 'yyyy-MM-dd') : '',
      customer.vip_status ? 'Yes' : 'No',
      customer.profile?.membership_tier || 'Bronze',
      customer.profile?.loyalty_points || 0,
      customer.profile?.dietary_restrictions?.join('; ') || '',
      customer.profile?.allergies?.join('; ') || '',
      customer.profile?.favorite_cuisines?.join('; ') || '',
      customer.tags?.map(t => t.name).join(', ') || ''
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customers-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLoadMore = async () => {
    if (!restaurantId || loadingMore || !hasMore) return
    
    // Use filteredCustomers length to account for client-side filtering
    const currentLoadedCount = customers.length
    
    setLoadingMore(true)
    try {
      await loadCustomers(restaurantId, true, currentLoadedCount)
    } finally {
      setLoadingMore(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <Users className="h-5 w-5 text-primary animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">Loading customers...</p>
        </div>
      </div>
    )
  }

  // Feature Gate - content check after hooks
  if (!hasFeature('customer_management')) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-6 text-center">
        <div className="bg-primary/10 p-5 rounded-2xl mb-5">
          <Users className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-xl font-semibold mb-2">Guest CRM Add-on Required</h1>
        <p className="text-sm text-muted-foreground max-w-md mb-5">
          The Guest CRM feature allows you to manage customer profiles, track visits, and personalize service.
        </p>
        <Button onClick={() => router.push('/settings')} className="h-8 px-4">
          Go to Settings to Upgrade
        </Button>
      </div>
    )
  }

  return (
    <TooltipProvider>
    <div className="h-full flex flex-col bg-background">

      {/* ─── Header ─── */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-2.5 border-b bg-card/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-sm">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">Guest CRM</h1>
              <p className="text-[11px] text-muted-foreground">Manage & nurture guest relationships</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {restaurantAuth.hasPermission(currentStaff?.permissions || [], 'customers.manage', currentStaff?.role) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowImportDialog(true)}
                    aria-label="Import guests"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Import Guests</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowTagDialog(true)}
                  aria-label="Manage tags"
                >
                  <Tag className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Manage Tags</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={refreshingAutoTags || !restaurantId}
                  onClick={handleRefreshAutoTags}
                  aria-label="Recompute automated tags"
                >
                  <Zap className={`h-4 w-4 ${refreshingAutoTags ? 'animate-pulse' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Recompute Auto Tags</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleExportCustomers}
                  aria-label="Export customers CSV"
                >
                  <FileDown className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export CSV</TooltipContent>
            </Tooltip>
            {restaurantAuth.hasPermission(currentStaff?.permissions || [], 'customers.manage', currentStaff?.role) && (
              <Button
                size="sm"
                className="h-8 px-3 ml-1 shadow-sm"
                onClick={() => setShowAddCustomerDialog(true)}
              >
                <UserPlus className="h-4 w-4 mr-1.5" />
                Add Guest
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-2 border-b bg-muted/30">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-card p-2.5 shadow-sm">
            <div className="h-7 w-7 rounded-md bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
              <Users className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-none tabular-nums">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Total Guests</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-card p-2.5 shadow-sm">
            <div className="h-7 w-7 rounded-md bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-none tabular-nums">{stats.returningRate.toFixed(0)}%</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Return Rate</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-card p-2.5 shadow-sm">
            <div className="h-7 w-7 rounded-md bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
              <Star className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-none tabular-nums">{stats.vip}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">VIP Guests</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-card p-2.5 shadow-sm">
            <div className="h-7 w-7 rounded-md bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
              <RefreshCw className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-none tabular-nums">{stats.returning}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Repeat Guests</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="flex-shrink-0 px-4 sm:px-6 py-2 border-b">
          <TabsList className="h-9">
            <TabsTrigger value="customers" className="text-xs px-4 gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-xs px-4 gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Insights
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="customers" className="flex-1 overflow-y-auto m-0 p-0">
          <div className="p-4 sm:p-6 space-y-4">

          {/* ─── Search & Filters ─── */}
          <div className="space-y-2.5">
            <div className="flex items-center h-9 rounded-md border border-input bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring">
              <div className="relative flex-1 h-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
                <input
                  type="search"
                  placeholder="Search by name, email, or phone..."
                  value={searchInput}
                  inputMode="search"
                  onChange={(e) => {
                    const newValue = e.target.value
                    setSearchInput(newValue)
                    if (newValue.trim() === '' && filters.search !== '') {
                      handleSearch()
                    }
                  }}
                  onKeyDown={handleSearchKeyDown}
                  className="h-full w-full bg-transparent pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="w-px h-6 bg-border shrink-0" />
              <button
                type="button"
                onClick={handleSearch}
                disabled={loadingCustomers}
                className="h-full inline-flex items-center justify-center gap-1.5 px-4 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-r-md transition-colors disabled:opacity-50"
              >
                {loadingCustomers ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                <span>Search</span>
              </button>
            </div>

            {/* Tag Filters */}
            {tags.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {tags.map(tag => (
                  <Tooltip key={tag.id}>
                    <TooltipTrigger asChild>
                      <Badge
                        variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                        className="cursor-pointer text-[11px] h-6 px-2.5 whitespace-nowrap transition-all hover:shadow-sm"
                        onClick={() => {
                          setSelectedTags(prev =>
                            prev.includes(tag.id)
                              ? prev.filter(id => id !== tag.id)
                              : [...prev, tag.id]
                          )
                        }}
                        style={{
                          backgroundColor: selectedTags.includes(tag.id) ? tag.color : undefined,
                          borderColor: tag.color,
                          color: selectedTags.includes(tag.id) && isLightColor(tag.color) ? '#000000' : undefined
                        }}
                      >
                        {tag.name}
                      </Badge>
                    </TooltipTrigger>
                    {tag.description && (
                      <TooltipContent>
                        <p className="max-w-xs text-xs">{tag.description}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                ))}
              </div>
            )}
          </div>

          {/* ─── Selection Banner ─── */}
          {isSelectMode && selectedCustomerIds.size > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckSquare className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm font-medium">{selectedCustomerIds.size} selected</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCustomerIds(new Set())}
                  className="h-7 text-xs px-2"
                >
                  Clear
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="h-7 text-xs px-2.5 text-muted-foreground"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Exit Selection
              </Button>
            </div>
          )}

          {/* Bulk Actions */}
          {isSelectMode && selectedCustomerIds.size > 0 && (
            <CustomerBulkActions
              selectedCustomers={selectedCustomers}
              tags={tags}
              onUpdate={() => loadCustomers(restaurantId || '', false, 0)}
              onClearSelection={clearSelection}
              currentUserId={currentStaff?.user_id || ''}
            />
          )}

          {/* ─── Customer Table ─── */}
          <Card className="overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
              <span className="text-sm font-medium">
                {hasMore
                  ? `Showing ${filteredCustomers.length} of ${totalCustomerCount}`
                  : `${filteredCustomers.length} ${filteredCustomers.length === 1 ? 'guest' : 'guests'}`
                }
              </span>
              <div className="flex items-center gap-1">
                {!isSelectMode ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => setIsSelectMode(true)}
                  >
                    <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                    Select
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2.5 text-xs text-destructive"
                    onClick={clearSelection}
                  >
                    <X className="h-3.5 w-3.5 mr-1.5" />
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Selection Controls */}
            {isSelectMode && filteredCustomers.length > 0 && (
              <div className="flex items-center gap-2.5 px-4 py-2 border-b bg-muted/10">
                <Checkbox
                  checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all customers"
                  className="h-4 w-4"
                />
                <span className="text-xs text-muted-foreground">
                  {allFilteredSelected ? 'Deselect all' : someFilteredSelected ? `${filteredCustomers.filter(c => selectedCustomerIds.has(c.id)).length} selected` : 'Select all'}
                </span>
              </div>
            )}

            {loadingCustomers ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center space-y-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto"></div>
                  <p className="text-sm text-muted-foreground">Loading guests...</p>
                </div>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-4">
                <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Users className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1">No guests found</p>
                <p className="text-xs text-muted-foreground/70 text-center max-w-xs">
                  {filters.search || selectedTags.length > 0
                    ? 'Try adjusting your search or filter criteria'
                    : 'Add your first guest to get started'}
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Scroll Indicator */}
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none z-20 opacity-0 transition-opacity duration-300" id="scroll-indicator-right"></div>
                <div className="overflow-x-auto" id="table-scroll-container">
                  <Table className="[&_th]:h-8 [&_th]:py-1.5 [&_th]:text-xs [&_td]:py-0.5 [&_td]:px-3 [&_a]:min-h-0 [&_a]:min-w-0 [&_button]:min-h-0 [&_button]:min-w-0 [&_input]:min-h-0 [&_input]:min-w-0">
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        {isSelectMode && (
                          <TableHead className="w-12 sticky left-0 z-10 bg-muted/30"></TableHead>
                        )}
                        <TableHead
                          className="min-w-[200px] sm:min-w-[260px] cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleColumnSort('name')}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Guest</span>
                            {filters.sort_by === 'name' ? (
                              filters.sort_order === 'asc' ? (
                                <ChevronUp className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-primary" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="min-w-[180px] sm:min-w-[210px]">Contact</TableHead>
                        <TableHead
                          className="min-w-[80px] sm:min-w-[100px] cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleColumnSort('total_bookings')}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Visits</span>
                            {filters.sort_by === 'total_bookings' ? (
                              filters.sort_order === 'asc' ? (
                                <ChevronUp className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-primary" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="min-w-[130px] sm:min-w-[160px]">Tags</TableHead>
                        <TableHead
                          className="min-w-[110px] sm:min-w-[130px] cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleColumnSort('last_visit')}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Last Visit</span>
                            {filters.sort_by === 'last_visit' ? (
                              filters.sort_order === 'asc' ? (
                                <ChevronUp className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-primary" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.map((customer) => (
                        <TableRow
                          key={customer.id}
                          className={`cursor-pointer group transition-colors ${
                            selectedCustomerIds.has(customer.id)
                              ? 'bg-primary/5 hover:bg-primary/10'
                              : 'hover:bg-muted/40'
                          }`}
                          onPointerDown={(e) => {
                            if ((e.target as HTMLElement).closest('[data-action-button]') ||
                                (e.target as HTMLElement).closest('[data-slot="dropdown-menu-trigger"]')) {
                              e.stopPropagation()
                              return
                            }
                          }}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('[data-action-button]') ||
                                (e.target as HTMLElement).closest('[data-slot="dropdown-menu-trigger"]')) {
                              e.stopPropagation()
                              return
                            }
                            handleCustomerClick(customer)
                          }}
                        >
                          {isSelectMode && (
                            <TableCell
                              onClick={(e) => e.stopPropagation()}
                              className={`sticky left-0 z-10 w-12 py-2 ${
                                selectedCustomerIds.has(customer.id)
                                  ? 'bg-primary/5'
                                  : 'bg-card'
                              }`}
                            >
                              <Checkbox
                                checked={selectedCustomerIds.has(customer.id)}
                                onCheckedChange={() => toggleCustomerSelection(customer.id)}
                                className="h-4 w-4"
                              />
                            </TableCell>
                          )}

                          {/* Guest Column */}
                          <TableCell className="py-1.5">
                            <div className="flex items-center gap-2.5">
                              <div className="relative shrink-0">
                                <Avatar className="h-7 w-7 border border-background shadow-sm">
                                  <AvatarImage src={customer.profile?.avatar_url} />
                                  <AvatarFallback className="text-[10px] font-medium bg-primary/10 text-primary">
                                    {getCustomerDisplayName(customer, 'G').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                {customer.vip_status && (
                                  <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-amber-400 border-[1.5px] border-background flex items-center justify-center">
                                    <Star className="h-2 w-2 text-white fill-white" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-medium text-xs truncate leading-4">
                                    {getCustomerDisplayName(customer)}
                                  </p>
                                  {customer.blacklisted && (
                                    <Badge variant="destructive" className="text-[9px] h-4 px-1 font-normal shrink-0">
                                      Blocked
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 mt-0">
                                  {customer.user_id ? (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] text-indigo-600 dark:text-indigo-400">
                                      <Smartphone className="h-2.5 w-2.5" />
                                      Forkcast
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                      <Store className="h-2.5 w-2.5" />
                                      Local
                                    </span>
                                  )}
                                  {customer.profile?.date_of_birth && (
                                    <>
                                      <span className="text-muted-foreground/30">·</span>
                                      <span className="text-[10px] text-muted-foreground">
                                        {customerUtils.formatAge(customer.profile.date_of_birth)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          {/* Contact Column */}
                          <TableCell className="py-0.5">
                            <div className="flex flex-col gap-0.5">
                              {(customer.guest_email || customer.profile?.email) ? (
                                <a
                                  href={`mailto:${customer.guest_email || customer.profile?.email}`}
                                  className="flex items-center gap-1 text-[11px] leading-4 text-foreground/70 hover:text-primary truncate font-medium"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Mail className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                                  <span className="truncate">{customer.guest_email || customer.profile?.email}</span>
                                </a>
                              ) : (
                                <span className="flex items-center gap-1 text-[11px] leading-4 text-muted-foreground/40 italic">
                                  <Mail className="h-3 w-3 shrink-0" />No email
                                </span>
                              )}

                              {(customer.guest_phone || customer.profile?.phone_number) ? (
                                <a
                                  href={`tel:${customer.guest_phone || customer.profile?.phone_number}`}
                                  className="flex items-center gap-1 text-[11px] leading-4 text-muted-foreground hover:text-primary truncate tabular-nums"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Phone className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                                  <span className="truncate">{customer.guest_phone || customer.profile?.phone_number}</span>
                                </a>
                              ) : (
                                <span className="flex items-center gap-1 text-[11px] leading-4 text-muted-foreground/40 italic">
                                  <Phone className="h-3 w-3 shrink-0" />No phone
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Visits Column */}
                          <TableCell className="py-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold tabular-nums">{customer.total_bookings || 0}</span>
                              {(customer.total_bookings || 0) >= 5 && (
                                <TrendingUp className="h-3 w-3 text-emerald-500" />
                              )}
                            </div>
                          </TableCell>

                          {/* Tags Column */}
                          <TableCell className="py-1.5">
                            <div className="flex items-center gap-1 flex-wrap">
                              {customer.tags && customer.tags.length > 0 ? (
                                <>
                                  {[...customer.tags]
                                    .sort((a: any, b: any) => {
                                      // system tags first, then by priority, then by name
                                      const aSys = isSystemTag(a) ? 0 : 1
                                      const bSys = isSystemTag(b) ? 0 : 1
                                      if (aSys !== bSys) return aSys - bSys
                                      return (a.priority ?? 999) - (b.priority ?? 999)
                                    })
                                    .slice(0, 2)
                                    .map((tag: any) => (
                                    <Badge
                                      key={tag.id}
                                      variant="outline"
                                      className="text-[10px] h-4 px-1.5 font-normal inline-flex items-center gap-0.5"
                                      style={{
                                        borderColor: tag.color,
                                        color: isLightColor(tag.color) ? '#000000' : tag.color
                                      }}
                                      title={isSystemTag(tag) ? `Auto: ${tag.description ?? tag.name}` : tag.description ?? tag.name}
                                    >
                                      {isSystemTag(tag) && <Zap className="h-2.5 w-2.5 opacity-70" aria-hidden />}
                                      {tag.name}
                                    </Badge>
                                  ))}
                                  {customer.tags.length > 2 && (
                                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                                      +{customer.tags.length - 2}
                                    </Badge>
                                  )}
                                </>
                              ) : (
                                <span className="text-[11px] text-muted-foreground/40">—</span>
                              )}
                            </div>
                          </TableCell>

                          {/* Last Visit Column */}
                          <TableCell className="py-1.5">
                            {customer.last_visit ? (
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Calendar className="h-3 w-3 shrink-0" />
                                <span className="whitespace-nowrap">
                                  {format(new Date(customer.last_visit), 'MMM d, yyyy')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/40 italic">Never</span>
                            )}
                          </TableCell>

                          {/* Actions Column */}
                          <TableCell
                            className="w-12 py-1.5"
                            onPointerDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {!isSelectMode && (
                              <div
                                className="relative z-20"
                                onPointerDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      data-action-button
                                      aria-label={`Actions for ${getCustomerDisplayName(customer)}`}
                                      className="h-6 w-6 text-muted-foreground/50 hover:text-foreground hover:bg-muted/80 transition-colors relative z-20"
                                      style={{ touchAction: 'manipulation', pointerEvents: 'auto', WebkitTapHighlightColor: 'transparent' }}
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuLabel className="text-xs font-medium">Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {restaurantAuth.hasPermission(currentStaff?.permissions || [], 'customers.manage', currentStaff?.role) && (
                                      <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation()
                                        setCustomerToEdit(customer)
                                        setShowEditDialog(true)
                                      }}>
                                        <Edit className="h-3.5 w-3.5 mr-2" />
                                        Edit Guest
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={(e) => {
                                      e.stopPropagation()
                                      handleToggleVIP(customer)
                                    }}>
                                      <Star className="h-3.5 w-3.5 mr-2" />
                                      {customer.vip_status ? 'Remove VIP' : 'Mark as VIP'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => {
                                      e.stopPropagation()
                                      const reason = customer.blacklisted ? null : prompt('Reason for blacklisting:')
                                      if (reason !== null || customer.blacklisted) {
                                        handleToggleBlacklist(customer, reason || undefined)
                                      }
                                    }}>
                                      <AlertCircle className="h-3.5 w-3.5 mr-2" />
                                      {customer.blacklisted ? 'Remove from Blocklist' : 'Add to Blocklist'}
                                    </DropdownMenuItem>
                                    {(!customer.user_id || filteredCustomers.some(c => !c.user_id)) &&
                                     restaurantAuth.hasPermission(currentStaff?.permissions || [], 'customers.manage', currentStaff?.role) && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={(e) => {
                                          e.stopPropagation()
                                          setCustomerToMerge(customer)
                                          setShowMergeDialog(true)
                                        }}>
                                          <Users className="h-3.5 w-3.5 mr-2" />
                                          Merge Guest
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Load More */}
            {!loadingCustomers && hasMore && filteredCustomers.length > 0 && totalCustomerCount > filteredCustomers.length && (
              <div className="p-4 border-t flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="h-8 px-5 text-sm"
                >
                  {loadingMore ? (
                    <>
                      <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      Load More ({totalCustomerCount - filteredCustomers.length} remaining)
                    </>
                  )}
                </Button>
              </div>
            )}
          </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="flex-1 overflow-y-auto m-0 p-4 sm:p-6">
          <CustomerInsights restaurantId={restaurantId} />
        </TabsContent>
      </Tabs>

      {/* ─── Dialogs ─── */}
      {selectedCustomer && (
        <CustomerDetailsDialog
          customer={selectedCustomer}
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
          onUpdate={() => loadCustomers(restaurantId)}
          restaurantId={restaurantId}
          currentUserId={currentStaff?.user_id || ''}
          canManage={restaurantAuth.hasPermission(currentStaff?.permissions || [], 'customers.manage', currentStaff?.role)}
        />
      )}

      <TagManagementDialog
        open={showTagDialog}
        onOpenChange={setShowTagDialog}
        restaurantId={restaurantId}
        tags={tags}
        onUpdate={() => loadTags(restaurantId)}
      />

      <AddCustomerDialog
        open={showAddCustomerDialog}
        onOpenChange={setShowAddCustomerDialog}
        restaurantId={restaurantId}
        onSuccess={() => loadCustomers(restaurantId)}
      />

      <CustomerMergeSelectionDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        primaryCustomer={customerToMerge}
        restaurantId={restaurantId}
        onSuccess={() => loadCustomers(restaurantId)}
      />

      {customerToEdit && (
        <EditCustomerDialog
          customer={customerToEdit}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSuccess={() => loadCustomers(restaurantId)}
          restaurantId={restaurantId}
        />
      )}

      <ImportGuestsDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        restaurantId={restaurantId}
        onSuccess={() => {
          loadCustomers(restaurantId)
          setShowImportDialog(false)
        }}
      />

    </div>
    </TooltipProvider>
  )
}

