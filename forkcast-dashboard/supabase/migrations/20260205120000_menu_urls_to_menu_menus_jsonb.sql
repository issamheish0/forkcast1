-- Migrate menu_urls text[] to menu_menus jsonb (array of objects)
-- 1. Add new column
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS menu_menus jsonb DEFAULT '[]';

-- 2. Migrate existing menu_urls data (plain URLs or JSON strings)
UPDATE public.restaurants SET menu_menus = (
  SELECT jsonb_agg(
    CASE
      WHEN value LIKE '{%' THEN value::jsonb
      ELSE jsonb_build_object('url', value, 'title', null)
    END
  )
  FROM unnest(menu_urls) AS value
  WHERE value IS NOT NULL AND value <> ''
);

-- 3. Remove old column
ALTER TABLE public.restaurants DROP COLUMN IF EXISTS menu_urls;

-- 4. Add comment
COMMENT ON COLUMN public.restaurants.menu_menus IS 'Array of menu PDF objects: {url, title}';
