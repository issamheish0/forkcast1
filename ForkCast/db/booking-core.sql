-- ============================================================
-- ForkCast — Booking Core Schema
-- Paste this into Supabase SQL Editor and run it once.
-- Covers: restaurants, bookings, tables, hours, favorites,
--         reviews, and all FK dependencies.
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;


-- ──────────────────────────────────────────────────────────────
-- CUSTOM TYPES
-- ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.tier AS ENUM ('basic', 'pro', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ──────────────────────────────────────────────────────────────
-- 1. restaurant_groups  (no deps)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.restaurant_groups (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  image_url   text,
  description text,
  status      text DEFAULT 'active' CHECK (status = ANY (ARRAY['active','inactive'])),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  CONSTRAINT restaurant_groups_pkey PRIMARY KEY (id)
);


-- ──────────────────────────────────────────────────────────────
-- 2. profiles  (depends on auth.users — already exists)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                     uuid NOT NULL,
  full_name              text NOT NULL,
  first_name             text DEFAULT '',
  last_name              text DEFAULT '',
  email                  text UNIQUE CHECK (email IS NULL OR email ~ '.+@.+'),
  phone_number           text UNIQUE,
  phone_verified         boolean NOT NULL DEFAULT false,
  phone_verified_at      timestamptz,
  avatar_url             text,
  date_of_birth          date,
  allergies              text[],
  favorite_cuisines      text[],
  dietary_restrictions   text[],
  preferred_ambiance     text[] DEFAULT '{}',
  special_requirements   text DEFAULT '',
  preferred_party_size   integer DEFAULT 2,
  notification_preferences jsonb DEFAULT '{"sms":false,"push":true,"email":true,"whatsapp":true,"all_muted":false}',
  loyalty_points         integer DEFAULT 0,
  membership_tier        text DEFAULT 'bronze',
  onboarded              boolean DEFAULT false,
  user_rating            numeric DEFAULT 5.0 CHECK (user_rating >= 1.0 AND user_rating <= 5.0),
  total_bookings         integer DEFAULT 0,
  completed_bookings     integer DEFAULT 0,
  cancelled_bookings     integer DEFAULT 0,
  no_show_bookings       integer DEFAULT 0,
  rating_last_updated    timestamptz DEFAULT now(),
  privacy_settings       jsonb DEFAULT jsonb_build_object(
                           'profile_visibility','public',
                           'activity_sharing',true,
                           'location_sharing',false,
                           'friend_requests_allowed',true),
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now(),
  CONSTRAINT profiles_pkey    PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);


