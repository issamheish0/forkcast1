-- Create ramadan_restaurants table to tag restaurants offering Ramadan specials
-- This table allows admins to manage which restaurants appear in the Ramadan section
-- of the mobile app, including their Iftar/Suhoor offerings

CREATE TABLE IF NOT EXISTS public.ramadan_restaurants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  offers_iftar boolean DEFAULT true,
  offers_suhoor boolean DEFAULT false,
  special_menu_url text,
  notes text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ramadan_restaurants_pkey PRIMARY KEY (id),
  CONSTRAINT ramadan_restaurants_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE,
  CONSTRAINT ramadan_restaurants_unique UNIQUE (restaurant_id, year)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_ramadan_restaurants_year ON public.ramadan_restaurants(year);
CREATE INDEX IF NOT EXISTS idx_ramadan_restaurants_active ON public.ramadan_restaurants(is_active);
CREATE INDEX IF NOT EXISTS idx_ramadan_restaurants_display_order ON public.ramadan_restaurants(display_order);

-- Enable RLS
ALTER TABLE public.ramadan_restaurants ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for mobile app)
CREATE POLICY "Allow public read access on ramadan_restaurants"
  ON public.ramadan_restaurants
  FOR SELECT
  USING (true);

-- Allow authenticated users to manage (for admin purposes)
CREATE POLICY "Allow authenticated users to manage ramadan_restaurants"
  ON public.ramadan_restaurants
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.ramadan_restaurants IS 'Tracks restaurants offering Ramadan specials (Iftar/Suhoor) for each year';
COMMENT ON COLUMN public.ramadan_restaurants.offers_iftar IS 'Whether the restaurant offers Iftar (evening meal to break fast)';
COMMENT ON COLUMN public.ramadan_restaurants.offers_suhoor IS 'Whether the restaurant offers Suhoor (pre-dawn meal)';
COMMENT ON COLUMN public.ramadan_restaurants.display_order IS 'Order in which restaurants appear in the Ramadan section (lower = first)';
