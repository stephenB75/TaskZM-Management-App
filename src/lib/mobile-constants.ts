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

/** Apple Developer Team ID (Xcode DEVELOPMENT_TEAM). Used for Universal Links AASA. */
export const MOBILE_APPLE_TEAM_ID = 'BGGBNMD49N';

/** Hostname for Universal Links and share URLs (no trailing slash). */
export const MOBILE_UNIVERSAL_LINK_HOST = 'app.taskzm.com';

/** Custom URL scheme for deep links (matches MOBILE_APP_ID). */
export const MOBILE_DEEP_LINK_SCHEME = MOBILE_APP_ID;

/** Prefix for deep link URLs, e.g. com.app.taskzm.com://calendar-oauth */
export const MOBILE_DEEP_LINK_PREFIX = `${MOBILE_DEEP_LINK_SCHEME}://`;

/** Deep link path segments */
export const MOBILE_DEEP_LINK_PATHS = {
  calendarOAuth: 'calendar-oauth',
  authCallback: 'auth-callback',
  resetPassword: 'reset-password',
  task: 'task',
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

/** Android status-bar notification icon (drawable name). Must be white-on-transparent. */
export const MOBILE_NOTIFICATION_SMALL_ICON = 'ic_stat_taskzm';

/** Accent color for Android notification icon. */
export const MOBILE_NOTIFICATION_ICON_COLOR = '#171717';

/** Android notification channel IDs (Local Notifications). */
export const MOBILE_NOTIFICATION_CHANNELS = {
  tasks: 'task_alerts',
  achievements: 'achievements',
} as const;

/** Low-importance (no sound) twins used when Settings → Sound is off; Android channel sound can't change after creation. */
export const MOBILE_SILENT_NOTIFICATION_CHANNELS: Record<string, string> = {
  [MOBILE_NOTIFICATION_CHANNELS.tasks]: 'task_alerts_silent',
  [MOBILE_NOTIFICATION_CHANNELS.achievements]: 'achievements_silent',
};

/** Android notification channel display names. */
export const MOBILE_NOTIFICATION_CHANNEL_LABELS = {
  tasks: 'Task reminders',
  achievements: 'Achievements',
  tasksSilent: 'Task reminders (silent)',
  achievementsSilent: 'Achievements (silent)',
} as const;

/** Android NotificationManager importance levels (LOW shows without sound). */
export const ANDROID_CHANNEL_IMPORTANCE = { high: 4, low: 2 } as const;

/** LocalStorage keys used only on Capacitor native platforms. */
export const MOBILE_STORAGE_KEYS = {
  /** Last loaded native web bundle stamp (APP_VERSION:BUILD_NUMBER from build-info.json). */
  nativeBuildStamp: 'taskzm_native_build_stamp',
  /** When true, require Face ID / Touch ID after returning from background. */
  biometricLockEnabled: 'taskzm_biometric_lock_enabled',
  /** Last registered APNs/FCM device token (client-side cache). */
  pushDeviceToken: 'taskzm_push_device_token',
  /** User preference for remote push registration. */
  pushNotificationsEnabled: 'taskzm_push_notifications_enabled',
  /** True when the server confirmed it sends due-soon/overdue pushes, so on-device scheduling stands down. */
  pushServerReminders: 'taskzm_push_server_reminders',
} as const;

/** Pull-to-refresh gesture thresholds (native mobile). */
export const MOBILE_PULL_TO_REFRESH = {
  thresholdPx: 72,
  maxPullPx: 120,
  resistance: 0.45,
  settleMs: 150,
  indicatorSizePx: 36,
  iconSizePx: 20,
} as const;

/** Build a shareable HTTPS URL for a task (Universal Links + web). */
export function buildTaskWebUrl(taskId: string): string {
  return `${MOBILE_PRODUCTION_WEB_URL}/${MOBILE_DEEP_LINK_PATHS.task}/${encodeURIComponent(taskId)}`;
}

/** Build custom-scheme deep link for a task. */
export function buildTaskDeepLink(taskId: string): string {
  return `${MOBILE_DEEP_LINK_PREFIX}${MOBILE_DEEP_LINK_PATHS.task}/${encodeURIComponent(taskId)}`;
}

/** Build deep link for Supabase auth (password reset, magic link). */
export function buildAuthCallbackDeepLink(path: string, hashOrQuery: string): string {
  const normalizedPath = path.replace(/^\//, '');
  return `${MOBILE_DEEP_LINK_PREFIX}${normalizedPath}${hashOrQuery.startsWith('#') || hashOrQuery.startsWith('?') ? hashOrQuery : `?${hashOrQuery}`}`;
}
