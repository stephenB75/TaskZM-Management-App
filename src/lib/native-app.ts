/**
 * Native deep link and app lifecycle handlers for Capacitor iOS/Android.
 */

import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { logger } from './logger';
import {
  MOBILE_DEEP_LINK_PREFIX,
  MOBILE_DEEP_LINK_PATHS,
  MOBILE_USE_CLOUD_WEB_APP,
  MOBILE_STORAGE_KEYS,
  MOBILE_UNIVERSAL_LINK_HOST,
} from './mobile-constants';
import { NOTIFICATION_OPEN_TASK_EVENT } from './notification-constants';
import { clearCalendarEventsCache } from './calendar-events-cache';
import { resolveCalendarOAuthReturn, type CalendarOAuthResult } from './calendar-oauth-return';
import {
  ensureNativeBuildIsCurrent,
  nativeCloudReleaseChangedSince,
} from './native-cache';
import { TIMING_CONSTANTS } from './timing-constants';

type CalendarOAuthCallback = (result: CalendarOAuthResult) => void;

let calendarOAuthCallback: CalendarOAuthCallback | null = null;

/** Register handler for calendar OAuth deep link results (native only). */
export function setCalendarOAuthCallback(callback: CalendarOAuthCallback | null): void {
  calendarOAuthCallback = callback;
}

function parseDeepLinkUrl(url: string): URL | null {
  try {
    if (url.startsWith(MOBILE_DEEP_LINK_PREFIX)) {
      const pathAndQuery = url.slice(MOBILE_DEEP_LINK_PREFIX.length);
      return new URL(`https://localhost/${pathAndQuery}`);
    }
    const parsed = new URL(url);
    if (parsed.hostname === MOBILE_UNIVERSAL_LINK_HOST) {
      return parsed;
    }
    return parsed;
  } catch {
    return null;
  }
}

function handleTaskDeepLink(parsed: URL): void {
  const path = parsed.pathname.replace(/^\//, '');
  const segments = path.split('/').filter(Boolean);
  const taskId =
    segments[0] === MOBILE_DEEP_LINK_PATHS.task && segments[1]
      ? decodeURIComponent(segments[1])
      : parsed.searchParams.get('taskId') ?? parsed.searchParams.get('id') ?? undefined;

  if (!taskId) return;

  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_OPEN_TASK_EVENT, { detail: { taskId } }),
  );
}

function handleCalendarOAuthDeepLink(parsed: URL): void {
  void Browser.close().catch(() => undefined);

  void resolveCalendarOAuthReturn(parsed.searchParams).then((result) => {
    if (result) calendarOAuthCallback?.(result);
  });
}

function handleAuthDeepLink(parsed: URL): void {
  const hash = parsed.hash;
  const search = parsed.search;
  if (!hash && !search) return;

  // Supabase auth tokens arrive in hash fragment
  const target = `${window.location.origin}/${parsed.pathname.replace(/^\//, '')}${search}${hash}`;
  window.location.href = target;
}

function handleDeepLink(url: string): void {
  const parsed = parseDeepLinkUrl(url);
  if (!parsed) return;

  const path = parsed.pathname.replace(/^\//, '');

  if (path === MOBILE_DEEP_LINK_PATHS.task || path.startsWith(`${MOBILE_DEEP_LINK_PATHS.task}/`)) {
    handleTaskDeepLink(parsed);
    return;
  }

  if (path === MOBILE_DEEP_LINK_PATHS.calendarOAuth) {
    handleCalendarOAuthDeepLink(parsed);
    return;
  }

  if (
    path === MOBILE_DEEP_LINK_PATHS.authCallback ||
    path === MOBILE_DEEP_LINK_PATHS.resetPassword
  ) {
    handleAuthDeepLink(parsed);
  }
}

/** Initialize native app listeners (back button, deep links). */
export function initNativeAppHandlers(): void {
  if (!Capacitor.isNativePlatform()) return;

  void App.addListener('appUrlOpen', ({ url }) => {
    logger.debug('[Native] appUrlOpen:', url);
    handleDeepLink(url);
  });

  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      void App.minimizeApp();
    }
  });

  // Handle cold start from deep link
  void App.getLaunchUrl().then((result) => {
    if (result?.url) {
      handleDeepLink(result.url);
    }
  });

  let lastForegroundReleaseCheck = 0;

  void App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) return;

    const now = Date.now();
    if (
      now - lastForegroundReleaseCheck <
      TIMING_CONSTANTS.native.cloudForegroundReleaseCheckMs
    ) {
      return;
    }
    lastForegroundReleaseCheck = now;

    void (async () => {
      try {
        const storedStamp = localStorage.getItem(MOBILE_STORAGE_KEYS.nativeBuildStamp);
        const releaseChanged = await nativeCloudReleaseChangedSince(storedStamp);
        if (releaseChanged) {
          const needsReload = await ensureNativeBuildIsCurrent();
          if (needsReload) {
            (window as unknown as { __userInitiatedReload?: boolean }).__userInitiatedReload = true;
            window.location.reload();
          }
          return;
        }

        // No new Railway deploy — refresh calendar event cache (visibility API often
        // does not fire on native resume; keeps imports in sync with notifications).
        if (MOBILE_USE_CLOUD_WEB_APP) {
          clearCalendarEventsCache();
        }
      } catch (error) {
        logger.warn('[Native] Foreground release/calendar refresh failed', error);
      }
    })();
  });
}

/** Open OAuth URL in system browser (native calendar connect). */
export async function openNativeOAuthUrl(authUrl: string): Promise<void> {
  await Browser.open({ url: authUrl, presentationStyle: 'popover' });
}

/** Build deep link for Supabase auth callback with hash or query string. */
export function buildAuthCallbackDeepLink(path: string, hashOrQuery: string): string {
  const normalizedPath = path.replace(/^\//, '');
  if (!hashOrQuery) {
    return `${MOBILE_DEEP_LINK_PREFIX}${normalizedPath}`;
  }
  return `${MOBILE_DEEP_LINK_PREFIX}${normalizedPath}${hashOrQuery.startsWith('#') || hashOrQuery.startsWith('?') ? hashOrQuery : `?${hashOrQuery}`}`;
}

/** Build redirect URL for Supabase password reset on native. */
export function getNativePasswordResetRedirectUrl(): string {
  return `${MOBILE_DEEP_LINK_PREFIX}${MOBILE_DEEP_LINK_PATHS.resetPassword}`;
}
