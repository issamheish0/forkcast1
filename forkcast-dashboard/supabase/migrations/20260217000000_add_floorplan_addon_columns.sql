-- Migration: Add floor plan add-on columns
-- Adds missing columns needed for the floor plan add-on feature:
--   1. max_covers on restaurant_sections (section capacity limit)
--   2. default_booking_type on restaurant_tables (instant vs request)
--   3. table_booking_rules table (conditional booking type rules per table)
--   4. section_id on bookings (FK to section for section-based bookings)

-- 1. Add max_covers to restaurant_sections
ALTER TABLE public.restaurant_sections
  ADD COLUMN IF NOT EXISTS max_covers integer DEFAULT NULL;

COMMENT ON COLUMN public.restaurant_sections.max_covers IS
  'Manual override for maximum covers in this section. NULL = auto-computed from sum of table capacities.';

-- 2. Add default_booking_type to restaurant_tables
ALTER TABLE public.restaurant_tables
  ADD COLUMN IF NOT EXISTS default_booking_type text NOT NULL DEFAULT 'request'
  CHECK (default_booking_type IN ('instant', 'request'));

COMMENT ON COLUMN public.restaurant_tables.default_booking_type IS
  'Default booking type for this table: instant (auto-confirm) or request (requires approval).';

-- 3. Create table_booking_rules table
CREATE TABLE IF NOT EXISTS public.table_booking_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  booking_type text NOT NULL CHECK (booking_type IN ('instant', 'request')),
  conditions jsonb NOT NULL DEFAULT '[]',
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_table_booking_rules_table_id ON public.table_booking_rules(table_id);
CREATE INDEX IF NOT EXISTS idx_table_booking_rules_restaurant_id ON public.table_booking_rules(restaurant_id);

COMMENT ON TABLE public.table_booking_rules IS
  'Conditional booking type rules per table. Rules are evaluated by priority (highest first). Conditions are AND-combined.';

-- RLS for table_booking_rules
ALTER TABLE public.table_booking_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff can manage table booking rules"
  ON public.table_booking_rules
  FOR ALL
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.restaurant_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM public.restaurant_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Authenticated users can read table booking rules"
  ON public.table_booking_rules
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 4. Add section_id FK to bookings table (section the booking is associated with)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.restaurant_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_section_id ON public.bookings(section_id);

COMMENT ON COLUMN public.bookings.section_id IS
  'The restaurant section this booking is associated with. Set when user selects a section during booking.';
