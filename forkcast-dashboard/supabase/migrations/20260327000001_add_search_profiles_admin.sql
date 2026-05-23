-- Add search_profiles_admin RPC function for admin searches
-- This function allows admins to search profiles by bypassing RLS to avoid statement timeouts
-- Used in: admin page, staff management, customer search, waitlist views

CREATE OR REPLACE FUNCTION search_profiles_admin(search_query TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  phone_number TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.phone_number
  FROM profiles p
  WHERE search_query IS NOT NULL
    AND search_query != ''
    AND (
      p.full_name ILIKE '%' || search_query || '%'
      OR p.email ILIKE '%' || search_query || '%'
      OR p.phone_number ILIKE '%' || search_query || '%'
    )
  ORDER BY 
    CASE 
      WHEN p.full_name ILIKE search_query THEN 0
      WHEN p.email ILIKE search_query THEN 1
      ELSE 2
    END,
    p.full_name ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users only
GRANT EXECUTE ON FUNCTION search_profiles_admin(TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION search_profiles_admin(search_query TEXT) IS 
'Search profiles by name, email, or phone bypassing RLS for admin operations. Returns up to 50 results, prioritizing exact matches.';
