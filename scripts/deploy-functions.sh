#!/bin/bash

# Deploy Supabase Edge Functions
# This script syncs the source files from src/supabase/functions/server/ 
# to the deployment directory and deploys them

set -e  # Exit on error

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SOURCE_DIR="$PROJECT_ROOT/src/supabase/functions/server"
DEPLOY_DIR="$PROJECT_ROOT/supabase/functions/make-server-65e6e67f"
PROJECT_REF="gflesnyfpxqhaunfskrw"

echo "🔄 Syncing function files..."

# Create deployment directory if it doesn't exist
mkdir -p "$DEPLOY_DIR"

# Copy all files from source to deployment directory
echo "  📦 Copying files from source to deployment directory..."
cp "$SOURCE_DIR/index.tsx" "$DEPLOY_DIR/index.ts"
cp "$SOURCE_DIR/calendar-sync.tsx" "$DEPLOY_DIR/calendar-sync.tsx"
cp "$SOURCE_DIR/caldav-client.tsx" "$DEPLOY_DIR/caldav-client.tsx"
cp "$SOURCE_DIR/email-service.tsx" "$DEPLOY_DIR/email-service.tsx"
cp "$SOURCE_DIR/cleanup-utils.tsx" "$DEPLOY_DIR/cleanup-utils.tsx"
cp "$SOURCE_DIR/kv_store.tsx" "$DEPLOY_DIR/kv_store.tsx"
cp "$SOURCE_DIR/apple-caldav-sync.tsx" "$DEPLOY_DIR/apple-caldav-sync.tsx"

echo "✅ Files synced successfully!"

# Deploy to Supabase
echo "🚀 Deploying to Supabase..."
cd "$PROJECT_ROOT"
supabase functions deploy make-server-65e6e67f --project-ref "$PROJECT_REF"

echo "✅ Deployment complete!"
echo ""
echo "📊 You can view your deployment at:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/functions"

