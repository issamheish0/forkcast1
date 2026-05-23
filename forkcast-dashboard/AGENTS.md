# Plate Management Management System - Codex Developer Guide

## Project Overview

Enterprise-grade Next.js 15 restaurant management system with Supabase backend, featuring multi-tenant operations, advanced bookings, kitchen workflows, PWA capabilities, analytics, and mobile optimization for 8-inch tablets.

### Core Capabilities
    
- **Multi-Tenant Restaurant Operations** | **Advanced Booking System** | **Kitchen Operations**
- **Progressive Web App** | **Analytics & Reporting** | **Staff Management**
- **Customer Management** | **Table Management** | **Touch-Optimized UI** | **Mobile Optimization**

## Critical Architecture Principles

### 🚫 NEVER USE API ROUTES

**CRITICAL**: Use direct Supabase calls exclusively. API routes add unnecessary layers, reduce performance, and complicate auth flows.

```typescript
// ✅ CORRECT: Direct Supabase calls
const { data } = await supabase.from("table").select();
const { data } = useBookings(restaurantId); // React Query + hooks

// ❌ NEVER: API routes for database operations
// app/api/bookings/route.ts - DON'T CREATE THIS
```

### 🏗️ Multi-Tenant Architecture

- All operations scoped by `restaurant_id`
- RLS policies provide granular access control
- Restaurant staff system for secondary authorization

### 🔐 Authentication Flow

1. Valid Supabase session
2. Active `restaurant_staff` record
3. Middleware validates both before dashboard access

## MCP Integration Strategy

### 🧠 Sequential Thinking (Use Proactively)

**Always start here for multi-step problems**

- Complex booking flows | Schema changes | Performance analysis | Feature design
- Touch interaction debugging | Tablet optimization | PWA implementation

### 📊 Knowledge Graph (Use for Relationships)

**Store relationships and business logic**

- Restaurant rules | Feature dependencies | Technical debt | Integration patterns
- Table relationships | Booking state machines | Touch interaction patterns

### 💾 Memory Bank (Use for Patterns)

**Reusable patterns and documentation**

- Code snippets | Configurations | Queries | Migration scripts
- Touch interaction patterns | Tablet UI components | PWA configurations

### 🌐 Fetch (Use for External Data)

**Web content and image processing**

- Menu image optimization | External API integration | Content fetching
- Restaurant data scraping | Image processing for tablets

### 🤖 Puppeteer (Use for Testing)

**End-to-end testing and automation**

- Booking flows | PWA functionality | Tablet responsiveness | Kitchen workflows
- Touch interaction testing | Cross-device compatibility

### 🗄️ Supabase MCP (Use for Database)

**Direct database operations and monitoring**

- Project management | Migrations | RLS policies | Performance monitoring
- Real-time subscriptions | Database debugging

## System Architecture

### Route Structure

```
app/
├── (auth)/           # Unauthenticated routes
├── (dashboard)/      # Protected routes - requires auth + staff access
│   ├── dashboard/    ├── bookings/     ├── customers/    ├── menu/
│   ├── tables/       ├── analytics/    ├── waitlist/     ├── reviews/
│   ├── loyalty/      ├── staff/        ├── orders/       ├── kitchen/
│   └── settings/
└── actions.ts        # Server actions for push notifications (NO API ROUTES)
```

### Database Schema (`db/schema.sql`)

**Always reference schema first** - 40+ tables with complex relationships

```sql
profiles.id → auth.users.id (extends Supabase auth)
restaurant_staff → restaurants + profiles (access control)
bookings → users + restaurants + tables (via booking_tables junction)
loyalty_* tables → sophisticated points system with audit trails
```

### Supabase Client Strategy

- `lib/supabase/client.ts`: Browser client for client components
- `lib/supabase/server.ts`: Server client for server components
- `lib/supabase/middleware.ts`: Middleware client for route protection

## Key Features & Implementation

### 📱 PWA & Mobile (8-Inch Tablet Optimized)

- **Service Worker** (`public/sw.js`): Offline functionality, caching strategies
- **Push Notifications** (`app/actions.ts`): VAPID configuration, booking alerts
- **Touch Interactions**: Optimized for tablet screens with proper touch targets
- **Landscape Orientation**: Always landscape for tablet usage
- **Offline Capabilities**: Cached dashboard access, background sync

### 🍽️ Restaurant Operations

- **Table Management**: Drag & drop positioning, section-based organization
- **Booking System**: Real-time availability, multi-table bookings, walk-ins
- **Kitchen Workflow**: Order tracking, status management, real-time updates
- **Staff Management**: Role-based access, shift scheduling, permissions

### 📊 Analytics & Reporting

- **Business Intelligence**: Revenue, booking, customer, operational analytics
- **Data Visualization**: Charts optimized for tablet viewing
- **Real-time Dashboards**: Live performance monitoring
- **Export Capabilities**: PDF, Excel, CSV formats

## Development Workflow

### Scripts & Commands

```bash
# Core Development
npm run dev          # Development server (Turbopack)
npm run build        # Production build
npm run lint         # Lint code
npm start           # Production server

# Data Management
npm run seed:menu                # Populate menu data
npm run create:sample-data       # Generate sample data
npm run test:kitchen-operations  # Test kitchen workflow
```

