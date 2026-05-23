-- Convert menu_url from text to text[] to support multiple menus
-- This allows restaurants to upload multiple PDF menus

-- First, rename the old column and create new array column
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS menu_urls text[] DEFAULT '{}';

-- Migrate existing data: if menu_url has a value, add it to the array
UPDATE public.restaurants 
SET menu_urls = ARRAY[menu_url]
WHERE menu_url IS NOT NULL AND menu_url != '';

-- Add comment
COMMENT ON COLUMN public.restaurants.menu_urls IS 'Array of menu PDF URLs for the restaurant';
