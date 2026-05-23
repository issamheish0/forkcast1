import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { APIError, ErrorType } from '@/lib/utils/error-handler'
import { RestaurantStaff } from '@/types'

// Permission definitions
export const PERMISSIONS = {
  // Booking permissions
  'bookings.view': 'View bookings',
  'bookings.create': 'Create new bookings',
  'bookings.edit': 'Edit existing bookings',
  'bookings.delete': 'Delete/cancel bookings',
  'bookings.manage': 'Accept/decline booking requests',
  'bookings.checkin': 'Check in guests',
  
  // Customer permissions
  'customers.view': 'View customer data',
  'customers.edit': 'Edit customer profiles',
  'customers.notes': 'Add/edit customer notes',
  'customers.tags': 'Manage customer tags',
  'customers.delete': 'Delete customer data',
  
  // Table permissions
  'tables.view': 'View table layout',
  'tables.edit': 'Edit table configuration',
  'tables.assign': 'Assign tables to bookings',
  
  // Menu permissions
  'menu.view': 'View menu items',
  'menu.edit': 'Edit menu items and categories',
  'menu.delete': 'Delete menu items',
  
  // Staff permissions
  'staff.view': 'View staff members',
  'staff.invite': 'Invite new staff members',
  'staff.edit': 'Edit staff permissions',
  'staff.remove': 'Remove staff members',
  
  // Analytics permissions
  'analytics.view': 'View restaurant analytics',
  'analytics.export': 'Export analytics data',
  
  // Restaurant settings
  'restaurant.edit': 'Edit restaurant settings',
  'restaurant.hours': 'Manage operating hours',
  'restaurant.closures': 'Manage restaurant closures',
  
  // Loyalty program
  'loyalty.view': 'View loyalty program data',
  'loyalty.manage': 'Manage loyalty rules and rewards',
  
  // VIP management
  'vip.view': 'View VIP customers',
  'vip.manage': 'Manage VIP status and benefits'
} as const

export type Permission = keyof typeof PERMISSIONS

// Role-based default permissions
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: Object.keys(PERMISSIONS) as Permission[], // All permissions
  manager: [
    'bookings.view', 'bookings.create', 'bookings.edit', 'bookings.manage', 'bookings.checkin',
    'customers.view', 'customers.edit', 'customers.notes', 'customers.tags',
    'tables.view', 'tables.edit', 'tables.assign',
    'menu.view', 'menu.edit',
    'staff.view', 'staff.invite', 'staff.edit',
    'analytics.view', 'analytics.export',
    'restaurant.hours', 'restaurant.closures',
    'loyalty.view', 'loyalty.manage',
    'vip.view', 'vip.manage'
  ],
  staff: [
    'bookings.view', 'bookings.create', 'bookings.manage', 'bookings.checkin',
    'customers.view', 'customers.notes',
    'tables.view', 'tables.assign',
    'menu.view',
    'vip.view'
  ],
  viewer: [
    'bookings.view',
    'customers.view', 
    'tables.view',
    'menu.view',
    'analytics.view'
  ]
}

// Authentication and authorization result interface
export interface AuthResult {
  user: {
    id: string
    email: string
    full_name?: string
  }
  staff: RestaurantStaff & {
    restaurant: {
      id: string
      name: string
      status: string
    }
  }
  permissions: Permission[]
}

// Rate limiting interface
interface RateLimitInfo {
  count: number
  resetTime: number
}

// Simple in-memory rate limiter (use Redis in production)
const rateLimitStore = new Map<string, RateLimitInfo>()

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, info] of rateLimitStore.entries()) {
    if (now > info.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Clean up every minute

// Rate limiting function
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const windowStart = now - windowMs
  
  const existing = rateLimitStore.get(identifier)
  
  if (!existing || now > existing.resetTime) {
    // New window or expired
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs
    })
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: now + windowMs
    }
  }
  
  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: existing.resetTime
    }
  }
  
  // Increment count
  existing.count++
  rateLimitStore.set(identifier, existing)
  
  return {
    allowed: true,
    remaining: maxRequests - existing.count,
    resetTime: existing.resetTime
  }
}

