# Platform sync — Web, iOS, and Android

## Cloud-first (recommended — no local app server)

TaskZM is designed to run from the cloud on your devices. You do **not** need `npm run dev` or a local build for day-to-day use.

| Where you use it | What loads the UI | How updates reach you |
|------------------|-------------------|------------------------|
| **Phone / tablet browser** | [app.taskzm.com](https://app.taskzm.com) | Automatic after `git push origin main` (Railway) |
| **Installed iOS / Android app** | Same — native shell opens **app.taskzm.com** in a WebView | Same — reopen the app after Railway deploys |
| **Backend (calendar, auth, AI)** | Supabase Edge Functions | `npm run deploy-functions` |

Native apps use **cloud WebView mode** (`MOBILE_USE_CLOUD_WEB_APP` in [`mobile-constants.ts`](../src/lib/mobile-constants.ts)): Capacitor sets `server.url` to `https://app.taskzm.com`, so UI fixes ship with Railway only. Rebuild the native shell (TestFlight / Play) only when you change Capacitor plugins, entitlements, or bundle ID.

**Your workflow:**

```bash
# 1. Ship web + in-app UI (cloud)
git push origin main                    # Railway → app.taskzm.com (~5–7 min)

# 2. Ship server/calendar fixes
npm run deploy-functions

# 3. On device — close and reopen the app (or refresh in browser)
```

**One-time native shell setup** (after changing `capacitor.config.ts` or adding a native plugin):

```bash
npm run sync:cloud-shell              # cap sync with server.url → production
cd src && npm run cap:ios             # Archive → TestFlight (or Android Studio)
```

To force bundled offline UI (rare): `CAPACITOR_USE_BUNDLED_WEB=1 npm run sync:platforms`

---

## Bundled mode (legacy — local dist copy)

TaskZM can still bundle `dist/` into the native app (previous default). Only use this if you need fully offline UI.


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

## iOS not showing latest UI?

Native apps load the **bundled** `dist/` copy, not app.taskzm.com. After `src/` changes you must sync and rebuild in Xcode.

### Checklist

1. **Sync web assets into the iOS project**
   ```bash
   npm run sync:platforms
   ```
   Or for a store build:
   ```bash
   npm run mobile:build
   ```

2. **Rebuild in Xcode** (WKWebView caches aggressively)
   - Product → **Clean Build Folder** (⇧⌘K)
   - Delete the TaskZM app from the device/simulator
   - Product → **Run** (⌘R)

3. **One-command prep** (sync + pods + reminders):
   ```bash
   bash scripts/ios-fresh-build.sh
   ```

4. **Confirm you are running the right app**
   - Bundle ID must be **`com.app.taskzm.com`** (see [`mobile-constants.ts`](../src/lib/mobile-constants.ts))
   - `npm run sync-mobile-version` keeps Xcode aligned with [`mobile-constants.ts`](../src/lib/mobile-constants.ts)

5. **Verify the build loaded**
   - Settings → About shows the current `APP_VERSION` from [`version.ts`](../src/lib/version.ts)
   - After sync, `src/dist/build-info.json` is copied into the iOS bundle; the app clears WKWebView cache when that build stamp changes

### Why web updates but iOS does not

| Web | iOS |
|-----|-----|
| Railway rebuilds on push to `main` | Requires local `cap sync` + Xcode run/archive |
| Service worker purges stale JS on version bump | No service worker on native; uses `build-info.json` + AppDelegate WK cache purge |
| Always serves latest deploy | `ios/App/App/public/` is gitignored — only updated by `cap sync` on your machine |

TestFlight/App Store builds only update after you archive and upload a new build.
