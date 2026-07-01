/**
 * Mobile / native app constants for Capacitor iOS and Android builds.
 * Single source of truth for bundle ID, deep links, and store URLs.
 */

/** Apple / Google bundle identifier (must match App Store Connect and capacitor.config). */
export const MOBILE_APP_ID = 'com.app.taskzm.com';

/** Production web app URL (Railway). Native shells load this when MOBILE_USE_CLOUD_WEB_APP is true. */
export const MOBILE_PRODUCTION_WEB_URL = 'https://app.taskzm.com';

/**
 * When true, iOS/Android Capacitor WebViews load MOBILE_PRODUCTION_WEB_URL instead of bundled dist/.
 * UI updates ship via git push → Railway; rebuild the native shell only for plugin or native config changes.
 * Set CAPACITOR_USE_BUNDLED_WEB=1 before cap sync to force bundled dist/ (offline dev only).
 */
export const MOBILE_USE_CLOUD_WEB_APP = true;

/** Custom URL scheme for deep links (matches MOBILE_APP_ID). */
export const MOBILE_DEEP_LINK_SCHEME = MOBILE_APP_ID;

/** Prefix for deep link URLs, e.g. com.app.taskzm.com://calendar-oauth */
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

/** Android status-bar notification icon (drawable name). */
export const MOBILE_NOTIFICATION_SMALL_ICON = 'ic_stat_icon_config_sample';

/** Accent color for Android notification icon. */
export const MOBILE_NOTIFICATION_ICON_COLOR = '#9D87C3';

/** LocalStorage keys used only on Capacitor native platforms. */
export const MOBILE_STORAGE_KEYS = {
  /** Last loaded native web bundle stamp (APP_VERSION:BUILD_NUMBER from build-info.json). */
  nativeBuildStamp: 'taskzm_native_build_stamp',
} as const;

/** Build deep link for Supabase auth (password reset, magic link). */
export function buildAuthCallbackDeepLink(path: string, hashOrQuery: string): string {
  const normalizedPath = path.replace(/^\//, '');
  return `${MOBILE_DEEP_LINK_PREFIX}${normalizedPath}${hashOrQuery.startsWith('#') || hashOrQuery.startsWith('?') ? hashOrQuery : `?${hashOrQuery}`}`;
}