// Comprehensive authentication and authorization
export async function authenticateAndAuthorize(
  request: NextRequest,
  requiredPermissions: Permission[] = []
): Promise<AuthResult> {
  const supabase = await createClient()
  
  // Extract IP for rate limiting
  const clientIP = request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown'
  
  // Check rate limit
  const rateLimitKey = `api:${clientIP}`
  const rateLimit = checkRateLimit(rateLimitKey, 200, 60000) // 200 requests per minute
  
  if (!rateLimit.allowed) {
    throw new APIError(
      ErrorType.RATE_LIMIT,
      'Rate limit exceeded. Please try again later.',
      429,
      { 
        resetTime: rateLimit.resetTime,
        identifier: rateLimitKey 
      }
    )
  }
  
  // Verify user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new APIError(
      ErrorType.AUTHENTICATION,
      'Authentication required. Please log in.',
      401
    )
  }
  
  // Check if user is active (not banned/suspended)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, user_rating')
    .eq('id', user.id)
    .single()
  
  if (profileError || !profile) {
    throw new APIError(
      ErrorType.AUTHENTICATION,
      'Invalid user profile.',
      401
    )
  }
  
  // Check user rating (suspend access for very low ratings)
  if (profile.user_rating < 2.0) {
    throw new APIError(
      ErrorType.AUTHORIZATION,
      'Account suspended due to low rating. Please contact support.',
      403,
      { reason: 'low_rating', rating: profile.user_rating }
    )
  }
  
  // Get staff data with restaurant info
  const { data: staff, error: staffError } = await supabase
    .from('restaurant_staff')
    .select(`
      *,
      restaurant:restaurants!restaurant_staff_restaurant_id_fkey(
        id,
        name,
        status
      )
    `)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  
  if (staffError || !staff) {
    throw new APIError(
      ErrorType.AUTHORIZATION,
      'Access denied. You are not associated with any restaurant.',
      403,
      { reason: 'not_restaurant_staff' }
    )
  }
  
  // Check if restaurant is active
  if (staff.restaurant.status !== 'active') {
    throw new APIError(
      ErrorType.AUTHORIZATION,
      `Restaurant is currently ${staff.restaurant.status}. Access restricted.`,
      403,
      { reason: 'restaurant_inactive', status: staff.restaurant.status }
    )
  }
  
  // Build user permissions from role and explicit permissions
  const rolePermissions = ROLE_PERMISSIONS[staff.role] || []
  const explicitPermissions = (staff.permissions || []) as Permission[]
  const userPermissions = [...new Set([...rolePermissions, ...explicitPermissions])]
  
  // Check required permissions
  if (requiredPermissions.length > 0) {
    const missingPermissions = requiredPermissions.filter(
      permission => !userPermissions.includes(permission)
    )
    
    if (missingPermissions.length > 0) {
      throw new APIError(
        ErrorType.AUTHORIZATION,
        `Insufficient permissions. Missing: ${missingPermissions.join(', ')}`,
        403,
        { 
          reason: 'insufficient_permissions',
          required: requiredPermissions,
          missing: missingPermissions,
          current: userPermissions
        }
      )
    }
  }
  
  return {
    user: {
      id: user.id,
      email: user.email!,
      full_name: profile.full_name
    },
    staff: {
      ...staff,
      restaurant: staff.restaurant
    } as AuthResult['staff'],
    permissions: userPermissions
  }
}

// Check specific permission
export function hasPermission(
  userPermissions: Permission[],
  requiredPermission: Permission
): boolean {
  return userPermissions.includes(requiredPermission)
}

// Check multiple permissions (all required)
export function hasAllPermissions(
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.every(permission => 
    userPermissions.includes(permission)
  )
}

// Check multiple permissions (any one required)
export function hasAnyPermission(
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.some(permission => 
    userPermissions.includes(permission)
  )
}

// Validate restaurant ownership for sensitive operations
export async function validateRestaurantAccess(
  staffId: string,
  restaurantId: string,
  requiredRole: string[] = ['owner', 'manager']
): Promise<boolean> {
  const supabase = await createClient()
  
  const { data: staff, error } = await supabase
    .from('restaurant_staff')
    .select('role, restaurant_id, is_active')
    .eq('id', staffId)
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .single()
  
  if (error || !staff) {
    return false
  }
  
  return requiredRole.includes(staff.role)
}

// Input sanitization helpers
export function sanitizeString(input: string, maxLength: number = 500): string {
  return input
    .trim()
    .replace(/[<>\"']/g, '') // Remove potentially dangerous characters
    .substring(0, maxLength)
}

export function sanitizeEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const sanitized = email.trim().toLowerCase()
  
  return emailRegex.test(sanitized) ? sanitized : null
}

export function sanitizePhoneNumber(phone: string): string | null {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/
  const sanitized = phone.trim().replace(/\s/g, '')
  
  return phoneRegex.test(sanitized) && sanitized.length >= 10 ? sanitized : null
}

// Log security events
export function logSecurityEvent(
  event: string,
  details: {
    userId?: string
    staffId?: string
    restaurantId?: string
    ip?: string
    userAgent?: string
    severity?: 'low' | 'medium' | 'high' | 'critical'
    metadata?: Record<string, any>
  }
) {
  const logEntry = {
    event,
    timestamp: new Date().toISOString(),
    severity: details.severity || 'medium',
    ...details
  }
  
  // In production, send to security monitoring service
  console.warn('Security Event:', JSON.stringify(logEntry, null, 2))
  
  // For critical events, you might want to trigger alerts
  if (details.severity === 'critical') {
    // Trigger alert system
    console.error('CRITICAL SECURITY EVENT:', logEntry)
  }
}

// Middleware helper for API routes
export function withAuth(requiredPermissions: Permission[] = []) {
  return async function (
    request: NextRequest,
    handler: (request: NextRequest, auth: AuthResult) => Promise<Response>
  ): Promise<Response> {
    try {
      const auth = await authenticateAndAuthorize(request, requiredPermissions)
      return await handler(request, auth)
    } catch (error) {
      if (error instanceof APIError) {
        // Log security events
        if (error.type === ErrorType.AUTHENTICATION || error.type === ErrorType.AUTHORIZATION) {
          logSecurityEvent('access_denied', {
            ip: request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
            severity: 'medium',
            metadata: {
              endpoint: request.url,
              reason: error.message
            }
          })
        }
        
        return new Response(JSON.stringify({
          error: error.message,
          type: error.type
        }), {
          status: error.statusCode,
          headers: {
            'Content-Type': 'application/json'
          }
        })
      }
      
      console.error('Auth middleware error:', error)
      return new Response(JSON.stringify({
        error: 'Internal server error'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      })
    }
  }
}