-- ──────────────────────────────────────────────────────────────
-- 3. restaurants  (depends on profiles, restaurant_groups)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.restaurants (
  id                          uuid NOT NULL DEFAULT gen_random_uuid(),
  name                        text NOT NULL,
  description                 text,
  address                     text NOT NULL,
  location                    geography(Point, 4326) NOT NULL,
  latitude                    double precision,
  longitude                   double precision,
  main_image_url              text,
  image_urls                  text[],
  cuisine_type                text NOT NULL,
  secondary_cuisines          text[],
  tags                        text[],
  features                    jsonb,
  opening_time                time,
  closing_time                time,
  booking_policy              text CHECK (booking_policy = ANY (ARRAY['instant','request'])),
  price_range                 integer CHECK (price_range >= 1 AND price_range <= 4),
  average_rating              numeric DEFAULT 0,
  total_reviews               integer DEFAULT 0,
  review_summary              jsonb DEFAULT '{"total_reviews":0,"average_rating":0,"rating_distribution":{"1":0,"2":0,"3":0,"4":0,"5":0},"detailed_ratings":{"food_avg":0,"service_avg":0,"ambiance_avg":0,"value_avg":0},"recommendation_percentage":0}',
  phone_number                text,
  whatsapp_number             text,
  instagram_handle            text,
  email                       text CHECK (email IS NULL OR email ~ '.+@.+'),
  website_url                 text,
  dietary_options             text[],
  ambiance_tags               text[],
  parking_available           boolean DEFAULT false,
  valet_parking               boolean DEFAULT false,
  outdoor_seating             boolean DEFAULT false,
  shisha_available            boolean DEFAULT false,
  live_music_schedule         jsonb,
  happy_hour_times            jsonb,
  booking_window_days         integer DEFAULT 30,
  cancellation_window_hours   integer DEFAULT 24,
  table_turnover_minutes      integer DEFAULT 120,
  request_expiry_hours        integer DEFAULT 24,
  auto_decline_enabled        boolean DEFAULT true,
  max_party_size              integer DEFAULT 10 CHECK (max_party_size > 0),
  min_party_size              integer DEFAULT 1,
  minimum_age                 integer CHECK (minimum_age >= 13 AND minimum_age <= 25),
  requires_down_payment       boolean NOT NULL DEFAULT false,
  down_payment_amount         numeric NOT NULL DEFAULT 0,
  service_fee_percentage      numeric DEFAULT 0 CHECK (service_fee_percentage >= 0 AND service_fee_percentage <= 100),
  whish_service_fee_percentage numeric NOT NULL DEFAULT 1,
  addons                      text[] DEFAULT '{}',
  menu_url                    text,
  menu_urls                   jsonb DEFAULT '[]',
  scratch_card_enabled        boolean NOT NULL DEFAULT false,
  show_dining_duration        boolean NOT NULL DEFAULT false,
  featured                    boolean DEFAULT false,
  featured_order              integer,
  ai_featured                 boolean NOT NULL DEFAULT false,
  status                      text DEFAULT 'active' CHECK (status = ANY (ARRAY['active','inactive','suspended'])),
  tier                        public.tier NOT NULL DEFAULT 'pro',
  search_vector               tsvector,
  restaurant_group_id         uuid,
  created_by                  uuid,
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now(),
  CONSTRAINT restaurants_pkey                    PRIMARY KEY (id),
  CONSTRAINT restaurants_created_by_fkey         FOREIGN KEY (created_by)          REFERENCES public.profiles(id),
  CONSTRAINT restaurants_restaurant_group_id_fkey FOREIGN KEY (restaurant_group_id) REFERENCES public.restaurant_groups(id)
);

CREATE INDEX IF NOT EXISTS restaurants_location_idx ON public.restaurants USING GIST (location);
CREATE INDEX IF NOT EXISTS restaurants_search_vector_idx ON public.restaurants USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS restaurants_status_idx ON public.restaurants (status);
CREATE INDEX IF NOT EXISTS restaurants_cuisine_idx ON public.restaurants (cuisine_type);


-- ──────────────────────────────────────────────────────────────
-- 4. special_offers  (depends on restaurants)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.special_offers (
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id       uuid NOT NULL,
  title               text NOT NULL,
  description         text,
  discount_percentage integer,
  valid_from          timestamptz NOT NULL,
  valid_until         timestamptz NOT NULL,
  terms_conditions    text[],
  minimum_party_size  integer DEFAULT 1,
  applicable_days     text[],
  img_url             text,
  is_clickable        boolean NOT NULL DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  CONSTRAINT special_offers_pkey              PRIMARY KEY (id),
  CONSTRAINT special_offers_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);


-- ──────────────────────────────────────────────────────────────
-- 5. restaurant_loyalty_rules  (depends on restaurants)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.restaurant_loyalty_rules (
  id                  uuid NOT NULL DEFAULT uuid_generate_v4(),
  restaurant_id       uuid NOT NULL,
  rule_name           text NOT NULL,
  points_to_award     integer NOT NULL CHECK (points_to_award > 0),
  is_active           boolean DEFAULT true,
  valid_from          timestamptz DEFAULT now(),
  valid_until         timestamptz,
  applicable_days     integer[] DEFAULT ARRAY[0,1,2,3,4,5,6],
  start_time_minutes  integer CHECK (start_time_minutes >= 0 AND start_time_minutes < 1440),
  end_time_minutes    integer CHECK (end_time_minutes  >= 0 AND end_time_minutes  <= 1440),
  minimum_party_size  integer DEFAULT 1,
  maximum_party_size  integer,
  max_uses_total      integer,
  current_uses        integer DEFAULT 0,
  max_uses_per_user   integer,
  priority            integer DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  CONSTRAINT restaurant_loyalty_rules_pkey              PRIMARY KEY (id),
  CONSTRAINT restaurant_loyalty_rules_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);


