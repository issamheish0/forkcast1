#!/usr/bin/env bash
# Automated Supabase Database Backup to AWS S3
# This script creates a compressed PostgreSQL dump and uploads it to S3
# Usage: ./backup_db.sh
# Required environment variables:
#   - SUPABASE_DB_URL: PostgreSQL connection string
#   - AWS_ACCESS_KEY_ID: AWS IAM access key
#   - AWS_SECRET_ACCESS_KEY: AWS IAM secret key
#   - AWS_DEFAULT_REGION: AWS region (default: eu-central-1)
#   - S3_BUCKET: S3 bucket name (default: plate-backups)

set -euo pipefail

# Configuration
DATE=$(date +%F_%H-%M-%S)
BACKUP_FILE="plate_backup_${DATE}.sqlc"
TMP="/tmp/${BACKUP_FILE}"
AWS_REGION="${AWS_DEFAULT_REGION:-eu-central-1}"
BUCKET="${S3_BUCKET:-plate-backups}"
S3_PATH="database/${BACKUP_FILE}"

# Validate required environment variables
if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Error: SUPABASE_DB_URL environment variable is not set"
  exit 1
fi

if [[ -z "${AWS_ACCESS_KEY_ID:-}" ]]; then
  echo "Error: AWS_ACCESS_KEY_ID environment variable is not set"
  exit 1
fi

if [[ -z "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
  echo "Error: AWS_SECRET_ACCESS_KEY environment variable is not set"
  exit 1
fi

# Start backup process
echo "======================================"
echo "ForkCast Database Backup - ${DATE}"
echo "======================================"
echo "Project: xsovqvbigdettnpeisjs (RMS)"
echo "Target: s3://${BUCKET}/${S3_PATH}"
echo "======================================"

# Export database with pg_dump
echo "[1/3] Exporting database..."
pg_dump "$SUPABASE_DB_URL" \
  --no-owner \
  --no-acl \
  --format=custom \
  --compress=9 \
  --file="$TMP" \
  --verbose

# Check if backup file was created successfully
if [[ ! -f "$TMP" ]]; then
  echo "Error: Backup file was not created"
  exit 1
fi

BACKUP_SIZE=$(du -h "$TMP" | cut -f1)
echo "[2/3] Database exported successfully (Size: ${BACKUP_SIZE})"

# Upload to S3
echo "[3/3] Uploading to S3..."
aws s3 cp "$TMP" "s3://${BUCKET}/${S3_PATH}" \
  --region "$AWS_REGION" \
  --storage-class STANDARD_IA

# Verify upload
if aws s3 ls "s3://${BUCKET}/${S3_PATH}" --region "$AWS_REGION" > /dev/null 2>&1; then
  echo "======================================"
  echo "Backup completed successfully!"
  echo "File: ${BACKUP_FILE}"
  echo "Size: ${BACKUP_SIZE}"
  echo "Location: s3://${BUCKET}/${S3_PATH}"
  echo "======================================"
else
  echo "Error: Failed to verify backup in S3"
  rm -f "$TMP"
  exit 1
fi

# Cleanup
rm -f "$TMP"
echo "Temporary files cleaned up"
echo "Backup process finished at $(date)"
