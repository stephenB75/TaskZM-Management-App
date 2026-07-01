#!/usr/bin/env node
/**
 * Sync APP_VERSION and BUILD_NUMBER from src/lib/version.ts into Android build.gradle.
 * Usage: node scripts/sync-android-version.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VERSION_TS = path.join(ROOT, 'src/lib/version.ts');
const GRADLE = path.join(ROOT, 'src/android/app/build.gradle');

const versionSource = fs.readFileSync(VERSION_TS, 'utf8');
const appVersionMatch = versionSource.match(/export const APP_VERSION = '([^']+)'/);
const buildNumberMatch = versionSource.match(/export const BUILD_NUMBER = '([^']+)'/);

if (!appVersionMatch || !buildNumberMatch) {
  console.error('Could not read APP_VERSION or BUILD_NUMBER from version.ts');
  process.exit(1);
}

const appVersion = appVersionMatch[1];
const versionCode = buildNumberMatch[1].replace(/-/g, '');

let gradle = fs.readFileSync(GRADLE, 'utf8');
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${appVersion}"`);
fs.writeFileSync(GRADLE, gradle);

console.log(`Updated Android build.gradle: versionName=${appVersion}, versionCode=${versionCode}`);
