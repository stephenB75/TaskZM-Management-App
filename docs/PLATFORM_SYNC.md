# Platform sync — Web, iOS, and Android

TaskZM ships one React codebase (`src/`) to three targets:

| Platform | How users get updates | After you change `src/` |
|----------|----------------------|-------------------------|
| **Web** | [app.taskzm.com](https://app.taskzm.com) via Railway | Push to `main` (Railway builds automatically) |
| **iOS** | App Store / TestFlight | Run sync → Archive in Xcode |
| **Android** | Google Play | Run sync → Signed AAB in Android Studio |

Capacitor copies the **same** Vite `dist/` bundle into `ios/` and `android/`. If you skip sync, native apps run stale UI.

## Daily workflow (code changes, no store release)

After editing UI or app logic under `src/`:

```bash
npm run sync:platforms
```

This runs:

1. Service worker cache bump (from `package.json` version)
2. `vite build` → `src/dist/`
3. `cap sync` → iOS + Android web assets and plugins

Then:

- **Web:** commit and `git push origin main`
- **Native:** open Xcode / Android Studio only when you want to run or ship a device build

## Store / TestFlight release (version bump)

When submitting a new iOS or Android build:

1. Update [`src/lib/version.ts`](../src/lib/version.ts):
   - `APP_VERSION` (semver)
   - `BUILD_NUMBER` (e.g. `YYYYMMDD-N`)
   - `VERSION_NAME`, `VERSION_DATE`, `VERSION_HISTORY` entry
2. Match version in root and `src/package.json`
3. Run:

```bash
npm run mobile:build
```

This syncs version into Xcode + `build.gradle`, builds, and runs `cap sync`.

**Quick build-number only** (same `APP_VERSION`, new TestFlight upload):

```bash
npm run bump:build
npm run mobile:build
```

## Commands reference

| Command | Purpose |
|---------|---------|
| `npm run sync:platforms` | Build web + cap sync (most common after changes) |
| `npm run mobile:build` | Version sync + build + cap sync (store releases) |
| `npm run bump:build` | Increment `BUILD_NUMBER` + sync native version fields |
| `npm run sync-mobile-version` | Copy `version.ts` → iOS/Android only |
| `cd src && npm run cap:ios` | Open Xcode |
| `cd src && npm run cap:android` | Open Android Studio |

## What does *not* auto-update

- **Supabase Edge Functions** — `npm run deploy-functions`
- **App Store / Play listing** — manual in App Store Connect / Play Console
- **Native-only config** — `Info.plist`, entitlements, signing, Gradle signing

## iOS CocoaPods (first time or after plugin changes)

```bash
cd src/ios/App && bundle install && bundle exec pod install
```

See also [MOBILE_RELEASE.md](./MOBILE_RELEASE.md).
