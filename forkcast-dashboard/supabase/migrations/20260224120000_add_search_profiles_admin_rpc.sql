-- RPC function for admin profile search that bypasses RLS.
-- Direct client-side ILIKE queries on 20k+ profiles with per-row RLS
-- cause PostgreSQL statement timeouts (error 57014). This SECURITY DEFINER
-- function runs as the DB owner, skipping RLS, but validates admin access
-- via auth.uid() before executing.

CREATE OR REPLACE FUNCTION public.search_profiles_admin(search_query text)
RETURNS TABLE (id uuid, full_name text, email text, phone_number text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Verify caller is an rbs_admin
  IF NOT EXISTS (
    SELECT 1 FROM public.rbs_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Require at least 2 characters
  IF length(trim(search_query)) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.email, p.phone_number
  FROM public.profiles p
  WHERE p.full_name ILIKE '%' || trim(search_query) || '%'
    OR p.email ILIKE '%' || trim(search_query) || '%'
    OR p.phone_number ILIKE '%' || trim(search_query) || '%'
    OR (position(' ' in trim(search_query)) > 0
        AND p.first_name ILIKE '%' || split_part(trim(search_query), ' ', 1) || '%'
        AND p.last_name ILIKE '%' || split_part(trim(search_query), ' ', 2) || '%')
  LIMIT 50;
END;
$$;

-- Allow any authenticated user to call; the function body enforces admin check
GRANT EXECUTE ON FUNCTION public.search_profiles_admin(text) TO authenticated;
