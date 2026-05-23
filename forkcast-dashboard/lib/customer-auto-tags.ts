/**
 * Customer automated-tag metadata.
 *
 * The source of truth for auto-tag assignments is the Postgres function
 * `public.refresh_customer_auto_tags(uuid)` and the triggers that call it.
 * This file mirrors the tag catalog so the UI can:
 *   - style system tags consistently (category colours, icons, tooltips)
 *   - distinguish auto from manual assignments
 *   - render a lightweight preview when needed
 *
 * Keep the `system_key` values in sync with the SQL seeder in
 * supabase/migrations/20260417180000_customer_auto_tags.sql
 */
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Award,
  BadgeCheck,
  Ban,
  Cake,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Crown,
  DollarSign,
  Gem,
  Gift,
  Heart,
  Leaf,
  MessageSquare,
  Moon,
  MoonStar,
  PartyPopper,
  Repeat,
  ShieldAlert,
  Sparkles,
  Star,
  Sun,
  TrendingUp,
  User,
  UserPlus,
  UserX,
  Users,
  UsersRound,
  Utensils,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

export type AutoTagCategory =
  | 'loyalty'
  | 'recency'
  | 'value'
  | 'reliability'
  | 'party'
  | 'timing'
  | 'attention'

export interface AutoTagMeta {
  systemKey: string
  name: string
  description: string
  category: AutoTagCategory
  icon: LucideIcon
}

export const AUTO_TAG_CATEGORY_LABEL: Record<AutoTagCategory, string> = {
  loyalty: 'Loyalty',
  recency: 'Recency',
  value: 'Value',
  reliability: 'Reliability',
  party: 'Party profile',
  timing: 'Timing',
  attention: 'Special attention',
}

