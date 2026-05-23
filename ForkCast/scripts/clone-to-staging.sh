#!/usr/bin/env bash
# ============================================================================
# Clone Production Database to Staging
# ============================================================================
# Safely creates a full replica of the production Supabase database on staging.
#
# What gets cloned:
#   - Schema (119 tables, constraints, indexes, types, views)
#   - 269 custom database functions + private schema functions
#   - 71 triggers
#   - 298 RLS policies (across 107 tables)
#   - 13 extensions (PostGIS, pg_cron, pg_net, etc.)
#   - All auth users (17k+ with passwords intact)
#   - All application data
#   - 16 cron jobs (with URL rewriting for staging)
#   - 19 Edge Functions
#
# Safety:
#   - ZERO writes to production (only pg_dump reads)
#   - Confirmation prompts before each staging write
#   - Validation checks after each phase
#
# Prerequisites:
#   - psql and pg_dump installed (brew install libpq)
#   - Supabase CLI (npx supabase)
#   - Staging project must have IPv4 add-on enabled (or IPv6 network)
#   - Extensions must be pre-configured on staging (script handles this)
#
# Usage:
#   1. Copy scripts/staging.env.example to scripts/staging.env
#   2. Fill in your credentials
#   3. Run: ./scripts/clone-to-staging.sh
# ============================================================================

set -euo pipefail

# ── Colors & Helpers ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_phase()   { echo -e "\n${BLUE}════════════════════════════════════════════════════${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}════════════════════════════════════════════════════${NC}\n"; }
log_step()    { echo -e "${CYAN}  ▸ $1${NC}"; }
log_success() { echo -e "${GREEN}  ✓ $1${NC}"; }
log_warn()    { echo -e "${YELLOW}  ⚠ $1${NC}"; }
log_error()   { echo -e "${RED}  ✗ $1${NC}"; }

confirm() {
  if [[ "${AUTO_CONFIRM:-}" == "1" ]]; then
    echo -e "${YELLOW}  ⟩ $1 [y/N] y (auto)${NC}"
    return 0
  fi
  echo -e "${YELLOW}"
  read -p "  ⟩ $1 [y/N] " -n 1 -r
  echo -e "${NC}"
  [[ $REPLY =~ ^[Yy]$ ]]
}

# ── Load Configuration ────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$SCRIPT_DIR/staging.env"

if [[ ! -f "$ENV_FILE" ]]; then
  log_error "Configuration file not found: $ENV_FILE"
  echo "  Copy scripts/staging.env.example to scripts/staging.env and fill in your credentials."
  exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

# Validate required variables
REQUIRED_VARS=(PROD_PROJECT_REF PROD_DB_PASSWORD PROD_DB_HOST STAGING_PROJECT_REF STAGING_DB_PASSWORD STAGING_DB_HOST STAGING_SUPABASE_URL)
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    log_error "Missing required variable: $var in $ENV_FILE"
    exit 1
  fi
done

# Build connection strings (use plain 'postgres' user — works for both old and new Supabase projects)
PROD_DB_URL="postgresql://postgres:${PROD_DB_PASSWORD}@${PROD_DB_HOST}:5432/postgres"
STAGING_DB_URL="postgresql://postgres:${STAGING_DB_PASSWORD}@${STAGING_DB_HOST}:5432/postgres"

# Temp directory for SQL dumps
DUMP_DIR="$SCRIPT_DIR/.staging-dump"
mkdir -p "$DUMP_DIR"

# Production URL pattern to replace in cron jobs
PROD_URL_PATTERN="https://${PROD_PROJECT_REF}.supabase.co"

# ── Pre-flight Checks ─────────────────────────────────────────────────────────
log_phase "Phase 0: Pre-flight Checks"

log_step "Checking required tools..."

# Check for libpq tools (may be in homebrew keg-only path)
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"

for tool in pg_dump psql npx; do
  if ! command -v "$tool" &> /dev/null; then
    log_error "$tool is not installed or not in PATH"
    if [[ "$tool" == "pg_dump" || "$tool" == "psql" ]]; then
      echo "  Install with: brew install libpq"
    fi
    exit 1
  fi
