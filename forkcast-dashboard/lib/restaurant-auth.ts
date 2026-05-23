// lib/restaurant-auth.ts
import { createClient } from '@/lib/supabase/client'

export type Role = 'owner' | 'manager' | 'staff' | 'viewer'

export interface AddStaffMemberData {
  fullName: string
  email: string
  phoneNumber?: string
  role: Role
  permissions: string[]
}

export interface StaffMember {
  id: string
  role: Role
  permissions: string[]
  is_active: boolean
  hired_at: string
  last_login_at: string | null
  user: {
    id: string
    full_name: string
    email: string
    phone_number: string | null
    avatar_url: string | null
  }
}

class RestaurantAuth {
  private supabase = createClient()

  // Default permissions by role
  getDefaultPermissions(role: Role): string[] {
    const permissions = {
      owner: [
        'bookings.view', 'bookings.manage',
        'menu.view', 'menu.manage',
        'tables.view', 'tables.manage',
        'customers.view', 'customers.manage',
        'analytics.view',
        'settings.view', 'settings.manage',
        'staff.manage',
        'schedules.view', 'schedules.manage',
        // Additional feature areas
        'reviews.view', 'reviews.manage',
        'loyalty.view', 'loyalty.manage',
        'offers.view', 'offers.manage',
        'vip.view', 'vip.manage'
      ],
      manager: [
        'bookings.view', 'bookings.manage',
        'menu.view', 'menu.manage',
        'tables.view', 'tables.manage',
        'customers.view', 'customers.manage',
        'analytics.view',
        'settings.view',
        'schedules.view', 'schedules.manage',
        'reviews.view', 'reviews.manage',
        'loyalty.view', 'loyalty.manage',
        'offers.view', 'offers.manage',
        'vip.view'
      ],
      staff: [
        'bookings.view', 'bookings.manage',
        'menu.view',
        'tables.view',
        'customers.view',
        'schedules.view',
        'reviews.view',
        'loyalty.view',
        'offers.view'
      ],
      viewer: [
        'bookings.view',
        'menu.view',
        'tables.view',
        'customers.view',
        'schedules.view'
      ]
    }
    return permissions[role] || []
  }

  // Check if user has permission
  hasPermission(userPermissions: string[], requiredPermission: string, userRole: Role): boolean {
    // Owners have all permissions
    if (userRole === 'owner') return true

    // Normalize: permissions may arrive as a non-array (e.g. JSONB object) from Supabase
    const perms = Array.isArray(userPermissions) ? userPermissions : []

    // Check if user has "all" permission
    if (perms.includes('all')) return true
    
    // Check if user has the specific permission
    return perms.includes(requiredPermission)
  }

  // Get restaurant staff
  async getRestaurantStaff(restaurantId: string): Promise<StaffMember[]> {
    const { data, error } = await this.supabase
      .from('restaurant_staff')
      .select(`
        id,
        role,
        permissions,
        is_active,
        hired_at,
        last_login_at,
        user_id,
        user:profiles!restaurant_staff_user_id_fkey(
          id,
          full_name,
          phone_number,
          avatar_url,
          email
        )
      `)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching restaurant staff:', error)
      throw new Error('Failed to fetch restaurant staff')
    }

    // If email is not in profiles, we'll fetch it from a separate API call if needed
    const staffWithEmails = data?.map(staff => ({
      ...staff,
      user: {
        ...staff.user,
        email: (staff.user as any)?.email || null // Use email from profiles if available
      }
    })) || []

    return staffWithEmails as any[]
  }

  // Add existing user as staff member (preferred method)
  async addExistingUserAsStaff(restaurantId: string, userId: string, role: Role, permissions: string[], createdBy: string): Promise<void> {
    try {
      // Check if they're already staff at this restaurant
      const { data: existingStaff } = await this.supabase
        .from('restaurant_staff')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('user_id', userId)
        .single()

      if (existingStaff) {
        throw new Error('This user is already a staff member at this restaurant')
      }

      // Add to restaurant staff
      const { error: staffError } = await this.supabase
        .from('restaurant_staff')
        .insert({
          restaurant_id: restaurantId,
          user_id: userId,
          role: role,
          permissions: permissions,
          created_by: createdBy,
          is_active: true
        })

      if (staffError) {
        console.error('Error adding staff member:', staffError)
        throw new Error('Failed to add staff member to restaurant')
      }

    } catch (error: any) {
      console.error('Error in addExistingUserAsStaff:', error)
      throw error
    }
  }

  // Add staff member (legacy method - creates new accounts, not recommended for client use)
  async addStaffMember(restaurantId: string, staffData: AddStaffMemberData, createdBy: string): Promise<void> {
    throw new Error('This method requires admin privileges. Use addExistingUserAsStaff instead.')
  }

  // Update staff member
  async updateStaffMember(staffId: string, updates: Partial<StaffMember>, updatedBy: string): Promise<void> {
    const { error } = await this.supabase
      .from('restaurant_staff')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', staffId)

    if (error) {
      console.error('Error updating staff member:', error)
      throw new Error('Failed to update staff member')
    }
  }

  // Remove staff member
  async removeStaffMember(staffId: string, removedBy: string): Promise<void> {
    const { error } = await this.supabase
      .from('restaurant_staff')
      .update({
        is_active: false,
        terminated_at: new Date().toISOString()
      })
      .eq('id', staffId)

    if (error) {
      console.error('Error removing staff member:', error)
      throw new Error('Failed to remove staff member')
    }
  }

  // Generate temporary password
  private generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const randomValues = new Uint32Array(12)
    crypto.getRandomValues(randomValues)
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(randomValues[i] % chars.length)
    }
    return password
  }

  // Send invitation email (placeholder - implement with your email service)
  private async sendInvitationEmail(email: string, name: string, restaurantId: string): Promise<void> {
    // Implement email sending logic here
    console.log(`Sending invitation email to ${email} for restaurant ${restaurantId}`)
  }
}

export const restaurantAuth = new RestaurantAuth()