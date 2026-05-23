---
description: Authentication, authorization, RLS, middleware protection, staff access
globs: ["middleware.ts", "lib/restaurant-auth.ts", "lib/auth/**", "lib/supabase/**", "app/(auth)/**"]
---

# Security

## Authentication Flow
1. Supabase session validated in middleware
2. `restaurant_staff` record checked (must be `is_active: true`)
3. Restaurant tier checked against route access (`lib/utils/tier.ts`)
4. Dashboard layout performs secondary staff verification

## Staff Access Checks
- Query `restaurant_staff` with both `user_id` and `is_active: true`
- Staff roles: owner, manager, host, server, chef — check role for sensitive operations
- Never trust client-side role claims — verify server-side

## Row Level Security (RLS)
- RLS is the primary access control layer — application checks are secondary
- Test RLS policies when modifying table access patterns
- Service role client (`adminClient.ts`) bypasses RLS — audit every usage

## Secrets & Credentials
- Never log auth tokens, API keys, or Supabase keys
- Never commit `.env` files
- VAPID keys for push notifications stored in env vars only
- Service worker must not cache auth-related endpoints

## Input Validation
- Validate user input at system boundaries with Zod schemas
- Sanitize before Supabase queries — though RLS provides defense-in-depth
- Content Security Policy headers configured in `next.config.ts`

## Tool Dispatch
- **api-tester agent:** Dispatch for auth flow verification, RLS policy testing, multi-tenant isolation checks
- **semgrep plugin:** Auto-fires on file edits for AST-aware security scanning
- **coderabbit:code-review:** Verify security-sensitive changes before merging
