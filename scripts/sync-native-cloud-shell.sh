#!/usr/bin/env bash
# Sync iOS/Android native shell to load UI from app.taskzm.com (no local Vite build).
# Use when MOBILE_USE_CLOUD_WEB_APP is true — UI updates come from Railway after git push.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "☁️  TaskZM — sync native cloud shell (loads https://app.taskzm.com)"
echo "================================================================"

if [[ -f src/ios/App/Gemfile ]]; then
  echo "🍎 Installing iOS Ruby gems..."
  (cd src/ios/App && bundle install)
fi

echo "📱 Capacitor sync (server.url → production cloud)..."
mkdir -p src/dist
if [[ ! -f src/dist/index.html ]]; then
  echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>TaskZM</title></head><body>Loading…</body></html>' > src/dist/index.html
fi
npm run cap:sync --prefix src

if [[ -f src/ios/App/Gemfile ]]; then
  echo "🍎 pod install..."
  (cd src/ios/App && bundle exec pod install) || true
fi

echo ""
echo "✅ Native shell synced. UI loads from Railway — no local npm run dev required."
echo ""
echo "Next steps (only when native plugins/config change):"
echo "  • iOS:     cd src && npm run cap:ios → Archive → TestFlight"
echo "  • Android: cd src && npm run cap:android → signed AAB"
echo ""
echo "Day-to-day UI/backend updates:"
echo "  • git push origin main          → Railway updates app.taskzm.com"
echo "  • npm run deploy-functions      → Supabase edge functions"
echo "  • Reopen the app on device      → picks up cloud UI automatically"
echo ""
