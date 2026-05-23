-- Add RLS to special_offers, banners, and user_offers tables
-- This ensures only restaurant staff can manage offers for their restaurant

-- Enable RLS on special_offers
ALTER TABLE public.special_offers ENABLE ROW LEVEL SECURITY;

-- Policy: Restaurant staff can view special offers for their restaurant
CREATE POLICY "Restaurant staff can view offers"
  ON public.special_offers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = special_offers.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
    )
  );

-- Policy: Only managers and owners can create offers
CREATE POLICY "Restaurant staff can create offers"
  ON public.special_offers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = special_offers.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
      AND restaurant_staff.role IN ('owner', 'manager')
    )
  );

-- Policy: Only managers and owners can update offers
CREATE POLICY "Restaurant staff can update offers"
  ON public.special_offers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = special_offers.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
      AND restaurant_staff.role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = special_offers.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
      AND restaurant_staff.role IN ('owner', 'manager')
    )
  );

-- Policy: Only managers and owners can delete offers
CREATE POLICY "Restaurant staff can delete offers"
  ON public.special_offers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = special_offers.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
      AND restaurant_staff.role IN ('owner', 'manager')
    )
  );

-- Allow anonymous users to view active offers (for public bookings)
CREATE POLICY "Anonymous users can view active offers"
  ON public.special_offers
  FOR SELECT
  TO anon
  USING (
    valid_from <= now() AND valid_until >= now() AND is_clickable = true
  );

-- Enable RLS on banners
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Policy: Restaurant staff can view banners for their restaurant
CREATE POLICY "Restaurant staff can view banners"
  ON public.banners
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = banners.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
    )
  );

-- Policy: Only managers and owners can create banners
CREATE POLICY "Restaurant staff can create banners"
  ON public.banners
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = banners.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
      AND restaurant_staff.role IN ('owner', 'manager')
    )
  );

-- Policy: Only managers and owners can update banners
CREATE POLICY "Restaurant staff can update banners"
  ON public.banners
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = banners.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
      AND restaurant_staff.role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = banners.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
      AND restaurant_staff.role IN ('owner', 'manager')
    )
  );

-- Policy: Only managers and owners can delete banners
CREATE POLICY "Restaurant staff can delete banners"
  ON public.banners
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = banners.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
      AND restaurant_staff.role IN ('owner', 'manager')
    )
  );

-- Enable RLS on user_offers
ALTER TABLE public.user_offers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own offers
CREATE POLICY "Users can view their own offers"
  ON public.user_offers
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- Policy: Restaurant staff can insert user offers (when redeeming)
CREATE POLICY "Restaurant staff can create user offers"
  ON public.user_offers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.special_offers so
      INNER JOIN public.restaurant_staff rs ON rs.restaurant_id = so.restaurant_id
      WHERE so.id = user_offers.offer_id
      AND rs.user_id = auth.uid()
      AND rs.is_active = true
    )
  );

-- Policy: Users can see their own, staff can manage for their restaurant
CREATE POLICY "Users can see own offers"
  ON public.user_offers
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.special_offers so
      INNER JOIN public.restaurant_staff rs ON rs.restaurant_id = so.restaurant_id
      WHERE so.id = user_offers.offer_id
      AND rs.user_id = auth.uid()
      AND rs.is_active = true
      AND rs.role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.special_offers so
      INNER JOIN public.restaurant_staff rs ON rs.restaurant_id = so.restaurant_id
      WHERE so.id = user_offers.offer_id
      AND rs.user_id = auth.uid()
      AND rs.is_active = true
      AND rs.role IN ('owner', 'manager')
    )
  );

-- Policy: Staff can delete user offers for their restaurant
CREATE POLICY "Staff can delete user offers"
  ON public.user_offers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.special_offers so
      INNER JOIN public.restaurant_staff rs ON rs.restaurant_id = so.restaurant_id
      WHERE so.id = user_offers.offer_id
      AND rs.user_id = auth.uid()
      AND rs.is_active = true
      AND rs.role IN ('owner', 'manager')
    )
  );
