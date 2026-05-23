export type AdEventType = "impression" | "click";
export type AdEntityType =
  | "banner"
  | "featured_restaurant"
  | "featured_timeline"
  | "special_offer";

export interface AdEvent {
  event_type: AdEventType;
  ad_type: AdEntityType;
  ad_id: string; // UUID
  user_id?: string; // UUID, optional
  metadata?: Record<string, any>;
  created_at?: string; // ISO string
}
