#!/usr/bin/env bash
# Install CocoaPods (no Homebrew required) and open the Xcode workspace.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

XCCONFIG="Pods/Target Support Files/Pods-App/Pods-App.debug.xcconfig"
RUBY_MINOR="$(ruby -e 'print RUBY_VERSION[/\d+\.\d+/]')"
GEM_BIN="$HOME/.gem/ruby/${RUBY_MINOR}/0/bin"
export PATH="$GEM_BIN:$PATH"

ensure_cocoapods() {
  if command -v pod >/dev/null 2>&1; then
    echo "Using pod: $(command -v pod) ($(pod --version))"
    return 0
  fi

  echo "CocoaPods not found — installing via Ruby gem (no Homebrew needed)..."

  gem install ffi -v 1.15.5 --user-install --no-document
  gem install i18n -v 1.14.8 --user-install --no-document
  gem install cocoapods -v 1.10.2 --user-install --no-document

  export PATH="$GEM_BIN:$PATH"

  if ! command -v pod >/dev/null 2>&1; then
    echo ""
    echo "Could not find pod after gem install."
    echo "Add this to your shell profile (~/.zshrc), then open a new terminal:"
    echo "  export PATH=\"\$HOME/.gem/ruby/${RUBY_MINOR}/0/bin:\$PATH\""
    exit 1
  fi

  echo "Installed pod: $(command -v pod) ($(pod --version))"
}

install_pods() {
  if [[ -f Gemfile ]]; then
    echo "Installing Ruby gems from Gemfile..."
    bundle install
    echo "Running pod install via Bundler..."
    bundle exec pod install
    return
  fi

  ensure_cocoapods
  pod install
}

if [[ ! -f "$XCCONFIG" ]]; then
  echo "Pods not installed — running pod install..."
else
  echo "Re-syncing CocoaPods..."
fi

install_pods

if [[ ! -f "$XCCONFIG" ]]; then
  echo "Error: $XCCONFIG still missing after pod install."
  exit 1
fi

echo ""
echo "Success. Opening App.xcworkspace (NOT App.xcodeproj)..."
open "$SCRIPT_DIR/App.xcworkspace"
