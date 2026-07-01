#!/usr/bin/env node
/**
 * Write build-info.json into src/dist after Vite build.
 * Native apps use this stamp to detect stale WKWebView cache after cap sync.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VERSION_TS = path.join(ROOT, 'src/lib/version.ts');
const DIST_DIR = path.join(ROOT, 'src/dist');
const OUT_FILE = path.join(DIST_DIR, 'build-info.json');

const versionSource = fs.readFileSync(VERSION_TS, 'utf8');
const appVersion = versionSource.match(/export const APP_VERSION = '([^']+)'/)?.[1];
const buildNumber = versionSource.match(/export const BUILD_NUMBER = '([^']+)'/)?.[1];
const versionName = versionSource.match(/export const VERSION_NAME = '([^']+)'/)?.[1];

if (!appVersion || !buildNumber) {
  console.error('Could not read APP_VERSION or BUILD_NUMBER from version.ts');
  process.exit(1);
}

if (!fs.existsSync(DIST_DIR)) {
  console.error('dist/ not found — run vite build first');
  process.exit(1);
}

const payload = {
  version: appVersion,
  buildNumber,
  versionName: versionName ?? '',
  builtAt: new Date().toISOString(),
};

fs.writeFileSync(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${path.relative(ROOT, OUT_FILE)} (${appVersion} / ${buildNumber})`);
