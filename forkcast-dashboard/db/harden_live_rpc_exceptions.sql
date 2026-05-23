-- =============================================================================
-- Harden Live DB RPC Functions Against Information Leakage
-- Run batches directly in the Supabase SQL editor.
-- Pattern used throughout:
--   WHEN SQLSTATE 'P0001' THEN RAISE;   -- re-raise intentional app errors
--   WHEN OTHERS THEN RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
-- =============================================================================

-- =============================================================================
-- BATCH 1 of 13: Functions that already have EXCEPTION blocks but LEAK details
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. merge_customers
--    FIX: Inner EXCEPTION was: RAISE EXCEPTION 'Error during customer merge: %', SQLERRM
--         → replaced with generic message. Outer EXCEPTION added too.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.merge_customers(
    p_target_customer_id uuid,
    p_source_customer_id uuid,
    p_restaurant_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_target_customer restaurant_customers%ROWTYPE;
    v_source_customer restaurant_customers%ROWTYPE;
    v_merged_data RECORD;
BEGIN
    IF p_target_customer_id = p_source_customer_id THEN
        RAISE EXCEPTION 'Cannot merge a customer with itself';
    END IF;

    SELECT * INTO v_target_customer
    FROM restaurant_customers
    WHERE id = p_target_customer_id AND restaurant_id = p_restaurant_id;

    SELECT * INTO v_source_customer
    FROM restaurant_customers
    WHERE id = p_source_customer_id AND restaurant_id = p_restaurant_id;

    IF NOT FOUND OR v_target_customer.id IS NULL OR v_source_customer.id IS NULL THEN
        RAISE EXCEPTION 'One or both customers not found';
    END IF;

    IF v_target_customer.user_id IS NOT NULL AND v_source_customer.user_id IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot merge two registered users';
    END IF;

    SELECT
        v_target_customer.total_bookings + v_source_customer.total_bookings AS total_bookings,
        v_target_customer.total_spent + v_source_customer.total_spent AS total_spent,
        v_target_customer.no_show_count + v_source_customer.no_show_count AS no_show_count,
        v_target_customer.cancelled_count + v_source_customer.cancelled_count AS cancelled_count,
        CASE
            WHEN v_target_customer.first_visit IS NOT NULL AND v_source_customer.first_visit IS NOT NULL
                THEN LEAST(v_target_customer.first_visit, v_source_customer.first_visit)
            ELSE COALESCE(v_target_customer.first_visit, v_source_customer.first_visit)
        END AS first_visit,
        CASE
            WHEN v_target_customer.last_visit IS NOT NULL AND v_source_customer.last_visit IS NOT NULL
                THEN GREATEST(v_target_customer.last_visit, v_source_customer.last_visit)
            ELSE COALESCE(v_target_customer.last_visit, v_source_customer.last_visit)
        END AS last_visit,
        CASE
            WHEN (v_target_customer.total_bookings + v_source_customer.total_bookings) > 0 THEN
                ((v_target_customer.average_party_size * v_target_customer.total_bookings) +
                 (v_source_customer.average_party_size * v_source_customer.total_bookings)) /
                (v_target_customer.total_bookings + v_source_customer.total_bookings)
            ELSE 0
        END AS average_party_size,
        (v_target_customer.vip_status OR v_source_customer.vip_status) AS vip_status,
        (v_target_customer.blacklisted OR v_source_customer.blacklisted) AS blacklisted,
        COALESCE(v_target_customer.blacklist_reason, v_source_customer.blacklist_reason) AS blacklist_reason,
        COALESCE(v_target_customer.preferred_table_types, v_source_customer.preferred_table_types) AS preferred_table_types,
        COALESCE(v_target_customer.preferred_time_slots, v_source_customer.preferred_time_slots) AS preferred_time_slots,
        COALESCE(v_target_customer.guest_name, v_source_customer.guest_name) AS guest_name,
        COALESCE(v_target_customer.guest_email, v_source_customer.guest_email) AS guest_email,
        COALESCE(v_target_customer.guest_phone, v_source_customer.guest_phone) AS guest_phone,
        CASE
            WHEN v_target_customer.user_id IS NOT NULL THEN v_target_customer.user_id
            WHEN v_source_customer.user_id IS NOT NULL THEN v_source_customer.user_id
            ELSE NULL
        END AS user_id
    INTO v_merged_data;

    BEGIN
        UPDATE customer_notes
            SET customer_id = p_target_customer_id
            WHERE customer_id = p_source_customer_id;

        UPDATE customer_tag_assignments
            SET customer_id = p_target_customer_id
            WHERE customer_id = p_source_customer_id;

        UPDATE customer_preferences
            SET customer_id = p_target_customer_id
            WHERE customer_id = p_source_customer_id;

        UPDATE customer_relationships
            SET customer_id = p_target_customer_id
            WHERE customer_id = p_source_customer_id;

        UPDATE customer_relationships
            SET related_customer_id = p_target_customer_id
            WHERE related_customer_id = p_source_customer_id;

        UPDATE bookings
        SET
            guest_name  = v_merged_data.guest_name,
            guest_email = v_merged_data.guest_email,
            guest_phone = v_merged_data.guest_phone
        WHERE guest_name    = v_source_customer.guest_name
          AND guest_email   = v_source_customer.guest_email
          AND restaurant_id = p_restaurant_id;

        DELETE FROM restaurant_customers WHERE id = p_source_customer_id;

        UPDATE restaurant_customers
        SET
            user_id              = v_merged_data.user_id,
            total_bookings       = v_merged_data.total_bookings,
            total_spent          = v_merged_data.total_spent,
            average_party_size   = v_merged_data.average_party_size,
            last_visit           = v_merged_data.last_visit,
            first_visit          = v_merged_data.first_visit,
            no_show_count        = v_merged_data.no_show_count,
            cancelled_count      = v_merged_data.cancelled_count,
            vip_status           = v_merged_data.vip_status,
            blacklisted          = v_merged_data.blacklisted,
            blacklist_reason     = v_merged_data.blacklist_reason,
            preferred_table_types= v_merged_data.preferred_table_types,
            preferred_time_slots = v_merged_data.preferred_time_slots,
            guest_name           = v_merged_data.guest_name,
            guest_email          = v_merged_data.guest_email,
            guest_phone          = v_merged_data.guest_phone,
            updated_at           = NOW()
        WHERE id = p_target_customer_id;

    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
    END;

EXCEPTION
    WHEN SQLSTATE 'P0001' THEN RAISE;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;


-- ---------------------------------------------------------------------------
-- 2. admin_retry_notifications
--    FIX: EXCEPTION block was returning 'error', SQLERRM  → generic message.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_retry_notifications(p_notification_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE notification_outbox
  SET
    status       = 'queued',
    error        = NULL,
    retry_count  = COALESCE(retry_count, 0) + 1,
    scheduled_for = now()
  WHERE id = ANY(p_notification_ids)
    AND status = 'failed';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success',          true,
    'queued_for_retry', v_updated
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'An unexpected error occurred.'
    );
END;
$$;


-- ---------------------------------------------------------------------------
-- 3. delete_user_account
--    FIX: EXCEPTION block was returning SQLERRM and SQLSTATE → generic message.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF EXISTS (SELECT 1 FROM public.restaurant_staff WHERE user_id = v_user_id) THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Cannot delete account with active staff roles. Please contact support.',
            'code',    'STAFF_ROLES_EXIST'
        );
    END IF;

    DELETE FROM public.notifications WHERE user_id = v_user_id;
    DELETE FROM auth.users WHERE id = v_user_id;

    RETURN json_build_object(
        'success', true,
        'message', 'Account permanently deleted'
    );
EXCEPTION
    WHEN SQLSTATE 'P0001' THEN RAISE;
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', 'An unexpected error occurred.',
            'code',    'INTERNAL_ERROR'
        );
END;
$$;


-- ---------------------------------------------------------------------------
-- 4. soft_delete_user_account
--    FIX: EXCEPTION block was returning SQLERRM and SQLSTATE → generic message.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_user_account()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.profiles
    SET
        status     = 'deactivated',
        updated_at = now()
    WHERE id = v_user_id;

    INSERT INTO public.audit_logs (
        user_id, action, table_name, record_id, metadata
    ) VALUES (
        v_user_id, 'soft_delete', 'users', v_user_id,
        json_build_object('timestamp', now())
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Account deactivated successfully'
    );
EXCEPTION
    WHEN SQLSTATE 'P0001' THEN RAISE;
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', 'An unexpected error occurred.',
            'code',    'INTERNAL_ERROR'
        );
END;
$$;


-- ---------------------------------------------------------------------------
-- 5. create_audit_log
--    FIX: Had WHEN check_violation only → WHEN OTHERS added to catch everything else.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_audit_log(
    p_actor_id        uuid,
    p_actor_type      text,
    p_action          text,
    p_action_category text,
    p_entity_type     text,
    p_entity_id       uuid    DEFAULT NULL,
    p_restaurant_id   uuid    DEFAULT NULL,
    p_old_values      jsonb   DEFAULT NULL,
    p_new_values      jsonb   DEFAULT NULL,
    p_metadata        jsonb   DEFAULT '{}',
    p_severity        text    DEFAULT 'info'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log_id            uuid;
  v_effective_actor_id uuid := p_actor_id;
BEGIN
  IF p_actor_type = 'user' AND v_effective_actor_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_effective_actor_id) THEN
      v_effective_actor_id := NULL;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    actor_id, actor_type, action, action_category,
    entity_type, entity_id, restaurant_id,
    old_values, new_values, metadata, severity
  ) VALUES (
    v_effective_actor_id, p_actor_type, p_action, p_action_category,
    p_entity_type, p_entity_id, p_restaurant_id,
    p_old_values, p_new_values, p_metadata, p_severity
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;

EXCEPTION
  WHEN check_violation THEN
    RAISE EXCEPTION 'Invalid request payload. Validation failed.' USING ERRCODE = '22000';
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;


-- =============================================================================
-- BATCH 3 of 6: plpgsql — customers, users, analytics
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 11. search_customers_fuzzy
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_customers_fuzzy(
    p_restaurant_id uuid,
    p_search_term   text,
    p_limit         integer DEFAULT 10
)
RETURNS TABLE(
    id uuid, user_id uuid, guest_name text, guest_email text, guest_phone text,
    total_bookings integer, total_spent numeric, vip_status boolean, blacklisted boolean,
    preferred_table_types text[], preferred_time_slots text[],
    last_visit timestamp with time zone, first_visit timestamp with time zone,
    no_show_count integer, cancelled_count integer, average_party_size numeric,
    notes text, similarity_score real, date_of_birth date,
    dietary_restrictions text[], allergies text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF length(trim(p_search_term)) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    rc.id, rc.user_id, rc.guest_name, rc.guest_email, rc.guest_phone,
    rc.total_bookings, rc.total_spent, rc.vip_status, rc.blacklisted,
    rc.preferred_table_types, rc.preferred_time_slots,
    rc.last_visit, rc.first_visit,
    rc.no_show_count, rc.cancelled_count, rc.average_party_size,
    rc.notes,
    GREATEST(
      COALESCE(similarity(lower(rc.guest_name),  lower(p_search_term)), 0),
      COALESCE(similarity(lower(rc.guest_email), lower(p_search_term)), 0),
      CASE WHEN rc.guest_phone IS NOT NULL AND rc.guest_phone ILIKE '%' || p_search_term || '%'
           THEN 1.0 ELSE 0.0 END
    )::real AS similarity_score,
    p.date_of_birth, p.dietary_restrictions, p.allergies
  FROM restaurant_customers rc
  LEFT JOIN profiles p ON rc.user_id = p.id
  WHERE rc.restaurant_id = p_restaurant_id
    AND rc.blacklisted = false
    AND (
      rc.guest_name  % p_search_term
      OR rc.guest_email % p_search_term
      OR lower(rc.guest_name)  ILIKE '%' || lower(p_search_term) || '%'
      OR lower(rc.guest_email) ILIKE '%' || lower(p_search_term) || '%'
      OR rc.guest_phone ILIKE '%' || p_search_term || '%'
    )
  ORDER BY similarity_score DESC, rc.vip_status DESC, rc.total_bookings DESC
  LIMIT p_limit;

EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;


-- ---------------------------------------------------------------------------
-- 12. get_public_profile_info
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_profile_info(user_ids uuid[])
RETURNS TABLE(user_id uuid, full_name text, avatar_url text, phone_number text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    profiles.id AS user_id,
    profiles.full_name,
    profiles.avatar_url,
    profiles.phone_number
  FROM profiles
  WHERE profiles.id = ANY(user_ids)
    AND profiles.full_name IS NOT NULL;

EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;


-- ---------------------------------------------------------------------------
-- 13. search_users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_users(search_query text)
RETURNS TABLE(
    id uuid, full_name text, avatar_url text,
    is_friend boolean, email text, phone_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleaned_query text;
  is_numeric    boolean;
BEGIN
  cleaned_query := regexp_replace(search_query, '[^0-9]', '', 'g');
  is_numeric    := cleaned_query != '' AND cleaned_query = search_query;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    EXISTS (
      SELECT 1 FROM public.friends f
      WHERE f.user_id = auth.uid() AND f.friend_id = p.id
    ) AS is_friend,
    p.email,
    p.phone_number
  FROM public.profiles p
  WHERE p.id != auth.uid()
    AND (
      p.full_name    ILIKE '%' || search_query || '%'
      OR p.email     ILIKE '%' || search_query || '%'
      OR (
        is_numeric
        AND length(cleaned_query) >= 8
        AND (
          regexp_replace(p.phone_number, '[^0-9]', '', 'g') = cleaned_query
          OR (
            length(regexp_replace(p.phone_number, '[^0-9]', '', 'g')) > length(cleaned_query)
            AND (
              substring(regexp_replace(p.phone_number, '[^0-9]', '', 'g') FROM 2) = cleaned_query
              OR substring(regexp_replace(p.phone_number, '[^0-9]', '', 'g') FROM 3) = cleaned_query
              OR substring(regexp_replace(p.phone_number, '[^0-9]', '', 'g') FROM 4) = cleaned_query
              OR substring(regexp_replace(p.phone_number, '[^0-9]', '', 'g') FROM 5) = cleaned_query
            )
          )
        )
      )
    )
  ORDER BY p.full_name
  LIMIT 20;

EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;


-- ---------------------------------------------------------------------------
-- 14. admin_count_users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_count_users(
    p_search       text                     DEFAULT NULL,
    p_tier         text                     DEFAULT NULL,
    p_rating_filter text                    DEFAULT NULL,
    p_created_from timestamp with time zone DEFAULT NULL,
    p_created_to   timestamp with time zone DEFAULT NULL,
    p_points_min   integer                  DEFAULT NULL,
    p_points_max   integer                  DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin boolean;
  result   integer;
BEGIN
  SELECT EXISTS(SELECT 1 FROM rbs_admins WHERE user_id = auth.uid())
      OR EXISTS(SELECT 1 FROM restaurant_staff WHERE user_id = auth.uid() AND is_active = true)
  INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Access denied: Admin or staff privileges required';
  END IF;

  SELECT COUNT(*)::integer INTO result
  FROM profiles p
  WHERE
    (p_search IS NULL OR (
      p.full_name    ILIKE '%' || p_search || '%' OR
      p.email        ILIKE '%' || p_search || '%' OR
      p.phone_number ILIKE '%' || p_search || '%'
    ))
    AND (p_tier IS NULL OR p.membership_tier = p_tier)
    AND (p_rating_filter IS NULL OR (
      CASE p_rating_filter
        WHEN 'high'   THEN p.user_rating >= 4.0
        WHEN 'medium' THEN p.user_rating >= 3.0 AND p.user_rating < 4.0
        WHEN 'low'    THEN p.user_rating < 3.0
        ELSE true
      END
    ))
    AND (p_created_from IS NULL OR p.created_at >= p_created_from)
    AND (p_created_to   IS NULL OR p.created_at <= p_created_to)
    AND (p_points_min   IS NULL OR p.loyalty_points >= p_points_min)
    AND (p_points_max   IS NULL OR p.loyalty_points <= p_points_max);

  RETURN result;

EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;


-- ---------------------------------------------------------------------------
-- 15. admin_list_users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_users(
    p_limit         integer                  DEFAULT 20,
    p_offset        integer                  DEFAULT 0,
    p_search        text                     DEFAULT NULL,
    p_tier          text                     DEFAULT NULL,
    p_rating_filter text                     DEFAULT NULL,
    p_created_from  timestamp with time zone DEFAULT NULL,
    p_created_to    timestamp with time zone DEFAULT NULL,
    p_points_min    integer                  DEFAULT NULL,
    p_points_max    integer                  DEFAULT NULL
)
RETURNS TABLE(
    id uuid, email text, full_name text, phone_number text, avatar_url text,
    allergies text[], favorite_cuisines text[], dietary_restrictions text[],
    preferred_party_size integer, loyalty_points integer, membership_tier text,
    user_rating numeric, total_bookings integer, completed_bookings integer,
    cancelled_bookings integer, no_show_bookings integer,
    created_at timestamp with time zone, updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM rbs_admins WHERE user_id = auth.uid())
      OR EXISTS(SELECT 1 FROM restaurant_staff WHERE user_id = auth.uid() AND is_active = true)
  INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Access denied: Admin or staff privileges required';
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.email, p.full_name, p.phone_number, p.avatar_url,
    p.allergies, p.favorite_cuisines, p.dietary_restrictions,
    p.preferred_party_size, p.loyalty_points, p.membership_tier,
    p.user_rating, p.total_bookings, p.completed_bookings,
    p.cancelled_bookings, p.no_show_bookings,
    p.created_at, p.updated_at
  FROM profiles p
  WHERE
    (p_search IS NULL OR (
      p.full_name    ILIKE '%' || p_search || '%' OR
      p.email        ILIKE '%' || p_search || '%' OR
      p.phone_number ILIKE '%' || p_search || '%'
    ))
    AND (p_tier IS NULL OR p.membership_tier = p_tier)
    AND (p_rating_filter IS NULL OR (
      CASE p_rating_filter
        WHEN 'high'   THEN p.user_rating >= 4.0
        WHEN 'medium' THEN p.user_rating >= 3.0 AND p.user_rating < 4.0
        WHEN 'low'    THEN p.user_rating < 3.0
        ELSE true
      END
    ))
    AND (p_created_from IS NULL OR p.created_at >= p_created_from)
    AND (p_created_to   IS NULL OR p.created_at <= p_created_to)
    AND (p_points_min   IS NULL OR p.loyalty_points >= p_points_min)
    AND (p_points_max   IS NULL OR p.loyalty_points <= p_points_max)
  ORDER BY p.created_at DESC
  LIMIT p_limit OFFSET p_offset;

EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;


-- =============================================================================
-- BATCH 4 of 6: plpgsql — analytics, notifications, ratings
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 16. get_ad_analytics_summary
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_ad_analytics_summary(
    start_date           timestamp with time zone,
    end_date             timestamp with time zone,
    filter_restaurant_id uuid DEFAULT NULL
)
RETURNS TABLE(total_impressions bigint, total_clicks bigint, average_ctr double precision)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_events AS (
    SELECT ae.*
    FROM ad_events ae
    LEFT JOIN restaurants r  ON (ae.ad_type = 'featured_restaurant'
                                 AND ((ae.metadata->>'restaurant_id')::uuid = r.id
                                      OR ae.ad_id::uuid = r.id))
    LEFT JOIN banners b       ON (ae.ad_type = 'banner' AND ae.ad_id::uuid = b.id)
    WHERE ae.created_at BETWEEN start_date AND end_date
      AND (
        filter_restaurant_id IS NULL
        OR (ae.ad_type = 'featured_restaurant' AND r.id = filter_restaurant_id)
        OR (ae.ad_type = 'banner' AND b.restaurant_id = filter_restaurant_id)
      )
  )
  SELECT
    COUNT(*) FILTER (WHERE event_type = 'impression') AS total_impressions,
    COUNT(*) FILTER (WHERE event_type = 'click')      AS total_clicks,
    CASE
      WHEN COUNT(*) FILTER (WHERE event_type = 'impression') = 0 THEN 0
      ELSE (COUNT(*) FILTER (WHERE event_type = 'click')::float
            / COUNT(*) FILTER (WHERE event_type = 'impression')) * 100
    END AS average_ctr
  FROM filtered_events;

EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;


-- ---------------------------------------------------------------------------
-- 17. get_banner_analytics
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_banner_analytics(
    start_date           timestamp with time zone,
    end_date             timestamp with time zone,
    filter_restaurant_id uuid DEFAULT NULL
)
RETURNS TABLE(
    banner_title text, linked_resource text,
    impressions bigint, clicks bigint, ctr_percentage double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.title AS banner_title,
    COALESCE(r.name, 'No Link') AS linked_resource,
    COUNT(*) FILTER (WHERE ae.event_type = 'impression') AS impressions,
    COUNT(*) FILTER (WHERE ae.event_type = 'click')      AS clicks,
    CASE
      WHEN COUNT(*) FILTER (WHERE ae.event_type = 'impression') = 0 THEN 0
      ELSE (COUNT(*) FILTER (WHERE ae.event_type = 'click')::float
            / COUNT(*) FILTER (WHERE ae.event_type = 'impression')) * 100
    END AS ctr_percentage
  FROM ad_events ae
  JOIN banners b     ON ae.ad_id::uuid = b.id
  LEFT JOIN restaurants r ON b.restaurant_id = r.id
  WHERE ae.ad_type = 'banner'
    AND ae.created_at BETWEEN start_date AND end_date
    AND (filter_restaurant_id IS NULL OR b.restaurant_id = filter_restaurant_id)
  GROUP BY b.title, r.name
  ORDER BY impressions DESC;

EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;


-- ---------------------------------------------------------------------------
-- 18. get_featured_restaurant_analytics
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_featured_restaurant_analytics(
    start_date           timestamp with time zone,
    end_date             timestamp with time zone,
    filter_restaurant_id uuid DEFAULT NULL
)
RETURNS TABLE(
    restaurant_name text, section text,
    impressions bigint, clicks bigint, ctr_percentage double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.name AS restaurant_name,
    ae.metadata->>'section' AS section,
    COUNT(*) FILTER (WHERE ae.event_type = 'impression') AS impressions,
    COUNT(*) FILTER (WHERE ae.event_type = 'click')      AS clicks,
    CASE
      WHEN COUNT(*) FILTER (WHERE ae.event_type = 'impression') = 0 THEN 0
      ELSE (COUNT(*) FILTER (WHERE ae.event_type = 'click')::float
            / COUNT(*) FILTER (WHERE ae.event_type = 'impression')) * 100
    END AS ctr_percentage
  FROM ad_events ae
  JOIN restaurants r ON (ae.metadata->>'restaurant_id')::uuid = r.id
                     OR ae.ad_id::uuid = r.id
  WHERE ae.ad_type = 'featured_restaurant'
    AND ae.created_at BETWEEN start_date AND end_date
    AND (filter_restaurant_id IS NULL OR r.id = filter_restaurant_id)
  GROUP BY r.name, ae.metadata->>'section'
  ORDER BY impressions DESC;

EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;


-- ---------------------------------------------------------------------------
-- 19. admin_get_notification_stats
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_notification_stats(p_days integer DEFAULT 7)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_sent',    COALESCE(SUM(CASE WHEN status IN ('sent','delivered') THEN 1 ELSE 0 END), 0),
    'delivered',     COALESCE(SUM(CASE WHEN status = 'delivered' OR delivered_at IS NOT NULL THEN 1 ELSE 0 END), 0),
    'failed',        COALESCE(SUM(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END), 0),
    'queued',        COALESCE(SUM(CASE WHEN status = 'queued'  THEN 1 ELSE 0 END), 0),
    'clicked',       COALESCE(SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END), 0),
    'delivery_rate', CASE
      WHEN SUM(CASE WHEN status IN ('sent','delivered','failed') THEN 1 ELSE 0 END) > 0
      THEN ROUND((SUM(CASE WHEN status = 'delivered' OR delivered_at IS NOT NULL THEN 1.0 ELSE 0 END)
                  / SUM(CASE WHEN status IN ('sent','delivered','failed') THEN 1.0 ELSE 0 END)) * 100, 1)
      ELSE 0
    END,
    'click_rate', CASE
      WHEN SUM(CASE WHEN status = 'delivered' OR delivered_at IS NOT NULL THEN 1 ELSE 0 END) > 0
      THEN ROUND((SUM(CASE WHEN clicked_at IS NOT NULL THEN 1.0 ELSE 0 END)
                  / SUM(CASE WHEN status = 'delivered' OR delivered_at IS NOT NULL THEN 1.0 ELSE 0 END)) * 100, 1)
      ELSE 0
    END
  ) INTO result
  FROM notification_outbox
  WHERE created_at >= NOW() - (p_days || ' days')::interval;

  RETURN result;

EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;


-- ---------------------------------------------------------------------------
-- 20. get_campaign_analytics
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_campaign_analytics(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'campaign_id',  c.id,
    'name',         c.name,
    'status',       c.status,
    'target_type',  c.target_type,
    'target_count', c.target_count,
    'created_at',   c.created_at,
    'scheduled_for',c.scheduled_for,
    'completed_at', c.completed_at,
    'stats', jsonb_build_object(
      'total_queued', COUNT(o.id),
      'sent',         COUNT(o.id) FILTER (WHERE o.status = 'sent'),
      'failed',       COUNT(o.id) FILTER (WHERE o.status = 'failed'),
      'pending',      COUNT(o.id) FILTER (WHERE o.status IN ('queued','processing')),
      'skipped',      COUNT(o.id) FILTER (WHERE o.status = 'skipped'),
      'delivered',    GREATEST(
                        COUNT(o.id) FILTER (WHERE o.delivered_at IS NOT NULL),
                        COUNT(o.id) FILTER (WHERE o.status = 'sent')
                      ),
      'clicked',      COUNT(o.id) FILTER (WHERE o.clicked_at IS NOT NULL),
      'delivery_rate', ROUND(
        CASE
          WHEN COUNT(o.id) FILTER (WHERE o.status = 'sent') > 0
          THEN GREATEST(
                 COUNT(o.id) FILTER (WHERE o.delivered_at IS NOT NULL),
                 COUNT(o.id) FILTER (WHERE o.status = 'sent')
               )::numeric / COUNT(o.id) FILTER (WHERE o.status = 'sent')::numeric * 100
          ELSE 0
        END, 2),
      'click_rate', ROUND(
        CASE
          WHEN GREATEST(
                 COUNT(o.id) FILTER (WHERE o.delivered_at IS NOT NULL),
                 COUNT(o.id) FILTER (WHERE o.status = 'sent')
               ) > 0
          THEN COUNT(o.id) FILTER (WHERE o.clicked_at IS NOT NULL)::numeric
               / GREATEST(
                   COUNT(o.id) FILTER (WHERE o.delivered_at IS NOT NULL),
                   COUNT(o.id) FILTER (WHERE o.status = 'sent')
                 )::numeric * 100
          ELSE 0
        END, 2)
    )
  ) INTO v_result
  FROM notification_campaigns c
  LEFT JOIN notification_outbox o ON o.campaign_id = c.id
  WHERE c.id = p_campaign_id
  GROUP BY c.id, c.name, c.status, c.target_type, c.target_count,
           c.created_at, c.scheduled_for, c.completed_at;

  RETURN COALESCE(v_result, '{}'::jsonb);

EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;


-- =============================================================================
-- BATCH 5 of 6: plpgsql — misc mobile-app functions
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 21. cancel_booking_with_guarantee  (user-facing)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_booking_with_guarantee(
    p_booking_id         uuid,
    p_cancellation_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_booking                   record;
  v_guarantee                 record;
  v_settings                  record;
  v_cancellation_window_hours integer;
  v_hours_until_booking       numeric;
  v_is_late_cancellation      boolean;
  v_penalty_amount            numeric;
BEGIN
  SELECT b.*, r.cancellation_window_hours
  INTO v_booking
  FROM public.bookings b
  JOIN public.restaurants r ON r.id = b.restaurant_id
  WHERE b.id = p_booking_id
    AND b.user_id = auth.uid();

  IF v_booking IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found or unauthorized');
  END IF;

  IF v_booking.status NOT IN ('confirmed','pending','pending_payment') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Booking cannot be cancelled in current status: ' || v_booking.status
    );
  END IF;

  v_hours_until_booking       := EXTRACT(EPOCH FROM (v_booking.booking_time - now())) / 3600;
  v_cancellation_window_hours := COALESCE(v_booking.cancellation_window_hours, 2);
  v_is_late_cancellation      := v_hours_until_booking < v_cancellation_window_hours;

  SELECT bg.id, bg.booking_id, bg.payment_method_id, bg.status
  INTO v_guarantee
  FROM public.booking_guarantees bg
  WHERE bg.booking_id = p_booking_id AND bg.status = 'held';

  IF v_is_late_cancellation AND v_guarantee IS NOT NULL THEN
    SELECT * INTO v_settings
    FROM public.card_guarantee_settings
    WHERE restaurant_id = v_booking.restaurant_id AND enabled = true;

    IF v_settings IS NOT NULL THEN
      v_penalty_amount := CASE v_settings.fee_type
        WHEN 'per_cover' THEN v_settings.late_cancel_fee * v_booking.party_size
        ELSE v_settings.late_cancel_fee
      END;

      UPDATE public.bookings
      SET status = 'cancelled_by_user',
          cancelled_at = now(),
          cancellation_reason = COALESCE(p_cancellation_reason, 'late_cancellation')
      WHERE id = p_booking_id;

      RETURN jsonb_build_object(
        'success', true,
        'late_cancellation', true,
        'penalty_required', true,
        'booking_guarantee_id', v_guarantee.id,
        'penalty_amount', v_penalty_amount,
        'currency', COALESCE(v_settings.currency, 'USD'),
        'hours_notice', v_hours_until_booking,
        'cancellation_window', v_cancellation_window_hours
      );
    END IF;
  END IF;

  UPDATE public.bookings
  SET status = 'cancelled_by_user',
      cancelled_at = now(),
      cancellation_reason = p_cancellation_reason
  WHERE id = p_booking_id;

  IF v_guarantee IS NOT NULL THEN
    UPDATE public.booking_guarantees
    SET status = 'released', updated_at = now()
    WHERE id = v_guarantee.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'late_cancellation', false, 'penalty_required', false);

EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;


-- ---------------------------------------------------------------------------
-- 22. cancel_booking_deposit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_booking_deposit(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking               record;
  v_deposit               record;
  v_hours_until_booking   numeric;
  v_refund_eligible       boolean := false;
  v_refund_amount         numeric := 0;
  v_new_status            text    := 'forfeited';
  v_result                jsonb;
BEGIN
  SELECT id, booking_time, status, deposit_status
  INTO v_booking FROM bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found', 'has_deposit', false);
  END IF;

  SELECT bd.*, dps.refund_policy, dps.refund_window_hours, dps.partial_refund_percentage
  INTO v_deposit
  FROM booking_deposits bd
  LEFT JOIN deposit_payment_settings dps ON bd.deposit_setting_id = dps.id
  WHERE bd.booking_id = p_booking_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'has_deposit', false, 'refund_eligible', false,
                              'message', 'No deposit found for this booking');
  END IF;

  IF v_deposit.status != 'paid' THEN
    RETURN jsonb_build_object('success', true, 'has_deposit', true,
                              'deposit_status', v_deposit.status, 'refund_eligible', false,
                              'message', 'Deposit not in paid status, no refund needed');
  END IF;

  v_hours_until_booking := EXTRACT(EPOCH FROM (v_booking.booking_time - NOW())) / 3600;

  v_deposit.refund_policy           := COALESCE(v_deposit.refund_policy, 'full');
  v_deposit.refund_window_hours     := COALESCE(v_deposit.refund_window_hours, 24);
  v_deposit.partial_refund_percentage := COALESCE(v_deposit.partial_refund_percentage, 50);

  IF v_deposit.refund_policy = 'none' THEN
    v_refund_eligible := false; v_refund_amount := 0; v_new_status := 'forfeited';
  ELSIF v_hours_until_booking >= v_deposit.refund_window_hours THEN
    IF v_deposit.refund_policy = 'full' THEN
      v_refund_eligible := true; v_refund_amount := v_deposit.total_amount; v_new_status := 'refunded';
    ELSIF v_deposit.refund_policy = 'partial' THEN
      v_refund_eligible := true;
      v_refund_amount   := v_deposit.total_amount * (v_deposit.partial_refund_percentage / 100);
      v_new_status      := 'partial_refund';
    END IF;
  ELSE
    v_refund_eligible := false; v_refund_amount := 0; v_new_status := 'forfeited';
  END IF;

  UPDATE booking_deposits
  SET status        = v_new_status,
      refund_amount = CASE WHEN v_refund_eligible THEN v_refund_amount ELSE NULL END,
      refund_reason = CASE WHEN v_refund_eligible THEN 'booking_cancelled' ELSE 'late_cancellation' END,
      updated_at    = NOW()
  WHERE booking_id = p_booking_id;

  UPDATE bookings
  SET deposit_status = v_new_status, updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'success', true, 'has_deposit', true,
    'refund_eligible', v_refund_eligible, 'refund_amount', v_refund_amount,
    'total_deposit', v_deposit.total_amount, 'currency', v_deposit.currency,
    'new_status', v_new_status, 'refund_policy', v_deposit.refund_policy,
    'refund_window_hours', v_deposit.refund_window_hours,
    'hours_until_booking', v_hours_until_booking,
    'partial_refund_percentage', v_deposit.partial_refund_percentage,
    'payment_provider', v_deposit.payment_provider,
    'provider_transaction_id', v_deposit.provider_transaction_id
  );

EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;


-- ---------------------------------------------------------------------------
-- 23. check_booking_eligibility
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_booking_eligibility(
    user_id_param        uuid,
    restaurant_id_param  uuid,
    party_size_param     integer DEFAULT 1
)
RETURNS TABLE(
    can_book boolean, forced_policy text,
    restriction_reason text, user_tier text, user_rating numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  user_current_rating numeric;
  user_tier_info      record;
  is_blacklisted      boolean;
BEGIN
  SELECT p.user_rating INTO user_current_rating
  FROM profiles p WHERE p.id = user_id_param;

  IF user_current_rating IS NULL THEN user_current_rating := 5.0; END IF;

  SELECT urc.rating_tier, urc.booking_policy, urc.description
  INTO user_tier_info
  FROM user_rating_config urc
  WHERE user_current_rating >= urc.min_rating
    AND user_current_rating <= urc.max_rating
  ORDER BY urc.min_rating DESC LIMIT 1;

  IF user_tier_info IS NULL THEN
    user_tier_info.rating_tier    := 'blocked';
    user_tier_info.booking_policy := 'blocked';
    user_tier_info.description    := 'Rating outside configured ranges';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM user_restaurant_blacklist
    WHERE user_id = user_id_param AND restaurant_id = restaurant_id_param AND is_active = true
  ) INTO is_blacklisted;

  IF user_tier_info.booking_policy = 'blocked' OR is_blacklisted THEN
    RETURN QUERY SELECT false, 'blocked'::text,
      CASE WHEN is_blacklisted THEN 'You are blacklisted from this restaurant'
           ELSE user_tier_info.description END,
      user_tier_info.rating_tier::text, user_current_rating;
  ELSIF user_tier_info.booking_policy = 'request_only' THEN
    RETURN QUERY SELECT true, 'request_only'::text,
      'All your bookings require restaurant approval due to your rating'::text,
      user_tier_info.rating_tier::text, user_current_rating;
  ELSE
    RETURN QUERY SELECT true, 'follows_restaurant'::text,
      'No rating restrictions - follows restaurant policy'::text,
      user_tier_info.rating_tier::text, user_current_rating;
  END IF;

EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;


-- ---------------------------------------------------------------------------
-- 24. get_available_tables
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_available_tables(
    p_restaurant_id uuid,
    p_start_time    timestamp with time zone,
    p_end_time      timestamp with time zone,
    p_party_size    integer
)
RETURNS TABLE(
    table_id uuid, table_number text, capacity integer,
    min_capacity integer, max_capacity integer,
    table_type text, is_combinable boolean, priority_score integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  restaurant_tier  tier;
  restaurant_addons text[];
  v_has_floor_plan boolean;
BEGIN
  SELECT r.tier, r.addons INTO restaurant_tier, restaurant_addons
  FROM restaurants r WHERE r.id = p_restaurant_id;

  v_has_floor_plan := (restaurant_addons IS NOT NULL AND 'floor_plan' = ANY(restaurant_addons));

  IF restaurant_tier = 'basic' AND NOT v_has_floor_plan THEN
    RETURN QUERY
    SELECT rt.id, rt.table_number, rt.capacity, rt.min_capacity, rt.max_capacity,
           rt.table_type, rt.is_combinable, rt.priority_score
    FROM restaurant_tables rt
    WHERE rt.restaurant_id = p_restaurant_id
      AND rt.is_active = true
      AND rt.min_capacity <= p_party_size AND rt.max_capacity >= p_party_size
      AND (rt.section_id IS NULL OR EXISTS (
        SELECT 1 FROM restaurant_sections rs WHERE rs.id = rt.section_id AND rs.is_active = true))
    ORDER BY rt.priority_score ASC, ABS(rt.capacity - p_party_size) ASC, rt.capacity ASC;
  ELSE
    RETURN QUERY
    SELECT rt.id, rt.table_number, rt.capacity, rt.min_capacity, rt.max_capacity,
           rt.table_type, rt.is_combinable, rt.priority_score
    FROM restaurant_tables rt
    WHERE rt.restaurant_id = p_restaurant_id
      AND rt.is_active = true
      AND rt.min_capacity <= p_party_size AND rt.max_capacity >= p_party_size
      AND (rt.section_id IS NULL OR EXISTS (
        SELECT 1 FROM restaurant_sections rs WHERE rs.id = rt.section_id AND rs.is_active = true))
      AND NOT EXISTS (
        SELECT 1 FROM bookings b
        JOIN booking_tables bt ON b.id = bt.booking_id
        WHERE bt.table_id = rt.id
          AND b.status IN ('confirmed','pending')
          AND (b.booking_time, b.booking_time + (b.turn_time_minutes || ' minutes')::interval)
              OVERLAPS (p_start_time, p_end_time)
      )
    ORDER BY rt.priority_score ASC, ABS(rt.capacity - p_party_size) ASC, rt.capacity ASC;
  END IF;

EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;


-- ---------------------------------------------------------------------------
-- 25. get_booked_tables_for_slot
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_booked_tables_for_slot(
    p_restaurant_id uuid,
    p_start_time    timestamp with time zone,
    p_end_time      timestamp with time zone
)
RETURNS TABLE(table_id uuid)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT bt.table_id
  FROM booking_tables bt
  INNER JOIN bookings b ON bt.booking_id = b.id
  WHERE b.restaurant_id = p_restaurant_id
    AND b.status NOT IN ('cancelled_by_user','declined_by_restaurant','no_show')
    AND b.booking_time < p_end_time
    AND b.booking_time + INTERVAL '1 minute' * COALESCE(b.turn_time_minutes, 120) > p_start_time;

EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- ============================================================
-- BATCH 6a (1–10 of remaining): add EXCEPTION blocks
-- ============================================================

-- 1. get_total_users_count
CREATE OR REPLACE FUNCTION public.get_total_users_count()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO result FROM profiles;
  RETURN COALESCE(result, 0);
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 2. auto_decline_expired_pending_bookings
CREATE OR REPLACE FUNCTION public.auto_decline_expired_pending_bookings()
 RETURNS void
 LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE bookings
  SET
    status = 'declined_by_restaurant',
    updated_at = now()
  WHERE
    status = 'pending'
    AND booking_time < now();
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 3. award_loyalty_points
CREATE OR REPLACE FUNCTION public.award_loyalty_points(p_user_id uuid, p_points integer)
 RETURNS void
 LANGUAGE plpgsql
AS $$
DECLARE
  v_new_points INTEGER;
  v_new_tier TEXT;
BEGIN
  UPDATE public.profiles
  SET loyalty_points = loyalty_points + p_points
  WHERE id = p_user_id
  RETURNING loyalty_points INTO v_new_points;

  v_new_tier := CASE
    WHEN v_new_points >= 3000 THEN 'platinum'
    WHEN v_new_points >= 1500 THEN 'gold'
    WHEN v_new_points >= 500  THEN 'silver'
    ELSE 'bronze'
  END;

  UPDATE public.profiles
  SET membership_tier = v_new_tier
  WHERE id = p_user_id AND membership_tier != v_new_tier;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 4. get_turn_time
CREATE OR REPLACE FUNCTION public.get_turn_time(p_restaurant_id uuid, p_party_size integer, p_booking_time timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
AS $$
DECLARE
  v_turn_time integer;
  v_day_of_week integer;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_booking_time);

  SELECT turn_time_minutes INTO v_turn_time
  FROM restaurant_turn_times
  WHERE restaurant_id = p_restaurant_id
    AND party_size = p_party_size
    AND (day_of_week IS NULL OR day_of_week = v_day_of_week)
  LIMIT 1;

  IF v_turn_time IS NOT NULL THEN
    RETURN v_turn_time;
  END IF;

  RETURN CASE
    WHEN p_party_size <= 2 THEN 90
    WHEN p_party_size <= 4 THEN 120
    WHEN p_party_size <= 6 THEN 150
    ELSE 180
  END;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 5. get_user_rating_tier
CREATE OR REPLACE FUNCTION public.get_user_rating_tier(user_rating_param numeric)
 RETURNS TABLE(tier text, booking_policy text, max_party_size integer, description text)
 LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    urc.rating_tier::TEXT AS tier,
    urc.booking_policy::TEXT,
    urc.max_party_size,
    urc.description::TEXT
  FROM user_rating_config urc
  WHERE user_rating_param >= urc.min_rating
    AND user_rating_param <= urc.max_rating
  ORDER BY urc.min_rating DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      'blocked'::TEXT AS tier,
      'blocked'::TEXT AS booking_policy,
      NULL::INTEGER   AS max_party_size,
      'Rating outside configured ranges'::TEXT AS description;
  END IF;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 6. is_waitlist_time (overload 1: uuid, timestamptz)
CREATE OR REPLACE FUNCTION public.is_waitlist_time(restaurant_id_param uuid, booking_time_param timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  lebanon_booking_time TIMESTAMP WITH TIME ZONE;
  booking_date DATE;
  time_only TIME;
  schedule_exists BOOLEAN := FALSE;
BEGIN
  lebanon_booking_time := booking_time_param AT TIME ZONE 'Asia/Beirut';
  booking_date := lebanon_booking_time::DATE;
  time_only    := lebanon_booking_time::TIME;

  SELECT EXISTS(
    SELECT 1
    FROM public.restaurant_waitlist_schedules rws
    WHERE rws.restaurant_id = restaurant_id_param
      AND rws.waitlist_date = booking_date
      AND rws.is_active = true
      AND time_only >= rws.start_time
      AND time_only <  rws.end_time
  ) INTO schedule_exists;

  RETURN schedule_exists;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 7. is_waitlist_time (overload 2: uuid, date, time)
CREATE OR REPLACE FUNCTION public.is_waitlist_time(restaurant_id uuid, check_date date, check_time time without time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM restaurant_waitlist_schedules rws
    WHERE rws.restaurant_id = is_waitlist_time.restaurant_id
      AND rws.waitlist_date  = is_waitlist_time.check_date
      AND rws.is_active = true
      AND is_waitlist_time.check_time >= rws.start_time
      AND is_waitlist_time.check_time <= rws.end_time
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 8. update_user_rating
CREATE OR REPLACE FUNCTION public.update_user_rating(user_id_param uuid, booking_id_param uuid DEFAULT NULL::uuid, reason text DEFAULT 'Automatic calculation'::text)
 RETURNS numeric
 LANGUAGE plpgsql
AS $$
DECLARE
  old_rating numeric;
  new_rating numeric;
BEGIN
  SELECT user_rating INTO old_rating FROM profiles WHERE id = user_id_param;

  new_rating := calculate_user_rating(user_id_param);

  UPDATE profiles
  SET user_rating        = new_rating,
      rating_last_updated = NOW()
  WHERE id = user_id_param;

  IF old_rating IS DISTINCT FROM new_rating THEN
    INSERT INTO user_rating_history (user_id, old_rating, new_rating, booking_id, change_reason)
    VALUES (user_id_param, old_rating, new_rating, booking_id_param, reason);
  END IF;

  RETURN new_rating;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 9. update_playlist_positions
CREATE OR REPLACE FUNCTION public.update_playlist_positions(updates jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  item jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    UPDATE playlist_items
    SET position = (item->>'position')::integer
    WHERE id = (item->>'id')::uuid;
  END LOOP;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 10. record_notification_click
CREATE OR REPLACE FUNCTION public.record_notification_click(p_outbox_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_campaign_id UUID;
BEGIN
  UPDATE notification_outbox
  SET clicked_at = NOW()
  WHERE id = p_outbox_id
    AND clicked_at IS NULL
  RETURNING campaign_id INTO v_campaign_id;

  IF v_campaign_id IS NOT NULL THEN
    UPDATE notification_campaigns
    SET clicked_count = clicked_count + 1,
        updated_at    = NOW()
    WHERE id = v_campaign_id;
  END IF;

  RETURN FOUND;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- ============================================================
-- BATCH 6b (11–20 of remaining)
-- ============================================================

-- 11. track_ad_events
CREATE OR REPLACE FUNCTION public.track_ad_events(events jsonb[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  event JSONB;
BEGIN
  FOREACH event IN ARRAY events
  LOOP
    INSERT INTO public.ad_events (
      event_type, ad_type, ad_id, user_id, metadata, created_at
    ) VALUES (
      (event->>'event_type')::ad_event_type,
      (event->>'ad_type')::ad_entity_type,
      (event->>'ad_id')::UUID,
      CASE
        WHEN event->>'user_id' IS NULL THEN auth.uid()
        ELSE (event->>'user_id')::UUID
      END,
      COALESCE(event->'metadata', '{}'::jsonb),
      COALESCE((event->>'created_at')::TIMESTAMPTZ, NOW())
    );
  END LOOP;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 12. track_review_prompt_action
CREATE OR REPLACE FUNCTION public.track_review_prompt_action(p_user_id uuid, p_booking_id uuid, p_action text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_tracking_id uuid;
BEGIN
  IF p_action NOT IN ('shown', 'dismissed', 'reviewed') THEN
    RAISE EXCEPTION 'Invalid action: %. Must be one of: shown, dismissed, reviewed', p_action;
  END IF;

  INSERT INTO review_prompt_tracking (user_id, booking_id, action, metadata)
  VALUES (p_user_id, p_booking_id, p_action, p_metadata)
  RETURNING id INTO v_tracking_id;

  RETURN v_tracking_id;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 13. cleanup_waitlist_notifications
CREATE OR REPLACE FUNCTION public.cleanup_waitlist_notifications(p_waitlist_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.waitlist
  WHERE id = p_waitlist_id;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.notification_outbox
  SET status = 'skipped',
      error  = 'Waitlist entry cancelled by user'
  WHERE user_id = v_user_id
    AND status IN ('queued', 'failed')
    AND payload->>'category' = 'waitlist'
    AND (
      payload->'data'->>'entryId' = p_waitlist_id::text
      OR payload->'data'->>'entryId' IS NULL
    );

  UPDATE public.notifications
  SET read    = true,
      read_at = now()
  WHERE user_id = v_user_id
    AND read = false
    AND category = 'waitlist'
    AND (
      data->>'entryId' = p_waitlist_id::text
      OR (
        data->>'entryId' IS NULL AND
        data->>'restaurantId' IN (
          SELECT restaurant_id::text FROM public.waitlist WHERE id = p_waitlist_id
        )
      )
    );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 14. block_user_and_remove_friendship
CREATE OR REPLACE FUNCTION public.block_user_and_remove_friendship(p_blocker_id uuid, p_blocked_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  IF p_blocker_id = p_blocked_id THEN
    RAISE EXCEPTION 'Cannot block yourself';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE blocker_id = p_blocker_id AND blocked_id = p_blocked_id
  ) THEN
    RAISE EXCEPTION 'User is already blocked';
  END IF;

  INSERT INTO public.blocked_users (blocker_id, blocked_id, reason)
  VALUES (p_blocker_id, p_blocked_id, p_reason);

  DELETE FROM public.friends
  WHERE (user_id = p_blocker_id AND friend_id = p_blocked_id)
     OR (user_id = p_blocked_id AND friend_id = p_blocker_id);

  DELETE FROM public.friend_requests
  WHERE (from_user_id = p_blocker_id AND to_user_id = p_blocked_id)
     OR (from_user_id = p_blocked_id AND to_user_id = p_blocker_id);
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 15. process_waitlist_automation
CREATE OR REPLACE FUNCTION public.process_waitlist_automation()
 RETURNS json
 LANGUAGE plpgsql
AS $$
DECLARE
  v_expired_count  integer;
  v_notified_count integer;
BEGIN
  PERFORM auto_expire_waitlist();
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  PERFORM notify_waitlist_customers();

  SELECT COUNT(*) INTO v_notified_count
  FROM waitlist
  WHERE status = 'notified'
    AND notified_at > now() - interval '1 minute';

  RETURN json_build_object(
    'success',      true,
    'expired',      v_expired_count,
    'notified',     v_notified_count,
    'processed_at', now()
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 16. test_user_data_before_deletion
CREATE OR REPLACE FUNCTION public.test_user_data_before_deletion()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_result  json;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT json_build_object(
    'user_id',                  v_user_id,
    'profile_exists',           EXISTS(SELECT 1 FROM public.profiles WHERE id = v_user_id),
    'bookings_count',           (SELECT count(*) FROM public.bookings WHERE user_id = v_user_id AND status NOT IN ('cancelled','declined')),
    'reviews_count',            (SELECT count(*) FROM public.reviews WHERE user_id = v_user_id),
    'favorites_count',          (SELECT count(*) FROM public.favorites WHERE user_id = v_user_id),
    'friends_count',            (SELECT count(*) FROM public.friends WHERE user_id = v_user_id OR friend_id = v_user_id),
    'playlists_count',          (SELECT count(*) FROM public.restaurant_playlists WHERE user_id = v_user_id),
    'posts_count',              (SELECT count(*) FROM public.posts WHERE user_id = v_user_id),
    'notifications_count',      (SELECT count(*) FROM public.notifications WHERE user_id = v_user_id),
    'waitlist_count',           (SELECT count(*) FROM public.waitlist WHERE user_id = v_user_id AND status = 'active'),
    'loyalty_activities_count', (SELECT count(*) FROM public.loyalty_activities WHERE user_id = v_user_id),
    'staff_roles_count',        (SELECT count(*) FROM public.restaurant_staff WHERE user_id = v_user_id)
  ) INTO v_result;

  RETURN v_result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 17. verify_user_deletion_cascade
CREATE OR REPLACE FUNCTION public.verify_user_deletion_cascade(target_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_remaining_records int := 0;
  v_table_counts      json;
BEGIN
  IF auth.uid() != target_user_id AND NOT EXISTS (
    SELECT 1 FROM public.restaurant_staff
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    NULL;
  END IF;

  SELECT json_build_object(
    'profiles', (SELECT count(*) FROM public.profiles WHERE id = target_user_id),
    'bookings', (SELECT count(*) FROM public.bookings WHERE user_id = target_user_id),
    'reviews',  (SELECT count(*) FROM public.reviews  WHERE user_id = target_user_id)
  ) INTO v_table_counts;

  v_remaining_records :=
    (v_table_counts->>'profiles')::int +
    (v_table_counts->>'bookings')::int +
    (v_table_counts->>'reviews')::int;

  RETURN json_build_object(
    'deletion_complete',        v_remaining_records = 0,
    'total_records_remaining',  v_remaining_records,
    'cascade_effective',        true,
    'table_counts',             v_table_counts,
    'verification_timestamp',   now()
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 18. staff_cancel_booking_with_guarantee
CREATE OR REPLACE FUNCTION public.staff_cancel_booking_with_guarantee(p_booking_id uuid, p_cancellation_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_booking                  record;
  v_guarantee                record;
  v_settings                 record;
  v_cancellation_window_hours integer;
  v_hours_until_booking      numeric;
  v_is_late_cancellation     boolean;
  v_penalty_amount           numeric;
  v_staff_check              record;
BEGIN
  SELECT b.*, r.cancellation_window_hours
  INTO v_booking
  FROM public.bookings b
  JOIN public.restaurants r ON r.id = b.restaurant_id
  WHERE b.id = p_booking_id;

  IF v_booking IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  SELECT 1 INTO v_staff_check
  FROM public.restaurant_staff rs
  WHERE rs.restaurant_id = v_booking.restaurant_id
    AND rs.user_id = auth.uid()
    AND rs.is_active = true;

  IF v_staff_check IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Caller is not active staff for this restaurant');
  END IF;

  IF v_booking.status NOT IN ('confirmed', 'pending', 'checked_in') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking cannot be cancelled in current status: ' || v_booking.status);
  END IF;

  v_hours_until_booking       := EXTRACT(EPOCH FROM (v_booking.booking_time - now())) / 3600;
  v_cancellation_window_hours := COALESCE(v_booking.cancellation_window_hours, 2);
  v_is_late_cancellation      := v_hours_until_booking < v_cancellation_window_hours;

  SELECT bg.*, pm.recurring_token, pm.recurring_init_trans_id
  INTO v_guarantee
  FROM public.booking_guarantees bg
  JOIN public.payment_methods pm ON pm.id = bg.payment_method_id
  WHERE bg.booking_id = p_booking_id
    AND bg.status = 'held';

  IF v_is_late_cancellation AND v_guarantee IS NOT NULL THEN
    SELECT * INTO v_settings
    FROM public.card_guarantee_settings
    WHERE restaurant_id = v_booking.restaurant_id
      AND enabled = true;

    IF v_settings IS NOT NULL THEN
      v_penalty_amount := CASE v_settings.fee_type
        WHEN 'per_cover' THEN v_settings.late_cancel_fee * v_booking.party_size
        ELSE v_settings.late_cancel_fee
      END;

      UPDATE public.bookings
      SET status              = 'cancelled_by_restaurant',
          cancelled_at        = now(),
          cancellation_reason = COALESCE(p_cancellation_reason, 'late_cancellation_staff')
      WHERE id = p_booking_id;

      RETURN jsonb_build_object(
        'success',              true,
        'late_cancellation',    true,
        'penalty_required',     true,
        'booking_guarantee_id', v_guarantee.id,
        'penalty_amount',       v_penalty_amount,
        'currency',             COALESCE(v_settings.currency, 'USD'),
        'hours_notice',         v_hours_until_booking,
        'cancellation_window',  v_cancellation_window_hours
      );
    END IF;
  END IF;

  UPDATE public.bookings
  SET status              = 'cancelled_by_restaurant',
      cancelled_at        = now(),
      cancellation_reason = p_cancellation_reason
  WHERE id = p_booking_id;

  IF v_guarantee IS NOT NULL THEN
    UPDATE public.booking_guarantees
    SET status     = 'released',
        updated_at = now()
    WHERE id = v_guarantee.id;
  END IF;

  RETURN jsonb_build_object(
    'success',           true,
    'late_cancellation', false,
    'penalty_required',  false
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 19. get_reports_improvement_insights
CREATE OR REPLACE FUNCTION public.get_reports_improvement_insights(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_restaurant_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_total_bookings  bigint;
  v_pending         bigint;
  v_declined        bigint;
  v_canc_user       bigint;
  v_canc_rest       bigint;
  v_completed       bigint;
  v_conv            bigint;
  v_covers          bigint;
  v_new_users       bigint;
  v_activated_users bigint;

  v_pending_rate    numeric;
  v_decline_rate    numeric;
  v_canc_rate       numeric;
  v_completion_rate numeric;
  v_activation_rate numeric;

  v_insights        json[] := '{}';
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'declined_by_restaurant'),
    COUNT(*) FILTER (WHERE status = 'cancelled_by_user'),
    COUNT(*) FILTER (WHERE status = 'cancelled_by_restaurant'),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status IN ('confirmed','completed')),
    COALESCE(SUM(party_size), 0)
  INTO v_total_bookings, v_pending, v_declined, v_canc_user, v_canc_rest, v_completed, v_conv, v_covers
  FROM bookings
  WHERE created_at BETWEEN p_start_date AND p_end_date
    AND restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
    AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
    AND status NOT IN ('pending_payment','auto_declined');

  SELECT COUNT(*) INTO v_new_users
  FROM profiles WHERE created_at BETWEEN p_start_date AND p_end_date;

  SELECT COUNT(DISTINCT p.id) INTO v_activated_users
  FROM profiles p
  WHERE p.created_at BETWEEN p_start_date AND p_end_date
    AND EXISTS (
      SELECT 1 FROM bookings b WHERE b.user_id = p.id
        AND b.created_at BETWEEN p_start_date AND p_end_date
        AND b.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
    );

  IF v_total_bookings > 0 THEN
    v_pending_rate    := ROUND(v_pending::numeric    / v_total_bookings * 100, 1);
    v_decline_rate    := ROUND(v_declined::numeric   / v_total_bookings * 100, 1);
    v_canc_rate       := ROUND((v_canc_user + v_canc_rest)::numeric / v_total_bookings * 100, 1);
    v_completion_rate := CASE WHEN v_conv > 0 THEN ROUND(v_completed::numeric / v_conv * 100, 1) ELSE 0 END;
  ELSE
    v_pending_rate := 0; v_decline_rate := 0; v_canc_rate := 0; v_completion_rate := 0;
  END IF;

  v_activation_rate := CASE WHEN v_new_users > 0
    THEN ROUND(v_activated_users::numeric / v_new_users * 100, 1) ELSE 0 END;

  IF v_pending_rate > 20 THEN
    v_insights := v_insights || json_build_object(
      'id', 'high_pending_rate', 'title', 'High pending booking rate',
      'explanation', 'More than ' || v_pending_rate || '% of bookings are stuck in pending. Restaurants may be slow to accept.',
      'metric', v_pending_rate || '% pending',
      'severity', CASE WHEN v_pending_rate > 40 THEN 'high' WHEN v_pending_rate > 25 THEN 'medium' ELSE 'low' END,
      'suggested_action', 'Follow up with restaurants that have many unaccepted bookings. Consider enabling auto-decline with shorter expiry.'
    );
  END IF;

  IF v_decline_rate > 15 THEN
    v_insights := v_insights || json_build_object(
      'id', 'high_decline_rate', 'title', 'High restaurant decline rate',
      'explanation', v_decline_rate || '% of bookings are being declined by restaurants.',
      'metric', v_decline_rate || '% declined',
      'severity', CASE WHEN v_decline_rate > 30 THEN 'high' WHEN v_decline_rate > 20 THEN 'medium' ELSE 'low' END,
      'suggested_action', 'Review restaurants with the most declines. Check if capacity settings are accurate or if staff are overwhelmed.'
    );
  END IF;

  IF v_canc_rate > 20 THEN
    v_insights := v_insights || json_build_object(
      'id', 'high_cancellation_rate', 'title', 'High cancellation rate',
      'explanation', v_canc_rate || '% of bookings were cancelled (user or restaurant).',
      'metric', v_canc_rate || '% cancelled',
      'severity', CASE WHEN v_canc_rate > 35 THEN 'high' WHEN v_canc_rate > 25 THEN 'medium' ELSE 'low' END,
      'suggested_action', 'Split by who cancelled. If user-driven, improve booking experience or confirmation flow. If restaurant-driven, audit restaurant capacity management.'
    );
  END IF;

  IF v_completion_rate < 60 AND v_conv > 5 THEN
    v_insights := v_insights || json_build_object(
      'id', 'low_completion_rate', 'title', 'Low booking completion rate',
      'explanation', 'Only ' || v_completion_rate || '% of confirmed/completed bookings reach "completed" status.',
      'metric', v_completion_rate || '% completion',
      'severity', CASE WHEN v_completion_rate < 40 THEN 'high' WHEN v_completion_rate < 50 THEN 'medium' ELSE 'low' END,
      'suggested_action', 'Ensure restaurant staff mark bookings as completed. Many completed bookings staying "confirmed" may indicate a workflow gap.'
    );
  END IF;

  IF v_activation_rate < 20 AND v_new_users > 10 THEN
    v_insights := v_insights || json_build_object(
      'id', 'low_activation_rate', 'title', 'Low new user activation',
      'explanation', 'Only ' || v_activation_rate || '% of new users made a booking in the same period they signed up.',
      'metric', v_activation_rate || '% activated',
      'severity', CASE WHEN v_activation_rate < 10 THEN 'high' WHEN v_activation_rate < 15 THEN 'medium' ELSE 'low' END,
      'suggested_action', 'Improve onboarding, restaurant discovery, or offer first-booking incentives (promo codes, reduced deposit).'
    );
  END IF;

  IF v_new_users > 20 AND v_total_bookings < (v_new_users / 2) THEN
    v_insights := v_insights || json_build_object(
      'id', 'users_not_converting', 'title', 'User growth not converting to bookings',
      'explanation', 'You have ' || v_new_users || ' new users but only ' || v_total_bookings || ' bookings in this period.',
      'metric', v_total_bookings || ' bookings / ' || v_new_users || ' new users',
      'severity', 'medium',
      'suggested_action', 'Audit the booking flow for friction. Consider push notifications or email prompts to nudge new users to book.'
    );
  END IF;

  IF v_total_bookings = 0 THEN
    v_insights := v_insights || json_build_object(
      'id', 'no_data', 'title', 'No bookings in selected period',
      'explanation', 'There are no bookings to analyse. Try expanding the date range.',
      'metric', '0 bookings',
      'severity', 'low',
      'suggested_action', 'Select a wider date range or check that bookings are being recorded correctly.'
    );
  END IF;

  RETURN json_build_object(
    'insights', to_json(v_insights),
    'summary', json_build_object(
      'total_bookings',    v_total_bookings,
      'pending_rate',      v_pending_rate,
      'decline_rate',      v_decline_rate,
      'cancellation_rate', v_canc_rate,
      'completion_rate',   v_completion_rate,
      'activation_rate',   v_activation_rate
    )
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 20. get_daily_activation_rates
CREATE OR REPLACE FUNCTION public.get_daily_activation_rates(start_date date DEFAULT '2024-11-10'::date)
 RETURNS TABLE(date date, total_users integer, users_with_any_booking integer, users_with_completed_booking integer, any_booking_rate numeric, completed_booking_rate numeric)
 LANGUAGE plpgsql
AS $$
DECLARE
  loop_date              DATE;
  end_date               DATE;
  day_total_users        INTEGER;
  day_users_with_any     INTEGER;
  day_users_with_completed INTEGER;
  day_any_rate           NUMERIC;
  day_completed_rate     NUMERIC;
BEGIN
  end_date  := CURRENT_DATE;
  loop_date := start_date;

  WHILE loop_date <= end_date LOOP
    WITH eligible_users AS (
      SELECT p.id, p.created_at AS user_joined_at
      FROM profiles p
      WHERE p.created_at <= loop_date - INTERVAL '30 days'
        AND (
          p.created_at <= loop_date - INTERVAL '30 days'
          OR EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.user_id = p.id AND b.created_at < loop_date
          )
        )
    )
    SELECT
      COUNT(*)::INTEGER,
      COUNT(DISTINCT CASE
        WHEN EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.user_id = eu.id
            AND b.created_at >= eu.user_joined_at
            AND b.created_at <= eu.user_joined_at + INTERVAL '30 days'
            AND b.created_at < loop_date
            AND NOT EXISTS (
              SELECT 1 FROM bookings b2
              WHERE b2.user_id = eu.id
                AND b2.created_at < b.created_at
                AND b2.created_at >= eu.user_joined_at
            )
        ) THEN eu.id
      END)::INTEGER,
      COUNT(DISTINCT CASE
        WHEN EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.user_id = eu.id
            AND b.created_at >= eu.user_joined_at
            AND b.created_at <= eu.user_joined_at + INTERVAL '30 days'
            AND b.status = 'completed'
            AND b.created_at < loop_date
            AND NOT EXISTS (
              SELECT 1 FROM bookings b2
              WHERE b2.user_id = eu.id
                AND b2.created_at < b.created_at
                AND b2.created_at >= eu.user_joined_at
                AND b2.status = 'completed'
            )
        ) THEN eu.id
      END)::INTEGER
    INTO day_total_users, day_users_with_any, day_users_with_completed
    FROM eligible_users eu;

    IF day_total_users > 0 THEN
      day_any_rate       := (day_users_with_any::NUMERIC       / day_total_users::NUMERIC) * 100;
      day_completed_rate := (day_users_with_completed::NUMERIC / day_total_users::NUMERIC) * 100;
    ELSE
      day_any_rate       := 0;
      day_completed_rate := 0;
    END IF;

    RETURN QUERY SELECT
      loop_date,
      day_total_users,
      day_users_with_any,
      day_users_with_completed,
      ROUND(day_any_rate, 2),
      ROUND(day_completed_rate, 2);

    loop_date := loop_date + INTERVAL '1 day';
  END LOOP;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- ============================================================
-- BATCH 6c (21–30): sql→plpgsql conversions + report functions
-- ============================================================

-- 21. get_max_turn_time  (LANGUAGE sql → plpgsql, STABLE)
CREATE OR REPLACE FUNCTION public.get_max_turn_time(p_restaurant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
AS $$
DECLARE
  result integer;
BEGIN
  SELECT COALESCE(max(turn_time_minutes), 240)
    INTO result
  FROM public.restaurant_turn_times
  WHERE restaurant_id = p_restaurant_id;
  RETURN result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 22. phone_verified_in_use  (LANGUAGE sql → plpgsql, SECURITY DEFINER, SET search_path)
CREATE OR REPLACE FUNCTION public.phone_verified_in_use(p_phone text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $$
DECLARE
  result boolean;
BEGIN
  WITH normalized AS (
    SELECT
      ltrim(p_phone, '+') AS bare,
      '+' || ltrim(p_phone, '+') AS e164
  )
  SELECT
    EXISTS (
      SELECT 1 FROM public.profiles, normalized
      WHERE phone_verified = true
        AND phone_number IN (normalized.bare, normalized.e164)
    )
    OR EXISTS (
      SELECT 1 FROM auth.users, normalized
      WHERE phone IN (normalized.bare, normalized.e164)
    )
  INTO result;
  RETURN result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 23. track_cuisine_sponsorship_click  (LANGUAGE sql → plpgsql, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.track_cuisine_sponsorship_click(p_sponsorship_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.cuisine_sponsorships
  SET clicks = clicks + 1, updated_at = now()
  WHERE id = p_sponsorship_id;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 24. track_cuisine_sponsorship_impression  (LANGUAGE sql → plpgsql, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.track_cuisine_sponsorship_impression(p_sponsorship_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.cuisine_sponsorships
  SET impressions = impressions + 1, updated_at = now()
  WHERE id = p_sponsorship_id;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 25. get_upcoming_event_occurrences  (LANGUAGE sql → plpgsql, STABLE SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_upcoming_event_occurrences(p_restaurant_id uuid, p_days_ahead integer DEFAULT 30)
 RETURNS TABLE(occurrence_id uuid, event_id uuid, occurrence_date date, start_time time without time zone, end_date date, end_time time without time zone, max_capacity integer, current_bookings integer, status text, event_title text, event_description text, event_type text, event_image_url text, minimum_age integer, minimum_party_size integer, maximum_party_size integer, special_notes text, override_price numeric, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    eo.id AS occurrence_id,
    eo.event_id,
    eo.occurrence_date,
    eo.start_time,
    eo.end_date,
    eo.end_time,
    eo.max_capacity,
    eo.current_bookings,
    eo.status,
    re.title        AS event_title,
    re.description  AS event_description,
    re.event_type,
    re.image_url    AS event_image_url,
    re.minimum_age,
    re.minimum_party_size,
    re.maximum_party_size,
    eo.special_notes,
    eo.override_price,
    eo.created_at,
    eo.updated_at
  FROM public.event_occurrences eo
  JOIN public.restaurant_events re ON re.id = eo.event_id
  WHERE re.restaurant_id = p_restaurant_id
    AND re.is_active = true
    AND eo.occurrence_date >= CURRENT_DATE
    AND eo.occurrence_date <= CURRENT_DATE + (p_days_ahead || ' days')::interval
    AND eo.status IN ('scheduled', 'full')
  ORDER BY eo.occurrence_date ASC, eo.start_time ASC;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 26. get_available_now_restaurants  (LANGUAGE sql → plpgsql, STABLE, SET search_path)
CREATE OR REPLACE FUNCTION public.get_available_now_restaurants(p_limit integer DEFAULT 10)
 RETURNS SETOF restaurants
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  WITH now_lebanon AS (
    SELECT
      (NOW() AT TIME ZONE 'Asia/Beirut')::date AS today,
      (NOW() AT TIME ZONE 'Asia/Beirut')::time AS now_time
  ),
  probes AS (
    SELECT
      LOWER(TRIM(TO_CHAR(p.ts, 'Day'))) AS dow,
      p.ts::time AS probe_time,
      p.ts::date AS probe_date
    FROM (VALUES
      ((NOW() AT TIME ZONE 'Asia/Beirut')),
      ((NOW() AT TIME ZONE 'Asia/Beirut') + INTERVAL '30 minutes')
    ) AS p(ts)
  ),
  candidates AS (
    SELECT DISTINCT rt.restaurant_id AS id
    FROM public.restaurant_tables rt
    INNER JOIN public.restaurants r ON r.id = rt.restaurant_id
    WHERE r.status = 'active'
      AND rt.is_active = true
      AND rt.default_booking_type = 'instant'
      AND rt.x_position IS NOT NULL
      AND rt.y_position IS NOT NULL
  ),
  special_today AS (
    SELECT rsh.restaurant_id, rsh.is_closed, rsh.open_time, rsh.close_time
    FROM public.restaurant_special_hours rsh, now_lebanon n
    WHERE rsh.date = n.today
  ),
  blocked_by_closure AS (
    SELECT DISTINCT rc.restaurant_id
    FROM public.restaurant_closures rc, now_lebanon n
    WHERE rc.start_date <= n.today
      AND rc.end_date   >= n.today
      AND (
        (rc.start_time IS NULL AND rc.end_time IS NULL)
        OR (
          rc.start_time IS NOT NULL AND rc.end_time IS NOT NULL
          AND n.now_time >= rc.start_time AND n.now_time < rc.end_time
        )
      )
  ),
  regular_open AS (
    SELECT DISTINCT rh.restaurant_id
    FROM public.restaurant_hours rh, probes p
    WHERE rh.is_open = true
      AND LOWER(rh.day_of_week) = p.dow
      AND rh.open_time  IS NOT NULL
      AND rh.close_time IS NOT NULL
      AND (
        (rh.close_time > rh.open_time
          AND p.probe_time >= rh.open_time AND p.probe_time < rh.close_time)
        OR
        (rh.close_time < rh.open_time
          AND (p.probe_time >= rh.open_time OR p.probe_time < rh.close_time))
      )
  ),
  special_pass AS (
    SELECT DISTINCT st.restaurant_id
    FROM special_today st, probes p, now_lebanon n
    WHERE st.is_closed = false
      AND p.probe_date = n.today
      AND (st.open_time  IS NULL OR p.probe_time >= st.open_time)
      AND (st.close_time IS NULL OR p.probe_time <  st.close_time)
  )
  SELECT r.*
  FROM public.restaurants r
  INNER JOIN candidates c ON c.id = r.id
  LEFT  JOIN special_today st ON st.restaurant_id = r.id
  WHERE r.id NOT IN (SELECT restaurant_id FROM blocked_by_closure)
    AND (
      (st.restaurant_id IS NOT NULL AND r.id IN (SELECT restaurant_id FROM special_pass))
      OR
      (st.restaurant_id IS NULL     AND r.id IN (SELECT restaurant_id FROM regular_open))
    )
  ORDER BY
    r.featured DESC NULLS LAST,
    r.featured_order ASC NULLS LAST,
    r.average_rating DESC NULLS LAST,
    r.total_reviews DESC NULLS LAST
  LIMIT p_limit;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 27. admin_list_notification_campaigns  (LANGUAGE sql → plpgsql, STABLE SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.admin_list_notification_campaigns(p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, name text, title text, body text, target_type text, target_count integer, sent_count integer, delivered_count integer, clicked_count integer, failed_count integer, status text, scheduled_for timestamp with time zone, started_at timestamp with time zone, completed_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH outbox AS (
    SELECT
      campaign_id,
      COUNT(*) FILTER (WHERE status = 'queued')              AS queued_count,
      COUNT(*) FILTER (WHERE status = 'processing')          AS processing_count,
      COUNT(*) FILTER (WHERE status = 'sent')                AS sent_count,
      COUNT(*) FILTER (WHERE status = 'failed')              AS failed_count,
      COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)         AS clicked_count,
      COUNT(*) FILTER (WHERE delivered_at IS NOT NULL)       AS delivered_at_count
    FROM public.notification_outbox
    WHERE campaign_id IS NOT NULL
    GROUP BY campaign_id
  )
  SELECT
    c.id,
    c.name,
    c.title,
    c.body,
    c.target_type,
    c.target_count,
    COALESCE(o.sent_count, 0)::int AS sent_count,
    GREATEST(COALESCE(o.delivered_at_count, 0), COALESCE(o.sent_count, 0))::int AS delivered_count,
    COALESCE(o.clicked_count, 0)::int AS clicked_count,
    COALESCE(o.failed_count,  0)::int AS failed_count,
    (CASE
      WHEN c.status IN ('draft','cancelled') THEN c.status
      WHEN c.scheduled_for IS NOT NULL AND c.scheduled_for > now() THEN 'scheduled'
      WHEN COALESCE(o.queued_count, 0) + COALESCE(o.processing_count, 0) > 0 THEN 'sending'
      ELSE 'completed'
    END)::text AS status,
    c.scheduled_for,
    c.started_at,
    c.completed_at,
    c.created_at
  FROM public.notification_campaigns c
  LEFT JOIN outbox o ON o.campaign_id = c.id
  ORDER BY c.created_at DESC
  LIMIT p_limit;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 28. get_reports_bookings  (LANGUAGE sql → plpgsql, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_reports_bookings(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_restaurant_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  WITH
  prev AS (
    SELECT
      p_start_date - (p_end_date - p_start_date) AS prev_start,
      p_start_date - interval '1 millisecond'    AS prev_end
  ),
  cur_b AS (
    SELECT
      COUNT(*)                                                                   AS total,
      COUNT(*) FILTER (WHERE status = 'pending')                                  AS pending,
      COUNT(*) FILTER (WHERE status = 'confirmed')                                 AS confirmed,
      COUNT(*) FILTER (WHERE status = 'completed')                                 AS completed,
      COUNT(*) FILTER (WHERE status = 'cancelled_by_user')                         AS canc_user,
      COUNT(*) FILTER (WHERE status = 'cancelled_by_restaurant')                   AS canc_rest,
      COUNT(*) FILTER (WHERE status = 'declined_by_restaurant')                    AS declined,
      COUNT(*) FILTER (WHERE status IN ('confirmed','completed'))                   AS conv,
      COALESCE(SUM(party_size), 0)                                                 AS covers,
      ROUND(AVG(party_size)::numeric, 1)                                           AS avg_party
    FROM bookings
    WHERE created_at BETWEEN p_start_date AND p_end_date
      AND restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
      AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
      AND status NOT IN ('pending_payment','auto_declined')
  ),
  prev_b AS (
    SELECT
      COUNT(*)                                                                   AS total,
      COUNT(*) FILTER (WHERE status = 'pending')                                  AS pending,
      COUNT(*) FILTER (WHERE status = 'confirmed')                                 AS confirmed,
      COUNT(*) FILTER (WHERE status = 'completed')                                 AS completed,
      COUNT(*) FILTER (WHERE status = 'cancelled_by_user')                         AS canc_user,
      COUNT(*) FILTER (WHERE status = 'cancelled_by_restaurant')                   AS canc_rest,
      COUNT(*) FILTER (WHERE status = 'declined_by_restaurant')                    AS declined,
      COUNT(*) FILTER (WHERE status IN ('confirmed','completed'))                   AS conv,
      COALESCE(SUM(party_size), 0)                                                 AS covers,
      ROUND(AVG(party_size)::numeric, 1)                                           AS avg_party
    FROM bookings, prev
    WHERE created_at BETWEEN prev.prev_start AND prev.prev_end
      AND restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
      AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
      AND status NOT IN ('pending_payment','auto_declined')
  ),
  daily AS (
    SELECT COALESCE(json_agg(json_build_object('date', day, 'count', cnt, 'covers', cvrs) ORDER BY day), '[]') AS data
    FROM (
      SELECT date_trunc('day', created_at)::date AS day,
             COUNT(*) AS cnt, COALESCE(SUM(party_size), 0) AS cvrs
      FROM bookings
      WHERE created_at BETWEEN p_start_date AND p_end_date
        AND restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
        AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
        AND status NOT IN ('pending_payment','auto_declined')
      GROUP BY 1
    ) t
  ),
  peak_hours AS (
    SELECT COALESCE(json_agg(json_build_object('hour', hr, 'count', cnt) ORDER BY hr), '[]') AS data
    FROM (
      SELECT EXTRACT(HOUR FROM booking_time AT TIME ZONE 'UTC')::int AS hr, COUNT(*) AS cnt
      FROM bookings
      WHERE created_at BETWEEN p_start_date AND p_end_date
        AND restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
        AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
        AND status NOT IN ('pending_payment','auto_declined')
      GROUP BY 1
    ) t
  ),
  peak_days AS (
    SELECT COALESCE(json_agg(json_build_object('dow', dow, 'count', cnt) ORDER BY dow), '[]') AS data
    FROM (
      SELECT EXTRACT(DOW FROM booking_time AT TIME ZONE 'UTC')::int AS dow, COUNT(*) AS cnt
      FROM bookings
      WHERE created_at BETWEEN p_start_date AND p_end_date
        AND restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
        AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
        AND status NOT IN ('pending_payment','auto_declined')
      GROUP BY 1
    ) t
  ),
  top_by_bookings AS (
    SELECT COALESCE(json_agg(row ORDER BY row->>'total' DESC NULLS LAST), '[]') AS data
    FROM (
      SELECT json_build_object('restaurant_id', b.restaurant_id, 'name', r.name,
               'total', COUNT(*), 'completed', COUNT(*) FILTER (WHERE b.status = 'completed')) AS row
      FROM bookings b
      JOIN restaurants r ON r.id = b.restaurant_id
      WHERE b.created_at BETWEEN p_start_date AND p_end_date
        AND b.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
        AND (p_restaurant_id IS NULL OR b.restaurant_id = p_restaurant_id)
        AND b.status NOT IN ('pending_payment','auto_declined')
      GROUP BY b.restaurant_id, r.name
      ORDER BY COUNT(*) DESC
      LIMIT 10
    ) t
  ),
  top_by_covers AS (
    SELECT COALESCE(json_agg(row ORDER BY row->>'covers' DESC NULLS LAST), '[]') AS data
    FROM (
      SELECT json_build_object('restaurant_id', b.restaurant_id, 'name', r.name,
               'covers', COALESCE(SUM(b.party_size), 0)) AS row
      FROM bookings b
      JOIN restaurants r ON r.id = b.restaurant_id
      WHERE b.created_at BETWEEN p_start_date AND p_end_date
        AND b.status = 'completed'
        AND b.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
        AND (p_restaurant_id IS NULL OR b.restaurant_id = p_restaurant_id)
      GROUP BY b.restaurant_id, r.name
      ORDER BY SUM(b.party_size) DESC
      LIMIT 10
    ) t
  )
  SELECT json_build_object(
    'current', json_build_object(
      'total',           (SELECT total     FROM cur_b),
      'pending',         (SELECT pending   FROM cur_b),
      'confirmed',       (SELECT confirmed FROM cur_b),
      'completed',       (SELECT completed FROM cur_b),
      'cancelled_by_user',       (SELECT canc_user FROM cur_b),
      'cancelled_by_restaurant', (SELECT canc_rest FROM cur_b),
      'declined',        (SELECT declined  FROM cur_b),
      'covers',          (SELECT covers    FROM cur_b),
      'avg_party_size',  COALESCE((SELECT avg_party FROM cur_b), 0),
      'conversion_rate', CASE WHEN (SELECT total FROM cur_b) = 0 THEN 0
                           ELSE ROUND((SELECT conv FROM cur_b)::numeric / (SELECT total FROM cur_b) * 100, 1) END,
      'completion_rate', CASE WHEN (SELECT conv FROM cur_b) = 0 THEN 0
                           ELSE ROUND((SELECT completed FROM cur_b)::numeric / (SELECT conv FROM cur_b) * 100, 1) END,
      'cancellation_rate', CASE WHEN (SELECT total FROM cur_b) = 0 THEN 0
                             ELSE ROUND(((SELECT canc_user FROM cur_b) + (SELECT canc_rest FROM cur_b))::numeric / (SELECT total FROM cur_b) * 100, 1) END,
      'decline_rate',    CASE WHEN (SELECT total FROM cur_b) = 0 THEN 0
                           ELSE ROUND((SELECT declined FROM cur_b)::numeric / (SELECT total FROM cur_b) * 100, 1) END
    ),
    'previous', json_build_object(
      'total',           (SELECT total     FROM prev_b),
      'completed',       (SELECT completed FROM prev_b),
      'covers',          (SELECT covers    FROM prev_b),
      'avg_party_size',  COALESCE((SELECT avg_party FROM prev_b), 0),
      'conversion_rate', CASE WHEN (SELECT total FROM prev_b) = 0 THEN 0
                           ELSE ROUND((SELECT conv FROM prev_b)::numeric / (SELECT total FROM prev_b) * 100, 1) END,
      'completion_rate', CASE WHEN (SELECT conv FROM prev_b) = 0 THEN 0
                           ELSE ROUND((SELECT completed FROM prev_b)::numeric / (SELECT conv FROM prev_b) * 100, 1) END,
      'cancellation_rate', CASE WHEN (SELECT total FROM prev_b) = 0 THEN 0
                             ELSE ROUND(((SELECT canc_user FROM prev_b) + (SELECT canc_rest FROM prev_b))::numeric / (SELECT total FROM prev_b) * 100, 1) END,
      'decline_rate',    CASE WHEN (SELECT total FROM prev_b) = 0 THEN 0
                           ELSE ROUND((SELECT declined FROM prev_b)::numeric / (SELECT total FROM prev_b) * 100, 1) END
    ),
    'charts', json_build_object(
      'daily',      (SELECT data FROM daily),
      'peak_hours', (SELECT data FROM peak_hours),
      'peak_days',  (SELECT data FROM peak_days)
    ),
    'tables', json_build_object(
      'top_by_bookings', (SELECT data FROM top_by_bookings),
      'top_by_covers',   (SELECT data FROM top_by_covers)
    )
  ) INTO result;
  RETURN result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 29. get_reports_overview  (LANGUAGE sql → plpgsql, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_reports_overview(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_restaurant_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  WITH
  prev AS (
    SELECT
      p_start_date - (p_end_date - p_start_date) AS prev_start,
      p_start_date - interval '1 millisecond'    AS prev_end
  ),
  cur_b AS (
    SELECT
      COUNT(*)                                                         AS total,
      COUNT(*) FILTER (WHERE status = 'completed')                     AS completed,
      COUNT(*) FILTER (WHERE status IN ('confirmed','completed'))       AS conv,
      COUNT(*) FILTER (WHERE status = 'cancelled_by_user')             AS canc_user,
      COUNT(*) FILTER (WHERE status = 'cancelled_by_restaurant')       AS canc_rest,
      COUNT(*) FILTER (WHERE status = 'declined_by_restaurant')        AS declined,
      COALESCE(SUM(party_size), 0)                                     AS covers
    FROM bookings
    WHERE created_at BETWEEN p_start_date AND p_end_date
      AND restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
      AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
      AND status NOT IN ('pending_payment','auto_declined')
  ),
  prev_b AS (
    SELECT
      COUNT(*)                                                         AS total,
      COUNT(*) FILTER (WHERE status = 'completed')                     AS completed,
      COUNT(*) FILTER (WHERE status IN ('confirmed','completed'))       AS conv,
      COUNT(*) FILTER (WHERE status = 'cancelled_by_user')             AS canc_user,
      COUNT(*) FILTER (WHERE status = 'cancelled_by_restaurant')       AS canc_rest,
      COUNT(*) FILTER (WHERE status = 'declined_by_restaurant')        AS declined,
      COALESCE(SUM(party_size), 0)                                     AS covers
    FROM bookings, prev
    WHERE created_at BETWEEN prev.prev_start AND prev.prev_end
      AND restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
      AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
      AND status NOT IN ('pending_payment','auto_declined')
  ),
  cur_u  AS (SELECT COUNT(*) AS n FROM profiles WHERE created_at BETWEEN p_start_date AND p_end_date),
  prev_u AS (SELECT COUNT(*) AS n FROM profiles, prev WHERE created_at BETWEEN prev.prev_start AND prev.prev_end),
  tot_u  AS (SELECT COUNT(*) AS n FROM profiles WHERE created_at <= p_end_date),
  cur_act AS (
    SELECT COUNT(DISTINCT p.id) AS n
    FROM profiles p
    WHERE p.created_at BETWEEN p_start_date AND p_end_date
      AND EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.user_id = p.id
          AND b.created_at BETWEEN p_start_date AND p_end_date
          AND b.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
          AND (p_restaurant_id IS NULL OR b.restaurant_id = p_restaurant_id)
      )
  ),
  prev_act AS (
    SELECT COUNT(DISTINCT p.id) AS n
    FROM profiles p, prev
    WHERE p.created_at BETWEEN prev.prev_start AND prev.prev_end
      AND EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.user_id = p.id
          AND b.created_at BETWEEN prev.prev_start AND prev.prev_end
          AND b.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
          AND (p_restaurant_id IS NULL OR b.restaurant_id = p_restaurant_id)
      )
  ),
  user_daily AS (
    SELECT COALESCE(json_agg(json_build_object('date', day, 'count', cnt) ORDER BY day), '[]') AS data
    FROM (
      SELECT date_trunc('day', created_at)::date AS day, COUNT(*) AS cnt
      FROM profiles WHERE created_at BETWEEN p_start_date AND p_end_date GROUP BY 1
    ) t
  ),
  booking_daily AS (
    SELECT COALESCE(json_agg(json_build_object('date', day, 'count', cnt) ORDER BY day), '[]') AS data
    FROM (
      SELECT date_trunc('day', created_at)::date AS day, COUNT(*) AS cnt
      FROM bookings
      WHERE created_at BETWEEN p_start_date AND p_end_date
        AND restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
        AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
        AND status NOT IN ('pending_payment','auto_declined')
      GROUP BY 1
    ) t
  ),
  covers_daily AS (
    SELECT COALESCE(json_agg(json_build_object('date', day, 'covers', cvrs) ORDER BY day), '[]') AS data
    FROM (
      SELECT date_trunc('day', created_at)::date AS day, COALESCE(SUM(party_size), 0) AS cvrs
      FROM bookings
      WHERE created_at BETWEEN p_start_date AND p_end_date
        AND restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
        AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
        AND status NOT IN ('pending_payment','auto_declined')
      GROUP BY 1
    ) t
  ),
  status_dist AS (
    SELECT COALESCE(json_agg(json_build_object('status', status, 'count', cnt) ORDER BY cnt DESC), '[]') AS data
    FROM (
      SELECT status, COUNT(*) AS cnt
      FROM bookings
      WHERE created_at BETWEEN p_start_date AND p_end_date
        AND restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
        AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
        AND status IN ('pending','confirmed','completed','cancelled_by_user','cancelled_by_restaurant','declined_by_restaurant')
      GROUP BY 1
    ) t
  )
  SELECT json_build_object(
    'current', json_build_object(
      'total_users',          (SELECT n FROM tot_u),
      'new_users',            (SELECT n FROM cur_u),
      'total_bookings',       (SELECT total     FROM cur_b),
      'completed_bookings',   (SELECT completed FROM cur_b),
      'total_covers',         (SELECT covers    FROM cur_b),
      'new_users_who_booked', (SELECT n FROM cur_act),
      'activation_rate',  CASE WHEN (SELECT n FROM cur_u)  = 0 THEN 0
                            ELSE ROUND((SELECT n FROM cur_act)::numeric / (SELECT n FROM cur_u) * 100, 1) END,
      'conversion_rate',  CASE WHEN (SELECT total FROM cur_b) = 0 THEN 0
                            ELSE ROUND((SELECT conv FROM cur_b)::numeric / (SELECT total FROM cur_b) * 100, 1) END,
      'cancellation_rate',CASE WHEN (SELECT total FROM cur_b) = 0 THEN 0
                            ELSE ROUND(((SELECT canc_user FROM cur_b)+(SELECT canc_rest FROM cur_b))::numeric/(SELECT total FROM cur_b)*100,1) END,
      'decline_rate',     CASE WHEN (SELECT total FROM cur_b) = 0 THEN 0
                            ELSE ROUND((SELECT declined FROM cur_b)::numeric / (SELECT total FROM cur_b) * 100, 1) END
    ),
    'previous', json_build_object(
      'new_users',            (SELECT n FROM prev_u),
      'total_bookings',       (SELECT total     FROM prev_b),
      'completed_bookings',   (SELECT completed FROM prev_b),
      'total_covers',         (SELECT covers    FROM prev_b),
      'new_users_who_booked', (SELECT n FROM prev_act),
      'activation_rate',  CASE WHEN (SELECT n FROM prev_u)  = 0 THEN 0
                            ELSE ROUND((SELECT n FROM prev_act)::numeric / (SELECT n FROM prev_u) * 100, 1) END,
      'conversion_rate',  CASE WHEN (SELECT total FROM prev_b) = 0 THEN 0
                            ELSE ROUND((SELECT conv FROM prev_b)::numeric / (SELECT total FROM prev_b) * 100, 1) END,
      'cancellation_rate',CASE WHEN (SELECT total FROM prev_b) = 0 THEN 0
                            ELSE ROUND(((SELECT canc_user FROM prev_b)+(SELECT canc_rest FROM prev_b))::numeric/(SELECT total FROM prev_b)*100,1) END,
      'decline_rate',     CASE WHEN (SELECT total FROM prev_b) = 0 THEN 0
                            ELSE ROUND((SELECT declined FROM prev_b)::numeric / (SELECT total FROM prev_b) * 100, 1) END
    ),
    'charts', json_build_object(
      'user_growth',      (SELECT data FROM user_daily),
      'booking_growth',   (SELECT data FROM booking_daily),
      'covers_growth',    (SELECT data FROM covers_daily),
      'status_breakdown', (SELECT data FROM status_dist)
    )
  ) INTO result;
  RETURN result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 30. get_reports_expected_revenue  (LANGUAGE sql → plpgsql, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_reports_expected_revenue(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_restaurant_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  WITH
  rest AS (
    SELECT
      COUNT(*) FILTER (WHERE tier::text = 'basic') AS basic_count,
      COUNT(*) FILTER (WHERE tier::text = 'pro')   AS pro_count,
      COUNT(*)                                       AS total_count,
      COALESCE(SUM(CASE WHEN addons IS NOT NULL AND array_length(addons,1) > 0
                        THEN array_length(addons,1) ELSE 0 END), 0) AS total_addons
    FROM restaurants
    WHERE status = 'active'
      AND id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
      AND (p_restaurant_id IS NULL OR id = p_restaurant_id)
  ),
  rest_detail AS (
    SELECT COALESCE(json_agg(json_build_object(
      'name', name, 'tier', tier::text,
      'addon_count', CASE WHEN addons IS NOT NULL AND array_length(addons,1) > 0 THEN array_length(addons,1) ELSE 0 END,
      'monthly_estimate',
        CASE WHEN tier::text = 'basic' THEN 50 ELSE 100 END
        + CASE WHEN addons IS NOT NULL AND array_length(addons,1) > 0 THEN array_length(addons,1) * 30 ELSE 0 END
    ) ORDER BY name), '[]') AS data
    FROM restaurants
    WHERE status = 'active'
      AND id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
      AND (p_restaurant_id IS NULL OR id = p_restaurant_id)
  ),
  covers AS (
    SELECT
      COALESCE(SUM(party_size) FILTER (WHERE source = 'app'),    0) AS app_covers,
      COALESCE(SUM(party_size) FILTER (WHERE source = 'widget'), 0) AS widget_covers,
      COALESCE(SUM(party_size) FILTER (WHERE source = 'manual'), 0) AS manual_covers,
      COALESCE(SUM(party_size), 0)                                   AS total_covers
    FROM bookings
    WHERE created_at BETWEEN p_start_date AND p_end_date
      AND status = 'completed'
      AND restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
      AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
  )
  SELECT json_build_object(
    'restaurants', json_build_object(
      'basic_count',  (SELECT basic_count  FROM rest),
      'pro_count',    (SELECT pro_count    FROM rest),
      'total_count',  (SELECT total_count  FROM rest),
      'total_addons', (SELECT total_addons FROM rest)
    ),
    'subscription', json_build_object(
      'basic_revenue', (SELECT basic_count * 50.0  FROM rest),
      'pro_revenue',   (SELECT pro_count   * 100.0 FROM rest),
      'addon_revenue', (SELECT total_addons * 30.0  FROM rest),
      'monthly_total', (SELECT basic_count * 50.0 + pro_count * 100.0 + total_addons * 30.0 FROM rest)
    ),
    'covers', json_build_object(
      'app_covers',           (SELECT app_covers    FROM covers),
      'widget_covers',        (SELECT widget_covers FROM covers),
      'manual_covers',        (SELECT manual_covers FROM covers),
      'total_covers',         (SELECT total_covers  FROM covers),
      'app_cover_revenue',    (SELECT app_covers    * 1.0 FROM covers),
      'widget_cover_revenue', (SELECT widget_covers * 0.5 FROM covers),
      'cover_revenue_total',  (SELECT app_covers * 1.0 + widget_covers * 0.5 FROM covers)
    ),
    'totals', json_build_object(
      'monthly_subscription', (SELECT basic_count * 50.0 + pro_count * 100.0 + total_addons * 30.0 FROM rest),
      'period_covers',        (SELECT app_covers * 1.0 + widget_covers * 0.5 FROM covers),
      'grand_total', (
        SELECT basic_count * 50.0 + pro_count * 100.0 + total_addons * 30.0
             + app_covers * 1.0 + widget_covers * 0.5
        FROM rest CROSS JOIN covers
      )
    ),
    'restaurant_detail', (SELECT data FROM rest_detail)
  ) INTO result;
  RETURN result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- ============================================================
-- BATCH 6d (31–37): final functions
-- ============================================================

-- 31. get_reports_marketing  (LANGUAGE sql → plpgsql, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_reports_marketing(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_restaurant_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  WITH
  prev AS (
    SELECT
      p_start_date - (p_end_date - p_start_date) AS prev_start,
      p_start_date - interval '1 millisecond'    AS prev_end
  ),
  cur_ev AS (
    SELECT
      COUNT(*)                                                                        AS total_clicks,
      COUNT(*) FILTER (WHERE event_type = 'restaurant_card_click')                   AS card_clicks,
      COUNT(*) FILTER (WHERE event_type = 'featured_restaurant_card_click')          AS featured_clicks,
      COUNT(*) FILTER (WHERE event_type = 'banner_click')                            AS banner_clicks
    FROM analytics_events
    WHERE created_at BETWEEN p_start_date AND p_end_date
      AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
  ),
  prev_ev AS (
    SELECT
      COUNT(*) AS total_clicks,
      COUNT(*) FILTER (WHERE event_type = 'restaurant_card_click') AS card_clicks,
      COUNT(*) FILTER (WHERE event_type = 'banner_click')          AS banner_clicks
    FROM analytics_events, prev
    WHERE created_at BETWEEN prev.prev_start AND prev.prev_end
      AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
  ),
  clicks_daily AS (
    SELECT COALESCE(json_agg(json_build_object(
      'date', day, 'total', total, 'card', card, 'featured', featured, 'banner', banner
    ) ORDER BY day), '[]') AS data
    FROM (
      SELECT
        date_trunc('day', created_at)::date AS day,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE event_type = 'restaurant_card_click')          AS card,
        COUNT(*) FILTER (WHERE event_type = 'featured_restaurant_card_click') AS featured,
        COUNT(*) FILTER (WHERE event_type = 'banner_click')                   AS banner
      FROM analytics_events
      WHERE created_at BETWEEN p_start_date AND p_end_date
        AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
      GROUP BY 1
    ) t
  ),
  top_restaurants AS (
    SELECT COALESCE(json_agg(row ORDER BY row->>'clicks' DESC NULLS LAST), '[]') AS data
    FROM (
      SELECT json_build_object(
        'restaurant_id', ae.restaurant_id,
        'name', COALESCE(ae.restaurant_name, r.name, 'Unknown'),
        'clicks', COUNT(*)
      ) AS row
      FROM analytics_events ae
      LEFT JOIN restaurants r ON r.id = ae.restaurant_id
      WHERE ae.created_at BETWEEN p_start_date AND p_end_date
        AND ae.event_type IN ('restaurant_card_click','featured_restaurant_card_click')
        AND ae.restaurant_id IS NOT NULL
        AND ae.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
        AND (p_restaurant_id IS NULL OR ae.restaurant_id = p_restaurant_id)
      GROUP BY ae.restaurant_id, ae.restaurant_name, r.name
      ORDER BY COUNT(*) DESC
      LIMIT 10
    ) t
  ),
  top_banners AS (
    SELECT COALESCE(json_agg(row ORDER BY row->>'clicks' DESC NULLS LAST), '[]') AS data
    FROM (
      SELECT json_build_object('banner_id', banner_id, 'banner_type', banner_type, 'clicks', COUNT(*)) AS row
      FROM analytics_events
      WHERE created_at BETWEEN p_start_date AND p_end_date
        AND event_type = 'banner_click'
        AND banner_id IS NOT NULL
        AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
      GROUP BY banner_id, banner_type
      ORDER BY COUNT(*) DESC
      LIMIT 10
    ) t
  ),
  bookings_by_source AS (
    SELECT COALESCE(json_agg(json_build_object('source', source, 'count', cnt) ORDER BY cnt DESC), '[]') AS data
    FROM (
      SELECT source, COUNT(*) AS cnt
      FROM bookings
      WHERE created_at BETWEEN p_start_date AND p_end_date
        AND restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
        AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
        AND status NOT IN ('pending_payment','auto_declined')
      GROUP BY source
      ORDER BY COUNT(*) DESC
    ) t
  )
  SELECT json_build_object(
    'current', json_build_object(
      'total_clicks',    (SELECT total_clicks    FROM cur_ev),
      'card_clicks',     (SELECT card_clicks     FROM cur_ev),
      'featured_clicks', (SELECT featured_clicks FROM cur_ev),
      'banner_clicks',   (SELECT banner_clicks   FROM cur_ev)
    ),
    'previous', json_build_object(
      'total_clicks',  (SELECT total_clicks FROM prev_ev),
      'card_clicks',   (SELECT card_clicks  FROM prev_ev),
      'banner_clicks', (SELECT banner_clicks FROM prev_ev)
    ),
    'charts', json_build_object(
      'clicks_daily', (SELECT data FROM clicks_daily)
    ),
    'tables', json_build_object(
      'top_restaurants',    (SELECT data FROM top_restaurants),
      'top_banners',        (SELECT data FROM top_banners),
      'bookings_by_source', (SELECT data FROM bookings_by_source)
    )
  ) INTO result;
  RETURN result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 32. get_reports_promotions  (LANGUAGE sql → plpgsql, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_reports_promotions(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_restaurant_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  WITH
  prev AS (
    SELECT
      p_start_date - (p_end_date - p_start_date) AS prev_start,
      p_start_date - interval '1 millisecond'    AS prev_end
  ),
  active_codes AS (
    SELECT COUNT(*) AS n
    FROM promo_codes
    WHERE status = 'active'
      AND valid_until >= NOW()
      AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
  ),
  cur_red AS (
    SELECT
      COUNT(*) AS total_redemptions,
      COUNT(DISTINCT pcr.user_id) AS unique_users
    FROM promo_code_redemptions pcr
    WHERE pcr.redeemed_at BETWEEN p_start_date AND p_end_date
      AND (p_restaurant_id IS NULL OR pcr.restaurant_id = p_restaurant_id)
      AND pcr.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
  ),
  prev_red AS (
    SELECT COUNT(*) AS total_redemptions
    FROM promo_code_redemptions pcr, prev
    WHERE pcr.redeemed_at BETWEEN prev.prev_start AND prev.prev_end
      AND (p_restaurant_id IS NULL OR pcr.restaurant_id = p_restaurant_id)
      AND pcr.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
  ),
  top_codes AS (
    SELECT COALESCE(json_agg(row ORDER BY row->>'redemptions' DESC NULLS LAST), '[]') AS data
    FROM (
      SELECT json_build_object(
        'code', pc.code, 'description', pc.description,
        'discount_type', pc.discount_type, 'discount_value', pc.discount_value,
        'redemptions', COUNT(pcr.id), 'unique_users', COUNT(DISTINCT pcr.user_id),
        'status', pc.status
      ) AS row
      FROM promo_codes pc
      LEFT JOIN promo_code_redemptions pcr
        ON pcr.promo_code_id = pc.id
        AND pcr.redeemed_at BETWEEN p_start_date AND p_end_date
      WHERE (p_restaurant_id IS NULL OR pc.restaurant_id = p_restaurant_id)
      GROUP BY pc.id, pc.code, pc.description, pc.discount_type, pc.discount_value, pc.status
      ORDER BY COUNT(pcr.id) DESC
      LIMIT 15
    ) t
  ),
  redemptions_daily AS (
    SELECT COALESCE(json_agg(json_build_object('date', day, 'count', cnt) ORDER BY day), '[]') AS data
    FROM (
      SELECT date_trunc('day', pcr.redeemed_at)::date AS day, COUNT(*) AS cnt
      FROM promo_code_redemptions pcr
      WHERE pcr.redeemed_at BETWEEN p_start_date AND p_end_date
        AND (p_restaurant_id IS NULL OR pcr.restaurant_id = p_restaurant_id)
        AND pcr.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
      GROUP BY 1
    ) t
  )
  SELECT json_build_object(
    'current', json_build_object(
      'active_codes',      (SELECT n FROM active_codes),
      'total_redemptions', (SELECT total_redemptions FROM cur_red),
      'unique_users',      (SELECT unique_users FROM cur_red)
    ),
    'previous', json_build_object(
      'total_redemptions', (SELECT total_redemptions FROM prev_red)
    ),
    'charts', json_build_object(
      'redemptions_daily', (SELECT data FROM redemptions_daily)
    ),
    'tables', json_build_object(
      'top_codes', (SELECT data FROM top_codes)
    )
  ) INTO result;
  RETURN result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 33. get_reports_revenue  (LANGUAGE sql → plpgsql, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_reports_revenue(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_restaurant_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  WITH
  prev AS (
    SELECT
      p_start_date - (p_end_date - p_start_date) AS prev_start,
      p_start_date - interval '1 millisecond'    AS prev_end
  ),
  cur_dep AS (
    SELECT
      COUNT(*) FILTER (WHERE bd.status = 'paid')     AS paid_count,
      COUNT(*) FILTER (WHERE bd.status = 'failed')   AS failed_count,
      COUNT(*) FILTER (WHERE bd.status = 'refunded') AS refunded_count,
      COALESCE(SUM(bd.amount) FILTER (WHERE bd.status = 'paid'), 0)              AS paid_amount,
      COALESCE(SUM(bd.refund_amount) FILTER (WHERE bd.status = 'refunded'), 0)   AS refunded_amount
    FROM booking_deposits bd
    JOIN bookings b ON b.id = bd.booking_id
    WHERE bd.created_at BETWEEN p_start_date AND p_end_date
      AND b.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
      AND (p_restaurant_id IS NULL OR b.restaurant_id = p_restaurant_id)
  ),
  prev_dep AS (
    SELECT
      COALESCE(SUM(bd.amount) FILTER (WHERE bd.status = 'paid'), 0) AS paid_amount,
      COUNT(*) FILTER (WHERE bd.status = 'paid') AS paid_count
    FROM booking_deposits bd
    JOIN bookings b ON b.id = bd.booking_id
    CROSS JOIN prev
    WHERE bd.created_at BETWEEN prev.prev_start AND prev.prev_end
      AND b.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
      AND (p_restaurant_id IS NULL OR b.restaurant_id = p_restaurant_id)
  ),
  cur_guar AS (
    SELECT
      COUNT(*) FILTER (WHERE bg.status = 'charged')  AS charged_count,
      COUNT(*) FILTER (WHERE bg.status = 'released') AS released_count,
      COUNT(*) FILTER (WHERE bg.status = 'waived')   AS waived_count,
      COALESCE(SUM(bg.charged_amount) FILTER (WHERE bg.status = 'charged'), 0) AS charged_amount
    FROM booking_guarantees bg
    JOIN bookings b ON b.id = bg.booking_id
    WHERE bg.created_at BETWEEN p_start_date AND p_end_date
      AND b.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
      AND (p_restaurant_id IS NULL OR b.restaurant_id = p_restaurant_id)
  ),
  cur_inv AS (
    SELECT
      COUNT(*)                                                             AS total_count,
      COUNT(*) FILTER (WHERE status = 'paid')                             AS paid_count,
      COUNT(*) FILTER (WHERE status IN ('sent','overdue'))                AS outstanding_count,
      COALESCE(SUM(total), 0)                                             AS total_amount,
      COALESCE(SUM(total) FILTER (WHERE status = 'paid'), 0)             AS paid_amount,
      COALESCE(SUM(total) FILTER (WHERE status IN ('sent','overdue')), 0) AS outstanding_amount
    FROM billing_invoices
    WHERE created_at BETWEEN p_start_date AND p_end_date
      AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
      AND restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
  ),
  prev_inv AS (
    SELECT
      COALESCE(SUM(total) FILTER (WHERE status = 'paid'), 0) AS paid_amount,
      COUNT(*) FILTER (WHERE status = 'paid') AS paid_count
    FROM billing_invoices, prev
    WHERE created_at BETWEEN prev.prev_start AND prev.prev_end
      AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
      AND restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
  ),
  inv_by_rest AS (
    SELECT COALESCE(json_agg(row ORDER BY row->>'paid_amount' DESC NULLS LAST), '[]') AS data
    FROM (
      SELECT json_build_object(
        'restaurant_id', bi.restaurant_id, 'name', r.name,
        'paid_amount', COALESCE(SUM(bi.total) FILTER (WHERE bi.status = 'paid'), 0),
        'invoice_count', COUNT(*)
      ) AS row
      FROM billing_invoices bi
      JOIN restaurants r ON r.id = bi.restaurant_id
      WHERE bi.created_at BETWEEN p_start_date AND p_end_date
        AND bi.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
        AND (p_restaurant_id IS NULL OR bi.restaurant_id = p_restaurant_id)
      GROUP BY bi.restaurant_id, r.name
      ORDER BY SUM(bi.total) FILTER (WHERE bi.status = 'paid') DESC NULLS LAST
      LIMIT 10
    ) t
  ),
  dep_daily AS (
    SELECT COALESCE(json_agg(json_build_object('date', day, 'amount', amt) ORDER BY day), '[]') AS data
    FROM (
      SELECT date_trunc('day', bd.created_at)::date AS day,
             COALESCE(SUM(bd.amount) FILTER (WHERE bd.status = 'paid'), 0) AS amt
      FROM booking_deposits bd
      JOIN bookings b ON b.id = bd.booking_id
      WHERE bd.created_at BETWEEN p_start_date AND p_end_date
        AND b.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
        AND (p_restaurant_id IS NULL OR b.restaurant_id = p_restaurant_id)
      GROUP BY 1
    ) t
  )
  SELECT json_build_object(
    'deposits', json_build_object(
      'paid_amount',     (SELECT paid_amount     FROM cur_dep),
      'paid_count',      (SELECT paid_count      FROM cur_dep),
      'failed_count',    (SELECT failed_count    FROM cur_dep),
      'refunded_count',  (SELECT refunded_count  FROM cur_dep),
      'refunded_amount', (SELECT refunded_amount FROM cur_dep)
    ),
    'deposits_previous', json_build_object(
      'paid_amount', (SELECT paid_amount FROM prev_dep),
      'paid_count',  (SELECT paid_count  FROM prev_dep)
    ),
    'guarantees', json_build_object(
      'charged_count',  (SELECT charged_count  FROM cur_guar),
      'released_count', (SELECT released_count FROM cur_guar),
      'waived_count',   (SELECT waived_count   FROM cur_guar),
      'charged_amount', (SELECT charged_amount FROM cur_guar)
    ),
    'invoices', json_build_object(
      'total_count',        (SELECT total_count        FROM cur_inv),
      'paid_count',         (SELECT paid_count         FROM cur_inv),
      'outstanding_count',  (SELECT outstanding_count  FROM cur_inv),
      'total_amount',       (SELECT total_amount       FROM cur_inv),
      'paid_amount',        (SELECT paid_amount        FROM cur_inv),
      'outstanding_amount', (SELECT outstanding_amount FROM cur_inv)
    ),
    'invoices_previous', json_build_object(
      'paid_amount', (SELECT paid_amount FROM prev_inv),
      'paid_count',  (SELECT paid_count  FROM prev_inv)
    ),
    'charts', json_build_object(
      'deposits_daily', (SELECT data FROM dep_daily),
      'by_restaurant',  (SELECT data FROM inv_by_rest)
    )
  ) INTO result;
  RETURN result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 34. get_reports_users  (LANGUAGE sql → plpgsql, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_reports_users(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_restaurant_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  WITH
  prev AS (
    SELECT
      p_start_date - (p_end_date - p_start_date) AS prev_start,
      p_start_date - interval '1 millisecond'    AS prev_end
  ),
  cur_u  AS (SELECT COUNT(*) AS n FROM profiles WHERE created_at BETWEEN p_start_date AND p_end_date),
  prev_u AS (SELECT COUNT(*) AS n FROM profiles, prev WHERE created_at BETWEEN prev.prev_start AND prev.prev_end),
  cur_act AS (
    SELECT COUNT(DISTINCT p.id) AS n
    FROM profiles p
    WHERE p.created_at BETWEEN p_start_date AND p_end_date
      AND EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.user_id = p.id
          AND b.created_at BETWEEN p_start_date AND p_end_date
          AND b.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
      )
  ),
  prev_act AS (
    SELECT COUNT(DISTINCT p.id) AS n
    FROM profiles p, prev
    WHERE p.created_at BETWEEN prev.prev_start AND prev.prev_end
      AND EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.user_id = p.id
          AND b.created_at BETWEEN prev.prev_start AND prev.prev_end
          AND b.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
      )
  ),
  cur_returning AS (
    SELECT COUNT(DISTINCT b.user_id) AS n
    FROM bookings b
    WHERE b.created_at BETWEEN p_start_date AND p_end_date
      AND b.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
      AND b.user_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM bookings b2
        WHERE b2.user_id = b.user_id
          AND b2.created_at < p_start_date
          AND b2.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
      )
  ),
  prev_returning AS (
    SELECT COUNT(DISTINCT b.user_id) AS n
    FROM bookings b, prev
    WHERE b.created_at BETWEEN prev.prev_start AND prev.prev_end
      AND b.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
      AND b.user_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM bookings b2
        WHERE b2.user_id = b.user_id
          AND b2.created_at < prev.prev_start
          AND b2.restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
      )
  ),
  booking_counts AS (
    SELECT user_id, COUNT(*) AS cnt
    FROM bookings
    WHERE user_id IS NOT NULL
      AND restaurant_id <> '48176058-02a7-40f4-a6da-4b7cc50dfb59'
      AND status NOT IN ('pending_payment','auto_declined')
    GROUP BY user_id
  ),
  power AS (
    SELECT
      COUNT(*) FILTER (WHERE cnt >= 2) AS users_2plus,
      COUNT(*) FILTER (WHERE cnt >= 5) AS users_5plus,
      ROUND(AVG(cnt)::numeric, 2)      AS avg_bookings_per_user
    FROM booking_counts
  ),
  daily AS (
    SELECT COALESCE(json_agg(json_build_object('date', day, 'count', cnt) ORDER BY day), '[]') AS data
    FROM (
      SELECT date_trunc('day', created_at)::date AS day, COUNT(*) AS cnt
      FROM profiles WHERE created_at BETWEEN p_start_date AND p_end_date GROUP BY 1
    ) t
  )
  SELECT json_build_object(
    'current', json_build_object(
      'new_users',             (SELECT n FROM cur_u),
      'new_users_who_booked',  (SELECT n FROM cur_act),
      'activation_rate',       CASE WHEN (SELECT n FROM cur_u) = 0 THEN 0
                                 ELSE ROUND((SELECT n FROM cur_act)::numeric / (SELECT n FROM cur_u) * 100, 1) END,
      'returning_users',       (SELECT n FROM cur_returning),
      'users_2plus_bookings',  (SELECT users_2plus FROM power),
      'users_5plus_bookings',  (SELECT users_5plus FROM power),
      'avg_bookings_per_user', (SELECT avg_bookings_per_user FROM power)
    ),
    'previous', json_build_object(
      'new_users',            (SELECT n FROM prev_u),
      'new_users_who_booked', (SELECT n FROM prev_act),
      'activation_rate',      CASE WHEN (SELECT n FROM prev_u) = 0 THEN 0
                                ELSE ROUND((SELECT n FROM prev_act)::numeric / (SELECT n FROM prev_u) * 100, 1) END,
      'returning_users',      (SELECT n FROM prev_returning)
    ),
    'charts', json_build_object(
      'new_users_daily', (SELECT data FROM daily)
    )
  ) INTO result;
  RETURN result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 35. get_reports_ads  (LANGUAGE sql → plpgsql, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_reports_ads(p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  WITH
  prev AS (
    SELECT
      p_start_date - (p_end_date - p_start_date) AS prev_start,
      p_start_date - interval '1 millisecond'    AS prev_end
  ),
  cur AS (
    SELECT
      COUNT(*) FILTER (WHERE event_type::text = 'impression') AS impressions,
      COUNT(*) FILTER (WHERE event_type::text = 'click')      AS clicks
    FROM ad_events
    WHERE created_at BETWEEN p_start_date AND p_end_date
  ),
  prv AS (
    SELECT
      COUNT(*) FILTER (WHERE event_type::text = 'impression') AS impressions,
      COUNT(*) FILTER (WHERE event_type::text = 'click')      AS clicks
    FROM ad_events
    CROSS JOIN prev
    WHERE created_at BETWEEN prev.prev_start AND prev.prev_end
  ),
  by_type AS (
    SELECT COALESCE(json_agg(json_build_object(
      'ad_type', ad_type::text, 'impressions', imp, 'clicks', clk,
      'ctr', CASE WHEN imp = 0 THEN 0 ELSE ROUND(clk::numeric / imp * 100, 2) END
    ) ORDER BY imp DESC NULLS LAST), '[]') AS data
    FROM (
      SELECT
        ad_type,
        COUNT(*) FILTER (WHERE event_type::text = 'impression') AS imp,
        COUNT(*) FILTER (WHERE event_type::text = 'click')      AS clk
      FROM ad_events
      WHERE created_at BETWEEN p_start_date AND p_end_date
      GROUP BY ad_type
    ) t
  ),
  daily AS (
    SELECT COALESCE(json_agg(json_build_object(
      'date', day, 'impressions', imp, 'clicks', clk,
      'ctr', CASE WHEN imp = 0 THEN 0 ELSE ROUND(clk::numeric / imp * 100, 2) END
    ) ORDER BY day), '[]') AS data
    FROM (
      SELECT
        date_trunc('day', created_at)::date AS day,
        COUNT(*) FILTER (WHERE event_type::text = 'impression') AS imp,
        COUNT(*) FILTER (WHERE event_type::text = 'click')      AS clk
      FROM ad_events
      WHERE created_at BETWEEN p_start_date AND p_end_date
      GROUP BY 1
    ) t
  ),
  top_ads AS (
    SELECT COALESCE(json_agg(row ORDER BY (row->>'clicks')::int DESC NULLS LAST), '[]') AS data
    FROM (
      SELECT json_build_object(
        'ad_id',       ae.ad_id,
        'ad_type',     ae.ad_type::text,
        'impressions', COUNT(*) FILTER (WHERE ae.event_type::text = 'impression'),
        'clicks',      COUNT(*) FILTER (WHERE ae.event_type::text = 'click'),
        'ctr', CASE
          WHEN COUNT(*) FILTER (WHERE ae.event_type::text = 'impression') = 0 THEN 0
          ELSE ROUND(
            COUNT(*) FILTER (WHERE ae.event_type::text = 'click')::numeric
            / COUNT(*) FILTER (WHERE ae.event_type::text = 'impression') * 100, 2)
          END,
        'name', COALESCE(
          (SELECT b.title FROM banners b     WHERE b.id = ae.ad_id LIMIT 1),
          (SELECT r.name  FROM restaurants r WHERE r.id = ae.ad_id LIMIT 1),
          ae.ad_id::text
        )
      ) AS row
      FROM ad_events ae
      WHERE ae.created_at BETWEEN p_start_date AND p_end_date
      GROUP BY ae.ad_id, ae.ad_type
      ORDER BY COUNT(*) FILTER (WHERE ae.event_type::text = 'click') DESC
      LIMIT 20
    ) t
  )
  SELECT json_build_object(
    'current', json_build_object(
      'impressions', (SELECT impressions FROM cur),
      'clicks',      (SELECT clicks FROM cur),
      'ctr', CASE WHEN (SELECT impressions FROM cur) = 0 THEN 0
                  ELSE ROUND((SELECT clicks FROM cur)::numeric / (SELECT impressions FROM cur) * 100, 2) END
    ),
    'previous', json_build_object(
      'impressions', (SELECT impressions FROM prv),
      'clicks',      (SELECT clicks FROM prv),
      'ctr', CASE WHEN (SELECT impressions FROM prv) = 0 THEN 0
                  ELSE ROUND((SELECT clicks FROM prv)::numeric / (SELECT impressions FROM prv) * 100, 2) END
    ),
    'charts', json_build_object(
      'daily', (SELECT data FROM daily)
    ),
    'tables', json_build_object(
      'by_type', (SELECT data FROM by_type),
      'top_ads', (SELECT data FROM top_ads)
    )
  ) INTO result;
  RETURN result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 36. get_campaign_outbox_analytics  (SECURITY DEFINER, add EXCEPTION)
CREATE OR REPLACE FUNCTION public.get_campaign_outbox_analytics(p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH base AS (
    SELECT * FROM public.notification_outbox WHERE campaign_id = p_campaign_id
  ),
  totals AS (
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE status = 'queued')::int   AS queued,
      count(*) FILTER (WHERE status = 'sent')::int     AS sent,
      count(*) FILTER (WHERE status = 'failed')::int   AS failed,
      count(*) FILTER (WHERE status = 'skipped')::int  AS skipped,
      count(*) FILTER (WHERE delivered_at IS NOT NULL)::int AS delivered_tracked,
      count(*) FILTER (WHERE clicked_at   IS NOT NULL)::int AS clicked_tracked,
      COALESCE(round(avg(attempts)::numeric, 2), 0)::float8 AS avg_attempts,
      COALESCE(count(*) FILTER (WHERE attempts = 0),  0)::int AS attempts_0,
      COALESCE(count(*) FILTER (WHERE attempts = 1),  0)::int AS attempts_1,
      COALESCE(count(*) FILTER (WHERE attempts >= 2), 0)::int AS attempts_2_plus
    FROM base
  ),
  latency AS (
    SELECT
      count(*)::int AS n,
      COALESCE(round(avg(extract(epoch FROM (sent_at - created_at)))::numeric, 2), 0)::float8  AS avg_seconds,
      COALESCE(round(percentile_cont(0.5)  WITHIN GROUP (ORDER BY extract(epoch FROM (sent_at - created_at)))::numeric, 2), 0)::float8 AS p50_seconds,
      COALESCE(round(percentile_cont(0.9)  WITHIN GROUP (ORDER BY extract(epoch FROM (sent_at - created_at)))::numeric, 2), 0)::float8 AS p90_seconds,
      COALESCE(round(percentile_cont(0.99) WITHIN GROUP (ORDER BY extract(epoch FROM (sent_at - created_at)))::numeric, 2), 0)::float8 AS p99_seconds
    FROM base WHERE sent_at IS NOT NULL
  ),
  schedule_lag AS (
    SELECT
      count(*)::int AS n,
      COALESCE(round(avg(extract(epoch FROM (sent_at - scheduled_for)))::numeric, 2), 0)::float8 AS avg_seconds,
      COALESCE(round(percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (sent_at - scheduled_for)))::numeric, 2), 0)::float8 AS p50_seconds,
      COALESCE(round(percentile_cont(0.9) WITHIN GROUP (ORDER BY extract(epoch FROM (sent_at - scheduled_for)))::numeric, 2), 0)::float8 AS p90_seconds
    FROM base WHERE sent_at IS NOT NULL AND scheduled_for IS NOT NULL
  ),
  channel_stats AS (
    SELECT
      channel,
      count(*)::int AS total,
      count(*) FILTER (WHERE status = 'queued')::int   AS queued,
      count(*) FILTER (WHERE status = 'sent')::int     AS sent,
      count(*) FILTER (WHERE status = 'failed')::int   AS failed,
      count(*) FILTER (WHERE status = 'skipped')::int  AS skipped,
      count(*) FILTER (WHERE delivered_at IS NOT NULL)::int AS delivered_tracked,
      count(*) FILTER (WHERE clicked_at   IS NOT NULL)::int AS clicked_tracked,
      COALESCE(round(avg(attempts)::numeric, 2), 0)::float8 AS avg_attempts
    FROM base GROUP BY channel
  ),
  by_channel AS (
    SELECT COALESCE(jsonb_object_agg(channel, to_jsonb(channel_stats) - 'channel'), '{}'::jsonb) AS v
    FROM channel_stats
  ),
  type_stats AS (
    SELECT
      COALESCE(type, 'unknown') AS type,
      count(*)::int AS total,
      count(*) FILTER (WHERE status = 'sent')::int    AS sent,
      count(*) FILTER (WHERE status = 'failed')::int  AS failed,
      count(*) FILTER (WHERE status = 'skipped')::int AS skipped
    FROM base GROUP BY COALESCE(type, 'unknown')
  ),
  by_type AS (
    SELECT COALESCE(jsonb_object_agg(type, to_jsonb(type_stats) - 'type'), '{}'::jsonb) AS v
    FROM type_stats
  ),
  priority_stats AS (
    SELECT
      COALESCE(priority, 'unknown') AS priority,
      count(*)::int AS total,
      count(*) FILTER (WHERE status = 'sent')::int    AS sent,
      count(*) FILTER (WHERE status = 'failed')::int  AS failed,
      count(*) FILTER (WHERE status = 'skipped')::int AS skipped
    FROM base GROUP BY COALESCE(priority, 'unknown')
  ),
  by_priority AS (
    SELECT COALESCE(jsonb_object_agg(priority, to_jsonb(priority_stats) - 'priority'), '{}'::jsonb) AS v
    FROM priority_stats
  ),
  variants AS (
    SELECT
      md5(COALESCE(title,'') || '|' || COALESCE(body,'') || '|' || COALESCE(type,'unknown') || '|' || channel) AS variant_id,
      channel,
      COALESCE(type, 'unknown') AS type,
      left(COALESCE(title,''), 120) AS title,
      left(COALESCE(body,''),  180) AS body_preview,
      count(*)::int AS total,
      count(*) FILTER (WHERE status = 'sent')::int    AS sent,
      count(*) FILTER (WHERE status = 'failed')::int  AS failed,
      count(*) FILTER (WHERE status = 'skipped')::int AS skipped
    FROM base
    GROUP BY 1,2,3,4,5
    ORDER BY total DESC
    LIMIT 25
  ),
  message_variants AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'variant_id', variant_id, 'channel', channel, 'type', type,
      'title', title, 'body_preview', body_preview,
      'total', total, 'sent', sent, 'failed', failed, 'skipped', skipped
    ) ORDER BY total DESC), '[]'::jsonb) AS v
    FROM variants
  ),
  top_failures AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('error', err, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb) AS v
    FROM (
      SELECT COALESCE(NULLIF(trim(error),''), 'Unknown error') AS err, count(*)::int AS cnt
      FROM base WHERE status = 'failed'
      GROUP BY 1 ORDER BY cnt DESC LIMIT 10
    ) t
  )
  SELECT jsonb_build_object(
    'campaign_id',      p_campaign_id,
    'totals',           (SELECT to_jsonb(totals)    FROM totals),
    'by_channel',       (SELECT v FROM by_channel),
    'by_type',          (SELECT v FROM by_type),
    'by_priority',      (SELECT v FROM by_priority),
    'message_variants', (SELECT v FROM message_variants),
    'latency',          (SELECT to_jsonb(latency)   FROM latency),
    'schedule_lag',     (SELECT to_jsonb(schedule_lag) FROM schedule_lag),
    'top_failures',     (SELECT v FROM top_failures)
  ) INTO result;
  RETURN result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 37. create_booking_with_tables  (fix outer EXCEPTION — was leaking SQLERRM via RAISE NOTICE then re-raising)
CREATE OR REPLACE FUNCTION public.create_booking_with_tables(p_user_id uuid, p_restaurant_id uuid, p_booking_time timestamp with time zone, p_party_size integer, p_table_ids uuid[] DEFAULT NULL::uuid[], p_turn_time integer DEFAULT 120, p_special_requests text DEFAULT NULL::text, p_occasion text DEFAULT NULL::text, p_dietary_notes text[] DEFAULT NULL::text[], p_table_preferences text[] DEFAULT NULL::text[], p_is_group_booking boolean DEFAULT false, p_applied_offer_id uuid DEFAULT NULL::uuid, p_booking_policy text DEFAULT 'instant'::text, p_expected_loyalty_points integer DEFAULT 0, p_applied_loyalty_rule_id uuid DEFAULT NULL::uuid, p_preferred_section text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_booking bookings;
  v_table_id uuid;
  v_confirmation_code text;
  v_retry_count integer := 0;
  v_max_retries integer := 10;
  v_is_vip boolean;
  v_max_booking_days integer;
  v_restaurant_status text;
  v_booking_status text;
  v_booking_end_time timestamp with time zone;
  v_conflict_booking record;
  v_min_gap_minutes integer := 60;
  v_conflicted_tables uuid[];
  v_restaurant_tier text;
  v_restaurant_addons text[];
  v_has_floor_plan boolean;
  v_needs_auto_assign boolean;
  v_available_tables uuid[];
  v_auto_selected_tables uuid[];
  v_remaining_capacity integer;
  v_single_table uuid;
  v_section_id uuid;
  v_effective_booking_type text;
  v_rule RECORD;
  v_condition JSONB;
  v_all_match boolean;
  v_cond_type text;
  v_day_of_week integer;
  v_booking_time_only time;
  v_booking_date date;
  v_found_match boolean;
  v_table_booking_type text;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Cannot create bookings for other users';
  END IF;

  v_booking_end_time := p_booking_time + (p_turn_time || ' minutes')::interval;

  SELECT b.id, b.booking_time, r.name as restaurant_name, b.confirmation_code
  INTO v_conflict_booking
  FROM bookings b
  JOIN restaurants r ON b.restaurant_id = r.id
  WHERE b.user_id = p_user_id
    AND b.status IN ('pending','confirmed')
    AND (
      p_booking_time >= b.booking_time - (v_min_gap_minutes || ' minutes')::interval
      AND p_booking_time < b.booking_time + ((b.turn_time_minutes + v_min_gap_minutes) || ' minutes')::interval
    )
  LIMIT 1;

  IF v_conflict_booking.id IS NOT NULL THEN
    RAISE EXCEPTION 'You have another booking at % at %. Please leave at least 1 hour between reservations.',
      v_conflict_booking.restaurant_name,
      to_char(v_conflict_booking.booking_time, 'HH24:MI')
      USING ERRCODE = 'P0001';
  END IF;

  SELECT status, tier, addons
  INTO v_restaurant_status, v_restaurant_tier, v_restaurant_addons
  FROM restaurants WHERE id = p_restaurant_id;

  IF v_restaurant_status IS NULL THEN
    RAISE EXCEPTION 'Restaurant not found';
  END IF;

  IF v_restaurant_status != 'active' THEN
    RAISE EXCEPTION 'Restaurant is not currently accepting bookings';
  END IF;

  v_has_floor_plan   := (v_restaurant_addons IS NOT NULL AND 'floor_plan' = ANY(v_restaurant_addons));
  v_needs_auto_assign := (v_restaurant_tier = 'pro' OR v_has_floor_plan);

  IF NOT v_has_floor_plan THEN
    p_booking_policy := 'request';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM restaurant_vip_users
    WHERE user_id = p_user_id AND restaurant_id = p_restaurant_id
      AND (valid_until IS NULL OR valid_until > now())
  ) INTO v_is_vip;

  v_max_booking_days := CASE WHEN v_is_vip THEN 60 ELSE 30 END;

  IF p_booking_time > now() + (v_max_booking_days || ' days')::interval THEN
    RAISE EXCEPTION 'Booking date is beyond allowed window of % days', v_max_booking_days;
  END IF;

  IF p_booking_time <= now() + interval '15 minutes' THEN
    RAISE EXCEPTION 'Booking time must be at least 15 minutes in the future';
  END IF;

  LOOP
    v_confirmation_code := 'BK' ||
      TO_CHAR(now(), 'YYMMDD') ||
      UPPER(SUBSTRING(MD5(gen_random_uuid()::text || v_retry_count::text) FROM 1 FOR 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM bookings WHERE confirmation_code = v_confirmation_code);
    v_retry_count := v_retry_count + 1;
    IF v_retry_count > v_max_retries THEN
      v_confirmation_code := 'BK' || UPPER(REPLACE(gen_random_uuid()::text, '-', ''));
      EXIT;
    END IF;
  END LOOP;

  IF p_preferred_section IS NOT NULL THEN
    SELECT id INTO v_section_id
    FROM restaurant_sections
    WHERE restaurant_id = p_restaurant_id AND name = p_preferred_section AND is_active = true;
  END IF;

  IF v_needs_auto_assign AND (p_table_ids IS NULL OR array_length(p_table_ids, 1) = 0 OR array_length(p_table_ids, 1) IS NULL) THEN
    RAISE NOTICE 'Auto-selecting tables (tier: %, floor_plan: %, section: %)',
      v_restaurant_tier, v_has_floor_plan, p_preferred_section;

    SELECT array_agg(rt.id ORDER BY
      CASE WHEN p_table_preferences IS NOT NULL AND rt.table_type = ANY(p_table_preferences) THEN 0 ELSE 1 END,
      ABS(rt.capacity - p_party_size), rt.priority_score DESC)
    INTO v_available_tables
    FROM restaurant_tables rt
    WHERE rt.restaurant_id = p_restaurant_id AND rt.is_active = true
      AND (rt.section_id IS NULL OR EXISTS (
        SELECT 1 FROM restaurant_sections rs WHERE rs.id = rt.section_id AND rs.is_active = true))
      AND (v_section_id IS NULL OR rt.section_id = v_section_id)
      AND NOT EXISTS (
        SELECT 1 FROM booking_tables bt
        JOIN bookings b ON b.id = bt.booking_id
        WHERE bt.table_id = rt.id
          AND b.status IN ('confirmed','arrived','seated')
          AND b.booking_time < v_booking_end_time
          AND (b.booking_time + (b.turn_time_minutes || ' minutes')::interval) > p_booking_time
      );

    IF v_available_tables IS NOT NULL AND array_length(v_available_tables, 1) > 0 THEN
      SELECT rt.id INTO v_single_table
      FROM restaurant_tables rt
      WHERE rt.id = ANY(v_available_tables) AND rt.is_active = true
        AND (
          (rt.max_capacity >= p_party_size AND rt.min_capacity <= p_party_size)
          OR EXISTS (
            SELECT 1 FROM table_booking_rules tbr
            WHERE tbr.table_id = rt.id AND tbr.is_active = true AND tbr.booking_type = 'instant'
              AND (NOT EXISTS (SELECT 1 FROM jsonb_array_elements(tbr.conditions) c WHERE c->>'type' = 'party_size')
                OR EXISTS (SELECT 1 FROM jsonb_array_elements(tbr.conditions) c
                  WHERE c->>'type' = 'party_size'
                    AND ((c->>'operator' IN ('lte','at_most') AND p_party_size <= (c->>'value')::int)
                      OR (c->>'operator' IN ('gte','at_least') AND p_party_size >= (c->>'value')::int)
                      OR (c->>'operator' IN ('eq','exactly')  AND p_party_size  = (c->>'value')::int)
                      OR (c->>'operator' = 'gt'               AND p_party_size  > (c->>'value')::int)
                      OR (c->>'operator' = 'lt'               AND p_party_size  < (c->>'value')::int)
                      OR ((c ? 'min') AND (c ? 'max') AND p_party_size >= (c->>'min')::int AND p_party_size <= (c->>'max')::int))))
          )
        )
      ORDER BY
        CASE WHEN rt.max_capacity >= p_party_size AND rt.min_capacity <= p_party_size THEN 0 ELSE 1 END,
        CASE WHEN v_has_floor_plan AND rt.default_booking_type = 'instant' THEN 0 ELSE 1 END,
        CASE WHEN p_table_preferences IS NOT NULL AND rt.table_type = ANY(p_table_preferences) THEN 0 ELSE 1 END,
        ABS(rt.capacity - p_party_size), rt.priority_score DESC
      LIMIT 1;

      IF v_single_table IS NOT NULL THEN
        v_auto_selected_tables := ARRAY[v_single_table];
        RAISE NOTICE 'Selected single table % for party of %', v_single_table, p_party_size;
      ELSE
        v_auto_selected_tables := ARRAY[]::uuid[];
        v_remaining_capacity   := p_party_size;

        FOR v_table_id IN (
          SELECT rt.id FROM restaurant_tables rt
          WHERE rt.id = ANY(v_available_tables) AND rt.is_active = true AND rt.is_combinable = true
          ORDER BY CASE WHEN v_has_floor_plan AND rt.default_booking_type = 'instant' THEN 0 ELSE 1 END,
                   rt.capacity DESC, rt.priority_score DESC
        )
        LOOP
          IF v_remaining_capacity > 0 THEN
            v_auto_selected_tables := array_append(v_auto_selected_tables, v_table_id);
            SELECT v_remaining_capacity - rt.capacity INTO v_remaining_capacity
            FROM restaurant_tables rt WHERE rt.id = v_table_id;
            IF v_remaining_capacity <= 0 THEN EXIT; END IF;
          END IF;
        END LOOP;

        IF v_remaining_capacity > 0 THEN
          v_auto_selected_tables := NULL;
          RAISE NOTICE 'Could not find enough combinable tables for party of %', p_party_size;
        ELSE
          RAISE NOTICE 'Selected % tables (combination) for party of %',
            array_length(v_auto_selected_tables, 1), p_party_size;
        END IF;
      END IF;

      IF v_auto_selected_tables IS NOT NULL AND array_length(v_auto_selected_tables, 1) > 0 THEN
        p_table_ids := v_auto_selected_tables;
      END IF;
    ELSE
      RAISE NOTICE 'No available tables found for auto-selection (section: %)', p_preferred_section;
    END IF;
  END IF;

  IF v_has_floor_plan AND p_table_ids IS NOT NULL AND array_length(p_table_ids, 1) > 0 THEN
    v_effective_booking_type := 'instant';
    v_booking_date           := p_booking_time::date;
    v_booking_time_only      := p_booking_time::time;
    v_day_of_week            := EXTRACT(DOW FROM v_booking_date)::INT;

    FOR v_table_id IN SELECT unnest(p_table_ids) LOOP
      v_found_match       := false;
      v_table_booking_type := NULL;

      SELECT default_booking_type INTO v_table_booking_type
      FROM restaurant_tables WHERE id = v_table_id;

      FOR v_rule IN
        SELECT tbr.* FROM table_booking_rules tbr
        WHERE tbr.table_id = v_table_id AND tbr.is_active = true
        ORDER BY tbr.priority DESC
      LOOP
        v_all_match := true;

        IF v_rule.conditions IS NOT NULL AND jsonb_array_length(v_rule.conditions) > 0 THEN
          FOR v_condition IN SELECT * FROM jsonb_array_elements(v_rule.conditions) LOOP
            v_cond_type := v_condition->>'type';
            CASE v_cond_type
              WHEN 'party_size' THEN
                IF v_condition ? 'operator' THEN
                  CASE v_condition->>'operator'
                    WHEN 'gte','at_least' THEN IF p_party_size < (v_condition->>'value')::INT THEN v_all_match := false; END IF;
                    WHEN 'lte','at_most'  THEN IF p_party_size > (v_condition->>'value')::INT THEN v_all_match := false; END IF;
                    WHEN 'eq','exactly'   THEN IF p_party_size != (v_condition->>'value')::INT THEN v_all_match := false; END IF;
                    WHEN 'gt'             THEN IF p_party_size <= (v_condition->>'value')::INT THEN v_all_match := false; END IF;
                    WHEN 'lt'             THEN IF p_party_size >= (v_condition->>'value')::INT THEN v_all_match := false; END IF;
                    ELSE NULL;
                  END CASE;
                ELSE
                  IF v_condition ? 'min' AND p_party_size < (v_condition->>'min')::INT THEN v_all_match := false; END IF;
                  IF v_condition ? 'max' AND p_party_size > (v_condition->>'max')::INT THEN v_all_match := false; END IF;
                END IF;
              WHEN 'day_of_week' THEN
                IF v_condition ? 'days' THEN
                  IF NOT (v_condition->'days' @> to_jsonb(v_day_of_week)) THEN v_all_match := false; END IF;
                ELSIF v_condition ? 'value' THEN
                  IF NOT (v_condition->'value' @> to_jsonb(v_day_of_week)) THEN v_all_match := false; END IF;
                END IF;
              WHEN 'time_range' THEN
                IF v_condition ? 'start' THEN
                  IF v_booking_time_only < (v_condition->>'start')::TIME OR
                     v_booking_time_only > (v_condition->>'end')::TIME THEN v_all_match := false; END IF;
                ELSIF v_condition ? 'value' THEN
                  IF v_booking_time_only < (v_condition->'value'->>'start')::TIME OR
                     v_booking_time_only > (v_condition->'value'->>'end')::TIME THEN v_all_match := false; END IF;
                END IF;
              WHEN 'date_range' THEN
                IF v_condition ? 'start' THEN
                  IF v_booking_date < (v_condition->>'start')::DATE OR
                     v_booking_date > (v_condition->>'end')::DATE THEN v_all_match := false; END IF;
                ELSIF v_condition ? 'value' THEN
                  IF v_booking_date < (v_condition->'value'->>'start')::DATE OR
                     v_booking_date > (v_condition->'value'->>'end')::DATE THEN v_all_match := false; END IF;
                END IF;
              ELSE NULL;
            END CASE;
            EXIT WHEN NOT v_all_match;
          END LOOP;
        END IF;

        IF v_all_match THEN
          v_found_match        := true;
          v_table_booking_type := v_rule.booking_type;
          EXIT;
        END IF;
      END LOOP;

      IF v_table_booking_type = 'request' THEN
        v_effective_booking_type := 'request';
      END IF;
    END LOOP;

    RAISE NOTICE 'Booking type evaluated: % (was: %)', v_effective_booking_type, p_booking_policy;
    p_booking_policy := v_effective_booking_type;
  END IF;

  v_booking_status := CASE WHEN p_booking_policy = 'request' THEN 'pending' ELSE 'confirmed' END;

  IF p_table_ids IS NOT NULL AND array_length(p_table_ids, 1) > 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_restaurant_id::text || p_booking_time::text));

    SELECT array_agg(DISTINCT bt.table_id) INTO v_conflicted_tables
    FROM bookings b
    JOIN booking_tables bt ON b.id = bt.booking_id
    WHERE b.status IN ('confirmed','pending','arrived','seated')
      AND b.restaurant_id = p_restaurant_id
      AND bt.table_id = ANY(p_table_ids)
      AND b.booking_time < v_booking_end_time
      AND (b.booking_time + (b.turn_time_minutes || ' minutes')::interval) > p_booking_time;

    IF v_conflicted_tables IS NOT NULL AND array_length(v_conflicted_tables, 1) > 0 THEN
      RAISE EXCEPTION 'The selected tables are no longer available for this time slot. Conflicted tables: %',
        array_to_string(v_conflicted_tables, ', ')
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  BEGIN
    INSERT INTO bookings (
      user_id, restaurant_id, booking_time, party_size, status,
      special_requests, occasion, dietary_notes, table_preferences,
      turn_time_minutes, confirmation_code, is_group_booking,
      applied_offer_id, expected_loyalty_points, applied_loyalty_rule_id,
      preferred_section, created_at, updated_at
    ) VALUES (
      p_user_id, p_restaurant_id, p_booking_time, p_party_size, v_booking_status,
      p_special_requests, p_occasion, p_dietary_notes, p_table_preferences,
      p_turn_time, v_confirmation_code, p_is_group_booking,
      p_applied_offer_id, p_expected_loyalty_points, p_applied_loyalty_rule_id,
      p_preferred_section, now(), now()
    ) RETURNING * INTO v_booking;
  EXCEPTION
    WHEN unique_violation THEN
      v_confirmation_code := 'BK' || TO_CHAR(now(), 'YYMMDD') ||
                             UPPER(SUBSTRING(MD5(gen_random_uuid()::text || clock_timestamp()::text) FROM 1 FOR 8));
      INSERT INTO bookings (
        user_id, restaurant_id, booking_time, party_size, status,
        special_requests, occasion, dietary_notes, table_preferences,
        turn_time_minutes, confirmation_code, is_group_booking,
        applied_offer_id, expected_loyalty_points, applied_loyalty_rule_id,
        preferred_section, created_at, updated_at
      ) VALUES (
        p_user_id, p_restaurant_id, p_booking_time, p_party_size, v_booking_status,
        p_special_requests, p_occasion, p_dietary_notes, p_table_preferences,
        p_turn_time, v_confirmation_code, p_is_group_booking,
        p_applied_offer_id, p_expected_loyalty_points, p_applied_loyalty_rule_id,
        p_preferred_section, now(), now()
      ) RETURNING * INTO v_booking;
  END;

  IF p_table_ids IS NOT NULL AND array_length(p_table_ids, 1) > 0 THEN
    RAISE NOTICE 'Assigning % tables to booking % with status %',
      array_length(p_table_ids, 1), v_booking.id, v_booking_status;

    FOREACH v_table_id IN ARRAY p_table_ids LOOP
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM bookings b
          JOIN booking_tables bt ON b.id = bt.booking_id
          WHERE b.status IN ('confirmed','pending','arrived','seated')
            AND b.restaurant_id = p_restaurant_id
            AND bt.table_id = v_table_id
            AND b.booking_time < v_booking_end_time
            AND (b.booking_time + (b.turn_time_minutes || ' minutes')::interval) > p_booking_time
            AND b.id != v_booking.id
        ) THEN
          INSERT INTO booking_tables (booking_id, table_id, created_at)
          VALUES (v_booking.id, v_table_id, now())
          ON CONFLICT DO NOTHING;
          RAISE NOTICE 'Assigned table % to booking %', v_table_id, v_booking.id;
        ELSE
          RAISE NOTICE 'Table % became unavailable during booking creation', v_table_id;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- RAISE NOTICE is server-side only; keep this inner handler to not abort the loop
        RAISE NOTICE 'Could not link table % to booking: %', v_table_id, SQLERRM;
      END;
    END LOOP;
  ELSE
    RAISE NOTICE 'No tables to assign for booking % (tier: %, floor_plan: %, status: %)',
      v_booking.id, v_restaurant_tier, v_has_floor_plan, v_booking_status;
  END IF;

  RETURN json_build_object(
    'booking',             row_to_json(v_booking),
    'tables',              p_table_ids,
    'is_vip',              v_is_vip,
    'booking_window_days', v_max_booking_days,
    'is_duplicate_attempt',false,
    'tables_assigned',     COALESCE(array_length(p_table_ids, 1), 0),
    'resolved_booking_type', p_booking_policy
  );

EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- ============================================================
-- MISSING FUNCTIONS (check_booking_overlap, convert_waitlist_to_booking,
--   find_alternative_slots, get_booking_guarantee_details, check_event_capacity)
-- ============================================================

-- 38. check_booking_overlap  (plpgsql, SET search_path TO 'public')
CREATE OR REPLACE FUNCTION public.check_booking_overlap(p_table_ids uuid[], p_start_time timestamp with time zone, p_end_time timestamp with time zone, p_exclude_booking_id uuid DEFAULT NULL::uuid, p_exclude_user_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
DECLARE
  conflicting_booking_id uuid;
BEGIN
  IF p_table_ids IS NULL OR array_length(p_table_ids, 1) = 0 THEN
    RETURN NULL;
  END IF;

  IF p_start_time >= p_end_time THEN
    RAISE EXCEPTION 'Invalid time range: start time must be before end time';
  END IF;

  SELECT b.id INTO conflicting_booking_id
  FROM public.bookings b
  JOIN public.booking_tables bt ON b.id = bt.booking_id
  WHERE bt.table_id = ANY(p_table_ids)
    AND b.status IN ('confirmed', 'pending')
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    AND (p_exclude_user_id IS NULL OR b.user_id != p_exclude_user_id)
    AND (b.booking_time, b.booking_time + (b.turn_time_minutes || ' minutes')::interval)
        OVERLAPS (p_start_time, p_end_time)
  LIMIT 1;

  RETURN conflicting_booking_id;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 39. convert_waitlist_to_booking  (plpgsql, no SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.convert_waitlist_to_booking(p_waitlist_id uuid, p_staff_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $$
DECLARE
  v_waitlist record;
  v_booking_id uuid;
  v_booking_time timestamp with time zone;
BEGIN
  SELECT * INTO v_waitlist
  FROM waitlist
  WHERE id = p_waitlist_id
    AND status IN ('active', 'notified');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry not found or not active';
  END IF;

  v_booking_time := timezone('Asia/Beirut',
    (v_waitlist.desired_date::text || ' ' ||
     split_part(v_waitlist.desired_time_range, '-', 1))::timestamp
  );

  INSERT INTO bookings (
    user_id, restaurant_id, booking_time, party_size, status,
    special_requests, guest_name, guest_email, guest_phone, confirmation_code
  ) VALUES (
    v_waitlist.user_id, v_waitlist.restaurant_id, v_booking_time,
    v_waitlist.party_size, 'confirmed', v_waitlist.special_requests,
    v_waitlist.guest_name, v_waitlist.guest_email, v_waitlist.guest_phone,
    upper(substr(md5(random()::text), 1, 6))
  ) RETURNING id INTO v_booking_id;

  UPDATE waitlist
  SET status = 'booked', converted_booking_id = v_booking_id, updated_at = now()
  WHERE id = p_waitlist_id;

  RETURN v_booking_id;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 40. find_alternative_slots  (plpgsql, STABLE)
CREATE OR REPLACE FUNCTION public.find_alternative_slots(p_restaurant_id uuid, p_original_time timestamp with time zone, p_party_size integer, p_duration_minutes integer)
 RETURNS TABLE(suggested_time timestamp with time zone, available_tables integer)
 LANGUAGE plpgsql
 STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH time_slots AS (
    SELECT generate_series(
      p_original_time - interval '2 hours',
      p_original_time + interval '2 hours',
      interval '30 minutes'
    ) AS slot_time
  ),
  slot_availability AS (
    SELECT
      ts.slot_time,
      COUNT(DISTINCT rt.id) AS table_count
    FROM time_slots ts
    CROSS JOIN restaurant_tables rt
    WHERE rt.restaurant_id = p_restaurant_id
      AND rt.is_active = true
      AND rt.capacity >= p_party_size
      AND NOT EXISTS (
        SELECT 1
        FROM bookings b
        JOIN booking_tables bt ON bt.booking_id = b.id
        WHERE bt.table_id = rt.id
          AND b.status IN ('confirmed','arrived','seated','ordered','appetizers','main_course','dessert','payment')
          AND (
            (b.booking_time, b.booking_time + (b.turn_time_minutes || ' minutes')::interval)
            OVERLAPS
            (ts.slot_time, ts.slot_time + (p_duration_minutes || ' minutes')::interval)
          )
      )
    GROUP BY ts.slot_time
    HAVING COUNT(DISTINCT rt.id) > 0
  )
  SELECT
    slot_time AS suggested_time,
    table_count::integer AS available_tables
  FROM slot_availability
  WHERE slot_time != p_original_time
  ORDER BY ABS(EXTRACT(EPOCH FROM (slot_time - p_original_time)))
  LIMIT 5;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 41. get_booking_guarantee_details  (plpgsql, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_booking_guarantee_details(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_booking record;
  v_guarantee record;
  v_settings record;
  v_cancellation_window_hours integer;
  v_hours_until_booking numeric;
  v_penalty_amount numeric;
  v_potential_penalty numeric;
  v_base_fee numeric;
  v_service_fee_percentage numeric;
  v_service_fee_amount numeric;
  v_is_within_window boolean;
BEGIN
  SELECT b.*, r.cancellation_window_hours, r.service_fee_percentage
  INTO v_booking
  FROM public.bookings b
  JOIN public.restaurants r ON r.id = b.restaurant_id
  WHERE b.id = p_booking_id;

  IF v_booking IS NULL THEN
    RETURN jsonb_build_object('error', 'Booking not found');
  END IF;

  SELECT
    bg.id, bg.status, bg.created_at,
    pm.card_brand, pm.card_mask, pm.expiry_month, pm.expiry_year,
    cgs.no_show_fee, cgs.late_cancel_fee, cgs.fee_type, cgs.currency
  INTO v_guarantee
  FROM public.booking_guarantees bg
  JOIN public.payment_methods pm ON pm.id = bg.payment_method_id
  LEFT JOIN public.card_guarantee_settings cgs ON cgs.restaurant_id = v_booking.restaurant_id
  WHERE bg.booking_id = p_booking_id;

  v_hours_until_booking       := EXTRACT(EPOCH FROM (v_booking.booking_time - now())) / 3600;
  v_cancellation_window_hours := COALESCE(v_booking.cancellation_window_hours, 2);
  v_is_within_window          := v_hours_until_booking < v_cancellation_window_hours;

  IF v_guarantee.fee_type = 'per_cover' THEN
    v_base_fee := v_guarantee.late_cancel_fee * v_booking.party_size;
  ELSE
    v_base_fee := v_guarantee.late_cancel_fee;
  END IF;

  v_service_fee_percentage := COALESCE(v_booking.service_fee_percentage, 0);
  v_service_fee_amount := CASE
    WHEN v_service_fee_percentage > 0 THEN v_base_fee * (v_service_fee_percentage / 100)
    ELSE 0
  END;

  v_potential_penalty := v_base_fee + v_service_fee_amount;

  RETURN jsonb_build_object(
    'has_guarantee',                  v_guarantee.id IS NOT NULL,
    'guarantee_status',               v_guarantee.status,
    'card_brand',                     v_guarantee.card_brand,
    'card_mask',                      v_guarantee.card_mask,
    'no_show_fee',                    v_guarantee.no_show_fee,
    'late_cancel_fee',                v_guarantee.late_cancel_fee,
    'fee_type',                       v_guarantee.fee_type,
    'currency',                       COALESCE(v_guarantee.currency, 'USD'),
    'booking_id',                     p_booking_id,
    'hours_until_booking',            v_hours_until_booking,
    'cancellation_window_hours',      v_cancellation_window_hours,
    'is_within_cancellation_window',  v_is_within_window,
    'potential_penalty_amount',       v_potential_penalty,
    'base_fee',                       v_base_fee,
    'service_fee_percentage',         v_service_fee_percentage,
    'service_fee_amount',             v_service_fee_amount,
    'booking_guarantee_id',           v_guarantee.id
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- 42. check_event_capacity  (plpgsql, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.check_event_capacity(p_occurrence_id uuid, p_requested_party_size integer DEFAULT 1)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_max_capacity integer;
  v_current_bookings integer;
  v_status text;
BEGIN
  SELECT max_capacity, current_bookings, status
  INTO v_max_capacity, v_current_bookings, v_status
  FROM public.event_occurrences
  WHERE id = p_occurrence_id;

  IF NOT FOUND OR v_status != 'scheduled' THEN
    RETURN false;
  END IF;

  IF v_max_capacity IS NULL THEN
    RETURN true;
  END IF;

  RETURN (v_current_bookings + p_requested_party_size) <= v_max_capacity;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- ============================================================
-- BATCH: rpcleftovers.json - all remaining functions
-- ============================================================

-- admin_delete_restaurant
CREATE OR REPLACE FUNCTION public.admin_delete_restaurant(p_restaurant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Verify caller is an rbs_admin (security check)
  IF NOT EXISTS (
    SELECT 1 FROM rbs_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- a) Pre-nullify existing audit refs
  UPDATE audit_logs        SET restaurant_id = NULL WHERE restaurant_id = p_restaurant_id;
  UPDATE security_audit_log SET restaurant_id = NULL WHERE restaurant_id = p_restaurant_id;

  -- b) Delete the restaurant (DB trigger may insert new audit_log rows here;
  --    since the FK is INITIALLY DEFERRED this does NOT raise an error yet)
  DELETE FROM restaurants WHERE id = p_restaurant_id;

  -- c) Nullify any rows the trigger just created within this same transaction
  UPDATE audit_logs        SET restaurant_id = NULL WHERE restaurant_id = p_restaurant_id;
  UPDATE security_audit_log SET restaurant_id = NULL WHERE restaurant_id = p_restaurant_id;

  -- d) Transaction commits — FK check runs now, all rows are NULL → passes ✓
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- admin_get_failed_notifications
CREATE OR REPLACE FUNCTION public.admin_get_failed_notifications(p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, title text, body text, user_name text, user_email text, error text, created_at timestamp with time zone, attempts integer, campaign_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    no.id,
    no.title,
    no.body,
    COALESCE(p.full_name, 'Unknown User') as user_name,
    COALESCE(p.email, '') as user_email,
    COALESCE(no.error, 'Unknown error') as error,
    no.created_at,
    COALESCE(no.attempts, 0) as attempts,
    no.campaign_id
  FROM notification_outbox no
  LEFT JOIN profiles p ON p.id = no.user_id
  WHERE no.status = 'failed'
    AND no.retry_count < 5
  ORDER BY no.created_at DESC
  LIMIT p_limit;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- admin_list_campaigns
CREATE OR REPLACE FUNCTION public.admin_list_campaigns(p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, name text, status text, target_type text, target_count integer, sent_count integer, delivered_count integer, clicked_count integer, failed_count integer, created_at timestamp with time zone, scheduled_for timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.status,
    c.target_type,
    c.target_count,
    c.sent_count,
    c.delivered_count,
    c.clicked_count,
    c.failed_count,
    c.created_at,
    c.scheduled_for
  FROM notification_campaigns c
  ORDER BY c.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- admin_send_notification
CREATE OR REPLACE FUNCTION public.admin_send_notification(p_user_ids uuid[], p_title text, p_message text, p_channels text[] DEFAULT ARRAY['push'::text, 'inapp'::text], p_priority text DEFAULT 'normal'::text, p_type text DEFAULT 'admin_message'::text, p_scheduled_for timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_notification_id uuid;
  v_channel text;
  v_result jsonb;
  v_notifications_created integer := 0;
  v_queue_items_created integer := 0;
BEGIN
  -- Validate inputs
  IF array_length(p_user_ids, 1) IS NULL OR array_length(p_user_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No user IDs provided');
  END IF;
  
  IF p_title IS NULL OR trim(p_title) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Title is required');
  END IF;
  
  IF p_message IS NULL OR trim(p_message) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Message is required');
  END IF;

  -- Loop through each user
  FOREACH v_user_id IN ARRAY p_user_ids LOOP
    -- Create notification record
    INSERT INTO public.notifications (user_id, type, title, message, category, data)
    VALUES (
      v_user_id,
      p_type,
      p_title,
      p_message,
      'system',
      jsonb_build_object(
        'priority', p_priority,
        'sent_by_admin', true,
        'channels', p_channels
      )
    )
    RETURNING id INTO v_notification_id;
    
    v_notifications_created := v_notifications_created + 1;
    
    -- Queue for each channel
    FOREACH v_channel IN ARRAY p_channels LOOP
      INSERT INTO public.notification_outbox (
        notification_id,
        user_id,
        channel,
        payload,
        type,
        title,
        body,
        priority,
        scheduled_for
      ) VALUES (
        v_notification_id,
        v_user_id,
        v_channel,
        jsonb_build_object(
          'title', p_title,
          'body', p_message,
          'data', jsonb_build_object(
            'priority', p_priority,
            'category', 'system',
            'type', p_type
          )
        ),
        'general',
        p_title,
        p_message,
        p_priority,
        p_scheduled_for
      );
      
      v_queue_items_created := v_queue_items_created + 1;
    END LOOP;
  END LOOP;

  -- Return success with stats
  v_result := jsonb_build_object(
    'success', true,
    'notifications_created', v_notifications_created,
    'queue_items_created', v_queue_items_created,
    'users_targeted', array_length(p_user_ids, 1),
    'channels', p_channels
  );
  
  RETURN v_result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- archive_old_bookings
CREATE OR REPLACE FUNCTION public.archive_old_bookings(p_days_to_keep integer DEFAULT 90)
 RETURNS integer
 LANGUAGE plpgsql
AS $$
DECLARE
  v_archived_count integer;
BEGIN
  -- Archive instead of delete
  WITH archived AS (
    INSERT INTO booking_archive
    SELECT *, now(), null
    FROM bookings
    WHERE booking_time < CURRENT_DATE - (p_days_to_keep || ' days')::interval
      AND status IN ('completed', 'cancelled_by_user', 'no_show')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_archived_count FROM archived;
  
  -- Then delete from main table
  DELETE FROM bookings
  WHERE id IN (SELECT id FROM booking_archive WHERE archived_at >= now() - interval '1 minute');
  
  RETURN v_archived_count;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- archive_old_bookings
CREATE OR REPLACE FUNCTION public.archive_old_bookings(p_days_to_keep integer DEFAULT 90, p_archive_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $$
DECLARE
  v_cutoff_date date;
  v_archived_bookings integer := 0;
  v_archived_tables integer := 0;
  v_archived_history integer := 0;
  v_freed_space bigint := 0;
BEGIN
  v_cutoff_date := CURRENT_DATE - (p_days_to_keep || ' days')::interval;
  
  -- Start transaction
  BEGIN
    -- Archive bookings
    WITH archived AS (
      INSERT INTO archive.bookings
      SELECT b.*, now(), p_archive_user_id, 'Retention policy - ' || p_days_to_keep || ' days'
      FROM public.bookings b
      WHERE b.booking_time < v_cutoff_date
        AND b.status IN ('completed', 'cancelled_by_user', 'cancelled_by_restaurant', 'no_show')
      RETURNING id
    )
    SELECT COUNT(*) INTO v_archived_bookings FROM archived;

    -- Archive booking_tables
    WITH archived AS (
      INSERT INTO archive.booking_tables
      SELECT bt.*, now()
      FROM public.booking_tables bt
      WHERE bt.booking_id IN (
        SELECT id FROM archive.bookings 
        WHERE archived_at >= now() - INTERVAL '1 minute'
      )
      RETURNING booking_id
    )
    SELECT COUNT(*) INTO v_archived_tables FROM archived;

    -- Archive status history
    WITH archived AS (
      INSERT INTO archive.booking_status_history
      SELECT bsh.*, now()
      FROM public.booking_status_history bsh
      WHERE bsh.booking_id IN (
        SELECT id FROM archive.bookings 
        WHERE archived_at >= now() - INTERVAL '1 minute'
      )
      RETURNING booking_id
    )
    SELECT COUNT(DISTINCT booking_id) INTO v_archived_history FROM archived;

    -- Delete from main tables
    DELETE FROM public.booking_tables
    WHERE booking_id IN (
      SELECT id FROM archive.bookings 
      WHERE archived_at >= now() - INTERVAL '1 minute'
    );

    DELETE FROM public.bookings
    WHERE id IN (
      SELECT id FROM archive.bookings 
      WHERE archived_at >= now() - INTERVAL '1 minute'
    );

    -- Estimate freed space
    SELECT pg_total_relation_size('public.bookings') + 
           pg_total_relation_size('public.booking_tables') +
           pg_total_relation_size('public.booking_status_history')
    INTO v_freed_space;

    -- Vacuum tables to reclaim space
    VACUUM ANALYZE public.bookings;
    VACUUM ANALYZE public.booking_tables;
    VACUUM ANALYZE public.booking_status_history;

    RETURN jsonb_build_object(
      'archived_bookings', v_archived_bookings,
      'archived_tables', v_archived_tables,
      'archived_history_entries', v_archived_history,
      'cutoff_date', v_cutoff_date,
      'estimated_space_freed_bytes', v_freed_space,
      'archived_at', now()
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Error in archive_old_bookings: %', SQLERRM;
      RAISE;
  END;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- auto_assign_tables_to_booking
CREATE OR REPLACE FUNCTION public.auto_assign_tables_to_booking(p_booking_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_booking record;
  v_restaurant_tier text;
  v_available_tables uuid[];
  v_selected_tables uuid[];
  v_table_id uuid;
  v_remaining_capacity integer;
  v_booking_end_time timestamp with time zone;
  v_tables_assigned integer := 0;
  v_total_capacity integer := 0;
BEGIN
  -- Get booking details with restaurant info
  SELECT
    b.*,
    r.tier,
    r.id as rest_id
  INTO v_booking
  FROM bookings b
  JOIN restaurants r ON r.id = b.restaurant_id
  WHERE b.id = p_booking_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'reason', 'Booking not found',
      'booking_id', p_booking_id
    );
  END IF;

  -- Only for pro tier restaurants
  v_restaurant_tier := v_booking.tier;
  IF v_restaurant_tier != 'pro' THEN
    RETURN json_build_object(
      'success', false,
      'reason', 'Auto-assignment only for pro tier',
      'tier', v_restaurant_tier
    );
  END IF;

  -- Check if tables are already assigned
  IF EXISTS (SELECT 1 FROM booking_tables WHERE booking_id = p_booking_id) THEN
    RETURN json_build_object(
      'success', true,
      'reason', 'Tables already assigned',
      'tables_count', (SELECT COUNT(*) FROM booking_tables WHERE booking_id = p_booking_id)
    );
  END IF;

  -- Calculate booking end time
  v_booking_end_time := v_booking.booking_time + (v_booking.turn_time_minutes || ' minutes')::interval;

  -- Get available tables
  SELECT array_agg(rt.id ORDER BY
    CASE
      WHEN v_booking.table_preferences IS NOT NULL
        AND rt.table_type = ANY(v_booking.table_preferences)
      THEN 0
      ELSE 1
    END,
    ABS(rt.capacity - v_booking.party_size),
    rt.priority_score DESC
  )
  INTO v_available_tables
  FROM restaurant_tables rt
  WHERE rt.restaurant_id = v_booking.restaurant_id
    AND rt.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM booking_tables bt
      JOIN bookings b ON b.id = bt.booking_id
      WHERE bt.table_id = rt.id
        AND b.status IN ('confirmed', 'pending')
        AND b.booking_time < v_booking_end_time
        AND (b.booking_time + (b.turn_time_minutes || ' minutes')::interval) > v_booking.booking_time
    );

  IF v_available_tables IS NULL OR array_length(v_available_tables, 1) = 0 THEN
    RETURN json_build_object(
      'success', false,
      'reason', 'No available tables found',
      'party_size', v_booking.party_size
    );
  END IF;

  -- Smart table selection
  v_selected_tables := ARRAY[]::uuid[];
  v_remaining_capacity := v_booking.party_size;

  -- Try single table first
  SELECT rt.id INTO v_table_id
  FROM restaurant_tables rt
  WHERE rt.id = ANY(v_available_tables)
    AND rt.max_capacity >= v_booking.party_size
    AND rt.min_capacity <= v_booking.party_size
    AND rt.is_active = true
  ORDER BY
    CASE
      WHEN v_booking.table_preferences IS NOT NULL
        AND rt.table_type = ANY(v_booking.table_preferences)
      THEN 0
      ELSE 1
    END,
    ABS(rt.capacity - v_booking.party_size),
    rt.priority_score DESC
  LIMIT 1;

  IF v_table_id IS NOT NULL THEN
    v_selected_tables := ARRAY[v_table_id];
  ELSE
    -- Combine tables
    FOR v_table_id IN (
      SELECT rt.id
      FROM restaurant_tables rt
      WHERE rt.id = ANY(v_available_tables)
        AND rt.is_active = true
        AND rt.is_combinable = true
      ORDER BY rt.capacity DESC, rt.priority_score DESC
    )
    LOOP
      IF v_remaining_capacity > 0 THEN
        v_selected_tables := array_append(v_selected_tables, v_table_id);
        SELECT v_remaining_capacity - rt.capacity
        INTO v_remaining_capacity
        FROM restaurant_tables rt
        WHERE rt.id = v_table_id;
        IF v_remaining_capacity <= 0 THEN
          EXIT;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF v_remaining_capacity > 0 THEN
    RETURN json_build_object(
      'success', false,
      'reason', 'Insufficient table capacity',
      'capacity_shortfall', v_remaining_capacity
    );
  END IF;

  -- Assign tables
  FOREACH v_table_id IN ARRAY v_selected_tables LOOP
    BEGIN
      INSERT INTO booking_tables (booking_id, table_id, created_at)
      VALUES (p_booking_id, v_table_id, now())
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_tables_assigned = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to assign table %: %', v_table_id, SQLERRM;
    END;
  END LOOP;

  SELECT COALESCE(SUM(rt.capacity), 0)
  INTO v_total_capacity
  FROM restaurant_tables rt
  WHERE rt.id = ANY(v_selected_tables);

  RETURN json_build_object(
    'success', true,
    'tables_assigned', array_length(v_selected_tables, 1),
    'table_ids', v_selected_tables,
    'party_size', v_booking.party_size,
    'total_capacity', v_total_capacity
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- auto_decline_expired_requests
CREATE OR REPLACE FUNCTION public.auto_decline_expired_requests()
 RETURNS void
 LANGUAGE plpgsql
AS $$
DECLARE
  updated_bookings_count integer;
BEGIN
  -- Update expired bookings where booking time has passed
  WITH updated_bookings AS (
    UPDATE bookings 
    SET 
      status = 'auto_declined',
      auto_declined = true,
      updated_at = now(),
      acceptance_failed_reason = 'Booking time passed without restaurant response'
    WHERE 
      status = 'pending'
      AND booking_time < now() -- Booking time has passed
    RETURNING id
  )
  INSERT INTO booking_status_history (booking_id, old_status, new_status, metadata)
  SELECT 
    ub.id,
    'pending',
    'auto_declined',
    jsonb_build_object(
      'reason', 'Booking time passed', 
      'auto_declined', true,
      'expired_at', now()
    )
  FROM updated_bookings ub;
  
  GET DIAGNOSTICS updated_bookings_count = ROW_COUNT;
  
  IF updated_bookings_count > 0 THEN
    RAISE NOTICE 'Auto-declined % expired booking requests', updated_bookings_count;
  END IF;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- auto_expire_waitlist
CREATE OR REPLACE FUNCTION public.auto_expire_waitlist()
 RETURNS void
 LANGUAGE plpgsql
AS $$
BEGIN
  -- Expire entries past their expiration time
  UPDATE waitlist
  SET 
    status = 'expired',
    updated_at = now()
  WHERE 
    status = 'active'
    AND expires_at < now();
  
  -- Expire notified entries that didn't respond within 15 minutes
  UPDATE waitlist
  SET 
    status = 'expired',
    updated_at = now()
  WHERE 
    status = 'notified'
    AND notification_expires_at < now();
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- award_loyalty_points_with_tracking
CREATE OR REPLACE FUNCTION public.award_loyalty_points_with_tracking(p_user_id uuid, p_points integer, p_activity_type text DEFAULT 'manual_adjustment'::text, p_description text DEFAULT NULL::text, p_related_booking_id uuid DEFAULT NULL::uuid, p_related_review_id uuid DEFAULT NULL::uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(new_points integer, new_tier text, tier_changed boolean)
 LANGUAGE plpgsql
AS $$
DECLARE
  v_old_points INTEGER;
  v_new_points INTEGER;
  v_old_tier TEXT;
  v_new_tier TEXT;
  v_points_multiplier DECIMAL(3,2) := 1.0;
  v_final_points INTEGER;
BEGIN
  -- Get current points and tier
  SELECT loyalty_points, membership_tier 
  INTO v_old_points, v_old_tier
  FROM public.profiles 
  WHERE id = p_user_id;
  
  -- Get tier multiplier
  SELECT CASE
    WHEN v_old_tier = 'silver' THEN 1.1
    WHEN v_old_tier = 'gold' THEN 1.2
    WHEN v_old_tier = 'platinum' THEN 1.5
    ELSE 1.0
  END INTO v_points_multiplier;
  
  -- Calculate final points (only apply multiplier for positive points)
  v_final_points := CASE 
    WHEN p_points > 0 THEN ROUND(p_points * v_points_multiplier)
    ELSE p_points
  END;
  
  -- Update points
  UPDATE public.profiles
  SET loyalty_points = GREATEST(0, loyalty_points + v_final_points)
  WHERE id = p_user_id
  RETURNING loyalty_points INTO v_new_points;
  
  -- Calculate new tier
  v_new_tier := CASE
    WHEN v_new_points >= 3000 THEN 'platinum'
    WHEN v_new_points >= 1500 THEN 'gold'
    WHEN v_new_points >= 500 THEN 'silver'
    ELSE 'bronze'
  END;
  
  -- Update tier if changed
  IF v_new_tier != v_old_tier THEN
    UPDATE public.profiles
    SET membership_tier = v_new_tier
    WHERE id = p_user_id;
  END IF;
  
  -- Record activity
  INSERT INTO public.loyalty_activities (
    user_id,
    activity_type,
    points_earned,
    points_multiplier,
    description,
    related_booking_id,
    related_review_id,
    metadata
  ) VALUES (
    p_user_id,
    p_activity_type,
    v_final_points,
    v_points_multiplier,
    COALESCE(p_description, 'Points adjustment'),
    p_related_booking_id,
    p_related_review_id,
    p_metadata
  );
  
  RETURN QUERY SELECT v_new_points, v_new_tier, (v_new_tier != v_old_tier);
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- award_restaurant_loyalty_points
CREATE OR REPLACE FUNCTION public.award_restaurant_loyalty_points(p_booking_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $$
DECLARE
  v_rule RECORD;
  v_booking RECORD;
  v_current_balance integer;
  v_success boolean := false;
BEGIN
  -- Get applicable rule
  SELECT clr.rule_id, clr.points_to_award, clr.rule_name
  INTO v_rule
  FROM check_loyalty_rules_for_booking(p_booking_id) clr
  LIMIT 1;
  
  IF v_rule.rule_id IS NULL THEN
    RAISE NOTICE 'No applicable loyalty rule found for booking: %', p_booking_id;
    RETURN false;
  END IF;
  
  -- Get booking details
  SELECT b.*
  INTO v_booking
  FROM bookings b
  WHERE b.id = p_booking_id;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Booking not found: %', p_booking_id;
    RETURN false;
  END IF;
  
  -- Check if booking is confirmed
  IF v_booking.status != 'confirmed' THEN
    RAISE NOTICE 'Booking not confirmed: %', p_booking_id;
    RETURN false;
  END IF;
  
  -- Check if points already awarded
  IF EXISTS (
    SELECT 1 
    FROM user_loyalty_rule_usage ulru 
    WHERE ulru.booking_id = p_booking_id 
    AND ulru.user_id = v_booking.user_id
  ) THEN
    RAISE NOTICE 'Points already awarded for booking: %', p_booking_id;
    RETURN false;
  END IF;
  
  -- Start transaction
  -- Lock restaurant balance row
  SELECT rlb.current_balance 
  INTO v_current_balance
  FROM restaurant_loyalty_balance rlb
  WHERE rlb.restaurant_id = v_booking.restaurant_id
  FOR UPDATE;
  
  -- Double-check balance
  IF v_current_balance < v_rule.points_to_award THEN
    RAISE NOTICE 'Insufficient restaurant balance. Required: %, Available: %', v_rule.points_to_award, v_current_balance;
    RETURN false;
  END IF;
  
  BEGIN
    -- Deduct from restaurant balance
    UPDATE restaurant_loyalty_balance
    SET 
      current_balance = current_balance - v_rule.points_to_award,
      updated_at = now()
    WHERE restaurant_id = v_booking.restaurant_id;
    
    -- Record transaction
    INSERT INTO restaurant_loyalty_transactions (
      restaurant_id,
      transaction_type,
      points,
      balance_before,
      balance_after,
      description,
      booking_id,
      user_id
    ) VALUES (
      v_booking.restaurant_id,
      'deduction',
      v_rule.points_to_award,
      v_current_balance,
      v_current_balance - v_rule.points_to_award,
      'Points awarded for booking - ' || v_rule.rule_name,
      p_booking_id,
      v_booking.user_id
    );
    
    -- Award points to user
    UPDATE profiles
    SET loyalty_points = loyalty_points + v_rule.points_to_award
    WHERE id = v_booking.user_id;
    
    -- Record loyalty activity
    INSERT INTO loyalty_activities (
      user_id,
      activity_type,
      points_earned,
      description,
      related_booking_id,
      metadata
    ) VALUES (
      v_booking.user_id,
      'booking_completed',
      v_rule.points_to_award,
      'Earned from ' || v_rule.rule_name,
      p_booking_id,
      jsonb_build_object('rule_id', v_rule.rule_id, 'rule_name', v_rule.rule_name)
    );
    
    -- Update rule usage
    UPDATE restaurant_loyalty_rules
    SET current_uses = current_uses + 1
    WHERE id = v_rule.rule_id;
    
    -- Record user usage
    INSERT INTO user_loyalty_rule_usage (user_id, rule_id, booking_id)
    VALUES (v_booking.user_id, v_rule.rule_id, p_booking_id);
    
    -- Update booking with applied rule
    UPDATE bookings
    SET 
      applied_loyalty_rule_id = v_rule.rule_id,
      loyalty_points_earned = v_rule.points_to_award,
      updated_at = now()
    WHERE id = p_booking_id;
    
    RAISE NOTICE 'Successfully awarded % points to user % for booking %', v_rule.points_to_award, v_booking.user_id, p_booking_id;
    RETURN true;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error awarding loyalty points: %', SQLERRM;
    RETURN false;
  END;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- bulk_replace_restaurant_shifts
CREATE OR REPLACE FUNCTION public.bulk_replace_restaurant_shifts(p_restaurant_id uuid, p_shifts jsonb)
 RETURNS SETOF restaurant_shifts
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
DECLARE
  v_is_manager boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.restaurant_staff
    WHERE user_id = auth.uid()
      AND restaurant_id = p_restaurant_id
      AND is_active = true
      AND role IN ('owner', 'manager')
  ) INTO v_is_manager;

  IF NOT v_is_manager THEN
    RAISE EXCEPTION 'Only owners/managers can manage shifts';
  END IF;

  DELETE FROM public.restaurant_shifts WHERE restaurant_id = p_restaurant_id;

  IF p_shifts IS NOT NULL AND jsonb_array_length(p_shifts) > 0 THEN
    INSERT INTO public.restaurant_shifts (
      restaurant_id, name, shift_type, start_time, end_time,
      is_active, display_order, color, applicable_days
    )
    SELECT
      p_restaurant_id,
      (s->>'name')::text,
      COALESCE((s->>'shift_type')::text, 'custom'),
      (s->>'start_time')::time,
      (s->>'end_time')::time,
      COALESCE((s->>'is_active')::boolean, true),
      COALESCE((s->>'display_order')::integer, 0),
      NULLIF(s->>'color', ''),
      COALESCE(
        (SELECT array_agg((v)::integer) FROM jsonb_array_elements_text(s->'applicable_days') v),
        ARRAY[0,1,2,3,4,5,6]
      )
    FROM jsonb_array_elements(p_shifts) s;
  END IF;

  RETURN QUERY
    SELECT * FROM public.restaurant_shifts
    WHERE restaurant_id = p_restaurant_id
    ORDER BY display_order;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- bulk_update_delivery_status
CREATE OR REPLACE FUNCTION public.bulk_update_delivery_status(p_delivered_ids uuid[], p_failed_ids uuid[], p_errors text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_campaign_id UUID;
  v_outbox_id UUID;
  v_idx INTEGER;
BEGIN
  -- Update delivered items
  IF array_length(p_delivered_ids, 1) > 0 THEN
    UPDATE notification_outbox
    SET delivered_at = NOW()
    WHERE id = ANY(p_delivered_ids)
      AND delivered_at IS NULL;
    
    -- Update campaign delivered counts
    UPDATE notification_campaigns nc
    SET delivered_count = delivered_count + sub.cnt,
        updated_at = NOW()
    FROM (
      SELECT campaign_id, COUNT(*) as cnt
      FROM notification_outbox
      WHERE id = ANY(p_delivered_ids) AND campaign_id IS NOT NULL
      GROUP BY campaign_id
    ) sub
    WHERE nc.id = sub.campaign_id;
  END IF;
  
  -- Update failed items with errors
  IF array_length(p_failed_ids, 1) > 0 THEN
    FOR v_idx IN 1..array_length(p_failed_ids, 1) LOOP
      UPDATE notification_outbox
      SET status = 'failed',
          error = COALESCE(p_errors[v_idx], 'Delivery verification failed')
      WHERE id = p_failed_ids[v_idx];
    END LOOP;
    
    -- Update campaign failed counts  
    UPDATE notification_campaigns nc
    SET failed_count = failed_count + sub.cnt,
        updated_at = NOW()
    FROM (
      SELECT campaign_id, COUNT(*) as cnt
      FROM notification_outbox
      WHERE id = ANY(p_failed_ids) AND campaign_id IS NOT NULL
      GROUP BY campaign_id
    ) sub
    WHERE nc.id = sub.campaign_id;
  END IF;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- calculate_tier
CREATE OR REPLACE FUNCTION public.calculate_tier(p_points integer)
 RETURNS text
 LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE
    WHEN p_points >= 3000 THEN 'platinum'
    WHEN p_points >= 1500 THEN 'gold'
    WHEN p_points >= 500 THEN 'silver'
    ELSE 'bronze'
  END;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- calculate_user_rating
CREATE OR REPLACE FUNCTION public.calculate_user_rating(user_id_param uuid)
 RETURNS numeric
 LANGUAGE plpgsql
AS $$
DECLARE
  base_rating numeric := 5.0;
  total_bookings integer := 0;
  completed_bookings integer := 0;
  no_show_count integer := 0;
  late_cancellation_count integer := 0;
  early_cancellation_count integer := 0;
  recent_reviews_bonus numeric := 0.0;
  final_rating numeric;
  completion_rate numeric;
  no_show_penalty numeric := 0.0;
  cancellation_penalty numeric := 0.0;
BEGIN
  -- Get booking statistics
  SELECT 
    COALESCE(p.total_bookings, 0),
    COALESCE(p.completed_bookings, 0),
    COALESCE(p.no_show_bookings, 0)
  INTO total_bookings, completed_bookings, no_show_count
  FROM profiles p
  WHERE p.id = user_id_param;

  -- Count late cancellations (within 24 hours of booking time)
  SELECT COUNT(*)
  INTO late_cancellation_count
  FROM bookings b
  WHERE b.user_id = user_id_param
    AND b.status = 'cancelled_by_user'
    AND b.booking_time - b.created_at < INTERVAL '24 hours'
    AND b.created_at > NOW() - INTERVAL '1 year';

  -- Count early cancellations (more than 24 hours before booking time)
  SELECT COUNT(*)
  INTO early_cancellation_count
  FROM bookings b
  WHERE b.user_id = user_id_param
    AND b.status = 'cancelled_by_user'
    AND b.booking_time - b.created_at >= INTERVAL '24 hours'
    AND b.created_at > NOW() - INTERVAL '1 year';

  -- Get recent positive reviews bonus
  SELECT COALESCE(SUM(CASE WHEN r.rating >= 4 THEN 0.1 ELSE 0 END), 0)
  INTO recent_reviews_bonus
  FROM reviews r
  WHERE r.user_id = user_id_param
    AND r.created_at > NOW() - INTERVAL '6 months';

  -- Cap the bonus at +0.5
  recent_reviews_bonus := LEAST(recent_reviews_bonus, 0.5);

  -- Calculate penalties
  no_show_penalty := LEAST(no_show_count * 0.5, 2.0);
  cancellation_penalty := LEAST(late_cancellation_count * 0.2, 1.0) + LEAST(early_cancellation_count * 0.1, 0.5);

  -- Calculate final rating
  final_rating := base_rating - no_show_penalty - cancellation_penalty + recent_reviews_bonus;

  -- Additional penalty for very low completion rate
  IF total_bookings > 5 THEN
    completion_rate := completed_bookings::numeric / total_bookings::numeric;
    IF completion_rate < 0.7 THEN
      final_rating := final_rating - (0.7 - completion_rate);
    END IF;
  END IF;

  -- Ensure rating stays within bounds
  final_rating := GREATEST(1.0, LEAST(5.0, final_rating));

  RETURN final_rating;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- check_booking_system_health
CREATE OR REPLACE FUNCTION public.check_booking_system_health()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb := '{}';
  v_pending_bookings integer;
  v_upcoming_bookings integer;
  v_orphaned_tables integer;
  v_table_conflicts integer;
  v_stale_pending integer;
BEGIN
  -- Check pending bookings count
  SELECT COUNT(*) INTO v_pending_bookings
  FROM bookings
  WHERE status = 'pending'
    AND created_at > now() - INTERVAL '24 hours';

  -- Check upcoming bookings in next 24 hours
  SELECT COUNT(*) INTO v_upcoming_bookings
  FROM bookings
  WHERE status = 'confirmed'
    AND booking_time BETWEEN now() AND now() + INTERVAL '24 hours';

  -- Check for orphaned booking_tables
  SELECT COUNT(*) INTO v_orphaned_tables
  FROM booking_tables bt
  WHERE NOT EXISTS (
    SELECT 1 FROM bookings b WHERE b.id = bt.booking_id
  );

  -- Check for table conflicts (double bookings)
  WITH conflicts AS (
    SELECT 
      bt1.table_id,
      COUNT(DISTINCT bt1.booking_id) as conflict_count
    FROM booking_tables bt1
    JOIN bookings b1 ON bt1.booking_id = b1.id
    JOIN booking_tables bt2 ON bt1.table_id = bt2.table_id AND bt1.booking_id != bt2.booking_id
    JOIN bookings b2 ON bt2.booking_id = b2.id
    WHERE b1.status IN ('confirmed', 'pending')
      AND b2.status IN ('confirmed', 'pending')
      AND (b1.booking_time, b1.booking_time + (b1.turn_time_minutes || ' minutes')::interval)
          OVERLAPS (b2.booking_time, b2.booking_time + (b2.turn_time_minutes || ' minutes')::interval)
    GROUP BY bt1.table_id
  )
  SELECT COUNT(*) INTO v_table_conflicts FROM conflicts;

  -- Check stale pending bookings
  SELECT COUNT(*) INTO v_stale_pending
  FROM bookings
  WHERE status = 'pending'
    AND created_at < now() - INTERVAL '2 hours';

  v_result := jsonb_build_object(
    'status', CASE 
      WHEN v_orphaned_tables > 0 OR v_table_conflicts > 0 THEN 'critical'
      WHEN v_stale_pending > 5 THEN 'warning'
      ELSE 'healthy'
    END,
    'metrics', jsonb_build_object(
      'pending_bookings', v_pending_bookings,
      'upcoming_24h', v_upcoming_bookings,
      'orphaned_tables', v_orphaned_tables,
      'table_conflicts', v_table_conflicts,
      'stale_pending', v_stale_pending
    ),
    'checked_at', now()
  );

  -- Auto-fix orphaned tables if found
  IF v_orphaned_tables > 0 THEN
    DELETE FROM booking_tables
    WHERE booking_id NOT IN (SELECT id FROM bookings);
    
    v_result := v_result || jsonb_build_object('auto_fixed_orphans', v_orphaned_tables);
  END IF;

  RETURN v_result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- check_deposit_schedule
CREATE OR REPLACE FUNCTION public.check_deposit_schedule(p_restaurant_id uuid, p_booking_time timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
AS $$
DECLARE
  v_settings record;
  v_rules jsonb;
  v_default_required boolean;
  v_rule jsonb;
  v_booking_day text;
  v_booking_time time;
  v_booking_date text;
  v_rule_days jsonb;
  v_rule_start time;
  v_rule_end time;
  v_rule_dates jsonb;
  v_day text;
BEGIN
  -- Get deposit settings for the restaurant
  SELECT * INTO v_settings
  FROM public.deposit_payment_settings
  WHERE restaurant_id = p_restaurant_id AND enabled = true;
  
  -- If no settings or not enabled, deposit not required
  IF v_settings IS NULL THEN
    RETURN false;
  END IF;
  
  -- Extract schedule rules and default
  v_rules := v_settings.schedule_rules -> 'rules';
  v_default_required := COALESCE((v_settings.schedule_rules ->> 'default')::boolean, true);
  
  -- If no rules defined, use default
  IF v_rules IS NULL OR jsonb_array_length(v_rules) = 0 THEN
    RETURN v_default_required;
  END IF;
  
  -- Extract booking day (lowercase 3-letter abbreviation) and time
  v_booking_day := lower(to_char(p_booking_time, 'Dy')); -- mon, tue, wed, etc.
  v_booking_time := p_booking_time::time;
  v_booking_date := to_char(p_booking_time, 'YYYY-MM-DD');
  
  -- Check each rule
  FOR v_rule IN SELECT * FROM jsonb_array_elements(v_rules)
  LOOP
    -- Check specific dates rule (e.g., holidays)
    IF (v_rule ->> 'allDay')::boolean = true AND v_rule ? 'dates' THEN
      v_rule_dates := v_rule -> 'dates';
      IF v_rule_dates @> to_jsonb(v_booking_date) THEN
        RETURN true;
      END IF;
      CONTINUE;
    END IF;
    
    -- Check day-based rules
    IF v_rule ? 'days' THEN
      v_rule_days := v_rule -> 'days';
      
      -- Check if booking day matches any rule day
      FOR v_day IN SELECT * FROM jsonb_array_elements_text(v_rule_days)
      LOOP
        IF v_day = v_booking_day THEN
          -- Day matches, now check time range if specified
          IF v_rule ? 'start' AND v_rule ? 'end' THEN
            v_rule_start := (v_rule ->> 'start')::time;
            v_rule_end := (v_rule ->> 'end')::time;
            
            -- Handle overnight ranges (e.g., 22:00 to 02:00)
            IF v_rule_end < v_rule_start THEN
              IF v_booking_time >= v_rule_start OR v_booking_time <= v_rule_end THEN
                RETURN true;
              END IF;
            ELSE
              IF v_booking_time >= v_rule_start AND v_booking_time <= v_rule_end THEN
                RETURN true;
              END IF;
            END IF;
          ELSE
            -- No time specified, entire day matches
            RETURN true;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  
  -- No rules matched, return default
  RETURN v_default_required;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- check_deposit_schedule_with_rule
CREATE OR REPLACE FUNCTION public.check_deposit_schedule_with_rule(p_restaurant_id uuid, p_booking_time timestamp with time zone, p_party_size integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $$
DECLARE
  v_settings record;
  v_rules jsonb;
  v_default_required boolean;
  v_rule jsonb;
  v_booking_day text;
  v_booking_time time;
  v_booking_date text;
  v_rule_days jsonb;
  v_rule_start time;
  v_rule_end time;
  v_rule_dates jsonb;
  v_day text;
  v_rule_min_party_size integer;
BEGIN
  SELECT * INTO v_settings
  FROM public.deposit_payment_settings
  WHERE restaurant_id = p_restaurant_id AND enabled = true;

  IF v_settings IS NULL THEN
    RETURN jsonb_build_object('required', false, 'matched_rule', null, 'use_default', false);
  END IF;

  v_rules := v_settings.schedule_rules -> 'rules';
  v_default_required := COALESCE((v_settings.schedule_rules ->> 'default')::boolean, true);

  IF v_rules IS NULL OR jsonb_array_length(v_rules) = 0 THEN
    RETURN jsonb_build_object('required', v_default_required, 'matched_rule', null, 'use_default', true);
  END IF;

  v_booking_day := lower(to_char(p_booking_time, 'Dy'));
  v_booking_time := p_booking_time::time;
  v_booking_date := to_char(p_booking_time, 'YYYY-MM-DD');

  -- FIRST PASS: Check date-based rules (specific dates like holidays)
  -- These take priority over recurring day-based rules
  FOR v_rule IN SELECT * FROM jsonb_array_elements(v_rules)
  LOOP
    -- Skip rules without dates array
    IF NOT (v_rule ? 'dates') THEN
      CONTINUE;
    END IF;

    -- Check per-rule minimum party size
    v_rule_min_party_size := (v_rule ->> 'minimum_party_size')::integer;
    IF v_rule_min_party_size IS NOT NULL AND p_party_size < v_rule_min_party_size THEN
      CONTINUE;
    END IF;

    v_rule_dates := v_rule -> 'dates';
    IF v_rule_dates @> to_jsonb(v_booking_date) THEN
      -- Date matches - check if it's an all-day rule or time-specific
      IF (v_rule ->> 'allDay')::boolean = true THEN
        IF (v_rule ->> 'require_deposit')::boolean = true THEN
          RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
        ELSIF (v_rule ->> 'require_deposit')::boolean = false THEN
          RETURN jsonb_build_object('required', false, 'matched_rule', v_rule, 'use_default', false);
        ELSE
          RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
        END IF;
      ELSE
        -- Time-specific date rule
        IF v_rule ? 'start' AND v_rule ? 'end' THEN
          v_rule_start := (v_rule ->> 'start')::time;
          v_rule_end := (v_rule ->> 'end')::time;
          IF v_rule_end < v_rule_start THEN
            -- Overnight range
            IF v_booking_time >= v_rule_start OR v_booking_time <= v_rule_end THEN
              IF (v_rule ->> 'require_deposit')::boolean = true THEN
                RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
              ELSIF (v_rule ->> 'require_deposit')::boolean = false THEN
                RETURN jsonb_build_object('required', false, 'matched_rule', v_rule, 'use_default', false);
              ELSE
                RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
              END IF;
            END IF;
          ELSE
            IF v_booking_time >= v_rule_start AND v_booking_time <= v_rule_end THEN
              IF (v_rule ->> 'require_deposit')::boolean = true THEN
                RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
              ELSIF (v_rule ->> 'require_deposit')::boolean = false THEN
                RETURN jsonb_build_object('required', false, 'matched_rule', v_rule, 'use_default', false);
              ELSE
                RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
              END IF;
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- SECOND PASS: Check day-based rules (recurring weekly rules)
  FOR v_rule IN SELECT * FROM jsonb_array_elements(v_rules)
  LOOP
    -- Skip rules with dates array (already checked in first pass)
    IF v_rule ? 'dates' THEN
      CONTINUE;
    END IF;

    -- Skip rules without days array
    IF NOT (v_rule ? 'days') THEN
      CONTINUE;
    END IF;

    -- Check per-rule minimum party size
    v_rule_min_party_size := (v_rule ->> 'minimum_party_size')::integer;
    IF v_rule_min_party_size IS NOT NULL AND p_party_size < v_rule_min_party_size THEN
      CONTINUE;
    END IF;

    v_rule_days := v_rule -> 'days';
    FOR v_day IN SELECT * FROM jsonb_array_elements_text(v_rule_days)
    LOOP
      IF lower(v_day) = v_booking_day THEN
        IF v_rule ? 'start' AND v_rule ? 'end' THEN
          v_rule_start := (v_rule ->> 'start')::time;
          v_rule_end := (v_rule ->> 'end')::time;
          IF v_rule_end < v_rule_start THEN
            IF v_booking_time >= v_rule_start OR v_booking_time <= v_rule_end THEN
              IF (v_rule ->> 'require_deposit')::boolean = true THEN
                RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
              ELSIF (v_rule ->> 'require_deposit')::boolean = false THEN
                RETURN jsonb_build_object('required', false, 'matched_rule', v_rule, 'use_default', false);
              ELSE
                RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
              END IF;
            END IF;
          ELSE
            IF v_booking_time >= v_rule_start AND v_booking_time <= v_rule_end THEN
              IF (v_rule ->> 'require_deposit')::boolean = true THEN
                RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
              ELSIF (v_rule ->> 'require_deposit')::boolean = false THEN
                RETURN jsonb_build_object('required', false, 'matched_rule', v_rule, 'use_default', false);
              ELSE
                RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
              END IF;
            END IF;
          END IF;
        ELSE
          -- All day rule (no time range)
          IF (v_rule ->> 'require_deposit')::boolean = true THEN
            RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
          ELSIF (v_rule ->> 'require_deposit')::boolean = false THEN
            RETURN jsonb_build_object('required', false, 'matched_rule', v_rule, 'use_default', false);
          ELSE
            RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
          END IF;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('required', v_default_required, 'matched_rule', null, 'use_default', true);
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- check_guarantee_schedule
CREATE OR REPLACE FUNCTION public.check_guarantee_schedule(p_restaurant_id uuid, p_booking_time timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
AS $$
DECLARE
  v_settings record;
  v_rules jsonb;
  v_default_required boolean;
  v_rule jsonb;
  v_booking_day text;
  v_booking_time time;
  v_booking_date text;
  v_rule_days jsonb;
  v_rule_start time;
  v_rule_end time;
  v_rule_dates jsonb;
  v_day text;
BEGIN
  -- Get guarantee settings for the restaurant
  SELECT * INTO v_settings
  FROM public.card_guarantee_settings
  WHERE restaurant_id = p_restaurant_id AND enabled = true;
  
  -- If no settings or not enabled, guarantee not required
  IF v_settings IS NULL THEN
    RETURN false;
  END IF;
  
  -- Extract schedule rules and default
  v_rules := v_settings.schedule_rules -> 'rules';
  v_default_required := COALESCE((v_settings.schedule_rules ->> 'default')::boolean, true);
  
  -- If no rules defined, use default
  IF v_rules IS NULL OR jsonb_array_length(v_rules) = 0 THEN
    RETURN v_default_required;
  END IF;
  
  -- Extract booking day (lowercase 3-letter abbreviation) and time
  v_booking_day := lower(to_char(p_booking_time, 'Dy')); -- mon, tue, wed, etc.
  v_booking_time := p_booking_time::time;
  v_booking_date := to_char(p_booking_time, 'YYYY-MM-DD');
  
  -- Check each rule
  FOR v_rule IN SELECT * FROM jsonb_array_elements(v_rules)
  LOOP
    -- Check specific dates rule (e.g., holidays)
    IF (v_rule ->> 'allDay')::boolean = true AND v_rule ? 'dates' THEN
      v_rule_dates := v_rule -> 'dates';
      IF v_rule_dates @> to_jsonb(v_booking_date) THEN
        RETURN true;
      END IF;
      CONTINUE;
    END IF;
    
    -- Check day-based rules
    IF v_rule ? 'days' THEN
      v_rule_days := v_rule -> 'days';
      
      -- Check if booking day matches any rule day
      FOR v_day IN SELECT * FROM jsonb_array_elements_text(v_rule_days)
      LOOP
        IF v_day = v_booking_day THEN
          -- Day matches, now check time range if specified
          IF v_rule ? 'start' AND v_rule ? 'end' THEN
            v_rule_start := (v_rule ->> 'start')::time;
            v_rule_end := (v_rule ->> 'end')::time;
            
            -- Handle overnight ranges (e.g., 22:00 to 02:00)
            IF v_rule_end < v_rule_start THEN
              IF v_booking_time >= v_rule_start OR v_booking_time <= v_rule_end THEN
                RETURN true;
              END IF;
            ELSE
              IF v_booking_time >= v_rule_start AND v_booking_time <= v_rule_end THEN
                RETURN true;
              END IF;
            END IF;
          ELSE
            -- No time specified, entire day matches
            RETURN true;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  
  -- No rules matched, return default
  RETURN v_default_required;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- check_guarantee_schedule_with_rule
CREATE OR REPLACE FUNCTION public.check_guarantee_schedule_with_rule(p_restaurant_id uuid, p_booking_time timestamp with time zone, p_party_size integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $$
DECLARE
  v_settings record;
  v_rules jsonb;
  v_default_required boolean;
  v_rule jsonb;
  v_booking_day text;
  v_booking_time time;
  v_booking_date text;
  v_rule_days jsonb;
  v_rule_start time;
  v_rule_end time;
  v_rule_dates jsonb;
  v_day text;
  v_rule_min_party_size integer;
BEGIN
  SELECT * INTO v_settings
  FROM public.card_guarantee_settings
  WHERE restaurant_id = p_restaurant_id AND enabled = true;

  IF v_settings IS NULL THEN
    RETURN jsonb_build_object('required', false, 'matched_rule', null, 'use_default', false);
  END IF;

  v_rules := v_settings.schedule_rules -> 'rules';
  v_default_required := COALESCE((v_settings.schedule_rules ->> 'default')::boolean, true);

  IF v_rules IS NULL OR jsonb_array_length(v_rules) = 0 THEN
    RETURN jsonb_build_object('required', v_default_required, 'matched_rule', null, 'use_default', true);
  END IF;

  v_booking_day := lower(to_char(p_booking_time, 'Dy'));
  v_booking_time := p_booking_time::time;
  v_booking_date := to_char(p_booking_time, 'YYYY-MM-DD');

  -- FIRST PASS: Check date-based rules (specific dates like holidays)
  FOR v_rule IN SELECT * FROM jsonb_array_elements(v_rules)
  LOOP
    IF NOT (v_rule ? 'dates') THEN
      CONTINUE;
    END IF;

    v_rule_min_party_size := (v_rule ->> 'minimum_party_size')::integer;
    IF v_rule_min_party_size IS NOT NULL AND p_party_size < v_rule_min_party_size THEN
      CONTINUE;
    END IF;

    v_rule_dates := v_rule -> 'dates';
    IF v_rule_dates @> to_jsonb(v_booking_date) THEN
      IF (v_rule ->> 'allDay')::boolean = true THEN
        IF (v_rule ->> 'require_deposit')::boolean = true OR (v_rule ->> 'require_guarantee')::boolean = true THEN
          RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
        ELSIF (v_rule ->> 'require_deposit')::boolean = false OR (v_rule ->> 'require_guarantee')::boolean = false THEN
          RETURN jsonb_build_object('required', false, 'matched_rule', v_rule, 'use_default', false);
        ELSE
          RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
        END IF;
      ELSE
        IF v_rule ? 'start' AND v_rule ? 'end' THEN
          v_rule_start := (v_rule ->> 'start')::time;
          v_rule_end := (v_rule ->> 'end')::time;
          IF v_rule_end < v_rule_start THEN
            IF v_booking_time >= v_rule_start OR v_booking_time <= v_rule_end THEN
              IF (v_rule ->> 'require_deposit')::boolean = true OR (v_rule ->> 'require_guarantee')::boolean = true THEN
                RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
              ELSIF (v_rule ->> 'require_deposit')::boolean = false OR (v_rule ->> 'require_guarantee')::boolean = false THEN
                RETURN jsonb_build_object('required', false, 'matched_rule', v_rule, 'use_default', false);
              ELSE
                RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
              END IF;
            END IF;
          ELSE
            IF v_booking_time >= v_rule_start AND v_booking_time <= v_rule_end THEN
              IF (v_rule ->> 'require_deposit')::boolean = true OR (v_rule ->> 'require_guarantee')::boolean = true THEN
                RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
              ELSIF (v_rule ->> 'require_deposit')::boolean = false OR (v_rule ->> 'require_guarantee')::boolean = false THEN
                RETURN jsonb_build_object('required', false, 'matched_rule', v_rule, 'use_default', false);
              ELSE
                RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
              END IF;
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- SECOND PASS: Check day-based rules (recurring weekly rules)
  FOR v_rule IN SELECT * FROM jsonb_array_elements(v_rules)
  LOOP
    IF v_rule ? 'dates' THEN
      CONTINUE;
    END IF;

    IF NOT (v_rule ? 'days') THEN
      CONTINUE;
    END IF;

    v_rule_min_party_size := (v_rule ->> 'minimum_party_size')::integer;
    IF v_rule_min_party_size IS NOT NULL AND p_party_size < v_rule_min_party_size THEN
      CONTINUE;
    END IF;

    v_rule_days := v_rule -> 'days';
    FOR v_day IN SELECT * FROM jsonb_array_elements_text(v_rule_days)
    LOOP
      IF lower(v_day) = v_booking_day THEN
        IF v_rule ? 'start' AND v_rule ? 'end' THEN
          v_rule_start := (v_rule ->> 'start')::time;
          v_rule_end := (v_rule ->> 'end')::time;
          IF v_rule_end < v_rule_start THEN
            IF v_booking_time >= v_rule_start OR v_booking_time <= v_rule_end THEN
              IF (v_rule ->> 'require_deposit')::boolean = true OR (v_rule ->> 'require_guarantee')::boolean = true THEN
                RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
              ELSIF (v_rule ->> 'require_deposit')::boolean = false OR (v_rule ->> 'require_guarantee')::boolean = false THEN
                RETURN jsonb_build_object('required', false, 'matched_rule', v_rule, 'use_default', false);
              ELSE
                RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
              END IF;
            END IF;
          ELSE
            IF v_booking_time >= v_rule_start AND v_booking_time <= v_rule_end THEN
              IF (v_rule ->> 'require_deposit')::boolean = true OR (v_rule ->> 'require_guarantee')::boolean = true THEN
                RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
              ELSIF (v_rule ->> 'require_deposit')::boolean = false OR (v_rule ->> 'require_guarantee')::boolean = false THEN
                RETURN jsonb_build_object('required', false, 'matched_rule', v_rule, 'use_default', false);
              ELSE
                RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
              END IF;
            END IF;
          END IF;
        ELSE
          IF (v_rule ->> 'require_deposit')::boolean = true OR (v_rule ->> 'require_guarantee')::boolean = true THEN
            RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
          ELSIF (v_rule ->> 'require_deposit')::boolean = false OR (v_rule ->> 'require_guarantee')::boolean = false THEN
            RETURN jsonb_build_object('required', false, 'matched_rule', v_rule, 'use_default', false);
          ELSE
            RETURN jsonb_build_object('required', true, 'matched_rule', v_rule, 'use_default', false);
          END IF;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('required', v_default_required, 'matched_rule', null, 'use_default', true);
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- check_in_booking
CREATE OR REPLACE FUNCTION public.check_in_booking(p_booking_id uuid, p_checked_in_by uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $$
DECLARE
  v_booking record;
BEGIN
  -- Get booking details
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
    AND status = 'confirmed';
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or not in confirmed status';
  END IF;
  
  -- Check if within valid check-in window (1 hour before to 30 minutes after)
  IF v_booking.booking_time > now() + INTERVAL '1 hour' OR
     v_booking.booking_time < now() - INTERVAL '30 minutes' THEN
    RAISE EXCEPTION 'Check-in is only allowed from 1 hour before to 30 minutes after booking time';
  END IF;
  
  -- Record check-in
  INSERT INTO booking_status_history (booking_id, old_status, new_status, changed_by, reason)
  VALUES (p_booking_id, 'confirmed', 'checked_in', p_checked_in_by, 'Guest arrived');
  
  RETURN true;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- check_loyalty_rules_for_booking
CREATE OR REPLACE FUNCTION public.check_loyalty_rules_for_booking(p_booking_id uuid)
 RETURNS TABLE(rule_id uuid, points_to_award integer, rule_name text)
 LANGUAGE plpgsql
AS $$
DECLARE
  v_booking RECORD;
  v_restaurant_balance integer;
BEGIN
  -- Get booking details
  SELECT 
    b.*,
    EXTRACT(DOW FROM b.booking_time AT TIME ZONE 'UTC')::integer as day_of_week,
    EXTRACT(HOUR FROM b.booking_time AT TIME ZONE 'UTC') * 60 + 
    EXTRACT(MINUTE FROM b.booking_time AT TIME ZONE 'UTC') as time_minutes
  INTO v_booking
  FROM bookings b
  WHERE b.id = p_booking_id;
  
  -- Check if booking exists
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Get restaurant balance
  SELECT current_balance INTO v_restaurant_balance
  FROM restaurant_loyalty_balance rlb
  WHERE rlb.restaurant_id = v_booking.restaurant_id;
  
  -- If no balance or zero balance, return empty
  IF v_restaurant_balance IS NULL OR v_restaurant_balance = 0 THEN
    RETURN;
  END IF;
  
  -- Find applicable rules
  RETURN QUERY
  WITH user_rule_counts AS (
    SELECT 
      ulru.rule_id as usage_rule_id, 
      COUNT(*) as use_count
    FROM user_loyalty_rule_usage ulru
    WHERE ulru.user_id = v_booking.user_id
    GROUP BY ulru.rule_id
  )
  SELECT 
    rlr.id as rule_id,
    rlr.points_to_award,
    rlr.rule_name
  FROM restaurant_loyalty_rules rlr
  LEFT JOIN user_rule_counts urc ON urc.usage_rule_id = rlr.id
  WHERE 
    rlr.restaurant_id = v_booking.restaurant_id
    AND rlr.is_active = true
    AND (rlr.valid_from IS NULL OR rlr.valid_from <= v_booking.booking_time)
    AND (rlr.valid_until IS NULL OR rlr.valid_until >= v_booking.booking_time)
    AND v_booking.day_of_week = ANY(rlr.applicable_days)
    AND (rlr.start_time_minutes IS NULL OR v_booking.time_minutes >= rlr.start_time_minutes)
    AND (rlr.end_time_minutes IS NULL OR v_booking.time_minutes <= rlr.end_time_minutes)
    AND v_booking.party_size >= rlr.minimum_party_size
    AND (rlr.maximum_party_size IS NULL OR v_booking.party_size <= rlr.maximum_party_size)
    AND (rlr.max_uses_total IS NULL OR rlr.current_uses < rlr.max_uses_total)
    AND (rlr.max_uses_per_user IS NULL OR COALESCE(urc.use_count, 0) < rlr.max_uses_per_user)
    AND rlr.points_to_award <= v_restaurant_balance
  ORDER BY rlr.priority DESC, rlr.points_to_award DESC
  LIMIT 1;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- check_playlist_collaboration
CREATE OR REPLACE FUNCTION public.check_playlist_collaboration(playlist_id_param uuid, user_id_param uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- This function bypasses RLS by using SECURITY DEFINER
  RETURN EXISTS (
    SELECT 1 FROM playlist_collaborators 
    WHERE playlist_id = playlist_id_param 
    AND user_id = user_id_param
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- check_playlist_ownership
CREATE OR REPLACE FUNCTION public.check_playlist_ownership(playlist_id_param uuid, user_id_param uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- This function bypasses RLS by using SECURITY DEFINER
  RETURN EXISTS (
    SELECT 1 FROM restaurant_playlists 
    WHERE id = playlist_id_param 
    AND user_id = user_id_param
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- check_section_capacity
CREATE OR REPLACE FUNCTION public.check_section_capacity(p_restaurant_id uuid, p_section_name text, p_booking_time timestamp with time zone, p_turn_time integer DEFAULT 120, p_party_size integer DEFAULT 1)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_section_id UUID;
  v_max_capacity INT;
  v_current_load INT := 0;
  v_table_load INT := 0;
  v_section_load INT := 0;
  v_available INT;
  v_booking_end TIMESTAMPTZ;
  v_alternatives JSON;
BEGIN
  -- Find the section
  SELECT id, max_covers INTO v_section_id, v_max_capacity
  FROM restaurant_sections
  WHERE restaurant_id = p_restaurant_id
    AND name = p_section_name
    AND is_active = true;

  IF v_section_id IS NULL THEN
    RETURN json_build_object(
      'has_capacity', true,
      'max_capacity', 0,
      'current_load', 0,
      'available', 0,
      'alternatives', '[]'::json
    );
  END IF;

  -- Calculate max capacity: max_covers override or sum of table max_capacity
  IF v_max_capacity IS NULL THEN
    SELECT COALESCE(SUM(max_capacity), 0) INTO v_max_capacity
    FROM restaurant_tables
    WHERE section_id = v_section_id AND is_active = true;
  END IF;

  v_booking_end := p_booking_time + (p_turn_time || ' minutes')::INTERVAL;

  -- Current load from bookings with tables assigned in this section
  SELECT COALESCE(SUM(b.party_size), 0) INTO v_table_load
  FROM bookings b
  JOIN booking_tables bt ON bt.booking_id = b.id
  JOIN restaurant_tables rt ON bt.table_id = rt.id
  WHERE rt.section_id = v_section_id
    AND b.status IN ('confirmed', 'pending', 'arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment')
    AND b.booking_time < v_booking_end
    AND (b.booking_time + (b.turn_time_minutes || ' minutes')::INTERVAL) > p_booking_time;

  -- Also count bookings with preferred_section matching but NO table assigned yet
  SELECT COALESCE(SUM(b.party_size), 0) INTO v_section_load
  FROM bookings b
  WHERE b.restaurant_id = p_restaurant_id
    AND b.preferred_section = p_section_name
    AND b.status IN ('confirmed', 'pending', 'arrived', 'seated')
    AND b.booking_time < v_booking_end
    AND (b.booking_time + (b.turn_time_minutes || ' minutes')::INTERVAL) > p_booking_time
    AND NOT EXISTS (
      SELECT 1 FROM booking_tables bt WHERE bt.booking_id = b.id
    );

  v_current_load := v_table_load + v_section_load;
  v_available := GREATEST(v_max_capacity - v_current_load, 0);

  -- If no capacity, find alternative sections
  IF v_available < p_party_size THEN
    SELECT COALESCE(json_agg(alt ORDER BY alt.available DESC), '[]'::json) INTO v_alternatives
    FROM (
      SELECT
        rs.id AS section_id,
        rs.name,
        rs.color,
        rs.icon,
        GREATEST(
          COALESCE(rs.max_covers,
            (SELECT COALESCE(SUM(rt2.max_capacity), 0)
             FROM restaurant_tables rt2
             WHERE rt2.section_id = rs.id AND rt2.is_active = true)
          )
          - COALESCE(
            (SELECT SUM(b2.party_size)
             FROM bookings b2
             JOIN booking_tables bt2 ON bt2.booking_id = b2.id
             JOIN restaurant_tables rt3 ON bt2.table_id = rt3.id
             WHERE rt3.section_id = rs.id
               AND b2.status IN ('confirmed', 'pending', 'arrived', 'seated', 'ordered')
               AND b2.booking_time < v_booking_end
               AND (b2.booking_time + (b2.turn_time_minutes || ' minutes')::INTERVAL) > p_booking_time
            ), 0)
          - COALESCE(
            (SELECT SUM(b3.party_size)
             FROM bookings b3
             WHERE b3.restaurant_id = p_restaurant_id
               AND b3.preferred_section = rs.name
               AND b3.status IN ('confirmed', 'pending', 'arrived', 'seated')
               AND b3.booking_time < v_booking_end
               AND (b3.booking_time + (b3.turn_time_minutes || ' minutes')::INTERVAL) > p_booking_time
               AND NOT EXISTS (SELECT 1 FROM booking_tables bt3 WHERE bt3.booking_id = b3.id)
            ), 0),
          0
        ) AS available
      FROM restaurant_sections rs
      WHERE rs.restaurant_id = p_restaurant_id
        AND rs.is_active = true
        AND rs.id != v_section_id
    ) alt
    WHERE alt.available >= p_party_size;
  ELSE
    v_alternatives := '[]'::json;
  END IF;

  RETURN json_build_object(
    'has_capacity', v_available >= p_party_size,
    'max_capacity', v_max_capacity,
    'current_load', v_current_load,
    'available', v_available,
    'alternatives', v_alternatives
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- check_table_availability
CREATE OR REPLACE FUNCTION public.check_table_availability(p_restaurant_id uuid, p_date date, p_time text, p_party_size integer)
 RETURNS boolean
 LANGUAGE plpgsql
AS $$
DECLARE
  v_booking_time timestamp with time zone;
  v_total_capacity integer;
  v_booked_capacity integer;
BEGIN
  -- Convert date and time to timestamp
  v_booking_time := (p_date::text || ' ' || split_part(p_time, '-', 1))::timestamp with time zone;
  
  -- Get total restaurant capacity
  SELECT COALESCE(SUM(capacity), 0) INTO v_total_capacity
  FROM restaurant_tables
  WHERE restaurant_id = p_restaurant_id
  AND is_active = true;
  
  -- Get booked capacity for the time slot (2-hour window)
  SELECT COALESCE(SUM(party_size), 0) INTO v_booked_capacity
  FROM bookings
  WHERE restaurant_id = p_restaurant_id
  AND status IN ('confirmed', 'seated')
  AND booking_time BETWEEN v_booking_time - interval '1 hour' 
    AND v_booking_time + interval '1 hour';
  
  -- Return true if there's enough capacity
  RETURN (v_total_capacity - v_booked_capacity) >= p_party_size;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- claim_notification_batch
CREATE OR REPLACE FUNCTION public.claim_notification_batch(batch_size integer DEFAULT 50)
 RETURNS TABLE(id uuid, notification_id uuid, user_id uuid, channel text, payload jsonb, attempts integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.notification_outbox
  SET
    status = 'processing',
    updated_at = NOW()
  WHERE notification_outbox.id IN (
    SELECT notification_outbox.id
    FROM public.notification_outbox
    WHERE notification_outbox.status = 'queued'
      AND notification_outbox.scheduled_for <= NOW()
      AND notification_outbox.attempts < 3
    ORDER BY notification_outbox.priority DESC, notification_outbox.created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED  -- Critical: prevents race conditions
  )
  RETURNING
    notification_outbox.id,
    notification_outbox.notification_id,
    notification_outbox.user_id,
    notification_outbox.channel,
    notification_outbox.payload,
    notification_outbox.attempts;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- cleanup_duplicate_customers
CREATE OR REPLACE FUNCTION public.cleanup_duplicate_customers()
 RETURNS json
 LANGUAGE plpgsql
AS $$
DECLARE
  v_duplicates_removed integer := 0;
  v_temp_count integer;
BEGIN
  -- Remove duplicate user-based customer records (keep the one with most bookings)
  WITH duplicates AS (
    SELECT 
      id,
      restaurant_id,
      user_id,
      total_bookings,
      ROW_NUMBER() OVER (
        PARTITION BY restaurant_id, user_id 
        ORDER BY total_bookings DESC NULLS LAST, created_at ASC
      ) as rn
    FROM restaurant_customers
    WHERE user_id IS NOT NULL
  )
  DELETE FROM restaurant_customers 
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  );
  
  GET DIAGNOSTICS v_duplicates_removed = ROW_COUNT;
  
  -- Remove duplicate guest customer records
  WITH guest_duplicates AS (
    SELECT 
      id,
      restaurant_id,
      guest_email,
      total_bookings,
      ROW_NUMBER() OVER (
        PARTITION BY restaurant_id, guest_email 
        ORDER BY total_bookings DESC NULLS LAST, created_at ASC
      ) as rn
    FROM restaurant_customers
    WHERE user_id IS NULL AND guest_email IS NOT NULL
  )
  DELETE FROM restaurant_customers 
  WHERE id IN (
    SELECT id FROM guest_duplicates WHERE rn > 1
  );
  
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_duplicates_removed := v_duplicates_removed + v_temp_count;
  
  RETURN json_build_object(
    'success', true,
    'duplicates_removed', v_duplicates_removed,
    'message', format('Cleaned up %s duplicate customer records', v_duplicates_removed)
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- cleanup_expired_loyalty_rules
CREATE OR REPLACE FUNCTION public.cleanup_expired_loyalty_rules()
 RETURNS void
 LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE restaurant_loyalty_rules
  SET is_active = false
  WHERE 
    is_active = true
    AND valid_until IS NOT NULL
    AND valid_until < now();
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- cleanup_expired_pending_payments
CREATE OR REPLACE FUNCTION public.cleanup_expired_pending_payments()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete bookings that are:
  -- 1. In pending_payment status
  -- 2. Either payment_expires_at has passed OR created more than 15 minutes ago (fallback)
  WITH deleted AS (
    DELETE FROM public.bookings
    WHERE status = 'pending_payment'
      AND (
        (payment_expires_at IS NOT NULL AND payment_expires_at < NOW())
        OR (payment_expires_at IS NULL AND created_at < NOW() - INTERVAL '15 minutes')
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  IF deleted_count > 0 THEN
    RAISE NOTICE 'Cleaned up % expired pending_payment bookings', deleted_count;
  END IF;
  
  RETURN deleted_count;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- cleanup_old_notifications
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
 RETURNS void
 LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete sent notifications older than 7 days
  DELETE FROM notification_outbox
  WHERE status = 'sent' 
  AND created_at < NOW() - INTERVAL '7 days';
  
  -- Mark stuck notifications as failed
  UPDATE notification_outbox
  SET status = 'failed',
      error = 'Stuck in processing'
  WHERE status = 'processing'
  AND created_at < NOW() - INTERVAL '1 hour';
  
  -- Deactivate stale subscriptions (no activity in 7 days)
  UPDATE push_subscriptions
  SET is_active = false
  WHERE is_active = true
  AND last_seen < NOW() - INTERVAL '7 days';
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- cleanup_orphaned_booking_tables
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_booking_tables()
 RETURNS json
 LANGUAGE plpgsql
AS $$
DECLARE
  v_orphans_removed integer := 0;
  v_duplicates_removed integer := 0;
BEGIN
  -- Remove booking_tables entries that don't have a corresponding booking
  DELETE FROM booking_tables
  WHERE booking_id NOT IN (SELECT id FROM bookings);
  
  GET DIAGNOSTICS v_orphans_removed = ROW_COUNT;
  
  -- Remove duplicate table assignments for the same booking
  WITH duplicates AS (
    SELECT 
      id,
      booking_id,
      table_id,
      ROW_NUMBER() OVER (PARTITION BY booking_id, table_id ORDER BY created_at ASC) as rn
    FROM booking_tables
  )
  DELETE FROM booking_tables
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  );
  
  GET DIAGNOSTICS v_duplicates_removed = ROW_COUNT;
  
  RETURN json_build_object(
    'success', true,
    'orphans_removed', v_orphans_removed,
    'duplicates_removed', v_duplicates_removed,
    'total_removed', v_orphans_removed + v_duplicates_removed,
    'message', format('Cleaned up %s orphaned and %s duplicate booking table records', 
                      v_orphans_removed, v_duplicates_removed)
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- cleanup_orphaned_outbox
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_outbox()
 RETURNS void
 LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM notification_outbox 
  WHERE notification_id IS NOT NULL 
    AND NOT EXISTS (
      SELECT 1 FROM notifications 
      WHERE notifications.id = notification_outbox.notification_id
    );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- cleanup_stuck_notifications
CREATE OR REPLACE FUNCTION public.cleanup_stuck_notifications()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE public.notification_outbox
  SET
    status = 'queued',
    updated_at = NOW()
  WHERE status = 'processing'
    AND updated_at < NOW() - INTERVAL '5 minutes';

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- complete_booking_and_finalize_loyalty
CREATE OR REPLACE FUNCTION public.complete_booking_and_finalize_loyalty(p_booking_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $$
DECLARE
  v_booking record;
BEGIN
  -- Get booking details
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
    AND status = 'confirmed';
    
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Update booking status to completed
  UPDATE bookings
  SET 
    status = 'completed',
    updated_at = now()
  WHERE id = p_booking_id;
  
  -- If loyalty points weren't awarded yet (edge case), award them now
  IF v_booking.applied_loyalty_rule_id IS NOT NULL AND v_booking.loyalty_points_earned = 0 THEN
    PERFORM award_restaurant_loyalty_points(p_booking_id);
  END IF;
  
  RETURN true;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- count_profiles_admin
CREATE OR REPLACE FUNCTION public.count_profiles_admin(p_tier text DEFAULT NULL::text, p_rating_min numeric DEFAULT NULL::numeric, p_rating_max numeric DEFAULT NULL::numeric, p_created_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_created_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_points_min integer DEFAULT NULL::integer, p_points_max integer DEFAULT NULL::integer, p_user_ids uuid[] DEFAULT NULL::uuid[], p_exclude_user_ids uuid[] DEFAULT NULL::uuid[], p_search text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
    AND (p_exclude_user_ids IS NULL OR NOT (p.id = ANY(p_exclude_user_ids)))
    AND (
      p_search IS NULL OR length(trim(p_search)) < 2 OR
      p.full_name ILIKE '%' || trim(p_search) || '%'
      OR p.email ILIKE '%' || trim(p_search) || '%'
      OR p.phone_number ILIKE '%' || trim(p_search) || '%'
    );

  RETURN COALESCE(result, 0);
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- count_profiles_admin
CREATE OR REPLACE FUNCTION public.count_profiles_admin(p_tier text DEFAULT NULL::text, p_rating_min numeric DEFAULT NULL::numeric, p_rating_max numeric DEFAULT NULL::numeric, p_created_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_created_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_points_min integer DEFAULT NULL::integer, p_points_max integer DEFAULT NULL::integer, p_user_ids uuid[] DEFAULT NULL::uuid[], p_exclude_user_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- create_booking_with_tables2
CREATE OR REPLACE FUNCTION public.create_booking_with_tables2(p_user_id uuid, p_restaurant_id uuid, p_booking_time timestamp with time zone, p_party_size integer, p_table_ids uuid[] DEFAULT NULL::uuid[], p_turn_time integer DEFAULT 120, p_special_requests text DEFAULT NULL::text, p_occasion text DEFAULT NULL::text, p_dietary_notes text[] DEFAULT NULL::text[], p_table_preferences text[] DEFAULT NULL::text[], p_is_group_booking boolean DEFAULT false, p_applied_offer_id uuid DEFAULT NULL::uuid, p_booking_policy text DEFAULT 'instant'::text, p_expected_loyalty_points integer DEFAULT 0, p_applied_loyalty_rule_id uuid DEFAULT NULL::uuid, p_preferred_section text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_booking bookings;
  v_table_id uuid;
  v_confirmation_code text;
  v_retry_count integer := 0;
  v_max_retries integer := 10;
  v_is_vip boolean;
  v_max_booking_days integer;
  v_restaurant_status text;
  v_booking_status text;
  v_booking_end_time timestamp with time zone;
  v_conflict_booking record;
  v_min_gap_minutes integer := 60;
  v_conflicted_tables uuid[];
BEGIN
  -- Security check
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Cannot create bookings for other users';
  END IF;

  -- Calculate booking end time
  v_booking_end_time := p_booking_time + (p_turn_time || ' minutes')::interval;

  -- Check for time conflicts across all restaurants (1 hour gap)
  SELECT 
    b.id,
    b.booking_time,
    r.name as restaurant_name,
    b.confirmation_code
  INTO v_conflict_booking
  FROM bookings b
  JOIN restaurants r ON b.restaurant_id = r.id
  WHERE b.user_id = p_user_id
    AND b.status IN ('pending', 'confirmed')
    AND (
      -- Check if bookings are too close (within 1 hour)
      (p_booking_time >= b.booking_time - (v_min_gap_minutes || ' minutes')::interval
       AND p_booking_time < b.booking_time + ((b.turn_time_minutes + v_min_gap_minutes) || ' minutes')::interval)
    )
  LIMIT 1;
  
  IF v_conflict_booking.id IS NOT NULL THEN
    RAISE EXCEPTION 'You have another booking at % at %. Please leave at least 1 hour between reservations.',
      v_conflict_booking.restaurant_name,
      to_char(v_conflict_booking.booking_time, 'HH24:MI')
      USING ERRCODE = 'P0001';
  END IF;

  -- Basic validations
  SELECT status INTO v_restaurant_status
  FROM restaurants WHERE id = p_restaurant_id;
  
  IF v_restaurant_status IS NULL THEN
    RAISE EXCEPTION 'Restaurant not found';
  END IF;
  
  IF v_restaurant_status != 'active' THEN
    RAISE EXCEPTION 'Restaurant is not currently accepting bookings';
  END IF;

  -- Check VIP status
  SELECT EXISTS (
    SELECT 1 FROM restaurant_vip_users
    WHERE user_id = p_user_id 
    AND restaurant_id = p_restaurant_id
    AND (valid_until IS NULL OR valid_until > now())
  ) INTO v_is_vip;
  
  -- Get booking window
  v_max_booking_days := CASE 
    WHEN v_is_vip THEN 60
    ELSE 30
  END;
  
  -- Validate booking window
  IF p_booking_time > now() + (v_max_booking_days || ' days')::interval THEN
    RAISE EXCEPTION 'Booking date is beyond allowed window of % days', v_max_booking_days;
  END IF;
  
  IF p_booking_time <= now() + interval '15 minutes' THEN
    RAISE EXCEPTION 'Booking time must be at least 15 minutes in the future';
  END IF;

  -- Generate unique confirmation code
  LOOP
    v_confirmation_code := 'BK' || 
      TO_CHAR(now(), 'YYMMDD') || 
      UPPER(SUBSTRING(MD5(gen_random_uuid()::text || v_retry_count::text) FROM 1 FOR 6));
    
    EXIT WHEN NOT EXISTS (SELECT 1 FROM bookings WHERE confirmation_code = v_confirmation_code);
    
    v_retry_count := v_retry_count + 1;
    IF v_retry_count > v_max_retries THEN
      v_confirmation_code := 'BK' || UPPER(REPLACE(gen_random_uuid()::text, '-', ''));
      EXIT;
    END IF;
  END LOOP;

  -- Determine booking status
  v_booking_status := CASE 
    WHEN p_booking_policy = 'request' THEN 'pending'
    ELSE 'confirmed'
  END;

  -- FIXED: Table conflict check now matches get_available_tables behavior
  IF v_booking_status = 'confirmed' AND p_table_ids IS NOT NULL AND array_length(p_table_ids, 1) > 0 THEN
    
    -- Use exclusive advisory lock to prevent race conditions
    PERFORM pg_advisory_xact_lock(hashtext(p_restaurant_id::text || p_booking_time::text));
    
    -- Check for conflicts - now includes both 'confirmed' AND 'pending' bookings
    SELECT array_agg(DISTINCT bt.table_id)
    INTO v_conflicted_tables
    FROM bookings b
    JOIN booking_tables bt ON b.id = bt.booking_id
    WHERE b.status IN ('confirmed', 'pending')  -- FIXED: Was only checking 'confirmed'
      AND b.restaurant_id = p_restaurant_id
      AND bt.table_id = ANY(p_table_ids)
      AND b.booking_time < v_booking_end_time
      AND (b.booking_time + (b.turn_time_minutes || ' minutes')::interval) > p_booking_time;
    
    IF v_conflicted_tables IS NOT NULL AND array_length(v_conflicted_tables, 1) > 0 THEN
      RAISE EXCEPTION 'The selected tables are no longer available for this time slot. Conflicted tables: %', 
        array_to_string(v_conflicted_tables, ', ')
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Create the booking
  BEGIN
    INSERT INTO bookings (
      user_id, restaurant_id, booking_time, party_size, status,
      special_requests, occasion, dietary_notes, table_preferences,
      turn_time_minutes, confirmation_code, is_group_booking,
      applied_offer_id, expected_loyalty_points, applied_loyalty_rule_id,
      preferred_section,  -- NEW FIELD ADDED
      created_at, updated_at
    ) VALUES (
      p_user_id, p_restaurant_id, p_booking_time, p_party_size, v_booking_status,
      p_special_requests, p_occasion, p_dietary_notes, p_table_preferences,
      p_turn_time, v_confirmation_code, p_is_group_booking,
      p_applied_offer_id, p_expected_loyalty_points, p_applied_loyalty_rule_id,
      p_preferred_section,  -- NEW VALUE ADDED
      now(), now()
    ) RETURNING * INTO v_booking;
    
  EXCEPTION 
    WHEN unique_violation THEN
      -- Try with a different confirmation code
      v_confirmation_code := 'BK' || TO_CHAR(now(), 'YYMMDD') || 
                            UPPER(SUBSTRING(MD5(gen_random_uuid()::text || clock_timestamp()::text) FROM 1 FOR 8));
      
      INSERT INTO bookings (
        user_id, restaurant_id, booking_time, party_size, status,
        special_requests, occasion, dietary_notes, table_preferences,
        turn_time_minutes, confirmation_code, is_group_booking,
        applied_offer_id, expected_loyalty_points, applied_loyalty_rule_id,
        preferred_section,  -- NEW FIELD ADDED
        created_at, updated_at
      ) VALUES (
        p_user_id, p_restaurant_id, p_booking_time, p_party_size, v_booking_status,
        p_special_requests, p_occasion, p_dietary_notes, p_table_preferences,
        p_turn_time, v_confirmation_code, p_is_group_booking,
        p_applied_offer_id, p_expected_loyalty_points, p_applied_loyalty_rule_id,
        p_preferred_section,  -- NEW VALUE ADDED
        now(), now()
      ) RETURNING * INTO v_booking;
  END;

  -- Link tables to booking
  IF v_booking_status = 'confirmed' AND p_table_ids IS NOT NULL AND array_length(p_table_ids, 1) > 0 THEN
    FOREACH v_table_id IN ARRAY p_table_ids LOOP
      BEGIN
        -- Double-check table is still available before linking
        IF NOT EXISTS (
          SELECT 1
          FROM bookings b
          JOIN booking_tables bt ON b.id = bt.booking_id
          WHERE b.status IN ('confirmed', 'pending')  -- FIXED: Was only checking 'confirmed'
            AND b.restaurant_id = p_restaurant_id
            AND bt.table_id = v_table_id
            AND b.booking_time < v_booking_end_time
            AND (b.booking_time + (b.turn_time_minutes || ' minutes')::interval) > p_booking_time
            AND b.id != v_booking.id -- Exclude our own booking
        ) THEN
          INSERT INTO booking_tables (booking_id, table_id, created_at)
          VALUES (v_booking.id, v_table_id, now())
          ON CONFLICT DO NOTHING;
        ELSE
          RAISE NOTICE 'Table % became unavailable during booking creation', v_table_id;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not link table % to booking: %', v_table_id, SQLERRM;
      END;
    END LOOP;
  END IF;

  -- Return result
  RETURN json_build_object(
    'booking', row_to_json(v_booking),
    'tables', p_table_ids,
    'is_vip', v_is_vip,
    'booking_window_days', v_max_booking_days,
    'is_duplicate_attempt', false
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- create_booking_with_tables_debug
CREATE OR REPLACE FUNCTION public.create_booking_with_tables_debug(p_user_id uuid, p_restaurant_id uuid, p_booking_time timestamp with time zone, p_party_size integer, p_table_ids uuid[], p_turn_time integer, p_special_requests text DEFAULT NULL::text, p_occasion text DEFAULT NULL::text, p_dietary_notes text[] DEFAULT NULL::text[], p_table_preferences text[] DEFAULT NULL::text[], p_is_group_booking boolean DEFAULT false, p_applied_offer_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
AS $$
DECLARE
  v_booking bookings;
  v_table_id uuid;
  v_conflict_id uuid;
  v_confirmation_code text;
  v_retry_count integer := 0;
  v_max_retries integer := 10;
  v_debug_info jsonb := '{}';
  v_table_assignments jsonb := '[]';
BEGIN
  -- Debug logging
  v_debug_info := v_debug_info || jsonb_build_object(
    'input_table_ids', p_table_ids,
    'table_count', COALESCE(array_length(p_table_ids, 1), 0),
    'party_size', p_party_size,
    'booking_time', p_booking_time
  );

  -- Generate confirmation code
  LOOP
    v_confirmation_code := 'BK' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 8));
    IF NOT EXISTS (SELECT 1 FROM bookings WHERE confirmation_code = v_confirmation_code) THEN
      EXIT;
    END IF;
    v_retry_count := v_retry_count + 1;
    IF v_retry_count > v_max_retries THEN
      RAISE EXCEPTION 'Unable to generate unique confirmation code';
    END IF;
  END LOOP;

  -- Check for conflicts if tables provided
  IF p_table_ids IS NOT NULL AND array_length(p_table_ids, 1) > 0 THEN
    SELECT check_booking_overlap(
      p_table_ids, 
      p_booking_time, 
      p_booking_time + (p_turn_time || ' minutes')::interval
    ) INTO v_conflict_id;

    v_debug_info := v_debug_info || jsonb_build_object('conflict_check', v_conflict_id);

    IF v_conflict_id IS NOT NULL THEN
      RAISE EXCEPTION 'Table is no longer available. Conflict with booking %', v_conflict_id;
    END IF;
  END IF;

  -- Create booking
  INSERT INTO bookings (
    user_id, restaurant_id, booking_time, party_size, status,
    special_requests, occasion, dietary_notes, table_preferences,
    turn_time_minutes, confirmation_code, is_group_booking,
    applied_offer_id, created_at, updated_at
  ) VALUES (
    p_user_id, p_restaurant_id, p_booking_time, p_party_size, 'confirmed',
    p_special_requests, p_occasion, p_dietary_notes, p_table_preferences,
    p_turn_time, v_confirmation_code, p_is_group_booking,
    p_applied_offer_id, now(), now()
  ) RETURNING * INTO v_booking;

  v_debug_info := v_debug_info || jsonb_build_object('booking_created', v_booking.id);

  -- Assign tables
  IF p_table_ids IS NOT NULL AND array_length(p_table_ids, 1) > 0 THEN
    FOREACH v_table_id IN ARRAY p_table_ids LOOP
      BEGIN
        INSERT INTO booking_tables (booking_id, table_id)
        VALUES (v_booking.id, v_table_id);
        
        v_table_assignments := v_table_assignments || jsonb_build_object(
          'table_id', v_table_id,
          'assigned', true
        );
      EXCEPTION
        WHEN foreign_key_violation THEN
          v_table_assignments := v_table_assignments || jsonb_build_object(
            'table_id', v_table_id,
            'assigned', false,
            'error', 'Invalid table ID'
          );
        WHEN OTHERS THEN
          v_table_assignments := v_table_assignments || jsonb_build_object(
            'table_id', v_table_id,
            'assigned', false,
            'error', 'An unexpected error occurred.'
          );
      END;
    END LOOP;
  END IF;

  v_debug_info := v_debug_info || jsonb_build_object('table_assignments', v_table_assignments);

  -- Return detailed result
  RETURN json_build_object(
    'booking', row_to_json(v_booking),
    'tables', p_table_ids,
    'debug', v_debug_info
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- create_notification
CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_data jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (p_user_id, p_type, p_title, p_message, p_data)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- disable_other_users_push_token
CREATE OR REPLACE FUNCTION public.disable_other_users_push_token(p_expo_push_token text, p_current_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  -- Disable the token for all users except the current one
  update public.user_devices
  set 
    enabled = false,
    last_seen = now()
  where expo_push_token = p_expo_push_token
    and user_id != p_current_user_id;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- downgrade_restaurant_to_basic
CREATE OR REPLACE FUNCTION public.downgrade_restaurant_to_basic(target_restaurant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $$
DECLARE
  old_data jsonb;
  new_data jsonb;
  result jsonb;
BEGIN
  -- Get current restaurant data
  SELECT to_jsonb(r.*) INTO old_data 
  FROM restaurants r 
  WHERE r.id = target_restaurant_id;
  
  IF old_data IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Restaurant not found',
      'restaurant_id', target_restaurant_id
    );
  END IF;
  
  -- Perform the downgrade (trigger will automatically set booking_policy to 'request')
  UPDATE restaurants 
  SET 
    tier = 'basic',
    updated_at = now()
  WHERE id = target_restaurant_id;
  
  -- Get updated data
  SELECT to_jsonb(r.*) INTO new_data 
  FROM restaurants r 
  WHERE r.id = target_restaurant_id;
  
  -- Build result
  result := jsonb_build_object(
    'success', true,
    'restaurant_id', target_restaurant_id,
    'restaurant_name', old_data->>'name',
    'changes', jsonb_build_object(
      'tier', jsonb_build_object(
        'from', old_data->>'tier',
        'to', new_data->>'tier'
      ),
      'booking_policy', jsonb_build_object(
        'from', old_data->>'booking_policy',
        'to', new_data->>'booking_policy'
      )
    ),
    'timestamp', now()
  );
  
  RETURN result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- downgrade_restaurants_to_basic
CREATE OR REPLACE FUNCTION public.downgrade_restaurants_to_basic(restaurant_ids uuid[])
 RETURNS TABLE(restaurant_id uuid, restaurant_name text, old_tier tier, new_tier tier, old_booking_policy text, new_booking_policy text)
 LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE restaurants 
  SET 
    tier = 'basic',
    booking_policy = 'request',
    updated_at = now()
  WHERE id = ANY(restaurant_ids)
  RETURNING 
    id as restaurant_id,
    name as restaurant_name,
    'pro'::tier as old_tier,  -- Assuming they were pro before
    tier as new_tier,
    'instant' as old_booking_policy,  -- Most common previous state
    booking_policy as new_booking_policy;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- enforce_basic_tier_booking_policy
CREATE OR REPLACE FUNCTION public.enforce_basic_tier_booking_policy()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  -- If the tier is being changed to 'basic', automatically set booking_policy to 'request'
  IF NEW.tier = 'basic' AND NEW.tier != OLD.tier THEN
    NEW.booking_policy = 'request';
    
    -- Log the automatic change for audit purposes
    RAISE NOTICE 'Restaurant % (%) automatically converted to request-based booking due to basic tier downgrade', NEW.name, NEW.id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- enforce_phone_for_app_bookings
CREATE OR REPLACE FUNCTION public.enforce_phone_for_app_bookings()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
DECLARE
  v_phone  text;
  v_source text;
BEGIN
  -- Normalize source: if NULL, treat as 'app'
  v_source := lower(coalesce(NEW.source, 'app'));

  -- Only enforce for app bookings
  IF v_source = 'app' THEN
    -- Must have a user_id linked to profiles
    IF NEW.user_id IS NULL THEN
      RAISE EXCEPTION 'App booking must have a user_id';
    END IF;

    SELECT phone_number
    INTO v_phone
    FROM public.profiles
    WHERE id = NEW.user_id;

    -- No phone_number on profile -> block the booking
    IF v_phone IS NULL THEN
      RAISE EXCEPTION 'App booking requires profiles.phone_number to be set';
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- enqueue_booking_reminders
CREATE OR REPLACE FUNCTION public.enqueue_booking_reminders()
 RETURNS void
 LANGUAGE plpgsql
AS $$
DECLARE
  r record;
  v_title text;
  v_msg text;
  v_data jsonb;
  v_deeplink text;
BEGIN
  -- 24h reminders (type: booking_reminder_24h)
  FOR r IN
    SELECT b.*, res.name as restaurant_name
    FROM public.bookings b
    JOIN public.restaurants res ON res.id = b.restaurant_id
    WHERE b.status = 'confirmed'
      AND b.booking_time BETWEEN now() + interval '23 hours' AND now() + interval '25 hours'
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = b.user_id
          AND n.category = 'booking'
          AND n.type = 'booking_reminder_24h'
          AND (n.data->>'bookingId')::uuid = b.id
      )
  LOOP
    v_title := format('Tomorrow at %s', r.restaurant_name);
    v_msg := format('Reminder: you have a booking tomorrow at %s for %s at %s.', to_char(r.booking_time AT TIME ZONE 'Asia/Beirut', 'HH:MI AM'), r.party_size, r.restaurant_name);
    v_deeplink := concat('app://booking/', r.id::text);
    v_data := jsonb_build_object('bookingId', r.id, 'restaurantId', r.restaurant_id, 'time', r.booking_time);
    PERFORM public.enqueue_notification(r.user_id, 'booking', 'booking_reminder_24h', v_title, v_msg, v_data, v_deeplink, ARRAY['inapp','push']);
  END LOOP;

  -- 2h reminders (type: booking_reminder_2h)
  FOR r IN
    SELECT b.*, res.name as restaurant_name
    FROM public.bookings b
    JOIN public.restaurants res ON res.id = b.restaurant_id
    WHERE b.status = 'confirmed'
      AND b.booking_time BETWEEN now() + interval '110 minutes' AND now() + interval '130 minutes'
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = b.user_id
          AND n.category = 'booking'
          AND n.type = 'booking_reminder_2h'
          AND (n.data->>'bookingId')::uuid = b.id
      )
  LOOP
    v_title := 'Your table is coming up';
    v_msg := format('Your booking at %s is in about 2 hours', r.restaurant_name);
    v_deeplink := concat('app://booking/', r.id::text);
    v_data := jsonb_build_object('bookingId', r.id, 'restaurantId', r.restaurant_id, 'time', r.booking_time);
    PERFORM public.enqueue_notification(r.user_id, 'booking', 'booking_reminder_2h', v_title, v_msg, v_data, v_deeplink, ARRAY['inapp','push']);
  END LOOP;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- enqueue_notification
CREATE OR REPLACE FUNCTION public.enqueue_notification(p_user_id uuid, p_category text, p_type text, p_title text, p_message text, p_data jsonb DEFAULT '{}'::jsonb, p_deeplink text DEFAULT NULL::text, p_channels text[] DEFAULT ARRAY['inapp'::text, 'push'::text])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    v_notification_id uuid;
    v_pref public.notification_preferences;
    v_channel text;
    v_channel_prefs jsonb;
    v_all_muted boolean;
    v_payload jsonb;
BEGIN
    IF p_user_id IS NULL THEN RETURN NULL; END IF;

    SELECT * INTO v_pref FROM public.notification_preferences WHERE user_id = p_user_id;
    IF v_pref IS NULL THEN
        INSERT INTO public.notification_preferences(user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
        SELECT * INTO v_pref FROM public.notification_preferences WHERE user_id = p_user_id;
    END IF;

    IF (p_category = 'marketing' AND NOT COALESCE(v_pref.marketing, FALSE)) THEN RETURN NULL; END IF;
    IF (p_category = 'booking' AND NOT COALESCE(v_pref.booking, TRUE)) THEN RETURN NULL; END IF;
    IF (p_category = 'waitlist' AND NOT COALESCE(v_pref.waitlist, TRUE)) THEN RETURN NULL; END IF;
    IF (p_category = 'offers' AND NOT COALESCE(v_pref.offers, TRUE)) THEN RETURN NULL; END IF;
    IF (p_category = 'reviews' AND NOT COALESCE(v_pref.reviews, TRUE)) THEN RETURN NULL; END IF;
    IF (p_category = 'loyalty' AND NOT COALESCE(v_pref.loyalty, TRUE)) THEN RETURN NULL; END IF;
    IF (p_category = 'system' AND NOT COALESCE(v_pref.system, TRUE)) THEN RETURN NULL; END IF;
    IF (p_category = 'social' AND NOT COALESCE(v_pref.social, TRUE)) THEN RETURN NULL; END IF;
    IF (p_category = 'card_guarantee' AND NOT COALESCE(v_pref.card_guarantee, TRUE)) THEN RETURN NULL; END IF;

    INSERT INTO public.notifications(user_id, type, title, message, data, category, deeplink)
    VALUES (p_user_id, p_type, p_title, p_message, p_data, p_category, p_deeplink)
    RETURNING id INTO v_notification_id;

    v_payload := jsonb_build_object(
        'title', p_title, 'message', p_message, 'data', p_data,
        'deeplink', p_deeplink, 'category', p_category, 'type', p_type
    );

    SELECT notification_preferences INTO v_channel_prefs
    FROM public.profiles
    WHERE id = p_user_id;

    v_all_muted := COALESCE((v_channel_prefs->>'all_muted')::boolean, false);

    IF v_all_muted THEN
        FOREACH v_channel IN ARRAY p_channels LOOP
            IF v_channel = 'inapp' THEN
                INSERT INTO public.notification_outbox(notification_id, user_id, channel, payload)
                VALUES (v_notification_id, p_user_id, v_channel, v_payload);
            END IF;
        END LOOP;
        RETURN v_notification_id;
    END IF;

    FOREACH v_channel IN ARRAY p_channels LOOP
        IF v_channel = 'inapp' THEN
            INSERT INTO public.notification_outbox(notification_id, user_id, channel, payload)
            VALUES (v_notification_id, p_user_id, v_channel, v_payload);
        ELSIF v_channel = 'push' AND COALESCE((v_channel_prefs->>'push')::boolean, true) THEN
            INSERT INTO public.notification_outbox(notification_id, user_id, channel, payload)
            VALUES (v_notification_id, p_user_id, v_channel, v_payload);
        ELSIF v_channel = 'email' AND COALESCE((v_channel_prefs->>'email')::boolean, true) THEN
            INSERT INTO public.notification_outbox(notification_id, user_id, channel, payload)
            VALUES (v_notification_id, p_user_id, v_channel, v_payload);
        ELSIF v_channel = 'whatsapp' AND COALESCE((v_channel_prefs->>'whatsapp')::boolean, true) THEN
            INSERT INTO public.notification_outbox(notification_id, user_id, channel, payload)
            VALUES (v_notification_id, p_user_id, v_channel, v_payload);
        END IF;
    END LOOP;

    RETURN v_notification_id;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- enqueue_offer_expiry_notices
CREATE OR REPLACE FUNCTION public.enqueue_offer_expiry_notices()
 RETURNS void
 LANGUAGE plpgsql
AS $$
declare r record; begin
  for r in
    select uo.* from public.user_offers uo
    where uo.status='active'
      and uo.expires_at between now()+interval '36 hours' and now()+interval '60 hours'
      and not exists (
        select 1 from public.notifications n
        where n.user_id=uo.user_id and n.category='offers' and n.type='offer_expiry_warning'
          and (n.data->>'userOfferId')::uuid = uo.id
      )
  loop
    perform public.enqueue_notification(r.user_id,'offers','offer_expiry_warning',
      'Offer expiring soon','One of your offers is expiring soon. Don''t miss out.',
      jsonb_build_object('userOfferId',r.id,'offerId',r.offer_id,'expiresAt',r.expires_at),
      'app://profile/my-rewards', array['inapp','push']);
  end loop;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- enqueue_pending_checkout_reminders
CREATE OR REPLACE FUNCTION public.enqueue_pending_checkout_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_deposit RECORD;
BEGIN
  -- Find pending deposits with checkout that expires in 2-4 minutes
  -- and haven't had reminder sent yet
  FOR v_deposit IN
    SELECT 
      bd.id,
      bd.booking_id,
      bd.checkout_expires_at,
      b.user_id,
      r.name as restaurant_name
    FROM booking_deposits bd
    JOIN bookings b ON b.id = bd.booking_id
    JOIN restaurants r ON r.id = b.restaurant_id
    WHERE bd.status = 'pending'
      AND bd.checkout_expires_at IS NOT NULL
      AND bd.checkout_expires_at > NOW()
      AND bd.checkout_expires_at <= NOW() + INTERVAL '4 minutes'
      AND bd.payment_reminder_sent = FALSE
      AND b.user_id IS NOT NULL
  LOOP
    -- Schedule the reminder notification
    PERFORM schedule_payment_reminder(
      v_deposit.booking_id,
      v_deposit.user_id,
      v_deposit.restaurant_name,
      v_deposit.checkout_expires_at
    );
    
    -- Mark reminder as sent
    UPDATE booking_deposits
    SET payment_reminder_sent = TRUE
    WHERE id = v_deposit.id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- enqueue_restaurant_notification
CREATE OR REPLACE FUNCTION public.enqueue_restaurant_notification(p_restaurant_id uuid, p_type text, p_title text, p_body text, p_data jsonb DEFAULT NULL::jsonb, p_booking_id uuid DEFAULT NULL::uuid, p_priority text DEFAULT 'high'::text, p_repeat_enabled boolean DEFAULT true, p_repeat_interval integer DEFAULT 30, p_repeat_duration integer DEFAULT 300)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    v_outbox_id uuid;
    v_repeat_until timestamptz;
BEGIN
    -- Calculate repeat deadline
    IF p_repeat_enabled THEN
        v_repeat_until := NOW() + (p_repeat_duration || ' seconds')::interval;
    ELSE
        v_repeat_until := NULL;
    END IF;

    -- Insert into queue
    INSERT INTO public.restaurant_notification_outbox (
        restaurant_id, booking_id, type, title, body, data, priority, sound, status,
        repeat_enabled, repeat_interval, repeat_until
    )
    VALUES (
        p_restaurant_id, p_booking_id, p_type, p_title, p_body, 
        COALESCE(p_data, '{}'::jsonb), p_priority, 'default', 'queued',
        p_repeat_enabled, p_repeat_interval, v_repeat_until
    )
    RETURNING id INTO v_outbox_id;

    RETURN v_outbox_id;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- enqueue_review_reminders
CREATE OR REPLACE FUNCTION public.enqueue_review_reminders()
 RETURNS void
 LANGUAGE plpgsql
AS $$
declare r record; begin
  for r in
    select b.* from public.bookings b
    left join public.reviews rv on rv.booking_id = b.id
    where b.status='completed' and rv.id is null
      and b.booking_time between now()-interval '72 hours' and now()-interval '24 hours'
      and not exists (
        select 1 from public.notifications n
        where n.user_id=b.user_id and n.category='reviews' and n.type='review_reminder'
          and (n.data->>'bookingId')::uuid = b.id
      )
  loop
    perform public.enqueue_notification(r.user_id,'reviews','review_reminder',
      'How was your visit?','Leave a quick review to help others and earn points.',
      jsonb_build_object('bookingId',r.id,'restaurantId',r.restaurant_id),
      'app://profile/reviews', array['inapp','push']);
  end loop;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- ensure_notification_exists
CREATE OR REPLACE FUNCTION public.ensure_notification_exists()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  -- If notification_id is provided but doesn't exist, create a placeholder
  IF NEW.notification_id IS NOT NULL THEN
    INSERT INTO public.notifications (id, user_id, type, title, message, created_at)
    VALUES (
      NEW.notification_id,
      NEW.user_id,
      COALESCE(NEW.payload->>'type', 'system'),
      COALESCE(NEW.payload->>'title', 'System Notification'),
      COALESCE(NEW.payload->>'body', NEW.payload->>'message', 'Notification'),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  ELSE
    -- If no notification_id provided, create one
    INSERT INTO public.notifications (user_id, type, title, message, created_at)
    VALUES (
      NEW.user_id,
      COALESCE(NEW.payload->>'type', 'system'),
      COALESCE(NEW.payload->>'title', 'System Notification'),
      COALESCE(NEW.payload->>'body', NEW.payload->>'message', 'Notification'),
      NOW()
    )
    RETURNING id INTO NEW.notification_id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- ensure_system_tags_for_restaurant
CREATE OR REPLACE FUNCTION public.ensure_system_tags_for_restaurant(p_restaurant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  catalog jsonb := $json$
  [
    {"name":"First-Timer",        "color":"#a855f7","description":"Completed their first booking in the last 60 days",                     "system_key":"first_timer",        "icon":"user-plus",     "category":"loyalty",     "priority":10},
    {"name":"Repeat Guest",       "color":"#6366f1","description":"Has completed 2 to 4 visits",                                             "system_key":"repeat_guest",       "icon":"repeat",        "category":"loyalty",     "priority":11},
    {"name":"Regular",            "color":"#22c55e","description":"Has completed 5 to 14 visits",                                            "system_key":"regular",            "icon":"star",          "category":"loyalty",     "priority":12},
    {"name":"Frequent",           "color":"#3b82f6","description":"Has completed 15 to 29 visits",                                           "system_key":"frequent",           "icon":"trending-up",   "category":"loyalty",     "priority":13},
    {"name":"Loyal",              "color":"#f59e0b","description":"Has completed 30 or more visits",                                         "system_key":"loyal",              "icon":"crown",         "category":"loyalty",     "priority":14},
    {"name":"Active",             "color":"#10b981","description":"Visited in the last 30 days",                                             "system_key":"active",             "icon":"activity",      "category":"recency",     "priority":20},
    {"name":"Lapsing",            "color":"#eab308","description":"Has not visited in 31 to 90 days",                                        "system_key":"lapsing",            "icon":"clock",         "category":"recency",     "priority":21},
    {"name":"Lapsed",             "color":"#f97316","description":"Has not visited in 91 to 180 days",                                       "system_key":"lapsed",             "icon":"alert-circle",  "category":"recency",     "priority":22},
    {"name":"Dormant",            "color":"#6b7280","description":"Has not visited in more than 180 days",                                   "system_key":"dormant",            "icon":"moon",          "category":"recency",     "priority":23},
    {"name":"Welcome Back",       "color":"#06b6d4","description":"Returned in the last 14 days after a 90+ day absence",                    "system_key":"welcome_back",       "icon":"sparkles",      "category":"recency",     "priority":24},
    {"name":"High Spender",       "color":"#14b8a6","description":"Lifetime spend between 500 and 1999",                                     "system_key":"high_spender",       "icon":"dollar-sign",   "category":"value",       "priority":30},
    {"name":"Top Spender",        "color":"#0ea5e9","description":"Lifetime spend between 2000 and 4999",                                    "system_key":"top_spender",        "icon":"gem",           "category":"value",       "priority":31},
    {"name":"Whale",              "color":"#8b5cf6","description":"Lifetime spend of 5000 or more",                                          "system_key":"whale",              "icon":"award",         "category":"value",       "priority":32},
    {"name":"Reliable",           "color":"#16a34a","description":"5+ completed visits, no no-shows, cancel rate below 10%",                 "system_key":"reliable",           "icon":"check-circle",  "category":"reliability", "priority":40},
    {"name":"No-Show Risk",       "color":"#ef4444","description":"Has 2 or more previous no-shows",                                         "system_key":"no_show_risk",       "icon":"ban",           "category":"reliability", "priority":41},
    {"name":"Frequent Canceller", "color":"#dc2626","description":"Has 3+ cancellations, or cancel rate above 40% with 5+ bookings",         "system_key":"frequent_canceller", "icon":"x-circle",      "category":"reliability", "priority":42},
    {"name":"At-Risk",            "color":"#b91c1c","description":"3+ no-shows + cancellations combined in the last 90 days",                "system_key":"at_risk",            "icon":"alert-triangle","category":"reliability", "priority":43},
    {"name":"Solo Diner",         "color":"#64748b","description":"Average party size below 1.5 across 3+ visits",                           "system_key":"solo_diner",         "icon":"user",          "category":"party",       "priority":50},
    {"name":"Couple",             "color":"#ec4899","description":"Average party size 1.5 to 2.5 across 3+ visits",                          "system_key":"couple",             "icon":"heart",         "category":"party",       "priority":51},
    {"name":"Small Group",        "color":"#f472b6","description":"Average party size 2.5 to 4.9 across 3+ visits",                          "system_key":"small_group",        "icon":"users",         "category":"party",       "priority":52},
    {"name":"Large Group",        "color":"#f59e0b","description":"Average party size of 5 or more",                                         "system_key":"large_group",        "icon":"users-round",   "category":"party",       "priority":53},
    {"name":"Event Host",         "color":"#d946ef","description":"Has 2+ completed bookings with party size of 8 or more",                  "system_key":"event_host",         "icon":"party-popper",  "category":"party",       "priority":54},
    {"name":"Weekend Regular",    "color":"#6366f1","description":"More than 60% of visits fall on Sat/Sun (3+ visits)",                     "system_key":"weekend_regular",    "icon":"calendar",      "category":"timing",      "priority":60},
    {"name":"Weekday Regular",    "color":"#0d9488","description":"More than 70% of visits fall on Mon-Fri (5+ visits)",                     "system_key":"weekday_regular",    "icon":"calendar-days", "category":"timing",      "priority":61},
    {"name":"Lunch Guest",        "color":"#fbbf24","description":"More than 60% of visits between 11:00 and 15:00 (3+ visits)",             "system_key":"lunch_guest",        "icon":"sun",           "category":"timing",      "priority":62},
    {"name":"Dinner Guest",       "color":"#7c3aed","description":"More than 60% of visits between 17:00 and 22:00 (3+ visits)",             "system_key":"dinner_guest",       "icon":"utensils",      "category":"timing",      "priority":63},
    {"name":"Late Diner",         "color":"#1e293b","description":"More than 30% of visits after 21:00 (3+ visits)",                         "system_key":"late_diner",         "icon":"moon-star",     "category":"timing",      "priority":64},
    {"name":"Birthday This Month","color":"#f43f5e","description":"Profile date of birth falls in the current month",                       "system_key":"birthday_month",     "icon":"cake",          "category":"attention",   "priority":70},
    {"name":"Celebrator",         "color":"#fb7185","description":"Has 3+ bookings marking a special occasion",                              "system_key":"celebrator",         "icon":"gift",          "category":"attention",   "priority":71},
    {"name":"Allergy Alert",      "color":"#dc2626","description":"Profile has recorded allergies",                                          "system_key":"allergy_alert",      "icon":"shield-alert",  "category":"attention",   "priority":72},
    {"name":"Dietary Restriction","color":"#84cc16","description":"Profile has recorded dietary restrictions",                               "system_key":"dietary_restriction","icon":"leaf",          "category":"attention",   "priority":73},
    {"name":"VIP",                "color":"#eab308","description":"Flagged as VIP by the restaurant",                                        "system_key":"vip",                "icon":"crown",         "category":"attention",   "priority":74},
    {"name":"Blacklisted",        "color":"#111827","description":"Flagged as blacklisted by the restaurant",                                "system_key":"blacklisted",        "icon":"user-x",        "category":"attention",   "priority":75},
    {"name":"Loyalty Member",     "color":"#a855f7","description":"Has loyalty points or a non-bronze membership tier",                      "system_key":"loyalty_member",     "icon":"badge-check",   "category":"attention",   "priority":76},
    {"name":"Special Requests",   "color":"#0891b2","description":"50%+ of completed bookings include a special request (3+ visits)",        "system_key":"special_requests",   "icon":"message-square","category":"attention",   "priority":77}
  ]
  $json$::jsonb;
BEGIN
  -- Step 1: upgrade existing matching-name tags
  UPDATE public.customer_tags ct
  SET is_system = true,
      system_key = c.system_key,
      icon       = COALESCE(NULLIF(ct.icon, ''), c.icon),
      category   = COALESCE(NULLIF(ct.category, ''), c.category),
      priority   = CASE WHEN ct.priority = 0 THEN c.priority::int ELSE ct.priority END
  FROM (
    SELECT (item->>'name')::text AS name, (item->>'system_key')::text AS system_key,
           (item->>'icon')::text AS icon, (item->>'category')::text AS category,
           (item->>'priority')::int AS priority
    FROM jsonb_array_elements(catalog) AS item
  ) c
  WHERE ct.restaurant_id = p_restaurant_id
    AND lower(ct.name) = lower(c.name)
    AND ct.system_key IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.customer_tags ct2
      WHERE ct2.restaurant_id = p_restaurant_id
        AND ct2.system_key = c.system_key
    );

  -- Step 2: insert missing system tags
  INSERT INTO public.customer_tags (
    restaurant_id, name, color, description, is_system, system_key, icon, category, priority
  )
  SELECT p_restaurant_id, c.name, c.color, c.description, true, c.system_key, c.icon, c.category, c.priority
  FROM (
    SELECT (item->>'name')::text AS name, (item->>'color')::text AS color,
           (item->>'description')::text AS description, (item->>'system_key')::text AS system_key,
           (item->>'icon')::text AS icon, (item->>'category')::text AS category,
           (item->>'priority')::int AS priority
    FROM jsonb_array_elements(catalog) AS item
  ) c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.customer_tags ct
    WHERE ct.restaurant_id = p_restaurant_id
      AND (lower(ct.name) = lower(c.name) OR ct.system_key = c.system_key)
  );

  -- Step 3: refresh system metadata
  UPDATE public.customer_tags ct
  SET icon     = COALESCE(NULLIF(ct.icon, ''), c.icon),
      category = COALESCE(NULLIF(ct.category, ''), c.category),
      priority = CASE WHEN ct.priority = 0 THEN c.priority::int ELSE ct.priority END
  FROM (
    SELECT (item->>'system_key')::text AS system_key, (item->>'icon')::text AS icon,
           (item->>'category')::text AS category, (item->>'priority')::int AS priority
    FROM jsonb_array_elements(catalog) AS item
  ) c
  WHERE ct.restaurant_id = p_restaurant_id
    AND ct.is_system = true
    AND ct.system_key = c.system_key;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- evaluate_booking_type
CREATE OR REPLACE FUNCTION public.evaluate_booking_type(p_restaurant_id uuid, p_section_name text DEFAULT NULL::text, p_table_ids uuid[] DEFAULT NULL::uuid[], p_party_size integer DEFAULT 1, p_booking_date date DEFAULT CURRENT_DATE, p_booking_time time without time zone DEFAULT '12:00:00'::time without time zone, p_turn_time integer DEFAULT 120)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_table_record RECORD;
  v_rule RECORD;
  v_condition JSONB;
  v_all_match BOOLEAN;
  v_cond_type TEXT;
  v_day_of_week INT;
  v_found_instant BOOLEAN := false;
  v_found_match BOOLEAN;
  v_effective_type TEXT;
  v_winning_rule_name TEXT := NULL;
  v_evaluated JSON[] := ARRAY[]::JSON[];
  v_booking_start TIMESTAMPTZ;
  v_booking_end TIMESTAMPTZ;
  v_section_id UUID;
BEGIN
  -- Calculate booking window for availability check
  v_booking_start := (p_booking_date || ' ' || p_booking_time)::TIMESTAMP AT TIME ZONE 'Asia/Beirut';
  v_booking_end := v_booking_start + (p_turn_time || ' minutes')::INTERVAL;
  v_day_of_week := EXTRACT(DOW FROM p_booking_date)::INT;

  -- Resolve section_id from name if needed
  IF p_section_name IS NOT NULL AND (p_table_ids IS NULL OR array_length(p_table_ids, 1) IS NULL) THEN
    SELECT id INTO v_section_id
    FROM restaurant_sections
    WHERE restaurant_id = p_restaurant_id
      AND name = p_section_name
      AND is_active = true;

    IF v_section_id IS NULL THEN
      RETURN json_build_object(
        'booking_type', NULL,
        'reason', 'no_tables_found',
        'rule_name', NULL,
        'evaluated_tables', '[]'::json
      );
    END IF;
  END IF;

  -- Iterate over candidate tables
  FOR v_table_record IN
    SELECT rt.id, rt.table_number, rt.default_booking_type,
           rt.capacity, rt.min_capacity, rt.max_capacity
    FROM restaurant_tables rt
    WHERE rt.restaurant_id = p_restaurant_id
      AND rt.is_active = true
      -- Filter by section or explicit table IDs
      AND (
        (p_table_ids IS NOT NULL AND array_length(p_table_ids, 1) > 0 AND rt.id = ANY(p_table_ids))
        OR
        (v_section_id IS NOT NULL AND rt.section_id = v_section_id)
      )
      -- Only consider tables not already booked for this time slot
      AND NOT EXISTS (
        SELECT 1
        FROM booking_tables bt
        JOIN bookings b ON b.id = bt.booking_id
        WHERE bt.table_id = rt.id
          AND b.status IN ('confirmed', 'pending', 'arrived', 'seated')
          AND b.booking_time < v_booking_end
          AND (b.booking_time + (b.turn_time_minutes || ' minutes')::INTERVAL) > v_booking_start
      )
    ORDER BY rt.priority_score DESC, ABS(rt.capacity - p_party_size)
  LOOP
    v_found_match := false;
    v_effective_type := v_table_record.default_booking_type;

    -- Evaluate booking rules for this table (highest priority first)
    FOR v_rule IN
      SELECT tbr.*
      FROM table_booking_rules tbr
      WHERE tbr.table_id = v_table_record.id
        AND tbr.is_active = true
      ORDER BY tbr.priority DESC
    LOOP
      v_all_match := true;

      -- Evaluate ALL conditions (AND logic)
      IF v_rule.conditions IS NOT NULL AND jsonb_array_length(v_rule.conditions) > 0 THEN
        FOR v_condition IN SELECT * FROM jsonb_array_elements(v_rule.conditions)
        LOOP
          v_cond_type := v_condition->>'type';

          CASE v_cond_type
            WHEN 'party_size' THEN
              -- Support both operator/value format and min/max format
              IF v_condition ? 'operator' THEN
                CASE v_condition->>'operator'
                  WHEN 'gte' THEN IF p_party_size < (v_condition->>'value')::INT THEN v_all_match := false; END IF;
                  WHEN 'lte' THEN IF p_party_size > (v_condition->>'value')::INT THEN v_all_match := false; END IF;
                  WHEN 'eq'  THEN IF p_party_size != (v_condition->>'value')::INT THEN v_all_match := false; END IF;
                  WHEN 'gt'  THEN IF p_party_size <= (v_condition->>'value')::INT THEN v_all_match := false; END IF;
                  WHEN 'lt'  THEN IF p_party_size >= (v_condition->>'value')::INT THEN v_all_match := false; END IF;
                  ELSE v_all_match := false;
                END CASE;
              ELSE
                -- min/max format
                IF v_condition ? 'min' AND p_party_size < (v_condition->>'min')::INT THEN v_all_match := false; END IF;
                IF v_condition ? 'max' AND p_party_size > (v_condition->>'max')::INT THEN v_all_match := false; END IF;
              END IF;

            WHEN 'day_of_week' THEN
              IF v_condition ? 'days' THEN
                IF NOT (v_condition->'days' @> to_jsonb(v_day_of_week)) THEN v_all_match := false; END IF;
              ELSIF v_condition ? 'value' THEN
                IF NOT (v_condition->'value' @> to_jsonb(v_day_of_week)) THEN v_all_match := false; END IF;
              ELSE
                v_all_match := false;
              END IF;

            WHEN 'time_range' THEN
              IF v_condition ? 'start' AND v_condition ? 'end' THEN
                IF p_booking_time < (v_condition->>'start')::TIME OR p_booking_time > (v_condition->>'end')::TIME THEN
                  v_all_match := false;
                END IF;
              ELSIF v_condition ? 'value' THEN
                IF p_booking_time < (v_condition->'value'->>'start')::TIME OR p_booking_time > (v_condition->'value'->>'end')::TIME THEN
                  v_all_match := false;
                END IF;
              END IF;

            WHEN 'date_range' THEN
              IF v_condition ? 'start' AND v_condition ? 'end' THEN
                IF p_booking_date < (v_condition->>'start')::DATE OR p_booking_date > (v_condition->>'end')::DATE THEN
                  v_all_match := false;
                END IF;
              ELSIF v_condition ? 'value' THEN
                IF p_booking_date < (v_condition->'value'->>'start')::DATE OR p_booking_date > (v_condition->'value'->>'end')::DATE THEN
                  v_all_match := false;
                END IF;
              END IF;

            ELSE
              v_all_match := false;
          END CASE;

          EXIT WHEN NOT v_all_match;
        END LOOP;
      END IF;

      -- First matching rule wins for this table
      IF v_all_match THEN
        v_found_match := true;
        v_effective_type := v_rule.booking_type;
        v_winning_rule_name := v_rule.name;
        EXIT;
      END IF;
    END LOOP;

    -- Check if this table can fit the party
    v_evaluated := array_append(v_evaluated, json_build_object(
      'table_id', v_table_record.id,
      'table_number', v_table_record.table_number,
      'resolved_type', v_effective_type,
      'rule_name', COALESCE(v_winning_rule_name, 'default'),
      'can_fit_party', (v_table_record.min_capacity <= p_party_size AND v_table_record.max_capacity >= p_party_size)
    ));

    -- If this table is instant AND fits the party → we have an instant option
    IF v_effective_type = 'instant'
       AND v_table_record.min_capacity <= p_party_size
       AND v_table_record.max_capacity >= p_party_size THEN
      v_found_instant := true;
    END IF;

    -- Reset for next table
    v_winning_rule_name := NULL;
  END LOOP;

  -- No tables evaluated at all
  IF array_length(v_evaluated, 1) IS NULL THEN
    RETURN json_build_object(
      'booking_type', NULL,
      'reason', 'no_tables_found',
      'rule_name', NULL,
      'evaluated_tables', '[]'::json
    );
  END IF;

  -- Return result
  IF v_found_instant THEN
    RETURN json_build_object(
      'booking_type', 'instant',
      'reason', 'instant_table_available',
      'rule_name', v_winning_rule_name,
      'evaluated_tables', array_to_json(v_evaluated)
    );
  ELSE
    RETURN json_build_object(
      'booking_type', 'request',
      'reason', 'all_tables_request',
      'rule_name', v_winning_rule_name,
      'evaluated_tables', array_to_json(v_evaluated)
    );
  END IF;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- expire_cuisine_sponsorships
CREATE OR REPLACE FUNCTION public.expire_cuisine_sponsorships()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  affected_rows integer;
BEGIN
  UPDATE public.cuisine_sponsorships
  SET status = 'expired', updated_at = now()
  WHERE status = 'active' AND end_date < now();
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- expire_old_redemptions
CREATE OR REPLACE FUNCTION public.expire_old_redemptions()
 RETURNS integer
 LANGUAGE plpgsql
AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE public.loyalty_redemptions
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active' AND expires_at < NOW();
  
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- expire_old_user_offers
CREATE OR REPLACE FUNCTION public.expire_old_user_offers()
 RETURNS integer
 LANGUAGE plpgsql
AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE public.user_offers
  SET status = 'expired'
  WHERE status = 'active' 
    AND expires_at IS NOT NULL 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- expire_pending_deposits
CREATE OR REPLACE FUNCTION public.expire_pending_deposits(p_expiry_minutes integer DEFAULT 15)
 RETURNS TABLE(expired_booking_id uuid, expired_at timestamp with time zone, user_id uuid, restaurant_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_expiry_threshold timestamptz;
  v_booking record;
BEGIN
  -- Calculate expiry threshold
  v_expiry_threshold := NOW() - (p_expiry_minutes || ' minutes')::interval;
  
  -- Find and expire pending deposits
  FOR v_booking IN
    SELECT b.id, b.user_id, b.restaurant_id
    FROM public.bookings b
    WHERE b.deposit_status = 'pending'
      AND b.status IN ('pending', 'confirmed')
      AND b.updated_at < v_expiry_threshold
      -- Only expire bookings that were waiting for deposit
      -- (booking time is in the future)
      AND b.booking_time > NOW()
  LOOP
    -- Update booking status
    UPDATE public.bookings
    SET 
      status = 'cancelled',
      deposit_status = 'failed',
      cancellation_reason = 'deposit_payment_expired',
      updated_at = NOW()
    WHERE id = v_booking.id;
    
    -- Update booking_deposits if exists
    UPDATE public.booking_deposits
    SET 
      status = 'failed',
      updated_at = NOW()
    WHERE booking_id = v_booking.id
      AND status = 'pending';
    
    -- Log the expiry for audit
    INSERT INTO public.audit_logs (
      actor_id,
      actor_type,
      action,
      action_category,
      entity_type,
      entity_id,
      restaurant_id,
      new_values,
      severity
    ) VALUES (
      v_booking.user_id,
      'system',
      'deposit.expired',
      'payment',
      'booking',
      v_booking.id,
      v_booking.restaurant_id,
      jsonb_build_object(
        'expiry_threshold_minutes', p_expiry_minutes,
        'expired_at', NOW()
      ),
      'warning'
    );
    
    -- Return the expired booking
    expired_booking_id := v_booking.id;
    expired_at := NOW();
    user_id := v_booking.user_id;
    restaurant_id := v_booking.restaurant_id;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- expire_pending_items
CREATE OR REPLACE FUNCTION public.expire_pending_items()
 RETURNS json
 LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb := '{"timestamp": null, "total_expired": 0}'::jsonb;
  v_expired_bookings integer := 0;
  v_expired_waitlist integer := 0;
  v_expired_offers integer := 0;
  v_expired_redemptions integer := 0;
  v_booking_record record;
  v_waitlist_record record;
  v_restaurant_name text;
BEGIN
  -- Set the timestamp
  v_result := jsonb_set(v_result, '{timestamp}', to_jsonb(now()));

  -- ===========================================
  -- 1. EXPIRE PENDING BOOKING REQUESTS
  -- ===========================================
  
  -- Only expire bookings where the booking time has passed
  -- No longer expiring based on creation time or request_expires_at
  FOR v_booking_record IN
    SELECT 
      b.id,
      b.user_id,
      b.restaurant_id,
      b.booking_time,
      b.party_size,
      r.name as restaurant_name
    FROM bookings b
    JOIN restaurants r ON b.restaurant_id = r.id
    WHERE b.status = 'pending'
      AND b.booking_time < now()  -- ONLY expire when booking time has passed
  LOOP
    -- Update the booking status
    UPDATE bookings 
    SET 
      status = 'auto_declined',
      auto_declined = true,
      updated_at = now(),
      acceptance_failed_reason = 'Booking time passed without confirmation'
    WHERE id = v_booking_record.id;
    
    -- Create notification for user about expired booking request
    PERFORM public.enqueue_notification(
      v_booking_record.user_id,
      'booking',
      'booking_request_expired',
      'Booking Request Expired',
      'Your booking request at ' || v_booking_record.restaurant_name || ' has expired as the booking time has passed.',
      jsonb_build_object(
        'bookingId', v_booking_record.id,
        'restaurantId', v_booking_record.restaurant_id,
        'restaurantName', v_booking_record.restaurant_name,
        'bookingTime', v_booking_record.booking_time,
        'partySize', v_booking_record.party_size,
        'expiredReason', 'booking_time_passed'
      ),
      'app://bookings',
      ARRAY['inapp', 'push']
    );
    
    -- Add to booking status history
    INSERT INTO booking_status_history (booking_id, old_status, new_status, metadata)
    VALUES (
      v_booking_record.id,
      'pending',
      'auto_declined',
      jsonb_build_object(
        'reason', 'Booking time passed without restaurant confirmation',
        'expired_at', now(),
        'expiration_type', 'booking_time_passed'
      )
    );
    
    v_expired_bookings := v_expired_bookings + 1;
  END LOOP;

  -- ===========================================
  -- 2. EXPIRE WAITLIST ENTRIES
  -- ===========================================
  
  -- Get waitlist entries that will be expired for notifications
  FOR v_waitlist_record IN
    SELECT 
      w.id,
      w.user_id,
      w.restaurant_id,
      w.desired_date,
      w.desired_time_range,
      w.party_size,
      w.status,
      r.name as restaurant_name
    FROM waitlist w
    JOIN restaurants r ON w.restaurant_id = r.id
    WHERE (
      -- Active entries past their expiration time
      (w.status = 'active' AND w.expires_at IS NOT NULL AND w.expires_at < now())
      OR
      -- Notified entries that didn't respond within the notification window
      (w.status = 'notified' AND w.notification_expires_at IS NOT NULL AND w.notification_expires_at < now())
      OR
      -- Active entries for dates that have passed (fallback)
      (w.status = 'active' AND w.desired_date < CURRENT_DATE)
    )
  LOOP
    -- Update waitlist status
    UPDATE waitlist 
    SET 
      status = 'expired',
      updated_at = now()
    WHERE id = v_waitlist_record.id;
    
    -- Create notification for user about expired waitlist
    PERFORM public.enqueue_notification(
      v_waitlist_record.user_id,
      'waitlist',
      'waiting_list_expired',
      'Waitlist Entry Expired',
      'Your waitlist entry at ' || v_waitlist_record.restaurant_name || ' has expired.',
      jsonb_build_object(
        'entryId', v_waitlist_record.id,
        'restaurantId', v_waitlist_record.restaurant_id,
        'restaurantName', v_waitlist_record.restaurant_name,
        'desiredDate', v_waitlist_record.desired_date,
        'timeRange', v_waitlist_record.desired_time_range,
        'partySize', v_waitlist_record.party_size,
        'expiredReason', CASE
          WHEN v_waitlist_record.status = 'notified' THEN 'notification_timeout'
          ELSE 'time_expired'
        END
      ),
      'app://waiting-list',
      ARRAY['inapp', 'push']
    );
    
    v_expired_waitlist := v_expired_waitlist + 1;
  END LOOP;

  -- ===========================================
  -- 3. EXPIRE USER OFFERS
  -- ===========================================
  
  -- Expire user offers
  UPDATE user_offers
  SET status = 'expired'
  WHERE status = 'active' 
    AND expires_at IS NOT NULL 
    AND expires_at < NOW();
    
  GET DIAGNOSTICS v_expired_offers = ROW_COUNT;

  -- ===========================================
  -- 4. EXPIRE LOYALTY REDEMPTIONS
  -- ===========================================
  
  -- Expire loyalty redemptions
  UPDATE loyalty_redemptions
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active' 
    AND expires_at < NOW();
    
  GET DIAGNOSTICS v_expired_redemptions = ROW_COUNT;

  -- ===========================================
  -- 5. CLEANUP EXPIRED LOYALTY RULES
  -- ===========================================
  
  -- Deactivate expired loyalty rules
  UPDATE restaurant_loyalty_rules
  SET is_active = false
  WHERE is_active = true
    AND valid_until IS NOT NULL
    AND valid_until < now();

  -- ===========================================
  -- BUILD RESULT
  -- ===========================================
  
  v_result := v_result || jsonb_build_object(
    'expired_bookings', v_expired_bookings,
    'expired_waitlist', v_expired_waitlist,
    'expired_offers', v_expired_offers,
    'expired_redemptions', v_expired_redemptions,
    'total_expired', v_expired_bookings + v_expired_waitlist + v_expired_offers + v_expired_redemptions
  );
  
  -- Log the expiration if any items were processed
  IF (v_expired_bookings + v_expired_waitlist + v_expired_offers + v_expired_redemptions) > 0 THEN
    RAISE NOTICE 'Expired % bookings, % waitlist entries, % offers, % redemptions', 
      v_expired_bookings, v_expired_waitlist, v_expired_offers, v_expired_redemptions;
  END IF;

  RETURN v_result::json;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- fetch_and_lock_notifications
CREATE OR REPLACE FUNCTION public.fetch_and_lock_notifications(p_limit integer DEFAULT 500)
 RETURNS TABLE(id uuid, notification_id uuid, user_id uuid, channel text, payload jsonb, campaign_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH locked_items AS (
    SELECT no.id
    FROM notification_outbox no
    WHERE no.status = 'queued'
      AND no.scheduled_for <= NOW()
    ORDER BY 
      CASE no.priority 
        WHEN 'urgent' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'normal' THEN 3 
        WHEN 'low' THEN 4 
        ELSE 5 
      END,
      no.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE notification_outbox no
  SET status = 'processing'
  FROM locked_items li
  WHERE no.id = li.id
  RETURNING no.id, no.notification_id, no.user_id, no.channel, no.payload, no.campaign_id;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- fix_booking_without_tables
CREATE OR REPLACE FUNCTION public.fix_booking_without_tables(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $$
DECLARE
  v_booking record;
  v_available_table record;
  v_result jsonb;
BEGIN
  -- Get booking details
  SELECT b.*, r.id as restaurant_id
  INTO v_booking
  FROM bookings b
  JOIN restaurants r ON b.restaurant_id = r.id
  WHERE b.id = p_booking_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Booking not found');
  END IF;

  -- Check if tables already assigned
  IF EXISTS (SELECT 1 FROM booking_tables WHERE booking_id = p_booking_id) THEN
    RETURN jsonb_build_object('error', 'Tables already assigned');
  END IF;

  -- Find an available table
  SELECT * INTO v_available_table
  FROM get_available_tables(
    v_booking.restaurant_id,
    v_booking.booking_time,
    v_booking.booking_time + (v_booking.turn_time_minutes || ' minutes')::interval,
    v_booking.party_size
  )
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'No available tables found');
  END IF;

  -- Assign the table
  INSERT INTO booking_tables (booking_id, table_id)
  VALUES (p_booking_id, v_available_table.table_id);

  RETURN jsonb_build_object(
    'success', true,
    'table_assigned', v_available_table.table_number,
    'table_id', v_available_table.table_id
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- fix_customer_data_inconsistencies
CREATE OR REPLACE FUNCTION public.fix_customer_data_inconsistencies()
 RETURNS void
 LANGUAGE plpgsql
AS $$
DECLARE
  fixed_count integer;
BEGIN
  RAISE NOTICE 'Checking for and fixing customer data inconsistencies...';
  
  -- Fix customers without names (use profile name for registered users)
  UPDATE restaurant_customers 
  SET guest_name = p.full_name,
      updated_at = now()
  FROM profiles p
  WHERE restaurant_customers.user_id = p.id 
  AND (restaurant_customers.guest_name IS NULL OR restaurant_customers.guest_name = '');
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % customer records with missing names', fixed_count;
  
  -- Fix negative statistics (shouldn't happen but just in case)
  UPDATE restaurant_customers
  SET 
    total_bookings = GREATEST(total_bookings, 0),
    no_show_count = GREATEST(no_show_count, 0),
    cancelled_count = GREATEST(cancelled_count, 0),
    average_party_size = GREATEST(average_party_size, 0),
    updated_at = now()
  WHERE total_bookings < 0 OR no_show_count < 0 OR cancelled_count < 0 OR average_party_size < 0;
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % customer records with negative statistics', fixed_count;
  
  -- Identify and report potential duplicate customers
  CREATE TEMP TABLE potential_duplicates AS
  SELECT 
    restaurant_id,
    guest_email,
    COUNT(*) as duplicate_count,
    array_agg(id) as customer_ids
  FROM restaurant_customers
  WHERE guest_email IS NOT NULL
  GROUP BY restaurant_id, guest_email
  HAVING COUNT(*) > 1;
  
  SELECT COUNT(*) INTO fixed_count FROM potential_duplicates;
  
  IF fixed_count > 0 THEN
    RAISE NOTICE 'Found % potential duplicate customer groups (same email). Manual review recommended:', fixed_count;
    -- You can uncomment this to see the details:
    -- FOR record IN SELECT * FROM potential_duplicates LOOP
    --   RAISE NOTICE 'Restaurant: %, Email: %, Count: %, IDs: %', 
    --     record.restaurant_id, record.guest_email, record.duplicate_count, record.customer_ids;
    -- END LOOP;
  ELSE
    RAISE NOTICE 'No duplicate customers found.';
  END IF;
  
  DROP TABLE potential_duplicates;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- fn_check_login_lockout
CREATE OR REPLACE FUNCTION public.fn_check_login_lockout(p_email citext)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  r record;
  v_locked_now boolean;
BEGIN
  SELECT fail_count, locked_until, last_attempt_at
    INTO r
  FROM public.account_lockouts
  WHERE email = p_email;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'locked',           false,
      'fail_count',       0,
      'requires_captcha', false
    );
  END IF;

  v_locked_now := r.locked_until IS NOT NULL AND r.locked_until > now();

  RETURN jsonb_build_object(
    'locked',                v_locked_now,
    'locked_until',          r.locked_until,
    'fail_count',            r.fail_count,
    -- CAPTCHA threshold = 2 fails (so it shows on attempt #3)
    'requires_captcha',      r.fail_count >= 2,
    'seconds_until_unlock',  GREATEST(0, EXTRACT(EPOCH FROM (r.locked_until - now()))::int)
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- fn_clear_failed_logins
CREATE OR REPLACE FUNCTION public.fn_clear_failed_logins(p_email citext)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  DELETE FROM public.account_lockouts WHERE email = p_email;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- fn_consume_forced_reset
CREATE OR REPLACE FUNCTION public.fn_consume_forced_reset(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'caller must be the target user';
  END IF;

  UPDATE public.forced_password_resets
  SET consumed_at = now()
  WHERE user_id = p_user_id AND consumed_at IS NULL;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- fn_force_password_reset
CREATE OR REPLACE FUNCTION public.fn_force_password_reset(p_user_id uuid, p_reason text DEFAULT 'compromised_account'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- Only super_admins may force-reset other accounts (defence-in-depth — the
  -- service-role caller has already been gated, but let's not rely on that).
  IF NOT EXISTS (
    SELECT 1 FROM public.rbs_admins
    WHERE user_id = v_caller AND role IN ('super_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  INSERT INTO public.forced_password_resets (user_id, reason, enforced_by)
  VALUES (p_user_id, p_reason, v_caller)
  ON CONFLICT (user_id) DO UPDATE
    SET reason       = EXCLUDED.reason,
        enforced_by  = EXCLUDED.enforced_by,
        enforced_at  = now(),
        consumed_at  = NULL;

  -- Audit
  INSERT INTO public.security_audit_log
    (user_id, restaurant_id, activity_type, risk_score, details)
  VALUES
    (p_user_id, NULL, 'forced_password_reset', 80,
     jsonb_build_object('reason', p_reason, 'enforced_by', v_caller));
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- fn_record_failed_login
CREATE OR REPLACE FUNCTION public.fn_record_failed_login(p_email citext, p_ip inet, p_user_agent text DEFAULT NULL::text, p_reason text DEFAULT 'invalid_credentials'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count    integer;
  v_locked   timestamptz;
  v_duration interval;
BEGIN
  IF p_email IS NULL OR length(p_email) = 0 THEN
    RAISE EXCEPTION 'email required';
  END IF;

  INSERT INTO public.failed_login_attempts (email, ip_address, user_agent, reason)
  VALUES (p_email, p_ip, p_user_agent, p_reason);

  -- Reset the rolling counter if last attempt was > 24 h ago
  INSERT INTO public.account_lockouts (email, fail_count, last_attempt_at, last_ip)
  VALUES (p_email, 1, now(), p_ip)
  ON CONFLICT (email) DO UPDATE
  SET fail_count = CASE
        WHEN public.account_lockouts.last_attempt_at < now() - INTERVAL '24 hours'
          THEN 1
        ELSE public.account_lockouts.fail_count + 1
      END,
      last_attempt_at = now(),
      last_ip = p_ip,
      updated_at = now()
  RETURNING fail_count INTO v_count;

  v_duration := public._fn_lockout_duration(v_count);
  IF v_duration > INTERVAL '0' THEN
    v_locked := now() + v_duration;
    UPDATE public.account_lockouts
    SET locked_until = v_locked
    WHERE email = p_email;
  END IF;

  -- Mirror to the existing security_audit_log so SOC tooling sees it.
  INSERT INTO public.security_audit_log
    (user_id, restaurant_id, activity_type, risk_score, details, ip_address, user_agent)
  VALUES
    (NULL, NULL, 'login_failed',
     LEAST(100, v_count * 15),
     jsonb_build_object('email', p_email, 'fail_count', v_count, 'reason', p_reason),
     p_ip, p_user_agent);

  RETURN jsonb_build_object(
    'fail_count',   v_count,
    'locked_until', v_locked,
    'lock_duration_seconds', EXTRACT(EPOCH FROM v_duration)::int
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- generate_confirmation_code
CREATE OR REPLACE FUNCTION public.generate_confirmation_code()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.confirmation_code := UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6));
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- generate_order_number
CREATE OR REPLACE FUNCTION public.generate_order_number(restaurant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
AS $$
DECLARE
  order_count integer;
  order_number text;
BEGIN
  -- Get today's order count for this restaurant
  SELECT COUNT(*) INTO order_count
  FROM orders 
  WHERE orders.restaurant_id = generate_order_number.restaurant_id 
    AND DATE(created_at) = CURRENT_DATE;
  
  -- Generate order number: YYYYMMDD-RRR-NNN
  order_number := TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                  LPAD(SUBSTRING(restaurant_id::text FROM 1 FOR 3), 3, '0') || '-' ||
                  LPAD((order_count + 1)::text, 3, '0');
  
  RETURN order_number;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- generate_share_code
CREATE OR REPLACE FUNCTION public.generate_share_code()
 RETURNS text
 LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_activation_metrics
CREATE OR REPLACE FUNCTION public.get_activation_metrics()
 RETURNS json
 LANGUAGE plpgsql
AS $$
DECLARE
  total_users_count INTEGER;
  users_with_any_booking INTEGER;
  users_with_completed_booking INTEGER;
  any_booking_rate NUMERIC;
  completed_booking_rate NUMERIC;
BEGIN
  -- Step 1: Define eligible users (users we can evaluate)
  -- Users who joined 30+ days ago OR already made at least one booking
  WITH eligible_users AS (
    SELECT 
      p.id,
      p.created_at AS user_joined_at
    FROM profiles p
    WHERE p.created_at <= NOW() - INTERVAL '30 days'
       OR EXISTS (
          SELECT 1
          FROM bookings b
          WHERE b.user_id = p.id
            AND b.created_at >= p.created_at
        )
  )
  SELECT COUNT(*)
  INTO total_users_count
  FROM eligible_users;

  -- Step 2: Count users whose FIRST booking was within their first 30 days
  WITH eligible_users AS (
    SELECT 
      p.id,
      p.created_at AS user_joined_at
    FROM profiles p
    WHERE p.created_at <= NOW() - INTERVAL '30 days'
       OR EXISTS (
          SELECT 1
          FROM bookings b
          WHERE b.user_id = p.id
            AND b.created_at >= p.created_at
        )
  )
  SELECT COUNT(DISTINCT eu.id)
  INTO users_with_any_booking
  FROM eligible_users eu
  WHERE EXISTS (
    SELECT 1
    FROM bookings b
    WHERE b.user_id = eu.id
      AND b.created_at >= eu.user_joined_at
      AND b.created_at <= eu.user_joined_at + INTERVAL '30 days'
      -- This is their FIRST booking (no earlier booking exists)
      AND NOT EXISTS (
        SELECT 1
        FROM bookings b2
        WHERE b2.user_id = eu.id
          AND b2.created_at < b.created_at
          AND b2.created_at >= eu.user_joined_at
      )
  );

  -- Step 3: Count users whose FIRST completed booking was within their first 30 days
  WITH eligible_users AS (
    SELECT 
      p.id,
      p.created_at AS user_joined_at
    FROM profiles p
    WHERE p.created_at <= NOW() - INTERVAL '30 days'
       OR EXISTS (
          SELECT 1
          FROM bookings b
          WHERE b.user_id = p.id
            AND b.created_at >= p.created_at
        )
  )
  SELECT COUNT(DISTINCT eu.id)
  INTO users_with_completed_booking
  FROM eligible_users eu
  WHERE EXISTS (
    SELECT 1
    FROM bookings b
    WHERE b.user_id = eu.id
      AND b.created_at >= eu.user_joined_at
      AND b.created_at <= eu.user_joined_at + INTERVAL '30 days'
      AND b.status = 'completed'
      -- This is their FIRST completed booking (no earlier completed booking exists)
      AND NOT EXISTS (
        SELECT 1
        FROM bookings b2
        WHERE b2.user_id = eu.id
          AND b2.created_at < b.created_at
          AND b2.created_at >= eu.user_joined_at
          AND b2.status = 'completed'
      )
  );

  -- Calculate rates as percentages
  IF total_users_count > 0 THEN
    any_booking_rate := (users_with_any_booking::NUMERIC / total_users_count::NUMERIC) * 100;
    completed_booking_rate := (users_with_completed_booking::NUMERIC / total_users_count::NUMERIC) * 100;
  ELSE
    any_booking_rate := 0;
    completed_booking_rate := 0;
  END IF;

  -- Return as JSON matching the interface
  RETURN json_build_object(
    'totalNewUsers', total_users_count,
    'usersWithAnyBooking', users_with_any_booking,
    'usersWithCompletedBooking', users_with_completed_booking,
    'anyBookingActivationRate', ROUND(any_booking_rate, 2),
    'completedBookingActivationRate', ROUND(completed_booking_rate, 2)
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_active_users_count
CREATE OR REPLACE FUNCTION public.get_active_users_count(days_ago integer DEFAULT 30)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT COUNT(DISTINCT user_id)::INTEGER INTO result
  FROM bookings
  WHERE user_id IS NOT NULL
    AND status != 'payment_pending'
    AND created_at >= NOW() - (days_ago || ' days')::INTERVAL;

  RETURN COALESCE(result, 0);
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_booking_rates
CREATE OR REPLACE FUNCTION public.get_booking_rates(p_restaurant_id uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date)
 RETURNS TABLE(total_bookings bigint, completed_bookings bigint, cancelled_bookings bigint, no_show_bookings bigint, completion_rate_pct numeric, cancellation_rate_pct numeric, no_show_rate_pct numeric)
 LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(b.id) as total_bookings,
    COUNT(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN 1 END) as completed_bookings,
    COUNT(CASE WHEN b.status IN ('cancelled_by_user', 'cancelled_by_restaurant') THEN 1 END) as cancelled_bookings,
    COUNT(CASE WHEN b.status = 'no_show' THEN 1 END) as no_show_bookings,
    ROUND(COUNT(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as completion_rate_pct,
    ROUND(COUNT(CASE WHEN b.status IN ('cancelled_by_user', 'cancelled_by_restaurant') THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as cancellation_rate_pct,
    ROUND(COUNT(CASE WHEN b.status = 'no_show' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as no_show_rate_pct
  FROM bookings b
  WHERE (p_restaurant_id IS NULL OR b.restaurant_id = p_restaurant_id)
    AND (p_date_from IS NULL OR DATE(b.created_at) >= p_date_from)
    AND (p_date_to IS NULL OR DATE(b.created_at) <= p_date_to)
    AND b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_booking_summary_stats
CREATE OR REPLACE FUNCTION public.get_booking_summary_stats(p_restaurant_id uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date)
 RETURNS TABLE(total_bookings bigint, bookings_7d bigint, completed_bookings bigint, cancelled_bookings bigint, no_show_bookings bigint, total_covers numeric, avg_party_size numeric, completed_covers numeric)
 LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(b.id) as total_bookings,
    COUNT(CASE WHEN b.created_at >= NOW() - INTERVAL '7 days' THEN b.id END) as bookings_7d,
    COUNT(CASE WHEN b.status = 'completed' THEN b.id END) as completed_bookings,
    COUNT(CASE WHEN b.status IN ('cancelled_by_user', 'cancelled_by_restaurant') THEN b.id END) as cancelled_bookings,
    COUNT(CASE WHEN b.status = 'no_show' THEN b.id END) as no_show_bookings,
    COALESCE(SUM(b.party_size), 0) as total_covers,
    COALESCE(AVG(b.party_size), 0) as avg_party_size,
    COALESCE(SUM(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN b.party_size ELSE 0 END), 0) as completed_covers
  FROM bookings b
  WHERE (p_restaurant_id IS NULL OR b.restaurant_id = p_restaurant_id)
    AND (p_date_from IS NULL OR DATE(b.created_at) >= p_date_from)
    AND (p_date_to IS NULL OR DATE(b.created_at) <= p_date_to)
    AND b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_bookings_by_date
CREATE OR REPLACE FUNCTION public.get_bookings_by_date(p_restaurant_id uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date)
 RETURNS TABLE(booking_date date, total_bookings bigint, confirmed_bookings bigint, completed_bookings bigint, cancelled_bookings bigint, total_covers numeric, completed_covers numeric)
 LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(b.created_at) as booking_date,
    COUNT(*)::bigint as total_bookings,
    COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END)::bigint as confirmed_bookings,
    COUNT(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN 1 END)::bigint as completed_bookings,
    COUNT(CASE WHEN b.status IN ('cancelled_by_user', 'cancelled_by_restaurant') THEN 1 END)::bigint as cancelled_bookings,
    COALESCE(SUM(b.party_size), 0) as total_covers,
    COALESCE(SUM(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN b.party_size ELSE 0 END), 0) as completed_covers
  FROM bookings b
  WHERE (p_restaurant_id IS NULL OR b.restaurant_id = p_restaurant_id)
    AND (p_date_from IS NULL OR DATE(b.created_at) >= p_date_from)
    AND (p_date_to IS NULL OR DATE(b.created_at) <= p_date_to)
    AND b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
  GROUP BY DATE(b.created_at)
  ORDER BY booking_date DESC;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_bookings_by_hour
CREATE OR REPLACE FUNCTION public.get_bookings_by_hour(p_restaurant_id uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date)
 RETURNS TABLE(hour_of_day integer, booking_count bigint, total_covers numeric)
 LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(HOUR FROM b.booking_time)::integer as hour_of_day,
    COUNT(*)::bigint as booking_count,
    COALESCE(SUM(b.party_size), 0) as total_covers
  FROM bookings b
  WHERE (p_restaurant_id IS NULL OR b.restaurant_id = p_restaurant_id)
    AND (p_date_from IS NULL OR DATE(b.booking_time) >= p_date_from)
    AND (p_date_to IS NULL OR DATE(b.booking_time) <= p_date_to)
    AND b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
  GROUP BY EXTRACT(HOUR FROM b.booking_time)
  ORDER BY hour_of_day;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_bookings_by_status
CREATE OR REPLACE FUNCTION public.get_bookings_by_status(p_restaurant_id uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date)
 RETURNS TABLE(status text, count bigint, total_covers numeric)
 LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.status::text,
    COUNT(*)::bigint as count,
    COALESCE(SUM(b.party_size), 0) as total_covers
  FROM bookings b
  WHERE (p_restaurant_id IS NULL OR b.restaurant_id = p_restaurant_id)
    AND (p_date_from IS NULL OR DATE(b.created_at) >= p_date_from)
    AND (p_date_to IS NULL OR DATE(b.created_at) <= p_date_to)
    AND b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
  GROUP BY b.status
  ORDER BY count DESC;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_campaign_stats
CREATE OR REPLACE FUNCTION public.get_campaign_stats(p_campaign_id uuid)
 RETURNS TABLE(campaign_id uuid, campaign_name text, target_count bigint, sent_count bigint, delivered_count bigint, clicked_count bigint, failed_count bigint, skipped_count bigint, pending_count bigint, delivery_rate numeric, click_rate numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as campaign_id,
    c.name as campaign_name,
    c.target_count::BIGINT,
    COUNT(*) FILTER (WHERE o.status = 'sent')::BIGINT as sent_count,
    COUNT(*) FILTER (WHERE o.delivered_at IS NOT NULL)::BIGINT as delivered_count,
    COUNT(*) FILTER (WHERE o.clicked_at IS NOT NULL)::BIGINT as clicked_count,
    COUNT(*) FILTER (WHERE o.status = 'failed')::BIGINT as failed_count,
    COUNT(*) FILTER (WHERE o.status = 'skipped')::BIGINT as skipped_count,
    COUNT(*) FILTER (WHERE o.status = 'queued')::BIGINT as pending_count,
    CASE 
      WHEN COUNT(*) FILTER (WHERE o.status = 'sent') > 0 
      THEN ROUND(COUNT(*) FILTER (WHERE o.delivered_at IS NOT NULL)::NUMERIC / COUNT(*) FILTER (WHERE o.status = 'sent') * 100, 2)
      ELSE 0 
    END as delivery_rate,
    CASE 
      WHEN COUNT(*) FILTER (WHERE o.delivered_at IS NOT NULL) > 0 
      THEN ROUND(COUNT(*) FILTER (WHERE o.clicked_at IS NOT NULL)::NUMERIC / COUNT(*) FILTER (WHERE o.delivered_at IS NOT NULL) * 100, 2)
      ELSE 0 
    END as click_rate
  FROM notification_campaigns c
  LEFT JOIN notification_outbox o ON o.campaign_id = c.id
  WHERE c.id = p_campaign_id
  GROUP BY c.id, c.name, c.target_count;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_daily_activation_rate
CREATE OR REPLACE FUNCTION public.get_daily_activation_rate()
 RETURNS TABLE(date date, total_users integer, users_with_any_booking integer, users_with_completed_booking integer, any_booking_rate numeric, completed_booking_rate numeric)
 LANGUAGE plpgsql
AS $$
DECLARE
  start_date DATE;
  end_date_var DATE;
BEGIN
  -- Find the first user join date
  SELECT MIN(created_at::DATE) INTO start_date FROM profiles;
  
  -- If no users, return empty
  IF start_date IS NULL THEN
    RETURN;
  END IF;
  
  -- End date is today
  end_date_var := CURRENT_DATE;
  
  -- Start calculating from 30 days after first user (so we have meaningful data)
  -- Limit to last 365 days to keep performance reasonable
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      GREATEST(start_date + INTERVAL '30 days', end_date_var - INTERVAL '365 days'),
      end_date_var,
      INTERVAL '1 day'
    )::DATE as calc_date
  ),
  daily_stats AS (
    SELECT 
      ds.calc_date as date,
      -- Total users: joined 30+ days before this date OR already made at least one booking
      -- This matches the logic from get_activation_metrics exactly
      (
        SELECT COUNT(*)
        FROM profiles p
        WHERE p.created_at::DATE <= ds.calc_date - INTERVAL '30 days'
           OR EXISTS (
              SELECT 1
              FROM bookings b
              WHERE b.user_id = p.id
                AND b.created_at >= p.created_at
                AND b.created_at::DATE <= ds.calc_date
            )
      )::INTEGER as total_users,
      -- Users whose FIRST booking was within 30 days (any status)
      -- IMPORTANT: Only count users who are in the total_users set AND made their first booking within 30 days
      (
        SELECT COUNT(*)
        FROM profiles p
        WHERE (p.created_at::DATE <= ds.calc_date - INTERVAL '30 days'
               OR EXISTS (
                  SELECT 1
                  FROM bookings b_check
                  WHERE b_check.user_id = p.id
                    AND b_check.created_at >= p.created_at
                    AND b_check.created_at::DATE <= ds.calc_date
                ))
          AND EXISTS (
            SELECT 1
            FROM bookings b
            WHERE b.user_id = p.id
              AND b.created_at >= p.created_at
              AND b.created_at <= p.created_at + INTERVAL '30 days'
              AND b.created_at::DATE <= ds.calc_date
              -- This is their FIRST booking (no earlier booking exists)
              AND NOT EXISTS (
                SELECT 1
                FROM bookings b2
                WHERE b2.user_id = p.id
                  AND b2.created_at < b.created_at
                  AND b2.created_at >= p.created_at
              )
          )
      )::INTEGER as users_with_any_booking,
      -- Users whose FIRST completed booking was within 30 days
      (
        SELECT COUNT(*)
        FROM profiles p
        WHERE (p.created_at::DATE <= ds.calc_date - INTERVAL '30 days'
               OR EXISTS (
                  SELECT 1
                  FROM bookings b_check
                  WHERE b_check.user_id = p.id
                    AND b_check.created_at >= p.created_at
                    AND b_check.created_at::DATE <= ds.calc_date
                ))
          AND EXISTS (
            SELECT 1
            FROM bookings b
            WHERE b.user_id = p.id
              AND b.created_at >= p.created_at
              AND b.created_at <= p.created_at + INTERVAL '30 days'
              AND b.created_at::DATE <= ds.calc_date
              AND b.status = 'completed'
              -- This is their FIRST completed booking
              AND NOT EXISTS (
                SELECT 1
                FROM bookings b2
                WHERE b2.user_id = p.id
                  AND b2.created_at < b.created_at
                  AND b2.created_at >= p.created_at
                  AND b2.status = 'completed'
              )
          )
      )::INTEGER as users_with_completed_booking
    FROM date_series ds
  )
  SELECT 
    ds.date,
    ds.total_users,
    ds.users_with_any_booking,
    ds.users_with_completed_booking,
    CASE 
      WHEN ds.total_users > 0 
      THEN ROUND((ds.users_with_any_booking::NUMERIC / ds.total_users::NUMERIC) * 100, 2)
      ELSE 0
    END as any_booking_rate,
    CASE 
      WHEN ds.total_users > 0 
      THEN ROUND((ds.users_with_completed_booking::NUMERIC / ds.total_users::NUMERIC) * 100, 2)
      ELSE 0
    END as completed_booking_rate
  FROM daily_stats ds
  ORDER BY ds.date ASC;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_deposit_settings
CREATE OR REPLACE FUNCTION public.get_deposit_settings(p_restaurant_id uuid, p_booking_time timestamp with time zone, p_party_size integer)
 RETURNS TABLE(setting_id uuid, deposit_required boolean, deposit_amount numeric, fee_type text, currency text, total_deposit numeric, refund_policy text, refund_window_hours integer, partial_refund_percentage numeric, applied_multiplier numeric, override_amount numeric, matched_rule jsonb)
 LANGUAGE plpgsql
 STABLE
AS $$
DECLARE
  v_settings record;
  v_schedule_result jsonb;
  v_is_required boolean;
  v_matched_rule jsonb;
  v_multiplier numeric;
  v_override numeric;
  v_calculated_deposit numeric;
BEGIN
  SELECT * INTO v_settings
  FROM public.deposit_payment_settings dps
  WHERE dps.restaurant_id = p_restaurant_id AND dps.enabled = true;

  IF v_settings IS NULL THEN
    RETURN QUERY SELECT null::uuid, false::boolean, 0::numeric, 'per_cover'::text, 'USD'::text, 0::numeric, 'full'::text, 24::integer, 50::numeric, 1.0::numeric, null::numeric, null::jsonb;
    RETURN;
  END IF;

  IF p_party_size < v_settings.minimum_party_size THEN
    RETURN QUERY SELECT v_settings.id, false::boolean, v_settings.deposit_amount, v_settings.fee_type, v_settings.currency, 0::numeric, v_settings.refund_policy, v_settings.refund_window_hours, v_settings.partial_refund_percentage, 1.0::numeric, null::numeric, null::jsonb;
    RETURN;
  END IF;

  v_schedule_result := public.check_deposit_schedule_with_rule(p_restaurant_id, p_booking_time, p_party_size);
  v_is_required := (v_schedule_result ->> 'required')::boolean;
  v_matched_rule := v_schedule_result -> 'matched_rule';

  IF NOT v_is_required THEN
    RETURN QUERY SELECT v_settings.id, false::boolean, v_settings.deposit_amount, v_settings.fee_type, v_settings.currency, 0::numeric, v_settings.refund_policy, v_settings.refund_window_hours, v_settings.partial_refund_percentage, 1.0::numeric, null::numeric, v_matched_rule;
    RETURN;
  END IF;

  v_multiplier := COALESCE((v_matched_rule ->> 'deposit_multiplier')::numeric, (v_matched_rule ->> 'fee_multiplier')::numeric, 1.0);
  v_override := (v_matched_rule ->> 'override_amount')::numeric;

  IF v_override IS NOT NULL AND v_override > 0 THEN
    v_calculated_deposit := v_override;
  ELSE
    IF v_settings.fee_type = 'per_cover' THEN
      v_calculated_deposit := v_settings.deposit_amount * p_party_size * v_multiplier;
    ELSE
      v_calculated_deposit := v_settings.deposit_amount * v_multiplier;
    END IF;
  END IF;

  RETURN QUERY SELECT v_settings.id, true::boolean, v_settings.deposit_amount, v_settings.fee_type, v_settings.currency, v_calculated_deposit, v_settings.refund_policy, v_settings.refund_window_hours, v_settings.partial_refund_percentage, v_multiplier, v_override, v_matched_rule;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_dismissed_booking_ids
CREATE OR REPLACE FUNCTION public.get_dismissed_booking_ids(p_user_id uuid)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  RETURN ARRAY(
    SELECT booking_id
    FROM review_prompt_tracking
    WHERE user_id = p_user_id
    AND action = 'dismissed'
    ORDER BY created_at DESC
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_event_with_occurrences
CREATE OR REPLACE FUNCTION public.get_event_with_occurrences(p_event_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'event', row_to_json(e.*),
    'occurrences', (
      SELECT json_agg(row_to_json(o.*))
      FROM public.event_occurrences o
      WHERE o.event_id = p_event_id
        AND o.occurrence_date >= CURRENT_DATE
        AND o.status IN ('scheduled', 'full')
      ORDER BY o.occurrence_date ASC, o.start_time ASC NULLS LAST
    ),
    'restaurant', row_to_json(r.*)
  )
  INTO v_result
  FROM public.restaurant_events e
  LEFT JOIN public.restaurants r ON e.restaurant_id = r.id
  WHERE e.id = p_event_id;

  RETURN v_result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_favorite_restaurant_stats
CREATE OR REPLACE FUNCTION public.get_favorite_restaurant_stats(p_user_id uuid)
 RETURNS TABLE(restaurant_id uuid, last_booking_time timestamp with time zone, total_completed_bookings bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.restaurant_id,
    MAX(b.booking_time) as last_booking_time,
    COUNT(*)::BIGINT as total_completed_bookings
  FROM bookings b
  WHERE 
    b.user_id = p_user_id 
    AND b.status = 'completed'
  GROUP BY b.restaurant_id;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_friend_recommendations
CREATE OR REPLACE FUNCTION public.get_friend_recommendations(p_user_id uuid, p_limit integer DEFAULT 10)
 RETURNS TABLE(user_id uuid, full_name text, email text, avatar_url text, mutual_friends_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_friends AS (
    SELECT CASE 
      WHEN sc.user_id = p_user_id THEN sc.friend_id
      ELSE sc.user_id
    END as friend_id
    FROM public.social_connections sc
    WHERE (sc.user_id = p_user_id OR sc.friend_id = p_user_id)
    AND sc.status = 'accepted'
  ),
  potential_friends AS (
    SELECT DISTINCT CASE 
      WHEN sc.user_id IN (SELECT friend_id FROM user_friends) THEN sc.friend_id
      ELSE sc.user_id
    END as potential_friend_id
    FROM public.social_connections sc
    WHERE sc.status = 'accepted'
    AND (sc.user_id IN (SELECT friend_id FROM user_friends) OR sc.friend_id IN (SELECT friend_id FROM user_friends))
    AND CASE 
      WHEN sc.user_id IN (SELECT friend_id FROM user_friends) THEN sc.friend_id
      ELSE sc.user_id
    END != p_user_id
    AND CASE 
      WHEN sc.user_id IN (SELECT friend_id FROM user_friends) THEN sc.friend_id
      ELSE sc.user_id
    END NOT IN (SELECT friend_id FROM user_friends)
    AND CASE 
      WHEN sc.user_id IN (SELECT friend_id FROM user_friends) THEN sc.friend_id
      ELSE sc.user_id
    END NOT IN (
      SELECT CASE 
        WHEN sc2.user_id = p_user_id THEN sc2.friend_id
        ELSE sc2.user_id
      END
      FROM public.social_connections sc2
      WHERE (sc2.user_id = p_user_id OR sc2.friend_id = p_user_id)
      AND sc2.status IN ('pending', 'blocked')
    )
  )
  SELECT 
    pf.potential_friend_id,
    p.full_name,
    p.email,
    p.avatar_url,
    COUNT(*) as mutual_friends_count
  FROM potential_friends pf
  JOIN public.profiles p ON pf.potential_friend_id = p.id
  GROUP BY pf.potential_friend_id, p.full_name, p.email, p.avatar_url
  ORDER BY mutual_friends_count DESC, p.full_name
  LIMIT p_limit;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_friend_suggestions
CREATE OR REPLACE FUNCTION public.get_friend_suggestions()
 RETURNS TABLE(id uuid, full_name text, avatar_url text, mutual_friends_count integer, common_restaurants integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_restaurants AS (
    SELECT DISTINCT restaurant_id 
    FROM public.bookings 
    WHERE user_id = auth.uid() AND status = 'completed'
  ),
  potential_friends AS (
    SELECT DISTINCT b.user_id
    FROM public.bookings b
    INNER JOIN user_restaurants ur ON b.restaurant_id = ur.restaurant_id
    WHERE b.user_id != auth.uid() 
    AND b.status = 'completed'
    AND NOT EXISTS (
      SELECT 1 FROM public.friends f 
      WHERE f.user_id = auth.uid() AND f.friend_id = b.user_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.friend_requests fr 
      WHERE (fr.from_user_id = auth.uid() AND fr.to_user_id = b.user_id)
      OR (fr.from_user_id = b.user_id AND fr.to_user_id = auth.uid())
    )
  )
  SELECT 
    p.id,
    p.full_name,
    p.avatar_url,
    COUNT(DISTINCT mf.user_id)::INTEGER AS mutual_friends_count,
    COUNT(DISTINCT b.restaurant_id)::INTEGER AS common_restaurants
  FROM potential_friends pf
  INNER JOIN public.profiles p ON p.id = pf.user_id
  LEFT JOIN public.friends f ON f.friend_id = pf.user_id
  LEFT JOIN public.friends mf ON mf.user_id = f.user_id AND mf.friend_id = auth.uid()
  LEFT JOIN public.bookings b ON b.user_id = pf.user_id
  INNER JOIN user_restaurants ur ON b.restaurant_id = ur.restaurant_id
  GROUP BY p.id, p.full_name, p.avatar_url
  ORDER BY mutual_friends_count DESC, common_restaurants DESC
  LIMIT 10;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_guarantee_settings
CREATE OR REPLACE FUNCTION public.get_guarantee_settings(p_restaurant_id uuid, p_booking_time timestamp with time zone, p_party_size integer)
 RETURNS TABLE(setting_id uuid, guarantee_required boolean, no_show_fee numeric, late_cancel_fee numeric, fee_type text, currency text, total_no_show_fee numeric, total_late_cancel_fee numeric, applied_multiplier numeric, override_amount numeric, matched_rule jsonb)
 LANGUAGE plpgsql
 STABLE
AS $$
DECLARE
  v_settings record;
  v_schedule_result jsonb;
  v_is_required boolean;
  v_matched_rule jsonb;
  v_multiplier numeric;
  v_override numeric;
  v_calculated_no_show numeric;
  v_calculated_late_cancel numeric;
BEGIN
  SELECT * INTO v_settings
  FROM public.card_guarantee_settings cgs
  WHERE cgs.restaurant_id = p_restaurant_id AND cgs.enabled = true;

  IF v_settings IS NULL THEN
    RETURN QUERY SELECT null::uuid, false::boolean, 0::numeric, 0::numeric, 'per_cover'::text, 'USD'::text, 0::numeric, 0::numeric, 1.0::numeric, null::numeric, null::jsonb;
    RETURN;
  END IF;

  IF p_party_size < v_settings.minimum_party_size THEN
    RETURN QUERY SELECT v_settings.id, false::boolean, v_settings.no_show_fee, v_settings.late_cancel_fee, v_settings.fee_type, v_settings.currency, 0::numeric, 0::numeric, 1.0::numeric, null::numeric, null::jsonb;
    RETURN;
  END IF;

  v_schedule_result := public.check_guarantee_schedule_with_rule(p_restaurant_id, p_booking_time, p_party_size);
  v_is_required := (v_schedule_result ->> 'required')::boolean;
  v_matched_rule := v_schedule_result -> 'matched_rule';

  IF NOT v_is_required THEN
    RETURN QUERY SELECT v_settings.id, false::boolean, v_settings.no_show_fee, v_settings.late_cancel_fee, v_settings.fee_type, v_settings.currency, 0::numeric, 0::numeric, 1.0::numeric, null::numeric, v_matched_rule;
    RETURN;
  END IF;

  v_multiplier := COALESCE((v_matched_rule ->> 'deposit_multiplier')::numeric, (v_matched_rule ->> 'fee_multiplier')::numeric, 1.0);
  v_override := (v_matched_rule ->> 'override_amount')::numeric;

  IF v_override IS NOT NULL AND v_override > 0 THEN
    v_calculated_no_show := v_override;
    v_calculated_late_cancel := v_override;
  ELSE
    IF v_settings.fee_type = 'per_cover' THEN
      v_calculated_no_show := v_settings.no_show_fee * p_party_size * v_multiplier;
      v_calculated_late_cancel := v_settings.late_cancel_fee * p_party_size * v_multiplier;
    ELSE
      v_calculated_no_show := v_settings.no_show_fee * v_multiplier;
      v_calculated_late_cancel := v_settings.late_cancel_fee * v_multiplier;
    END IF;
  END IF;

  RETURN QUERY SELECT v_settings.id, true::boolean, v_settings.no_show_fee, v_settings.late_cancel_fee, v_settings.fee_type, v_settings.currency, v_calculated_no_show, v_calculated_late_cancel, v_multiplier, v_override, v_matched_rule;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_high_value_users_count
CREATE OR REPLACE FUNCTION public.get_high_value_users_count()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO result
  FROM (
    SELECT user_id
    FROM bookings
    WHERE user_id IS NOT NULL
      AND status != 'payment_pending'
    GROUP BY user_id
    HAVING COUNT(*) >= 10
  ) AS high_value;

  RETURN COALESCE(result, 0);
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_loyalty_summary
CREATE OR REPLACE FUNCTION public.get_loyalty_summary(p_user_id uuid)
 RETURNS TABLE(total_points integer, current_tier text, points_to_next_tier integer, total_earned integer, total_redeemed integer, active_redemptions integer, tier_benefits jsonb)
 LANGUAGE plpgsql
AS $$
DECLARE
  v_profile RECORD;
  v_total_earned INTEGER;
  v_total_redeemed INTEGER;
  v_active_redemptions INTEGER;
  v_points_to_next INTEGER;
  v_benefits JSONB;
BEGIN
  -- Get profile data
  SELECT loyalty_points, membership_tier 
  INTO v_profile
  FROM public.profiles 
  WHERE id = p_user_id;
  
  -- Calculate total points earned
  SELECT COALESCE(SUM(points_earned), 0) 
  INTO v_total_earned
  FROM public.loyalty_activities 
  WHERE user_id = p_user_id AND points_earned > 0;
  
  -- Calculate total points redeemed
  SELECT COALESCE(SUM(points_cost), 0) 
  INTO v_total_redeemed
  FROM public.loyalty_redemptions 
  WHERE user_id = p_user_id;
  
  -- Count active redemptions
  SELECT COUNT(*) 
  INTO v_active_redemptions
  FROM public.loyalty_redemptions 
  WHERE user_id = p_user_id AND status = 'active' AND expires_at > NOW();
  
  -- Calculate points to next tier
  v_points_to_next := CASE
    WHEN v_profile.membership_tier = 'bronze' THEN 500 - v_profile.loyalty_points
    WHEN v_profile.membership_tier = 'silver' THEN 1500 - v_profile.loyalty_points
    WHEN v_profile.membership_tier = 'gold' THEN 3000 - v_profile.loyalty_points
    ELSE 0
  END;
  
  -- Get tier benefits
  SELECT jsonb_agg(
    jsonb_build_object(
      'type', benefit_type,
      'value', benefit_value,
      'description', description
    )
  ) INTO v_benefits
  FROM public.tier_benefits
  WHERE tier = v_profile.membership_tier AND is_active = true;
  
  RETURN QUERY SELECT 
    v_profile.loyalty_points,
    v_profile.membership_tier,
    GREATEST(0, v_points_to_next),
    v_total_earned,
    v_total_redeemed,
    v_active_redemptions,
    COALESCE(v_benefits, '[]'::jsonb);
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_notification_analytics
CREATE OR REPLACE FUNCTION public.get_notification_analytics(p_start_date timestamp with time zone DEFAULT (now() - '30 days'::interval), p_end_date timestamp with time zone DEFAULT now())
 RETURNS TABLE(total_sent bigint, total_delivered bigint, total_clicked bigint, total_failed bigint, delivery_rate numeric, click_rate numeric, avg_time_to_click_seconds numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'sent')::BIGINT as total_sent,
    COUNT(*) FILTER (WHERE delivered_at IS NOT NULL)::BIGINT as total_delivered,
    COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::BIGINT as total_clicked,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as total_failed,
    CASE 
      WHEN COUNT(*) FILTER (WHERE status = 'sent') > 0 
      THEN ROUND(COUNT(*) FILTER (WHERE delivered_at IS NOT NULL)::NUMERIC / COUNT(*) FILTER (WHERE status = 'sent') * 100, 2)
      ELSE 0 
    END as delivery_rate,
    CASE 
      WHEN COUNT(*) FILTER (WHERE delivered_at IS NOT NULL) > 0 
      THEN ROUND(COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::NUMERIC / COUNT(*) FILTER (WHERE delivered_at IS NOT NULL) * 100, 2)
      ELSE 0 
    END as click_rate,
    ROUND(AVG(EXTRACT(EPOCH FROM (clicked_at - sent_at))) FILTER (WHERE clicked_at IS NOT NULL AND sent_at IS NOT NULL), 2) as avg_time_to_click_seconds
  FROM notification_outbox
  WHERE created_at BETWEEN p_start_date AND p_end_date;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_notifications_to_repeat
CREATE OR REPLACE FUNCTION public.get_notifications_to_repeat()
 RETURNS TABLE(outbox_id uuid, restaurant_id uuid, booking_id uuid, type text, title text, body text, data jsonb, repeat_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id, o.restaurant_id, o.booking_id, o.type,
        o.title, o.body, o.data, o.repeat_count
    FROM public.restaurant_notification_outbox o
    WHERE
        o.repeat_enabled = true
        AND o.status = 'sent'
        AND o.repeat_until > NOW()
        AND (
            o.last_repeat_at IS NULL
            OR o.last_repeat_at < NOW() - (o.repeat_interval || ' seconds')::interval
        )
    ORDER BY o.created_at ASC
    LIMIT 50;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_pending_bookings_count
CREATE OR REPLACE FUNCTION public.get_pending_bookings_count(p_restaurant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM bookings
  WHERE restaurant_id = p_restaurant_id
    AND status = 'pending'
    AND created_at >= (now() - interval '2 hours');
    
  RETURN v_count;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_pending_deposit_status
CREATE OR REPLACE FUNCTION public.get_pending_deposit_status(p_booking_id uuid)
 RETURNS TABLE(booking_id uuid, deposit_status text, pending_since timestamp with time zone, seconds_remaining integer, is_expired boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $$
DECLARE
  v_booking record;
  v_expiry_minutes integer := 15; -- Default expiry time
  v_expiry_threshold timestamptz;
  v_seconds_remaining integer;
BEGIN
  -- Get booking info
  SELECT b.id, b.deposit_status, b.updated_at, b.user_id
  INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id;
  
  -- Check if booking exists and belongs to user
  IF v_booking IS NULL THEN
    RETURN;
  END IF;
  
  -- Only return status for authenticated user's bookings
  IF v_booking.user_id != auth.uid() THEN
    RETURN;
  END IF;
  
  -- Calculate expiry threshold
  v_expiry_threshold := v_booking.updated_at + (v_expiry_minutes || ' minutes')::interval;
  v_seconds_remaining := GREATEST(0, EXTRACT(EPOCH FROM (v_expiry_threshold - NOW()))::integer);
  
  booking_id := v_booking.id;
  deposit_status := v_booking.deposit_status;
  pending_since := v_booking.updated_at;
  seconds_remaining := v_seconds_remaining;
  is_expired := v_seconds_remaining <= 0 AND v_booking.deposit_status = 'pending';
  
  RETURN NEXT;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_pending_receipts
CREATE OR REPLACE FUNCTION public.get_pending_receipts(p_limit integer DEFAULT 100)
 RETURNS TABLE(outbox_id uuid, receipt_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT no.id as outbox_id, no.expo_receipt_id as receipt_id
  FROM notification_outbox no
  WHERE no.expo_receipt_id IS NOT NULL
    AND no.delivered_at IS NULL
    AND no.status = 'sent'
    AND no.sent_at > NOW() - INTERVAL '24 hours' -- Only check recent sends
  ORDER BY no.sent_at ASC
  LIMIT p_limit;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_personalized_recommendations
CREATE OR REPLACE FUNCTION public.get_personalized_recommendations(p_user_id uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_max_distance_km double precision DEFAULT 10.0)
 RETURNS TABLE(restaurant_id uuid, name text, cuisine_type text, secondary_cuisines text[], average_rating numeric, main_image_url text, address text, price_range integer, location geography, distance_km double precision, score numeric, reason text, featured boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_favorite_cuisines text[];
  v_dietary_restrictions text[];
  v_booked_restaurant_ids uuid[];
BEGIN
  SELECT
    COALESCE(p.favorite_cuisines, ARRAY[]::text[]),
    COALESCE(p.dietary_restrictions, ARRAY[]::text[])
  INTO v_favorite_cuisines, v_dietary_restrictions
  FROM profiles p
  WHERE p.id = p_user_id;

  SELECT ARRAY_AGG(DISTINCT b.restaurant_id)
  INTO v_booked_restaurant_ids
  FROM bookings b
  WHERE b.user_id = p_user_id
    AND b.booking_time >= NOW() - INTERVAL '90 days'
    AND b.status IN ('confirmed', 'completed');

  IF v_booked_restaurant_ids IS NULL THEN
    v_booked_restaurant_ids := ARRAY[]::uuid[];
  END IF;

  RETURN QUERY
  WITH scored_restaurants AS (
    SELECT
      r.id AS restaurant_id,
      r.name,
      r.cuisine_type,
      r.secondary_cuisines,
      r.average_rating,
      r.main_image_url,
      r.address,
      r.price_range,
      r.location,
      r.featured,
      CASE
        WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND r.location IS NOT NULL THEN
          ST_Distance(
            r.location::geography,
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
          ) / 1000.0
        ELSE NULL
      END AS distance_km,
      (
        CASE
          WHEN r.cuisine_type = ANY(v_favorite_cuisines) THEN 30
          WHEN r.secondary_cuisines && v_favorite_cuisines THEN 20
          ELSE 0
        END
        +
        CASE
          WHEN r.average_rating >= 4.5 THEN 15
          WHEN r.average_rating >= 4.0 THEN 12
          WHEN r.average_rating >= 3.5 THEN 8
          WHEN r.average_rating >= 3.0 THEN 4
          ELSE 0
        END
        +
        CASE
          WHEN NOT (r.id = ANY(v_booked_restaurant_ids)) THEN 10
          ELSE 0
        END
        +
        CASE
          WHEN r.featured = true THEN 5
          ELSE 0
        END
        +
        CASE
          WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND r.location IS NOT NULL THEN
            GREATEST(0, 10 - (
              ST_Distance(
                r.location::geography,
                ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
              ) / 1000.0
            ))
          ELSE 0
        END
        +
        COALESCE((
          SELECT LEAST(10, COUNT(*)::numeric)
          FROM bookings b2
          WHERE b2.restaurant_id = r.id
            AND b2.booking_time >= NOW() - INTERVAL '7 days'
            AND b2.status IN ('confirmed', 'completed')
        ), 0)
        +
        (random() * 5)
      )::numeric AS score,
      CASE
        WHEN r.cuisine_type = ANY(v_favorite_cuisines) THEN 'Matches your favorite cuisine'
        WHEN r.secondary_cuisines && v_favorite_cuisines THEN 'Serves cuisine you love'
        WHEN r.average_rating >= 4.5 THEN 'Highly rated'
        WHEN r.featured = true THEN 'Featured restaurant'
        ELSE 'Popular near you'
      END AS reason
    FROM restaurants r
    WHERE r.status = 'active'
      AND (
        p_lat IS NULL OR p_lng IS NULL OR r.location IS NULL
        OR ST_DWithin(
          r.location::geography,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
          p_max_distance_km * 1000
        )
      )
  )
  SELECT
    sr.restaurant_id,
    sr.name,
    sr.cuisine_type,
    sr.secondary_cuisines,
    sr.average_rating,
    sr.main_image_url,
    sr.address,
    sr.price_range,
    sr.location,
    sr.distance_km,
    sr.score,
    sr.reason,
    sr.featured
  FROM scored_restaurants sr
  ORDER BY sr.score DESC
  LIMIT p_limit
  OFFSET p_offset;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_profile_aggregates
CREATE OR REPLACE FUNCTION public.get_profile_aggregates()
 RETURNS TABLE(avg_rating numeric, total_loyalty_points bigint, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(AVG(user_rating), 0)::NUMERIC AS avg_rating,
    COALESCE(SUM(loyalty_points), 0)::BIGINT AS total_loyalty_points,
    COUNT(*)::BIGINT AS total_count
  FROM profiles;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_restaurant_menu
CREATE OR REPLACE FUNCTION public.get_restaurant_menu(p_restaurant_id uuid)
 RETURNS TABLE(category_id uuid, category_name text, category_description text, category_order integer, items json)
 LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.description,
    c.display_order,
    COALESCE(
      json_agg(
        json_build_object(
          'id', i.id,
          'name', i.name,
          'description', i.description,
          'price', i.price,
          'image_url', i.image_url,
          'dietary_tags', i.dietary_tags,
          'allergens', i.allergens,
          'calories', i.calories,
          'preparation_time', i.preparation_time,
          'is_available', i.is_available,
          'is_featured', i.is_featured,
          'display_order', i.display_order
        ) ORDER BY i.display_order, i.name
      ) FILTER (WHERE i.id IS NOT NULL),
      '[]'::json
    ) as items
  FROM public.menu_categories c
  LEFT JOIN public.menu_items i 
    ON c.id = i.category_id 
    AND i.is_available = true
  WHERE c.restaurant_id = p_restaurant_id
    AND c.is_active = true
  GROUP BY c.id, c.name, c.description, c.display_order
  ORDER BY c.display_order, c.name;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_restaurant_shared_tables_summary
CREATE OR REPLACE FUNCTION public.get_restaurant_shared_tables_summary(restaurant_id_param uuid, target_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(table_id uuid, table_number text, capacity integer, section_name text, current_occupancy integer, total_bookings_today integer, revenue_today numeric, peak_occupancy_time time without time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rt.id as table_id,
        rt.table_number,
        rt.capacity,
        COALESCE(rs.name, 'No Section') as section_name,
        -- Current occupancy (active bookings right now)
        COALESCE((
            SELECT SUM(bt2.seats_occupied)
            FROM booking_tables bt2
            JOIN bookings b2 ON bt2.booking_id = b2.id
            WHERE bt2.table_id = rt.id
            AND b2.status IN ('arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert')
            AND b2.booking_time <= NOW()
            AND (b2.booking_time + COALESCE(b2.turn_time_minutes, 120) * INTERVAL '1 minute') >= NOW()
        ), 0)::INTEGER as current_occupancy,
        -- Total bookings today
        COALESCE((
            SELECT COUNT(*)
            FROM booking_tables bt3
            JOIN bookings b3 ON bt3.booking_id = b3.id
            WHERE bt3.table_id = rt.id
            AND b3.booking_time::DATE = target_date
            AND b3.is_shared_booking = TRUE
        ), 0)::INTEGER as total_bookings_today,
        -- Revenue today (estimated based on average spend)
        COALESCE((
            SELECT SUM(b4.party_size * 35.00) -- Estimated $35 per person
            FROM booking_tables bt4
            JOIN bookings b4 ON bt4.booking_id = b4.id
            WHERE bt4.table_id = rt.id
            AND b4.booking_time::DATE = target_date
            AND b4.status = 'completed'
            AND b4.is_shared_booking = TRUE
        ), 0)::DECIMAL as revenue_today,
        -- Peak occupancy time
        (
            SELECT b5.booking_time::TIME
            FROM booking_tables bt5
            JOIN bookings b5 ON bt5.booking_id = b5.id
            WHERE bt5.table_id = rt.id
            AND b5.booking_time::DATE = target_date
            AND b5.is_shared_booking = TRUE
            GROUP BY b5.booking_time::TIME
            ORDER BY SUM(bt5.seats_occupied) DESC
            LIMIT 1
        ) as peak_occupancy_time
    FROM restaurant_tables rt
    LEFT JOIN restaurant_sections rs ON rt.section_id = rs.id
    WHERE rt.restaurant_id = restaurant_id_param
    AND rt.table_type = 'shared'
    AND rt.is_active = TRUE
    ORDER BY rt.table_number;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_restaurant_status
CREATE OR REPLACE FUNCTION public.get_restaurant_status(p_restaurant_id uuid, p_check_time timestamp with time zone DEFAULT now())
 RETURNS TABLE(is_open boolean, reason text, open_time time without time zone, close_time time without time zone)
 LANGUAGE plpgsql
AS $$
DECLARE
  v_date DATE;
  v_time TIME;
  v_day_of_week TEXT;
BEGIN
  v_date := p_check_time::DATE;
  v_time := p_check_time::TIME;
  v_day_of_week := LOWER(to_char(p_check_time, 'Day'));
  v_day_of_week := TRIM(v_day_of_week);
  
  -- Check closures first
  IF EXISTS (
    SELECT 1 FROM restaurant_closures rc
    WHERE rc.restaurant_id = p_restaurant_id
    AND v_date BETWEEN rc.start_date AND rc.end_date
  ) THEN
    RETURN QUERY
    SELECT 
      false::BOOLEAN,
      rc.reason,
      NULL::TIME,
      NULL::TIME
    FROM restaurant_closures rc
    WHERE rc.restaurant_id = p_restaurant_id
    AND v_date BETWEEN rc.start_date AND rc.end_date
    LIMIT 1;
    RETURN;
  END IF;
  
  -- Check special hours
  IF EXISTS (
    SELECT 1 FROM restaurant_special_hours rsh
    WHERE rsh.restaurant_id = p_restaurant_id
    AND rsh.date = v_date
  ) THEN
    RETURN QUERY
    SELECT 
      CASE WHEN rsh.is_closed THEN false 
           ELSE v_time BETWEEN rsh.open_time AND rsh.close_time 
      END,
      rsh.reason,
      rsh.open_time,
      rsh.close_time
    FROM restaurant_special_hours rsh
    WHERE rsh.restaurant_id = p_restaurant_id
    AND rsh.date = v_date
    LIMIT 1;
    RETURN;
  END IF;
  
  -- Check regular hours
  RETURN QUERY
  SELECT 
    CASE WHEN rh.is_open THEN v_time BETWEEN rh.open_time AND rh.close_time 
         ELSE false 
    END,
    CASE WHEN NOT rh.is_open THEN 'Closed on ' || v_day_of_week 
         ELSE NULL 
    END,
    rh.open_time,
    rh.close_time
  FROM restaurant_hours rh
  WHERE rh.restaurant_id = p_restaurant_id
  AND rh.day_of_week = v_day_of_week
  LIMIT 1;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_restaurant_waitlist_schedules
CREATE OR REPLACE FUNCTION public.get_restaurant_waitlist_schedules(restaurant_id_param uuid)
 RETURNS TABLE(id uuid, waitlist_date date, start_time time without time zone, end_time time without time zone, is_active boolean, name text, notes text, max_entries_per_hour integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        rws.id,
        rws.waitlist_date,
        rws.start_time,
        rws.end_time,
        rws.is_active,
        rws.name,
        rws.notes,
        rws.max_entries_per_hour,
        rws.created_at
    FROM public.restaurant_waitlist_schedules rws
    WHERE rws.restaurant_id = restaurant_id_param
    ORDER BY rws.waitlist_date DESC, rws.start_time;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_restaurants_with_coordinates
CREATE OR REPLACE FUNCTION public.get_restaurants_with_coordinates(p_limit integer DEFAULT NULL::integer, p_featured boolean DEFAULT NULL::boolean, p_cuisine_type text DEFAULT NULL::text, p_min_rating numeric DEFAULT NULL::numeric)
 RETURNS TABLE(id uuid, name text, description text, address text, main_image_url text, image_urls text[], cuisine_type text, tags text[], opening_time time without time zone, closing_time time without time zone, booking_policy text, price_range integer, average_rating numeric, total_reviews integer, phone_number text, whatsapp_number text, instagram_handle text, menu_url text, dietary_options text[], ambiance_tags text[], parking_available boolean, valet_parking boolean, outdoor_seating boolean, shisha_available boolean, live_music_schedule jsonb, happy_hour_times jsonb, booking_window_days integer, cancellation_window_hours integer, table_turnover_minutes integer, created_at timestamp with time zone, updated_at timestamp with time zone, featured boolean, website_url text, review_summary jsonb, ai_featured boolean, status text, request_expiry_hours integer, auto_decline_enabled boolean, max_party_size integer, min_party_size integer, tier restaurant_tier, latitude double precision, longitude double precision)
 LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.description,
    r.address,
    r.main_image_url,
    r.image_urls,
    r.cuisine_type,
    r.tags,
    r.opening_time,
    r.closing_time,
    r.booking_policy,
    r.price_range,
    r.average_rating,
    r.total_reviews,
    r.phone_number,
    r.whatsapp_number,
    r.instagram_handle,
    r.menu_url,
    r.dietary_options,
    r.ambiance_tags,
    r.parking_available,
    r.valet_parking,
    r.outdoor_seating,
    r.shisha_available,
    r.live_music_schedule,
    r.happy_hour_times,
    r.booking_window_days,
    r.cancellation_window_hours,
    r.table_turnover_minutes,
    r.created_at,
    r.updated_at,
    r.featured,
    r.website_url,
    r.review_summary,
    r.ai_featured,
    r.status,
    r.request_expiry_hours,
    r.auto_decline_enabled,
    r.max_party_size,
    r.min_party_size,
    r.tier,
    ST_Y(r.location)::DOUBLE PRECISION as latitude,
    ST_X(r.location)::DOUBLE PRECISION as longitude
  FROM restaurants r
  WHERE (r.status = 'active' OR r.status IS NULL)
    AND (p_featured IS NULL OR r.featured = p_featured)
    AND (p_cuisine_type IS NULL OR r.cuisine_type = p_cuisine_type)
    AND (p_min_rating IS NULL OR r.average_rating >= p_min_rating)
  ORDER BY 
    r.featured DESC NULLS LAST,
    r.average_rating DESC NULLS LAST,
    r.total_reviews DESC NULLS LAST,
    r.created_at DESC
  LIMIT p_limit;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_retry_eligible_notifications
CREATE OR REPLACE FUNCTION public.get_retry_eligible_notifications(p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, user_id uuid, channel text, payload jsonb, attempts integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT no.id, no.user_id, no.channel, no.payload, no.attempts
  FROM notification_outbox no
  WHERE no.status = 'failed'
    AND no.retry_count < 3
    AND no.created_at > NOW() - INTERVAL '24 hours'
  ORDER BY no.created_at ASC
  LIMIT p_limit;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_section_availability
CREATE OR REPLACE FUNCTION public.get_section_availability(p_restaurant_id uuid, p_booking_time timestamp with time zone, p_party_size integer, p_turn_time integer DEFAULT 90)
 RETURNS TABLE(section_id uuid, section_name text, section_color text, section_icon text, section_description text, display_order integer, total_tables bigint, available_tables bigint, has_matching_tables boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_booking_end_time timestamptz;
BEGIN
  v_booking_end_time := p_booking_time + (p_turn_time || ' minutes')::interval;

  RETURN QUERY
  SELECT
    rs.id,
    rs.name,
    rs.color,
    rs.icon,
    rs.description,
    rs.display_order,
    COUNT(rt.id) FILTER (
      WHERE rt.min_capacity <= p_party_size
        AND rt.max_capacity >= p_party_size
    )::bigint AS total_tables,
    COUNT(rt.id) FILTER (
      WHERE rt.min_capacity <= p_party_size
        AND rt.max_capacity >= p_party_size
        AND NOT EXISTS (
          SELECT 1
          FROM booking_tables bt
          JOIN bookings b ON b.id = bt.booking_id
          WHERE bt.table_id = rt.id
            AND b.status IN ('confirmed', 'pending', 'arrived', 'seated')
            AND b.booking_time < v_booking_end_time
            AND (b.booking_time + (b.turn_time_minutes || ' minutes')::interval) > p_booking_time
        )
    )::bigint AS available_tables,
    (COUNT(rt.id) FILTER (
      WHERE rt.min_capacity <= p_party_size
        AND rt.max_capacity >= p_party_size
        AND NOT EXISTS (
          SELECT 1
          FROM booking_tables bt
          JOIN bookings b ON b.id = bt.booking_id
          WHERE bt.table_id = rt.id
            AND b.status IN ('confirmed', 'pending', 'arrived', 'seated')
            AND b.booking_time < v_booking_end_time
            AND (b.booking_time + (b.turn_time_minutes || ' minutes')::interval) > p_booking_time
        )
    ) > 0) AS has_matching_tables
  FROM restaurant_sections rs
  LEFT JOIN restaurant_tables rt
    ON rt.section_id = rs.id AND rt.is_active = true
  WHERE rs.restaurant_id = p_restaurant_id
    AND rs.is_active = true
  GROUP BY rs.id, rs.name, rs.color, rs.icon, rs.description, rs.display_order
  ORDER BY rs.display_order;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_shared_table_available_seats
CREATE OR REPLACE FUNCTION public.get_shared_table_available_seats(table_id_param uuid, booking_time_param timestamp with time zone, turn_time_minutes_param integer DEFAULT 120)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    table_capacity INTEGER;
    occupied_seats INTEGER;
    booking_start TIMESTAMP WITH TIME ZONE;
    booking_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get table capacity
    SELECT capacity INTO table_capacity
    FROM public.restaurant_tables 
    WHERE id = table_id_param AND table_type = 'shared';
    
    IF table_capacity IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Calculate time window for overlapping bookings
    booking_start := booking_time_param;
    booking_end := booking_time_param + (turn_time_minutes_param || ' minutes')::INTERVAL;
    
    -- Calculate currently occupied seats for this time window
    SELECT COALESCE(SUM(bt.seats_occupied), 0) INTO occupied_seats
    FROM public.booking_tables bt
    JOIN public.bookings b ON bt.booking_id = b.id
    WHERE bt.table_id = table_id_param
    AND b.status IN ('pending', 'confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert')
    AND b.booking_time < booking_end
    AND (b.booking_time + COALESCE(b.turn_time_minutes, turn_time_minutes_param) * INTERVAL '1 minute') > booking_start;
    
    RETURN GREATEST(0, table_capacity - occupied_seats);
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_table_availability_by_hour
CREATE OR REPLACE FUNCTION public.get_table_availability_by_hour(p_restaurant_id uuid, p_date date)
 RETURNS TABLE(hour integer, total_tables integer, available_tables integer, utilization_percentage integer)
 LANGUAGE plpgsql
AS $$
DECLARE
  restaurant_tier tier;
BEGIN
  -- Get the restaurant's tier
  SELECT r.tier INTO restaurant_tier
  FROM restaurants r
  WHERE r.id = p_restaurant_id;

  -- If restaurant tier is 'basic', show all tables as available during operating hours
  IF restaurant_tier = 'basic' THEN
    RETURN QUERY
    WITH hours AS (
      SELECT generate_series(11, 22) AS hour -- 11 AM to 10 PM
    ),
    restaurant_tables AS (
      SELECT COUNT(*) AS total_count
      FROM restaurant_tables
      WHERE restaurant_id = p_restaurant_id AND is_active = true
    ),
    restaurant_hours AS (
      SELECT 
        EXTRACT(HOUR FROM r.opening_time)::INTEGER AS open_hour,
        EXTRACT(HOUR FROM r.closing_time)::INTEGER AS close_hour
      FROM restaurants r
      WHERE r.id = p_restaurant_id
    )
    SELECT 
      h.hour,
      rt.total_count::INTEGER AS total_tables,
      CASE 
        WHEN h.hour >= rh.open_hour AND h.hour < rh.close_hour 
        THEN rt.total_count::INTEGER 
        ELSE 0 
      END AS available_tables,
      CASE 
        WHEN h.hour >= rh.open_hour AND h.hour < rh.close_hour 
        THEN 0  -- 0% utilization for basic tier (all tables available)
        ELSE 100  -- 100% utilization outside hours (no tables available)
      END AS utilization_percentage
    FROM hours h
    CROSS JOIN restaurant_tables rt
    CROSS JOIN restaurant_hours rh
    ORDER BY h.hour;
  ELSE
    -- For 'pro' and higher tiers, use real availability checking
    RETURN QUERY
    WITH hours AS (
      SELECT generate_series(11, 22) AS hour -- 11 AM to 10 PM
    ),
    restaurant_tables AS (
      SELECT COUNT(*) AS total_count
      FROM restaurant_tables
      WHERE restaurant_id = p_restaurant_id AND is_active = true
    ),
    hourly_bookings AS (
      SELECT 
        EXTRACT(HOUR FROM b.booking_time)::INTEGER AS booking_hour,
        COUNT(DISTINCT bt.table_id) AS booked_tables
      FROM bookings b
      INNER JOIN booking_tables bt ON b.id = bt.booking_id
      WHERE b.restaurant_id = p_restaurant_id
        AND DATE(b.booking_time) = p_date
        AND b.status NOT IN ('cancelled_by_user', 'declined_by_restaurant', 'no_show')
      GROUP BY booking_hour
    )
    SELECT 
      h.hour,
      rt.total_count::INTEGER AS total_tables,
      (rt.total_count - COALESCE(hb.booked_tables, 0))::INTEGER AS available_tables,
      CASE 
        WHEN rt.total_count > 0 
        THEN ((COALESCE(hb.booked_tables, 0)::FLOAT / rt.total_count) * 100)::INTEGER
        ELSE 0 
      END AS utilization_percentage
    FROM hours h
    CROSS JOIN restaurant_tables rt
    LEFT JOIN hourly_bookings hb ON h.hour = hb.booking_hour
    ORDER BY h.hour;
  END IF;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_table_utilization_report
CREATE OR REPLACE FUNCTION public.get_table_utilization_report(p_restaurant_id uuid, p_start_date date DEFAULT (CURRENT_DATE - '30 days'::interval), p_end_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH utilization_data AS (
    SELECT 
      rt.id as table_id,
      rt.table_number,
      rt.capacity,
      COUNT(DISTINCT b.id) as total_bookings,
      COUNT(DISTINCT DATE(b.booking_time)) as days_used,
      AVG(b.party_size::float / rt.capacity) as avg_utilization_rate,
      SUM(b.party_size) as total_guests_served,
      AVG(b.turn_time_minutes) as avg_turn_time
    FROM restaurant_tables rt
    LEFT JOIN booking_tables bt ON rt.id = bt.table_id
    LEFT JOIN bookings b ON bt.booking_id = b.id
      AND b.status = 'completed'
      AND b.booking_time >= p_start_date
      AND b.booking_time < p_end_date + INTERVAL '1 day'
    WHERE rt.restaurant_id = p_restaurant_id
    GROUP BY rt.id, rt.table_number, rt.capacity
  ),
  peak_hours AS (
    SELECT 
      EXTRACT(HOUR FROM b.booking_time) as hour,
      COUNT(*) as booking_count
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.status = 'completed'
      AND b.booking_time >= p_start_date
      AND b.booking_time < p_end_date + INTERVAL '1 day'
    GROUP BY EXTRACT(HOUR FROM b.booking_time)
    ORDER BY booking_count DESC
    LIMIT 3
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    ),
    'table_stats', jsonb_agg(
      jsonb_build_object(
        'table_number', table_number,
        'capacity', capacity,
        'total_bookings', total_bookings,
        'days_used', days_used,
        'utilization_rate', ROUND(avg_utilization_rate * 100, 2),
        'total_guests', total_guests_served,
        'avg_turn_time_minutes', ROUND(avg_turn_time)
      ) ORDER BY avg_utilization_rate DESC NULLS LAST
    ),
    'peak_hours', (SELECT jsonb_agg(hour ORDER BY hour) FROM peak_hours),
    'summary', jsonb_build_object(
      'total_tables', COUNT(*),
      'avg_utilization', ROUND(AVG(avg_utilization_rate) * 100, 2),
      'total_bookings', SUM(total_bookings),
      'total_guests', SUM(total_guests_served)
    )
  ) INTO v_result
  FROM utilization_data;
  
  RETURN v_result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_top_restaurants
CREATE OR REPLACE FUNCTION public.get_top_restaurants(p_restaurant_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, name text, tier tier, cuisine_type text, total_bookings bigint, completed_bookings bigint, total_covers numeric, completed_covers numeric, avg_party_size numeric, bookings_last_7d bigint, restaurant_revenue_est numeric)
 LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.tier,
    r.cuisine_type,
    COUNT(b.id)::bigint as total_bookings,
    COUNT(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN b.id END)::bigint as completed_bookings,
    COALESCE(SUM(b.party_size), 0) as total_covers,
    COALESCE(SUM(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN b.party_size ELSE 0 END), 0) as completed_covers,
    COALESCE(ROUND(AVG(b.party_size), 2), 0) as avg_party_size,
    COUNT(CASE WHEN b.created_at >= NOW() - INTERVAL '7 days' THEN b.id END)::bigint as bookings_last_7d,
    COALESCE(SUM(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN (r.price_range * 20) * b.party_size ELSE 0 END), 0) as restaurant_revenue_est
  FROM restaurants r
  LEFT JOIN bookings b ON r.id = b.restaurant_id
  WHERE (p_restaurant_id IS NULL OR r.id = p_restaurant_id)
    AND r.id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
  GROUP BY r.id, r.name, r.tier, r.cuisine_type, r.price_range
  ORDER BY completed_bookings DESC
  LIMIT p_limit;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_user_booking_counts
CREATE OR REPLACE FUNCTION public.get_user_booking_counts()
 RETURNS TABLE(user_id uuid, booking_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.user_id,
    COUNT(*)::BIGINT AS booking_count
  FROM bookings b
  WHERE b.user_id IS NOT NULL
    AND b.status != 'payment_pending'
  GROUP BY b.user_id;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_user_bookings_optimized
CREATE OR REPLACE FUNCTION public.get_user_bookings_optimized(p_user_id uuid, p_fetch_upcoming boolean DEFAULT true, p_fetch_past boolean DEFAULT true, p_past_limit integer DEFAULT 10, p_past_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_result JSONB;
  v_upcoming JSONB;
  v_past JSONB;
BEGIN
  -- Initialize result structure
  v_result := jsonb_build_object(
    'upcoming', '[]'::jsonb,
    'past', '[]'::jsonb,
    'has_more_past', false
  );

  -- Fetch upcoming bookings (owned + invited + waitlist)
  IF p_fetch_upcoming THEN
    WITH owned_upcoming AS (
      SELECT 
        b.*,
        jsonb_build_object(
          'id', r.id,
          'name', r.name,
          'main_image_url', r.main_image_url,
          'address', r.address,
          'cuisine_type', r.cuisine_type,
          'average_rating', r.average_rating
        ) as restaurant,
        NULL::UUID as invitation_id,
        NULL::JSONB as invited_by,
        FALSE as is_invitee,
        FALSE as is_waitlist_entry,
        'booking'::TEXT as entry_type,
        NULL::DATE as desired_date,
        NULL::TEXT as desired_time_range,
        NULL::TEXT as table_type,
        NULL::BOOLEAN as is_scheduled_entry,
        NULL::TIMESTAMPTZ as expires_at,
        NULL::TIMESTAMPTZ as notification_expires_at,
        NULL::TIMESTAMPTZ as notified_at,
        NULL::UUID as converted_booking_id
      FROM bookings b
      INNER JOIN restaurants r ON b.restaurant_id = r.id
      WHERE b.user_id = p_user_id
        AND b.status IN ('pending', 'confirmed')
        AND b.booking_time >= v_now
    ),
    invited_upcoming AS (
      SELECT 
        b.*,
        jsonb_build_object(
          'id', r.id,
          'name', r.name,
          'main_image_url', r.main_image_url,
          'address', r.address,
          'cuisine_type', r.cuisine_type,
          'average_rating', r.average_rating
        ) as restaurant,
        bi.id as invitation_id,
        jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'avatar_url', p.avatar_url
        ) as invited_by,
        TRUE as is_invitee,
        FALSE as is_waitlist_entry,
        'booking'::TEXT as entry_type,
        NULL::DATE as desired_date,
        NULL::TEXT as desired_time_range,
        NULL::TEXT as table_type,
        NULL::BOOLEAN as is_scheduled_entry,
        NULL::TIMESTAMPTZ as expires_at,
        NULL::TIMESTAMPTZ as notification_expires_at,
        NULL::TIMESTAMPTZ as notified_at,
        NULL::UUID as converted_booking_id
      FROM booking_invites bi
      INNER JOIN bookings b ON bi.booking_id = b.id
      INNER JOIN restaurants r ON b.restaurant_id = r.id
      INNER JOIN profiles p ON bi.from_user_id = p.id
      WHERE bi.to_user_id = p_user_id
        AND bi.status = 'accepted'
        AND b.status IN ('pending', 'confirmed')
        AND b.booking_time >= v_now
    ),
    waitlist_upcoming AS (
      SELECT 
        w.id,
        w.user_id,
        w.restaurant_id,
        (w.desired_date || 'T' || COALESCE(
          SPLIT_PART(w.desired_time_range, '-', 1),
          SPLIT_PART(REPLACE(w.desired_time_range, '[', ''), ',', 1),
          '00:00'
        ) || ':00Z')::TIMESTAMPTZ as booking_time,
        w.party_size,
        w.status,
        w.special_requests,
        NULL::TEXT as occasion,
        NULL::TEXT[] as dietary_notes,
        NULL::TEXT as confirmation_code,
        NULL::TEXT[] as table_preferences,
        FALSE as reminder_sent,
        NULL::TIMESTAMPTZ as checked_in_at,
        0 as loyalty_points_earned,
        w.created_at,
        w.updated_at,
        NULL::UUID as applied_offer_id,
        0 as expected_loyalty_points,
        w.guest_name,
        w.guest_email,
        w.guest_phone,
        FALSE as is_group_booking,
        NULL::UUID as organizer_id,
        w.party_size as attendees,
        120 as turn_time_minutes,
        NULL::UUID as applied_loyalty_rule_id,
        NULL::TIMESTAMPTZ as actual_end_time,
        NULL::TIMESTAMPTZ as seated_at,
        NULL::JSONB as meal_progress,
        NULL::TIMESTAMPTZ as request_expires_at,
        FALSE as auto_declined,
        NULL::TIMESTAMPTZ as acceptance_attempted_at,
        NULL::TEXT as acceptance_failed_reason,
        NULL::TIMESTAMPTZ as suggested_alternative_time,
        NULL::TEXT[] as suggested_alternative_tables,
        'waitlist'::TEXT as source,
        FALSE as is_shared_booking,
        NULL::TEXT as decline_note,
        NULL::TEXT as preferred_section,
        NULL::TIMESTAMPTZ as cancelled_at,
        NULL::UUID as cancelled_by_staff,
        NULL::TEXT as cancellation_reason,
        NULL::TEXT as cancellation_note,
        NULL::TIMESTAMPTZ as declined_at,
        NULL::UUID as declined_by_staff,
        NULL::TEXT as declined_reason,
        jsonb_build_object(
          'id', r.id,
          'name', r.name,
          'main_image_url', r.main_image_url,
          'address', r.address,
          'cuisine_type', r.cuisine_type,
          'average_rating', r.average_rating,
          'tier', r.tier
        ) as restaurant,
        NULL::UUID as invitation_id,
        NULL::JSONB as invited_by,
        FALSE as is_invitee,
        TRUE as is_waitlist_entry,
        'waitlist'::TEXT as entry_type,
        w.desired_date,
        w.desired_time_range,
        w.table_type,
        w.is_scheduled_entry,
        w.expires_at,
        w.notification_expires_at,
        w.notified_at,
        w.converted_booking_id
      FROM waitlist w
      INNER JOIN restaurants r ON w.restaurant_id = r.id
      WHERE w.user_id = p_user_id
        AND w.status IN ('active', 'notified')
        AND w.desired_date >= CURRENT_DATE
    )
    SELECT jsonb_agg(
      to_jsonb(combined.*) ORDER BY combined.booking_time ASC
    )
    INTO v_upcoming
    FROM (
      SELECT * FROM owned_upcoming
      UNION ALL
      SELECT * FROM invited_upcoming
      UNION ALL
      SELECT * FROM waitlist_upcoming
    ) combined;

    v_result := jsonb_set(v_result, '{upcoming}', COALESCE(v_upcoming, '[]'::jsonb));
  END IF;

  -- Fetch past bookings (owned + invited + waitlist) with pagination
  IF p_fetch_past THEN
    WITH owned_past AS (
      SELECT 
        b.*,
        jsonb_build_object(
          'id', r.id,
          'name', r.name,
          'main_image_url', r.main_image_url,
          'address', r.address,
          'cuisine_type', r.cuisine_type,
          'average_rating', r.average_rating
        ) as restaurant,
        NULL::UUID as invitation_id,
        NULL::JSONB as invited_by,
        FALSE as is_invitee,
        FALSE as is_waitlist_entry,
        'booking'::TEXT as entry_type,
        NULL::DATE as desired_date,
        NULL::TEXT as desired_time_range,
        NULL::TEXT as table_type,
        NULL::BOOLEAN as is_scheduled_entry,
        NULL::TIMESTAMPTZ as expires_at,
        NULL::TIMESTAMPTZ as notification_expires_at,
        NULL::TIMESTAMPTZ as notified_at,
        NULL::UUID as converted_booking_id
      FROM bookings b
      INNER JOIN restaurants r ON b.restaurant_id = r.id
      WHERE b.user_id = p_user_id
        AND (
          b.booking_time < v_now
          OR b.status IN ('completed', 'cancelled_by_user', 'declined_by_restaurant', 
                         'cancelled_by_restaurant', 'auto_declined', 'no_show')
        )
    ),
    invited_past AS (
      SELECT 
        b.*,
        jsonb_build_object(
          'id', r.id,
          'name', r.name,
          'main_image_url', r.main_image_url,
          'address', r.address,
          'cuisine_type', r.cuisine_type,
          'average_rating', r.average_rating
        ) as restaurant,
        bi.id as invitation_id,
        jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'avatar_url', p.avatar_url
        ) as invited_by,
        TRUE as is_invitee,
        FALSE as is_waitlist_entry,
        'booking'::TEXT as entry_type,
        NULL::DATE as desired_date,
        NULL::TEXT as desired_time_range,
        NULL::TEXT as table_type,
        NULL::BOOLEAN as is_scheduled_entry,
        NULL::TIMESTAMPTZ as expires_at,
        NULL::TIMESTAMPTZ as notification_expires_at,
        NULL::TIMESTAMPTZ as notified_at,
        NULL::UUID as converted_booking_id
      FROM booking_invites bi
      INNER JOIN bookings b ON bi.booking_id = b.id
      INNER JOIN restaurants r ON b.restaurant_id = r.id
      INNER JOIN profiles p ON bi.from_user_id = p.id
      WHERE bi.to_user_id = p_user_id
        AND bi.status = 'accepted'
        AND (
          b.booking_time < v_now
          OR b.status IN ('completed', 'cancelled_by_user', 'declined_by_restaurant',
                         'cancelled_by_restaurant', 'auto_declined', 'no_show')
        )
    ),
    waitlist_past AS (
      SELECT 
        w.id,
        w.user_id,
        w.restaurant_id,
        (w.desired_date || 'T' || COALESCE(
          SPLIT_PART(w.desired_time_range, '-', 1),
          SPLIT_PART(REPLACE(w.desired_time_range, '[', ''), ',', 1),
          '00:00'
        ) || ':00Z')::TIMESTAMPTZ as booking_time,
        w.party_size,
        w.status,
        w.special_requests,
        NULL::TEXT as occasion,
        NULL::TEXT[] as dietary_notes,
        NULL::TEXT as confirmation_code,
        NULL::TEXT[] as table_preferences,
        FALSE as reminder_sent,
        NULL::TIMESTAMPTZ as checked_in_at,
        0 as loyalty_points_earned,
        w.created_at,
        w.updated_at,
        NULL::UUID as applied_offer_id,
        0 as expected_loyalty_points,
        w.guest_name,
        w.guest_email,
        w.guest_phone,
        FALSE as is_group_booking,
        NULL::UUID as organizer_id,
        w.party_size as attendees,
        120 as turn_time_minutes,
        NULL::UUID as applied_loyalty_rule_id,
        NULL::TIMESTAMPTZ as actual_end_time,
        NULL::TIMESTAMPTZ as seated_at,
        NULL::JSONB as meal_progress,
        NULL::TIMESTAMPTZ as request_expires_at,
        FALSE as auto_declined,
        NULL::TIMESTAMPTZ as acceptance_attempted_at,
        NULL::TEXT as acceptance_failed_reason,
        NULL::TIMESTAMPTZ as suggested_alternative_time,
        NULL::TEXT[] as suggested_alternative_tables,
        'waitlist'::TEXT as source,
        FALSE as is_shared_booking,
        NULL::TEXT as decline_note,
        NULL::TEXT as preferred_section,
        NULL::TIMESTAMPTZ as cancelled_at,
        NULL::UUID as cancelled_by_staff,
        NULL::TEXT as cancellation_reason,
        NULL::TEXT as cancellation_note,
        NULL::TIMESTAMPTZ as declined_at,
        NULL::UUID as declined_by_staff,
        NULL::TEXT as declined_reason,
        jsonb_build_object(
          'id', r.id,
          'name', r.name,
          'main_image_url', r.main_image_url,
          'address', r.address,
          'cuisine_type', r.cuisine_type,
          'average_rating', r.average_rating,
          'tier', r.tier
        ) as restaurant,
        NULL::UUID as invitation_id,
        NULL::JSONB as invited_by,
        FALSE as is_invitee,
        TRUE as is_waitlist_entry,
        'waitlist'::TEXT as entry_type,
        w.desired_date,
        w.desired_time_range,
        w.table_type,
        w.is_scheduled_entry,
        w.expires_at,
        w.notification_expires_at,
        w.notified_at,
        w.converted_booking_id
      FROM waitlist w
      INNER JOIN restaurants r ON w.restaurant_id = r.id
      WHERE w.user_id = p_user_id
        AND (
          w.status IN ('expired', 'cancelled', 'booked')
          OR w.desired_date < CURRENT_DATE
        )
    ),
    combined_past AS (
      SELECT * FROM owned_past
      UNION ALL
      SELECT * FROM invited_past
      UNION ALL
      SELECT * FROM waitlist_past
    ),
    ordered_past AS (
      SELECT 
        *,
        ROW_NUMBER() OVER (ORDER BY booking_time DESC) as rn
      FROM combined_past
    )
    SELECT 
      jsonb_agg(to_jsonb(ordered_past.*) ORDER BY booking_time DESC),
      COUNT(*) > (p_past_offset + p_past_limit)
    INTO v_past, v_result
    FROM ordered_past
    WHERE rn > p_past_offset AND rn <= (p_past_offset + p_past_limit);

    v_result := jsonb_set(v_result, '{past}', COALESCE(v_past, '[]'::jsonb));
  END IF;

  RETURN v_result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_user_devices
CREATE OR REPLACE FUNCTION public.get_user_devices(p_user_ids uuid[])
 RETURNS TABLE(user_id uuid, expo_push_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT ud.user_id, ud.expo_push_token
  FROM user_devices ud
  WHERE ud.user_id = ANY(p_user_ids)
    AND ud.enabled = true
    AND ud.expo_push_token IS NOT NULL;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_user_notification_preferences
CREATE OR REPLACE FUNCTION public.get_user_notification_preferences(p_user_id uuid)
 RETURNS user_notification_prefs
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    result user_notification_prefs;
    profile_prefs JSONB;
    table_prefs RECORD;
BEGIN
    -- First try to get from the notification_preferences table
    SELECT * INTO table_prefs 
    FROM public.notification_preferences 
    WHERE user_id = p_user_id;
    
    -- Get profile preferences as fallback
    SELECT notification_preferences INTO profile_prefs
    FROM public.profiles 
    WHERE id = p_user_id;
    
    -- Build the result with defaults, preferring table_prefs over profile_prefs
    result.push_notifications_enabled := COALESCE(
        (profile_prefs->>'push')::BOOLEAN,
        true
    );
    
    result.quiet_hours_enabled := COALESCE(
        (profile_prefs->'quiet_hours'->>'enabled')::BOOLEAN,
        false
    );
    
    result.quiet_hours_start := COALESCE(
        (profile_prefs->'quiet_hours'->>'start')::TIME,
        '22:00'::TIME
    );
    
    result.quiet_hours_end := COALESCE(
        (profile_prefs->'quiet_hours'->>'end')::TIME,
        '08:00'::TIME
    );
    
    -- Booking notifications
    result.booking_confirmations := COALESCE(table_prefs.booking, true);
    result.booking_reminders := COALESCE(table_prefs.booking_reminders, true);
    result.booking_cancellations := COALESCE(table_prefs.booking, true);
    result.booking_modifications := COALESCE(table_prefs.booking, true);
    
    -- Waitlist notifications
    result.waitlist_available := COALESCE(table_prefs.waitlist, true);
    result.waitlist_position_updates := COALESCE(table_prefs.waitlist, true);
    result.waitlist_expired := COALESCE(table_prefs.waitlist, true);
    
    -- Offer notifications
    result.special_offers := COALESCE(table_prefs.offers, true);
    result.loyalty_offers := COALESCE(table_prefs.offers, true);
    result.expiring_offers := COALESCE(table_prefs.offers, true);
    
    -- Review notifications
    result.review_reminders := COALESCE(table_prefs.reviews, true);
    result.review_responses := COALESCE(table_prefs.reviews, true);
    result.review_featured := COALESCE(table_prefs.reviews, true);
    
    -- Loyalty notifications
    result.points_earned := COALESCE(table_prefs.loyalty, true);
    result.milestone_reached := COALESCE(table_prefs.loyalty, true);
    result.rewards_available := COALESCE(table_prefs.loyalty, true);
    result.rewards_expiring := COALESCE(table_prefs.loyalty, true);
    
    -- System notifications
    result.app_updates := COALESCE(table_prefs.system, true);
    result.maintenance_notices := COALESCE(table_prefs.system, true);
    result.security_alerts := COALESCE(table_prefs.security, true);
    
    RETURN result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_user_offer_stats
CREATE OR REPLACE FUNCTION public.get_user_offer_stats(p_user_id uuid)
 RETURNS TABLE(total_claimed integer, active_offers integer, used_offers integer, expired_offers integer, total_savings numeric)
 LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_claimed,
    COUNT(*) FILTER (WHERE status = 'active' AND expires_at > NOW())::INTEGER as active_offers,
    COUNT(*) FILTER (WHERE status = 'used')::INTEGER as used_offers,
    COUNT(*) FILTER (WHERE status = 'expired' OR expires_at <= NOW())::INTEGER as expired_offers,
    COALESCE(SUM(
      CASE WHEN status = 'used' THEN 
        -- Estimate savings based on discount percentage (assuming average bill of $50)
        (so.discount_percentage::decimal / 100) * 50
      ELSE 0 END
    ), 0) as total_savings
  FROM public.user_offers uo
  JOIN public.special_offers so ON uo.offer_id = so.id
  WHERE uo.user_id = p_user_id;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_user_profile_stats
CREATE OR REPLACE FUNCTION public.get_user_profile_stats(p_user_id uuid)
 RETURNS TABLE(total_bookings bigint, completed_bookings bigint, cancelled_bookings bigint, upcoming_bookings bigint, total_favorites bigint, total_reviews bigint, most_visited_cuisine text, most_visited_restaurant_id uuid, most_visited_restaurant_name text, most_visited_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH booking_stats AS (
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'cancelled_by_user') as cancelled,
      COUNT(*) FILTER (WHERE status IN ('pending', 'confirmed') AND booking_time > NOW()) as upcoming
    FROM bookings
    WHERE user_id = p_user_id
  ),
  cuisine_stats AS (
    SELECT r.cuisine_type, COUNT(*) as visits
    FROM bookings b
    JOIN restaurants r ON b.restaurant_id = r.id
    WHERE b.user_id = p_user_id AND b.status = 'completed'
    GROUP BY r.cuisine_type
    ORDER BY visits DESC
    LIMIT 1
  ),
  restaurant_stats AS (
    SELECT b.restaurant_id, r.name, COUNT(*) as visits
    FROM bookings b
    JOIN restaurants r ON b.restaurant_id = r.id
    WHERE b.user_id = p_user_id AND b.status = 'completed'
    GROUP BY b.restaurant_id, r.name
    ORDER BY visits DESC
    LIMIT 1
  )
  SELECT 
    bs.total::BIGINT,
    bs.completed::BIGINT,
    bs.cancelled::BIGINT,
    bs.upcoming::BIGINT,
    (SELECT COUNT(*) FROM favorites WHERE user_id = p_user_id)::BIGINT as fav_count,
    (SELECT COUNT(*) FROM reviews WHERE user_id = p_user_id)::BIGINT as review_count,
    COALESCE(cs.cuisine_type, 'Not available') as cuisine,
    rs.restaurant_id as rest_id,
    COALESCE(rs.name, 'N/A') as rest_name,
    COALESCE(rs.visits, 0)::BIGINT as rest_visits
  FROM booking_stats bs
  LEFT JOIN cuisine_stats cs ON true
  LEFT JOIN restaurant_stats rs ON true;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_user_rating_stats
CREATE OR REPLACE FUNCTION public.get_user_rating_stats(p_user_id uuid)
 RETURNS TABLE(current_rating numeric, rating_count integer, excellent_count integer, good_count integer, average_count integer, poor_count integer, terrible_count integer, total_bookings integer, completed_bookings integer, cancelled_bookings integer, no_show_count integer, late_cancellation_count integer)
 LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH booking_stats AS (
    SELECT 
      COUNT(*) as total_bookings,
      COUNT(*) FILTER (WHERE b.status = 'completed') as completed_bookings,
      COUNT(*) FILTER (WHERE b.status = 'cancelled') as cancelled_bookings,
      COUNT(*) FILTER (WHERE b.status = 'no_show') as no_show_count,
      COUNT(*) FILTER (WHERE b.status = 'cancelled' AND 
        b.updated_at > (b.booking_time - INTERVAL '2 hours')) as late_cancellation_count
    FROM bookings b
    WHERE b.user_id = p_user_id
  ),
  review_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE r.rating = 5) as excellent_count,
      COUNT(*) FILTER (WHERE r.rating = 4) as good_count,
      COUNT(*) FILTER (WHERE r.rating = 3) as average_count,
      COUNT(*) FILTER (WHERE r.rating = 2) as poor_count,
      COUNT(*) FILTER (WHERE r.rating = 1) as terrible_count,
      COUNT(*) as rating_count
    FROM reviews r
    WHERE r.user_id = p_user_id
  ),
  user_rating AS (
    SELECT COALESCE(p.user_rating, 5.0) as current_rating
    FROM profiles p
    WHERE p.id = p_user_id
  )
  SELECT 
    ur.current_rating,
    rs.rating_count::INTEGER,
    rs.excellent_count::INTEGER,
    rs.good_count::INTEGER,
    rs.average_count::INTEGER,
    rs.poor_count::INTEGER,
    rs.terrible_count::INTEGER,
    bs.total_bookings::INTEGER,
    bs.completed_bookings::INTEGER,
    bs.cancelled_bookings::INTEGER,
    bs.no_show_count::INTEGER,
    bs.late_cancellation_count::INTEGER
  FROM user_rating ur
  CROSS JOIN booking_stats bs
  CROSS JOIN review_stats rs;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_user_restaurant_loyalty_summary
CREATE OR REPLACE FUNCTION public.get_user_restaurant_loyalty_summary(p_user_id uuid, p_restaurant_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(total_points_earned integer, total_bookings integer, last_earned_date timestamp with time zone, restaurant_name text)
 LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(la.points_earned), 0)::integer as total_points_earned,
    COUNT(DISTINCT b.id)::integer as total_bookings,
    MAX(la.created_at) as last_earned_date,
    r.name as restaurant_name
  FROM bookings b
  JOIN restaurants r ON r.id = b.restaurant_id
  LEFT JOIN loyalty_activities la ON la.related_booking_id = b.id
  WHERE 
    b.user_id = p_user_id
    AND la.activity_type = 'booking_completed'
    AND la.metadata->>'rule_id' IS NOT NULL -- From restaurant loyalty
    AND (p_restaurant_id IS NULL OR b.restaurant_id = p_restaurant_id)
  GROUP BY r.id, r.name;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- get_user_summary_stats
CREATE OR REPLACE FUNCTION public.get_user_summary_stats(p_restaurant_id uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date)
 RETURNS TABLE(total_users bigint, new_users_7d bigint, new_users_today bigint, active_users_daily bigint, active_users_weekly bigint, active_users_monthly bigint, users_with_bookings bigint)
 LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT p.id) as total_users,
    COUNT(DISTINCT CASE WHEN p.created_at >= NOW() - INTERVAL '7 days' THEN p.id END) as new_users_7d,
    COUNT(DISTINCT CASE WHEN p.created_at >= CURRENT_DATE THEN p.id END) as new_users_today,
    COUNT(DISTINCT CASE WHEN b.created_at >= CURRENT_DATE THEN p.id END) as active_users_daily,
    COUNT(DISTINCT CASE WHEN b.created_at >= NOW() - INTERVAL '7 days' THEN p.id END) as active_users_weekly,
    COUNT(DISTINCT CASE WHEN b.created_at >= NOW() - INTERVAL '30 days' THEN p.id END) as active_users_monthly,
    COUNT(DISTINCT b.user_id) as users_with_bookings
  FROM profiles p
  LEFT JOIN bookings b ON p.id = b.user_id
  WHERE (p_restaurant_id IS NULL OR b.restaurant_id = p_restaurant_id)
    AND (p_date_from IS NULL OR DATE(b.created_at) >= p_date_from)
    AND (p_date_to IS NULL OR DATE(b.created_at) <= p_date_to)
    AND b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid OR b.restaurant_id IS NULL;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- handle_accepted_booking_invite
CREATE OR REPLACE FUNCTION public.handle_accepted_booking_invite()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  -- Only proceed if status changed to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Update party size on the booking
    -- The party size is already being handled in the app code, 
    -- but we'll keep this as a backup/safety measure
    UPDATE public.bookings 
    SET 
      party_size = GREATEST(party_size, attendees + 1),
      attendees = COALESCE(attendees, 0) + 1,
      updated_at = NOW()
    WHERE id = NEW.booking_id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- handle_accepted_friend_request
CREATE OR REPLACE FUNCTION public.handle_accepted_friend_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  accepter_name TEXT;
BEGIN
  -- Only proceed if status changed to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Create bidirectional friendship
    INSERT INTO public.friends (user_id, friend_id)
    VALUES 
      (NEW.from_user_id, NEW.to_user_id),
      (NEW.to_user_id, NEW.from_user_id)
    ON CONFLICT (user_id, friend_id) DO NOTHING;
    
    -- Get accepter name
    SELECT COALESCE(full_name, first_name || ' ' || last_name, 'A user') INTO accepter_name
    FROM public.profiles
    WHERE id = NEW.to_user_id;
    
    -- Notify the original requester
    -- Use only 'push' channel to avoid duplicates
    PERFORM public.enqueue_notification(
      NEW.from_user_id,
      'social',
      'friend_request_accepted',
      'Friend Request Accepted',
      accepter_name || ' accepted your friend request',
      jsonb_build_object(
        'friendRequestId', NEW.id,
        'acceptedByUserId', NEW.to_user_id,
        'acceptedByUserName', accepter_name
      ),
      'app://social/profile/' || NEW.to_user_id::text,
      ARRAY['push']  -- CHANGED: Only push, not inapp
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- handle_booking_status_change
CREATE OR REPLACE FUNCTION public.handle_booking_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  -- Skip loyalty operations for guest bookings (no user_id)
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- When a pending booking is confirmed, award loyalty points
  IF OLD.status = 'pending' AND NEW.status = 'confirmed' AND NEW.applied_loyalty_rule_id IS NOT NULL THEN
    PERFORM award_restaurant_loyalty_points(NEW.id);
  END IF;
  
  -- When a booking is cancelled, refund loyalty points
  IF (OLD.status IN ('confirmed', 'completed') AND NEW.status IN ('cancelled_by_user', 'declined_by_restaurant')) 
     AND NEW.loyalty_points_earned > 0 THEN
    PERFORM refund_restaurant_loyalty_points(NEW.id);
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    first_name,
    last_name,
    phone_number,
    email,
    date_of_birth
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone_number',
    NEW.email,
    CASE
      WHEN NEW.raw_user_meta_data->>'date_of_birth' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'date_of_birth')::date
      ELSE NULL
    END
  );
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- handle_updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- increment_event_occurrence_bookings
CREATE OR REPLACE FUNCTION public.increment_event_occurrence_bookings(occurrence_id uuid, guest_count integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
    UPDATE event_occurrences
    SET current_bookings = COALESCE(current_bookings, 0) + guest_count,
        updated_at = NOW()
    WHERE id = occurrence_id;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- is_booking_dismissed
CREATE OR REPLACE FUNCTION public.is_booking_dismissed(p_user_id uuid, p_booking_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1
    FROM review_prompt_tracking
    WHERE user_id = p_user_id
    AND booking_id = p_booking_id
    AND action = 'dismissed'
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- list_profiles_admin
CREATE OR REPLACE FUNCTION public.list_profiles_admin(p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_tier text DEFAULT NULL::text, p_rating_min numeric DEFAULT NULL::numeric, p_rating_max numeric DEFAULT NULL::numeric, p_created_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_created_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_points_min integer DEFAULT NULL::integer, p_points_max integer DEFAULT NULL::integer, p_user_ids uuid[] DEFAULT NULL::uuid[], p_exclude_user_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, email text, full_name text, phone_number text, avatar_url text, allergies text[], favorite_cuisines text[], dietary_restrictions text[], preferred_party_size integer, loyalty_points integer, membership_tier text, user_rating numeric, total_bookings integer, completed_bookings integer, cancelled_bookings integer, no_show_bookings integer, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- list_profiles_admin
CREATE OR REPLACE FUNCTION public.list_profiles_admin(p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_tier text DEFAULT NULL::text, p_rating_min numeric DEFAULT NULL::numeric, p_rating_max numeric DEFAULT NULL::numeric, p_created_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_created_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_points_min integer DEFAULT NULL::integer, p_points_max integer DEFAULT NULL::integer, p_user_ids uuid[] DEFAULT NULL::uuid[], p_exclude_user_ids uuid[] DEFAULT NULL::uuid[], p_search text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, email text, full_name text, phone_number text, avatar_url text, allergies text[], favorite_cuisines text[], dietary_restrictions text[], preferred_party_size integer, loyalty_points integer, membership_tier text, user_rating numeric, total_bookings integer, completed_bookings integer, cancelled_bookings integer, no_show_bookings integer, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
    AND (
      p_search IS NULL OR length(trim(p_search)) < 2 OR
      p.full_name ILIKE '%' || trim(p_search) || '%'
      OR p.email ILIKE '%' || trim(p_search) || '%'
      OR p.phone_number ILIKE '%' || trim(p_search) || '%'
    )
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- lock_booking_for_update
CREATE OR REPLACE FUNCTION public.lock_booking_for_update(p_booking_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_booking record;
BEGIN
  -- Use FOR UPDATE to lock the row
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE NOWAIT;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Booking not found');
  END IF;
  
  RETURN row_to_json(v_booking);
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- log_loyalty_transaction
CREATE OR REPLACE FUNCTION public.log_loyalty_transaction()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO loyalty_audit_log (
    action,
    restaurant_id,
    user_id,
    booking_id,
    points_amount,
    balance_before,
    balance_after,
    metadata
  ) VALUES (
    TG_OP || '_' || NEW.transaction_type,
    NEW.restaurant_id,
    NEW.user_id,
    NEW.booking_id,
    NEW.points,
    NEW.balance_before,
    NEW.balance_after,
    NEW.metadata
  );
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- manage_restaurant_customers
CREATE OR REPLACE FUNCTION public.manage_restaurant_customers()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
DECLARE
  v_customer_id uuid;
  v_customer_name text;
BEGIN
  -- Only process confirmed bookings to avoid duplicate issues
  IF NEW.status NOT IN ('confirmed', 'completed') THEN
    RETURN NEW;
  END IF;

  -- Skip if we've already processed this booking (check by confirmation_code)
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  BEGIN
    -- For registered users
    IF NEW.user_id IS NOT NULL THEN
      -- Get user name
      SELECT full_name INTO v_customer_name FROM profiles WHERE id = NEW.user_id;
      
      -- Upsert customer record
      INSERT INTO restaurant_customers (
        restaurant_id, 
        user_id, 
        guest_name,
        guest_email,
        guest_phone,
        first_visit,
        total_bookings,
        last_visit,
        average_party_size,
        created_at,
        updated_at
      ) VALUES (
        NEW.restaurant_id, 
        NEW.user_id, 
        COALESCE(NEW.guest_name, v_customer_name, 'User'),
        NEW.guest_email,
        NEW.guest_phone,
        NEW.booking_time,
        1,
        NEW.booking_time,
        NEW.party_size,
        now(),
        now()
      )
      ON CONFLICT (restaurant_id, user_id) 
      DO UPDATE SET
        guest_name = COALESCE(EXCLUDED.guest_name, restaurant_customers.guest_name),
        guest_email = COALESCE(EXCLUDED.guest_email, restaurant_customers.guest_email),
        guest_phone = COALESCE(EXCLUDED.guest_phone, restaurant_customers.guest_phone),
        total_bookings = restaurant_customers.total_bookings + 1,
        last_visit = GREATEST(restaurant_customers.last_visit, EXCLUDED.last_visit),
        average_party_size = ROUND(
          ((restaurant_customers.average_party_size * restaurant_customers.total_bookings) + EXCLUDED.average_party_size) / 
          (restaurant_customers.total_bookings + 1)
        ),
        updated_at = now();
        
    -- For guest bookings
    ELSIF NEW.guest_email IS NOT NULL THEN
      INSERT INTO restaurant_customers (
        restaurant_id, 
        guest_email, 
        guest_name,
        guest_phone,
        first_visit,
        total_bookings,
        last_visit,
        average_party_size,
        created_at,
        updated_at
      ) VALUES (
        NEW.restaurant_id, 
        NEW.guest_email, 
        COALESCE(NEW.guest_name, 'Guest'),
        NEW.guest_phone,
        NEW.booking_time,
        1,
        NEW.booking_time,
        NEW.party_size,
        now(),
        now()
      )
      ON CONFLICT (restaurant_id, guest_email) 
      WHERE user_id IS NULL
      DO UPDATE SET
        guest_name = COALESCE(EXCLUDED.guest_name, restaurant_customers.guest_name),
        guest_phone = COALESCE(EXCLUDED.guest_phone, restaurant_customers.guest_phone),
        total_bookings = restaurant_customers.total_bookings + 1,
        last_visit = GREATEST(restaurant_customers.last_visit, EXCLUDED.last_visit),
        average_party_size = ROUND(
          ((restaurant_customers.average_party_size * restaurant_customers.total_bookings) + EXCLUDED.average_party_size) / 
          (restaurant_customers.total_bookings + 1)
        ),
        updated_at = now();
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the booking
    RAISE WARNING 'Could not update customer record: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- mark_for_retry
CREATE OR REPLACE FUNCTION public.mark_for_retry(p_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notification_outbox
  SET status = 'queued',
      retry_count = COALESCE(retry_count, 0) + 1,
      error = NULL
  WHERE id = ANY(p_ids)
    AND retry_count < 3;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- migrate_existing_bookings_to_customers
CREATE OR REPLACE FUNCTION public.migrate_existing_bookings_to_customers()
 RETURNS void
 LANGUAGE plpgsql
AS $$
DECLARE
  booking_record RECORD;
  v_customer_id uuid;
BEGIN
  -- Loop through all existing bookings and ensure customers exist
  FOR booking_record IN 
    SELECT b.restaurant_id, b.user_id, b.guest_email, b.guest_name, b.guest_phone,
           MIN(b.booking_time) as first_booking
    FROM bookings b
    LEFT JOIN restaurant_customers rc ON (
      (b.user_id = rc.user_id AND b.restaurant_id = rc.restaurant_id) OR
      (b.guest_email = rc.guest_email AND b.restaurant_id = rc.restaurant_id AND b.user_id IS NULL)
    )
    WHERE rc.id IS NULL  -- Only process bookings without customer records
    GROUP BY b.restaurant_id, b.user_id, b.guest_email, b.guest_name, b.guest_phone
  LOOP
    -- Create customer record
    IF booking_record.user_id IS NOT NULL THEN
      INSERT INTO restaurant_customers (
        restaurant_id, user_id, guest_name, guest_email, guest_phone, first_visit
      )
      SELECT 
        booking_record.restaurant_id, 
        booking_record.user_id, 
        COALESCE(booking_record.guest_name, p.full_name),
        booking_record.guest_email,
        booking_record.guest_phone,
        booking_record.first_booking
      FROM profiles p WHERE p.id = booking_record.user_id
      ON CONFLICT (restaurant_id, user_id) DO NOTHING
      RETURNING id INTO v_customer_id;
      
    ELSIF booking_record.guest_email IS NOT NULL THEN
      INSERT INTO restaurant_customers (
        restaurant_id, guest_email, guest_name, guest_phone, first_visit
      )
      VALUES (
        booking_record.restaurant_id, 
        booking_record.guest_email, 
        COALESCE(booking_record.guest_name, 'Guest'),
        booking_record.guest_phone,
        booking_record.first_booking
      )
      ON CONFLICT (restaurant_id, guest_email) DO NOTHING
      RETURNING id INTO v_customer_id;
    END IF;
    
    RAISE LOG 'Migrated customer for restaurant: %, user: %, email: %', 
      booking_record.restaurant_id, booking_record.user_id, booking_record.guest_email;
  END LOOP;
  
  RAISE NOTICE 'Migration completed. All existing bookings now have customer records.';
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- notify_booking_status_change
CREATE OR REPLACE FUNCTION public.notify_booking_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
DECLARE
    restaurant_name TEXT;
    booking_date TEXT;
    booking_time TEXT;
    notification_title TEXT;
    notification_body TEXT;
    notification_data JSONB;
BEGIN
    -- Only process status changes
    IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Skip customer notifications if this is a guest booking (no user_id)
    IF NEW.user_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Get restaurant name
    SELECT name INTO restaurant_name
    FROM restaurants
    WHERE id = NEW.restaurant_id;
    
    -- Format booking date and time
    booking_date := to_char(NEW.booking_time, 'YYYY-MM-DD');
    booking_time := to_char(NEW.booking_time, 'HH12:MI AM');
    
    -- Prepare notification data
    notification_data := jsonb_build_object(
        'type', 'booking',
        'bookingId', NEW.id,
        'restaurantId', NEW.restaurant_id,
        'restaurantName', restaurant_name,
        'date', booking_date,
        'time', booking_time,
        'partySize', NEW.party_size
    );
    
    -- Determine notification content based on status
    CASE NEW.status
        WHEN 'confirmed' THEN
            notification_title := '✅ Booking Confirmed!';
            notification_body := format('Your table for %s at %s is confirmed for %s at %s.',
                NEW.party_size, restaurant_name, booking_date, booking_time);
            notification_data := notification_data || jsonb_build_object('action', 'confirmed');
            
        WHEN 'cancelled' THEN
            notification_title := '❌ Booking Cancelled';
            notification_body := format('Your booking at %s for %s at %s has been cancelled.',
                restaurant_name, booking_date, booking_time);
            notification_data := notification_data || jsonb_build_object('action', 'cancelled');
            
        WHEN 'declined' THEN
            notification_title := '😔 Booking Declined';
            notification_body := format('%s couldn''t accommodate your request for %s at %s. Try booking a different time.',
                restaurant_name, booking_date, booking_time);
            notification_data := notification_data || jsonb_build_object('action', 'declined');
            
        ELSE
            -- Don't send notification for other statuses
            RETURN NEW;
    END CASE;
    
    -- Send notification with type
    PERFORM send_push_notification(
        NEW.user_id,
        notification_title,
        notification_body,
        notification_data,
        'high',
        CASE NEW.status
            WHEN 'confirmed' THEN 'booking_confirmation'
            WHEN 'cancelled' THEN 'booking_cancellation'
            WHEN 'declined' THEN 'booking_cancellation'
            ELSE 'general'
        END
    );
    
    RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- notify_deposit_status_change
CREATE OR REPLACE FUNCTION public.notify_deposit_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  -- Only notify on status changes
  IF OLD.deposit_status IS DISTINCT FROM NEW.deposit_status THEN
    -- Send a realtime notification
    PERFORM pg_notify(
      'deposit_status_change',
      json_build_object(
        'booking_id', NEW.id,
        'old_status', OLD.deposit_status,
        'new_status', NEW.deposit_status,
        'user_id', NEW.user_id
      )::text
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- notify_friend_request
CREATE OR REPLACE FUNCTION public.notify_friend_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  requester_name TEXT;
BEGIN
  SELECT COALESCE(full_name, first_name || ' ' || last_name, 'A user') INTO requester_name
  FROM public.profiles
  WHERE id = NEW.from_user_id;
  
  PERFORM public.enqueue_notification(
    NEW.to_user_id,
    'social',
    'friend_request_received',
    'New Friend Request',
    requester_name || ' sent you a friend request',
    jsonb_build_object(
      'friendRequestId', NEW.id, 
      'fromUserId', NEW.from_user_id,
      'fromUserName', requester_name,
      'message', NEW.message
    ),
    'plate://social',
    ARRAY['push']
  );
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- notify_friend_request_accepted
CREATE OR REPLACE FUNCTION public.notify_friend_request_accepted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  accepter_name TEXT;
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    -- The accepter is to_user_id (person who received and accepted the request)
    SELECT COALESCE(full_name, first_name || ' ' || last_name, 'Someone')
    INTO accepter_name
    FROM public.profiles
    WHERE id = NEW.to_user_id;
    
    -- Notify the original requester (from_user_id) that their request was accepted
    PERFORM public.enqueue_notification(
      NEW.from_user_id,
      'social',
      'friend_request_accepted',
      'Friend Request Accepted',
      accepter_name || ' accepted your friend request',
      jsonb_build_object('friend_id', NEW.to_user_id, 'friendRequestId', NEW.id),
      'plate://social',
      ARRAY['inapp', 'push']
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- notify_loyalty_points_change
CREATE OR REPLACE FUNCTION public.notify_loyalty_points_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
DECLARE
    points_difference INTEGER;
BEGIN
    -- Only process points increases
    IF TG_OP = 'UPDATE' AND NEW.loyalty_points <= OLD.loyalty_points THEN
        RETURN NEW;
    END IF;
    
    points_difference := NEW.loyalty_points - OLD.loyalty_points;
    
    -- Only notify for significant point gains (more than 10 points)
    IF points_difference <= 10 THEN
        RETURN NEW;
    END IF;
    
    PERFORM public.enqueue_notification(
        NEW.id,
        'loyalty',
        'points_earned',
        'Points Earned!',
        format('You earned %s loyalty points!', points_difference),
        jsonb_build_object(
            'points', points_difference,
            'totalPoints', NEW.loyalty_points,
            'action', 'points_earned'
        ),
        'plate://profile/loyalty',
        ARRAY['push']
    );
    
    RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- notify_new_booking
CREATE OR REPLACE FUNCTION public.notify_new_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  webhook_url TEXT := 'https://xsovqvbigdettnpeisjs.supabase.co/functions/v1/send-booking-notification';
  service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzb3ZxdmJpZ2RldHRucGVpc2pzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDA3NTM4MiwiZXhwIjoyMDY1NjUxMzgyfQ.fQwRgeoLFCGqw9A-eL3uXOGJhtT6kK0gskUj4BRYna4';
  request_id BIGINT;
BEGIN
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Call webhook asynchronously
  SELECT net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || service_role_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'bookings',
      'record', jsonb_build_object(
        'id', NEW.id,
        'restaurant_id', NEW.restaurant_id,
        'guest_name', NEW.guest_name,
        'party_size', NEW.party_size,
        'booking_time', NEW.booking_time
      )
    )
  ) INTO request_id;

  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- notify_new_booking_fcm
CREATE OR REPLACE FUNCTION public.notify_new_booking_fcm()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
DECLARE
  request_id BIGINT;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Only send FCM for pending bookings
  IF NEW.status = 'pending' THEN
    BEGIN
      -- Try to get configuration settings safely
      SELECT current_setting('app.settings.supabase_url', true) INTO supabase_url;
      SELECT current_setting('app.settings.service_role_key', true) INTO service_key;

      -- Only proceed if settings are configured
      IF supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
        -- Call the Edge Function asynchronously using pg_net
        SELECT net.http_post(
          url := supabase_url || '/functions/v1/send-booking-fcm',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_key
          ),
          body := jsonb_build_object('record', row_to_json(NEW))
        ) INTO request_id;

        RAISE NOTICE 'FCM notification triggered for booking % (request_id: %)', NEW.id, request_id;
      ELSE
        -- Settings not configured yet, skip silently
        RAISE NOTICE 'FCM not configured, skipping notification for booking %', NEW.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- If anything goes wrong, log but don't fail the booking creation
      RAISE NOTICE 'FCM notification failed for booking %: %', NEW.id, SQLERRM;
    END;
  END IF;

  -- Always return NEW so booking creation succeeds
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- notify_restaurant_cancel_whatsapp_from_trigger
CREATE OR REPLACE FUNCTION public.notify_restaurant_cancel_whatsapp_from_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
declare
  anon_key  text;
  plate_key text;
begin
  if tg_op = 'UPDATE' and new.status in ('cancelled_by_user') then
    anon_key  := private.get_secret('supabase_anon_key');
    plate_key := private.get_secret('plate_api_key');

    perform net.http_post(
      url := 'https://auth.plate-app.com/functions/v1/notify-restaurant-whatsapp-cancel',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key,
        'x-plate-key', plate_key
      ),
      body := jsonb_build_object('booking_id', new.id)
    );
  end if;
  
  return new;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- notify_restaurant_whatsapp_from_trigger
CREATE OR REPLACE FUNCTION public.notify_restaurant_whatsapp_from_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
declare
  anon_key  text;
  plate_key text;
  req_id    bigint;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  if new.status is not null and lower(new.status::text) <> 'pending' then
    return new;
  end if;

  anon_key  := private.get_secret('supabase_anon_key');
  plate_key := private.get_secret('plate_api_key');

  req_id := net.http_post(
    url := 'https://auth.plate-app.com/functions/v1/notify-restaurant-whatsapp',
    body := jsonb_build_object('booking_id', new.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'x-plate-key', plate_key
    ),
    timeout_milliseconds := 10000
  );

  return new;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- notify_shared_booking
CREATE OR REPLACE FUNCTION public.notify_shared_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  sharer_name TEXT;
  restaurant_name TEXT;
  booking_date TEXT;
BEGIN
  -- Get sharer name and booking details
  SELECT 
    p.full_name,
    r.name,
    TO_CHAR(b.booking_time, 'Mon DD, YYYY')
  INTO sharer_name, restaurant_name, booking_date
  FROM public.bookings b
  JOIN public.profiles p ON b.user_id = p.id
  JOIN public.restaurants r ON b.restaurant_id = r.id
  WHERE b.id = NEW.booking_id;
  
  -- Create notification for shared user
  PERFORM public.create_notification(
    NEW.shared_with_user_id,
    'booking_shared',
    'Booking Shared With You',
    sharer_name || ' shared a booking at ' || restaurant_name || ' on ' || booking_date,
    jsonb_build_object(
      'shared_booking_id', NEW.id,
      'booking_id', NEW.booking_id,
      'sharer_name', sharer_name,
      'restaurant_name', restaurant_name
    )
  );
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- notify_shared_booking_accepted
CREATE OR REPLACE FUNCTION public.notify_shared_booking_accepted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  accepter_name TEXT;
  restaurant_name TEXT;
  booking_owner_id UUID;
BEGIN
  -- Only notify when accepted status changes to true
  IF OLD.accepted = false AND NEW.accepted = true THEN
    -- Get accepter name, restaurant name, and booking owner
    SELECT 
      p.full_name,
      r.name,
      b.user_id
    INTO accepter_name, restaurant_name, booking_owner_id
    FROM public.profiles p
    JOIN public.shared_bookings sb ON p.id = sb.shared_with_user_id
    JOIN public.bookings b ON sb.booking_id = b.id
    JOIN public.restaurants r ON b.restaurant_id = r.id
    WHERE sb.id = NEW.id;
    
    -- Create notification for booking owner
    PERFORM public.create_notification(
      booking_owner_id,
      'shared_booking_accepted',
      'Shared Booking Accepted',
      accepter_name || ' accepted your shared booking at ' || restaurant_name,
      jsonb_build_object(
        'accepter_name', accepter_name,
        'restaurant_name', restaurant_name,
        'booking_id', NEW.booking_id
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- notify_staff_new_booking
CREATE OR REPLACE FUNCTION public.notify_staff_new_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    staff_record RECORD;
    formatted_time TEXT;
BEGIN
    -- Only process INSERT operations, not updates
    IF TG_OP = 'UPDATE' THEN
        RETURN NEW;
    END IF;

    -- Format the booking time
    formatted_time := TO_CHAR(NEW.booking_time AT TIME ZONE 'UTC', 'HH12:MI AM');

    -- Get all active staff for this restaurant
    FOR staff_record IN
        SELECT user_id
        FROM restaurant_staff
        WHERE restaurant_id = NEW.restaurant_id
        AND is_active = true
    LOOP
        -- Create push notification with UNIQUE ID
        INSERT INTO notification_outbox (
            notification_id,
            user_id,
            channel,
            type,
            title,
            body,
            priority,
            payload,
            status,
            created_at,
            scheduled_for,
            retry_count,
            attempts
        ) VALUES (
            gen_random_uuid(), -- UNIQUE ID for each notification
            staff_record.user_id,
            'push',
            'new_booking',
            'New Booking Request 📅',
            COALESCE(NEW.guest_name, 'Guest') || ' wants to book for ' || 
            NEW.party_size || ' people at ' || formatted_time,
            'high',
            jsonb_build_object(
                'url', '/bookings/' || NEW.id,
                'booking_id', NEW.id,
                'guest_name', COALESCE(NEW.guest_name, 'Guest'),
                'party_size', NEW.party_size,
                'booking_time', NEW.booking_time,
                'restaurant_id', NEW.restaurant_id
            ),
            'queued',
            NOW(),
            NOW(),
            0,
            0
        );

        -- Create in-app notification with SEPARATE UNIQUE ID
        INSERT INTO notification_outbox (
            notification_id,
            user_id,
            channel,
            type,
            title,
            body,
            priority,
            payload,
            status,
            created_at,
            scheduled_for,
            retry_count,
            attempts
        ) VALUES (
            gen_random_uuid(), -- SEPARATE UNIQUE ID
            staff_record.user_id,
            'inapp',
            'new_booking',
            'New Booking Request 📅',
            COALESCE(NEW.guest_name, 'Guest') || ' wants to book for ' || 
            NEW.party_size || ' people at ' || formatted_time,
            'high',
            jsonb_build_object(
                'url', '/bookings/' || NEW.id,
                'booking_id', NEW.id,
                'guest_name', COALESCE(NEW.guest_name, 'Guest'),
                'party_size', NEW.party_size,
                'booking_time', NEW.booking_time,
                'restaurant_id', NEW.restaurant_id
            ),
            'queued',
            NOW(),
            NOW(),
            0,
            0
        );
    END LOOP;

    RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- notify_waitlist_customers
CREATE OR REPLACE FUNCTION public.notify_waitlist_customers()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_entry record;
BEGIN
  -- Find active waitlist entries and check availability
  -- Only process PRO tier restaurants with automated availability checking
  -- Basic tier restaurants should be managed manually by restaurant admins
  FOR v_entry IN 
    SELECT w.*
    FROM waitlist w
    JOIN restaurants r ON w.restaurant_id = r.id
    WHERE w.status = 'active'
      AND w.desired_date >= CURRENT_DATE
      AND w.created_at < now() - interval '2 minutes'
      AND r.tier = 'pro'  -- Only process pro tier restaurants
    ORDER BY w.created_at
  LOOP
    -- Check if table is available
    IF check_table_availability(
      v_entry.restaurant_id,
      v_entry.desired_date,
      v_entry.desired_time_range,
      v_entry.party_size
    ) THEN
      -- Update status to notified
      UPDATE waitlist
      SET 
        status = 'notified',
        notified_at = now(),
        notification_expires_at = now() + interval '15 minutes',
        updated_at = now()
      WHERE id = v_entry.id;

      -- Create notification only for registered users (user_id not null)
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        IF v_entry.user_id IS NOT NULL THEN
          INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            data
          ) VALUES (
            v_entry.user_id,
            'waitlist_available',
            'Table Available!',
            'A table is now available for your requested time',
            jsonb_build_object(
              'waitlist_id', v_entry.id,
              'restaurant_id', v_entry.restaurant_id
            )
          );
        END IF;
      END IF;
    END IF;
  END LOOP;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- notify_waitlist_status_change
CREATE OR REPLACE FUNCTION public.notify_waitlist_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
DECLARE
    restaurant_name TEXT;
    notification_title TEXT;
    notification_body TEXT;
    notification_type TEXT;
    notification_data JSONB;
    requested_date TEXT;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    SELECT name INTO restaurant_name
    FROM restaurants
    WHERE id = NEW.restaurant_id;
    
    requested_date := to_char(NEW.desired_date, 'YYYY-MM-DD');
    
    notification_data := jsonb_build_object(
        'entryId', NEW.id,
        'restaurantId', NEW.restaurant_id,
        'restaurantName', restaurant_name,
        'requestedDate', requested_date,
        'partySize', NEW.party_size
    );
    
    CASE NEW.status
        WHEN 'notified' THEN
            notification_title := 'Table Available!';
            notification_body := format('A table for %s at %s is now available for %s!',
                NEW.party_size, restaurant_name, requested_date);
            notification_type := 'waitlist_available';
        WHEN 'expired' THEN
            notification_title := 'Waitlist Expired';
            notification_body := format('Your waiting list entry at %s has expired.', restaurant_name);
            notification_type := 'waitlist_expired';
        ELSE
            RETURN NEW;
    END CASE;
    
    PERFORM public.enqueue_notification(
        NEW.user_id,
        'waitlist',
        notification_type,
        notification_title,
        notification_body,
        notification_data,
        'plate://waiting-list',
        ARRAY['inapp', 'push']
    );
    
    RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- notify_widget_user_from_trigger
CREATE OR REPLACE FUNCTION public.notify_widget_user_from_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
declare
  anon_key   text;
  notify_key text;
  req_id     bigint;
begin
  -- Only act on UPDATE
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  -- Only if status actually changed
  if old.status is not distinct from new.status then
    return new;
  end if;

  -- Only if booking comes from widget
  if new.source is distinct from 'widget' then
    return new;
  end if;

  -- Only for specific statuses
  if new.status not in ('confirmed', 'declined_by_restaurant', 'cancelled_by_restaurant') then
    return new;
  end if;

  -- Fetch secrets using helper
  anon_key   := private.get_secret('supabase_anon_key');
  notify_key := private.get_secret('plate_notify_key');

  -- Fire-and-forget HTTP POST to your Edge Function
  req_id := net.http_post(
    url := 'https://auth.plate-app.com/functions/v1/notify_widget_user',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'x-plate-notify-key', notify_key
    ),
    body := jsonb_build_object(
      'record', to_jsonb(new),
      'old_record', to_jsonb(old)
    ),
    timeout_milliseconds := 5000
  );

  return new;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- on_booking_change_refresh_tags
CREATE OR REPLACE FUNCTION public.on_booking_change_refresh_tags()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id uuid;
  v_user_id     uuid := COALESCE(NEW.user_id, OLD.user_id);
  v_email       text := COALESCE(NEW.guest_email, OLD.guest_email);
  v_rid         uuid := COALESCE(NEW.restaurant_id, OLD.restaurant_id);
  v_has_system  boolean;
BEGIN
  IF v_user_id IS NULL AND v_email IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Seed system tags for this restaurant only if we haven't yet
  SELECT EXISTS (
    SELECT 1 FROM public.customer_tags
    WHERE restaurant_id = v_rid AND is_system = true
    LIMIT 1
  ) INTO v_has_system;
  IF NOT v_has_system THEN
    PERFORM public.ensure_system_tags_for_restaurant(v_rid);
  END IF;

  SELECT id INTO v_customer_id
  FROM public.restaurant_customers
  WHERE restaurant_id = v_rid
    AND (
      (v_user_id IS NOT NULL AND user_id = v_user_id)
      OR (v_user_id IS NULL AND guest_email = v_email)
    )
  LIMIT 1;

  IF v_customer_id IS NOT NULL THEN
    PERFORM public.refresh_customer_auto_tags(v_customer_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- on_customer_stats_change_refresh_tags
CREATE OR REPLACE FUNCTION public.on_customer_stats_change_refresh_tags()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.refresh_customer_auto_tags(NEW.id);
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- perform_daily_maintenance
CREATE OR REPLACE FUNCTION public.perform_daily_maintenance()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb := '{}';
  v_status_update jsonb;
  v_archive_result jsonb;
  v_health_check jsonb;
BEGIN
  -- 1. Update booking statuses
  v_status_update := update_booking_statuses();
  
  -- 2. Archive old bookings (keep 90 days by default)
  v_archive_result := archive_old_bookings(90);
  
  -- 3. Refresh materialized view
  PERFORM refresh_table_availability();
  
  -- 4. Run health check
  v_health_check := check_booking_system_health();
  
  -- 5. Analyze tables for query optimization
  ANALYZE bookings;
  ANALYZE booking_tables;
  ANALYZE restaurant_tables;
  
  v_result := jsonb_build_object(
    'maintenance_date', CURRENT_DATE,
    'status_updates', v_status_update,
    'archive_results', v_archive_result,
    'health_check', v_health_check,
    'completed_at', now()
  );
  
  RETURN v_result;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- prevent_duplicate_booking_handler
CREATE OR REPLACE FUNCTION public.prevent_duplicate_booking_handler()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
DECLARE
  handler_admin_id bigint;
  handler_user_id uuid;
  handler_name text;
BEGIN
  -- Check if booking already has a handler
  SELECT admin_id INTO handler_admin_id
  FROM public.booking_handlers
  WHERE booking_id = NEW.booking_id
  LIMIT 1;
  
  IF handler_admin_id IS NOT NULL THEN
    -- Get the handler's user_id
    SELECT user_id INTO handler_user_id
    FROM public.rbs_admins
    WHERE id = handler_admin_id;
    
    -- Get the handler's name
    IF handler_user_id IS NOT NULL THEN
      SELECT full_name INTO handler_name
      FROM public.profiles
      WHERE id = handler_user_id;
    END IF;
    
    -- Raise exception with handler name if available
    IF handler_name IS NOT NULL AND handler_name != '' THEN
      RAISE EXCEPTION 'Booking is already being handled by %', handler_name;
    ELSE
      RAISE EXCEPTION 'Booking is already being handled by another admin';
    END IF;
  END IF;
  
  -- Also verify the booking is still pending
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE id = NEW.booking_id
    AND status != 'pending'
  ) THEN
    RAISE EXCEPTION 'Booking can only be handled when status is pending';
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- protect_profile_sensitive_fields
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
BEGIN
  -- Backend / RPC / migration callers bypass all field protection.
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  -- Verified phone is immutable once set.
  IF OLD.phone_number IS NOT NULL THEN
    NEW.phone_number := OLD.phone_number;
  END IF;

  -- Verification flags only change via the verify-otp Edge Function.
  NEW.phone_verified    := OLD.phone_verified;
  NEW.phone_verified_at := OLD.phone_verified_at;

  -- Pending phone: writable by the user during the unverified window only.
  IF COALESCE(OLD.phone_verified, false) = true THEN
    NEW.pending_phone_number := OLD.pending_phone_number;
    NEW.pending_phone_set_at := OLD.pending_phone_set_at;
  ELSE
    IF NEW.pending_phone_number IS DISTINCT FROM OLD.pending_phone_number THEN
      NEW.pending_phone_set_at := now();
    ELSE
      NEW.pending_phone_set_at := OLD.pending_phone_set_at;
    END IF;
  END IF;

  -- Email: allow initial set, lock once non-null.
  IF OLD.email IS NOT NULL THEN
    NEW.email := OLD.email;
  END IF;

  -- System-managed fields (unchanged from prior migration).
  NEW.loyalty_points       := OLD.loyalty_points;
  NEW.membership_tier      := OLD.membership_tier;
  NEW.user_rating          := OLD.user_rating;
  NEW.rating_last_updated  := OLD.rating_last_updated;
  NEW.total_bookings       := OLD.total_bookings;
  NEW.completed_bookings   := OLD.completed_bookings;
  NEW.cancelled_bookings   := OLD.cancelled_bookings;
  NEW.no_show_bookings     := OLD.no_show_bookings;
  NEW.created_at           := OLD.created_at;

  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- purge_unverified_accounts
CREATE OR REPLACE FUNCTION public.purge_unverified_accounts(p_ttl_minutes integer DEFAULT 15)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_deleted int;
BEGIN
  IF p_ttl_minutes IS NULL OR p_ttl_minutes < 1 THEN
    p_ttl_minutes := 15;
  END IF;

  WITH purged AS (
    DELETE FROM auth.users u
    USING public.profiles p
    WHERE p.id = u.id
      AND COALESCE(p.phone_verified, false) = false
      AND u.phone IS NULL
      AND u.created_at < (now() - make_interval(mins => p_ttl_minutes))
    RETURNING u.id
  )
  SELECT count(*) INTO v_deleted FROM purged;

  RETURN v_deleted;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- queue_booking_notification
CREATE OR REPLACE FUNCTION public.queue_booking_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Queue notification for new booking (staff only)
    INSERT INTO notification_outbox (
      notification_id,
      user_id,
      channel,
      payload,
      status,
      type,
      title,
      body,
      priority,
      scheduled_for
    ) 
    SELECT 
      gen_random_uuid(),
      rs.user_id,
      'push',
      jsonb_build_object(
        'restaurant_id', NEW.restaurant_id,
        'booking_id', NEW.id,
        'party_size', NEW.party_size,
        'booking_time', NEW.booking_time,
        'guest_name', COALESCE(NEW.guest_name, 'Guest'),
        'url', '/bookings/' || NEW.id::text
      ),
      'queued',
      'new_booking',
      'New Booking Request 📅',
      COALESCE(NEW.guest_name, 'Guest') || ' wants to book for ' || NEW.party_size || ' people at ' || 
      to_char(NEW.booking_time, 'HH12:MI AM'),
      'high',
      now()
    FROM restaurant_staff rs
    WHERE rs.restaurant_id = NEW.restaurant_id 
    AND rs.is_active = true;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check for status changes
    IF OLD.status != NEW.status THEN
      IF NEW.status = 'cancelled_by_user' OR NEW.status = 'cancelled_by_restaurant' THEN
        -- Queue cancellation notification (staff only)
        INSERT INTO notification_outbox (
          notification_id,
          user_id,
          channel,
          payload,
          status,
          type,
          title,
          body,
          priority,
          scheduled_for
        ) 
        SELECT 
          gen_random_uuid(),
          rs.user_id,
          'push',
          jsonb_build_object(
            'restaurant_id', NEW.restaurant_id,
            'booking_id', NEW.id,
            'url', '/bookings/' || NEW.id::text
          ),
          'queued',
          'booking_cancelled',
          'Booking Cancelled ❌',
          COALESCE(NEW.guest_name, 'Guest') || ' cancelled their booking for ' || NEW.party_size || ' people',
          'normal',
          now()
        FROM restaurant_staff rs
        WHERE rs.restaurant_id = NEW.restaurant_id 
        AND rs.is_active = true;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- queue_order_notification
CREATE OR REPLACE FUNCTION public.queue_order_notification()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    -- Only notify on specific status changes
    IF NEW.status IN ('ready', 'completed') THEN
      INSERT INTO notification_outbox (
        notification_id,
        user_id,
        channel,
        payload,
        status,
        type,
        title,
        body,
        priority,
        scheduled_for
      ) 
      SELECT 
        gen_random_uuid(),
        rs.user_id,
        'push',
        jsonb_build_object(
          'restaurant_id', NEW.restaurant_id,
          'order_id', NEW.id,
          'table_number', rt.table_number,
          'url', '/orders/' || NEW.id::text
        ),
        'queued',
        'order_update',
        CASE 
          WHEN NEW.status = 'ready' THEN 'Order Ready! 🍽️'
          WHEN NEW.status = 'completed' THEN 'Order Completed ✅'
          ELSE 'Order Update'
        END,
        'Order #' || NEW.id || CASE 
          WHEN rt.table_number IS NOT NULL THEN ' for Table ' || rt.table_number
          ELSE ''
        END || ' is ' || NEW.status,
        CASE 
          WHEN NEW.status = 'ready' THEN 'high'
          ELSE 'normal'
        END,
        now()
      FROM restaurant_staff rs
      LEFT JOIN restaurant_tables rt ON rt.id = NEW.table_id
      WHERE rs.restaurant_id = NEW.restaurant_id 
      AND rs.is_active = true;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- queue_waitlist_notification
CREATE OR REPLACE FUNCTION public.queue_waitlist_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO notification_outbox (
      notification_id,
      user_id,
      channel,
      payload,
      status,
      type,
      title,
      body,
      priority,
      scheduled_for
    ) 
    SELECT 
      gen_random_uuid(),
      rs.user_id,
      'push',
      jsonb_build_object(
        'restaurant_id', NEW.restaurant_id,
        'waitlist_id', NEW.id,
        'party_size', NEW.party_size,
        'guest_name', COALESCE(NEW.guest_name, 'Guest'),
        'url', '/waitlist'
      ),
      'queued',
      'waitlist_update',
      'New Waitlist Entry 📋',
      COALESCE(NEW.guest_name, 'Guest') || ' joined the waitlist for ' || NEW.party_size || ' people',
      'normal',
      now()
    FROM restaurant_staff rs
    WHERE rs.restaurant_id = NEW.restaurant_id 
    AND rs.is_active = true;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- quick_availability_check
CREATE OR REPLACE FUNCTION public.quick_availability_check(p_restaurant_id uuid, p_start_time timestamp with time zone, p_end_time timestamp with time zone, p_party_size integer)
 RETURNS boolean
 LANGUAGE plpgsql
AS $$
DECLARE
  v_available_tables integer;
  v_should_block_pending boolean;
BEGIN
  v_should_block_pending := should_block_pending_bookings(p_restaurant_id);
  
  SELECT COUNT(*)
  INTO v_available_tables
  FROM restaurant_tables rt
  WHERE rt.restaurant_id = p_restaurant_id
    AND rt.is_active = true
    AND rt.capacity >= p_party_size
    AND NOT EXISTS (
      SELECT 1
      FROM booking_tables bt
      JOIN bookings b ON bt.booking_id = b.id
      WHERE bt.table_id = rt.id
        AND b.restaurant_id = p_restaurant_id
        AND b.status IN (
          'confirmed',
          CASE WHEN v_should_block_pending THEN 'pending' ELSE NULL END
        )
        AND b.booking_time < p_end_time
        AND (b.booking_time + (b.turn_time_minutes || ' minutes')::interval) > p_start_time
    )
  LIMIT 1;
    
  RETURN v_available_tables > 0;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- redeem_loyalty_reward
CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward(p_user_id uuid, p_reward_id uuid DEFAULT NULL::uuid, p_offer_id uuid DEFAULT NULL::uuid, p_points_cost integer DEFAULT NULL::integer)
 RETURNS TABLE(redemption_id uuid, redemption_code text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
AS $$
DECLARE
  v_user_points INTEGER;
  v_user_tier TEXT;
  v_reward_points INTEGER;
  v_reward_tier TEXT;
  v_expires_at TIMESTAMPTZ;
  v_redemption_id UUID;
  v_redemption_code TEXT;
BEGIN
  -- Validate input
  IF (p_reward_id IS NULL AND p_offer_id IS NULL) OR 
     (p_reward_id IS NOT NULL AND p_offer_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Must specify either reward_id or offer_id, but not both';
  END IF;
  
  -- Get user's current points and tier
  SELECT loyalty_points, membership_tier 
  INTO v_user_points, v_user_tier
  FROM public.profiles 
  WHERE id = p_user_id;
  
  -- Get reward details
  IF p_reward_id IS NOT NULL THEN
    SELECT points_cost, tier_required 
    INTO v_reward_points, v_reward_tier
    FROM public.loyalty_rewards 
    WHERE id = p_reward_id AND is_active = true;
    
    IF v_reward_points IS NULL THEN
      RAISE EXCEPTION 'Reward not found or inactive';
    END IF;
  ELSE
    -- For offers, use provided points cost
    v_reward_points := COALESCE(p_points_cost, 0);
    v_reward_tier := 'bronze'; -- Default for offers
  END IF;
  
  -- Check if user has enough points
  IF v_user_points < v_reward_points THEN
    RAISE EXCEPTION 'Insufficient points: have %, need %', v_user_points, v_reward_points;
  END IF;
  
  -- Check tier requirement
  IF (v_reward_tier = 'silver' AND v_user_tier = 'bronze') OR
     (v_reward_tier = 'gold' AND v_user_tier IN ('bronze', 'silver')) OR
     (v_reward_tier = 'platinum' AND v_user_tier IN ('bronze', 'silver', 'gold')) THEN
    RAISE EXCEPTION 'Insufficient tier: have %, need %', v_user_tier, v_reward_tier;
  END IF;
  
  -- Set expiry date (30 days from now)
  v_expires_at := NOW() + INTERVAL '30 days';
  
  -- Deduct points
  PERFORM award_loyalty_points_with_tracking(
    p_user_id,
    -v_reward_points,
    'reward_redemption',
    'Redeemed reward for ' || v_reward_points || ' points'
  );
  
  -- Create redemption record
  INSERT INTO public.loyalty_redemptions (
    user_id,
    reward_id,
    offer_id,
    points_cost,
    expires_at
  ) VALUES (
    p_user_id,
    p_reward_id,
    p_offer_id,
    v_reward_points,
    v_expires_at
  ) RETURNING id, redemption_code, expires_at 
  INTO v_redemption_id, v_redemption_code, v_expires_at;
  
  RETURN QUERY SELECT v_redemption_id, v_redemption_code, v_expires_at;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- refresh_all_customer_auto_tags
CREATE OR REPLACE FUNCTION public.refresh_all_customer_auto_tags(p_restaurant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id uuid;
  v_count       int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.restaurant_staff
    WHERE restaurant_id = p_restaurant_id
      AND user_id = auth.uid()
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'access_denied: caller is not active staff of this restaurant';
  END IF;

  PERFORM public.ensure_system_tags_for_restaurant(p_restaurant_id);

  FOR v_customer_id IN
    SELECT id FROM public.restaurant_customers WHERE restaurant_id = p_restaurant_id
  LOOP
    BEGIN
      PERFORM public.refresh_customer_auto_tags(v_customer_id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN v_count;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- refresh_all_restaurant_review_stats
CREATE OR REPLACE FUNCTION public.refresh_all_restaurant_review_stats()
 RETURNS TABLE(restaurant_id uuid, restaurant_name text, old_rating numeric, new_rating numeric, old_count integer, new_count integer)
 LANGUAGE plpgsql
AS $$
DECLARE
  affected_restaurant RECORD;
BEGIN
  FOR affected_restaurant IN
    SELECT 
      r.id,
      r.name,
      r.average_rating as old_avg,
      r.total_reviews as old_count,
      COALESCE(AVG(rev.rating)::numeric, 0) as new_avg,
      COUNT(rev.id)::integer as new_count
    FROM restaurants r
    LEFT JOIN reviews rev ON r.id = rev.restaurant_id
    GROUP BY r.id, r.name, r.average_rating, r.total_reviews
    HAVING COUNT(rev.id) > 0 
      AND (r.total_reviews != COUNT(rev.id) OR ABS(r.average_rating - COALESCE(AVG(rev.rating)::numeric, 0)) > 0.01)
  LOOP
    -- Refresh stats for this restaurant
    PERFORM public.refresh_restaurant_review_stats(affected_restaurant.id);
    
    -- Return the changes
    RETURN QUERY
    SELECT 
      affected_restaurant.id,
      affected_restaurant.name,
      affected_restaurant.old_avg,
      COALESCE(AVG(rev.rating)::numeric, 0) as new_avg,
      affected_restaurant.old_count,
      COUNT(rev.id)::integer as new_count
    FROM reviews rev
    WHERE rev.restaurant_id = affected_restaurant.id
    GROUP BY affected_restaurant.id;
  END LOOP;
  
  RETURN;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- refresh_customer_auto_tags
CREATE OR REPLACE FUNCTION public.refresh_customer_auto_tags(p_customer_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_customer       public.restaurant_customers%ROWTYPE;
  v_profile        public.profiles%ROWTYPE;
  v_now            timestamptz := now();
  v_completed      int := 0;
  v_no_shows       int := 0;
  v_cancelled      int := 0;
  v_total_bookings int := 0;
  v_reliability    numeric;
  v_days_since     int;
  v_weekend_ratio  numeric := 0;
  v_weekday_ratio  numeric := 0;
  v_lunch_ratio    numeric := 0;
  v_dinner_ratio   numeric := 0;
  v_late_ratio     numeric := 0;
  v_history_count  int := 0;
  v_event_count    int := 0;
  v_occasion_count int := 0;
  v_special_req    int := 0;
  v_had_gap        boolean := false;
  v_recent_neg     int := 0;
  v_desired        text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO v_customer FROM public.restaurant_customers WHERE id = p_customer_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Note: seeding system tags is intentionally NOT done here; the bulk RPC
  -- and the booking trigger's first call per restaurant take care of it.

  IF v_customer.user_id IS NOT NULL THEN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_customer.user_id;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'no_show'),
    COUNT(*) FILTER (WHERE status IN ('cancelled_by_user','cancelled_by_restaurant')),
    COUNT(*)
  INTO v_completed, v_no_shows, v_cancelled, v_total_bookings
  FROM public.bookings
  WHERE restaurant_id = v_customer.restaurant_id
    AND (
      (v_customer.user_id IS NOT NULL AND user_id = v_customer.user_id)
      OR (v_customer.user_id IS NULL AND v_customer.guest_email IS NOT NULL AND guest_email = v_customer.guest_email)
    );

  IF (v_completed + v_cancelled + v_no_shows) > 0 THEN
    v_reliability := v_completed::numeric / (v_completed + v_cancelled + v_no_shows)::numeric;
  END IF;

  SELECT
    COUNT(*),
    COALESCE(AVG(CASE WHEN EXTRACT(ISODOW FROM booking_time) IN (6,7)          THEN 1.0 ELSE 0.0 END), 0),
    COALESCE(AVG(CASE WHEN EXTRACT(ISODOW FROM booking_time) BETWEEN 1 AND 5   THEN 1.0 ELSE 0.0 END), 0),
    COALESCE(AVG(CASE WHEN EXTRACT(HOUR   FROM booking_time) BETWEEN 11 AND 14 THEN 1.0 ELSE 0.0 END), 0),
    COALESCE(AVG(CASE WHEN EXTRACT(HOUR   FROM booking_time) BETWEEN 17 AND 21 THEN 1.0 ELSE 0.0 END), 0),
    COALESCE(AVG(CASE WHEN EXTRACT(HOUR   FROM booking_time) >= 21             THEN 1.0 ELSE 0.0 END), 0)
  INTO v_history_count, v_weekend_ratio, v_weekday_ratio, v_lunch_ratio, v_dinner_ratio, v_late_ratio
  FROM public.bookings
  WHERE restaurant_id = v_customer.restaurant_id
    AND status = 'completed'
    AND (
      (v_customer.user_id IS NOT NULL AND user_id = v_customer.user_id)
      OR (v_customer.user_id IS NULL AND v_customer.guest_email IS NOT NULL AND guest_email = v_customer.guest_email)
    );

  SELECT
    COUNT(*) FILTER (WHERE party_size >= 8 AND status = 'completed'),
    COUNT(*) FILTER (WHERE occasion IS NOT NULL AND occasion <> '' AND status = 'completed'),
    COUNT(*) FILTER (WHERE special_requests IS NOT NULL AND special_requests <> '' AND status = 'completed')
  INTO v_event_count, v_occasion_count, v_special_req
  FROM public.bookings
  WHERE restaurant_id = v_customer.restaurant_id
    AND (
      (v_customer.user_id IS NOT NULL AND user_id = v_customer.user_id)
      OR (v_customer.user_id IS NULL AND v_customer.guest_email IS NOT NULL AND guest_email = v_customer.guest_email)
    );

  SELECT COUNT(*) INTO v_recent_neg
  FROM public.bookings
  WHERE restaurant_id = v_customer.restaurant_id
    AND status IN ('no_show','cancelled_by_user','cancelled_by_restaurant')
    AND booking_time >= v_now - interval '90 days'
    AND (
      (v_customer.user_id IS NOT NULL AND user_id = v_customer.user_id)
      OR (v_customer.user_id IS NULL AND v_customer.guest_email IS NOT NULL AND guest_email = v_customer.guest_email)
    );

  IF v_completed >= 30                THEN v_desired := array_append(v_desired, 'loyal');
  ELSIF v_completed BETWEEN 15 AND 29 THEN v_desired := array_append(v_desired, 'frequent');
  ELSIF v_completed BETWEEN 5  AND 14 THEN v_desired := array_append(v_desired, 'regular');
  ELSIF v_completed BETWEEN 2  AND 4  THEN v_desired := array_append(v_desired, 'repeat_guest');
  ELSIF v_completed = 1 AND v_customer.first_visit IS NOT NULL
        AND v_customer.first_visit >= v_now - interval '60 days'
                                      THEN v_desired := array_append(v_desired, 'first_timer');
  END IF;

  IF v_customer.last_visit IS NOT NULL THEN
    v_days_since := GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_customer.last_visit))::int / 86400);
    IF v_days_since <=  30 THEN v_desired := array_append(v_desired, 'active');
    ELSIF v_days_since <=  90 THEN v_desired := array_append(v_desired, 'lapsing');
    ELSIF v_days_since <= 180 THEN v_desired := array_append(v_desired, 'lapsed');
    ELSE                          v_desired := array_append(v_desired, 'dormant');
    END IF;

    IF v_days_since <= 14 AND v_completed >= 2 THEN
      SELECT EXISTS (
        SELECT 1 FROM public.bookings
        WHERE restaurant_id = v_customer.restaurant_id
          AND status = 'completed'
          AND booking_time <  v_customer.last_visit - interval '90 days'
          AND booking_time >= v_customer.last_visit - interval '365 days'
          AND (
            (v_customer.user_id IS NOT NULL AND user_id = v_customer.user_id)
            OR (v_customer.user_id IS NULL AND v_customer.guest_email IS NOT NULL AND guest_email = v_customer.guest_email)
          )
      ) INTO v_had_gap;
      IF v_had_gap THEN v_desired := array_append(v_desired, 'welcome_back'); END IF;
    END IF;
  END IF;

  IF    COALESCE(v_customer.total_spent, 0) >= 5000 THEN v_desired := array_append(v_desired, 'whale');
  ELSIF COALESCE(v_customer.total_spent, 0) >= 2000 THEN v_desired := array_append(v_desired, 'top_spender');
  ELSIF COALESCE(v_customer.total_spent, 0) >= 500  THEN v_desired := array_append(v_desired, 'high_spender');
  END IF;

  IF v_completed >= 5 AND v_no_shows = 0
     AND (v_reliability IS NULL OR v_reliability >= 0.90) THEN v_desired := array_append(v_desired, 'reliable'); END IF;
  IF v_no_shows >= 2 THEN v_desired := array_append(v_desired, 'no_show_risk'); END IF;
  IF v_cancelled >= 3
     OR (v_total_bookings >= 5 AND v_reliability IS NOT NULL AND v_reliability < 0.60)
     THEN v_desired := array_append(v_desired, 'frequent_canceller'); END IF;
  IF v_recent_neg >= 3 THEN v_desired := array_append(v_desired, 'at_risk'); END IF;

  IF v_completed >= 3 THEN
    IF COALESCE(v_customer.average_party_size, 0) < 1.5 THEN v_desired := array_append(v_desired, 'solo_diner');
    ELSIF v_customer.average_party_size >= 1.5 AND v_customer.average_party_size < 2.5 THEN v_desired := array_append(v_desired, 'couple');
    ELSIF v_customer.average_party_size >= 2.5 AND v_customer.average_party_size < 5   THEN v_desired := array_append(v_desired, 'small_group');
    END IF;
  END IF;
  IF COALESCE(v_customer.average_party_size, 0) >= 5 THEN v_desired := array_append(v_desired, 'large_group'); END IF;
  IF v_event_count >= 2 THEN v_desired := array_append(v_desired, 'event_host'); END IF;

  IF v_history_count >= 3 AND v_weekend_ratio > 0.60 THEN v_desired := array_append(v_desired, 'weekend_regular'); END IF;
  IF v_history_count >= 5 AND v_weekday_ratio > 0.70 THEN v_desired := array_append(v_desired, 'weekday_regular'); END IF;
  IF v_history_count >= 3 AND v_lunch_ratio   > 0.60 THEN v_desired := array_append(v_desired, 'lunch_guest');     END IF;
  IF v_history_count >= 3 AND v_dinner_ratio  > 0.60 THEN v_desired := array_append(v_desired, 'dinner_guest');    END IF;
  IF v_history_count >= 3 AND v_late_ratio    > 0.30 THEN v_desired := array_append(v_desired, 'late_diner');      END IF;

  IF v_profile.date_of_birth IS NOT NULL
     AND EXTRACT(MONTH FROM v_profile.date_of_birth) = EXTRACT(MONTH FROM v_now)
     THEN v_desired := array_append(v_desired, 'birthday_month'); END IF;
  IF v_occasion_count >= 3 THEN v_desired := array_append(v_desired, 'celebrator'); END IF;
  IF v_profile.allergies IS NOT NULL AND array_length(v_profile.allergies, 1) > 0 THEN v_desired := array_append(v_desired, 'allergy_alert'); END IF;
  IF v_profile.dietary_restrictions IS NOT NULL AND array_length(v_profile.dietary_restrictions, 1) > 0 THEN v_desired := array_append(v_desired, 'dietary_restriction'); END IF;
  IF COALESCE(v_customer.vip_status, false)  THEN v_desired := array_append(v_desired, 'vip'); END IF;
  IF COALESCE(v_customer.blacklisted, false) THEN v_desired := array_append(v_desired, 'blacklisted'); END IF;
  IF (v_profile.loyalty_points IS NOT NULL AND v_profile.loyalty_points > 0)
     OR (v_profile.membership_tier IS NOT NULL AND v_profile.membership_tier <> 'bronze')
     THEN v_desired := array_append(v_desired, 'loyalty_member'); END IF;
  IF v_completed >= 3 AND v_special_req::numeric / NULLIF(v_completed,0)::numeric >= 0.5
     THEN v_desired := array_append(v_desired, 'special_requests'); END IF;

  DELETE FROM public.customer_tag_assignments cta
  USING public.customer_tags ct
  WHERE cta.tag_id = ct.id
    AND cta.customer_id = p_customer_id
    AND ct.restaurant_id = v_customer.restaurant_id
    AND ct.is_system = true
    AND cta.is_auto  = true
    AND NOT (ct.system_key = ANY (v_desired));

  INSERT INTO public.customer_tag_assignments (customer_id, tag_id, is_auto, last_auto_refreshed_at, assigned_at)
  SELECT p_customer_id, ct.id, true, v_now, v_now
  FROM public.customer_tags ct
  WHERE ct.restaurant_id = v_customer.restaurant_id
    AND ct.is_system = true
    AND ct.system_key = ANY (v_desired)
  ON CONFLICT (customer_id, tag_id) DO UPDATE
    SET is_auto = true,
        last_auto_refreshed_at = v_now;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- refresh_restaurant_review_stats
CREATE OR REPLACE FUNCTION public.refresh_restaurant_review_stats(p_restaurant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_avg numeric := 0;
  v_cnt int := 0;
  v_food numeric := 0;
  v_service numeric := 0;
  v_ambiance numeric := 0;
  v_value numeric := 0;
  v_reco_pct numeric := 0;
  v_reco_cnt int := 0;
begin
  select
    coalesce(avg(rating)::numeric, 0),
    count(*),
    coalesce(avg(food_rating)::numeric, 0),
    coalesce(avg(service_rating)::numeric, 0),
    coalesce(avg(ambiance_rating)::numeric, 0),
    coalesce(avg(value_rating)::numeric, 0)
  into v_avg, v_cnt, v_food, v_service, v_ambiance, v_value
  from public.reviews
  where restaurant_id = p_restaurant_id;

  select count(*) into v_reco_cnt
  from public.reviews
  where restaurant_id = p_restaurant_id
    and recommend_to_friend is true;

  if v_cnt > 0 then
    v_reco_pct := round( (100.0 * v_reco_cnt / v_cnt)::numeric, 0 );
  else
    v_reco_pct := 0;
  end if;

  update public.restaurants r
  set
    average_rating = round(v_avg, 2),
    total_reviews  = v_cnt,
    review_summary = jsonb_build_object(
      'total_reviews', v_cnt,
      'average_rating', round(v_avg, 2),
      'detailed_ratings', jsonb_build_object(
        'food_avg',     round(v_food, 2),
        'value_avg',    round(v_value, 2),
        'service_avg',  round(v_service, 2),
        'ambiance_avg', round(v_ambiance, 2)
      ),
      'rating_distribution', jsonb_build_object(
        '1', (select count(*) from public.reviews where restaurant_id = p_restaurant_id and rating = 1),
        '2', (select count(*) from public.reviews where restaurant_id = p_restaurant_id and rating = 2),
        '3', (select count(*) from public.reviews where restaurant_id = p_restaurant_id and rating = 3),
        '4', (select count(*) from public.reviews where restaurant_id = p_restaurant_id and rating = 4),
        '5', (select count(*) from public.reviews where restaurant_id = p_restaurant_id and rating = 5)
      ),
      'recommendation_percentage', v_reco_pct
    ),
    updated_at = now()
  where r.id = p_restaurant_id;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- refresh_table_availability
CREATE OR REPLACE FUNCTION public.refresh_table_availability()
 RETURNS void
 LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_table_availability;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- refund_restaurant_loyalty_points
CREATE OR REPLACE FUNCTION public.refund_restaurant_loyalty_points(p_booking_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $$
DECLARE
  v_booking RECORD;
  v_current_balance integer;
  v_loyalty_activity RECORD;
BEGIN
  -- Get booking details with loyalty info
  SELECT b.*
  INTO v_booking
  FROM bookings b
  WHERE b.id = p_booking_id
    AND b.applied_loyalty_rule_id IS NOT NULL
    AND b.loyalty_points_earned > 0;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'No booking found with loyalty points to refund: %', p_booking_id;
    RETURN false;
  END IF;
  
  -- Get loyalty activity for this booking
  SELECT la.*
  INTO v_loyalty_activity
  FROM loyalty_activities la
  WHERE la.related_booking_id = p_booking_id
    AND la.activity_type = 'booking_completed'
    AND la.points_earned > 0;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'No loyalty activity found for booking: %', p_booking_id;
    RETURN false;
  END IF;
  
  -- Lock restaurant balance
  SELECT rlb.current_balance 
  INTO v_current_balance
  FROM restaurant_loyalty_balance rlb
  WHERE rlb.restaurant_id = v_booking.restaurant_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Restaurant balance not found: %', v_booking.restaurant_id;
    RETURN false;
  END IF;
  
  BEGIN
    -- Refund to restaurant balance
    UPDATE restaurant_loyalty_balance
    SET 
      current_balance = current_balance + v_booking.loyalty_points_earned,
      updated_at = now()
    WHERE restaurant_id = v_booking.restaurant_id;
    
    -- Record transaction
    INSERT INTO restaurant_loyalty_transactions (
      restaurant_id,
      transaction_type,
      points,
      balance_before,
      balance_after,
      description,
      booking_id,
      user_id
    ) VALUES (
      v_booking.restaurant_id,
      'refund',
      v_booking.loyalty_points_earned,
      v_current_balance,
      v_current_balance + v_booking.loyalty_points_earned,
      'Points refunded due to booking cancellation',
      p_booking_id,
      v_booking.user_id
    );
    
    -- Deduct points from user
    UPDATE profiles
    SET loyalty_points = GREATEST(0, loyalty_points - v_booking.loyalty_points_earned)
    WHERE id = v_booking.user_id;
    
    -- Update loyalty activity to negative (refund)
    UPDATE loyalty_activities
    SET 
      points_earned = -v_loyalty_activity.points_earned,
      description = v_loyalty_activity.description || ' (Refunded due to cancellation)',
      metadata = COALESCE(v_loyalty_activity.metadata, '{}'::jsonb) || jsonb_build_object('refunded_at', now(), 'reason', 'booking_cancelled')
    WHERE id = v_loyalty_activity.id;
    
    -- Update rule usage
    UPDATE restaurant_loyalty_rules
    SET current_uses = GREATEST(0, current_uses - 1)
    WHERE id = v_booking.applied_loyalty_rule_id;
    
    -- Remove user usage record
    DELETE FROM user_loyalty_rule_usage ulru
    WHERE ulru.booking_id = p_booking_id
      AND ulru.user_id = v_booking.user_id
      AND ulru.rule_id = v_booking.applied_loyalty_rule_id;
    
    -- Reset booking loyalty fields
    UPDATE bookings
    SET 
      loyalty_points_earned = 0,
      updated_at = now()
    WHERE id = p_booking_id;
    
    RAISE NOTICE 'Successfully refunded % points for booking %', v_booking.loyalty_points_earned, p_booking_id;
    RETURN true;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error refunding loyalty points: %', SQLERRM;
    RETURN false;
  END;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- restaurants_search_vector_update
CREATE OR REPLACE FUNCTION public.restaurants_search_vector_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.cuisine_type, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW.secondary_cuisines, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW.ambiance_tags, ' '), '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.address, '')), 'D');
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- run_booking_system_cleanup
CREATE OR REPLACE FUNCTION public.run_booking_system_cleanup()
 RETURNS json
 LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_temp json;
BEGIN
  -- Clean duplicate customers
  SELECT cleanup_duplicate_customers() INTO v_temp;
  v_result := v_result || jsonb_build_object('customer_cleanup', v_temp);
  
  -- Clean orphaned booking tables
  SELECT cleanup_orphaned_booking_tables() INTO v_temp;
  v_result := v_result || jsonb_build_object('booking_tables_cleanup', v_temp);
  
  -- Rebuild statistics for better performance
  ANALYZE bookings;
  ANALYZE booking_tables;
  ANALYZE restaurant_customers;
  
  v_result := v_result || jsonb_build_object(
    'statistics_rebuilt', true,
    'timestamp', now()
  );
  
  RETURN v_result::json;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- run_notify_delayed
CREATE OR REPLACE FUNCTION public.run_notify_delayed()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Wait 30 seconds then run notify
  PERFORM pg_sleep(30);
  PERFORM public.run_notify();
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- schedule_payment_reminder
CREATE OR REPLACE FUNCTION public.schedule_payment_reminder(p_booking_id uuid, p_user_id uuid, p_restaurant_name text, p_expires_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_outbox_id UUID;
  v_reminder_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Schedule reminder for 7 minutes after checkout opened (3 mins before expiry)
  v_reminder_time := p_expires_at - INTERVAL '3 minutes';
  
  -- Don't schedule if reminder time is in the past
  IF v_reminder_time <= NOW() THEN
    RETURN NULL;
  END IF;
  
  -- Insert into notification_outbox with scheduled_for time
  INSERT INTO public.notification_outbox (
    user_id,
    channel,
    type,
    priority,
    payload,
    scheduled_for
  ) VALUES (
    p_user_id,
    'push',
    'payment_reminder',
    'high',
    jsonb_build_object(
      'title', 'Complete Your Payment',
      'message', 'Your booking at ' || p_restaurant_name || ' requires payment. You have 3 minutes remaining.',
      'data', jsonb_build_object(
        'action', 'complete_payment',
        'bookingId', p_booking_id,
        'type', 'payment_reminder'
      ),
      'deeplink', 'plate://booking/' || p_booking_id
    ),
    v_reminder_time
  )
  RETURNING id INTO v_outbox_id;
  
  RETURN v_outbox_id;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- search_profiles_admin
CREATE OR REPLACE FUNCTION public.search_profiles_admin(search_query text)
 RETURNS TABLE(id uuid, email text, full_name text, phone_number text, membership_tier text, total_bookings integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  -- Cap at 8 seconds so the request fails fast rather than timing out the client
  SET LOCAL statement_timeout = '8s';

  IF search_query IS NULL OR length(trim(search_query)) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.phone_number,
    p.membership_tier,
    p.total_bookings,
    p.created_at
  FROM profiles p
  WHERE
    p.full_name    ILIKE '%' || trim(search_query) || '%'
    OR p.email     ILIKE '%' || trim(search_query) || '%'
    OR p.phone_number ILIKE '%' || trim(search_query) || '%'
  ORDER BY
    CASE
      WHEN p.full_name  ILIKE trim(search_query) THEN 0
      WHEN p.email      ILIKE trim(search_query) THEN 1
      ELSE 2
    END,
    p.full_name ASC
  LIMIT 50;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- search_restaurants
CREATE OR REPLACE FUNCTION public.search_restaurants(search_query text DEFAULT ''::text, user_lat double precision DEFAULT NULL::double precision, user_lng double precision DEFAULT NULL::double precision, max_distance_km double precision DEFAULT NULL::double precision, cuisine_filter text[] DEFAULT NULL::text[], min_rating double precision DEFAULT 0, price_range_filter integer[] DEFAULT NULL::integer[], booking_policy_filter text DEFAULT NULL::text, features_require text[] DEFAULT NULL::text[], has_special_offer boolean DEFAULT false, scratch_card_only boolean DEFAULT false, sort_by text DEFAULT 'recommended'::text, result_limit integer DEFAULT 200, result_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, name text, main_image_url text, cuisine_type text, secondary_cuisines text[], price_range integer, average_rating numeric, total_reviews integer, address text, latitude double precision, longitude double precision, booking_policy text, status text, featured boolean, featured_order integer, outdoor_seating boolean, valet_parking boolean, parking_available boolean, shisha_available boolean, scratch_card_enabled boolean, ambiance_tags text[], tier text, has_active_offer boolean, distance_km double precision, relevance_score double precision)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  has_search boolean;
  clean_query text;
  unaccented_query text;
  ts_query tsquery;
  synonym_cuisines text[];
  has_location boolean;
  user_point geography;
  has_name_matches boolean := false;
  query_len int;
BEGIN
  clean_query := LEFT(trim(coalesce(search_query, '')), 150);
  query_len := length(clean_query);
  has_search := query_len >= 2;
  has_location := user_lat IS NOT NULL AND user_lng IS NOT NULL;
  
  IF has_location THEN
    user_point := ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography;
  END IF;

  IF has_search THEN
    unaccented_query := unaccent(clean_query);

    BEGIN
      ts_query := websearch_to_tsquery('simple', clean_query);
    EXCEPTION WHEN OTHERS THEN
      ts_query := plainto_tsquery('simple', clean_query);
    END;
    
    SELECT array_agg(DISTINCT s.canonical_term)
    INTO synonym_cuisines
    FROM search_synonyms s
    WHERE lower(s.synonym) = lower(clean_query)
       OR lower(s.synonym) LIKE lower(clean_query) || '%'
       OR similarity(s.synonym, lower(clean_query)) > 0.5;

    SELECT EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.status = 'active'
        AND (lower(r.name) = lower(clean_query)
          OR r.name ILIKE clean_query || '%'
          OR r.name ILIKE '% ' || clean_query || '%'
          OR lower(unaccent(r.name)) = lower(unaccented_query)
          OR unaccent(r.name) ILIKE unaccented_query || '%'
          OR unaccent(r.name) ILIKE '% ' || unaccented_query || '%')
    ) INTO has_name_matches;
  END IF;

  RETURN QUERY
  SELECT
    r.id, r.name, r.main_image_url, r.cuisine_type, r.secondary_cuisines,
    r.price_range, r.average_rating, r.total_reviews, r.address,
    ST_Y(r.location::geometry) as latitude,
    ST_X(r.location::geometry) as longitude,
    r.booking_policy, r.status, r.featured, r.featured_order,
    COALESCE(r.outdoor_seating, false) as outdoor_seating,
    COALESCE(r.valet_parking, false) as valet_parking,
    COALESCE(r.parking_available, false) as parking_available,
    COALESCE(r.shisha_available, false) as shisha_available,
    r.scratch_card_enabled, r.ambiance_tags, r.tier::text,
    EXISTS (
      SELECT 1 FROM special_offers so
      WHERE so.restaurant_id = r.id
        AND so.valid_from <= now() AND so.valid_until >= now()
    ) as has_active_offer,
    CASE WHEN has_location THEN
      ST_Distance(r.location, user_point) / 1000.0
    ELSE NULL END as distance_km,

    CASE WHEN sort_by = 'recommended' OR sort_by IS NULL THEN
      (
        CASE WHEN has_search THEN
          CASE
            WHEN lower(r.name) = lower(clean_query)
              OR lower(unaccent(r.name)) = lower(unaccented_query) THEN 1.0
            WHEN lower(r.name) LIKE lower(clean_query) || '%'
              OR lower(unaccent(r.name)) LIKE lower(unaccented_query) || '%' THEN 0.85
            WHEN lower(r.name) LIKE '% ' || lower(clean_query) || '%'
              OR lower(r.name) LIKE '%(' || lower(clean_query) || '%'
              OR lower(r.name) LIKE '%- ' || lower(clean_query) || '%'
              OR lower(unaccent(r.name)) LIKE '% ' || lower(unaccented_query) || '%'
              OR lower(unaccent(r.name)) LIKE '%- ' || lower(unaccented_query) || '%' THEN 0.75
            WHEN lower(r.cuisine_type) = lower(clean_query)
              OR lower(r.cuisine_type) LIKE lower(clean_query) || '%'
              OR (synonym_cuisines IS NOT NULL AND r.cuisine_type = ANY(synonym_cuisines)) THEN 0.70
            WHEN r.search_vector @@ ts_query THEN
              CASE WHEN has_name_matches THEN
                0.30 + LEAST(ts_rank(r.search_vector, ts_query) * 1.5, 0.10)
              ELSE
                0.50 + LEAST(ts_rank(r.search_vector, ts_query) * 2.0, 0.15)
              END
            WHEN GREATEST(
              similarity(r.name, clean_query),
              similarity(unaccent(r.name), unaccented_query)
            ) > CASE WHEN query_len <= 4 THEN 0.2 ELSE 0.3 END THEN
              GREATEST(
                similarity(r.name, clean_query),
                similarity(unaccent(r.name), unaccented_query)
              ) * 0.7
            WHEN GREATEST(
              similarity(r.cuisine_type, clean_query),
              similarity(unaccent(r.cuisine_type), unaccented_query)
            ) > CASE WHEN query_len <= 4 THEN 0.25 ELSE 0.35 END THEN
              GREATEST(
                similarity(r.cuisine_type, clean_query),
                similarity(unaccent(r.cuisine_type), unaccented_query)
              ) * 0.5
            ELSE 0
          END * 0.40
        ELSE 0.40 END
        +
        CASE
          WHEN has_search AND (lower(r.name) = lower(clean_query)
            OR lower(unaccent(r.name)) = lower(unaccented_query)) THEN 0.20
          WHEN has_search AND (lower(r.name) LIKE lower(clean_query) || '%'
            OR lower(unaccent(r.name)) LIKE lower(unaccented_query) || '%') THEN 0.10
          ELSE 0
        END
        +
        CASE WHEN has_location THEN
          EXP(-1.0 * LEAST(ST_Distance(r.location, user_point) / 1000.0, 100.0) / 5.0) * 0.20
        ELSE 0.10 END
        +
        (COALESCE(r.average_rating, 0) / 5.0) * 0.15
        +
        LEAST(ln(GREATEST(COALESCE(r.total_reviews, 0), 1) + 1) / ln(101), 1.0) * 0.10
        +
        CASE WHEN COALESCE(r.featured, false) THEN 0.10 ELSE 0 END
        +
        CASE WHEN has_search AND r.search_vector @@ ts_query THEN 0.05 ELSE 0 END
      )
    WHEN sort_by = 'rating' THEN COALESCE(r.average_rating::double precision, 0)
    WHEN sort_by = 'distance' THEN
      CASE WHEN has_location THEN
        1000.0 - LEAST(ST_Distance(r.location, user_point) / 1000.0, 1000.0)
      ELSE 0 END
    ELSE 0 END as relevance_score

  FROM restaurants r
  WHERE 
    r.status = 'active'
    AND (
      NOT has_search
      OR lower(r.name) = lower(clean_query)
      OR r.name ILIKE clean_query || '%'
      OR r.name ILIKE '% ' || clean_query || '%'
      OR lower(unaccent(r.name)) = lower(unaccented_query)
      OR unaccent(r.name) ILIKE unaccented_query || '%'
      OR unaccent(r.name) ILIKE '% ' || unaccented_query || '%'
      OR lower(r.cuisine_type) = lower(clean_query)
      OR r.cuisine_type ILIKE clean_query || '%'
      OR r.search_vector @@ ts_query
      OR similarity(r.name, clean_query) >
        CASE WHEN query_len <= 4 THEN 0.2 ELSE 0.3 END
      OR similarity(unaccent(r.name), unaccented_query) >
        CASE WHEN query_len <= 4 THEN 0.2 ELSE 0.3 END
      OR similarity(r.cuisine_type, clean_query) >
        CASE WHEN query_len <= 4 THEN 0.25 ELSE 0.35 END
      OR (synonym_cuisines IS NOT NULL AND (
        r.cuisine_type = ANY(synonym_cuisines)
        OR r.secondary_cuisines && synonym_cuisines
      ))
    )
    AND (max_distance_km IS NULL OR NOT has_location
      OR ST_Distance(r.location, user_point) / 1000.0 <= max_distance_km)
    AND (cuisine_filter IS NULL OR array_length(cuisine_filter, 1) IS NULL
      OR r.cuisine_type = ANY(cuisine_filter) OR r.secondary_cuisines && cuisine_filter)
    AND COALESCE(r.average_rating, 0) >= COALESCE(min_rating, 0)
    AND (price_range_filter IS NULL OR array_length(price_range_filter, 1) IS NULL
      OR r.price_range = ANY(price_range_filter))
    AND (booking_policy_filter IS NULL OR booking_policy_filter = 'all'
      OR r.booking_policy = booking_policy_filter)
    AND (features_require IS NULL OR array_length(features_require, 1) IS NULL
      OR (
        (NOT 'outdoor_seating' = ANY(features_require) OR COALESCE(r.outdoor_seating, false) = true)
        AND (NOT 'valet_parking' = ANY(features_require) OR COALESCE(r.valet_parking, false) = true)
        AND (NOT 'parking_available' = ANY(features_require) OR COALESCE(r.parking_available, false) = true)
        AND (NOT 'shisha_available' = ANY(features_require) OR COALESCE(r.shisha_available, false) = true)
      ))
    AND (NOT COALESCE(has_special_offer, false) OR EXISTS (
      SELECT 1 FROM special_offers so WHERE so.restaurant_id = r.id
        AND so.valid_from <= now() AND so.valid_until >= now()))
    AND (NOT COALESCE(scratch_card_only, false) OR r.scratch_card_enabled = true)
  ORDER BY
    CASE WHEN sort_by = 'name' THEN r.name ELSE NULL END ASC NULLS LAST,
    relevance_score DESC NULLS LAST,
    r.featured_order ASC NULLS LAST
  LIMIT result_limit
  OFFSET result_offset;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- search_suggestions
CREATE OR REPLACE FUNCTION public.search_suggestions(prefix text, result_limit integer DEFAULT 6)
 RETURNS TABLE(suggestion_type text, value text, label text, score double precision, restaurant_id uuid)
 LANGUAGE plpgsql
 STABLE
AS $$
DECLARE
  clean_prefix text;
BEGIN
  clean_prefix := trim(coalesce(prefix, ''));
  IF length(clean_prefix) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH 
  -- Restaurant name matches (up to 4)
  restaurant_matches AS (
    SELECT 
      'restaurant'::text as suggestion_type,
      r.name as value,
      r.name || ' · ' || r.cuisine_type as label,
      CASE
        WHEN lower(r.name) = lower(clean_prefix) THEN 1.0
        WHEN lower(r.name) LIKE lower(clean_prefix) || '%' THEN 0.9
        WHEN lower(r.name) LIKE '% ' || lower(clean_prefix) || '%' THEN 0.8
        ELSE similarity(r.name, clean_prefix)::double precision
      END as score,
      r.id as restaurant_id
    FROM restaurants r
    WHERE r.status = 'active'
      AND (
        r.name ILIKE clean_prefix || '%'
        OR r.name ILIKE '% ' || clean_prefix || '%'
        OR similarity(r.name, clean_prefix) > 0.2
      )
    ORDER BY
      CASE 
        WHEN lower(r.name) = lower(clean_prefix) THEN 0
        WHEN lower(r.name) LIKE lower(clean_prefix) || '%' THEN 1
        ELSE 2
      END,
      similarity(r.name, clean_prefix) DESC
    LIMIT 4
  ),
  -- Cuisine type matches (up to 2)
  cuisine_matches AS (
    SELECT
      'cuisine'::text as suggestion_type,
      sub.cuisine_type as value,
      sub.cuisine_type || ' restaurants' as label,
      sub.sim as score,
      NULL::uuid as restaurant_id
    FROM (
      SELECT 
        r.cuisine_type,
        MAX(similarity(r.cuisine_type, clean_prefix))::double precision as sim
      FROM restaurants r
      WHERE r.status = 'active'
        AND (
          r.cuisine_type ILIKE clean_prefix || '%'
          OR similarity(r.cuisine_type, clean_prefix) > 0.3
        )
      GROUP BY r.cuisine_type
    ) sub
    ORDER BY sub.sim DESC
    LIMIT 2
  ),
  -- Synonym matches (up to 2)
  synonym_matches AS (
    SELECT
      'cuisine'::text as suggestion_type,
      sub.canonical_term as value,
      sub.canonical_term || ' restaurants' as label,
      sub.best_score as score,
      NULL::uuid as restaurant_id
    FROM (
      SELECT 
        s.canonical_term,
        MAX(
          CASE
            WHEN lower(s.synonym) = lower(clean_prefix) THEN 0.88
            WHEN lower(s.synonym) LIKE lower(clean_prefix) || '%' THEN 0.78
            ELSE similarity(s.synonym, lower(clean_prefix))::double precision
          END
        ) as best_score
      FROM search_synonyms s
      WHERE lower(s.synonym) LIKE lower(clean_prefix) || '%'
        OR similarity(s.synonym, lower(clean_prefix)) > 0.4
      GROUP BY s.canonical_term
    ) sub
    ORDER BY sub.best_score DESC
    LIMIT 2
  ),
  -- Combine all, deduplicate cuisine suggestions by value
  combined AS (
    SELECT * FROM restaurant_matches
    UNION ALL
    SELECT * FROM cuisine_matches
    UNION ALL
    (SELECT * FROM synonym_matches sm 
     WHERE NOT EXISTS (SELECT 1 FROM cuisine_matches cm WHERE cm.value = sm.value))
  )
  SELECT * FROM combined
  ORDER BY combined.score DESC
  LIMIT result_limit;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- send_invoice_email
CREATE OR REPLACE FUNCTION public.send_invoice_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  plate_secret_key text;
  api_url text := 'https://auth.plate-app.com/functions/v1/send-email';
  email_subject text;
  email_html text;
  request_body jsonb;
  request_id bigint;

  v_restaurant_name text;
  v_restaurant_address text;
  v_restaurant_image text;
  v_booking_time timestamptz;
  v_party_size int;
  v_is_event_booking boolean;
  
  fmt_date text;
  fmt_time text;
  fmt_map_link text;
  customer_display_name text;
  event_name text;
  
  -- Calendar variables
  cal_start text;
  cal_end text;
  google_cal_link text;
  
  -- Email content variables (different for event vs deposit)
  email_title text;
  email_body_text text;
  
BEGIN
  -- 1. Fetch Secret
  SELECT decrypted_secret INTO plate_secret_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'plate_secret_key' LIMIT 1;

  IF plate_secret_key IS NULL OR NEW.customer_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Fetch Data (including is_event_booking)
  SELECT 
    r.name, r.address, r.main_image_url, b.booking_time, b.party_size, COALESCE(b.is_event_booking, false)
  INTO 
    v_restaurant_name, v_restaurant_address, v_restaurant_image, v_booking_time, v_party_size, v_is_event_booking
  FROM public.bookings b
  JOIN public.restaurants r ON b.restaurant_id = r.id
  WHERE b.id = NEW.booking_id;

  -- Fallbacks
  v_restaurant_name := COALESCE(v_restaurant_name, 'The Venue');
  v_booking_time := COALESCE(v_booking_time, NEW.created_at);
  v_party_size := COALESCE(v_party_size, 1);

  -- Formatting
  customer_display_name := COALESCE(NEW.customer_name, 'Guest');
  event_name := COALESCE(NEW.order_description, 'Special Event');
  fmt_date := to_char(v_booking_time AT TIME ZONE 'Asia/Beirut', 'FMDay, Month FMDDth');
  fmt_time := to_char(v_booking_time AT TIME ZONE 'Asia/Beirut', 'FMHH12:MI AM');
  -- Fixed map link to standard Google redirect
  fmt_map_link := 'http://maps.google.com/?q=' || replace(v_restaurant_address, ' ', '+');

  -- 3. Set email content based on booking type
  IF v_is_event_booking THEN
    -- Event booking: payment confirms the booking
    email_subject := 'Booking Confirmed: ' || event_name || ' at ' || v_restaurant_name;
    email_title := 'Your booking was confirmed!';
    email_body_text := 'We''ve received your payment of <strong>' || NEW.order_amount || ' ' || NEW.order_currency || '</strong>. Your reservation for <strong>' || event_name || '</strong> is now confirmed.';
  ELSE
    -- Regular deposit: booking still needs restaurant confirmation
    email_subject := 'Deposit Received: ' || event_name || ' at ' || v_restaurant_name;
    email_title := 'We received your deposit!';
    email_body_text := 'We''ve received your deposit of <strong>' || NEW.order_amount || ' ' || NEW.order_currency || '</strong> for <strong>' || event_name || '</strong>. The restaurant will review your reservation request and confirm it shortly.';
  END IF;

  -- 4. Build Google Calendar Link
  cal_start := to_char(v_booking_time AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"');
  cal_end := to_char((v_booking_time + interval '2 hours') AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"');
  
  google_cal_link := 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' || 
    regexp_replace(event_name || ' at ' || v_restaurant_name, '[^a-zA-Z0-9 ]', '', 'g') ||
    '&dates=' || cal_start || '/' || cal_end ||
    '&details=' || regexp_replace('Booking for ' || v_party_size::text || ' guests', '[^a-zA-Z0-9 ]', '', 'g') ||
    '&location=' || regexp_replace(v_restaurant_address, '[^a-zA-Z0-9 ,]', '', 'g');

  -- 5. Build HTML (using variables for title and body text)
  email_html := format(
    '<!DOCTYPE html>
    <html>
    <body style="font-family: ''Helvetica Neue'', Helvetica, Arial, sans-serif; background-color: #FFFFFF; padding: 20px; margin: 0; color: #121212;">
      <div style="max-width: 520px; margin: 0 auto;">
        <div style="padding: 30px 30px 20px 30px; text-align: center;">
          <img src="https://auth.plate-app.com/storage/v1/object/public/logo/Logos%%20(3).png"
               alt="Plate Logo"
               style="height: 80px; width: auto; display: inline-block;">
        </div>

        <div style="background-color: #792339; border-radius: 18px; padding: 28px; color: #FFFFFF; margin-bottom: 30px;">
          <h1 style="margin: 0 0 20px 0; font-size: 26px; font-weight: 700; text-align: center;">
            %s
          </h1>
          
          <p style="font-size: 18px; margin-bottom: 10px;">Hi <strong>%s</strong>,</p>
          <p style="line-height: 1.7; font-size: 16px;">
            %s
          </p>

          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.3); margin: 20px 0;">

          <h2 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 600;">%s</h2>
          <p style="margin: 0 0 20px 0; font-size: 16px; opacity: 0.9;">%s</p>

          <table style="width: 100%%; border-spacing: 0 12px; color: #FFFFFF; font-size: 16px;">
            <tr>
              <td style="width: 32px;">📅</td>
              <td><strong>%s</strong></td>
            </tr>
            <tr>
              <td>⏰</td>
              <td><strong>%s</strong></td>
            </tr>
            <tr>
              <td>👥</td>
              <td><strong>%s Guests</strong></td>
            </tr>
            <tr>
              <td style="vertical-align: top;">📍</td>
              <td style="line-height: 1.4;">
                <a href="%s" style="color: #FFFFFF; text-decoration: underline;">%s</a>
              </td>
            </tr>
          </table>

          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.3); margin: 20px 0;">

          <div style="text-align: center; margin-top: 10px;">
            <a href="%s"
               style="display: inline-block; padding: 20px 40px; background-color: #FFFFFF; color: #792339; font-size: 18px; font-weight: 600; text-decoration: none; border-radius: 20px;">
               Add to Calendar
            </a>
          </div>
        </div>

        <hr style="border: 0; border-top: 2px solid #DDDDDD; margin: 20px 0;">

        <div style="background-color: #FFFFFF; color: #121212; padding: 40px 30px; border-radius: 18px; text-align: center;">
          <div style="margin-bottom: 30px;">
            <a href="https://apps.apple.com/jo/app/plate-no-call-no-wait/id6751504077" style="display:inline-block; margin: 10px;">
              <img src="https://auth.plate-app.com/storage/v1/object/public/logo/4.png" alt="App Store" style="height: 140px; width: auto;">
            </a>
            <a href="https://play.google.com/store/apps/details?id=com.notqwerty.plate" style="display:inline-block; margin: 10px;">
              <img src="https://auth.plate-app.com/storage/v1/object/public/logo/5.png" alt="Play Store" style="height: 140px; width: auto;">
            </a>
          </div>
          <div style="font-size: 14px; line-height: 1.6; color: #555555;">
            <p style="margin: 4px 0;">© 2026 Plate. All rights reserved.</p>
            <p style="margin: 4px 0;">
              <a href="https://www.plate-app.com/privacy" style="color: #555555; text-decoration: underline;">Privacy Policy</a> | 
              <a href="https://www.plate-app.com/terms" style="color: #555555; text-decoration: underline;">Terms of Service</a>
            </p>
            <p style="margin: 4px 0;">Email: info@plate-app.com | Phone: +961 3498485</p>
          </div>
        </div>
      </div>
    </body>
    </html>',
    email_title,
    customer_display_name,
    email_body_text,
    event_name,
    v_restaurant_name,
    fmt_date,
    fmt_time,
    v_party_size,
    fmt_map_link,
    v_restaurant_address,
    google_cal_link
  );

  -- 6. Send Request
  request_body := jsonb_build_object(
    'to', NEW.customer_email,
    'subject', email_subject,
    'html', email_html
  );

  SELECT net.http_post(
    url := api_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-plate-key', plate_secret_key
    ),
    body := request_body
  ) INTO request_id;

  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- send_invoice_whish_email
CREATE OR REPLACE FUNCTION public.send_invoice_whish_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'vault'
AS $$
DECLARE
  plate_secret_key text;
  api_url text := 'https://auth.plate-app.com/functions/v1/send-email';
  email_subject text;
  email_html text;
  request_body jsonb;
  request_id bigint;

  v_customer_email text;
  v_customer_name text;
  v_restaurant_name text;
  v_restaurant_address text;
  v_restaurant_image text;
  v_booking_time timestamptz;
  v_party_size int;
  
  fmt_date text;
  fmt_time text;
  fmt_map_link text;
  customer_display_name text;
  event_name text;
  
  -- Calendar variables
  cal_start text;
  cal_end text;
  google_cal_link text;
  
BEGIN
  -- A. Fetch Secret
  SELECT decrypted_secret INTO plate_secret_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'plate_secret_key' LIMIT 1;

  -- B. Fetch Booking & Restaurant Data
  SELECT 
    b.guest_email, 
    b.guest_name,
    r.name, 
    r.address, 
    r.main_image_url, 
    b.booking_time, 
    b.party_size,
    COALESCE(re.title, b.occasion, 'Special Event') as event_title
  INTO 
    v_customer_email,
    v_customer_name,
    v_restaurant_name, 
    v_restaurant_address, 
    v_restaurant_image, 
    v_booking_time, 
    v_party_size,
    event_name
  FROM public.bookings b
  JOIN public.restaurants r ON b.restaurant_id = r.id
  LEFT JOIN public.event_occurrences eo ON b.event_occurrence_id = eo.id
  LEFT JOIN public.restaurant_events re ON eo.event_id = re.id
  WHERE b.id = NEW.booking_id;

  -- Validate essential data
  IF plate_secret_key IS NULL OR v_customer_email IS NULL THEN
    RETURN NEW; -- Can't send email without key or recipient
  END IF;

  -- Fallbacks
  v_restaurant_name := COALESCE(v_restaurant_name, 'The Venue');
  v_booking_time := COALESCE(v_booking_time, NEW.created_at);
  v_party_size := COALESCE(v_party_size, 1);

  -- Formatting
  customer_display_name := COALESCE(v_customer_name, 'Guest'); 
  
  -- Use Beirut Time for display
  fmt_date := to_char(v_booking_time AT TIME ZONE 'Asia/Beirut', 'FMDay, Month FMDDth');
  fmt_time := to_char(v_booking_time AT TIME ZONE 'Asia/Beirut', 'FMHH12:MI AM');
  
  -- Fixed map link to standard Google redirect
  fmt_map_link := 'http://maps.google.com/?q=' || replace(COALESCE(v_restaurant_address, ''), ' ', '+');

  email_subject := 'Booking Confirmed: ' || event_name || ' at ' || v_restaurant_name;

  -- C. Build Google Calendar Link
  cal_start := to_char(v_booking_time AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"');
  cal_end := to_char((v_booking_time + interval '2 hours') AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"');
  
  google_cal_link := 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' || 
    regexp_replace(event_name || ' at ' || v_restaurant_name, '[^a-zA-Z0-9 ]', '', 'g') ||
    '&dates=' || cal_start || '/' || cal_end ||
    '&details=' || regexp_replace('Booking for ' || v_party_size::text || ' guests', '[^a-zA-Z0-9 ]', '', 'g') ||
    '&location=' || regexp_replace(COALESCE(v_restaurant_address, ''), '[^a-zA-Z0-9 ,]', '', 'g');

  -- D. Build HTML
  email_html := format(
    '<!DOCTYPE html>
    <html>
    <body style="font-family: ''Helvetica Neue'', Helvetica, Arial, sans-serif; background-color: #FFFFFF; padding: 20px; margin: 0; color: #121212;">
      <div style="max-width: 520px; margin: 0 auto;">
        <div style="padding: 30px 30px 20px 30px; text-align: center;">
          <img src="https://auth.plate-app.com/storage/v1/object/public/logo/Logos%%20(3).png"
               alt="Plate Logo"
               style="height: 80px; width: auto; display: inline-block;">
        </div>

        <div style="background-color: #792339; border-radius: 18px; padding: 28px; color: #FFFFFF; margin-bottom: 30px;">
          <h1 style="margin: 0 0 20px 0; font-size: 26px; font-weight: 700; text-align: center;">
            Your booking was confirmed!
          </h1>
          
          <p style="font-size: 18px; margin-bottom: 10px;">Hi <strong>%s</strong>,</p>
          <p style="line-height: 1.7; font-size: 16px;">
            We’ve received your payment of <strong>%s %s</strong>. Your reservation for <strong>%s</strong> is now confirmed.
          </p>

          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.3); margin: 20px 0;">

          <h2 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 600;">%s</h2>
          <p style="margin: 0 0 20px 0; font-size: 16px; opacity: 0.9;">%s</p>

          <table style="width: 100%%; border-spacing: 0 12px; color: #FFFFFF; font-size: 16px;">
            <tr>
              <td style="width: 32px;">📅</td>
              <td><strong>%s</strong></td>
            </tr>
            <tr>
              <td>⏰</td>
              <td><strong>%s</strong></td>
            </tr>
            <tr>
              <td>👥</td>
              <td><strong>%s Guests</strong></td>
            </tr>
            <tr>
              <td style="vertical-align: top;">📍</td>
              <td style="line-height: 1.4;">
                <a href="%s" style="color: #FFFFFF; text-decoration: underline;">%s</a>
              </td>
            </tr>
          </table>

          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.3); margin: 20px 0;">

          <div style="text-align: center; margin-top: 10px;">
            <a href="%s"
               style="display: inline-block; padding: 20px 40px; background-color: #FFFFFF; color: #792339; font-size: 18px; font-weight: 600; text-decoration: none; border-radius: 20px;">
               Add to Calendar
            </a>
          </div>
        </div>

        <hr style="border: 0; border-top: 2px solid #DDDDDD; margin: 20px 0;">

        <div style="background-color: #FFFFFF; color: #121212; padding: 40px 30px; border-radius: 18px; text-align: center;">
          <div style="margin-bottom: 30px;">
            <a href="https://apps.apple.com/jo/app/plate-no-call-no-wait/id6751504077" style="display:inline-block; margin: 10px;">
              <img src="https://auth.plate-app.com/storage/v1/object/public/logo/4.png" alt="App Store" style="height: 140px; width: auto;">
            </a>
            <a href="https://play.google.com/store/apps/details?id=com.notqwerty.plate" style="display:inline-block; margin: 10px;">
              <img src="https://auth.plate-app.com/storage/v1/object/public/logo/5.png" alt="Play Store" style="height: 140px; width: auto;">
            </a>
          </div>
          <div style="font-size: 14px; line-height: 1.6; color: #555555;">
            <p style="margin: 4px 0;">© 2026 Plate. All rights reserved.</p>
            <p style="margin: 4px 0;">
              <a href="https://www.plate-app.com/privacy" style="color: #555555; text-decoration: underline;">Privacy Policy</a> | 
              <a href="https://www.plate-app.com/terms" style="color: #555555; text-decoration: underline;">Terms of Service</a>
            </p>
            <p style="margin: 4px 0;">Email: info@plate-app.com | Phone: +961 3498485</p>
          </div>
        </div>
      </div>
    </body>
    </html>',
    customer_display_name,
    NEW.amount,       
    NEW.currency,     
    event_name,
    event_name,
    v_restaurant_name,
    fmt_date,
    fmt_time,
    v_party_size,
    fmt_map_link,
    v_restaurant_address,
    google_cal_link
  );

  -- E. Send Request
  request_body := jsonb_build_object(
    'to', v_customer_email,
    'subject', email_subject,
    'html', email_html
  );

  SELECT net.http_post(
    url := api_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-plate-key', plate_secret_key
    ),
    body := request_body
  ) INTO request_id;

  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- send_push_notification
CREATE OR REPLACE FUNCTION public.send_push_notification(p_user_id uuid, p_title text, p_body text, p_data jsonb DEFAULT NULL::jsonb, p_priority text DEFAULT 'default'::text, p_notification_type text DEFAULT 'general'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    function_url TEXT;
    payload JSONB;
    response TEXT;
BEGIN
    -- Check if user should receive this notification
    IF NOT should_send_notification(p_user_id, p_notification_type) THEN
        RAISE NOTICE 'Notification blocked by user preferences: % for user %', p_notification_type, p_user_id;
        RETURN;
    END IF;
    
    -- Get the Supabase function URL from environment or use default
    function_url := current_setting('app.supabase_url', true) || '/functions/v1/send-push-notification';
    
    -- Prepare payload
    payload := jsonb_build_object(
        'userId', p_user_id,
        'title', p_title,
        'body', p_body,
        'data', COALESCE(p_data, '{}'::jsonb),
        'priority', p_priority
    );
    
    -- Call the Edge Function asynchronously using pg_net (if available)
    BEGIN
        SELECT net.http_post(
            url := function_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
            ),
            body := payload
        ) INTO response;
    EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the main transaction
        RAISE WARNING 'Failed to send push notification: %', SQLERRM;
    END;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- set_booking_modifier
CREATE OR REPLACE FUNCTION public.set_booking_modifier()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  -- Only set if cancelled_by_staff or declined_by_staff is set
  IF NEW.cancelled_by_staff IS NOT NULL THEN
    NEW.last_modified_by := NEW.cancelled_by_staff;
  ELSIF NEW.declined_by_staff IS NOT NULL THEN
    NEW.last_modified_by := NEW.declined_by_staff;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- set_booking_request_expiry
CREATE OR REPLACE FUNCTION public.set_booking_request_expiry()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  -- Only set expiry for bookings that start as 'pending' (requests)
  IF NEW.status = 'pending' THEN
    NEW.request_expires_at := NEW.booking_time - interval '10 minutes';
  ELSE
    -- For instant bookings (confirmed, etc.), clear the expiry
    NEW.request_expires_at := NULL;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- set_share_code
CREATE OR REPLACE FUNCTION public.set_share_code()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_public = true AND NEW.share_code IS NULL THEN
    LOOP
      NEW.share_code := generate_share_code();
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM restaurant_playlists 
        WHERE share_code = NEW.share_code AND id != NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
begin
  new.updated_at = now();
  return new;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- set_user_offer_expiry
CREATE OR REPLACE FUNCTION public.set_user_offer_expiry()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  -- Set expiry date if not provided
  IF NEW.expires_at IS NULL THEN
    SELECT calculate_offer_expiry(
      NEW.claimed_at,
      so.valid_until
    ) INTO NEW.expires_at
    FROM special_offers so
    WHERE so.id = NEW.offer_id;
  END IF;
  
  -- Set redemption code if not provided
  IF NEW.redemption_code IS NULL THEN
    NEW.redemption_code := encode(gen_random_bytes(8), 'hex');
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- should_block_pending_bookings
CREATE OR REPLACE FUNCTION public.should_block_pending_bookings(p_restaurant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $$
DECLARE
  v_booking_policy text;
BEGIN
  SELECT booking_policy INTO v_booking_policy
  FROM restaurants
  WHERE id = p_restaurant_id;
  
  -- For request bookings, we should still block the slot even if pending
  -- to prevent double bookings while restaurant is reviewing
  RETURN v_booking_policy = 'request';
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- should_notify_restaurant
CREATE OR REPLACE FUNCTION public.should_notify_restaurant(p_restaurant_id uuid, p_notification_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    v_enabled boolean;
BEGIN
    -- Check existing preferences table (if staff user exists)
    SELECT 
        CASE p_notification_type
            WHEN 'new_booking' THEN COALESCE(new_bookings, true)
            WHEN 'booking_cancelled' THEN COALESCE(cancellations, true)
            WHEN 'booking_modified' THEN COALESCE(modifications, true)
            ELSE true
        END
    INTO v_enabled
    FROM public.restaurant_notification_preferences
    WHERE restaurant_id = p_restaurant_id
    LIMIT 1;

    RETURN COALESCE(v_enabled, true);
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- should_send_notification
CREATE OR REPLACE FUNCTION public.should_send_notification(p_user_id uuid, p_notification_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    prefs user_notification_prefs;
    current_time_val TIME;
    should_send BOOLEAN := false;
BEGIN
    -- Get user preferences
    prefs := get_user_notification_preferences(p_user_id);
    
    -- Check if push notifications are globally disabled
    IF NOT prefs.push_notifications_enabled THEN
        RETURN false;
    END IF;
    
    -- Check quiet hours
    IF prefs.quiet_hours_enabled THEN
        current_time_val := CURRENT_TIME;
        
        -- Handle quiet hours that span midnight
        IF prefs.quiet_hours_start > prefs.quiet_hours_end THEN
            -- Quiet hours span midnight (e.g., 22:00 to 08:00)
            IF current_time_val >= prefs.quiet_hours_start OR current_time_val <= prefs.quiet_hours_end THEN
                RETURN false;
            END IF;
        ELSE
            -- Normal quiet hours (e.g., 01:00 to 06:00)
            IF current_time_val >= prefs.quiet_hours_start AND current_time_val <= prefs.quiet_hours_end THEN
                RETURN false;
            END IF;
        END IF;
    END IF;
    
    -- Check specific notification type preferences
    CASE p_notification_type
        WHEN 'booking_confirmation' THEN should_send := prefs.booking_confirmations;
        WHEN 'booking_reminder' THEN should_send := prefs.booking_reminders;
        WHEN 'booking_cancellation' THEN should_send := prefs.booking_cancellations;
        WHEN 'booking_modification' THEN should_send := prefs.booking_modifications;
        
        WHEN 'waitlist_available' THEN should_send := prefs.waitlist_available;
        WHEN 'waitlist_position_update' THEN should_send := prefs.waitlist_position_updates;
        WHEN 'waitlist_expired' THEN should_send := prefs.waitlist_expired;
        
        WHEN 'special_offer' THEN should_send := prefs.special_offers;
        WHEN 'loyalty_offer' THEN should_send := prefs.loyalty_offers;
        WHEN 'expiring_offer' THEN should_send := prefs.expiring_offers;
        
        WHEN 'review_reminder' THEN should_send := prefs.review_reminders;
        WHEN 'review_response' THEN should_send := prefs.review_responses;
        WHEN 'review_featured' THEN should_send := prefs.review_featured;
        
        WHEN 'points_earned' THEN should_send := prefs.points_earned;
        WHEN 'milestone_reached' THEN should_send := prefs.milestone_reached;
        WHEN 'reward_available' THEN should_send := prefs.rewards_available;
        WHEN 'reward_expiring' THEN should_send := prefs.rewards_expiring;
        
        WHEN 'app_update' THEN should_send := prefs.app_updates;
        WHEN 'maintenance_notice' THEN should_send := prefs.maintenance_notices;
        WHEN 'security_alert' THEN should_send := prefs.security_alerts;
        
        ELSE should_send := true; -- Default to true for unknown types
    END CASE;
    
    RETURN should_send;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- stop_repeating_notification
CREATE OR REPLACE FUNCTION public.stop_repeating_notification(p_booking_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.restaurant_notification_outbox
    SET repeat_enabled = false, repeat_until = NOW()
    WHERE booking_id = p_booking_id AND repeat_enabled = true;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- suggest_optimal_tables
CREATE OR REPLACE FUNCTION public.suggest_optimal_tables(p_restaurant_id uuid, p_party_size integer, p_start_time timestamp with time zone, p_end_time timestamp with time zone)
 RETURNS TABLE(table_ids uuid[], total_capacity integer, requires_combination boolean)
 LANGUAGE plpgsql
AS $$
DECLARE
  v_single_table RECORD;
  v_combination UUID[];
  v_total_cap INTEGER;
BEGIN
  -- First, try to find a single table
  SELECT t.id, t.capacity
  INTO v_single_table
  FROM restaurant_tables t
  WHERE t.restaurant_id = p_restaurant_id
    AND t.is_active = true
    AND t.capacity >= p_party_size
    AND COALESCE(t.min_capacity, 1) <= p_party_size
    AND NOT EXISTS (
      SELECT 1 FROM booking_tables bt
      INNER JOIN bookings b ON bt.booking_id = b.id
      WHERE bt.table_id = t.id
        AND b.status NOT IN ('cancelled_by_user', 'declined_by_restaurant', 'no_show')
        AND (b.booking_time < p_end_time) 
        AND (b.booking_time + INTERVAL '1 minute' * COALESCE(b.turn_time_minutes, 120) > p_start_time)
    )
  ORDER BY 
    ABS(t.capacity - p_party_size), -- Prefer closer capacity
    t.priority_score DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT ARRAY[v_single_table.id], v_single_table.capacity, false;
    RETURN;
  END IF;

  -- If no single table, try combinations (simplified for 2 tables)
  SELECT ARRAY[t1.id, t2.id], t1.capacity + t2.capacity
  INTO v_combination, v_total_cap
  FROM restaurant_tables t1
  CROSS JOIN restaurant_tables t2
  WHERE t1.restaurant_id = p_restaurant_id
    AND t2.restaurant_id = p_restaurant_id
    AND t1.id < t2.id -- Avoid duplicates
    AND t1.is_active = true
    AND t2.is_active = true
    AND t1.is_combinable = true
    AND t2.is_combinable = true
    AND (t1.capacity + t2.capacity) >= p_party_size
    AND (COALESCE(t1.min_capacity, 1) + COALESCE(t2.min_capacity, 1)) <= p_party_size
    -- Check both tables are available
    AND NOT EXISTS (
      SELECT 1 FROM booking_tables bt
      INNER JOIN bookings b ON bt.booking_id = b.id
      WHERE bt.table_id IN (t1.id, t2.id)
        AND b.status NOT IN ('cancelled_by_user', 'declined_by_restaurant', 'no_show')
        AND (b.booking_time < p_end_time) 
        AND (b.booking_time + INTERVAL '1 minute' * COALESCE(b.turn_time_minutes, 120) > p_start_time)
    )
  ORDER BY 
    ABS((t1.capacity + t2.capacity) - p_party_size), -- Prefer closer capacity
    (t1.priority_score + t2.priority_score) DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_combination, v_total_cap, true;
  END IF;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- sync_customer_names
CREATE OR REPLACE FUNCTION public.sync_customer_names()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  -- Update customer names when profile full_name changes
  IF OLD.full_name IS DISTINCT FROM NEW.full_name THEN
    UPDATE restaurant_customers
    SET 
      guest_name = NEW.full_name,
      updated_at = now()
    WHERE user_id = NEW.id
    AND (guest_name IS NULL OR guest_name = OLD.full_name);
    
    RAISE LOG 'Synced customer names for user_id: %', NEW.id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- sync_notification_prefs_from_privacy
CREATE OR REPLACE FUNCTION public.sync_notification_prefs_from_privacy()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id, booking, booking_reminders, waitlist, offers, reviews, loyalty, marketing, system, security)
  VALUES (NEW.user_id, TRUE, COALESCE(NEW.push_notifications, TRUE), TRUE, COALESCE(NEW.marketing_emails, TRUE), TRUE, TRUE, COALESCE(NEW.marketing_emails, FALSE), TRUE, TRUE)
  ON CONFLICT (user_id) DO UPDATE SET
    booking_reminders = EXCLUDED.booking_reminders,
    offers = EXCLUDED.offers,
    marketing = EXCLUDED.marketing,
    updated_at = now();
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- sync_restaurant_lat_lng
CREATE OR REPLACE FUNCTION public.sync_restaurant_lat_lng()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.location IS DISTINCT FROM OLD.location THEN
    NEW.latitude := ST_Y(NEW.location::geometry);
    NEW.longitude := ST_X(NEW.location::geometry);
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- tg_notify_booking_invite_created
CREATE OR REPLACE FUNCTION public.tg_notify_booking_invite_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_inviter_name    text;
  v_restaurant_name text;
  v_booking_time    timestamptz;
  v_formatted_date  text;
  v_title           text;
  v_body            text;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  IF NEW.from_user_id = NEW.to_user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, NULLIF(trim(first_name || ' ' || last_name), ''), 'Someone')
    INTO v_inviter_name
  FROM public.profiles
  WHERE id = NEW.from_user_id;

  SELECT r.name, b.booking_time
    INTO v_restaurant_name, v_booking_time
  FROM public.bookings b
  JOIN public.restaurants r ON r.id = b.restaurant_id
  WHERE b.id = NEW.booking_id;

  v_formatted_date := to_char(
    v_booking_time AT TIME ZONE 'Asia/Beirut',
    'FMDay, DD Mon at HH:MI AM'
  );

  v_title := v_inviter_name || ' invited you to dinner';
  v_body := format(
    'Join %s at %s on %s',
    v_inviter_name,
    COALESCE(v_restaurant_name, 'a restaurant'),
    v_formatted_date
  );

  PERFORM public.enqueue_notification(
    NEW.to_user_id,
    'social',
    'booking_invite_received',
    v_title,
    v_body,
    jsonb_build_object(
      'inviteId',       NEW.id,
      'bookingId',      NEW.booking_id,
      'fromUserId',     NEW.from_user_id,
      'fromUserName',   v_inviter_name,
      'restaurantName', v_restaurant_name,
      'customMessage',  NEW.message
    ),
    'plate://invitations',
    ARRAY['push', 'inapp']
  );

  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- tg_notify_booking_update
CREATE OR REPLACE FUNCTION public.tg_notify_booking_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
 DECLARE
     v_title text;
     v_msg text;
     v_type text;
     v_data jsonb;
     v_deeplink text;
     v_restaurant_name text;
     v_formatted_date text;
 BEGIN
     v_deeplink := concat('plate://booking/', NEW.id::text);

     SELECT name INTO v_restaurant_name FROM public.restaurants WHERE id = NEW.restaurant_id;

     v_formatted_date := to_char(NEW.booking_time AT TIME ZONE 'Asia/Beirut', 'FMDay, DD Mon YYYY at HH:MI AM');

     IF (TG_OP = 'INSERT') THEN
         IF (NEW.status = 'confirmed') THEN
             v_title := 'You''re all set';
             v_msg := format('Your table at %s on %s for %s is confirmed.', v_restaurant_name, v_formatted_date, NEW.party_size);
             v_type := 'booking_confirmed';
         ELSIF (NEW.status = 'pending') THEN
             v_title := 'Booking Placed';
             v_msg := format('Your booking at %s is placed. If the restaurant can''t accommodate you at this time, we''ll let you know right away.', v_restaurant_name);
             v_type := 'booking_request_submitted';
         END IF;
     ELSIF (TG_OP = 'UPDATE') THEN
         IF (OLD.status IS DISTINCT FROM NEW.status) THEN
             IF (NEW.status = 'confirmed' AND OLD.status = 'pending') THEN
                 v_title := 'You''re all set';
                 v_msg := format('Your table at %s on %s for %s is confirmed.', v_restaurant_name, v_formatted_date, NEW.party_size);
                 v_type := 'booking_confirmed';
             ELSIF (NEW.status = 'declined_by_restaurant') THEN
                 v_title := 'Booking update';
                 v_msg := format('%s could not accommodate your booking.', v_restaurant_name);
                 v_type := 'booking_declined';
             ELSIF (NEW.status = 'cancelled_by_user' OR NEW.status = 'cancelled_by_restaurant') THEN
                 v_title := 'Booking Cancelled';
                 v_msg := 'Your booking has been cancelled.';
                 v_type := 'booking_cancelled';
             END IF;
         END IF;
     END IF;

     IF v_type IS NOT NULL THEN
         v_data := jsonb_build_object(
             'bookingId', NEW.id,
             'restaurantId', NEW.restaurant_id,
             'status', NEW.status
         );

         PERFORM public.enqueue_notification(
             NEW.user_id,
             'booking',
             v_type,
             v_title,
             v_msg,
             v_data,
             v_deeplink,
             ARRAY['inapp', 'push']
         );
     END IF;

     RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- tg_notify_loyalty_activity
CREATE OR REPLACE FUNCTION public.tg_notify_loyalty_activity()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.enqueue_notification(NEW.user_id, 'loyalty', 'loyalty_points',
    'Loyalty Points Update', 'Your loyalty balance has changed.',
    jsonb_build_object('activityId', NEW.id, 'points', NEW.points_earned, 'activityType', NEW.activity_type),
    'plate://profile/loyalty', ARRAY['inapp','push']);
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- tg_notify_restaurant_booking_push
CREATE OR REPLACE FUNCTION public.tg_notify_restaurant_booking_push()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
DECLARE
    v_restaurant_name text;
    v_guest_name text;
    v_party_size int;
    v_booking_time timestamptz;
    v_title text;
    v_body text;
    v_type text;
    v_data jsonb;
    v_repeat_enabled boolean;
BEGIN
    -- Get restaurant name
    SELECT name INTO v_restaurant_name FROM public.restaurants WHERE id = NEW.restaurant_id;

    -- Get booking details
    v_guest_name := COALESCE(NEW.guest_name, 'Guest');
    v_party_size := NEW.party_size;
    v_booking_time := NEW.booking_time;

    -- Determine notification type
    IF (TG_OP = 'INSERT' AND NEW.status = 'pending') THEN
        -- NEW BOOKING - Enable repeating
        v_type := 'new_booking';
        v_title := '🎉 New Booking Request!';
        v_body := format('%s • %s %s • %s',
            v_guest_name, v_party_size,
            CASE WHEN v_party_size = 1 THEN 'guest' ELSE 'guests' END,
            to_char(v_booking_time, 'Mon DD at HH12:MI AM')
        );
        v_repeat_enabled := true;

    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'cancelled_by_user') THEN
        -- CANCELLED - Stop repeating
        v_type := 'booking_cancelled';
        v_title := '❌ Booking Cancelled';
        v_body := format('%s cancelled their booking', v_guest_name);
        v_repeat_enabled := false;
        PERFORM public.stop_repeating_notification(NEW.id);

    ELSIF (TG_OP = 'UPDATE' AND (OLD.booking_time != NEW.booking_time OR OLD.party_size != NEW.party_size)) THEN
        -- MODIFIED
        v_type := 'booking_modified';
        v_title := '📝 Booking Modified';
        v_body := format('%s updated their booking', v_guest_name);
        v_repeat_enabled := false;

    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status IN ('confirmed', 'declined_by_restaurant')) THEN
        -- HANDLED - Stop repeating
        PERFORM public.stop_repeating_notification(NEW.id);
        RETURN NEW;

    ELSE
        RETURN NEW;
    END IF;

    -- Build data payload
    v_data := jsonb_build_object(
        'bookingId', NEW.id,
        'restaurantId', NEW.restaurant_id,
        'restaurantName', v_restaurant_name,
        'guestName', v_guest_name,
        'partySize', v_party_size,
        'bookingTime', v_booking_time,
        'status', NEW.status,
        'createdAt', NEW.created_at,
        'deeplink', format('platemerchant://booking/%s', NEW.id)
    );

    -- Enqueue notification
    IF public.should_notify_restaurant(NEW.restaurant_id, v_type) THEN
        PERFORM public.enqueue_restaurant_notification(
            NEW.restaurant_id, v_type, v_title, v_body, v_data, NEW.id,
            'high', v_repeat_enabled, 30, 300
        );
    END IF;

    RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- tg_notify_review_response
CREATE OR REPLACE FUNCTION public.tg_notify_review_response()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
DECLARE
  v_title text;
  v_msg text;
  v_type text;
  v_data jsonb;
  v_restaurant_name text;
BEGIN
  SELECT name INTO v_restaurant_name 
  FROM public.restaurants 
  WHERE id = NEW.restaurant_id;
  
  IF v_restaurant_name IS NULL THEN
    v_restaurant_name := 'A restaurant';
  END IF;
  
  v_title := 'Restaurant Response';
  v_msg := v_restaurant_name || ' has replied to your review.';
  v_type := 'review_response';
  
  v_data := jsonb_build_object(
    'reviewId', NEW.review_id, 
    'restaurantId', NEW.restaurant_id,
    'restaurantName', v_restaurant_name
  );
  
  PERFORM public.enqueue_notification(
    (SELECT user_id FROM public.reviews WHERE id = NEW.review_id), 
    'reviews', 
    v_type, 
    v_title, 
    v_msg, 
    v_data, 
    'plate://profile/reviews', 
    ARRAY['inapp','push']
  );
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- tg_notify_user_offers
CREATE OR REPLACE FUNCTION public.tg_notify_user_offers()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.enqueue_notification(NEW.user_id, 'offers', 'offer_assigned',
      'New Offer Available', 'You have a new promotion you can use.',
      jsonb_build_object('userOfferId', NEW.id, 'offerId', NEW.offer_id, 'expiresAt', NEW.expires_at),
      'plate://profile/my-rewards', ARRAY['inapp','push']);
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.used_at IS NULL AND NEW.used_at IS NOT NULL) THEN
      PERFORM public.enqueue_notification(NEW.user_id, 'offers', 'offer_redeemed',
        'Offer Redeemed', 'You redeemed an offer.',
        jsonb_build_object('userOfferId', NEW.id, 'offerId', NEW.offer_id, 'bookingId', NEW.booking_id),
        'plate://profile/my-rewards', ARRAY['inapp','push']);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- tg_notify_waitlist_update
CREATE OR REPLACE FUNCTION public.tg_notify_waitlist_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
DECLARE
  v_title text;
  v_msg text;
  v_type text;
  v_data jsonb;
  v_deeplink text;
  v_restaurant_name text;
BEGIN
  SELECT name INTO v_restaurant_name 
  FROM public.restaurants 
  WHERE id = NEW.restaurant_id;
  
  IF v_restaurant_name IS NULL THEN
    v_restaurant_name := 'the restaurant';
  END IF;
  
  v_deeplink := 'plate://waiting-list';
  
  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      IF (NEW.status = 'notified') THEN
        v_title := 'Table Available!';
        v_msg := 'A table at ' || v_restaurant_name || ' is available in your selected time range.';
        v_type := 'waiting_list_available';
      ELSIF (NEW.status = 'booked') THEN
        v_title := 'Waitlist Converted';
        v_msg := 'Your waitlist entry at ' || v_restaurant_name || ' has been converted into a booking!';
        v_type := 'waiting_list_converted';
      END IF;
      
      IF v_type IS NOT NULL AND NEW.user_id IS NOT NULL THEN
        v_data := jsonb_build_object(
          'entryId', NEW.id, 
          'restaurantId', NEW.restaurant_id,
          'restaurantName', v_restaurant_name,
          'desiredDate', NEW.desired_date, 
          'timeRange', NEW.desired_time_range
        );
        PERFORM public.enqueue_notification(NEW.user_id, 'waitlist', v_type, v_title, v_msg, v_data, v_deeplink, ARRAY['inapp','push']);
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- tg_release_promo_on_cancellation
CREATE OR REPLACE FUNCTION public.tg_release_promo_on_cancellation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('cancelled_by_user', 'cancelled_by_restaurant') THEN
    RETURN NEW;
  END IF;
  UPDATE public.promo_code_redemptions
  SET released_at = now()
  WHERE booking_id = NEW.id
    AND released_at IS NULL;
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- tg_sync_promo_code_uses
CREATE OR REPLACE FUNCTION public.tg_sync_promo_code_uses()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.released_at IS NULL THEN
    UPDATE public.promo_codes
    SET current_uses = current_uses + 1,
        updated_at   = now()
    WHERE id = NEW.promo_code_id;
  ELSIF TG_OP = 'UPDATE'
    AND OLD.released_at IS NULL
    AND NEW.released_at IS NOT NULL
  THEN
    UPDATE public.promo_codes
    SET current_uses = GREATEST(current_uses - 1, 0),
        updated_at   = now()
    WHERE id = NEW.promo_code_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- toggle_favorite
CREATE OR REPLACE FUNCTION public.toggle_favorite(restaurant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF EXISTS(
    SELECT 1 FROM favorites 
    WHERE user_id = uid 
    AND favorites.restaurant_id = toggle_favorite.restaurant_id
  ) THEN
    DELETE FROM favorites 
    WHERE user_id = uid 
    AND favorites.restaurant_id = toggle_favorite.restaurant_id;
  ELSE
    INSERT INTO favorites (user_id, restaurant_id) 
    VALUES (uid, toggle_favorite.restaurant_id);
  END IF;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- touch_admin_permissions_updated_at
CREATE OR REPLACE FUNCTION public.touch_admin_permissions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- trg_reviews_after_change
CREATE OR REPLACE FUNCTION public.trg_reviews_after_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_restaurant_review_stats(new.restaurant_id);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.restaurant_id is distinct from old.restaurant_id then
      perform public.refresh_restaurant_review_stats(old.restaurant_id);
      perform public.refresh_restaurant_review_stats(new.restaurant_id);
    else
      perform public.refresh_restaurant_review_stats(new.restaurant_id);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.refresh_restaurant_review_stats(old.restaurant_id);
    return old;
  end if;
  return null;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- trigger_refresh_availability
CREATE OR REPLACE FUNCTION public.trigger_refresh_availability()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  -- Use pg_notify to trigger async refresh
  PERFORM pg_notify('refresh_availability', json_build_object(
    'table', TG_TABLE_NAME,
    'operation', TG_OP,
    'time', now()
  )::text);
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- trigger_update_user_rating
CREATE OR REPLACE FUNCTION public.trigger_update_user_rating()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  -- Skip user rating updates for guest bookings (no user_id)
  IF NEW.user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Only update rating for status changes that affect rating
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Update total booking counts in profiles
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
      UPDATE profiles SET completed_bookings = completed_bookings + 1 WHERE id = NEW.user_id;
    END IF;
    
    IF NEW.status = 'no_show' AND OLD.status != 'no_show' THEN
      UPDATE profiles SET no_show_bookings = no_show_bookings + 1 WHERE id = NEW.user_id;
    END IF;
    
    IF NEW.status IN ('cancelled_by_user') AND OLD.status NOT IN ('cancelled_by_user') THEN
      UPDATE profiles SET cancelled_bookings = cancelled_bookings + 1 WHERE id = NEW.user_id;
    END IF;
    
    -- Recalculate rating
    PERFORM update_user_rating(NEW.user_id, NEW.id, 'Booking status changed to ' || NEW.status);
  END IF;
  
  -- Also update on INSERT for new bookings
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET total_bookings = total_bookings + 1 WHERE id = NEW.user_id;
    PERFORM update_user_rating(NEW.user_id, NEW.id, 'New booking created');
  END IF;
  
  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_all_customer_statistics
CREATE OR REPLACE FUNCTION public.update_all_customer_statistics()
 RETURNS void
 LANGUAGE plpgsql
AS $$
DECLARE
  customer_record RECORD;
  stats_record RECORD;
  processed_count integer := 0;
BEGIN
  RAISE NOTICE 'Starting customer statistics update...';
  
  -- Loop through all customers and calculate their statistics
  FOR customer_record IN 
    SELECT id, restaurant_id, user_id, guest_email
    FROM restaurant_customers
    ORDER BY restaurant_id, id
  LOOP
    -- Calculate statistics for this customer
    SELECT 
      COUNT(CASE WHEN b.status IN ('confirmed', 'completed') THEN 1 END) as total_bookings,
      COUNT(CASE WHEN b.status = 'no_show' THEN 1 END) as no_show_count,
      COUNT(CASE WHEN b.status LIKE 'cancelled%' THEN 1 END) as cancelled_count,
      ROUND(AVG(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.party_size END), 1) as average_party_size,
      MIN(b.booking_time) as first_visit,
      MAX(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.booking_time END) as last_visit
    INTO stats_record
    FROM bookings b
    WHERE b.restaurant_id = customer_record.restaurant_id
    AND (
      (customer_record.user_id IS NOT NULL AND b.user_id = customer_record.user_id) OR
      (customer_record.user_id IS NULL AND b.guest_email = customer_record.guest_email)
    );
    
    -- Update the customer record with calculated statistics
    UPDATE restaurant_customers
    SET 
      total_bookings = COALESCE(stats_record.total_bookings, 0),
      no_show_count = COALESCE(stats_record.no_show_count, 0),
      cancelled_count = COALESCE(stats_record.cancelled_count, 0),
      average_party_size = COALESCE(stats_record.average_party_size, 0),
      first_visit = COALESCE(stats_record.first_visit, first_visit), -- Keep existing if no bookings found
      last_visit = stats_record.last_visit, -- This can be NULL if no confirmed/completed bookings
      updated_at = now()
    WHERE id = customer_record.id;
    
    processed_count := processed_count + 1;
    
    -- Log progress every 100 customers
    IF processed_count % 100 = 0 THEN
      RAISE NOTICE 'Processed % customers...', processed_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Customer statistics update completed. Processed % customers total.', processed_count;
  
  -- Show summary statistics
  RAISE NOTICE 'Summary of updated customer statistics:';
  
  FOR stats_record IN
    SELECT 
      COUNT(*) as total_customers,
      COUNT(CASE WHEN total_bookings > 0 THEN 1 END) as customers_with_bookings,
      COUNT(CASE WHEN total_bookings >= 5 THEN 1 END) as loyal_customers,
      COUNT(CASE WHEN total_bookings >= 10 THEN 1 END) as vip_customers,
      ROUND(AVG(total_bookings), 2) as avg_bookings_per_customer,
      MAX(total_bookings) as max_bookings_single_customer
    FROM restaurant_customers
  LOOP
    RAISE NOTICE 'Total customers: %', stats_record.total_customers;
    RAISE NOTICE 'Customers with bookings: %', stats_record.customers_with_bookings;
    RAISE NOTICE 'Loyal customers (5+ bookings): %', stats_record.loyal_customers;
    RAISE NOTICE 'VIP customers (10+ bookings): %', stats_record.vip_customers;
    RAISE NOTICE 'Average bookings per customer: %', stats_record.avg_bookings_per_customer;
    RAISE NOTICE 'Max bookings by single customer: %', stats_record.max_bookings_single_customer;
  END LOOP;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_app_config_updated_at
CREATE OR REPLACE FUNCTION public.update_app_config_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_booking_statuses
CREATE OR REPLACE FUNCTION public.update_booking_statuses()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $$
DECLARE
  v_completed_count integer := 0;
  v_no_show_count integer := 0;
  v_booking record;
  v_current_time timestamptz := now();
BEGIN
  -- Start transaction
  BEGIN
    -- 1. Mark completed bookings 
    -- Pro tier: 2 hours after end time (existing behavior)
    -- Basic tier: 3 hours after booking time if not checked in
    FOR v_booking IN 
      SELECT b.id, b.status, b.booking_time, b.turn_time_minutes, r.tier
      FROM bookings b
      JOIN restaurants r ON b.restaurant_id = r.id
      WHERE b.status = 'confirmed'
        AND (
          -- Pro tier: 2 hours after service time
          (r.tier = 'pro' AND b.booking_time + (b.turn_time_minutes || ' minutes')::interval + INTERVAL '2 hours' < v_current_time)
          OR
          -- Basic tier: 3 hours after booking time if not checked in
          (r.tier = 'basic' AND b.booking_time + INTERVAL '3 hours' < v_current_time
           AND NOT EXISTS (
             SELECT 1 FROM booking_status_history bsh 
             WHERE bsh.booking_id = b.id 
             AND bsh.new_status = 'checked_in'
           ))
        )
    LOOP
      UPDATE bookings
      SET status = 'completed',
          updated_at = v_current_time
      WHERE id = v_booking.id;
      
      -- Different reasons based on tier
      INSERT INTO booking_status_history (booking_id, old_status, new_status, reason)
      VALUES (
        v_booking.id, 
        v_booking.status, 
        'completed', 
        CASE 
          WHEN v_booking.tier = 'basic' THEN 'Auto-completed after booking time (Basic plan)'
          ELSE 'Auto-completed after service time'
        END
      );
      
      v_completed_count := v_completed_count + 1;
    END LOOP;

    -- 2. Mark no-shows (Pro tier only - 30 minutes past booking time, not checked in)
    FOR v_booking IN 
      SELECT b.id, b.status, b.booking_time, b.turn_time_minutes
      FROM bookings b
      JOIN restaurants r ON b.restaurant_id = r.id
      WHERE b.status = 'confirmed'
        AND r.tier = 'pro'  -- Only apply auto no-show logic to Pro tier
        AND b.booking_time + INTERVAL '30 minutes' < v_current_time
        AND b.booking_time + (b.turn_time_minutes || ' minutes')::interval > v_current_time
        AND NOT EXISTS (
          SELECT 1 FROM booking_status_history bsh 
          WHERE bsh.booking_id = b.id 
          AND bsh.new_status = 'checked_in'
        )
    LOOP
      UPDATE bookings
      SET status = 'no_show',
          updated_at = v_current_time
      WHERE id = v_booking.id;
      
      INSERT INTO booking_status_history (booking_id, old_status, new_status, reason)
      VALUES (v_booking.id, v_booking.status, 'no_show', 'Guest did not arrive within 30 minutes (Pro plan)');
      
      v_no_show_count := v_no_show_count + 1;
    END LOOP;

    -- Section 3 REMOVED: No longer auto-canceling based on creation time
    -- Bookings will only expire when the booking_time has passed

    -- Return summary (removed auto_cancelled count)
    RETURN jsonb_build_object(
      'completed', v_completed_count,
      'no_shows', v_no_show_count,
      'processed_at', v_current_time
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error and rollback
      RAISE NOTICE 'Error in update_booking_statuses: %', SQLERRM;
      RAISE;
  END;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_booking_templates_updated_at
CREATE OR REPLACE FUNCTION public.update_booking_templates_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_campaign_counts
CREATE OR REPLACE FUNCTION public.update_campaign_counts()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  -- Only process if campaign_id is set
  IF NEW.campaign_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Update sent_count when status changes to 'sent'
  IF (OLD.status IS DISTINCT FROM 'sent') AND NEW.status = 'sent' THEN
    UPDATE notification_campaigns
    SET sent_count = sent_count + 1,
        updated_at = NOW()
    WHERE id = NEW.campaign_id;
  END IF;
  
  -- Update failed_count when status changes to 'failed'
  IF (OLD.status IS DISTINCT FROM 'failed') AND NEW.status = 'failed' THEN
    UPDATE notification_campaigns
    SET failed_count = failed_count + 1,
        updated_at = NOW()
    WHERE id = NEW.campaign_id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_customer_stats
CREATE OR REPLACE FUNCTION public.update_customer_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    target_customer_id UUID;
    v_restaurant_id UUID;
    v_total_bookings INTEGER;
    v_total_spent NUMERIC;
    v_last_visit TIMESTAMPTZ;
    v_first_visit TIMESTAMPTZ;
    v_no_show_count INTEGER;
    v_cancelled_count INTEGER;
    v_avg_party_size NUMERIC;
BEGIN
    -- Determine which customer to update
    IF (TG_OP = 'DELETE') THEN
        target_customer_id := OLD.guest_id;
        v_restaurant_id := OLD.restaurant_id;
    ELSE
        target_customer_id := NEW.guest_id;
        v_restaurant_id := NEW.restaurant_id;
    END IF;

    -- If no guest_id is linked, we can't update customer stats
    IF target_customer_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Calculate stats from bookings table
    SELECT 
        COUNT(*),
        COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0),
        MAX(CASE WHEN booking_time <= NOW() THEN booking_time END), -- Only past/present bookings for last_visit
        MIN(booking_time),
        COUNT(CASE WHEN status = 'no_show' THEN 1 END),
        COUNT(CASE WHEN status = 'cancelled_by_user' THEN 1 END),
        AVG(party_size)
    INTO 
        v_total_bookings,
        v_total_spent,
        v_last_visit,
        v_first_visit,
        v_no_show_count,
        v_cancelled_count,
        v_avg_party_size
    FROM bookings
    WHERE guest_id = target_customer_id
    AND restaurant_id = v_restaurant_id;

    -- Update the customer record
    UPDATE restaurant_customers
    SET 
        total_bookings = v_total_bookings,
        last_visit = v_last_visit,
        first_visit = v_first_visit,
        no_show_count = v_no_show_count,
        cancelled_count = v_cancelled_count,
        average_party_size = COALESCE(v_avg_party_size, 0),
        updated_at = NOW()
    WHERE id = target_customer_id;

    RETURN NULL;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_deletion_request_updated_at
CREATE OR REPLACE FUNCTION public.update_deletion_request_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_device_tokens_updated_at
CREATE OR REPLACE FUNCTION public.update_device_tokens_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_event_occurrence_bookings_count
CREATE OR REPLACE FUNCTION public.update_event_occurrence_bookings_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
DECLARE
  old_contributes boolean := false;
  new_contributes boolean := false;
  delta int := 0;
BEGIN
  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    -- Only process if it's an event booking with an occurrence
    IF NEW.is_event_booking = true AND NEW.event_occurrence_id IS NOT NULL THEN
      -- Only count pending and confirmed bookings
      IF NEW.status IN ('pending', 'confirmed') THEN
        UPDATE event_occurrences
        SET 
          current_bookings = COALESCE(current_bookings, 0) + COALESCE(NEW.party_size, 0),
          status = CASE
            WHEN max_capacity IS NOT NULL 
                 AND (COALESCE(current_bookings, 0) + COALESCE(NEW.party_size, 0)) >= max_capacity 
            THEN 'full'
            ELSE status
          END,
          updated_at = NOW()
        WHERE id = NEW.event_occurrence_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- Only process if it's an event booking
    IF NEW.is_event_booking = true AND NEW.event_occurrence_id IS NOT NULL THEN
      -- Determine if OLD booking contributed to count
      old_contributes := (OLD.status IN ('pending', 'confirmed'));
      
      -- Determine if NEW booking contributes to count
      new_contributes := (NEW.status IN ('pending', 'confirmed'));
      
      -- Calculate delta
      IF old_contributes AND new_contributes THEN
        -- Both contribute, check for party size change
        delta := COALESCE(NEW.party_size, 0) - COALESCE(OLD.party_size, 0);
      ELSIF NOT old_contributes AND new_contributes THEN
        -- Newly contributing (e.g., pending -> confirmed)
        delta := COALESCE(NEW.party_size, 0);
      ELSIF old_contributes AND NOT new_contributes THEN
        -- No longer contributing (e.g., confirmed -> cancelled)
        delta := -COALESCE(OLD.party_size, 0);
      END IF;
      
      -- Apply delta if non-zero
      IF delta <> 0 THEN
        UPDATE event_occurrences
        SET 
          current_bookings = GREATEST(COALESCE(current_bookings, 0) + delta, 0),
          status = CASE
            WHEN max_capacity IS NOT NULL 
                 AND (COALESCE(current_bookings, 0) + delta) >= max_capacity 
            THEN 'full'
            WHEN status = 'full' 
                 AND (COALESCE(current_bookings, 0) + delta) < COALESCE(max_capacity, 9999)
            THEN 'scheduled'
            ELSE status
          END,
          updated_at = NOW()
        WHERE id = NEW.event_occurrence_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    -- Only process if it's an event booking with an occurrence
    IF OLD.is_event_booking = true AND OLD.event_occurrence_id IS NOT NULL THEN
      -- Only decrement if it was a counted status
      IF OLD.status IN ('pending', 'confirmed') THEN
        UPDATE event_occurrences
        SET 
          current_bookings = GREATEST(COALESCE(current_bookings, 0) - COALESCE(OLD.party_size, 0), 0),
          status = CASE
            WHEN status = 'full' 
                 AND (COALESCE(current_bookings, 0) - COALESCE(OLD.party_size, 0)) < COALESCE(max_capacity, 9999)
            THEN 'scheduled'
            ELSE status
          END,
          updated_at = NOW()
        WHERE id = OLD.event_occurrence_id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_event_occurrences_updated_at
CREATE OR REPLACE FUNCTION public.update_event_occurrences_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_notification_delivery
CREATE OR REPLACE FUNCTION public.update_notification_delivery(p_outbox_id uuid, p_delivered boolean, p_error text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_campaign_id UUID;
BEGIN
  IF p_delivered THEN
    UPDATE notification_outbox 
    SET delivered_at = NOW()
    WHERE id = p_outbox_id 
      AND delivered_at IS NULL
    RETURNING campaign_id INTO v_campaign_id;
    
    -- Update campaign delivered_count
    IF v_campaign_id IS NOT NULL AND FOUND THEN
      UPDATE notification_campaigns
      SET delivered_count = delivered_count + 1,
          updated_at = NOW()
      WHERE id = v_campaign_id;
    END IF;
  ELSE
    UPDATE notification_outbox 
    SET status = 'failed',
        error = COALESCE(p_error, 'Delivery failed')
    WHERE id = p_outbox_id
    RETURNING campaign_id INTO v_campaign_id;
    
    -- Update campaign failed_count
    IF v_campaign_id IS NOT NULL AND FOUND THEN
      UPDATE notification_campaigns
      SET failed_count = failed_count + 1,
          updated_at = NOW()
      WHERE id = v_campaign_id;
    END IF;
  END IF;
  
  RETURN FOUND;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_notification_outbox_updated_at
CREATE OR REPLACE FUNCTION public.update_notification_outbox_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_notification_preferences_updated_at
CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_order_totals
CREATE OR REPLACE FUNCTION public.update_order_totals()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  -- Update order totals when order items change
  UPDATE orders 
  SET 
    subtotal = (
      SELECT COALESCE(SUM(total_price), 0) 
      FROM order_items 
      WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
        AND status != 'cancelled'
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  
  -- Update total_amount (subtotal + tax)
  UPDATE orders 
  SET total_amount = subtotal + tax_amount
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  
  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_restaurant_availability
CREATE OR REPLACE FUNCTION public.update_restaurant_availability(p_restaurant_id uuid, p_date date, p_time_slot time without time zone, p_party_size integer)
 RETURNS void
 LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.restaurant_availability
  SET available_capacity = available_capacity - p_party_size
  WHERE restaurant_id = p_restaurant_id
    AND date = p_date
    AND time_slot = p_time_slot
    AND available_capacity >= p_party_size;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient availability';
  END IF;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_restaurant_events_updated_at
CREATE OR REPLACE FUNCTION public.update_restaurant_events_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_restaurant_groups_updated_at
CREATE OR REPLACE FUNCTION public.update_restaurant_groups_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_restaurant_loyalty_balance_timestamp
CREATE OR REPLACE FUNCTION public.update_restaurant_loyalty_balance_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_restaurant_ratings_from_reviews
CREATE OR REPLACE FUNCTION public.update_restaurant_ratings_from_reviews()
 RETURNS void
 LANGUAGE plpgsql
AS $$
DECLARE
    restaurant_record RECORD;
    calculated_rating NUMERIC(3,2);
    review_count INTEGER;
BEGIN
    -- Loop through all restaurants
    FOR restaurant_record IN 
        SELECT id FROM restaurants
    LOOP
        -- Calculate actual average rating and count from reviews
        SELECT 
            COALESCE(AVG(rating), 0)::NUMERIC(3,2),
            COUNT(*)::INTEGER
        INTO calculated_rating, review_count
        FROM reviews 
        WHERE restaurant_id = restaurant_record.id;
        
        -- Update restaurant with calculated values
        UPDATE restaurants 
        SET 
            average_rating = calculated_rating,
            total_reviews = review_count,
            updated_at = NOW()
        WHERE id = restaurant_record.id;
        
        RAISE NOTICE 'Updated restaurant % with rating % and % reviews', 
            restaurant_record.id, calculated_rating, review_count;
    END LOOP;
    
    RAISE NOTICE 'Finished updating all restaurant ratings from actual reviews';
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_restaurant_shifts_updated_at
CREATE OR REPLACE FUNCTION public.update_restaurant_shifts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_review_likes_count
CREATE OR REPLACE FUNCTION public.update_review_likes_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reviews 
    SET likes_count = likes_count + 1 
    WHERE id = NEW.review_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reviews 
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.review_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_review_reports_count
CREATE OR REPLACE FUNCTION public.update_review_reports_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reviews 
    SET 
      reports_count = reports_count + 1,
      is_flagged = CASE 
        WHEN reports_count + 1 >= 3 THEN true 
        ELSE is_flagged 
      END,
      moderation_status = CASE 
        WHEN reports_count + 1 >= 3 AND moderation_status = 'active' THEN 'under_review'
        ELSE moderation_status 
      END
    WHERE id = NEW.review_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reviews 
    SET 
      reports_count = GREATEST(0, reports_count - 1),
      is_flagged = CASE 
        WHEN reports_count - 1 < 3 THEN false 
        ELSE is_flagged 
      END
    WHERE id = OLD.review_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_staff_last_login
CREATE OR REPLACE FUNCTION public.update_staff_last_login()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.restaurant_staff 
  SET last_login_at = NOW() 
  WHERE user_id = NEW.id;
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- use_loyalty_redemption
CREATE OR REPLACE FUNCTION public.use_loyalty_redemption(p_redemption_id uuid, p_user_id uuid, p_booking_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $$
DECLARE
  v_redemption RECORD;
BEGIN
  -- Get redemption details
  SELECT * INTO v_redemption
  FROM public.loyalty_redemptions
  WHERE id = p_redemption_id AND user_id = p_user_id;
  
  IF v_redemption IS NULL THEN
    RAISE EXCEPTION 'Redemption not found';
  END IF;
  
  IF v_redemption.status != 'active' THEN
    RAISE EXCEPTION 'Redemption is not active (status: %)', v_redemption.status;
  END IF;
  
  IF v_redemption.expires_at < NOW() THEN
    -- Mark as expired
    UPDATE public.loyalty_redemptions
    SET status = 'expired', updated_at = NOW()
    WHERE id = p_redemption_id;
    
    RAISE EXCEPTION 'Redemption has expired';
  END IF;
  
  -- Mark as used
  UPDATE public.loyalty_redemptions
  SET 
    status = 'used',
    used_at = NOW(),
    booking_id = p_booking_id,
    updated_at = NOW()
  WHERE id = p_redemption_id;
  
  RETURN true;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- use_user_offer
CREATE OR REPLACE FUNCTION public.use_user_offer(p_redemption_code text, p_user_id uuid, p_booking_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(success boolean, message text, offer_details jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_user_offer RECORD;
  v_offer RECORD;
BEGIN
  -- Get user offer details
  SELECT uo.*, so.title, so.discount_percentage, so.valid_until, r.name as restaurant_name
  INTO v_user_offer
  FROM public.user_offers uo
  JOIN public.special_offers so ON uo.offer_id = so.id
  JOIN public.restaurants r ON so.restaurant_id = r.id
  WHERE uo.redemption_code = p_redemption_code 
    AND uo.user_id = p_user_id;
  
  -- Check if offer exists
  IF v_user_offer IS NULL THEN
    RETURN QUERY SELECT false, 'Offer not found or invalid redemption code', NULL::jsonb;
    RETURN;
  END IF;
  
  -- Check if already used
  IF v_user_offer.status = 'used' OR v_user_offer.used_at IS NOT NULL THEN
    RETURN QUERY SELECT false, 'Offer has already been used', NULL::jsonb;
    RETURN;
  END IF;
  
  -- Check if expired
  IF v_user_offer.status = 'expired' OR 
     (v_user_offer.expires_at IS NOT NULL AND v_user_offer.expires_at < NOW()) THEN
    RETURN QUERY SELECT false, 'Offer has expired', NULL::jsonb;
    RETURN;
  END IF;
  
  -- Check if the base offer is still valid
  IF v_user_offer.valid_until < NOW() THEN
    RETURN QUERY SELECT false, 'Offer period has ended', NULL::jsonb;
    RETURN;
  END IF;
  
  -- Mark as used
  UPDATE public.user_offers
  SET 
    status = 'used',
    used_at = NOW(),
    booking_id = p_booking_id,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('used_by_function', true)
  WHERE redemption_code = p_redemption_code;
  
  -- Return success with offer details
  RETURN QUERY SELECT 
    true,
    'Offer successfully used',
    jsonb_build_object(
      'title', v_user_offer.title,
      'discount_percentage', v_user_offer.discount_percentage,
      'restaurant_name', v_user_offer.restaurant_name,
      'used_at', NOW()
    );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- validate_booking_acceptance
CREATE OR REPLACE FUNCTION public.validate_booking_acceptance(p_booking_id uuid, p_table_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
AS $$
DECLARE
  v_booking record;
  v_conflicts jsonb;
  v_table_capacity integer;
  v_available_tables uuid[];
BEGIN
  -- Get booking details
  SELECT * INTO v_booking 
  FROM bookings 
  WHERE id = p_booking_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'Booking not found or already processed'
    );
  END IF;
  
  -- Check if booking time has passed (using our logic)
  IF v_booking.booking_time < now() THEN
    -- Mark as auto-declined if not already
    UPDATE bookings 
    SET 
      status = 'auto_declined',
      auto_declined = true,
      acceptance_failed_reason = 'Booking time passed during acceptance attempt',
      acceptance_attempted_at = now()
    WHERE id = p_booking_id;
    
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'Booking time has passed'
    );
  END IF;
  
  -- Rest of your existing validation logic...
  SELECT COALESCE(SUM(capacity), 0) INTO v_table_capacity
  FROM restaurant_tables
  WHERE id = ANY(p_table_ids) AND is_active = true;
  
  IF v_table_capacity < v_booking.party_size THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'Insufficient table capacity',
      'required_capacity', v_booking.party_size,
      'selected_capacity', v_table_capacity
    );
  END IF;
  
  -- Check for time conflicts with other bookings
  WITH conflicts AS (
    SELECT 
      b.id,
      b.confirmation_code,
      b.booking_time,
      b.party_size,
      array_agg(t.table_number) as table_numbers
    FROM bookings b
    JOIN booking_tables bt ON bt.booking_id = b.id
    JOIN restaurant_tables t ON t.id = bt.table_id
    WHERE b.restaurant_id = v_booking.restaurant_id
      AND b.id != p_booking_id
      AND bt.table_id = ANY(p_table_ids)
      AND b.status IN ('confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment')
      AND (
        (b.booking_time, b.booking_time + (b.turn_time_minutes || ' minutes')::interval) 
        OVERLAPS 
        (v_booking.booking_time, v_booking.booking_time + (v_booking.turn_time_minutes || ' minutes')::interval)
      )
    GROUP BY b.id, b.confirmation_code, b.booking_time, b.party_size
  )
  SELECT jsonb_agg(row_to_json(conflicts.*)) INTO v_conflicts FROM conflicts;
  
  IF v_conflicts IS NOT NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'Table conflicts detected',
      'conflicts', v_conflicts
    );
  END IF;
  
  -- Find alternative tables
  WITH available_tables AS (
    SELECT t.id
    FROM restaurant_tables t
    WHERE t.restaurant_id = v_booking.restaurant_id
      AND t.is_active = true
      AND t.capacity >= v_booking.party_size
      AND NOT EXISTS (
        SELECT 1 
        FROM booking_tables bt
        JOIN bookings b ON b.id = bt.booking_id
        WHERE bt.table_id = t.id
          AND b.status IN ('confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment')
          AND (
            (b.booking_time, b.booking_time + (b.turn_time_minutes || ' minutes')::interval) 
            OVERLAPS 
            (v_booking.booking_time, v_booking.booking_time + (v_booking.turn_time_minutes || ' minutes')::interval)
          )
      )
  )
  SELECT array_agg(id) INTO v_available_tables FROM available_tables;
  
  RETURN jsonb_build_object(
    'valid', true,
    'available_alternatives', v_available_tables
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- validate_promo_code
CREATE OR REPLACE FUNCTION public.validate_promo_code(p_code text, p_restaurant_id uuid, p_user_id uuid, p_party_size integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_code         public.promo_codes%ROWTYPE;
  v_user_uses    integer;
  v_user_bookings integer;
  v_user_tier    text;
  v_day_of_week  integer;
  v_cond_tiers   text[];
  v_cond_days    integer[];
  v_has_restaurant_links boolean;
BEGIN
  -- 1. Lookup the code
  SELECT pc.*
  INTO v_code
  FROM public.promo_codes pc
  WHERE upper(pc.code) = upper(p_code)
    AND pc.status = 'active'
    AND (
      -- Direct restaurant match (legacy single-restaurant)
      pc.restaurant_id = p_restaurant_id
      -- Restaurant listed in junction table
      OR EXISTS (
        SELECT 1 FROM public.promo_code_restaurants pcr
        WHERE pcr.promo_code_id = pc.id AND pcr.restaurant_id = p_restaurant_id
      )
      -- Global code: restaurant_id IS NULL AND no junction table entries
      OR (
        pc.restaurant_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.promo_code_restaurants pcr
          WHERE pcr.promo_code_id = pc.id
        )
      )
    )
  ORDER BY
    CASE
      WHEN pc.restaurant_id = p_restaurant_id THEN 0
      WHEN EXISTS (SELECT 1 FROM public.promo_code_restaurants pcr WHERE pcr.promo_code_id = pc.id AND pcr.restaurant_id = p_restaurant_id) THEN 1
      ELSE 2
    END
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or expired promo code');
  END IF;

  -- 2. Validity window
  IF now() < v_code.valid_from THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This promo code is not yet active');
  END IF;
  IF now() > v_code.valid_until THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This promo code has expired');
  END IF;

  -- 3. Total usage cap
  IF v_code.max_uses IS NOT NULL AND v_code.current_uses >= v_code.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This promo code has reached its maximum number of uses');
  END IF;

  -- 4. Per-user usage cap
  SELECT count(*) INTO v_user_uses
  FROM public.promo_code_redemptions
  WHERE promo_code_id = v_code.id AND user_id = p_user_id AND released_at IS NULL;

  IF v_user_uses >= v_code.max_uses_per_user THEN
    RETURN jsonb_build_object('valid', false, 'error', 'You have already used this promo code');
  END IF;

  -- 5. Fetch user profile data
  SELECT completed_bookings, membership_tier
  INTO v_user_bookings, v_user_tier
  FROM public.profiles WHERE id = p_user_id;

  -- 6. Condition: first_booking_only
  IF (v_code.conditions->>'first_booking_only')::boolean IS TRUE THEN
    IF COALESCE(v_user_bookings, 0) > 0 THEN
      RETURN jsonb_build_object('valid', false, 'error', 'This promo code is only valid for your first booking');
    END IF;
  END IF;

  -- 7. Condition: min_completed_bookings
  IF v_code.conditions ? 'min_completed_bookings' THEN
    IF COALESCE(v_user_bookings, 0) < (v_code.conditions->>'min_completed_bookings')::integer THEN
      RETURN jsonb_build_object('valid', false, 'error',
        format('You need at least %s completed bookings to use this code', v_code.conditions->>'min_completed_bookings'));
    END IF;
  END IF;

  -- 8. Condition: membership_tiers
  IF v_code.conditions ? 'membership_tiers' THEN
    SELECT array_agg(t.value #>> '{}') INTO v_cond_tiers
    FROM jsonb_array_elements(v_code.conditions->'membership_tiers') AS t(value);
    IF v_user_tier IS NULL OR NOT (v_user_tier = ANY(v_cond_tiers)) THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Your membership tier is not eligible for this promo code');
    END IF;
  END IF;

  -- 9. Condition: min_party_size
  IF v_code.conditions ? 'min_party_size' THEN
    IF p_party_size < (v_code.conditions->>'min_party_size')::integer THEN
      RETURN jsonb_build_object('valid', false, 'error',
        format('This promo code requires a party of at least %s', v_code.conditions->>'min_party_size'));
    END IF;
  END IF;

  -- 10. Condition: applicable_days
  IF v_code.conditions ? 'applicable_days' THEN
    v_day_of_week := extract(dow FROM now())::integer;
    SELECT array_agg(d.value::text::integer) INTO v_cond_days
    FROM jsonb_array_elements(v_code.conditions->'applicable_days') AS d(value);
    IF NOT (v_day_of_week = ANY(v_cond_days)) THEN
      RETURN jsonb_build_object('valid', false, 'error', 'This promo code is not valid today');
    END IF;
  END IF;

  -- All checks passed
  RETURN jsonb_build_object(
    'valid', true,
    'id', v_code.id,
    'code', v_code.code,
    'discount_type', v_code.discount_type,
    'discount_value', v_code.discount_value,
    'max_discount_amount', v_code.max_discount_amount,
    'description', v_code.description
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- validate_restaurant_loyalty_balance
CREATE OR REPLACE FUNCTION public.validate_restaurant_loyalty_balance()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
DECLARE
  v_balance integer;
  v_rule record;
BEGIN
  -- Only check for new bookings with loyalty rules
  IF NEW.applied_loyalty_rule_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get the rule details
  SELECT * INTO v_rule
  FROM restaurant_loyalty_rules
  WHERE id = NEW.applied_loyalty_rule_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid loyalty rule ID';
  END IF;
  
  -- Get restaurant balance
  SELECT current_balance INTO v_balance
  FROM restaurant_loyalty_balance
  WHERE restaurant_id = NEW.restaurant_id;
  
  -- If no balance record or insufficient balance, remove the loyalty rule
  IF v_balance IS NULL OR v_balance < v_rule.points_to_award THEN
    NEW.applied_loyalty_rule_id := NULL;
    NEW.expected_loyalty_points := 0;
  ELSE
    NEW.expected_loyalty_points := v_rule.points_to_award;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- validate_table_combination
CREATE OR REPLACE FUNCTION public.validate_table_combination(p_table_ids uuid[])
 RETURNS TABLE(is_valid boolean, total_capacity integer, message text)
 LANGUAGE plpgsql
AS $$
DECLARE
  v_table_count INTEGER;
  v_combinable_count INTEGER;
  v_total_capacity INTEGER;
BEGIN
  -- Count tables
  SELECT COUNT(*), SUM(capacity)
  INTO v_table_count, v_total_capacity
  FROM restaurant_tables
  WHERE id = ANY(p_table_ids) AND is_active = true;

  -- Count combinable tables
  SELECT COUNT(*)
  INTO v_combinable_count
  FROM restaurant_tables
  WHERE id = ANY(p_table_ids) 
    AND is_active = true 
    AND is_combinable = true;

  -- Validation logic
  IF v_table_count != array_length(p_table_ids, 1) THEN
    RETURN QUERY SELECT false, 0, 'One or more tables not found or inactive';
  ELSIF v_table_count > 1 AND v_combinable_count != v_table_count THEN
    RETURN QUERY SELECT false, v_total_capacity, 'Not all selected tables can be combined';
  ELSE
    -- Check specific combination rules if any
    -- This can be expanded based on combinable_with field
    RETURN QUERY SELECT true, v_total_capacity, 'Valid combination';
  END IF;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- verify_customer_statistics
CREATE OR REPLACE FUNCTION public.verify_customer_statistics(p_restaurant_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(customer_id uuid, customer_name text, stored_total_bookings integer, actual_total_bookings bigint, stored_no_shows integer, actual_no_shows bigint, stored_cancelled integer, actual_cancelled bigint, needs_update boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rc.id as customer_id,
    rc.guest_name as customer_name,
    rc.total_bookings as stored_total_bookings,
    COUNT(CASE WHEN b.status IN ('confirmed', 'completed') THEN 1 END) as actual_total_bookings,
    rc.no_show_count as stored_no_shows,
    COUNT(CASE WHEN b.status = 'no_show' THEN 1 END) as actual_no_shows,
    rc.cancelled_count as stored_cancelled,
    COUNT(CASE WHEN b.status LIKE 'cancelled%' THEN 1 END) as actual_cancelled,
    (
      rc.total_bookings != COUNT(CASE WHEN b.status IN ('confirmed', 'completed') THEN 1 END) OR
      rc.no_show_count != COUNT(CASE WHEN b.status = 'no_show' THEN 1 END) OR
      rc.cancelled_count != COUNT(CASE WHEN b.status LIKE 'cancelled%' THEN 1 END)
    ) as needs_update
  FROM restaurant_customers rc
  LEFT JOIN bookings b ON (
    rc.restaurant_id = b.restaurant_id AND
    (
      (rc.user_id IS NOT NULL AND b.user_id = rc.user_id) OR
      (rc.user_id IS NULL AND b.guest_email = rc.guest_email)
    )
  )
  WHERE (p_restaurant_id IS NULL OR rc.restaurant_id = p_restaurant_id)
  GROUP BY rc.id, rc.guest_name, rc.total_bookings, rc.no_show_count, rc.cancelled_count
  ORDER BY needs_update DESC, rc.total_bookings DESC;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;

-- verify_table_availability
CREATE OR REPLACE FUNCTION public.verify_table_availability(p_restaurant_id uuid, p_booking_time timestamp with time zone, p_table_ids uuid[], p_turn_time integer DEFAULT 120)
 RETURNS json
 LANGUAGE plpgsql
AS $$
DECLARE
  v_conflicts jsonb := '[]'::jsonb;
  v_table_id uuid;
  v_conflict record;
BEGIN
  -- Check each table for conflicts
  FOREACH v_table_id IN ARRAY p_table_ids
  LOOP
    FOR v_conflict IN
      SELECT 
        b.id,
        b.confirmation_code,
        b.booking_time,
        b.party_size,
        b.status,
        rt.table_number
      FROM bookings b
      JOIN booking_tables bt ON b.id = bt.booking_id
      JOIN restaurant_tables rt ON bt.table_id = rt.id
      WHERE b.restaurant_id = p_restaurant_id
        AND bt.table_id = v_table_id
        AND b.status = 'confirmed'
        AND b.booking_time < (p_booking_time + (p_turn_time || ' minutes')::interval)
        AND (b.booking_time + (b.turn_time_minutes || ' minutes')::interval) > p_booking_time
    LOOP
      v_conflicts := v_conflicts || jsonb_build_object(
        'table_id', v_table_id,
        'table_number', v_conflict.table_number,
        'conflicting_booking_id', v_conflict.id,
        'conflicting_booking_time', v_conflict.booking_time,
        'confirmation_code', v_conflict.confirmation_code
      );
    END LOOP;
  END LOOP;
  
  RETURN json_build_object(
    'available', jsonb_array_length(v_conflicts) = 0,
    'conflicts', v_conflicts,
    'checked_tables', p_table_ids,
    'checked_time', p_booking_time
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'An unexpected error occurred.' USING ERRCODE = 'P0001';
END;
$$;


-- End of batch
