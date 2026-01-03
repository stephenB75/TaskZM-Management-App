#!/bin/bash

# Sync Localhost and Production Codebases
# This script ensures production matches localhost

set -e  # Exit on error

echo "🔄 Syncing Localhost and Production"
echo "==================================="
echo ""

# Disable pager for git commands
export GIT_PAGER=cat

# Get current commit
CURRENT_COMMIT=$(git rev-parse HEAD)
CURRENT_COMMIT_SHORT=$(git rev-parse --short HEAD)

echo "📍 Current Local Commit: $CURRENT_COMMIT_SHORT"
echo ""

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Warning: You have uncommitted changes"
    echo "   Staging all changes..."
    git add -A
    
    if ! git diff --cached --quiet; then
        echo "   Committing changes..."
        git commit -m "Sync: Update to match localhost state"
    fi
fi

# Check remote status
echo "🔍 Checking remote status..."
git fetch origin main

REMOTE_COMMIT=$(git rev-parse origin/main)
REMOTE_COMMIT_SHORT=$(git rev-parse --short origin/main)

echo "📍 Remote (origin/main) Commit: $REMOTE_COMMIT_SHORT"
echo ""

if [ "$CURRENT_COMMIT" = "$REMOTE_COMMIT" ]; then
    echo "✅ Local and remote are already in sync"
    echo ""
    echo "🚀 Pushing to trigger Railway deployment..."
    git push origin main
    echo ""
    echo "✅ Push completed!"
    echo ""
    echo "📊 Railway will automatically deploy the latest code"
    echo "   Monitor: https://railway.app/dashboard"
    echo ""
    echo "⏱️  Estimated deployment time: 5-7 minutes"
else
    echo "⚠️  Local and remote differ"
    echo "   Local:  $CURRENT_COMMIT_SHORT"
    echo "   Remote: $REMOTE_COMMIT_SHORT"
    echo ""
    echo "🚀 Pushing local changes to remote..."
    git push origin main
    echo ""
    echo "✅ Push completed!"
    echo ""
    echo "📊 Railway will automatically deploy the latest code"
fi

echo ""
echo "✅ Sync process completed!"
echo ""
echo "Next steps:"
echo "  1. Wait for Railway deployment (5-7 minutes)"
echo "  2. Verify production version matches localhost"
echo "  3. Test key features in production"
echo ""