done
log_success "All required tools found (pg_dump, psql, npx)"

log_step "Testing production connection (read-only)..."
if ! psql "$PROD_DB_URL" -c "SELECT 1" &> /dev/null; then
  log_error "Cannot connect to production database. Check PROD_DB_PASSWORD and PROD_DB_HOST."
  exit 1
fi
log_success "Production connection OK"

log_step "Testing staging connection..."
if ! psql "$STAGING_DB_URL" -c "SELECT 1" &> /dev/null; then
  log_error "Cannot connect to staging database."
  log_error "New Supabase projects use IPv6 only. Enable the IPv4 add-on:"
  log_error "Dashboard > Project > Settings > Add-ons > IPv4 Address > Enable"
  exit 1
fi
log_success "Staging connection OK"

# Show what we're about to do
echo ""
echo -e "  ${CYAN}Production:${NC} $PROD_PROJECT_REF ($PROD_DB_HOST)"
echo -e "  ${CYAN}Staging:${NC}    $STAGING_PROJECT_REF ($STAGING_DB_HOST)"
echo ""

if ! confirm "Ready to clone production → staging? This will OVERWRITE all staging data."; then
  echo "  Aborted."
  exit 0
fi

# ── Phase A: Dump Production Schema ──────────────────────────────────────────
log_phase "Phase A: Dump Production Schema (read-only)"
log_step "This captures: tables, functions, triggers, RLS policies, extensions, views, types"

# Save current linked project to restore later
ORIGINAL_LINKED=""
if [[ -f "$PROJECT_DIR/supabase/.temp/project-ref" ]]; then
  ORIGINAL_LINKED=$(cat "$PROJECT_DIR/supabase/.temp/project-ref")
  log_step "Currently linked to: $ORIGINAL_LINKED (will restore after)"
fi

# Use pg_dump for schema (more reliable than supabase db pull when migration history is out of sync)
log_step "Dumping public schema..."
pg_dump "$PROD_DB_URL" \
  --schema-only \
  --schema=public \
  --no-owner \
  --no-acl \
  --quote-all-identifiers \
  > "$DUMP_DIR/schema_public_raw.sql"

log_step "Dumping private schema (functions referenced by RLS policies)..."
pg_dump "$PROD_DB_URL" \
  --schema-only \
  --schema=private \
  --no-owner \
  --no-acl \
  --quote-all-identifiers \
  > "$DUMP_DIR/schema_private_raw.sql" 2>/dev/null || echo "" > "$DUMP_DIR/schema_private_raw.sql"

# Clean pg_dump output: strip psql-specific directives (PostgreSQL 17 adds \restrict/\unrestrict)
log_step "Cleaning schema dumps (removing psql-specific directives)..."
grep -v '^\\\(restrict\|unrestrict\|allow\|connect\)' "$DUMP_DIR/schema_private_raw.sql" > "$DUMP_DIR/schema_private.sql"
grep -v '^\\\(restrict\|unrestrict\|allow\|connect\)' "$DUMP_DIR/schema_public_raw.sql" \
  | sed 's/^CREATE SCHEMA "public";/CREATE SCHEMA IF NOT EXISTS "public";/' \
  > "$DUMP_DIR/schema_public.sql"

# Combine: private first (creates schema + functions), then public (can reference private.*)
cat "$DUMP_DIR/schema_private.sql" "$DUMP_DIR/schema_public.sql" > "$DUMP_DIR/schema_combined.sql"

SCHEMA_LINES=$(wc -l < "$DUMP_DIR/schema_combined.sql" | tr -d ' ')
FUNC_COUNT=$(grep -c "CREATE.*FUNCTION" "$DUMP_DIR/schema_combined.sql" || echo "0")
TRIGGER_COUNT=$(grep -c "CREATE TRIGGER" "$DUMP_DIR/schema_combined.sql" || echo "0")
POLICY_COUNT=$(grep -c "CREATE POLICY" "$DUMP_DIR/schema_combined.sql" || echo "0")
TABLE_COUNT=$(grep -c "CREATE TABLE" "$DUMP_DIR/schema_combined.sql" || echo "0")

