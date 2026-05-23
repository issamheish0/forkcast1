import { createClient } from '@supabase/supabase-js'
import { RestaurantCustomer } from '@/types/customer'

// Create service role client
const supabaseServiceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface CustomerMergeOptions {
  mergeBookingHistory: boolean
  mergeContactInfo: boolean
  mergePreferences: boolean
  mergeTags: boolean
  mergeNotes: boolean
}

export interface CustomerMergeConflict {
  field: string
  sourceValue: string | null
  targetValue: string | null
  resolution: 'source' | 'target' | 'manual'
  manualValue?: string
}

export interface CustomerMergePreview {
  conflicts: CustomerMergeConflict[]
  bookingCount: number
  estimatedDuration: string
}

export async function validateCustomerMerge(
  sourceCustomerId: string,
  targetCustomerId: string
): Promise<CustomerMergePreview> {
  // Get both customers
  const [sourceResult, targetResult] = await Promise.all([
    supabaseServiceRole.from('restaurant_customers').select('*').eq('id', sourceCustomerId).single(),
    supabaseServiceRole.from('restaurant_customers').select('*').eq('id', targetCustomerId).single()
  ])

  if (sourceResult.error || targetResult.error) {
    throw new Error('Failed to fetch customer data')
  }

  const source = sourceResult.data
  const target = targetResult.data

  // Check for conflicts
  const conflicts: CustomerMergeConflict[] = []
  
  // Check phone conflicts
  if (source.guest_phone && target.guest_phone && source.guest_phone !== target.guest_phone) {
    conflicts.push({
      field: 'phone',
      sourceValue: source.guest_phone,
      targetValue: target.guest_phone,
      resolution: 'target'
    })
  }

  // Check email conflicts
  if (source.guest_email && target.guest_email && source.guest_email !== target.guest_email) {
    conflicts.push({
      field: 'email',
      sourceValue: source.guest_email,
      targetValue: target.guest_email,
      resolution: 'target'
    })
  }

  // Check name conflicts
  if (source.guest_name && target.guest_name && source.guest_name !== target.guest_name) {
    conflicts.push({
      field: 'name',
      sourceValue: source.guest_name,
      targetValue: target.guest_name,
      resolution: 'target'
    })
  }

  // Count bookings to be merged
  const { count: bookingCount } = await supabaseServiceRole
    .from('restaurant_bookings')
    .select('id', { count: 'exact' })
    .eq('customer_id', sourceCustomerId)

  return {
    conflicts,
    bookingCount: bookingCount || 0,
    estimatedDuration: bookingCount && bookingCount > 10 ? '2-3 minutes' : '30 seconds'
  }
}

export async function mergeCustomers(
  sourceCustomerId: string,
  targetCustomerId: string,
  options: CustomerMergeOptions,
  conflictResolutions: Record<string, string>
): Promise<void> {
  try {
    // Start transaction-like operations
    
    // 1. Update bookings to point to target customer
    if (options.mergeBookingHistory) {
      await supabaseServiceRole
        .from('restaurant_bookings')
        .update({ customer_id: targetCustomerId })
        .eq('customer_id', sourceCustomerId)
    }

    // 2. Merge customer data based on conflict resolutions
    const updateData: Partial<RestaurantCustomer> = {}
    
    for (const [field, value] of Object.entries(conflictResolutions)) {
      if (field === 'phone' && options.mergeContactInfo) {
        updateData.guest_phone = value
      } else if (field === 'email' && options.mergeContactInfo) {
        updateData.guest_email = value
      } else if (field === 'name') {
        updateData.guest_name = value
      }
    }

    if (Object.keys(updateData).length > 0) {
      await supabaseServiceRole
        .from('restaurant_customers')
        .update(updateData)
        .eq('id', targetCustomerId)
    }

    // 3. Delete source customer
    await supabaseServiceRole
      .from('restaurant_customers')
      .delete()
      .eq('id', sourceCustomerId)

  } catch (error) {
    throw new Error(`Failed to merge customers: ${error}`)
  }
}

export async function findPotentialDuplicates(restaurantId: string): Promise<RestaurantCustomer[]> {
  const { data, error } = await supabaseServiceRole
    .from('restaurant_customers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })

  if (error) throw error

  // Simple duplicate detection based on phone or email
  const seen = new Set<string>()
  const duplicates: RestaurantCustomer[] = []

  for (const customer of data || []) {
    const key = customer.guest_phone || customer.guest_email
    if (key && seen.has(key)) {
      duplicates.push(customer)
    } else if (key) {
      seen.add(key)
    }
  }

  return duplicates
}