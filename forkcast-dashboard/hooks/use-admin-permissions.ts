import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Module-level cache — survives SPA navigations, cleared on sign-out
type CachedResult = { permissions: AdminPermissions | null; role: AdminRole | null; isSuperAdmin: boolean }
let _cache: CachedResult | null = null
let _cachePromise: Promise<CachedResult> | null = null

export function clearAdminPermissionsCache() {
  _cache = null
  _cachePromise = null
}

export interface AdminPermissions {
  admin_id: string
  allowed_sections: string[]
  booking_field_visibility: {
    name?: boolean
    email?: boolean
    phone?: boolean
    notes?: boolean
    [key: string]: boolean | undefined
  }
  booking_actions?: {
    can_accept_decline?: boolean
    [key: string]: boolean | undefined
  }
  created_at?: string
  updated_at?: string
}

export interface AdminRole {
  id: string
  user_id: string
  role: 'super_admin' | 'admin' | 'support'
  created_at?: string
}

export function useAdminPermissions() {
  const [permissions, setPermissions] = useState<AdminPermissions | null>(null)
  const [role, setRole] = useState<AdminRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const fetchPermissions = async () => {
      // Return cached result immediately if available
      if (_cache) {
        setRole(_cache.role)
        setIsSuperAdmin(_cache.isSuperAdmin)
        setPermissions(_cache.permissions)
        setLoading(false)
        return
      }

      // Deduplicate concurrent calls (e.g. layout + page both mounting at once)
      if (!_cachePromise) {
        _cachePromise = (async (): Promise<CachedResult> => {
          const { data: { user }, error: userError } = await supabase.auth.getUser()
          if (userError || !user) return { permissions: null, role: null, isSuperAdmin: false }

          const { data: adminData, error: adminError } = await supabase
            .from('rbs_admins')
            .select('id, user_id, role, created_at')
            .eq('user_id', user.id)
            .single()

          if (adminError || !adminData) return { permissions: null, role: null, isSuperAdmin: false }

          const superAdmin = adminData.role === 'super_admin'

          const { data: permData, error: permError } = await supabase
            .from('admin_permissions')
            .select('*')
            .eq('admin_id', adminData.id)
            .single()

          if (permError && permError.code !== 'PGRST116') {
            console.error('Error fetching permissions:', permError)
          }

          let resolvedPermissions: AdminPermissions | null = permData as AdminPermissions | null
          if (!resolvedPermissions && superAdmin) {
            resolvedPermissions = {
              admin_id: adminData.id,
              allowed_sections: ['*'],
              booking_field_visibility: { name: true, email: true, phone: true, notes: true },
              booking_actions: { can_accept_decline: true },
            }
          }

          return { permissions: resolvedPermissions, role: adminData as AdminRole, isSuperAdmin: superAdmin }
        })()
      }

      try {
        const result = await _cachePromise
        _cache = result
        setRole(result.role)
        setIsSuperAdmin(result.isSuperAdmin)
        setPermissions(result.permissions)
      } catch (error) {
        console.error('Error fetching admin permissions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPermissions()
  }, [supabase])

  const hasSectionAccess = (section: string): boolean => {
    if (!permissions) return false
    if (isSuperAdmin) return true
    return permissions.allowed_sections.includes('*') || permissions.allowed_sections.includes(section)
  }

  const canSeeField = (field: string): boolean => {
    if (!permissions) return false
    if (isSuperAdmin) return true
    return permissions.booking_field_visibility[field] === true
  }

  const canPerformAction = (action: string): boolean => {
    if (!permissions) return false
    if (isSuperAdmin) return true
    return permissions.booking_actions?.[action] === true
  }

  return {
    permissions,
    role,
    loading,
    isSuperAdmin,
    hasSectionAccess,
    canSeeField,
    canPerformAction,
  }
}


