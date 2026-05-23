import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount)
}

export function titleCase(s?: string) {
  if (!s) return ''
  return s
    .replace(/_/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Returns a safe display name for a booking/customer-like object
// Prefers explicit guest name, then linked profile full_name, then phone, then a generic fallback
export function getBookingDisplayName(entity: any): string {
  if (!entity) return 'Guest'
  const nameCandidate = entity.guest_name
    || entity.user?.full_name
    || entity.profile?.full_name
    || entity.profiles?.full_name
    || entity.guest_phone
    || entity.user?.phone_number

  const trimmed = typeof nameCandidate === 'string' ? nameCandidate.trim() : String(nameCandidate || '')
  return trimmed && trimmed.length > 0 ? trimmed : 'Guest'
}

// Extract the first name from a displayable name string.
// Falls back to the entire string if it cannot split.
export function getFirstName(nameOrEntity: any): string {
  const display = typeof nameOrEntity === 'string'
    ? nameOrEntity
    : getBookingDisplayName(nameOrEntity)

  const safe = (display || '').trim()
  if (!safe) return 'Guest'

  // Split by whitespace and return the first non-empty token
  const parts = safe.split(/\s+/)
  return parts[0] || 'Guest'
}
