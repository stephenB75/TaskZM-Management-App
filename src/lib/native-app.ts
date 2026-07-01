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
} from './mobile-constants';
import { CALENDAR_OAUTH_MESSAGE_TYPES } from './calendar-integration-constants';
import type { CalendarProviderId } from './calendar-integration-constants';

type CalendarOAuthCallback = (result: {
  type: typeof CALENDAR_OAUTH_MESSAGE_TYPES.success | typeof CALENDAR_OAUTH_MESSAGE_TYPES.error;
  provider: CalendarProviderId;
  error?: string;
}) => void;

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
    return new URL(url);
  } catch {
    return null;
  }
}

function handleCalendarOAuthDeepLink(parsed: URL): void {
  const provider = parsed.searchParams.get('provider') as CalendarProviderId | null;
  const status = parsed.searchParams.get('status');
  const error = parsed.searchParams.get('error') ?? undefined;

  if (!provider || !calendarOAuthCallback) return;

  void Browser.close().catch(() => undefined);

  if (status === 'success') {
    calendarOAuthCallback({
      type: CALENDAR_OAUTH_MESSAGE_TYPES.success,
      provider,
    });
  } else {
    calendarOAuthCallback({
      type: CALENDAR_OAUTH_MESSAGE_TYPES.error,
      provider,
      error: error ?? 'Calendar connection failed',
    });
  }
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
