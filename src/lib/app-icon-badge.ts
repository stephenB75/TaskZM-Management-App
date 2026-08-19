/**
 * Sets the OS app icon badge count on web (PWA), iOS native, and Android native.
 * WKWebView does not expose navigator.setAppBadge; iOS uses AppIconBadgePlugin.
 */

import { registerPlugin } from '@capacitor/core';
import { logger } from './logger';
import { getPlatform } from './platform';
import { TIMING_CONSTANTS } from './timing-constants';

interface AppIconBadgePlugin {
  setCount(options: { count: number }): Promise<void>;
}

type NavigatorWithBadge = Navigator & {
  setAppBadge?: (count: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

const AppIconBadge = registerPlugin<AppIconBadgePlugin>('AppIconBadge', {
  web: () => ({
    setCount: async ({ count }: { count: number }) => {
      await setWebAppIconBadgeCount(count);
    },
  }),
});

let pendingBadgeCount: number | null = null;
let badgePluginRetryTimer: ReturnType<typeof setTimeout> | null = null;
let badgePluginRetryAttempts = 0;

function scheduleNativeBadgeRetry(): void {
  if (badgePluginRetryTimer !== null) return;
  if (badgePluginRetryAttempts >= TIMING_CONSTANTS.delays.nativeBadgePluginMaxRetries) return;
  if (pendingBadgeCount === null) return;

  badgePluginRetryTimer = setTimeout(() => {
    badgePluginRetryTimer = null;
    badgePluginRetryAttempts += 1;
    if (pendingBadgeCount !== null) {
      void setAppIconBadgeCount(pendingBadgeCount);
    }
  }, TIMING_CONSTANTS.delays.nativeBadgePluginRetry);
}

export function flushPendingAppIconBadgeCount(): void {
  if (pendingBadgeCount !== null) {
    void setAppIconBadgeCount(pendingBadgeCount);
  }
}

async function setWebAppIconBadgeCount(count: number): Promise<void> {
  const navigatorWithBadge = navigator as NavigatorWithBadge;

  if (
    !('setAppBadge' in navigatorWithBadge) ||
    typeof navigatorWithBadge.setAppBadge !== 'function'
  ) {
    return;
  }

  try {
    if (count <= 0) {
      if (typeof navigatorWithBadge.clearAppBadge === 'function') {
        await navigatorWithBadge.clearAppBadge();
      } else {
        await navigatorWithBadge.setAppBadge(0);
      }
      return;
    }

    await navigatorWithBadge.setAppBadge(count);
  } catch (error) {
    const err = error as Error;
    if (err.name !== 'NotSupportedError' && err.name !== 'TypeError') {
      logger.warn('Failed to set web app icon badge:', error);
    }
  }
}

export function isAppIconBadgeSupported(): boolean {
  const platform = getPlatform();
  if (platform.isIOS) {
    return true;
  }

  if (platform.isAndroid) {
    return false;
  }

  const navigatorWithBadge = navigator as NavigatorWithBadge;
  return (
    'setAppBadge' in navigatorWithBadge &&
    typeof navigatorWithBadge.setAppBadge === 'function'
  );
}

export async function setAppIconBadgeCount(count: number): Promise<void> {
  const safeCount = Math.max(0, Math.floor(count));
  const platform = getPlatform();

  if (platform.isIOS) {
    pendingBadgeCount = safeCount;
    try {
      await AppIconBadge.setCount({ count: safeCount });
      pendingBadgeCount = null;
      badgePluginRetryAttempts = 0;
      if (badgePluginRetryTimer !== null) {
        clearTimeout(badgePluginRetryTimer);
        badgePluginRetryTimer = null;
      }
      logger.debug('Native app icon badge set:', safeCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('not implemented') || message.includes('UNIMPLEMENTED')) {
        scheduleNativeBadgeRetry();
      } else {
        logger.warn('Failed to set native app icon badge:', error);
      }
    }
    return;
  }

  await setWebAppIconBadgeCount(safeCount);
  if (safeCount > 0) {
    logger.debug('Web app icon badge set:', safeCount);
  }
}
