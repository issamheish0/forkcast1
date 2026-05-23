-- Add RLS to restaurant_sections table
-- This ensures only restaurant staff can manage sections for their restaurant

ALTER TABLE public.restaurant_sections ENABLE ROW LEVEL SECURITY;

-- Policy: Restaurant staff can view sections for their restaurant
CREATE POLICY "Restaurant staff can view sections"
  ON public.restaurant_sections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = restaurant_sections.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
    )
  );

-- Policy: Restaurant staff can insert sections for their restaurant
CREATE POLICY "Restaurant staff can create sections"
  ON public.restaurant_sections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = restaurant_sections.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
    )
  );

-- Policy: Restaurant staff can update sections for their restaurant
CREATE POLICY "Restaurant staff can update sections"
  ON public.restaurant_sections
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = restaurant_sections.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = restaurant_sections.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
    )
  );

-- Policy: Restaurant staff can delete sections for their restaurant
CREATE POLICY "Restaurant staff can delete sections"
  ON public.restaurant_sections
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = restaurant_sections.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
    )
  );

-- Allow anonymous users to view active sections (for public menu/reservations)
CREATE POLICY "Anonymous users can view active sections"
  ON public.restaurant_sections
  FOR SELECT
  TO anon
  USING (is_active = true);
