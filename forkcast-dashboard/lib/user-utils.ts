// lib/user-utils.ts

import { createClient } from '@/lib/supabase/client'

/**
 * Utility functions for handling user data across the application
 * Handles the separation between auth.users (email) and profiles (other data)
 */

export const userUtils = {
  /**
   * Get user's email from profiles table
   * Note: supabase.auth.admin is only available server-side with service role key.
   * Fall back to looking up email from the profiles table instead.
   */
  async getUserEmail(userId: string): Promise<string | null> {
    const supabase = createClient()
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single()
      
      if (error || !data) {
        console.error('Error fetching user email:', error)
        return null
      }
      
      return data.email || null
    } catch (error) {
      console.error('Error in getUserEmail:', error)
      return null
    }
  },

  /**
   * Enrich profile data with email from auth.users
   * Useful for displaying complete user information
   */
  async enrichProfileWithEmail(profile: any): Promise<any> {
    if (!profile?.id) return profile
    
    const email = await this.getUserEmail(profile.id)
    
    return {
      ...profile,
      email
    }
  },

  /**
   * Enrich multiple profiles with emails
   * Uses profiles table email column instead of admin API
   */
  async enrichProfilesWithEmails(profiles: any[]): Promise<any[]> {
    const supabase = createClient()
    
    try {
      // Get all user IDs
      const userIds = profiles.map(p => p.id).filter(Boolean)
      
      if (userIds.length === 0) return profiles
      
      // Fetch emails from profiles table
      const { data: profileEmails, error } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds)
      
      if (error) {
        console.error('Error fetching profile emails:', error)
        return profiles
      }
      
      // Create email lookup map
      const emailMap = new Map()
      profileEmails?.forEach(p => {
        if (p.id && p.email) {
          emailMap.set(p.id, p.email)
        }
      })
      
      // Enrich profiles with emails
      return profiles.map(profile => ({
        ...profile,
        email: emailMap.get(profile.id) || null
      }))
      
    } catch (error) {
      console.error('Error enriching profiles with emails:', error)
      return profiles
    }
  },

  /**
   * Get contact information for a user
   * Handles both guest bookings and user bookings
   */
  getContactInfo(data: any): { email?: string; phone?: string; name?: string } {
    return {
      // For registered users, email comes from auth.users (not stored in profiles)
      // For guest bookings, email is stored in guest_email field
      email: data.guest_email || null, // Only guests have email stored locally
      phone: data.profile?.phone_number || data.guest_phone || null,
      name: data.profile?.full_name || data.guest_name || null
    }
  },

  /**
   * Format display name for a user
   */
  getDisplayName(user: any): string {
    if (user?.full_name) return user.full_name
    if (user?.guest_name) return user.guest_name
    if (user?.email) return user.email
    return 'Guest'
  },

  /**
   * Get initials for avatar display
   */
  getInitials(user: any): string {
    const name = this.getDisplayName(user)
    
    if (name === 'Guest') return 'G'
    
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
}
