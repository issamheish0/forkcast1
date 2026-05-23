-- Add decor_items column to restaurant_sections
ALTER TABLE public.restaurant_sections
ADD COLUMN decor_items jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.restaurant_sections.decor_items IS 'JSON array of decor items for floor plan layout visualization';