'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ============================================
// Types
// ============================================

export interface CustomerData {
  id: string
  restaurant_id: string
  user_id: string | null
  guest_name: string | null
  guest_email: string | null
  guest_phone: string | null
  first_visit: string | null
  last_visit: string | null
  total_bookings: number
  vip_status: boolean
  blacklisted: boolean
  notes: string | null
  source: string | null
  created_at: string
  updated_at: string
  profile?: {
    id: string
    full_name: string | null
    phone_number: string | null
    avatar_url: string | null
  } | null
  tags?: Array<{
    tag: {
      id: string
      name: string
      color: string
    }
  }>
}

export interface CreateCustomerInput {
  restaurantId: string
  name: string
  email?: string
  phone?: string
  notes?: string
  tags?: string[]
  isVip?: boolean
}

export interface ImportResult {
  success: boolean
  inserted: number
  updated: number
  failed: number
  total: number
  message: string
  parseErrors?: string[]
}

// ============================================
// Helper: Verify staff access
// ============================================

async function verifyStaffAccess(restaurantId: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized', user: null, staff: null }
  }

  const { data: staff, error: staffError } = await supabase
    .from('restaurant_staff')
    .select('id, role, permissions')
    .eq('user_id', user.id)
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .single()

  if (staffError || !staff) {
    return { error: 'Access denied', user: null, staff: null }
  }

  return { error: null, user, staff }
}

// ============================================
// CSV Parser Helper
// ============================================

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]
    
    if (char === '"' && !inQuotes) {
      inQuotes = true
    } else if (char === '"' && inQuotes) {
      if (nextChar === '"') {
        current += '"'
        i++
      } else {
        inQuotes = false
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

// ============================================
// Server Actions
// ============================================

/**
 * Get all customers for a restaurant
 */
export async function getCustomers(
  restaurantId: string,
  search?: string
): Promise<{ customers: CustomerData[] | null; error: string | null }> {
  const { error: accessError } = await verifyStaffAccess(restaurantId)
  if (accessError) {
    return { customers: null, error: accessError }
  }

  const supabase = await createClient()

  let query = supabase
    .from('restaurant_customers')
    .select(`
      *,
      profile:profiles!restaurant_customers_user_id_fkey(*),
      tags:customer_tag_assignments(
        tag:customer_tags(*)
      )
    `)
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })

  if (search && search.trim()) {
    query = query.or(
      `guest_name.ilike.%${search}%,guest_email.ilike.%${search}%,guest_phone.ilike.%${search}%`
    )
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching customers:', error)
    return { customers: null, error: 'Failed to fetch customers' }
  }

  return { customers: data as CustomerData[], error: null }
}

/**
 * Create a new customer manually
 */
export async function createCustomer(
  input: CreateCustomerInput
): Promise<{ customer: CustomerData | null; error: string | null }> {
  const { restaurantId, name, email, phone, notes, tags, isVip } = input

  if (!restaurantId || !name?.trim()) {
    return { customer: null, error: 'Restaurant ID and Name are required' }
  }

  const { error: accessError, user } = await verifyStaffAccess(restaurantId)
  if (accessError || !user) {
    return { customer: null, error: accessError || 'Unauthorized' }
  }

  const supabase = await createClient()

  // Create customer
  const { data: customer, error: createError } = await supabase
    .from('restaurant_customers')
    .insert({
      restaurant_id: restaurantId,
      guest_name: name.trim(),
      guest_email: email?.trim() || null,
      guest_phone: phone?.trim() || null,
      notes: notes?.trim() || null,
      source: 'manual',
      vip_status: isVip || false,
      first_visit: null,
      total_bookings: 0
    })
    .select()
    .single()

  if (createError) {
    console.error('Create customer error:', createError)
    return { customer: null, error: 'Failed to create customer' }
  }

  // Handle tags
  if (tags && tags.length > 0) {
    const tagAssignments = tags.map((tagId: string) => ({
      customer_id: customer.id,
      tag_id: tagId,
      assigned_by: user.id
    }))

    const { error: tagError } = await supabase
      .from('customer_tag_assignments')
      .insert(tagAssignments)

    if (tagError) {
      console.error('Tag assignment error:', tagError)
    }
  }

  // Add note to customer_notes table as well
  if (notes?.trim()) {
    const { error: noteError } = await supabase
      .from('customer_notes')
      .insert({
        customer_id: customer.id,
        note: notes.trim(),
        category: 'general',
        created_by: user.id
      })

    if (noteError) {
      console.error('Note creation error:', noteError)
    }
  }

  revalidatePath('/customers')
  return { customer: customer as CustomerData, error: null }
}

