#!/usr/bin/env node
/**
 * Increment BUILD_NUMBER suffix in src/lib/version.ts (e.g. 20260701-2 → 20260701-3),
 * sync iOS/Android native version fields, and update both package.json versions if needed.
 * Use before a new TestFlight / Play internal build without changing APP_VERSION.
 *
 * Usage: node scripts/bump-build-number.js
 *        node scripts/bump-build-number.js --date  # reset date to today YYYYMMDD-1
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const VERSION_TS = path.join(ROOT, 'src/lib/version.ts');
const ROOT_PKG = path.join(ROOT, 'package.json');
const SRC_PKG = path.join(ROOT, 'src/package.json');

const useToday = process.argv.includes('--date');

let source = fs.readFileSync(VERSION_TS, 'utf8');
const appVersionMatch = source.match(/export const APP_VERSION = '([^']+)'/);
const buildMatch = source.match(/export const BUILD_NUMBER = '([^']+)'/);

if (!appVersionMatch || !buildMatch) {
  console.error('Could not read APP_VERSION or BUILD_NUMBER from version.ts');
  process.exit(1);
}

const appVersion = appVersionMatch[1];
const current = buildMatch[1];
const today = new Date();
const ymd =
  String(today.getFullYear()) +
  String(today.getMonth() + 1).padStart(2, '0') +
  String(today.getDate()).padStart(2, '0');

let nextBuild;
if (useToday) {
  nextBuild = `${ymd}-1`;
} else {
  const m = current.match(/^(\d{8})-(\d+)$/);
  if (m && m[1] === ymd) {
    nextBuild = `${ymd}-${Number(m[2], 10) + 1}`;
  } else if (m) {
    nextBuild = `${ymd}-1`;
  } else {
    nextBuild = `${ymd}-1`;
  }
}

source = source.replace(/export const BUILD_NUMBER = '[^']+'/, `export const BUILD_NUMBER = '${nextBuild}'`);
fs.writeFileSync(VERSION_TS, source);

for (const pkgPath of [ROOT_PKG, SRC_PKG]) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.version !== appVersion) {
    pkg.version = appVersion;
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  }
}

execSync('node scripts/sync-ios-xcode-version.js', { cwd: ROOT, stdio: 'inherit' });
execSync('node scripts/sync-android-version.js', { cwd: ROOT, stdio: 'inherit' });
execSync('node scripts/update-service-worker-cache.js', { cwd: ROOT, stdio: 'inherit' });

console.log(`BUILD_NUMBER: ${current} → ${nextBuild} (APP_VERSION ${appVersion})`);
console.log('Run npm run mobile:build to produce native bundles, or npm run sync:platforms for dist-only sync.');
