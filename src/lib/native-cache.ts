/**
 * Native (Capacitor) cache invalidation.
 * - Cloud WebView (server.url → app.taskzm.com): release stamp from Railway build-info.json
 * - Bundled shell: stamp from copied dist/build-info.json after cap sync
 */

import { Capacitor } from '@capacitor/core';
import { getAppReleaseStamp, APP_VERSION, BUILD_NUMBER } from './version';
import {
  MOBILE_STORAGE_KEYS,
  MOBILE_USE_CLOUD_WEB_APP,
  MOBILE_PRODUCTION_WEB_URL,
} from './mobile-constants';
import { purgeAppCachesIfVersionChanged } from './service-worker-update';
import { logger } from './logger';

interface BuildInfo {
  version?: string;
  buildNumber?: string;
}

function buildStamp(version: string, buildNumber: string): string {
  return `${version}:${buildNumber}`;
}

function resolveStampFromBuildInfo(info: BuildInfo | null): string {
  const buildNumber = info?.buildNumber?.trim();
  const version = info?.version?.trim() ?? APP_VERSION;
  if (buildNumber) {
    return buildStamp(version, buildNumber);
  }
  return getAppReleaseStamp();
}

async function fetchCloudBuildInfo(): Promise<BuildInfo | null> {
  try {
    const response = await fetch(`${MOBILE_PRODUCTION_WEB_URL}/build-info.json`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as BuildInfo;
  } catch {
    return null;
  }
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

async function resolveNativeReleaseStamp(): Promise<string> {
  if (MOBILE_USE_CLOUD_WEB_APP) {
    const cloud = await fetchCloudBuildInfo();
    if (cloud?.buildNumber) {
      return resolveStampFromBuildInfo(cloud);
    }
  }
  const bundled = await fetchBundledBuildInfo();
  return resolveStampFromBuildInfo(bundled);
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
  const versionPurged = await purgeAppCachesIfVersionChanged(stamp);

  const storageKey = MOBILE_STORAGE_KEYS.nativeBuildStamp;
  const storedStamp = localStorage.getItem(storageKey);

  if (storedStamp === stamp) {
    return versionPurged;
  }

  localStorage.setItem(storageKey, stamp);

  if (storedStamp == null) {
    return versionPurged;
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
