-- =============================================================
-- Customer Automated Tags
-- Adds persistent, trigger-driven auto-tagging for guest CRM.
-- See docs/superpowers/specs/2026-04-17-customer-auto-tags-design.md
-- =============================================================

-- --- 0. Retire previous auto-tag implementation -------------------------
-- A prior trigger (public.auto_tag_customer) only INSERTED tag assignments
-- (never removed stale ones), producing dead "Regular" / "New" / "Lost"
-- tags over time. Drop it so the new idempotent function is the single
-- source of truth. Manual tag rows stay in place; the new seeder upgrades
-- matching names (e.g. "Regular") into system tags.
DROP TRIGGER IF EXISTS trigger_auto_tag_customer ON public.restaurant_customers;
DROP FUNCTION IF EXISTS public.auto_tag_customer();

-- --- 1. Schema extensions -----------------------------------------------

ALTER TABLE public.customer_tags
  ADD COLUMN IF NOT EXISTS is_system  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS system_key text,
  ADD COLUMN IF NOT EXISTS icon       text,
  ADD COLUMN IF NOT EXISTS category   text,
  ADD COLUMN IF NOT EXISTS priority   integer NOT NULL DEFAULT 0;

-- Unique key: one row per (restaurant_id, system_key) when system_key is set
CREATE UNIQUE INDEX IF NOT EXISTS customer_tags_system_unique
  ON public.customer_tags(restaurant_id, system_key)
  WHERE system_key IS NOT NULL;

ALTER TABLE public.customer_tag_assignments
  ADD COLUMN IF NOT EXISTS is_auto                boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_auto_refreshed_at timestamptz;

