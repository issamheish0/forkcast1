---
description: Next.js 15 App Router, React 19, Tailwind CSS 4, Radix/shadcn, tablet optimization
globs: ["app/**", "components/**", "hooks/**"]
---

# Frontend

## Next.js Patterns
- Server Components by default — add `"use client"` only for interactivity/hooks
- Use Server Actions (`app/actions.ts`) for mutations, not API routes
- Layouts in route groups handle auth/staff checks — don't duplicate in pages
- Use `@/` path alias for all imports

## Component Patterns
- Radix UI primitives + shadcn/ui wrappers in `components/ui/`
- Feature components in `components/dashboard/` — check for existing before creating
- Forms use React Hook Form + Zod schemas
- Toast notifications via `sonner` and `react-hot-toast`

## Tablet & Touch (8-inch landscape)
- All interactive elements: minimum 44px touch targets
- Apply `touch-action: manipulation` on buttons, links, drag handles
- Custom `tablet` breakpoint at 820px — use for 8-inch-specific layouts
- Test layouts at 1024x768 viewport
- Light mode only — no dark mode

## Styling
- Tailwind CSS 4 with HSL CSS custom properties (see `globals.css :root`)
- Status colors: `--status-available`, `--status-taken`, `--status-reserved`, etc.
- Booking colors: `--booking-pending`, `--booking-confirmed`, `--booking-seated`, etc.
- Use `cn()` from `lib/utils.ts` for conditional class merging

## Tool Dispatch
- **context7 MCP:** Verify Next.js/React/Tailwind API usage against current docs — training data may be stale
- **nextjs-app-router-developer agent:** Dispatch for Server Component/Action architecture decisions
- **react-performance-optimizer agent:** Dispatch for rendering bottlenecks, bundle size, or Core Web Vitals issues
- **impeccable skills:** Use `/audit`, `/polish` for design quality passes on UI work
