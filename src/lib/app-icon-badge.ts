/**
 * Sets the OS app icon badge count on web (PWA), iOS native, and Android native.
 * WKWebView does not expose navigator.setAppBadge; iOS uses AppIconBadgePlugin.
 */

import { registerPlugin } from '@capacitor/core';
import { logger } from './logger';
import { getPlatform } from './platform';

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
    try {
      await AppIconBadge.setCount({ count: safeCount });
      logger.debug('Native app icon badge set:', safeCount);
    } catch (error) {
      logger.warn('Failed to set native app icon badge:', error);
    }
    return;
  }

  await setWebAppIconBadgeCount(safeCount);
  if (safeCount > 0) {
    logger.debug('Web app icon badge set:', safeCount);
  }
}
