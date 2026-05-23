-- Migration: Add Stripe payment fields
-- Date: 2026-05-17
-- Purpose: Support Stripe as a payment provider alongside existing MontyPay integration.
--          All changes are additive / non-breaking — MontyPay data is preserved.

-- ── profiles: store Stripe Customer ID ──────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- ── payment_methods: Stripe-specific fields ──────────────────────────────────
-- Make card_token nullable so Stripe payment methods can be stored
-- (Stripe uses payment_method IDs, not tokens — we store 'stripe:<pm_id>' as a
--  placeholder for backward-compat but the column constraint is now optional.)
ALTER TABLE public.payment_methods
  ALTER COLUMN card_token DROP NOT NULL;

ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id         text,
  ADD COLUMN IF NOT EXISTS payment_provider           text NOT NULL DEFAULT 'montypay';

-- For existing MontyPay rows ensure payment_provider is set
UPDATE public.payment_methods
  SET payment_provider = 'montypay'
  WHERE payment_provider IS NULL OR payment_provider = 'montypay';

-- Index for quick customer look-ups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_methods_stripe_customer
  ON public.payment_methods (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_methods_stripe_pm
  ON public.payment_methods (stripe_payment_method_id)
  WHERE stripe_payment_method_id IS NOT NULL;

-- ── booking_guarantees: Stripe intent IDs ────────────────────────────────────
ALTER TABLE public.booking_guarantees
  ADD COLUMN IF NOT EXISTS stripe_setup_intent_id   text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- ── payment_transactions: Stripe payment tracking ────────────────────────────
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS payment_provider         text NOT NULL DEFAULT 'montypay';

UPDATE public.payment_transactions
  SET payment_provider = 'montypay'
  WHERE payment_provider IS NULL OR payment_provider = 'montypay';

-- ── penalty_transactions: Stripe charge tracking ─────────────────────────────
ALTER TABLE public.penalty_transactions
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS payment_provider         text NOT NULL DEFAULT 'montypay';

UPDATE public.penalty_transactions
  SET payment_provider = 'montypay'
  WHERE payment_provider IS NULL OR payment_provider = 'montypay';

-- ── profiles: index for Stripe customer look-ups ─────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_stripe_customer
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
