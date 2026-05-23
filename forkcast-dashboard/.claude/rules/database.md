---
description: Supabase queries, multi-tenant isolation, React Query hooks, RLS patterns
globs: ["lib/supabase/**", "lib/hooks/**", "lib/services/**", "db/**", "hooks/use-*"]
---

# Database & Data Layer

## Multi-Tenant Isolation
- Every query MUST include `.eq("restaurant_id", restaurantId)` — RLS is defense-in-depth, not sole protection
- React Query keys must include `restaurant_id` to prevent cross-tenant cache hits
- Junction tables (e.g., `booking_tables`) inherit tenant scope through parent relations

## Supabase Client Usage
- `lib/supabase/client.ts` — browser/client components only
- `lib/supabase/server.ts` — server components and Server Actions
- `lib/supabase/adminClient.ts` — service role (bypasses RLS) — use sparingly
- Never create additional Supabase client instances

## Query Patterns
- Use `.maybeSingle()` when 0 rows is valid (avoid PGRST116 errors)
- Check `error` before using `data` on every query
- Prefer RPC functions for complex multi-step operations
- Reference `db/schema.sql` before writing any query — it's the ground truth

## React Query Hooks
- All data hooks live in `lib/hooks/` (e.g., `use-bookings.ts`, `use-orders.ts`)
- Follow existing patterns: `useQuery` for reads, `useMutation` for writes
- Invalidate related queries after mutations (bookings -> tables, orders -> kitchen)
- Real-time subscriptions in dedicated hooks (`use-realtime-bookings.ts`, etc.)

## Migrations
- Use `CREATE INDEX CONCURRENTLY` for live tables
- Make migrations reversible
- Test with `--dry-run` flag when available

## Tool Dispatch
- **context7 MCP:** Verify Supabase client API patterns against current docs
- **database-optimizer agent:** Dispatch for schema changes, slow queries, or new table design
- **supabase plugin:** Use for direct SQL execution, migration application, project monitoring
