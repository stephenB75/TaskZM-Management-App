#!/usr/bin/env bash
# Build web assets and copy them into iOS/Android via Capacitor.
# Use after src/ changes during development (no version bump).
# Web production: push main → Railway. Native: open Xcode / Android Studio after this.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "🔄 TaskZM — sync all platforms"
echo "=============================="

echo "📦 Updating service worker cache from package.json version..."
node scripts/update-service-worker-cache.js

echo "🏗️  Building web (Vite → src/dist)..."
npm run build --prefix src

echo "🏷️  Writing build-info.json for native cache detection..."
node scripts/write-build-info.js

echo "📱 Syncing Capacitor (iOS + Android)..."
npm run cap:sync --prefix src

if [[ -f src/ios/App/Gemfile ]]; then
  echo "🍎 Ensuring iOS CocoaPods are up to date..."
  if (cd src/ios/App && bundle exec pod install); then
    echo "   pod install OK"
  else
    echo "⚠️  pod install failed. If cap sync failed on iOS, run:"
    echo "   cd src/ios/App && bundle install && bundle exec pod install"
  fi
fi

echo ""
echo "✅ All platforms synced from latest src/ build."
echo ""
echo "Next steps:"
echo "  • Web (app.taskzm.com): git push origin main → Railway auto-deploys"
echo "  • iOS:              cd src && npm run cap:ios → Product → Archive"
echo "  • Android:          cd src && npm run cap:android → Generate Signed AAB"
echo ""
