#!/usr/bin/env node

/**
 * Updates the service worker CACHE_NAME to match package.json version.
 * Run before build (prebuild) so each deploy gets a new cache and users get fresh assets.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const swPath = path.join(rootDir, 'src', 'public', 'service-worker.js');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;
if (!version) {
  console.error('update-service-worker-cache: package.json has no version');
  process.exit(1);
}

const cacheName = `taskzm-v${version}`;
const runtimeCacheName = `taskzm-runtime-v${version}`;
let sw = fs.readFileSync(swPath, 'utf8');

// Match CACHE_NAME = 'taskzm-vX.Y.Z' (any version) and replace with current package version
const cacheNameRegex = /(const CACHE_NAME = ')taskzm-v[^']+(';)/;
if (!cacheNameRegex.test(sw)) {
  console.error('update-service-worker-cache: could not find CACHE_NAME in service-worker.js');
  process.exit(1);
}
sw = sw.replace(cacheNameRegex, `$1${cacheName}$2`);

// Version-scoped runtime cache — stale hashed JS chunks must not survive across deploys
const runtimeCacheRegex = /(const RUNTIME_CACHE = ')taskzm-runtime(?:-v[^']+)?(';)/;
if (!runtimeCacheRegex.test(sw)) {
  console.error('update-service-worker-cache: could not find RUNTIME_CACHE in service-worker.js');
  process.exit(1);
}
sw = sw.replace(runtimeCacheRegex, `$1${runtimeCacheName}$2`);

fs.writeFileSync(swPath, sw);
console.log(`update-service-worker-cache: CACHE_NAME set to ${cacheName}, RUNTIME_CACHE set to ${runtimeCacheName}`);