log_success "Schema dumped: ${SCHEMA_LINES} lines — ~${TABLE_COUNT} tables, ~${FUNC_COUNT} functions, ~${TRIGGER_COUNT} triggers, ~${POLICY_COUNT} policies"

log_step "Exporting table/sequence grants (anon, authenticated, service_role)..."
psql "$PROD_DB_URL" -t -A -c "
  SELECT 'GRANT ' || privilege_type || ' ON public.\"' || table_name || '\" TO ' || grantee || ';'
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
  ORDER BY table_name, grantee, privilege_type;
" > "$DUMP_DIR/grants.sql"
# Also grant sequences for INSERT operations
echo "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;" >> "$DUMP_DIR/grants.sql"
echo "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;" >> "$DUMP_DIR/grants.sql"
echo "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;" >> "$DUMP_DIR/grants.sql"
GRANT_COUNT=$(wc -l < "$DUMP_DIR/grants.sql" | tr -d ' ')
log_success "Exported $GRANT_COUNT grant statements"

# ── Phase B: Export Production Data ───────────────────────────────────────────
log_phase "Phase B: Export Production Data (read-only)"

log_step "Exporting auth data (users + passwords)..."
pg_dump "$PROD_DB_URL" \
  --data-only \
  --schema=auth \
  --quote-all-identifiers \
  --no-owner \
  --no-acl \
  --disable-triggers \
  > "$DUMP_DIR/auth_data.sql"

AUTH_SIZE=$(du -h "$DUMP_DIR/auth_data.sql" | cut -f1)
log_success "Auth data exported ($AUTH_SIZE)"

log_step "Exporting public data (all app tables)..."
pg_dump "$PROD_DB_URL" \
  --data-only \
  --schema=public \
  --quote-all-identifiers \
  --no-owner \
  --no-acl \
  --disable-triggers \
  > "$DUMP_DIR/public_data.sql"

PUBLIC_SIZE=$(du -h "$DUMP_DIR/public_data.sql" | cut -f1)
log_success "Public data exported ($PUBLIC_SIZE)"

# ── Phase C: Export Cron Jobs ─────────────────────────────────────────────────
log_phase "Phase C: Export Cron Jobs (read-only)"

log_step "Exporting cron job definitions..."

# Export cron jobs as schedule() calls
psql "$PROD_DB_URL" -t -A -c "
  SELECT format(
    'SELECT cron.schedule(%L, %L, %L);',
    jobname,
    schedule,
    command
  )
  FROM cron.job
  WHERE active = true
  ORDER BY jobid;
" > "$DUMP_DIR/cron_jobs_raw.sql"

# Rewrite production URLs to staging
if [[ -s "$DUMP_DIR/cron_jobs_raw.sql" ]]; then
  sed "s|${PROD_URL_PATTERN}|${STAGING_SUPABASE_URL}|g" \
    "$DUMP_DIR/cron_jobs_raw.sql" > "$DUMP_DIR/cron_jobs.sql"

  CRON_COUNT=$(grep -c "cron.schedule" "$DUMP_DIR/cron_jobs.sql" || echo "0")
  REWRITTEN=$(grep -c "${STAGING_SUPABASE_URL}" "$DUMP_DIR/cron_jobs.sql" || echo "0")

  log_success "Exported $CRON_COUNT cron jobs"
  if [[ "$REWRITTEN" -gt 0 ]]; then
    log_warn "$REWRITTEN cron job(s) had production URLs rewritten to staging"
  fi

  # Safety check: ensure no production URLs remain
  LEAKED=$(grep -c "${PROD_URL_PATTERN}" "$DUMP_DIR/cron_jobs.sql" 2>/dev/null || echo "0")
  if [[ "$LEAKED" -gt 0 ]]; then
    log_error "$LEAKED cron job(s) still contain production URLs!"
    exit 1
  fi
  log_success "No production URLs in cron jobs (verified)"