-- ──────────────────────────────────────────────────────────────
-- 6. restaurant_events  (depends on restaurants, profiles)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.restaurant_events (
  id                          uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id               uuid NOT NULL,
  title                       text NOT NULL,
  description                 text,
  event_type                  text,
  image_url                   text,
  minimum_age                 integer CHECK (minimum_age IS NULL OR (minimum_age >= 13 AND minimum_age <= 25)),
  minimum_party_size          integer DEFAULT 1 CHECK (minimum_party_size > 0),
  maximum_party_size          integer CHECK (maximum_party_size IS NULL OR maximum_party_size > 0),
  special_pricing             jsonb DEFAULT '{}',
  special_requirements        text,
  terms_and_conditions        text[],
  is_recurring                boolean DEFAULT false,
  recurrence_pattern          jsonb,
  is_active                   boolean DEFAULT true,
  price_per_person            numeric DEFAULT 0,
  service_charge_percentage   numeric DEFAULT 3.00,
  service_charge_percentage_whish numeric DEFAULT 3.00,
  requires_in_app_payment     boolean DEFAULT true,
  special_menu_url            text,
  created_by                  uuid,
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now(),
  CONSTRAINT restaurant_events_pkey              PRIMARY KEY (id),
  CONSTRAINT restaurant_events_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT restaurant_events_created_by_fkey   FOREIGN KEY (created_by)    REFERENCES public.profiles(id)
);


-- ──────────────────────────────────────────────────────────────
-- 7. event_occurrences  (depends on restaurant_events)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_occurrences (
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL,
  occurrence_date  date NOT NULL,
  end_date         date,
  start_time       time,
  end_time         time,
  max_capacity     integer CHECK (max_capacity IS NULL OR max_capacity > 0),
  current_bookings integer DEFAULT 0 CHECK (current_bookings >= 0),
  status           text DEFAULT 'scheduled' CHECK (status = ANY (ARRAY['scheduled','cancelled','completed','full'])),
  special_notes    text,
  override_price   numeric,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  CONSTRAINT event_occurrences_pkey         PRIMARY KEY (id),
  CONSTRAINT event_occurrences_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.restaurant_events(id)
);


-- ──────────────────────────────────────────────────────────────
-- 8. restaurant_sections  (depends on restaurants)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.restaurant_sections (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL,
  name           text NOT NULL,
  description    text,
  display_order  integer DEFAULT 0,
  is_active      boolean DEFAULT true,
  color          text DEFAULT '#3b82f6',
  icon           text DEFAULT 'grid',
  decor_items    jsonb DEFAULT '[]',
  max_covers     integer,
  min_party_size integer CHECK (min_party_size IS NULL OR min_party_size >= 1),
  max_party_size integer CHECK (max_party_size IS NULL OR max_party_size >= 1),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  CONSTRAINT restaurant_sections_pkey              PRIMARY KEY (id),
  CONSTRAINT restaurant_sections_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);


-- ──────────────────────────────────────────────────────────────
-- 9. restaurant_customers  (depends on restaurants, profiles)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.restaurant_customers (
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id         uuid NOT NULL,
  user_id               uuid,
  guest_email           text,
  guest_phone           text,
  guest_name            text,
  total_bookings        integer DEFAULT 0,
  total_spent           numeric DEFAULT 0,
  average_party_size    numeric DEFAULT 0,
  last_visit            timestamptz,
  first_visit           timestamptz,
  no_show_count         integer DEFAULT 0,
  cancelled_count       integer DEFAULT 0,
  vip_status            boolean DEFAULT false,
  blacklisted           boolean DEFAULT false,
  blacklist_reason      text,
  preferred_table_types text[],
  preferred_time_slots  text[],
  source                text DEFAULT 'manual',
  notes                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  CONSTRAINT restaurant_customers_pkey              PRIMARY KEY (id),
  CONSTRAINT restaurant_customers_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT restaurant_customers_user_id_fkey      FOREIGN KEY (user_id)        REFERENCES public.profiles(id)
);


