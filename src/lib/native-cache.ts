/**
 * Native (Capacitor) cache invalidation when a new web bundle is synced into iOS/Android.
 * Web uses service-worker purgeAppCachesIfVersionChanged; native uses build-info.json stamp.
 */

import { Capacitor } from '@capacitor/core';
import { getAppReleaseStamp, APP_VERSION, BUILD_NUMBER } from './version';
import { MOBILE_STORAGE_KEYS } from './mobile-constants';
import { purgeAppCachesIfVersionChanged } from './service-worker-update';
import { logger } from './logger';

interface BuildInfo {
  version?: string;
  buildNumber?: string;
}

function buildStamp(version: string, buildNumber: string): string {
  return `${version}:${buildNumber}`;
}

async function fetchBundledBuildInfo(): Promise<BuildInfo | null> {
  try {
    const response = await fetch('/build-info.json', { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as BuildInfo;
  } catch {
    return null;
  }
}

/**
 * Returns true when caches were cleared and the page should reload once.
 */
export async function ensureNativeBuildIsCurrent(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  const versionPurged = await purgeAppCachesIfVersionChanged(getAppReleaseStamp());

  const bundled = await fetchBundledBuildInfo();
  const bundledBuild = bundled?.buildNumber?.trim();
  const bundledVersion = bundled?.version?.trim() ?? APP_VERSION;
  const stamp = bundledBuild
    ? buildStamp(bundledVersion, bundledBuild)
    : buildStamp(APP_VERSION, BUILD_NUMBER);

  const storageKey = MOBILE_STORAGE_KEYS.nativeBuildStamp;
  const storedStamp = localStorage.getItem(storageKey);

  if (storedStamp === stamp) {
    return versionPurged;
  }

  localStorage.setItem(storageKey, stamp);

  if (storedStamp == null) {
    return versionPurged;
  }

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  logger.info(`[Native] Build stamp changed (${storedStamp} → ${stamp}) — reloading for fresh bundle`);
  return true;
}
