-- Restaurant Ramadan settings and special menus
-- Note: ramadan_restaurants table already exists (for admin tagging)
-- This migration adds restaurant-specific Ramadan menu management tables

-- Ramadan restaurant settings table (extends the admin ramadan_restaurants with more details)
CREATE TABLE IF NOT EXISTS public.restaurant_ramadan_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  is_ramadan_active boolean DEFAULT false,
  iftar_time text, -- e.g., "18:30"
  suhoor_time text, -- e.g., "04:00"
  iftar_description text,
  suhoor_description text,
  special_message text, -- Welcome/Ramadan Mubarak message
  accepts_iftar boolean DEFAULT false,
  accepts_suhoor boolean DEFAULT false,
  iftar_price_per_person numeric(10,2),
  suhoor_price_per_person numeric(10,2),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT restaurant_ramadan_settings_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_ramadan_settings_restaurant_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE,
  CONSTRAINT restaurant_ramadan_settings_unique UNIQUE (restaurant_id)
);

-- Ramadan special menu items
CREATE TABLE IF NOT EXISTS public.ramadan_menu_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  name text NOT NULL,
  name_ar text, -- Arabic name
  description text,
  description_ar text, -- Arabic description
  price numeric(10,2) NOT NULL,
  image_url text,
  category text NOT NULL, -- 'iftar', 'suhoor', 'dates', 'beverages', 'desserts'
  is_available boolean DEFAULT true,
  is_popular boolean DEFAULT false,
  dietary_info text[], -- 'vegetarian', 'vegan', 'halal', etc.
  serves_count integer DEFAULT 1, -- How many people it serves
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ramadan_menu_items_pkey PRIMARY KEY (id),
  CONSTRAINT ramadan_menu_items_restaurant_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE
);

-- Ramadan special packages (Iftar/Suhoor sets)
CREATE TABLE IF NOT EXISTS public.ramadan_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  name text NOT NULL,
  name_ar text,
  description text,
  description_ar text,
  type text NOT NULL, -- 'iftar', 'suhoor', 'family', 'group'
  price_per_person numeric(10,2) NOT NULL,
  min_guests integer DEFAULT 1,
  max_guests integer,
  includes text[], -- List of items included
  image_url text,
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  valid_from date,
  valid_until date,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ramadan_packages_pkey PRIMARY KEY (id),
  CONSTRAINT ramadan_packages_restaurant_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ramadan_settings_restaurant ON public.restaurant_ramadan_settings(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_ramadan_menu_restaurant ON public.ramadan_menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_ramadan_menu_category ON public.ramadan_menu_items(category);
CREATE INDEX IF NOT EXISTS idx_ramadan_packages_restaurant ON public.ramadan_packages(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_ramadan_packages_type ON public.ramadan_packages(type);

-- Enable RLS
ALTER TABLE public.restaurant_ramadan_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ramadan_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ramadan_packages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for restaurant_ramadan_settings
CREATE POLICY "Public can view active ramadan settings"
  ON public.restaurant_ramadan_settings
  FOR SELECT
  USING (is_ramadan_active = true);

CREATE POLICY "Restaurant staff can view their ramadan settings"
  ON public.restaurant_ramadan_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = restaurant_ramadan_settings.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
    )
  );

CREATE POLICY "Restaurant staff can manage their ramadan settings"
  ON public.restaurant_ramadan_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = restaurant_ramadan_settings.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = restaurant_ramadan_settings.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
    )
  );

-- RLS Policies for ramadan_menu_items
CREATE POLICY "Public can view available ramadan menu items"
  ON public.ramadan_menu_items
  FOR SELECT
  USING (is_available = true);

CREATE POLICY "Restaurant staff can view their ramadan menu"
  ON public.ramadan_menu_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = ramadan_menu_items.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
    )
  );

CREATE POLICY "Restaurant staff can manage their ramadan menu"
  ON public.ramadan_menu_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = ramadan_menu_items.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = ramadan_menu_items.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
    )
  );

-- RLS Policies for ramadan_packages
CREATE POLICY "Public can view active ramadan packages"
  ON public.ramadan_packages
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Restaurant staff can view their ramadan packages"
  ON public.ramadan_packages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = ramadan_packages.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
    )
  );

CREATE POLICY "Restaurant staff can manage their ramadan packages"
  ON public.ramadan_packages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = ramadan_packages.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurant_staff
      WHERE restaurant_staff.restaurant_id = ramadan_packages.restaurant_id
      AND restaurant_staff.user_id = auth.uid()
      AND restaurant_staff.is_active = true
    )
  );

-- Comments
COMMENT ON TABLE public.restaurant_ramadan_settings IS 'Restaurant-specific Ramadan settings including Iftar/Suhoor times and pricing';
COMMENT ON TABLE public.ramadan_menu_items IS 'Special Ramadan menu items offered by restaurants';
COMMENT ON TABLE public.ramadan_packages IS 'Ramadan special packages (Iftar sets, family deals, etc.)';
