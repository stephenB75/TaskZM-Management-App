# TaskZM iOS (Xcode)

## Open in Xcode

**Important:** Always open the **workspace**, never the `.xcodeproj` alone:

```bash
open App/App.xcworkspace
```

Opening `App.xcodeproj` directly causes:

> Unable to open base configuration reference file ... Pods-App.debug.xcconfig

### One-command setup (recommended)

From `src/`:

```bash
npm run cap:ios:setup
```

This runs `pod install` and opens `App.xcworkspace`.

Or manually:

```bash
cd App
./setup-xcode.sh
```

## First-time setup

1. Build web assets and sync:

```bash
cd .. && npm run mobile:build
```

2. Install CocoaPods dependencies (requires CocoaPods 1.6+):

```bash
cd App
pod install
```

### No Homebrew? Install CocoaPods with Ruby

If `pod` and `brew` are both missing, run from `src/ios/App`:

```bash
cd /Users/stephen/Desktop/TaskZM-Management-App/src/ios/App
chmod +x setup-xcode.sh
./setup-xcode.sh
```

The script installs CocoaPods via `gem` (works with macOS system Ruby) and opens the workspace.

**Manual install** (same steps the script runs):

```bash
export PATH="$HOME/.gem/ruby/$(ruby -e 'print RUBY_VERSION[/\d+\.\d+/]')/0/bin:$PATH"
gem install ffi -v 1.15.5 --user-install
gem install i18n -v 1.14.8 --user-install
gem install cocoapods -v 1.10.2 --user-install
cd /Users/stephen/Desktop/TaskZM-Management-App/src/ios/App
pod install
open App.xcworkspace
```

Add the `export PATH=...` line to `~/.zshrc` so `pod` works in new terminals.

### With Homebrew (optional)

```bash
brew install cocoapods
cd App && pod install && open App.xcworkspace
```

3. In Xcode:
   - Select your **Team** under Signing & Capabilities
   - Confirm **Bundle Identifier**: `com.app.taskzm.com`
   - Enable **In-App Purchase** capability (for RevenueCat / App Store subscriptions)

## Archive & upload

1. **Product → Archive**
2. **Distribute App → App Store Connect**
3. Or export from CLI using `ExportOptions.plist`:

```bash
xcodebuild -exportArchive \
  -archivePath build/TaskZM.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath build/export
```

## Version numbers

Sync with [`src/lib/version.ts`](../../lib/version.ts):

| Xcode setting | Source |
|---------------|--------|
| Marketing Version | `APP_VERSION` (e.g. 1.0.30) |
| Current Project Version | `BUILD_NUMBER` without dashes (e.g. 202606281) |

## Xcode build notes

After changing npm dependencies (especially RevenueCat), refresh pods:

```bash
cd App
pod update RevenuecatPurchasesCapacitor PurchasesHybridCommon RevenueCat
```

**Expected third-party warnings:** Capacitor 6 Cordova still references deprecated `WKProcessPool` APIs. `pod install` applies a local pragma patch to those files and sets `-Wno-deprecated-declarations` on Pod targets. Re-run `pod install` after `npm install` if the warning reappears. A full fix requires upgrading to Capacitor 8+.

**RevenueCat / StoreKit:** Use `@revenuecat/purchases-capacitor` **13.2+** (pulls RevenueCat **5.78+**) for Xcode 26 compatibility. Older 5.67.x triggers “Switch must be exhaustive” errors with newer StoreKit SDKs.

**`[CP] Embed Pods Frameworks`:** The Podfile sets CocoaPods script phases to use dependency analysis so this phase is not forced to run on every build.

**“Update to recommended settings” on Pods.xcodeproj:** Safe to ignore, or apply in Xcode — it only affects the generated Pods project, not your app code.

