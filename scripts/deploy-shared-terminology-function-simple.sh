#!/bin/bash

# Simple deployment script - displays SQL for manual copy-paste
# This is the most reliable method since Supabase CLI doesn't support direct SQL execution

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_REF="gflesnyfpxqhaunfskrw"
SQL_FILE="$SCRIPT_DIR/fix-shared-terminology-function.sql"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Deploy Shared Terminology Function"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Steps to Deploy:"
echo ""
echo "1. Open Supabase SQL Editor:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
echo ""
echo "2. Copy the SQL below (between the lines)"
echo ""
echo "3. Paste into the SQL Editor"
echo ""
echo "4. Click 'Run' or press Cmd+Enter (Mac) / Ctrl+Enter (Windows/Linux)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f "$SQL_FILE" ]; then
  cat "$SQL_FILE"
else
  echo "❌ Error: SQL file not found: $SQL_FILE"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ After running, the function will be deployed!"
echo ""
echo "🔍 To verify, run this SQL in the SQL Editor:"
echo "   cat $SCRIPT_DIR/verify-shared-terminology-function.sql"
echo ""
