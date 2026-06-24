#!/bin/bash

# Deploy Supabase Edge Functions
# Functions are located in supabase/functions/taskzm-database-function/

set -e  # Exit on error

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_REF="gflesnyfpxqhaunfskrw"

echo "🚀 Deploying Supabase Edge Functions..."
cd "$PROJECT_ROOT"
npx supabase functions deploy taskzm-database-function --project-ref "$PROJECT_REF"

echo "✅ Deployment complete!"
echo ""
echo "📊 You can view your deployment at:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/functions"
