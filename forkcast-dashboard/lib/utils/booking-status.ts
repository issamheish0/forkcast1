// lib/utils/booking-status.ts

import { getAllowedBookingStatuses, isValidBookingStatus, type RestaurantTier } from "./tier"

/**
 * Validate if a status transition is allowed for the given tier
 */
export function isValidStatusTransition(
  tier: RestaurantTier,
  currentStatus: string,
  newStatus: string
): { valid: boolean; error?: string } {
  // Check if the new status is valid for this tier
  if (!isValidBookingStatus(tier, newStatus)) {
    return {
      valid: false,
      error: `Status '${newStatus}' is not available for ${tier} tier restaurants`
    }
  }

  // For Basic tier, allow same transitions as Pro tier
  if (tier === 'basic') {
    const validTransitions: Record<string, string[]> = {
      'pending': ['confirmed', 'declined_by_restaurant'],
      'confirmed': ['no_show', 'cancelled_by_restaurant', 'cancelled_by_user', 'completed'],
      'declined_by_restaurant': [],
      'no_show': [],
      'cancelled_by_restaurant': [],
      'cancelled_by_user': [],
      'completed': []
    }

    const allowedNext = validTransitions[currentStatus] || []
    if (!allowedNext.includes(newStatus)) {
      return {
        valid: false,
        error: `Cannot change from '${currentStatus}' to '${newStatus}' in Basic tier`
      }
    }
  }

  // For Pro tier, use existing complex transitions (implement as needed)
  if (tier === 'pro') {
    // Pro tier allows all transitions as per existing logic
    // This would contain the full state machine logic
    return { valid: true }
  }

  return { valid: true }
}

/**
 * Get next allowed statuses for a booking based on tier
 */
export function getNextAllowedStatuses(
  tier: RestaurantTier,
  currentStatus: string
): string[] {
  if (tier === 'basic') {
    const transitions: Record<string, string[]> = {
      'pending': ['confirmed', 'declined_by_restaurant'],
      'confirmed': ['no_show', 'cancelled_by_restaurant', 'cancelled_by_user', 'completed'],
      'declined_by_restaurant': [],
      'no_show': [],
      'cancelled_by_restaurant': [],
      'cancelled_by_user': [],
      'completed': []
    }
    return transitions[currentStatus] || []
  }

  // Pro tier gets full status progression
  const proTransitions: Record<string, string[]> = {
    'pending': ['confirmed', 'declined_by_restaurant', 'cancelled_by_restaurant'],
    'confirmed': ['arrived', 'no_show', 'cancelled_by_restaurant'],
    'arrived': ['seated', 'cancelled_by_restaurant'],
    'seated': ['ordered', 'cancelled_by_restaurant'],
    'ordered': ['appetizers', 'main_course', 'cancelled_by_restaurant'],
    'appetizers': ['main_course', 'cancelled_by_restaurant'],
    'main_course': ['dessert', 'payment', 'cancelled_by_restaurant'],
    'dessert': ['payment', 'cancelled_by_restaurant'],
    'payment': ['completed']
  }

  return proTransitions[currentStatus] || []
}

/**
 * Format status for display based on tier
 */
export function formatStatusForTier(tier: RestaurantTier, status: string): string {
  if (tier === 'basic') {
    const basicStatuses: Record<string, string> = {
      'pending': 'Needs Review',
      'confirmed': 'Confirmed',
      'declined_by_restaurant': 'Declined',
      'no_show': 'No Show',
      'cancelled_by_user': 'Cancelled by Customer',
      'cancelled_by_restaurant': 'Cancelled by Restaurant',
      'completed': 'Completed'
    }
    return basicStatuses[status] || status
  }

  // Pro tier gets detailed status names
  const proStatuses: Record<string, string> = {
    'pending': 'Pending Approval',
    'confirmed': 'Confirmed',
    'arrived': 'Arrived',
    'seated': 'Seated',
    'ordered': 'Ordered',
    'appetizers': 'Appetizers',
    'main_course': 'Main Course',
    'dessert': 'Dessert',
    'payment': 'Payment',
    'completed': 'Completed',
    'no_show': 'No Show',
    'cancelled_by_user': 'Cancelled by Customer',
    'cancelled_by_restaurant': 'Cancelled by Restaurant',
    'declined_by_restaurant': 'Declined',
    'auto_declined': 'Auto Declined'
  }

  return proStatuses[status] || status
}

/**
 * Get status color/variant based on tier and status
 */
export function getStatusVariant(tier: RestaurantTier, status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (tier === 'basic') {
    switch (status) {
      case 'pending':
        return 'outline'
      case 'confirmed':
        return 'default'
      case 'completed':
        return 'default'
      case 'declined_by_restaurant':
      case 'cancelled_by_user':
      case 'cancelled_by_restaurant':
      case 'no_show':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  // Pro tier gets more granular status variants
  switch (status) {
    case 'pending':
      return 'outline'
    case 'confirmed':
    case 'arrived':
    case 'seated':
      return 'default'
    case 'ordered':
    case 'appetizers':
    case 'main_course':
    case 'dessert':
    case 'payment':
      return 'secondary'
    case 'completed':
      return 'default'
    case 'cancelled_by_user':
    case 'cancelled_by_restaurant':
    case 'declined_by_restaurant':
    case 'auto_declined':
    case 'no_show':
      return 'destructive'
    default:
      return 'secondary'
  }
}
