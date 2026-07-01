/**
 * Detect Railway deploys via build-info.json (version + buildNumber + builtAt).
 * Fixes stale UI when BUILD_NUMBER is unchanged between git pushes.
 */

import { Capacitor } from '@capacitor/core';
import { getAppReleaseStamp, APP_VERSION } from './version';
import { MOBILE_PRODUCTION_WEB_URL, MOBILE_USE_CLOUD_WEB_APP } from './mobile-constants';
import { NOTIFICATION_STORAGE_KEYS } from './notification-constants';
import { logger } from './logger';

export interface DeployBuildInfo {
  version?: string;
  buildNumber?: string;
  builtAt?: string;
}

/** Unique stamp per Railway deploy (builtAt changes every build). */
export function getReleaseStampFromBuildInfo(
  info: DeployBuildInfo | null | undefined,
  fallback = getAppReleaseStamp(),
): string {
  const buildNumber = info?.buildNumber?.trim();
  if (!buildNumber) return fallback;

  const version = info?.version?.trim() || APP_VERSION;
  const builtAt = info?.builtAt?.trim();
  if (builtAt) {
    return `${version}:${buildNumber}@${builtAt}`;
  }
  return `${version}:${buildNumber}`;
}

export async function fetchDeployedBuildInfo(): Promise<DeployBuildInfo | null> {
  const baseUrl =
    Capacitor.isNativePlatform() && MOBILE_USE_CLOUD_WEB_APP
      ? MOBILE_PRODUCTION_WEB_URL
      : typeof window !== 'undefined'
        ? window.location.origin
        : MOBILE_PRODUCTION_WEB_URL;

  try {
    const response = await fetch(`${baseUrl}/build-info.json?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as DeployBuildInfo;
  } catch {
    return null;
  }
}

/** Purge Cache Storage and unregister service workers (browser PWA only). */
export async function purgeBrowserAppCaches(): Promise<void> {
  if (typeof window === 'undefined') return;

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
}

/**
 * Compare live build-info.json to localStorage; purge caches and return true when a reload is needed.
 */
export async function ensureDeployedReleaseIsCurrent(options: {
  storageKey: string;
  purgeBrowserCaches?: boolean;
  logPrefix?: string;
}): Promise<boolean> {
  const remote = await fetchDeployedBuildInfo();
  const stamp = getReleaseStampFromBuildInfo(remote);
  if (!stamp) return false;

  const storedStamp = localStorage.getItem(options.storageKey);
  if (storedStamp === stamp) {
    return false;
  }

  localStorage.setItem(options.storageKey, stamp);

  if (storedStamp == null) {
    return false;
  }

  if (options.purgeBrowserCaches) {
    await purgeBrowserAppCaches();
  }

  logger.info(
    `[${options.logPrefix ?? 'Release'}] Deploy changed (${storedStamp} → ${stamp}) — reloading`,
  );
  return true;
}

/** Browser: fetch Railway build-info before React boot; reload once when deploy is newer. */
export async function ensureWebReleaseIsCurrent(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    return false;
  }

  return ensureDeployedReleaseIsCurrent({
    storageKey: NOTIFICATION_STORAGE_KEYS.appVersion,
    purgeBrowserCaches: true,
    logPrefix: 'Web',
  });
}