/**
 * Import customers from CSV content
 */
export async function importCustomersFromCSV(
  restaurantId: string,
  csvContent: string
): Promise<ImportResult> {
  const { error: accessError } = await verifyStaffAccess(restaurantId)
  if (accessError) {
    return {
      success: false,
      inserted: 0,
      updated: 0,
      failed: 0,
      total: 0,
      message: accessError
    }
  }

  const supabase = await createClient()

  const lines = csvContent.split(/\r?\n/).filter(line => line.trim())
  
  if (lines.length < 2) {
    return {
      success: false,
      inserted: 0,
      updated: 0,
      failed: 0,
      total: 0,
      message: 'CSV must have headers and at least one data row'
    }
  }
  
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim())
  
  const customersToUpsert: any[] = []
  const parseErrors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i])
    if (row.length === 0 || (row.length === 1 && !row[0])) continue

    const customerData: any = {
      restaurant_id: restaurantId,
      source: 'import',
      total_bookings: 0
    }

    headers.forEach((header, index) => {
      const value = row[index]?.trim()
      if (!value) return

      if (header.includes('name')) customerData.guest_name = value
      else if (header.includes('email')) {
        if (value.includes('@')) {
          customerData.guest_email = value.toLowerCase()
        }
      }
      else if (header.includes('phone')) customerData.guest_phone = value
      else if (header.includes('note')) customerData.notes = value
      else if (header.includes('vip')) customerData.vip_status = ['true', 'yes', '1'].includes(value.toLowerCase())
    })

    if (customerData.guest_name) {
      customersToUpsert.push(customerData)
    } else {
      parseErrors.push(`Row ${i + 1}: Missing name`)
    }
  }

  if (customersToUpsert.length === 0) {
    return {
      success: false,
      inserted: 0,
      updated: 0,
      failed: 0,
      total: 0,
      message: 'No valid customers found in CSV',
      parseErrors: parseErrors.slice(0, 10)
    }
  }

  let insertedCount = 0
  let updatedCount = 0
  let failedCount = 0
  
  for (const customer of customersToUpsert) {
    let existingQuery = supabase
      .from('restaurant_customers')
      .select('id')
      .eq('restaurant_id', restaurantId)
    
    const orConditions: string[] = []
    if (customer.guest_email) {
      orConditions.push(`guest_email.eq.${customer.guest_email}`)
    }
    if (customer.guest_phone) {
      orConditions.push(`guest_phone.eq.${customer.guest_phone}`)
    }
    
    let existingCustomer = null
    if (orConditions.length > 0) {
      const { data } = await existingQuery.or(orConditions.join(',')).maybeSingle()
      existingCustomer = data
    }
    
    if (existingCustomer) {
      const { error } = await supabase
        .from('restaurant_customers')
        .update({
          guest_name: customer.guest_name,
          notes: customer.notes,
          vip_status: customer.vip_status,
        })
        .eq('id', existingCustomer.id)
      
      if (error) {
        failedCount++
      } else {
        updatedCount++
      }
    } else {
      const { error } = await supabase
        .from('restaurant_customers')
        .insert(customer)
      
      if (error) {
        console.error('Insert error for customer:', customer.guest_name, error)
        failedCount++
      } else {
        insertedCount++
      }
    }
  }

  revalidatePath('/customers')

  return {
    success: insertedCount + updatedCount > 0,
    inserted: insertedCount,
    updated: updatedCount,
    failed: failedCount,
    total: customersToUpsert.length,
    message: `Import complete: ${insertedCount} new, ${updatedCount} updated, ${failedCount} failed`
  }
}

/**
 * Update a customer
 */
