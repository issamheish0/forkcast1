-- scripts/create-restaurant-shifts-table.sql
-- Creates the restaurant_shifts table for floorplan shift filtering.
-- Shifts are named operational time windows (breakfast/lunch/dinner/walkin/custom)
-- used to scope the floorplan view. Distinct from restaurant_open_hours
-- (physical open hours) and restaurant_hours (booking availability windows).

-- 1. Table definition
CREATE TABLE IF NOT EXISTS public.restaurant_shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  name text NOT NULL,
  shift_type text NOT NULL DEFAULT 'custom'
    CHECK (shift_type = ANY (ARRAY['breakfast','lunch','dinner','walkin','custom']::text[])),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  color text,
  applicable_days integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6]::integer[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT restaurant_shifts_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_shifts_restaurant_id_fkey
    FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE,
  CONSTRAINT restaurant_shifts_valid_times CHECK (end_time > start_time),
  CONSTRAINT restaurant_shifts_name_not_empty CHECK (length(trim(name)) > 0)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_restaurant_shifts_active
  ON public.restaurant_shifts(restaurant_id, is_active, display_order);

CREATE INDEX IF NOT EXISTS idx_restaurant_shifts_restaurant
  ON public.restaurant_shifts(restaurant_id);

-- 3. Row Level Security
-- Note: PostgREST requires table-level GRANTs even with RLS — without these,
-- clients get a 403 "permission denied" before the policy is evaluated.
ALTER TABLE public.restaurant_shifts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_shifts TO authenticated, service_role;
GRANT SELECT ON public.restaurant_shifts TO anon;

-- Staff can view all shifts for their restaurant
DROP POLICY IF EXISTS "Staff can view restaurant shifts" ON public.restaurant_shifts;
CREATE POLICY "Staff can view restaurant shifts" ON public.restaurant_shifts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE user_id = auth.uid()
        AND restaurant_id = restaurant_shifts.restaurant_id
        AND is_active = true
    )
  );

-- Only managers and owners can create/update/delete shifts
DROP POLICY IF EXISTS "Managers can manage restaurant shifts" ON public.restaurant_shifts;
CREATE POLICY "Managers can manage restaurant shifts" ON public.restaurant_shifts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE user_id = auth.uid()
        AND restaurant_id = restaurant_shifts.restaurant_id
        AND is_active = true
        AND role IN ('owner', 'manager')
    )
  );

-- 4. Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_restaurant_shifts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS restaurant_shifts_updated_at ON public.restaurant_shifts;
CREATE TRIGGER restaurant_shifts_updated_at
  BEFORE UPDATE ON public.restaurant_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_restaurant_shifts_updated_at();

-- 5. Atomic bulk-replace RPC: delete + insert inside a single transaction so a
--    failed insert can't leave a restaurant with zero shifts.
CREATE OR REPLACE FUNCTION public.bulk_replace_restaurant_shifts(
  p_restaurant_id uuid,
  p_shifts jsonb
)
RETURNS SETOF public.restaurant_shifts
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_is_manager boolean;
BEGIN
  -- Authorization: only managers/owners of this restaurant can bulk-replace
  SELECT EXISTS (
    SELECT 1 FROM public.restaurant_staff
    WHERE user_id = auth.uid()
      AND restaurant_id = p_restaurant_id
      AND is_active = true
      AND role IN ('owner', 'manager')
  ) INTO v_is_manager;

  IF NOT v_is_manager THEN
    RAISE EXCEPTION 'Only owners/managers can manage shifts';
  END IF;

  DELETE FROM public.restaurant_shifts WHERE restaurant_id = p_restaurant_id;

  IF p_shifts IS NOT NULL AND jsonb_array_length(p_shifts) > 0 THEN
    INSERT INTO public.restaurant_shifts (
      restaurant_id, name, shift_type, start_time, end_time,
      is_active, display_order, color, applicable_days
    )
    SELECT
      p_restaurant_id,
      (s->>'name')::text,
      COALESCE((s->>'shift_type')::text, 'custom'),
      (s->>'start_time')::time,
      (s->>'end_time')::time,
      COALESCE((s->>'is_active')::boolean, true),
      COALESCE((s->>'display_order')::integer, 0),
      NULLIF(s->>'color', ''),
      COALESCE(
        (SELECT array_agg((v)::integer) FROM jsonb_array_elements_text(s->'applicable_days') v),
        ARRAY[0,1,2,3,4,5,6]
      )
    FROM jsonb_array_elements(p_shifts) s;
  END IF;

  RETURN QUERY
    SELECT * FROM public.restaurant_shifts
    WHERE restaurant_id = p_restaurant_id
    ORDER BY display_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_replace_restaurant_shifts(uuid, jsonb)
  TO authenticated, service_role;

-- 6. Seed default shifts for existing restaurants without any
INSERT INTO public.restaurant_shifts (restaurant_id, name, shift_type, start_time, end_time, display_order, color)
SELECT
  r.id,
  shift.name,
  shift.shift_type,
  shift.start_time::time,
  shift.end_time::time,
  shift.display_order,
  shift.color
FROM public.restaurants r
CROSS JOIN (VALUES
  ('Breakfast',       'breakfast', '07:00', '11:00', 0, '#f59e0b'),
  ('Lunch',           'lunch',     '11:30', '15:00', 1, '#10b981'),
  ('Dinner',          'dinner',    '17:00', '22:00', 2, '#8b5cf6'),
  ('Walk-in Window',  'walkin',    '15:00', '17:00', 3, '#3b82f6')
) AS shift(name, shift_type, start_time, end_time, display_order, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.restaurant_shifts rs WHERE rs.restaurant_id = r.id
);

-- 7. Verification
DO $$
DECLARE
  total_shifts integer;
  restaurants_with_shifts integer;
BEGIN
  SELECT COUNT(*) INTO total_shifts FROM public.restaurant_shifts;
  SELECT COUNT(DISTINCT restaurant_id) INTO restaurants_with_shifts FROM public.restaurant_shifts;
  RAISE NOTICE 'restaurant_shifts migration complete: % shifts across % restaurants', total_shifts, restaurants_with_shifts;
END $$;
