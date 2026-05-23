// types/audit.ts
// TypeScript types for the audit logging system

/**
 * Actor types - who performed the action
 */
export type AuditActorType =
  | "user"
  | "admin"
  | "restaurant_staff"
  | "system"
  | "anonymous";

/**
 * Severity levels for audit logs
 */
export type AuditSeverity = "debug" | "info" | "warning" | "error" | "critical";

/**
 * Action categories for filtering and organization
 */
export type AuditActionCategory =
  | "auth"
  | "booking"
  | "payment"
  | "profile"
  | "restaurant"
  | "staff"
  | "review"
  | "notification"
  | "waitlist"
  | "loyalty"
  | "system";

/**
 * Specific audit actions - P0 (Security & Money)
 */
export type AuditAuthAction =
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.signup"
  | "auth.password_reset_requested"
  | "auth.password_reset_completed"
  | "auth.oauth_login"
  | "auth.session_expired"
  | "auth.account_locked";

export type AuditBookingAction =
  | "booking.created"
  | "booking.confirmed"
  | "booking.modified"
  | "booking.cancelled_by_user"
  | "booking.cancelled_by_restaurant"
  | "booking.declined_by_restaurant"
  | "booking.auto_declined"
  | "booking.status_changed"
  | "booking.checked_in"
  | "booking.seated"
  | "booking.completed"
  | "booking.no_show"
  | "booking.deleted"
  | "booking.updated";

export type AuditPaymentAction =
  | "payment.intent_created"
  | "payment.success"
  | "payment.failed"
  | "payment.refunded"
  | "payment.disputed";

/**
 * Specific audit actions - P1 (Trust & Operations)
 */
export type AuditProfileAction =
  | "profile.created"
  | "profile.updated"
  | "profile.sensitive_updated"
  | "profile.email_changed"
  | "profile.phone_changed"
  | "profile.avatar_updated"
  | "profile.deleted";

export type AuditStaffAction =
  | "staff.added"
  | "staff.removed"
  | "staff.role_changed"
  | "staff.permissions_changed"
  | "staff.activated"
  | "staff.deactivated"
  | "staff.updated";

export type AuditRestaurantAction =
  | "restaurant.created"
  | "restaurant.updated"
  | "restaurant.status_changed"
  | "restaurant.booking_policy_changed"
  | "restaurant.rules_changed"
  | "restaurant.hours_updated"
  | "restaurant.closure_added"
  | "restaurant.closure_removed";

/**
 * Specific audit actions - P2 (Nice-to-have)
 */
export type AuditReviewAction =
  | "review.created"
  | "review.updated"
  | "review.deleted"
  | "review.reported"
  | "review.reply_added";

export type AuditNotificationAction =
  | "notification.campaign_created"
  | "notification.campaign_sent"
  | "notification.push_sent"
  | "notification.email_sent";

export type AuditWaitlistAction =
  | "waitlist.joined"
  | "waitlist.left"
  | "waitlist.converted"
  | "waitlist.expired";

export type AuditLoyaltyAction =
  | "loyalty.points_earned"
  | "loyalty.points_redeemed"
  | "loyalty.tier_changed"
  | "loyalty.reward_claimed";

/**
 * All possible audit actions
 */
export type AuditAction =
  | AuditAuthAction
  | AuditBookingAction
  | AuditPaymentAction
  | AuditProfileAction
  | AuditStaffAction
  | AuditRestaurantAction
  | AuditReviewAction
  | AuditNotificationAction
  | AuditWaitlistAction
  | AuditLoyaltyAction;

/**
 * Entity types that can be audited
 */
export type AuditEntityType =
  | "booking"
  | "profile"
  | "restaurant"
  | "restaurant_staff"
  | "review"
  | "waitlist"
  | "notification"
  | "payment"
  | "loyalty"
  | "session";

/**
 * Metadata that can be included in audit logs
 */
export interface AuditMetadata {
  // Device & Network info
  ip_address?: string | null;
  user_agent?: string;
  device_id?: string;
  platform?: "ios" | "android" | "web";
  app_version?: string;

  // Context
  confirmation_code?: string;
  source?: string;
  reason?: string;

  // Related entities
  affected_user_id?: string;
  related_booking_id?: string;
  related_restaurant_id?: string;

  // Changes summary
  changed_fields?: string[];
  sensitive_changed?: boolean;

  // Error details
  error_message?: string;
  error_code?: string;

  // Any additional custom fields
  [key: string]: unknown;
}

/**
 * Full audit log entry as stored in the database
 */
export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_type: AuditActorType;
  action: string;
  action_category: AuditActionCategory;
  entity_type: AuditEntityType;
  entity_id: string | null;
  restaurant_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: AuditMetadata;
  severity: AuditSeverity;
  created_at: string;
}

/**
 * Input for creating an audit log
 */
export interface CreateAuditLogInput {
  actor_id?: string | null;
  actor_type?: AuditActorType;
  action: AuditAction | string;
  action_category: AuditActionCategory;
  entity_type: AuditEntityType;
  entity_id?: string | null;
  restaurant_id?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  metadata?: AuditMetadata;
  severity?: AuditSeverity;
}

/**
 * Filters for querying audit logs
 */
export interface AuditLogFilters {
  actor_id?: string;
  actor_type?: AuditActorType;
  action?: string;
  action_category?: AuditActionCategory;
  entity_type?: AuditEntityType;
  entity_id?: string;
  restaurant_id?: string;
  severity?: AuditSeverity | AuditSeverity[];
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

/**
 * Response from querying audit logs
 */
export interface AuditLogQueryResult {
  logs: AuditLog[];
  total_count: number;
  has_more: boolean;
}

/**
 * Booking audit context - used when logging booking-related events
 */
export interface BookingAuditContext {
  booking_id: string;
  restaurant_id: string;
  user_id: string;
  confirmation_code?: string;
  source?: string;
  status_before?: string;
  status_after?: string;
  modified_fields?: string[];
}

/**
 * Profile audit context - used when logging profile-related events
 */
export interface ProfileAuditContext {
  profile_id: string;
  changed_fields: string[];
  sensitive_fields_changed: boolean;
}

/**
 * Auth audit context - used when logging authentication events
 */
export interface AuthAuditContext {
  user_id?: string;
  email?: string;
  method?: "email" | "google" | "apple" | "phone";
  success: boolean;
  error_message?: string;
}
