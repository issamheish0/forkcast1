/**
 * Validation utilities for admin permissions API endpoints
 */

// Valid section names that can be assigned to admins
export const VALID_SECTIONS = [
  'dashboard',
  'restaurants',
  'restaurant_groups',
  'users',
  'restaurant_staff',
  'menu',
  'banners',
  'bookings',
  'availability',
  'reviews',
  'notifications',
  'reports',
  'ad_analytics',
  'events',
  'punch_cards',
  'settings',
  'audit_logs',
] as const

// Valid booking field names
export const VALID_BOOKING_FIELDS = ['name', 'email', 'phone', 'notes', 'preferred_section'] as const

// Valid booking action names
export const VALID_BOOKING_ACTIONS = ['can_accept_decline'] as const

/**
 * Validates that admin_id is a positive integer
 */
export function validateAdminId(adminId: any): number {
  if (adminId === null || adminId === undefined) {
    throw new Error('admin_id is required')
  }

  const num = typeof adminId === 'number' ? adminId : parseInt(String(adminId), 10)

  if (isNaN(num) || !Number.isInteger(num)) {
    throw new Error('admin_id must be a valid integer')
  }

  if (num <= 0) {
    throw new Error('admin_id must be a positive integer')
  }

  // Reasonable upper limit to prevent integer overflow issues
  if (num > Number.MAX_SAFE_INTEGER) {
    throw new Error('admin_id is too large')
  }

  return num
}

/**
 * Validates allowed_sections array
 */
export function validateAllowedSections(sections: any): string[] {
  if (!Array.isArray(sections)) {
    throw new Error('allowed_sections must be an array')
  }

  // Limit array size to prevent DoS
  if (sections.length > 100) {
    throw new Error('allowed_sections array is too large (max 100 items)')
  }

  // Validate each section name
  const validSections = new Set(VALID_SECTIONS)
  const validated: string[] = []

  for (const section of sections) {
    if (typeof section !== 'string') {
      throw new Error('Each section must be a string')
    }

    // Allow '*' for all sections (super admin)
    if (section === '*') {
      validated.push('*')
      continue
    }

    if (!validSections.has(section as any)) {
      throw new Error(`Invalid section name: ${section}. Valid sections are: ${VALID_SECTIONS.join(', ')}`)
    }

    validated.push(section)
  }

  return validated
}

/**
 * Validates booking_field_visibility object
 */
export function validateBookingFieldVisibility(visibility: any): Record<string, boolean> {
  if (!visibility || typeof visibility !== 'object' || Array.isArray(visibility)) {
    throw new Error('booking_field_visibility must be an object')
  }

  const validFields = new Set(VALID_BOOKING_FIELDS)
  const validated: Record<string, boolean> = {}

  for (const [key, value] of Object.entries(visibility)) {
    if (!validFields.has(key as any)) {
      throw new Error(`Invalid booking field: ${key}. Valid fields are: ${VALID_BOOKING_FIELDS.join(', ')}`)
    }

    if (typeof value !== 'boolean') {
      throw new Error(`booking_field_visibility.${key} must be a boolean`)
    }

    validated[key] = value
  }

  return validated
}

/**
 * Validates booking_actions object
 */
export function validateBookingActions(actions: any): Record<string, boolean> {
  if (!actions || typeof actions !== 'object' || Array.isArray(actions)) {
    throw new Error('booking_actions must be an object')
  }

  const validActions = new Set(VALID_BOOKING_ACTIONS)
  const validated: Record<string, boolean> = {}

  for (const [key, value] of Object.entries(actions)) {
    if (!validActions.has(key as any)) {
      throw new Error(`Invalid booking action: ${key}. Valid actions are: ${VALID_BOOKING_ACTIONS.join(', ')}`)
    }

    if (typeof value !== 'boolean') {
      throw new Error(`booking_actions.${key} must be a boolean`)
    }

    validated[key] = value
  }

  return validated
}