### Environment Variables.  
      
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_VAPID_PUBLIC_KEY=    # Push notifications
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_APP_URL=http://rbs-restaurant.vercel.app/
```

### MCP-Enhanced Workflow
   
1. **Sequential Thinking** → Break down complex problems
2. **Supabase MCP** → Database operations and monitoring
3. **Fetch** → External data and image processing
4. **Puppeteer** → Test user flows and functionality
5. **Knowledge Graph** → Store insights and relationships
6. **Memory Bank** → Document patterns and solutions

## Critical Code Patterns

### Staff Access Check

```typescript
const { data: staffData } = await supabase
  .from("restaurant_staff")
  .select("id, role, permissions, restaurant_id")
  .eq("user_id", userId)
  .eq("is_active", true)
  .single();
```

### Touch-Optimized Table Interactions

```typescript
// Proper touch handling for tablet screens
const handleTouchStart = useCallback((e: React.TouchEvent, tableId: string) => {
  const touch = e.touches[0]
  setTouchStart({ x: touch.clientX, y: touch.clientY, time: Date.now() })
}, [])

// Always use touch-action: manipulation for interactive elements
style={{ touchAction: 'manipulation' }}
```

### PWA Service Worker

```typescript
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
}
```

### Booking with Relations

```typescript
const { data: booking } = await supabase
  .from("bookings")
  .select(
    `
    *, user:profiles(*), restaurant:restaurants(*),
    tables:booking_tables(table:restaurant_tables(*)),
    attendees:booking_attendees(user:profiles(*))
  `
  )
  .eq("id", bookingId)
  .single();
```

### Real-time Subscriptions

```typescript
const subscription = supabase
  .channel("booking-updates")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "bookings" },
    (payload) => queryClient.invalidateQueries(["bookings"])
  )
  .subscribe();
```

## Tablet & Touch Optimization Rules

### 🎯 Touch Targets

- Minimum 44px touch targets for all interactive elements
- Use `touch-action: manipulation` to prevent iOS zoom
- Implement proper touch feedback with visual states

### 📐 Layout Optimization

- Always landscape orientation for tablets
- Compact sidebar with overlay mode for maximum content space
- Grid layouts optimized for 8-inch screens (1024x768 typical)
- Scrollable containers with proper momentum scrolling

### 🖱️ Interaction Patterns

```typescript
// Touch-optimized drag and drop
const handleDragStart = useCallback((e: React.TouchEvent) => {
  e.preventDefault() // Prevent default scrolling
  // Implement custom drag logic
}, [])

// Proper resize handles for touch
style={{
  width: '48px', height: '48px', // Large enough for touch
  touchAction: 'none' // Prevent interference
}}
```

## Essential Guidelines

### ✅ DO

- Use direct Supabase calls exclusively
- Filter all queries by `restaurant_id` for multi-tenant isolation
- Use React Query hooks for client-side data fetching
- Implement proper RLS policies for security
- Optimize for 8-inch tablet screens and touch interactions
- Use MCP tools proactively for complex tasks
- Always test touch interactions on actual devices
- Store patterns in Memory Bank, relationships in Knowledge Graph

### ❌ DON'T

- Create API routes (`/api/*`) for database operations
- Query Supabase directly in client components without React Query
- Skip restaurant_staff access checks
- Cache dynamic/auth endpoints in service worker
- Ignore booking status state machines
- Use small touch targets (<44px)
- Implement complex gestures that conflict with system navigation
- Make assumptions - use Sequential Thinking for complex problems

## Key Files Reference

- `middleware.ts`: Route protection logic
- `lib/restaurant-auth.ts`: Custom authentication layer
- `types/index.ts`: Complete domain model interfaces
- `app/(dashboard)/layout.tsx`: Main dashboard with staff access check
- `db/schema.sql`: Complete database schema (ground truth)
- `app/actions.ts`: Server actions for push notifications
- `public/sw.js`: Service worker for PWA functionality
- `components/dashboard/unified-floor-plan.tsx`: Main floor plan with touch optimization
- `components/tables/floor-plan-editor.tsx`: Table positioning with drag/resize
- `components/dashboard/checkin-queue.tsx`: Compact check-in interface
- `app/manifest.ts`: PWA manifest configuration

## Touch & Tablet Specific Components

- **Floor Plan Editor**: Touch-optimized table positioning and resizing
- **Unified Floor Plan**: Touch-friendly table interactions and status management
- **Check-in Queue**: Compact design for tablet screens
- **Sidebar**: Overlay mode with blur backdrop for space efficiency

## Performance & Quality Assurance

### Before Deployment Always Run

```bash
npm run lint        # Fix all linting errors
npm run build       # Ensure production build succeeds
```

### Testing Strategy

- Use Puppeteer MCP for automated testing
- Test touch interactions on actual tablet devices
- Verify PWA functionality across browsers
- Validate offline capabilities

---

**Remember**: This is an enterprise tablet-optimized restaurant system. Always use MCP tools proactively, optimize for 8-inch tablet screens, implement proper touch interactions, and never use API routes - direct Supabase calls only! Use Sequential Thinking for complex decisions, document patterns in Memory Bank, store relationships in Knowledge Graph, and test thoroughly with Puppeteer. 🚀


Codex will review your output once you are done 
