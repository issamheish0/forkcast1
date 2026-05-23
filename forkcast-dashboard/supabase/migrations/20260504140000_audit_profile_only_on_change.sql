-- 20260504140000_audit_profile_only_on_change.sql
--
-- Reduce audit_logs noise from public.profiles updates.
--
-- Background: trg_audit_profile_update fires AFTER UPDATE on every row, even
-- when no audited field changed. The profiles row is touched by many
-- background processes (booking counters, loyalty points, rating recalc,
-- updated_at) which never change the audited fields, so 85% of recent
-- profile audit rows had old_values == new_values.
--
-- Fix: add a WHEN clause so the trigger only fires when at least one of the
-- audited columns has actually changed. The function body is unchanged —
-- the gate is moved up so we skip the function call entirely on no-op
-- updates (cheaper than evaluating inside the function).
--
-- Audited columns: full_name, first_name, last_name, email, phone_number,
-- avatar_url, date_of_birth (matches what the trigger snapshots).
--
-- Behavior preserved:
--   * email/phone_number change → 'profile.sensitive_updated' (warning)
--   * any other audited field change → 'profile.updated' (info)
--   * non-audited field change (loyalty_points, total_bookings, etc.) → no row
--
-- Reversible via:
--   DROP TRIGGER trg_audit_profile_update ON public.profiles;
--   CREATE TRIGGER trg_audit_profile_update
--     AFTER UPDATE ON public.profiles
--     FOR EACH ROW EXECUTE FUNCTION public.audit_profile_changes();

DROP TRIGGER IF EXISTS trg_audit_profile_update ON public.profiles;

CREATE TRIGGER trg_audit_profile_update
AFTER UPDATE ON public.profiles
FOR EACH ROW
WHEN (
  OLD.full_name      IS DISTINCT FROM NEW.full_name      OR
  OLD.first_name     IS DISTINCT FROM NEW.first_name     OR
  OLD.last_name      IS DISTINCT FROM NEW.last_name      OR
  OLD.email          IS DISTINCT FROM NEW.email          OR
  OLD.phone_number   IS DISTINCT FROM NEW.phone_number   OR
  OLD.avatar_url     IS DISTINCT FROM NEW.avatar_url     OR
  OLD.date_of_birth  IS DISTINCT FROM NEW.date_of_birth
)
EXECUTE FUNCTION public.audit_profile_changes();
