---
description: PWA, tablet optimization, bundle size, touch performance, caching
globs: ["public/sw.js", "app/manifest.ts", "next.config.ts", "components/dashboard/unified-floor-plan.tsx", "components/dashboard/checkin-queue.tsx"]
---

# Performance & PWA

## PWA
- Service worker: `public/sw.js` — offline caching, background sync
- Manifest: `app/manifest.ts` — PWA configuration
- Push notifications: `app/actions.ts` (VAPID) — booking alerts
- Never cache auth/dynamic data in service worker

## Tablet Performance
- Landscape-only orientation for 8-inch tablets (1024x768)
- Compact sidebar with overlay mode — maximize content area
- Scrollable containers with `-webkit-overflow-scrolling: touch`
- Minimize re-renders on floor plan — tables are frequently updated via Realtime

## Bundle & Loading
- `optimizePackageImports` enabled for `lucide-react` and `@radix-ui/react-icons`
- Image optimization: WebP + AVIF formats, Supabase storage remote patterns
- Static assets cached with 1-year immutable headers
- Use dynamic imports for heavy components (charts, maps, PDF generation)

## Caching Strategy
- React Query: stale-while-revalidate for most data
- Supabase Realtime: invalidate React Query cache on changes
- Static assets: `Cache-Control: public, max-age=31536000, immutable`
- Service worker: no-cache for `/sw.js` itself

## Tool Dispatch
- **react-performance-optimizer agent:** Dispatch for rendering issues, bundle size analysis, or Core Web Vitals
- **impeccable /optimize:** Use for loading speed, rendering, animation, and bundle improvements
