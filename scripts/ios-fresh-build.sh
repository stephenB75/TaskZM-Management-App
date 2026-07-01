#!/usr/bin/env bash
# Full iOS refresh: build web assets, cap sync, sync Xcode version/bundle ID, pod install.
# Use when Xcode still shows stale UI after npm run sync:platforms.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "🍎 TaskZM — iOS fresh build prep"
echo "================================="

npm run sync-mobile-version
npm run sync:platforms

if [[ -f src/ios/App/Gemfile ]]; then
  echo "📦 pod install..."
  (cd src/ios/App && bundle exec pod install)
fi

echo ""
echo "✅ Ready for Xcode."
echo ""
echo "In Xcode:"
echo "  1. Product → Clean Build Folder (⇧⌘K)"
echo "  2. Delete the TaskZM app from your device/simulator"
echo "  3. Product → Run (⌘R)"
echo ""
echo "Verify bundle ID is com.app.taskzm.com (Signing & Capabilities)."
echo "Settings → About should show the latest APP_VERSION from version.ts."
echo ""
