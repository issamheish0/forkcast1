-- Add min/max party size to restaurant_sections
-- These override the restaurant-level min/max_party_size when set
ALTER TABLE public.restaurant_sections
  ADD COLUMN IF NOT EXISTS min_party_size integer,
  ADD COLUMN IF NOT EXISTS max_party_size integer;

-- Ensure min <= max when both are set
ALTER TABLE public.restaurant_sections
  ADD CONSTRAINT restaurant_sections_party_size_check
    CHECK (
      min_party_size IS NULL
      OR max_party_size IS NULL
      OR min_party_size <= max_party_size
    );

-- Ensure positive values
ALTER TABLE public.restaurant_sections
  ADD CONSTRAINT restaurant_sections_min_party_size_positive
    CHECK (min_party_size IS NULL OR min_party_size >= 1);

ALTER TABLE public.restaurant_sections
  ADD CONSTRAINT restaurant_sections_max_party_size_positive
    CHECK (max_party_size IS NULL OR max_party_size >= 1);