-- ──────────────────────────────────────────────────────────────
-- 10. promo_codes  (depends on restaurants)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id       uuid,
  code                text NOT NULL,
  description         text,
  discount_type       text NOT NULL CHECK (discount_type = ANY (ARRAY['percentage','fixed_amount'])),
  discount_value      numeric NOT NULL CHECK (discount_value > 0),
  max_discount_amount numeric CHECK (max_discount_amount IS NULL OR max_discount_amount > 0),
  max_uses            integer CHECK (max_uses IS NULL OR max_uses > 0),
  max_uses_per_user   integer NOT NULL DEFAULT 1 CHECK (max_uses_per_user > 0),
  current_uses        integer NOT NULL DEFAULT 0 CHECK (current_uses >= 0),
  valid_from          timestamptz NOT NULL DEFAULT now(),
  valid_until         timestamptz NOT NULL,
  status              text NOT NULL DEFAULT 'active' CHECK (status = ANY (ARRAY['active','inactive','expired'])),
  conditions          jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_codes_pkey              PRIMARY KEY (id),
  CONSTRAINT promo_codes_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);


-- ──────────────────────────────────────────────────────────────
-- 11. bookings  (depends on all above)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookings (
  id                          uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id                     uuid,
  restaurant_id               uuid NOT NULL,
  booking_time                timestamptz NOT NULL,
  party_size                  integer NOT NULL CHECK (party_size > 0),
  status                      text NOT NULL CHECK (status = ANY (ARRAY[
    'pending','pending_payment','confirmed','cancelled_by_user',
    'declined_by_restaurant','auto_declined','completed','no_show',
    'arrived','seated','ordered','appetizers','main_course',
    'dessert','payment','cancelled_by_restaurant'
  ])),
  confirmation_code           text UNIQUE,
  special_requests            text,
  occasion                    text,
  dietary_notes               text[],
  table_preferences           text[],
  preferred_section           text,
  section_id                  uuid,
  assigned_table              text,
  turn_time_minutes           integer NOT NULL DEFAULT 120,
  reminder_sent               boolean DEFAULT false,
  checked_in_at               timestamptz,
  seated_at                   timestamptz,
  actual_end_time             timestamptz,
  loyalty_points_earned       integer DEFAULT 0,
  expected_loyalty_points     integer DEFAULT 0,
  applied_loyalty_rule_id     uuid,
  applied_offer_id            uuid,
  applied_promo_code_id       uuid,
  payment_status              text NOT NULL DEFAULT 'not_required' CHECK (payment_status = ANY (ARRAY['not_required','pending','paid','failed'])),
  payment_amount              numeric,
  payment_transaction_id      text,
  payment_expires_at          timestamptz,
  deposit_status              text NOT NULL DEFAULT 'not_required' CHECK (deposit_status = ANY (ARRAY['not_required','pending','paid','refunded','forfeited','failed'])),
  source                      text NOT NULL DEFAULT 'app',
  is_group_booking            boolean DEFAULT false,
  is_shared_booking           boolean DEFAULT false,
  is_event_booking            boolean DEFAULT false,
  organizer_id                uuid,
  attendees                   integer DEFAULT 1,
  guest_id                    uuid,
  guest_name                  text,
  guest_email                 text,
  guest_phone                 text,
  event_occurrence_id         uuid,
  meal_progress               jsonb DEFAULT '{}',
  request_expires_at          timestamptz,
  auto_declined               boolean DEFAULT false,
  acceptance_attempted_at     timestamptz,
  acceptance_failed_reason    text,
  suggested_alternative_time  timestamptz,
  suggested_alternative_tables text[],
  decline_note                text,
  declined_at                 timestamptz,
  declined_by_staff           uuid,
  declined_reason             text,
  cancelled_at                timestamptz,
  cancelled_by_staff          uuid,
  cancellation_reason         text,
  cancellation_note           text,
  rest_notes                  text CHECK (char_length(rest_notes) <= 180),
  scratch_scanned             boolean NOT NULL DEFAULT false,
  scratch_scanned_at          timestamptz,
  scratch_scanned_restaurant_id uuid,
  created_by                  uuid,
  last_modified_by            uuid,
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now(),
  CONSTRAINT bookings_pkey                        PRIMARY KEY (id),
  CONSTRAINT bookings_restaurant_id_fkey          FOREIGN KEY (restaurant_id)          REFERENCES public.restaurants(id),
  CONSTRAINT bookings_user_id_fkey                FOREIGN KEY (user_id)                REFERENCES public.profiles(id),
  CONSTRAINT bookings_applied_offer_id_fkey       FOREIGN KEY (applied_offer_id)       REFERENCES public.special_offers(id),
  CONSTRAINT bookings_applied_loyalty_rule_id_fkey FOREIGN KEY (applied_loyalty_rule_id) REFERENCES public.restaurant_loyalty_rules(id),
  CONSTRAINT bookings_event_occurrence_id_fkey    FOREIGN KEY (event_occurrence_id)    REFERENCES public.event_occurrences(id),
  CONSTRAINT bookings_section_id_fkey             FOREIGN KEY (section_id)             REFERENCES public.restaurant_sections(id),
  CONSTRAINT bookings_guest_id_fkey               FOREIGN KEY (guest_id)               REFERENCES public.restaurant_customers(id),
  CONSTRAINT bookings_applied_promo_code_id_fkey  FOREIGN KEY (applied_promo_code_id)  REFERENCES public.promo_codes(id),
  CONSTRAINT bookings_organizer_id_fkey           FOREIGN KEY (organizer_id)           REFERENCES public.profiles(id),
  CONSTRAINT bookings_cancelled_by_staff_fkey     FOREIGN KEY (cancelled_by_staff)     REFERENCES public.profiles(id),
  CONSTRAINT bookings_declined_by_staff_fkey      FOREIGN KEY (declined_by_staff)      REFERENCES public.profiles(id),
  CONSTRAINT bookings_created_by_fkey             FOREIGN KEY (created_by)             REFERENCES public.profiles(id),
  CONSTRAINT bookings_last_modified_by_fkey       FOREIGN KEY (last_modified_by)       REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS bookings_user_id_idx       ON public.bookings (user_id);
CREATE INDEX IF NOT EXISTS bookings_restaurant_id_idx ON public.bookings (restaurant_id);
CREATE INDEX IF NOT EXISTS bookings_status_idx        ON public.bookings (status);
CREATE INDEX IF NOT EXISTS bookings_booking_time_idx  ON public.bookings (booking_time);


-- ──────────────────────────────────────────────────────────────
-- 12. restaurant_open_hours  (depends on restaurants)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.restaurant_open_hours (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL,
  day_of_week    text NOT NULL CHECK (day_of_week = ANY (ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday'])),
  service_type   text NOT NULL DEFAULT 'general' CHECK (service_type = ANY (ARRAY['breakfast','lunch','dinner','general','bar','kitchen'])),
  is_open        boolean DEFAULT true,
  open_time      time,
  close_time     time,
  name           text DEFAULT '',
  accepts_walkins boolean DEFAULT true,
  notes          text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  CONSTRAINT restaurant_open_hours_pkey              PRIMARY KEY (id),
  CONSTRAINT restaurant_open_hours_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);


-- ──────────────────────────────────────────────────────────────
-- 13. restaurant_tables  (depends on restaurants, sections)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id                   uuid NOT NULL DEFAULT uuid_generate_v4(),
  restaurant_id        uuid NOT NULL,
  section_id           uuid,
  table_number         text NOT NULL,
  table_type           text NOT NULL CHECK (table_type = ANY (ARRAY['booth','window','patio','standard','bar','private','shared'])),
  capacity             integer NOT NULL CHECK (capacity > 0),
  min_capacity         integer NOT NULL,
  max_capacity         integer NOT NULL,
  x_position           double precision NOT NULL,
  y_position           double precision NOT NULL,
  shape                text DEFAULT 'rectangle' CHECK (shape = ANY (ARRAY['rectangle','circle','square'])),
  width                double precision DEFAULT 10,
  height               double precision DEFAULT 10,
  features             text[],
  is_active            boolean DEFAULT true,
  is_combinable        boolean DEFAULT true,
  combinable_with      uuid[] DEFAULT '{}',
  priority_score       integer DEFAULT 0,
  default_booking_type text NOT NULL DEFAULT 'request' CHECK (default_booking_type = ANY (ARRAY['instant','request'])),
  created_at           timestamptz DEFAULT now(),
  CONSTRAINT restaurant_tables_pkey              PRIMARY KEY (id),
  CONSTRAINT restaurant_tables_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT restaurant_tables_section_id_fkey   FOREIGN KEY (section_id)    REFERENCES public.restaurant_sections(id)
);


-- ──────────────────────────────────────────────────────────────
-- 14. booking_tables  (depends on bookings, restaurant_tables)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_tables (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id     uuid NOT NULL,
  table_id       uuid NOT NULL,
  seats_occupied integer NOT NULL DEFAULT 1 CHECK (seats_occupied > 0),
  created_at     timestamptz DEFAULT now(),
  CONSTRAINT booking_tables_pkey           PRIMARY KEY (id),
  CONSTRAINT booking_tables_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT booking_tables_table_id_fkey  FOREIGN KEY (table_id)   REFERENCES public.restaurant_tables(id)
);


-- ──────────────────────────────────────────────────────────────
-- 15. favorites  (depends on profiles, restaurants)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.favorites (
  id            uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id       uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  created_at    timestamptz DEFAULT now(),
  CONSTRAINT favorites_pkey              PRIMARY KEY (id),
  CONSTRAINT favorites_user_id_fkey      FOREIGN KEY (user_id)       REFERENCES public.profiles(id),
  CONSTRAINT favorites_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  UNIQUE (user_id, restaurant_id)
);


-- ──────────────────────────────────────────────────────────────
-- 16. reviews  (depends on bookings, restaurants, profiles)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id                   uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id           uuid NOT NULL UNIQUE,
  user_id              uuid NOT NULL,
  restaurant_id        uuid NOT NULL,
  rating               integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment              text,
  food_rating          integer CHECK (food_rating    >= 1 AND food_rating    <= 5),
  service_rating       integer CHECK (service_rating >= 1 AND service_rating <= 5),
  ambiance_rating      integer CHECK (ambiance_rating >= 1 AND ambiance_rating <= 5),
  value_rating         integer CHECK (value_rating   >= 1 AND value_rating   <= 5),
  recommend_to_friend  boolean DEFAULT false,
  visit_again          boolean DEFAULT false,
  tags                 text[],
  photos               text[],
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  CONSTRAINT reviews_pkey              PRIMARY KEY (id),
  CONSTRAINT reviews_booking_id_fkey   FOREIGN KEY (booking_id)    REFERENCES public.bookings(id),
  CONSTRAINT reviews_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT reviews_user_id_fkey      FOREIGN KEY (user_id)       REFERENCES public.profiles(id)
);


-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_groups     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_sections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_open_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_customers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_offers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_tables        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes           ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select_own"  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own"  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own"  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- restaurants (public read for active restaurants)
CREATE POLICY "restaurants_public_read"   ON public.restaurants     FOR SELECT USING (status = 'active');
CREATE POLICY "restaurant_groups_read"    ON public.restaurant_groups FOR SELECT USING (true);
CREATE POLICY "sections_public_read"      ON public.restaurant_sections   FOR SELECT USING (true);
CREATE POLICY "tables_public_read"        ON public.restaurant_tables     FOR SELECT USING (is_active = true);
CREATE POLICY "open_hours_public_read"    ON public.restaurant_open_hours FOR SELECT USING (true);
CREATE POLICY "special_offers_public_read" ON public.special_offers       FOR SELECT USING (true);
CREATE POLICY "promo_codes_public_read"   ON public.promo_codes           FOR SELECT USING (status = 'active');

-- bookings (users manage their own)
CREATE POLICY "bookings_select_own" ON public.bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bookings_insert_own" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bookings_update_own" ON public.bookings FOR UPDATE USING (auth.uid() = user_id);

-- booking_tables (readable if you own the booking)
CREATE POLICY "booking_tables_select_own" ON public.booking_tables FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()));

-- favorites
CREATE POLICY "favorites_select_own" ON public.favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "favorites_insert_own" ON public.favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "favorites_delete_own" ON public.favorites FOR DELETE USING (auth.uid() = user_id);

-- reviews (public read, own write)
CREATE POLICY "reviews_public_read" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert_own"  ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_update_own"  ON public.reviews FOR UPDATE USING (auth.uid() = user_id);

-- restaurant_customers: users see their own linked records
CREATE POLICY "restaurant_customers_select_own" ON public.restaurant_customers
  FOR SELECT USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
-- TRIGGER: auto-create profile row when a user signs up
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name',  '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ══════════════════════════════════════════════════════════════
-- HELPER: generate a short booking confirmation code
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.generate_confirmation_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.confirmation_code IS NULL THEN
    NEW.confirmation_code := upper(substring(replace(gen_random_uuid()::text, '-', '') for 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_confirmation_code ON public.bookings;
CREATE TRIGGER set_confirmation_code
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.generate_confirmation_code();
