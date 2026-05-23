# Plate Management System — Claude Code Instructions

## Project Overview
Enterprise Next.js 15 restaurant management system with Supabase backend. Multi-tenant, tablet-optimized (8-inch landscape), PWA-enabled. Manages bookings, kitchen workflows, floor plans, analytics, staff, and customer loyalty.

## Tech Stack
- **Framework:** Next.js 15 (App Router, Turbopack), React 19, TypeScript 5
- **Backend:** Supabase (Auth, Realtime, RLS, Storage)
- **Styling:** Tailwind CSS 4 + Radix UI + shadcn/ui + tw-animate-css
- **State:** React Query (TanStack Query v5) + custom hooks in `lib/hooks/` and `hooks/`
- **Forms:** React Hook Form + Zod validation
- **Charts:** Recharts
- **DnD:** @dnd-kit (floor plan editor)
- **Package Manager:** npm
- **Testing:** Script-based (`npm run test:*`), no unit test framework
- **Deploy:** Vercel

## Architecture
- **Multi-tenant:** All queries scoped by `restaurant_id`, RLS enforced
- **Auth flow:** Supabase session -> `restaurant_staff` check -> middleware gate
- **Supabase clients:** `lib/supabase/client.ts` (browser), `server.ts` (RSC), `middleware.ts` (route protection), `adminClient.ts` (service role)
- **Data hooks:** `lib/hooks/use-bookings.ts`, `use-orders.ts`, `use-restaurants.ts`, etc. — React Query wrappers
- **Top-level hooks:** `hooks/use-section-capacity.ts`, `use-shared-tables.ts`, etc. — utility hooks
- **Tier system:** `lib/utils/tier.ts` controls route access per restaurant plan (basic/pro)

## File Structure
```
app/(auth)/              # Login, signup, email verification
app/(dashboard)/         # Protected routes (28+ feature areas)
app/actions.ts           # Server actions (push notifications)
components/dashboard/    # Feature components (floor plan, bookings, etc.)
components/layout/       # Sidebar, header, providers
lib/supabase/            # Supabase client instances
lib/hooks/               # React Query data hooks
lib/services/            # Business logic services
lib/utils/               # Utilities (tier, formatting)
hooks/                   # UI/utility hooks
db/schema.sql            # Database schema (ground truth, 40+ tables)
types/index.ts           # Domain model interfaces
public/sw.js             # Service worker (PWA)
scripts/                 # Seed data, migrations, test scripts
```

## Prohibitions (NEVER DO)
- Never create API routes (`/api/*`) — use direct Supabase calls only
- Never query Supabase in client components without React Query hooks
- Never skip `restaurant_staff` access checks on protected operations
- Never cache auth/dynamic endpoints in service worker
- Never use touch targets smaller than 44px
- Never store tokens in localStorage — use Supabase SSR cookies
- Never mutate booking status outside the state machine (pending -> confirmed -> seated -> completed)

## Business Rules
- All data isolated by `restaurant_id` — never cross-tenant
- Staff roles: owner, manager, host, server, chef — permissions vary
- Booking tables use junction table `booking_tables` (many-to-many)
- Loyalty points have audit trails via `loyalty_*` tables
- Restaurant tiers (basic/pro) gate which routes are accessible

## Commands
```bash
npm run dev              # Dev server (Turbopack)
npm run build            # Production build (DISABLE_ESLINT_PLUGIN=true)
npm run lint             # ESLint
npm run seed:menu        # Seed menu data
npm run create:sample-data  # Generate sample data
npm run test:kitchen-operations  # Test kitchen workflow
```

## Code Conventions
- Light mode only (`darkMode: false` in tailwind.config.js)
- HSL CSS custom properties for theming (see `globals.css :root`)
- Custom `tablet` breakpoint at 820px for 8-inch screens
- `touch-action: manipulation` on all interactive elements
- Server components by default, `"use client"` only when needed
- `@/` path alias for imports

## Verification
- After modifying Supabase queries: verify `restaurant_id` filter is present
- After modifying middleware: `npm run build` to verify route protection
- After UI changes: check 1024x768 viewport (8-inch tablet landscape)
- After modifying hooks: verify React Query key includes `restaurant_id`
- Before any deployment: `npm run lint && npm run build`

## Key Files
- `middleware.ts` — Route protection (auth + staff + tier)
- `lib/restaurant-auth.ts` — Staff access verification
- `types/index.ts` — All domain interfaces
- `app/(dashboard)/layout.tsx` — Dashboard shell with staff check
- `db/schema.sql` — Database schema (ground truth)
- `app/globals.css` — CSS custom properties and theme
- `tailwind.config.js` — Custom breakpoints and color tokens
- `components/dashboard/unified-floor-plan.tsx` — Floor plan with touch optimization
- `components/dashboard/checkin-queue.tsx` — Check-in interface
- `public/sw.js` — PWA service worker

## When Debugging
- "PGRST116" error -> `.single()` returned 0 rows, use `.maybeSingle()` or guard the error code
- Middleware redirect loop -> check `restaurant_staff` query, ensure `is_active` filter
- Touch not working -> check `touch-action` CSS property, verify 44px+ targets
- Stale data after mutation -> check React Query invalidation keys
- Build fails silently -> `DISABLE_ESLINT_PLUGIN=true` is set; run `npx tsc --noEmit` for type errors
- Booking conflicts -> check `booking_tables` junction + time overlap logic in `lib/table-availability.ts`

## External References
- Database schema: `db/schema.sql` (always check before writing queries)
- Supabase project: use `context7` MCP to verify Supabase API patterns
- Next.js App Router: use `context7` MCP for current docs
- Component patterns: check `components/` for existing implementations before creating new ones


## Rules
- ALWAYS before making any change, Search on the web for the newest documentation. And only implement if you are 100% sure it will work.
- use subagents when you see fit. 


Codex will review your output once you are done 
