/**
 * Mobile / native app constants for Capacitor iOS and Android builds.
 * Single source of truth for bundle ID, deep links, and store URLs.
 */

/** Apple / Google bundle identifier (must match App Store Connect and capacitor.config). */
export const MOBILE_APP_ID = 'com.taskzm.app';

/** Custom URL scheme for deep links (matches MOBILE_APP_ID). */
export const MOBILE_DEEP_LINK_SCHEME = MOBILE_APP_ID;

/** Prefix for deep link URLs, e.g. com.taskzm.app://calendar-oauth */
export const MOBILE_DEEP_LINK_PREFIX = `${MOBILE_DEEP_LINK_SCHEME}://`;

/** Deep link path segments */
export const MOBILE_DEEP_LINK_PATHS = {
  calendarOAuth: 'calendar-oauth',
  authCallback: 'auth-callback',
  resetPassword: 'reset-password',
} as const;

/** Query param sent to calendar auth API when initiating OAuth from native. */
export const MOBILE_CALENDAR_AUTH_PLATFORM_PARAM = 'native';

/** RevenueCat entitlement identifier (must match RevenueCat dashboard). */
export const REVENUECAT_PRO_ENTITLEMENT_ID = 'pro';

/** App Store listing URL — set when app is live. */
export const APP_STORE_URL = '';

/** Google Play listing URL — set when app is live. */
export const PLAY_STORE_URL = '';

/** Build a deep link URL for calendar OAuth result. */
export function buildCalendarOAuthDeepLink(
  provider: string,
  status: 'success' | 'error',
  errorMessage?: string
): string {
  const url = new URL(`${MOBILE_DEEP_LINK_PREFIX}${MOBILE_DEEP_LINK_PATHS.calendarOAuth}`);
  url.searchParams.set('provider', provider);
  url.searchParams.set('status', status);
  if (errorMessage) {
    url.searchParams.set('error', errorMessage);
  }
  return url.toString();
}

/** Build deep link for Supabase auth (password reset, magic link). */
export function buildAuthCallbackDeepLink(path: string, hashOrQuery: string): string {
  const normalizedPath = path.replace(/^\//, '');
  return `${MOBILE_DEEP_LINK_PREFIX}${normalizedPath}${hashOrQuery.startsWith('#') || hashOrQuery.startsWith('?') ? hashOrQuery : `?${hashOrQuery}`}`;
}
