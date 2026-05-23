#!/usr/bin/env bash
# ============================================================================
# Copy Edge Function Secrets from Production to Staging
# ============================================================================
# Supabase CLI can't read secret values (only hashes), so this script
# helps you set them on staging by prompting for each value.
#
# OPTION 1 (Recommended): Copy from Supabase Dashboard
#   1. Go to Dashboard > Production Project > Edge Functions > Select any function
#   2. Click "Manage Secrets" — you can see and copy all values there
#   3. Fill in the secrets below and run this script
#
# OPTION 2: Fill in scripts/staging-secrets.env and run this script
#
# Usage: ./scripts/copy-secrets-to-staging.sh
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/staging.env"
SECRETS_FILE="$SCRIPT_DIR/staging-secrets.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: scripts/staging.env not found"
  exit 1
fi

source "$ENV_FILE"

if [[ -z "${STAGING_PROJECT_REF:-}" ]]; then
  echo "Error: STAGING_PROJECT_REF not set in staging.env"
  exit 1
fi

echo "============================================"
echo "  Copy Secrets to Staging"
echo "  Target: $STAGING_PROJECT_REF"
echo "============================================"
echo ""

if [[ -f "$SECRETS_FILE" ]]; then
  echo "Found staging-secrets.env — loading secrets..."
  source "$SECRETS_FILE"

  # Build the secrets set command from all non-empty variables in the file
  SECRETS_ARGS=""
  while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    # Strip quotes from value
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    if [[ -n "$value" ]]; then
      SECRETS_ARGS="$SECRETS_ARGS $key=$value"
    fi
  done < "$SECRETS_FILE"

  if [[ -n "$SECRETS_ARGS" ]]; then
    echo ""
    echo "Setting secrets on staging..."
    npx supabase secrets set --project-ref "$STAGING_PROJECT_REF" $SECRETS_ARGS
    echo ""
    echo "Done! Verifying..."
    npx supabase secrets list --project-ref "$STAGING_PROJECT_REF"
  else
    echo "No secrets found in $SECRETS_FILE"
  fi
else
  echo "No staging-secrets.env found."
  echo ""
  echo "Create it with your secret values:"
  echo "  cp scripts/staging-secrets.env.example scripts/staging-secrets.env"
  echo "  # Fill in the values"
  echo "  ./scripts/copy-secrets-to-staging.sh"
fi