export async function updateCustomer(
  customerId: string,
  restaurantId: string,
  updates: Partial<{
    guest_name: string
    guest_email: string
    guest_phone: string
    notes: string
    vip_status: boolean
    blacklisted: boolean
  }>
): Promise<{ success: boolean; error: string | null }> {
  const { error: accessError } = await verifyStaffAccess(restaurantId)
  if (accessError) {
    return { success: false, error: accessError }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('restaurant_customers')
    .update(updates)
    .eq('id', customerId)
    .eq('restaurant_id', restaurantId)

  if (error) {
    console.error('Update customer error:', error)
    return { success: false, error: 'Failed to update customer' }
  }

  revalidatePath('/customers')
  return { success: true, error: null }
}

/**
 * Delete a customer
 */
export async function deleteCustomer(
  customerId: string,
  restaurantId: string
): Promise<{ success: boolean; error: string | null }> {
  const { error: accessError } = await verifyStaffAccess(restaurantId)
  if (accessError) {
    return { success: false, error: accessError }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('restaurant_customers')
    .delete()
    .eq('id', customerId)
    .eq('restaurant_id', restaurantId)

  if (error) {
    console.error('Delete customer error:', error)
    return { success: false, error: 'Failed to delete customer' }
  }

  revalidatePath('/customers')
  return { success: true, error: null }
}

/**
 * Merge two customers
 * Rules:
 * - At least one customer must be a guest (no user_id)
 * - Cannot merge two registered users
 * - Guest data is merged into the target customer
 */
export async function mergeCustomers(
  targetCustomerId: string,
  sourceCustomerId: string,
  restaurantId: string,
  contactOverrides?: { guest_email?: string; guest_phone?: string }
): Promise<{ success: boolean; error: string | null }> {
  // Validate inputs
  if (!targetCustomerId || !sourceCustomerId || !restaurantId) {
    return { success: false, error: 'Missing required fields' }
  }

  if (targetCustomerId === sourceCustomerId) {
    return { success: false, error: 'Cannot merge a customer with itself' }
  }

  // Verify access with permission check
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { data: staffData } = await supabase
    .from('restaurant_staff')
    .select('role, permissions')
    .eq('user_id', user.id)
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .single()

  if (!staffData) {
    return { success: false, error: 'Insufficient permissions' }
  }

  // Owners have full access, others need specific permission
  const hasPermission = staffData.role === 'owner' || 
    (staffData.permissions && staffData.permissions.includes('customers.manage'))
  
  if (!hasPermission) {
    return { success: false, error: 'Insufficient permissions' }
  }

  // Fetch both customers
  const { data: customers, error: fetchError } = await supabase
    .from('restaurant_customers')
    .select(`
      *,
      profile:profiles!restaurant_customers_user_id_fkey(*)
    `)
    .in('id', [targetCustomerId, sourceCustomerId])
    .eq('restaurant_id', restaurantId)

  if (fetchError) {
    console.error('Customer fetch error:', fetchError)
    return { success: false, error: 'Failed to fetch customers' }
  }

  if (!customers || customers.length !== 2) {
    return { success: false, error: 'One or both customers not found' }
  }

  const targetCustomer = customers.find((c: any) => c.id === targetCustomerId)
  const sourceCustomer = customers.find((c: any) => c.id === sourceCustomerId)

  if (!targetCustomer || !sourceCustomer) {
    return { success: false, error: 'Customers not found' }
  }

  // Validate merge rules: cannot merge two registered users
  if (targetCustomer.user_id && sourceCustomer.user_id) {
    return { success: false, error: 'Cannot merge two registered users' }
  }

  // Try using the RPC function first for atomic merge
  const { error: mergeError } = await supabase.rpc('merge_customers', {
    p_target_customer_id: targetCustomerId,
    p_source_customer_id: sourceCustomerId,
    p_restaurant_id: restaurantId
  })

  if (mergeError) {
    console.error('RPC merge error, attempting manual merge:', mergeError)
    
    // Fallback to manual merge
    const manualResult = await performManualMerge(supabase, targetCustomer, sourceCustomer, contactOverrides)
    if (!manualResult.success) {
      return { success: false, error: manualResult.error }
    }
  } else if (contactOverrides) {
    // RPC succeeded but we still need to apply contact overrides
    const overrideUpdate: Record<string, string> = {}
    if (contactOverrides.guest_email !== undefined) overrideUpdate.guest_email = contactOverrides.guest_email
    if (contactOverrides.guest_phone !== undefined) overrideUpdate.guest_phone = contactOverrides.guest_phone
    if (Object.keys(overrideUpdate).length > 0) {
      await supabase
        .from('restaurant_customers')
        .update(overrideUpdate)
        .eq('id', targetCustomerId)
    }
  }

  revalidatePath('/customers')
  return { success: true, error: null }
}

/**
 * Manual merge fallback when RPC function is not available
 */
async function performManualMerge(
  supabase: any,
  targetCustomer: any,
  sourceCustomer: any,
  contactOverrides?: { guest_email?: string; guest_phone?: string }
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Combine numeric fields
    const mergedData = {
      total_bookings: targetCustomer.total_bookings + sourceCustomer.total_bookings,
      total_spent: Number(targetCustomer.total_spent || 0) + Number(sourceCustomer.total_spent || 0),
      no_show_count: (targetCustomer.no_show_count || 0) + (sourceCustomer.no_show_count || 0),
      cancelled_count: (targetCustomer.cancelled_count || 0) + (sourceCustomer.cancelled_count || 0),
      
      // Take the earliest first visit
      first_visit: targetCustomer.first_visit && sourceCustomer.first_visit 
        ? new Date(Math.min(
            new Date(targetCustomer.first_visit).getTime(), 
            new Date(sourceCustomer.first_visit).getTime()
          )).toISOString()
        : targetCustomer.first_visit || sourceCustomer.first_visit,
      
      // Take the latest last visit
      last_visit: targetCustomer.last_visit && sourceCustomer.last_visit 
        ? new Date(Math.max(
            new Date(targetCustomer.last_visit).getTime(), 
            new Date(sourceCustomer.last_visit).getTime()
          )).toISOString()
        : targetCustomer.last_visit || sourceCustomer.last_visit,
      
      // Calculate new average party size
      average_party_size: targetCustomer.total_bookings + sourceCustomer.total_bookings > 0
        ? ((Number(targetCustomer.average_party_size || 0) * targetCustomer.total_bookings) +
           (Number(sourceCustomer.average_party_size || 0) * sourceCustomer.total_bookings)) /
          (targetCustomer.total_bookings + sourceCustomer.total_bookings)
        : 0,

      // Preserve important flags (VIP status, blacklist)
      vip_status: targetCustomer.vip_status || sourceCustomer.vip_status,
      blacklisted: targetCustomer.blacklisted || sourceCustomer.blacklisted,
      blacklist_reason: targetCustomer.blacklist_reason || sourceCustomer.blacklist_reason,
    
      // Merge preferences (target customer takes precedence)
      preferred_table_types: targetCustomer.preferred_table_types || sourceCustomer.preferred_table_types,
      preferred_time_slots: targetCustomer.preferred_time_slots || sourceCustomer.preferred_time_slots,
    
      // If target customer doesn't have contact info but source does, use source
      guest_name: targetCustomer.guest_name || sourceCustomer.guest_name,
      guest_email: contactOverrides?.guest_email ?? targetCustomer.guest_email ?? sourceCustomer.guest_email,
      guest_phone: contactOverrides?.guest_phone ?? targetCustomer.guest_phone ?? sourceCustomer.guest_phone,

      updated_at: new Date().toISOString()
    }

    // Update target customer with merged data
    const { error: updateError } = await supabase
      .from('restaurant_customers')
      .update(mergedData)
      .eq('id', targetCustomer.id)

    if (updateError) {
      throw updateError
    }

    // Transfer related records to target customer
    
    // Transfer bookings by updating guest info
    await supabase
      .from('bookings')
      .update({ 
        guest_name: targetCustomer.guest_name || sourceCustomer.guest_name,
        guest_email: targetCustomer.guest_email || sourceCustomer.guest_email,
        guest_phone: targetCustomer.guest_phone || sourceCustomer.guest_phone
      })
      .match({
        guest_name: sourceCustomer.guest_name,
        guest_email: sourceCustomer.guest_email,
        restaurant_id: targetCustomer.restaurant_id
      })

    // Transfer customer notes
    await supabase
      .from('customer_notes')
      .update({ customer_id: targetCustomer.id })
      .eq('customer_id', sourceCustomer.id)

    // Transfer customer tag assignments
    await supabase
      .from('customer_tag_assignments')
      .update({ customer_id: targetCustomer.id })
      .eq('customer_id', sourceCustomer.id)

    // Transfer customer preferences
    await supabase
      .from('customer_preferences')
      .update({ customer_id: targetCustomer.id })
      .eq('customer_id', sourceCustomer.id)

    // Transfer customer relationships
    await supabase
      .from('customer_relationships')
      .update({ customer_id: targetCustomer.id })
      .eq('customer_id', sourceCustomer.id)

    await supabase
      .from('customer_relationships')
      .update({ related_customer_id: targetCustomer.id })
      .eq('related_customer_id', sourceCustomer.id)

    // Finally, delete the source customer
    const { error: deleteError } = await supabase
      .from('restaurant_customers')
      .delete()
      .eq('id', sourceCustomer.id)

    if (deleteError) {
      throw deleteError
    }

    return { success: true, error: null }
  } catch (error) {
    console.error('Manual merge error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to merge customers' 
    }
  }
}
