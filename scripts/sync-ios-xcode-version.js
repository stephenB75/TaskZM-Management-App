#!/usr/bin/env node
/**
 * Sync APP_VERSION and BUILD_NUMBER from src/lib/version.ts into the Xcode project.
 * Usage: node scripts/sync-ios-xcode-version.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VERSION_TS = path.join(ROOT, 'src/lib/version.ts');
const MOBILE_CONSTANTS = path.join(ROOT, 'src/lib/mobile-constants.ts');
const PBXPROJ = path.join(ROOT, 'src/ios/App/App.xcodeproj/project.pbxproj');

const versionSource = fs.readFileSync(VERSION_TS, 'utf8');
const mobileSource = fs.readFileSync(MOBILE_CONSTANTS, 'utf8');
const appIdMatch = mobileSource.match(/export const MOBILE_APP_ID = '([^']+)'/);
const appVersionMatch = versionSource.match(/export const APP_VERSION = '([^']+)'/);
const buildNumberMatch = versionSource.match(/export const BUILD_NUMBER = '([^']+)'/);

if (!appVersionMatch || !buildNumberMatch) {
  console.error('Could not read APP_VERSION or BUILD_NUMBER from version.ts');
  process.exit(1);
}

const appVersion = appVersionMatch[1];
const iosBuildNumber = buildNumberMatch[1].replace(/-/g, '');

let pbx = fs.readFileSync(PBXPROJ, 'utf8');
pbx = pbx.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${appVersion};`);
pbx = pbx.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${iosBuildNumber};`);
if (appIdMatch?.[1]) {
  pbx = pbx.replace(
    /PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g,
    `PRODUCT_BUNDLE_IDENTIFIER = ${appIdMatch[1]};`
  );
}
fs.writeFileSync(PBXPROJ, pbx);

const bundleId = appIdMatch?.[1] ?? '(unchanged)';
console.log(
  `Updated Xcode project: MARKETING_VERSION=${appVersion}, CURRENT_PROJECT_VERSION=${iosBuildNumber}, PRODUCT_BUNDLE_IDENTIFIER=${bundleId}`
);
