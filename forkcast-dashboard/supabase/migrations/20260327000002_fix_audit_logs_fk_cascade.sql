-- Fix audit_logs and security_audit_log FK constraints to use ON DELETE SET NULL
-- This allows audit log entries to survive after the referenced restaurant is deleted,
-- which is the correct behavior for an audit log (historical records should persist).
-- Previously, any insert/update referencing a deleted restaurant_id would fail with a
-- 23503 FK violation (this happened via DB triggers logging deletion events).

-- Fix audit_logs.restaurant_id FK
ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_restaurant_id_fkey;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_restaurant_id_fkey
  FOREIGN KEY (restaurant_id)
  REFERENCES public.restaurants(id)
  ON DELETE SET NULL;

-- Fix security_audit_log.restaurant_id FK
ALTER TABLE public.security_audit_log
  DROP CONSTRAINT IF EXISTS security_audit_log_restaurant_id_fkey;

ALTER TABLE public.security_audit_log
  ADD CONSTRAINT security_audit_log_restaurant_id_fkey
  FOREIGN KEY (restaurant_id)
  REFERENCES public.restaurants(id)
  ON DELETE SET NULL;