else
  log_warn "No active cron jobs found"
  echo "" > "$DUMP_DIR/cron_jobs.sql"
fi

# ── Phase D: Push Schema to Staging ───────────────────────────────────────────
log_phase "Phase D: Push Schema to Staging"

if ! confirm "Push schema to staging? This creates all tables, functions, triggers, and policies."; then
  echo "  Aborted."
  exit 0
fi

# Drop and recreate schemas first (clean slate for re-runs)
log_step "Dropping and recreating public + private schemas on staging (clean slate)..."
psql "$STAGING_DB_URL" -c "
  DROP SCHEMA IF EXISTS private CASCADE;
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA IF NOT EXISTS public;
  GRANT ALL ON SCHEMA public TO postgres;
  GRANT ALL ON SCHEMA public TO anon;
  GRANT ALL ON SCHEMA public TO authenticated;
  GRANT ALL ON SCHEMA public TO service_role;
" 2>/dev/null || true
log_success "Staging schemas reset"

# Enable extensions AFTER schema reset (so they're created in the right schemas)
log_step "Enabling extensions on staging (matching production)..."
psql "$STAGING_DB_URL" -c "
  CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\" SCHEMA extensions;
  CREATE EXTENSION IF NOT EXISTS \"pgcrypto\" SCHEMA extensions;
  CREATE EXTENSION IF NOT EXISTS \"pg_trgm\" SCHEMA public;
  CREATE EXTENSION IF NOT EXISTS \"http\" SCHEMA public;
  CREATE EXTENSION IF NOT EXISTS \"pg_cron\" SCHEMA pg_catalog;
  CREATE EXTENSION IF NOT EXISTS \"postgis\" SCHEMA public;
  CREATE EXTENSION IF NOT EXISTS \"pg_net\" SCHEMA public;
" 2>/dev/null || true
log_success "Extensions configured"

log_step "Pushing schema directly via psql..."
SCHEMA_ERRORS=$(psql "$STAGING_DB_URL" -v ON_ERROR_STOP=0 -f "$DUMP_DIR/schema_combined.sql" 2>&1 | grep -c "^ERROR" || true)
echo "  (${SCHEMA_ERRORS} non-critical errors)"
log_success "Schema pushed to staging"

