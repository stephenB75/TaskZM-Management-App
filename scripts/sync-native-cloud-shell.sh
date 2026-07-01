#!/usr/bin/env bash
# Sync iOS/Android native shell to load UI from app.taskzm.com (no local Vite build).
# Use when MOBILE_USE_CLOUD_WEB_APP is true — UI updates come from Railway after git push.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Cap sync must write into ios/ and android/ — fails with EACCES if those dirs were created by sudo npm
check_native_project_permissions() {
  local blocked=()
  local paths=(
    src/android/app/src/main/assets/public
    src/android/capacitor-cordova-android-plugins
    src/ios/App/App/public
    src/ios/capacitor-cordova-ios-plugins
  )
  for rel in "${paths[@]}"; do
    if [[ -e "$rel" ]] && [[ ! -w "$rel" ]]; then
      blocked+=("$rel")
    fi
  done
  if [[ ${#blocked[@]} -eq 0 ]]; then
    return 0
  fi
  echo "❌ Permission denied — cap sync cannot write to native project folders:"
  for rel in "${blocked[@]}"; do
    echo "   • $rel"
  done
  echo ""
  echo "This usually happens after running npm with sudo (e.g. sudo npm run sync:platforms)."
  echo "Never use sudo for npm in this project."
  echo ""
  echo "Fix ownership once, then re-run npm run sync:cloud-shell:"
  echo "  sudo chown -R \$(whoami) src/android src/ios src/dist"
  exit 1
}

echo "☁️  TaskZM — sync native cloud shell (loads https://app.taskzm.com)"
echo "================================================================"

install_ios_ruby_gems() {
  if [[ ! -f src/ios/App/Gemfile ]]; then
    return 0
  fi
  echo "🍎 Installing iOS Ruby gems (local vendor/bundle — no sudo)..."
  (
    cd src/ios/App
    bundle config set --local path vendor/bundle
    bundle config set --local bin vendor/bundle/bin
    bundle install --jobs 4 --retry 3
  )
}

run_ios_pod_install() {
  if [[ ! -f src/ios/App/Podfile ]]; then
    return 0
  fi
  echo "🍎 pod install..."
  (
    cd src/ios/App
    bundle exec pod install
  )
}

run_cap_sync() {
  echo "📱 Capacitor sync (server.url → production cloud)..."
  mkdir -p src/dist
  if [[ ! -f src/dist/index.html ]]; then
    echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>TaskZM</title></head><body>Loading…</body></html>' > src/dist/index.html
  fi

  # cap sync ios runs `bundle exec pod install` from src/ios/App — vendor/bundle must exist first
  if npm run cap:sync --prefix src; then
    return 0
  fi

  echo ""
  echo "⚠️  cap sync reported errors — finishing iOS copy + pod install..."
  (cd src && npx cap copy ios)
  run_ios_pod_install
}

check_native_project_permissions

install_ios_ruby_gems
run_cap_sync
run_ios_pod_install

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
