-- Add special_menu_url to restaurant_events
-- This allows events like Ramadan Iftar to have PDF menus

-- Add special_menu_url column (URL to PDF in storage)
ALTER TABLE public.restaurant_events 
ADD COLUMN IF NOT EXISTS special_menu_url text;

-- Add comment
COMMENT ON COLUMN public.restaurant_events.special_menu_url IS 'URL to PDF menu file stored in Supabase Storage';
