-- The problem: a PostgreSQL trigger fires AFTER DELETE on restaurants and inserts a new
-- audit_log row referencing the now-deleted restaurant_id. The FK check fires at end of
-- statement (immediate mode) and rejects the insert.
--
-- Fix: Make both audit FK constraints DEFERRABLE INITIALLY DEFERRED so the check runs
-- at transaction commit. An RPC function then nullifies any trigger-created rows within
-- the same transaction before it commits.

-- 1. Fix audit_logs FK (drop previous migration's version first)
ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_restaurant_id_fkey;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_restaurant_id_fkey
  FOREIGN KEY (restaurant_id)
  REFERENCES public.restaurants(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- 2. Fix security_audit_log FK
ALTER TABLE public.security_audit_log
  DROP CONSTRAINT IF EXISTS security_audit_log_restaurant_id_fkey;

ALTER TABLE public.security_audit_log
  ADD CONSTRAINT security_audit_log_restaurant_id_fkey
  FOREIGN KEY (restaurant_id)
  REFERENCES public.restaurants(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- 3. RPC function that deletes a restaurant safely within one transaction.
--    Step order:
--      a) nullify existing audit_log references
--      b) delete restaurant (trigger fires, inserts new audit_log with old id — FK deferred, no error yet)
--      c) nullify the trigger-created rows
--      d) transaction commits → FK check passes because all restaurant_id columns are NULL
CREATE OR REPLACE FUNCTION admin_delete_restaurant(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
END;
$$;

-- Grant execute to authenticated users (admin check is inside the function)
GRANT EXECUTE ON FUNCTION admin_delete_restaurant(uuid) TO authenticated;