-- NB: supporting indexes on public.bookings are created CONCURRENTLY outside
-- this migration (they can't run inside a transaction). See the companion
-- deployment step applied via execute_sql:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS bookings_restaurant_user_idx
--     ON public.bookings(restaurant_id, user_id) WHERE user_id IS NOT NULL;
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS bookings_restaurant_guest_email_idx
--     ON public.bookings(restaurant_id, guest_email) WHERE guest_email IS NOT NULL;

-- --- 2. System tag catalog seeder ---------------------------------------
-- Idempotent. Preserves any existing user-created tag whose name matches a
-- system tag name: it upgrades the existing row to `is_system = true` and
-- sets `system_key`, rather than failing on the (restaurant_id, name) unique
-- constraint or creating a duplicate. Icon/category/priority fields are
-- filled in only when currently NULL / 0 so user edits stay sticky.

CREATE OR REPLACE FUNCTION public.ensure_system_tags_for_restaurant(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_catalog jsonb := $json$
  [
    {"name":"First-Timer",        "color":"#a855f7","description":"Completed their first booking in the last 60 days",                     "system_key":"first_timer",        "icon":"user-plus",     "category":"loyalty",     "priority":10},
    {"name":"Repeat Guest",       "color":"#6366f1","description":"Has completed 2 to 4 visits",                                             "system_key":"repeat_guest",       "icon":"repeat",        "category":"loyalty",     "priority":11},
    {"name":"Regular",            "color":"#22c55e","description":"Has completed 5 to 14 visits",                                            "system_key":"regular",            "icon":"star",          "category":"loyalty",     "priority":12},
    {"name":"Frequent",           "color":"#3b82f6","description":"Has completed 15 to 29 visits",                                           "system_key":"frequent",           "icon":"trending-up",   "category":"loyalty",     "priority":13},
    {"name":"Loyal",              "color":"#f59e0b","description":"Has completed 30 or more visits",                                         "system_key":"loyal",              "icon":"crown",         "category":"loyalty",     "priority":14},

    {"name":"Active",             "color":"#10b981","description":"Visited in the last 30 days",                                             "system_key":"active",             "icon":"activity",      "category":"recency",     "priority":20},
    {"name":"Lapsing",            "color":"#eab308","description":"Has not visited in 31 to 90 days",                                        "system_key":"lapsing",            "icon":"clock",         "category":"recency",     "priority":21},
    {"name":"Lapsed",             "color":"#f97316","description":"Has not visited in 91 to 180 days",                                       "system_key":"lapsed",             "icon":"alert-circle",  "category":"recency",     "priority":22},
    {"name":"Dormant",            "color":"#6b7280","description":"Has not visited in more than 180 days",                                   "system_key":"dormant",            "icon":"moon",          "category":"recency",     "priority":23},
    {"name":"Welcome Back",       "color":"#06b6d4","description":"Returned in the last 14 days after a 90+ day absence",                    "system_key":"welcome_back",       "icon":"sparkles",      "category":"recency",     "priority":24},

    {"name":"High Spender",       "color":"#14b8a6","description":"Lifetime spend between 500 and 1999",                                     "system_key":"high_spender",       "icon":"dollar-sign",   "category":"value",       "priority":30},
    {"name":"Top Spender",        "color":"#0ea5e9","description":"Lifetime spend between 2000 and 4999",                                    "system_key":"top_spender",        "icon":"gem",           "category":"value",       "priority":31},
    {"name":"Whale",              "color":"#8b5cf6","description":"Lifetime spend of 5000 or more",                                          "system_key":"whale",              "icon":"award",         "category":"value",       "priority":32},

    {"name":"Reliable",           "color":"#16a34a","description":"5+ completed visits, no no-shows, cancel rate below 10%",                 "system_key":"reliable",           "icon":"check-circle",  "category":"reliability", "priority":40},
    {"name":"No-Show Risk",       "color":"#ef4444","description":"Has 2 or more previous no-shows",                                         "system_key":"no_show_risk",       "icon":"ban",           "category":"reliability", "priority":41},
    {"name":"Frequent Canceller", "color":"#dc2626","description":"Has 3+ cancellations, or cancel rate above 40% with 5+ bookings",         "system_key":"frequent_canceller", "icon":"x-circle",      "category":"reliability", "priority":42},
    {"name":"At-Risk",            "color":"#b91c1c","description":"3+ no-shows + cancellations combined in the last 90 days",                "system_key":"at_risk",            "icon":"alert-triangle","category":"reliability", "priority":43},

    {"name":"Solo Diner",         "color":"#64748b","description":"Average party size below 1.5 across 3+ visits",                           "system_key":"solo_diner",         "icon":"user",          "category":"party",       "priority":50},
    {"name":"Couple",             "color":"#ec4899","description":"Average party size 1.5 to 2.5 across 3+ visits",                          "system_key":"couple",             "icon":"heart",         "category":"party",       "priority":51},
    {"name":"Small Group",        "color":"#f472b6","description":"Average party size 2.5 to 4.9 across 3+ visits",                          "system_key":"small_group",        "icon":"users",         "category":"party",       "priority":52},
    {"name":"Large Group",        "color":"#f59e0b","description":"Average party size of 5 or more",                                         "system_key":"large_group",        "icon":"users-round",   "category":"party",       "priority":53},
    {"name":"Event Host",         "color":"#d946ef","description":"Has 2+ completed bookings with party size of 8 or more",                  "system_key":"event_host",         "icon":"party-popper",  "category":"party",       "priority":54},

    {"name":"Weekend Regular",    "color":"#6366f1","description":"More than 60% of visits fall on Sat/Sun (3+ visits)",                     "system_key":"weekend_regular",    "icon":"calendar",      "category":"timing",      "priority":60},
    {"name":"Weekday Regular",    "color":"#0d9488","description":"More than 70% of visits fall on Mon–Fri (5+ visits)",                     "system_key":"weekday_regular",    "icon":"calendar-days", "category":"timing",      "priority":61},
    {"name":"Lunch Guest",        "color":"#fbbf24","description":"More than 60% of visits between 11:00 and 15:00 (3+ visits)",             "system_key":"lunch_guest",        "icon":"sun",           "category":"timing",      "priority":62},
    {"name":"Dinner Guest",       "color":"#7c3aed","description":"More than 60% of visits between 17:00 and 22:00 (3+ visits)",             "system_key":"dinner_guest",       "icon":"utensils",      "category":"timing",      "priority":63},
    {"name":"Late Diner",         "color":"#1e293b","description":"More than 30% of visits after 21:00 (3+ visits)",                         "system_key":"late_diner",         "icon":"moon-star",     "category":"timing",      "priority":64},

    {"name":"Birthday This Month","color":"#f43f5e","description":"Profile date of birth falls in the current month",                       "system_key":"birthday_month",     "icon":"cake",          "category":"attention",   "priority":70},
    {"name":"Celebrator",         "color":"#fb7185","description":"Has 3+ bookings marking a special occasion",                              "system_key":"celebrator",         "icon":"gift",          "category":"attention",   "priority":71},
    {"name":"Allergy Alert",      "color":"#dc2626","description":"Profile has recorded allergies",                                          "system_key":"allergy_alert",      "icon":"shield-alert",  "category":"attention",   "priority":72},
    {"name":"Dietary Restriction","color":"#84cc16","description":"Profile has recorded dietary restrictions",                               "system_key":"dietary_restriction","icon":"leaf",          "category":"attention",   "priority":73},
    {"name":"VIP",                "color":"#eab308","description":"Flagged as VIP by the restaurant",                                        "system_key":"vip",                "icon":"crown",         "category":"attention",   "priority":74},
    {"name":"Blacklisted",        "color":"#111827","description":"Flagged as blacklisted by the restaurant",                                "system_key":"blacklisted",        "icon":"user-x",        "category":"attention",   "priority":75},
    {"name":"Loyalty Member",     "color":"#a855f7","description":"Has loyalty points or a non-bronze membership tier",                      "system_key":"loyalty_member",     "icon":"badge-check",   "category":"attention",   "priority":76},
    {"name":"Special Requests",   "color":"#0891b2","description":"50%+ of completed bookings include a special request (3+ visits)",        "system_key":"special_requests",   "icon":"message-square","category":"attention",   "priority":77}
  ]
  $json$::jsonb;
BEGIN
  -- Step 1: upgrade existing matching-name tags (claim unclaimed names only)
  UPDATE public.customer_tags ct
  SET is_system = true,
      system_key = c.system_key,
      icon       = COALESCE(NULLIF(ct.icon, ''), c.icon),
      category   = COALESCE(NULLIF(ct.category, ''), c.category),
      priority   = CASE WHEN ct.priority = 0 THEN c.priority::int ELSE ct.priority END
  FROM (
    SELECT
      (item->>'name')::text       AS name,
      (item->>'system_key')::text AS system_key,
      (item->>'icon')::text       AS icon,
      (item->>'category')::text   AS category,
      (item->>'priority')::int    AS priority
    FROM jsonb_array_elements(catalog) AS item
  ) c
  WHERE ct.restaurant_id = p_restaurant_id
    AND lower(ct.name) = lower(c.name)
    AND ct.system_key IS NULL
    AND NOT EXISTS (
      -- don't upgrade if another row already claims this system_key here
      SELECT 1 FROM public.customer_tags ct2
      WHERE ct2.restaurant_id = p_restaurant_id
        AND ct2.system_key = c.system_key
    );

  -- Step 2: insert remaining system tags not present (neither by name nor key)
  INSERT INTO public.customer_tags (
    restaurant_id, name, color, description, is_system, system_key, icon, category, priority
  )
  SELECT
    p_restaurant_id,
    c.name, c.color, c.description,
    true, c.system_key, c.icon, c.category, c.priority
  FROM (
    SELECT
      (item->>'name')::text        AS name,
      (item->>'color')::text       AS color,
      (item->>'description')::text AS description,
      (item->>'system_key')::text  AS system_key,
      (item->>'icon')::text        AS icon,
      (item->>'category')::text    AS category,
      (item->>'priority')::int     AS priority
    FROM jsonb_array_elements(catalog) AS item
  ) c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.customer_tags ct
    WHERE ct.restaurant_id = p_restaurant_id
      AND (lower(ct.name) = lower(c.name) OR ct.system_key = c.system_key)
  );

  -- Step 3: refresh system metadata on rows we own (color/description untouched
  -- if user previously customised them - we only fill missing metadata)
  UPDATE public.customer_tags ct
  SET icon     = COALESCE(NULLIF(ct.icon, ''), c.icon),
      category = COALESCE(NULLIF(ct.category, ''), c.category),
      priority = CASE WHEN ct.priority = 0 THEN c.priority::int ELSE ct.priority END
  FROM (
    SELECT
      (item->>'system_key')::text AS system_key,
      (item->>'icon')::text       AS icon,
      (item->>'category')::text   AS category,
      (item->>'priority')::int    AS priority
    FROM jsonb_array_elements(catalog) AS item
  ) c
  WHERE ct.restaurant_id = p_restaurant_id
    AND ct.is_system = true
    AND ct.system_key = c.system_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_system_tags_for_restaurant(uuid)
  TO authenticated, service_role;

-- --- 3. Core refresh function -------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_customer_auto_tags(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer       public.restaurant_customers%ROWTYPE;
  v_profile        public.profiles%ROWTYPE;
  v_now            timestamptz := now();
  v_completed      int := 0;
  v_no_shows       int := 0;
  v_cancelled      int := 0;
  v_total_bookings int := 0;
  v_reliability    numeric;
  v_days_since     int;
  v_weekend_ratio  numeric := 0;
  v_weekday_ratio  numeric := 0;
  v_lunch_ratio    numeric := 0;
  v_dinner_ratio   numeric := 0;
  v_late_ratio     numeric := 0;
  v_history_count  int := 0;
  v_event_count    int := 0;
  v_occasion_count int := 0;
  v_special_req    int := 0;
  v_had_gap        boolean := false;
  v_recent_neg     int := 0;
  v_desired        text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO v_customer FROM public.restaurant_customers WHERE id = p_customer_id;
  IF NOT FOUND THEN RETURN; END IF;

  PERFORM public.ensure_system_tags_for_restaurant(v_customer.restaurant_id);

  IF v_customer.user_id IS NOT NULL THEN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_customer.user_id;
  END IF;

  -- Aggregate counts across all bookings for this customer at this restaurant
  SELECT
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'no_show'),
    COUNT(*) FILTER (WHERE status IN ('cancelled_by_user','cancelled_by_restaurant')),
    COUNT(*)
  INTO v_completed, v_no_shows, v_cancelled, v_total_bookings
  FROM public.bookings
  WHERE restaurant_id = v_customer.restaurant_id
    AND (
      (v_customer.user_id IS NOT NULL AND user_id = v_customer.user_id)
      OR (v_customer.user_id IS NULL AND v_customer.guest_email IS NOT NULL AND guest_email = v_customer.guest_email)
    );

  IF (v_completed + v_cancelled + v_no_shows) > 0 THEN
    v_reliability := v_completed::numeric / (v_completed + v_cancelled + v_no_shows)::numeric;
  END IF;

  -- Timing ratios across completed bookings
  SELECT
    COUNT(*),
    COALESCE(AVG(CASE WHEN EXTRACT(ISODOW FROM booking_time) IN (6,7)                 THEN 1.0 ELSE 0.0 END), 0),
    COALESCE(AVG(CASE WHEN EXTRACT(ISODOW FROM booking_time) BETWEEN 1 AND 5          THEN 1.0 ELSE 0.0 END), 0),
    COALESCE(AVG(CASE WHEN EXTRACT(HOUR   FROM booking_time) BETWEEN 11 AND 14        THEN 1.0 ELSE 0.0 END), 0),
    COALESCE(AVG(CASE WHEN EXTRACT(HOUR   FROM booking_time) BETWEEN 17 AND 21        THEN 1.0 ELSE 0.0 END), 0),
    COALESCE(AVG(CASE WHEN EXTRACT(HOUR   FROM booking_time) >= 21                    THEN 1.0 ELSE 0.0 END), 0)
  INTO v_history_count, v_weekend_ratio, v_weekday_ratio, v_lunch_ratio, v_dinner_ratio, v_late_ratio
  FROM public.bookings
  WHERE restaurant_id = v_customer.restaurant_id
    AND status = 'completed'
    AND (
      (v_customer.user_id IS NOT NULL AND user_id = v_customer.user_id)
      OR (v_customer.user_id IS NULL AND v_customer.guest_email IS NOT NULL AND guest_email = v_customer.guest_email)
    );

  -- Event / occasion / special-request counts
  SELECT
    COUNT(*) FILTER (WHERE party_size >= 8                                       AND status = 'completed'),
    COUNT(*) FILTER (WHERE occasion IS NOT NULL AND occasion <> ''               AND status = 'completed'),
    COUNT(*) FILTER (WHERE special_requests IS NOT NULL AND special_requests <> ''AND status = 'completed')
  INTO v_event_count, v_occasion_count, v_special_req
  FROM public.bookings
  WHERE restaurant_id = v_customer.restaurant_id
    AND (
      (v_customer.user_id IS NOT NULL AND user_id = v_customer.user_id)
      OR (v_customer.user_id IS NULL AND v_customer.guest_email IS NOT NULL AND guest_email = v_customer.guest_email)
    );

  -- Recent negative events (last 90 days)
  SELECT COUNT(*) INTO v_recent_neg
  FROM public.bookings
  WHERE restaurant_id = v_customer.restaurant_id
    AND status IN ('no_show','cancelled_by_user','cancelled_by_restaurant')
    AND booking_time >= v_now - interval '90 days'
    AND (
      (v_customer.user_id IS NOT NULL AND user_id = v_customer.user_id)
      OR (v_customer.user_id IS NULL AND v_customer.guest_email IS NOT NULL AND guest_email = v_customer.guest_email)
    );

  -- --- Loyalty (exclusive) -------------------------------------------
  IF v_completed >= 30                    THEN v_desired := v_desired || 'loyal';
  ELSIF v_completed BETWEEN 15 AND 29     THEN v_desired := v_desired || 'frequent';
  ELSIF v_completed BETWEEN 5 AND 14      THEN v_desired := v_desired || 'regular';
  ELSIF v_completed BETWEEN 2 AND 4       THEN v_desired := v_desired || 'repeat_guest';
  ELSIF v_completed = 1
        AND v_customer.first_visit IS NOT NULL
        AND v_customer.first_visit >= v_now - interval '60 days'
                                          THEN v_desired := v_desired || 'first_timer';
  END IF;

  -- --- Recency (exclusive) -------------------------------------------
  IF v_customer.last_visit IS NOT NULL THEN
    v_days_since := GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_customer.last_visit))::int / 86400);

    IF v_days_since <=  30 THEN v_desired := v_desired || 'active';
    ELSIF v_days_since <=  90 THEN v_desired := v_desired || 'lapsing';
    ELSIF v_days_since <= 180 THEN v_desired := v_desired || 'lapsed';
    ELSE                          v_desired := v_desired || 'dormant';
    END IF;

    IF v_days_since <= 14 AND v_completed >= 2 THEN
      SELECT EXISTS (
        SELECT 1 FROM public.bookings
        WHERE restaurant_id = v_customer.restaurant_id
          AND status = 'completed'
          AND booking_time <  v_customer.last_visit - interval '90 days'
          AND booking_time >= v_customer.last_visit - interval '365 days'
          AND (
            (v_customer.user_id IS NOT NULL AND user_id = v_customer.user_id)
            OR (v_customer.user_id IS NULL AND v_customer.guest_email IS NOT NULL AND guest_email = v_customer.guest_email)
          )
      ) INTO v_had_gap;
      IF v_had_gap THEN v_desired := v_desired || 'welcome_back'; END IF;
    END IF;
  END IF;

  -- --- Value ---------------------------------------------------------
  IF COALESCE(v_customer.total_spent, 0) >= 5000 THEN
    v_desired := v_desired || 'whale';
  ELSIF COALESCE(v_customer.total_spent, 0) >= 2000 THEN
    v_desired := v_desired || 'top_spender';
  ELSIF COALESCE(v_customer.total_spent, 0) >= 500 THEN
    v_desired := v_desired || 'high_spender';
  END IF;

  -- --- Reliability ---------------------------------------------------
  IF v_completed >= 5 AND v_no_shows = 0
     AND (v_reliability IS NULL OR v_reliability >= 0.90) THEN
    v_desired := v_desired || 'reliable';
  END IF;
  IF v_no_shows >= 2 THEN
    v_desired := v_desired || 'no_show_risk';
  END IF;
  IF v_cancelled >= 3
     OR (v_total_bookings >= 5 AND v_reliability IS NOT NULL AND v_reliability < 0.60) THEN
    v_desired := v_desired || 'frequent_canceller';
  END IF;
  IF v_recent_neg >= 3 THEN
    v_desired := v_desired || 'at_risk';
  END IF;

  -- --- Party profile -------------------------------------------------
  IF v_completed >= 3 THEN
    IF COALESCE(v_customer.average_party_size, 0) < 1.5 THEN
      v_desired := v_desired || 'solo_diner';
    ELSIF v_customer.average_party_size >= 1.5 AND v_customer.average_party_size < 2.5 THEN
      v_desired := v_desired || 'couple';
    ELSIF v_customer.average_party_size >= 2.5 AND v_customer.average_party_size < 5 THEN
      v_desired := v_desired || 'small_group';
    END IF;
  END IF;
  IF COALESCE(v_customer.average_party_size, 0) >= 5 THEN
    v_desired := v_desired || 'large_group';
  END IF;
  IF v_event_count >= 2 THEN
    v_desired := v_desired || 'event_host';
  END IF;

  -- --- Timing --------------------------------------------------------
  IF v_history_count >= 3 AND v_weekend_ratio > 0.60 THEN v_desired := v_desired || 'weekend_regular'; END IF;
  IF v_history_count >= 5 AND v_weekday_ratio > 0.70 THEN v_desired := v_desired || 'weekday_regular'; END IF;
  IF v_history_count >= 3 AND v_lunch_ratio   > 0.60 THEN v_desired := v_desired || 'lunch_guest';     END IF;
  IF v_history_count >= 3 AND v_dinner_ratio  > 0.60 THEN v_desired := v_desired || 'dinner_guest';    END IF;
  IF v_history_count >= 3 AND v_late_ratio    > 0.30 THEN v_desired := v_desired || 'late_diner';      END IF;

  -- --- Special attention ---------------------------------------------
  IF v_profile.date_of_birth IS NOT NULL
     AND EXTRACT(MONTH FROM v_profile.date_of_birth) = EXTRACT(MONTH FROM v_now) THEN
    v_desired := v_desired || 'birthday_month';
  END IF;
  IF v_occasion_count >= 3 THEN
    v_desired := v_desired || 'celebrator';
  END IF;
  IF v_profile.allergies IS NOT NULL AND array_length(v_profile.allergies, 1) > 0 THEN
    v_desired := v_desired || 'allergy_alert';
  END IF;
  IF v_profile.dietary_restrictions IS NOT NULL AND array_length(v_profile.dietary_restrictions, 1) > 0 THEN
    v_desired := v_desired || 'dietary_restriction';
  END IF;
  IF COALESCE(v_customer.vip_status, false)     THEN v_desired := v_desired || 'vip';          END IF;
  IF COALESCE(v_customer.blacklisted, false)    THEN v_desired := v_desired || 'blacklisted';  END IF;
  IF (v_profile.loyalty_points IS NOT NULL AND v_profile.loyalty_points > 0)
     OR (v_profile.membership_tier IS NOT NULL AND v_profile.membership_tier <> 'bronze') THEN
    v_desired := v_desired || 'loyalty_member';
  END IF;
  IF v_completed >= 3
     AND v_special_req::numeric / NULLIF(v_completed,0)::numeric >= 0.5 THEN
    v_desired := v_desired || 'special_requests';
  END IF;

  -- --- Apply: remove stale, add desired ------------------------------

  DELETE FROM public.customer_tag_assignments cta
  USING public.customer_tags ct
  WHERE cta.tag_id = ct.id
    AND cta.customer_id = p_customer_id
    AND ct.restaurant_id = v_customer.restaurant_id
    AND ct.is_system = true
    AND cta.is_auto  = true
    AND NOT (ct.system_key = ANY (v_desired));

  INSERT INTO public.customer_tag_assignments (customer_id, tag_id, is_auto, last_auto_refreshed_at, assigned_at)
  SELECT p_customer_id, ct.id, true, v_now, v_now
  FROM public.customer_tags ct
  WHERE ct.restaurant_id = v_customer.restaurant_id
    AND ct.is_system = true
    AND ct.system_key = ANY (v_desired)
  ON CONFLICT (customer_id, tag_id) DO UPDATE
    SET is_auto = true,
        last_auto_refreshed_at = v_now;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_customer_auto_tags(uuid)
  TO authenticated, service_role;