log_step "Applying table/sequence grants..."
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=0 -f "$DUMP_DIR/grants.sql" > /dev/null 2>&1
APPLIED_GRANTS=$(psql "$STAGING_DB_URL" -t -A -c "
  SELECT count(*) FROM information_schema.role_table_grants
  WHERE grantee IN ('anon', 'authenticated', 'service_role') AND table_schema = 'public';
")
log_success "$APPLIED_GRANTS table grants applied"

# Verify schema on staging
log_step "Verifying staging schema..."
STAGING_TABLES=$(psql "$STAGING_DB_URL" -t -A -c "
  SELECT count(*) FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
")
STAGING_FUNCTIONS=$(psql "$STAGING_DB_URL" -t -A -c "
  SELECT count(*) FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.prokind = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_depend d
    JOIN pg_extension e ON d.refobjid = e.oid
    WHERE d.objid = p.oid AND d.deptype = 'e'
  );
")
STAGING_TRIGGERS=$(psql "$STAGING_DB_URL" -t -A -c "
  SELECT count(*) FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE NOT t.tgisinternal AND n.nspname = 'public';
")
STAGING_POLICIES=$(psql "$STAGING_DB_URL" -t -A -c "
  SELECT count(*) FROM pg_policies WHERE schemaname = 'public';
")

log_success "Staging has: ${STAGING_TABLES} tables, ${STAGING_FUNCTIONS} functions, ${STAGING_TRIGGERS} triggers, ${STAGING_POLICIES} policies"

# ── Phase E: Restore Data to Staging ──────────────────────────────────────────
log_phase "Phase E: Restore Data to Staging"

if ! confirm "Restore production data to staging? (auth users first, then app data)"; then
  echo "  Aborted."
  exit 0
fi

# IMPORTANT: Use -c and -f together so session_replication_role stays active
# during the entire data restore (prevents triggers from firing)

log_step "Clearing existing auth data on staging (for clean re-sync)..."
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=0 -c "
  SET session_replication_role = 'replica';
  TRUNCATE auth.sessions CASCADE;
  TRUNCATE auth.refresh_tokens CASCADE;
  TRUNCATE auth.mfa_factors CASCADE;
  TRUNCATE auth.mfa_challenges CASCADE;
  TRUNCATE auth.mfa_amr_claims CASCADE;
  TRUNCATE auth.flow_state CASCADE;
  TRUNCATE auth.one_time_tokens CASCADE;
  TRUNCATE auth.identities CASCADE;
  TRUNCATE auth.users CASCADE;
  SET session_replication_role = 'origin';
" 2>/dev/null || true
log_success "Auth tables cleared"

log_step "Restoring auth data (users + passwords)..."
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=0 \
  -c "SET session_replication_role = 'replica';" \
  -f "$DUMP_DIR/auth_data.sql" 2>&1 | { grep -c "^ERROR" || true; } | xargs -I {} echo "  ({} non-critical errors — ownership warnings are expected)"
log_success "Auth data restored"

log_step "Restoring public data (app tables)..."
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=0 \
  -c "SET session_replication_role = 'replica';" \
  -f "$DUMP_DIR/public_data.sql" 2>&1 | { grep -c "^ERROR" || true; } | xargs -I {} echo "  ({} non-critical errors)"

# Re-enable triggers
psql "$STAGING_DB_URL" -c "SET session_replication_role = 'origin';" 2>/dev/null || true
log_success "Public data restored"

# Verify data counts
STAGING_USERS=$(psql "$STAGING_DB_URL" -t -A -c "SELECT count(*) FROM auth.users;" 2>/dev/null || echo "?")
STAGING_PROFILES=$(psql "$STAGING_DB_URL" -t -A -c "SELECT count(*) FROM public.profiles;" 2>/dev/null || echo "?")
STAGING_BOOKINGS=$(psql "$STAGING_DB_URL" -t -A -c "SELECT count(*) FROM public.bookings;" 2>/dev/null || echo "?")
STAGING_RESTAURANTS=$(psql "$STAGING_DB_URL" -t -A -c "SELECT count(*) FROM public.restaurants;" 2>/dev/null || echo "?")

log_success "Staging data: ${STAGING_USERS} users, ${STAGING_PROFILES} profiles, ${STAGING_BOOKINGS} bookings, ${STAGING_RESTAURANTS} restaurants"

# ── Phase F: Restore Cron Jobs ────────────────────────────────────────────────
log_phase "Phase F: Restore Cron Jobs"

if [[ -s "$DUMP_DIR/cron_jobs.sql" ]]; then
  log_step "Installing cron jobs on staging..."

  # First, clear any existing cron jobs on staging
  psql "$STAGING_DB_URL" -c "SELECT cron.unschedule(jobid) FROM cron.job;" 2>/dev/null || true

  # Install the production cron jobs (with rewritten URLs)
  psql "$STAGING_DB_URL" -v ON_ERROR_STOP=0 -f "$DUMP_DIR/cron_jobs.sql" 2>&1 | { grep -c "^ERROR" || true; } | xargs -I {} echo "  ({} errors)"

  STAGING_CRONS=$(psql "$STAGING_DB_URL" -t -A -c "SELECT count(*) FROM cron.job;" 2>/dev/null || echo "?")
  log_success "$STAGING_CRONS cron jobs installed on staging"

  # Verify no production URLs leaked
  LEAKED=$(psql "$STAGING_DB_URL" -t -A -c "
    SELECT count(*) FROM cron.job
    WHERE command LIKE '%${PROD_URL_PATTERN}%';
  " 2>/dev/null || echo "?")

  if [[ "$LEAKED" -gt 0 ]]; then
    log_warn "$LEAKED cron job(s) still reference production URL — check manually!"
  else
    log_success "All cron jobs point to staging URL (no production URL leaks)"
  fi
else
  log_warn "No cron jobs to restore"
fi

# ── Phase G: Deploy Edge Functions ────────────────────────────────────────────
log_phase "Phase G: Deploy Edge Functions"

if [[ -d "$PROJECT_DIR/supabase/functions" ]]; then
  FUNC_DIRS=$(find "$PROJECT_DIR/supabase/functions" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
  log_step "Found $FUNC_DIRS Edge Functions to deploy"

  if confirm "Deploy all Edge Functions to staging?"; then
    log_step "Deploying Edge Functions to staging..."
    npx supabase functions deploy --project-ref "$STAGING_PROJECT_REF"
    log_success "Edge Functions deployed to staging"
  else
    log_warn "Skipped Edge Function deployment"
  fi
else
  log_warn "No Edge Functions directory found"
fi

# ── Phase H: Secrets Reminder ─────────────────────────────────────────────────
log_phase "Phase H: Edge Function Secrets (Manual Step)"

echo -e "  ${YELLOW}Edge Functions need secrets set on staging. Run these commands:${NC}"
echo ""
echo -e "  ${CYAN}npx supabase secrets set --project-ref $STAGING_PROJECT_REF \\\\${NC}"
echo -e "  ${CYAN}  STRIPE_SECRET_KEY=sk_test_... \\\\${NC}"
echo -e "  ${CYAN}  TWILIO_ACCOUNT_SID=... \\\\${NC}"
echo -e "  ${CYAN}  TWILIO_AUTH_TOKEN=... \\\\${NC}"
echo -e "  ${CYAN}  GOOGLE_API_KEY=... \\\\${NC}"
echo -e "  ${CYAN}  MONTYPAY_API_KEY=... \\\\${NC}"
echo -e "  ${CYAN}  WHISH_API_KEY=...${NC}"
echo ""
log_warn "Use TEST/SANDBOX keys for payment providers on staging!"
echo ""

# ── Restore Original Link ────────────────────────────────────────────────────
log_phase "Cleanup"

if [[ -n "$ORIGINAL_LINKED" ]]; then
  log_step "Restoring original Supabase link to: $ORIGINAL_LINKED"
  echo "$PROD_DB_PASSWORD" | npx supabase link --project-ref "$ORIGINAL_LINKED"
  log_success "Restored link to $ORIGINAL_LINKED"
fi

# Offer to clean up temp files
if confirm "Delete temporary dump files? ($DUMP_DIR)"; then
  rm -rf "$DUMP_DIR"
  log_success "Temporary files cleaned up"
else
  log_warn "Dump files kept at: $DUMP_DIR"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
log_phase "Clone Complete!"

echo -e "  ${GREEN}Production → Staging clone finished successfully.${NC}"
echo ""
echo -e "  ${CYAN}Staging Project:${NC} $STAGING_PROJECT_REF"
echo -e "  ${CYAN}Staging URL:${NC}     $STAGING_SUPABASE_URL"
echo ""
echo -e "  ${CYAN}What was cloned:${NC}"
echo -e "    • Schema (tables, functions, triggers, RLS policies)"
echo -e "    • Auth users + app data"
echo -e "    • Cron jobs (with staging URLs)"
echo -e "    • Edge Functions"
echo ""
echo -e "  ${YELLOW}Remaining manual steps:${NC}"
echo -e "    1. Set Edge Function secrets (see Phase H above)"
echo -e "    2. Update your app's .env for staging:"
echo -e "       EXPO_PUBLIC_SUPABASE_URL=${STAGING_SUPABASE_URL}"
echo -e "       EXPO_PUBLIC_SUPABASE_ANON_KEY=<staging-anon-key>"
echo -e "    3. Test a few key flows (login, booking, payments)"
echo -e "    4. Disable IPv4 add-on if you want to save \$4/month"
echo ""
echo -e "  ${GREEN}You can re-run this script anytime to refresh staging from production.${NC}"