// Ordered list mirrors the SQL seeder's `priority` column.
export const AUTO_TAG_CATALOG: AutoTagMeta[] = [
  { systemKey: 'first_timer',        name: 'First-Timer',         description: 'Completed their first booking in the last 60 days', category: 'loyalty',     icon: UserPlus },
  { systemKey: 'repeat_guest',       name: 'Repeat Guest',        description: 'Has completed 2 to 4 visits',                        category: 'loyalty',     icon: Repeat },
  { systemKey: 'regular',            name: 'Regular',             description: 'Has completed 5 to 14 visits',                       category: 'loyalty',     icon: Star },
  { systemKey: 'frequent',           name: 'Frequent',            description: 'Has completed 15 to 29 visits',                      category: 'loyalty',     icon: TrendingUp },
  { systemKey: 'loyal',              name: 'Loyal',               description: 'Has completed 30 or more visits',                    category: 'loyalty',     icon: Crown },

  { systemKey: 'active',             name: 'Active',              description: 'Visited in the last 30 days',                        category: 'recency',     icon: Activity },
  { systemKey: 'lapsing',            name: 'Lapsing',             description: 'Has not visited in 31 to 90 days',                   category: 'recency',     icon: Clock },
  { systemKey: 'lapsed',             name: 'Lapsed',              description: 'Has not visited in 91 to 180 days',                  category: 'recency',     icon: AlertCircle },
  { systemKey: 'dormant',            name: 'Dormant',             description: 'Has not visited in more than 180 days',              category: 'recency',     icon: Moon },
  { systemKey: 'welcome_back',       name: 'Welcome Back',        description: 'Returned in the last 14 days after a 90+ day absence', category: 'recency',   icon: Sparkles },

  { systemKey: 'high_spender',       name: 'High Spender',        description: 'Lifetime spend between 500 and 1,999',               category: 'value',       icon: DollarSign },
  { systemKey: 'top_spender',        name: 'Top Spender',         description: 'Lifetime spend between 2,000 and 4,999',             category: 'value',       icon: Gem },
  { systemKey: 'whale',              name: 'Whale',               description: 'Lifetime spend of 5,000 or more',                    category: 'value',       icon: Award },

  { systemKey: 'reliable',           name: 'Reliable',            description: '5+ completed visits, no no-shows, cancel rate below 10%', category: 'reliability', icon: CheckCircle2 },
  { systemKey: 'no_show_risk',       name: 'No-Show Risk',        description: 'Has 2 or more previous no-shows',                    category: 'reliability', icon: Ban },
  { systemKey: 'frequent_canceller', name: 'Frequent Canceller',  description: '3+ cancellations, or cancel rate above 40% with 5+ bookings', category: 'reliability', icon: XCircle },
  { systemKey: 'at_risk',            name: 'At-Risk',             description: '3+ no-shows + cancellations in the last 90 days',    category: 'reliability', icon: AlertTriangle },

  { systemKey: 'solo_diner',         name: 'Solo Diner',          description: 'Average party size below 1.5 across 3+ visits',      category: 'party',       icon: User },
  { systemKey: 'couple',             name: 'Couple',              description: 'Average party size 1.5 to 2.5 across 3+ visits',     category: 'party',       icon: Heart },
  { systemKey: 'small_group',        name: 'Small Group',         description: 'Average party size 2.5 to 4.9 across 3+ visits',     category: 'party',       icon: Users },
  { systemKey: 'large_group',        name: 'Large Group',         description: 'Average party size of 5 or more',                    category: 'party',       icon: UsersRound },
  { systemKey: 'event_host',         name: 'Event Host',          description: 'Has 2+ completed bookings with party size of 8 or more', category: 'party',   icon: PartyPopper },

  { systemKey: 'weekend_regular',    name: 'Weekend Regular',     description: 'More than 60% of visits fall on Sat/Sun (3+ visits)', category: 'timing',     icon: Calendar },
  { systemKey: 'weekday_regular',    name: 'Weekday Regular',     description: 'More than 70% of visits fall on Mon–Fri (5+ visits)', category: 'timing',     icon: CalendarDays },
  { systemKey: 'lunch_guest',        name: 'Lunch Guest',         description: 'More than 60% of visits between 11:00 and 15:00 (3+ visits)', category: 'timing', icon: Sun },
  { systemKey: 'dinner_guest',       name: 'Dinner Guest',        description: 'More than 60% of visits between 17:00 and 22:00 (3+ visits)', category: 'timing', icon: Utensils },
  { systemKey: 'late_diner',         name: 'Late Diner',          description: 'More than 30% of visits after 21:00 (3+ visits)',    category: 'timing',     icon: MoonStar },

  { systemKey: 'birthday_month',     name: 'Birthday This Month', description: 'Profile date of birth falls in the current month',   category: 'attention',   icon: Cake },
  { systemKey: 'celebrator',         name: 'Celebrator',          description: 'Has 3+ bookings marking a special occasion',         category: 'attention',   icon: Gift },
  { systemKey: 'allergy_alert',      name: 'Allergy Alert',       description: 'Profile has recorded allergies',                     category: 'attention',   icon: ShieldAlert },
  { systemKey: 'dietary_restriction',name: 'Dietary Restriction', description: 'Profile has recorded dietary restrictions',          category: 'attention',   icon: Leaf },
  { systemKey: 'vip',                name: 'VIP',                 description: 'Flagged as VIP by the restaurant',                   category: 'attention',   icon: Crown },
  { systemKey: 'blacklisted',        name: 'Blacklisted',         description: 'Flagged as blacklisted by the restaurant',           category: 'attention',   icon: UserX },
  { systemKey: 'loyalty_member',     name: 'Loyalty Member',      description: 'Has loyalty points or a non-bronze membership tier', category: 'attention',   icon: BadgeCheck },
  { systemKey: 'special_requests',   name: 'Special Requests',    description: '50%+ of completed bookings include a special request (3+ visits)', category: 'attention', icon: MessageSquare },
]

const BY_KEY = new Map<string, AutoTagMeta>(
  AUTO_TAG_CATALOG.map((m) => [m.systemKey, m])
)

export function getAutoTagMeta(systemKey?: string | null): AutoTagMeta | null {
  if (!systemKey) return null
  return BY_KEY.get(systemKey) ?? null
}

/** A tag row decorated with its system metadata, if any. */
export interface TagWithMeta {
  id: string
  name: string
  color: string
  description?: string | null
  is_system?: boolean
  system_key?: string | null
  category?: string | null
  icon?: string | null
  /** true if this assignment was created by the auto-refresh pipeline */
  is_auto?: boolean
}

export function isSystemTag(tag: { is_system?: boolean; system_key?: string | null }): boolean {
  return Boolean(tag.is_system || tag.system_key)
}
