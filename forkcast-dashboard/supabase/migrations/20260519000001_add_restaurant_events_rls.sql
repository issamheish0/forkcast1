-- Add RLS to restaurant_events and event_occurrences tables
-- This ensures only restaurant staff can manage events for their restaurant

-- Enable RLS on restaurant_events
ALTER TABLE public.restaurant_events ENABLE ROW LEVEL SECURITY;

-- Policy: Restaurant staff can view events for their restaurant
CREATE POLICY "Restaurant staff can view events"
  ON public.restaurant_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = restaurant_events.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
    )
  );

-- Policy: Only managers and owners can create events
CREATE POLICY "Restaurant staff can create events"
  ON public.restaurant_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = restaurant_events.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
      AND restaurant_staff.role IN ('owner', 'manager')
    )
  );

-- Policy: Only managers and owners can update events
CREATE POLICY "Restaurant staff can update events"
  ON public.restaurant_events
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = restaurant_events.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
      AND restaurant_staff.role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = restaurant_events.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
      AND restaurant_staff.role IN ('owner', 'manager')
    )
  );

-- Policy: Only managers and owners can delete events
CREATE POLICY "Restaurant staff can delete events"
  ON public.restaurant_events
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = restaurant_events.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
      AND restaurant_staff.role IN ('owner', 'manager')
    )
  );

-- Enable RLS on event_occurrences
ALTER TABLE public.event_occurrences ENABLE ROW LEVEL SECURITY;

-- Policy: Restaurant staff can view event occurrences for their restaurant's events
CREATE POLICY "Restaurant staff can view event occurrences"
  ON public.event_occurrences
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_events re
      INNER JOIN public.restaurant_staff rs ON rs.restaurant_id = re.restaurant_id
      WHERE re.id = event_occurrences.event_id
      AND rs.user_id = auth.uid()
      AND rs.is_active = true
    )
  );

-- Policy: Only managers and owners can create event occurrences
CREATE POLICY "Restaurant staff can create event occurrences"
  ON public.event_occurrences
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurant_events re
      INNER JOIN public.restaurant_staff rs ON rs.restaurant_id = re.restaurant_id
      WHERE re.id = event_occurrences.event_id
      AND rs.user_id = auth.uid()
      AND rs.is_active = true
      AND rs.role IN ('owner', 'manager')
    )
  );

-- Policy: Only managers and owners can update event occurrences
CREATE POLICY "Restaurant staff can update event occurrences"
  ON public.event_occurrences
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_events re
      INNER JOIN public.restaurant_staff rs ON rs.restaurant_id = re.restaurant_id
      WHERE re.id = event_occurrences.event_id
      AND rs.user_id = auth.uid()
      AND rs.is_active = true
      AND rs.role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurant_events re
      INNER JOIN public.restaurant_staff rs ON rs.restaurant_id = re.restaurant_id
      WHERE re.id = event_occurrences.event_id
      AND rs.user_id = auth.uid()
      AND rs.is_active = true
      AND rs.role IN ('owner', 'manager')
    )
  );

-- Policy: Only managers and owners can delete event occurrences
CREATE POLICY "Restaurant staff can delete event occurrences"
  ON public.event_occurrences
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_events re
      INNER JOIN public.restaurant_staff rs ON rs.restaurant_id = re.restaurant_id
      WHERE re.id = event_occurrences.event_id
      AND rs.user_id = auth.uid()
      AND rs.is_active = true
      AND rs.role IN ('owner', 'manager')
    )
  );

-- Allow anonymous users to view active event occurrences (for public bookings)
CREATE POLICY "Anonymous users can view active event occurrences"
  ON public.event_occurrences
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_events re
      WHERE re.id = event_occurrences.event_id
      AND re.is_active = true
    )
  );