-- --- 4. Bulk refresh RPC -------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_all_customer_auto_tags(p_restaurant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_count       int := 0;
BEGIN
  -- Caller must be active staff of this restaurant (or service_role / internal).
  -- auth.uid() is NULL for service_role and internal PERFORM calls, so those pass.
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.restaurant_staff
    WHERE restaurant_id = p_restaurant_id
      AND user_id = auth.uid()
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'access_denied: caller is not active staff of this restaurant';
  END IF;

  PERFORM public.ensure_system_tags_for_restaurant(p_restaurant_id);

  FOR v_customer_id IN
    SELECT id FROM public.restaurant_customers WHERE restaurant_id = p_restaurant_id
  LOOP
    BEGIN
      PERFORM public.refresh_customer_auto_tags(v_customer_id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- skip errored customer, continue batch
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_all_customer_auto_tags(uuid)
  TO authenticated, service_role;

-- --- 5. Trigger: booking changes -----------------------------------------

CREATE OR REPLACE FUNCTION public.on_booking_change_refresh_tags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_user_id     uuid := COALESCE(NEW.user_id, OLD.user_id);
  v_email       text := COALESCE(NEW.guest_email, OLD.guest_email);
  v_rid         uuid := COALESCE(NEW.restaurant_id, OLD.restaurant_id);
BEGIN
  IF v_user_id IS NULL AND v_email IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id INTO v_customer_id
  FROM public.restaurant_customers
  WHERE restaurant_id = v_rid
    AND (
      (v_user_id IS NOT NULL AND user_id = v_user_id)
      OR (v_user_id IS NULL AND guest_email = v_email)
    )
  LIMIT 1;

  IF v_customer_id IS NOT NULL THEN
    PERFORM public.refresh_customer_auto_tags(v_customer_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Never let a tag-refresh failure block booking writes.
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_refresh_auto_tags        ON public.bookings;
DROP TRIGGER IF EXISTS trg_bookings_delete_refresh_auto_tags ON public.bookings;

CREATE TRIGGER trg_bookings_refresh_auto_tags
AFTER INSERT OR UPDATE OF status, booking_time, party_size, special_requests, occasion
ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.on_booking_change_refresh_tags();

CREATE TRIGGER trg_bookings_delete_refresh_auto_tags
AFTER DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.on_booking_change_refresh_tags();

-- --- 6. Trigger: restaurant_customers stats ------------------------------

CREATE OR REPLACE FUNCTION public.on_customer_stats_change_refresh_tags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_customer_auto_tags(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customers_refresh_auto_tags ON public.restaurant_customers;

CREATE TRIGGER trg_customers_refresh_auto_tags
AFTER INSERT OR UPDATE OF total_bookings, total_spent, average_party_size,
                          last_visit, no_show_count, cancelled_count,
                          vip_status, blacklisted, user_id, guest_email
ON public.restaurant_customers
FOR EACH ROW EXECUTE FUNCTION public.on_customer_stats_change_refresh_tags();
