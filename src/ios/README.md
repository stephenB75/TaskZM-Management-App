# TaskZM iOS (Xcode)

## Open in Xcode

Always open the **workspace** (includes CocoaPods), not the project alone:

```bash
open App/App.xcworkspace
```

Or from `src/`:

```bash
npm run cap:ios
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

If `pod` is not found, install CocoaPods:

```bash
brew install cocoapods
```

3. In Xcode:
   - Select your **Team** under Signing & Capabilities
   - Confirm **Bundle Identifier**: `com.taskzm.app`
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
