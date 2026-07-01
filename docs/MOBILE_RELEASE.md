# TaskZM Mobile Release Guide

This guide covers building and submitting TaskZM for the **App Store** (iOS) and **Google Play** (Android) using Capacitor.

## Prerequisites

- **Apple Developer Program** (iOS)
- **Google Play Console** account (Android, $25 one-time)
- **RevenueCat** iOS/Android apps configured with App Store / Play Store subscription products
- **Xcode** (macOS) for iOS builds
- **Android Studio** for Android builds
- Node.js 20+

## Bundle ID

- **App ID:** `com.taskzm.app` (defined in [`src/lib/mobile-constants.ts`](../src/lib/mobile-constants.ts))

## Environment variables

Copy [`.env.example`](../.env.example) to `.env` in the project root and set:

| Variable | Platform | Description |
|----------|----------|-------------|
| `VITE_REVENUECAT_IOS_API_KEY` | iOS | RevenueCat public API key for iOS app |
| `VITE_REVENUECAT_ANDROID_API_KEY` | Android | RevenueCat public API key for Android app |
| `VITE_REVENUECAT_WEB_PUBLIC_KEY` | Web | Existing Stripe/web billing key |

### Supabase Auth redirect URLs

Add to **Supabase Dashboard → Authentication → URL Configuration**:

- `com.taskzm.app://reset-password`
- `com.taskzm.app://auth-callback`

### Edge Function secret (optional)

- `MOBILE_DEEP_LINK_SCHEME=com.taskzm.app` — used by calendar OAuth callback redirects on native

## Build commands

See **[Platform sync (web + iOS + Android)](./PLATFORM_SYNC.md)** for the full workflow.

From repo root (recommended):

```bash
npm run sync:platforms   # after src/ changes — build + cap sync
npm run mobile:build     # store release — version sync + build + cap sync
```

From the `src/` directory:

```bash
npm install
npm run mobile:build    # vite build + cap sync
npm run cap:ios         # Open Xcode
npm run cap:android     # Open Android Studio
```

Generate icons and splash screens (requires source assets in `src/assets/`):

```bash
npm run mobile:assets
npm run cap:sync
```

## Version sync checklist

When releasing a new version, update **all** of:

1. [`src/lib/version.ts`](../src/lib/version.ts) — `APP_VERSION`, `BUILD_NUMBER`
2. [`src/package.json`](../src/package.json) — `version`
3. Root [`package.json`](../package.json) — `version`
4. iOS / Android native versions — run from repo root: `npm run sync-mobile-version` (reads `src/lib/version.ts`)
5. Service worker cache — updated automatically by `npm run mobile:build`

Then from repo root:

```bash
npm run mobile:build
```

First-time iOS CocoaPods (if `cap sync` fails on pod install):

```bash
cd src/ios/App && bundle install && bundle exec pod install
```

## iOS — TestFlight & App Store

1. `cd src && npm run mobile:build`
2. `npm run cap:ios`
3. In Xcode:
   - Select your **Team** and enable **Automatic Signing**
   - Set **Bundle Identifier** to `com.taskzm.app`
   - Enable **In-App Purchase** capability
4. **Product → Archive → Distribute App → App Store Connect**
5. In **App Store Connect**:
   - Create app record, privacy policy URL, support URL
   - Configure subscription products (linked in RevenueCat)
   - Complete App Privacy questionnaire
   - Submit for review via TestFlight first

### Store listing URLs

When live, set URLs in [`src/lib/mobile-constants.ts`](../src/lib/mobile-constants.ts):

- `APP_STORE_URL` — e.g. `https://apps.apple.com/app/idXXXXXXXXX`
- `PLAY_STORE_URL` — e.g. `https://play.google.com/store/apps/details?id=com.taskzm.app`

## Android — Play Console

1. Generate upload keystore (one-time):

```bash
keytool -genkey -v -keystore taskzm-upload.keystore -alias taskzm -keyalg RSA -keysize 2048 -validity 10000
```

2. Configure signing in `android/app/build.gradle` (do not commit keystore passwords)
3. `cd src && npm run mobile:build`
4. Android Studio → **Build → Generate Signed Bundle / APK** → AAB
5. Upload to Play Console **Internal testing** track

## RevenueCat setup (native)

1. Add **iOS app** in RevenueCat with bundle ID `com.taskzm.app`
2. Create **auto-renewable subscriptions** in App Store Connect (monthly + yearly)
3. Link products in RevenueCat → map to **`pro`** entitlement
4. Add App Store Connect API key or shared secret in RevenueCat
5. Repeat for Google Play when ready

## Testing native features

| Feature | How to verify |
|---------|----------------|
| IAP | Sandbox Apple ID / Google test account |
| Calendar OAuth | Connect Google/Outlook on device; browser should return via deep link |
| Notifications | Enable in Settings; grant permission on first prompt |
| Password reset | Forgot password → email link opens app via deep link |

## Troubleshooting

- **Capacitor sync fails:** Run `npm run build` first; ensure `dist/` exists
- **IAP products empty:** Verify RevenueCat offerings and App Store Connect product status (Ready to Submit)
- **Calendar OAuth stuck:** Confirm `MOBILE_DEEP_LINK_SCHEME` matches iOS URL scheme / Android intent filter
- **Service worker on native:** Disabled automatically when `Capacitor.isNativePlatform()` is true
