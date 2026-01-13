#!/bin/bash

# Automated deployment script for shared terminology database function
# This script deploys the upsert_shared_terminology function to Supabase

set -e  # Exit on error

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_REF="gflesnyfpxqhaunfskrw"

echo "🚀 Deploying shared terminology function to Supabase..."
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "⚠️  Supabase CLI not found. Installing instructions:"
  echo "   https://supabase.com/docs/guides/cli/getting-started"
  echo ""
  echo "📋 Alternative: Run the SQL manually in Supabase SQL Editor"
  echo "   1. Go to: https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
  echo "   2. Copy contents of: $SCRIPT_DIR/fix-shared-terminology-function.sql"
  echo "   3. Paste and run in SQL Editor"
  exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
  echo "⚠️  Not logged in to Supabase CLI"
  echo "   Run: supabase login"
  exit 1
fi

cd "$PROJECT_ROOT"

# Deploy using available method
echo "📄 Reading SQL file..."
SQL_FILE="$SCRIPT_DIR/fix-shared-terminology-function.sql"
VERIFY_FILE="$SCRIPT_DIR/verify-shared-terminology-function.sql"

if [ ! -f "$SQL_FILE" ]; then
  echo "❌ Error: SQL file not found: $SQL_FILE"
  exit 1
fi

echo "🔧 Executing SQL via Supabase..."
echo ""

# Method 1: Try using psql if connection string is available
if [ -n "$DATABASE_URL" ] || [ -n "$SUPABASE_DB_URL" ]; then
  DB_URL="${DATABASE_URL:-$SUPABASE_DB_URL}"
  echo "📡 Using database connection string..."
  psql "$DB_URL" -f "$SQL_FILE"
  
  echo ""
  echo "✅ Function deployed successfully!"
  
  # Verify
  if [ -f "$VERIFY_FILE" ]; then
    echo ""
    echo "🔍 Verifying function..."
    psql "$DB_URL" -f "$VERIFY_FILE"
  fi
else
  # Method 2: Use Supabase Management API (requires access token)
  if [ -n "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "📡 Using Supabase Management API..."
    echo "⚠️  This method requires the SQL to be executed via API"
    echo "   Falling back to manual instructions..."
  fi
  
  # Method 3: Manual instructions
  echo ""
  echo "📋 Manual Deployment Required"
  echo ""
  echo "The Supabase CLI doesn't support direct SQL execution on remote projects."
  echo "Please run the SQL manually:"
  echo ""
  echo "1. Go to: https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
  echo "2. Copy the contents of: $SQL_FILE"
  echo "3. Paste into the SQL Editor"
  echo "4. Click 'Run' or press Cmd+Enter (Mac) / Ctrl+Enter (Windows/Linux)"
  echo ""
  echo "SQL File location:"
  echo "   $SQL_FILE"
  echo ""
  echo "To verify after deployment, run:"
  echo "   $VERIFY_FILE"
  echo ""
  echo "Or set DATABASE_URL environment variable to use psql:"
  echo "   export DATABASE_URL='postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres'"
  echo "   ./scripts/deploy-shared-terminology-function.sh"
  exit 0
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "The upsert_shared_terminology function is now available."
echo "Terminology saving should work without PGRST202 errors."
echo ""
echo "📊 View in dashboard:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/database/functions"
