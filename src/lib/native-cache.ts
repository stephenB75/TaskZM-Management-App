/**
 * Native (Capacitor) cache invalidation.
 * - Cloud WebView (server.url → app.taskzm.com): release stamp from Railway build-info.json
 * - Bundled shell: stamp from copied dist/build-info.json after cap sync
 */

import { Capacitor } from '@capacitor/core';
import { getAppReleaseStamp } from './version';
import { MOBILE_STORAGE_KEYS, MOBILE_USE_CLOUD_WEB_APP } from './mobile-constants';
import {
  fetchDeployedBuildInfo,
  getReleaseStampFromBuildInfo,
} from './app-release-cache';
import { logger } from './logger';

async function resolveNativeReleaseStamp(): Promise<string> {
  if (MOBILE_USE_CLOUD_WEB_APP) {
    const cloud = await fetchDeployedBuildInfo();
    if (cloud?.buildNumber) {
      return getReleaseStampFromBuildInfo(cloud);
    }
  }
  try {
    const response = await fetch('/build-info.json', { cache: 'no-store' });
    if (response.ok) {
      const bundled = await response.json();
      return getReleaseStampFromBuildInfo(bundled);
    }
  } catch {
    // fall through
  }
  return getAppReleaseStamp();
}

/**
 * Returns true when the WebView should reload once to pick up a new release.
 * Cloud mode preserves localStorage (calendar status, notification settings, auth).
 */
export async function ensureNativeBuildIsCurrent(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  const stamp = await resolveNativeReleaseStamp();
  const storageKey = MOBILE_STORAGE_KEYS.nativeBuildStamp;
  const storedStamp = localStorage.getItem(storageKey);

  if (storedStamp === stamp) {
    return false;
  }

  localStorage.setItem(storageKey, stamp);

  if (storedStamp == null) {
    return false;
  }

  // Cloud UI lives on app.taskzm.com — reload only; do not wipe Cache Storage here
  // (AppDelegate must not clear WKWebsiteDataStore in cloud mode either).
  if (!MOBILE_USE_CLOUD_WEB_APP && 'caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  logger.info(
    `[Native${MOBILE_USE_CLOUD_WEB_APP ? ' cloud' : ''}] Release changed (${storedStamp} → ${stamp}) — reloading`,
  );
  return true;
}

/** Compare Railway/build-info stamp without reloading (for foreground resume). */
export async function nativeCloudReleaseChangedSince(storedStamp: string | null): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !MOBILE_USE_CLOUD_WEB_APP) {
    return false;
  }
  const stamp = await resolveNativeReleaseStamp();
  return storedStamp != null && storedStamp !== stamp;
}
