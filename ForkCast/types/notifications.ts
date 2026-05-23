/**
 * Notification System V2 Types
 * For admin dashboard and API routes
 */

// ============ Campaign Types ============

export interface NotificationCampaign {
  id: string;
  name: string;
  description?: string;
  target_type: "all_users" | "restaurant_users" | "specific_users";
  target_criteria: {
    type: string;
    restaurant_ids?: string[];
    user_ids?: string[];
  };
  target_count: number;
  sent_count: number;
  delivered_count: number;
  clicked_count: number;
  failed_count: number;
  status:
    | "draft"
    | "queued"
    | "sending"
    | "sent"
    | "completed"
    | "failed"
    | "cancelled";
  scheduled_for?: string;
  started_at?: string;
  completed_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignAnalytics {
  campaign_id: string;
  name?: string;
  status?: string;
  created_at?: string;
  completed_at?: string;
  total_targeted: number;
  total_queued: number;
  total_processing: number;
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  total_clicked: number;
  delivery_rate: number;
  click_through_rate: number;
  failure_reasons: FailureReason[];
}

export interface FailureReason {
  error: string;
  count: number;
}

// ============ Request Types ============

export interface NotificationRequest {
  title: string;
  body: string;
  channels: ("push" | "inapp" | "email" | "sms")[];
  priority: "high" | "normal" | "low";
  target: NotificationTarget;
  scheduling?: NotificationScheduling;
  campaign_name?: string;
  campaign_description?: string;
}

export interface NotificationTarget {
  type: "all_users" | "restaurant_users" | "specific_users";
  restaurant_ids?: string[];
  user_ids?: string[];
}

export interface NotificationScheduling {
  send_at: string;
  timezone?: string;
}

// ============ Response Types ============

export interface SendNotificationResponse {
  success: boolean;
  campaign_id: string;
  recipients: number;
  queue_items: number;
  scheduled: boolean;
}

export interface NotificationStats {
  total_sent: number;
  delivered: number;
  failed: number;
  queued: number;
  clicked: number;
  delivery_rate: number;
  click_rate: number;
}

// ============ Outbox Types ============

export interface NotificationOutboxItem {
  id: string;
  user_id: string;
  channel: "push" | "inapp" | "email" | "sms";
  title: string;
  body: string;
  payload: Record<string, any>;
  status: "queued" | "processing" | "sent" | "delivered" | "failed" | "skipped";
  priority: "high" | "normal" | "low";
  type: string;
  scheduled_for?: string;
  sent_at?: string;
  delivered_at?: string;
  clicked_at?: string;
  error?: string;
  attempts: number;
  retry_count: number;
  campaign_id?: string;
  expo_receipt_id?: string;
  created_at: string;
  updated_at: string;
}

// ============ Template Types ============

export interface NotificationTemplate {
  id: string;
  name: string;
  category: string;
  title_template: string;
  message_template: string;
  variables: string[];
  default_channels: string[];
  default_priority: string;
}

// ============ Failed Notification Types ============

export interface FailedNotification {
  id: string;
  title: string;
  body: string;
  user_name: string;
  user_email: string;
  error: string;
  created_at: string;
  attempts: number;
  campaign_id?: string;
}
