-- RPC functions for admin profile listing that bypass expensive per-row RLS
-- on the 20k+ profiles table (avoids statement timeout 57014).
-- Both functions use SECURITY DEFINER and validate admin access via auth.uid().

-- count_profiles_admin: returns filtered count for pagination
CREATE OR REPLACE FUNCTION public.count_profiles_admin(
  p_tier TEXT DEFAULT NULL,
  p_rating_min NUMERIC DEFAULT NULL,
  p_rating_max NUMERIC DEFAULT NULL,
  p_created_from TIMESTAMPTZ DEFAULT NULL,
  p_created_to TIMESTAMPTZ DEFAULT NULL,
  p_points_min INTEGER DEFAULT NULL,
  p_points_max INTEGER DEFAULT NULL,
  p_user_ids UUID[] DEFAULT NULL,
  p_exclude_user_ids UUID[] DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.rbs_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT COUNT(*) INTO result
  FROM public.profiles p
  WHERE (p_tier IS NULL OR p.membership_tier = p_tier)
    AND (p_rating_min IS NULL OR p.user_rating >= p_rating_min)
    AND (p_rating_max IS NULL OR p.user_rating < p_rating_max)
    AND (p_created_from IS NULL OR p.created_at >= p_created_from)
    AND (p_created_to IS NULL OR p.created_at <= p_created_to)
    AND (p_points_min IS NULL OR p.loyalty_points >= p_points_min)
    AND (p_points_max IS NULL OR p.loyalty_points <= p_points_max)
    AND (p_user_ids IS NULL OR p.id = ANY(p_user_ids))
    AND (p_exclude_user_ids IS NULL OR NOT (p.id = ANY(p_exclude_user_ids)));

  RETURN COALESCE(result, 0);
END;
$$;

-- list_profiles_admin: returns paginated profiles with filters
CREATE OR REPLACE FUNCTION public.list_profiles_admin(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_tier TEXT DEFAULT NULL,
  p_rating_min NUMERIC DEFAULT NULL,
  p_rating_max NUMERIC DEFAULT NULL,
  p_created_from TIMESTAMPTZ DEFAULT NULL,
  p_created_to TIMESTAMPTZ DEFAULT NULL,
  p_points_min INTEGER DEFAULT NULL,
  p_points_max INTEGER DEFAULT NULL,
  p_user_ids UUID[] DEFAULT NULL,
  p_exclude_user_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  phone_number TEXT,
  avatar_url TEXT,
  allergies TEXT[],
  favorite_cuisines TEXT[],
  dietary_restrictions TEXT[],
  preferred_party_size INTEGER,
  loyalty_points INTEGER,
  membership_tier TEXT,
  user_rating NUMERIC,
  total_bookings INTEGER,
  completed_bookings INTEGER,
  cancelled_bookings INTEGER,
  no_show_bookings INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.rbs_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.email, p.full_name, p.phone_number, p.avatar_url,
    p.allergies, p.favorite_cuisines, p.dietary_restrictions,
    p.preferred_party_size, p.loyalty_points, p.membership_tier,
    p.user_rating, p.total_bookings, p.completed_bookings,
    p.cancelled_bookings, p.no_show_bookings, p.created_at, p.updated_at
  FROM public.profiles p
  WHERE (p_tier IS NULL OR p.membership_tier = p_tier)
    AND (p_rating_min IS NULL OR p.user_rating >= p_rating_min)
    AND (p_rating_max IS NULL OR p.user_rating < p_rating_max)
    AND (p_created_from IS NULL OR p.created_at >= p_created_from)
    AND (p_created_to IS NULL OR p.created_at <= p_created_to)
    AND (p_points_min IS NULL OR p.loyalty_points >= p_points_min)
    AND (p_points_max IS NULL OR p.loyalty_points <= p_points_max)
    AND (p_user_ids IS NULL OR p.id = ANY(p_user_ids))
    AND (p_exclude_user_ids IS NULL OR NOT (p.id = ANY(p_exclude_user_ids)))
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permissions to authenticated users (admin check is inside function body)
GRANT EXECUTE ON FUNCTION public.count_profiles_admin(TEXT, NUMERIC, NUMERIC, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, UUID[], UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_profiles_admin(INTEGER, INTEGER, TEXT, NUMERIC, NUMERIC, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, UUID[], UUID[]) TO authenticated;
