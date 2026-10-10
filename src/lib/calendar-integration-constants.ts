/**
 * Calendar integration constants.
 * Centralizes URLs, provider IDs, and copy used by calendar (Google, Outlook, Apple/CalDAV) to avoid hardcodes.
 */

/** Calendar provider IDs (single source of truth for connect/disconnect/sync). */
export const CALENDAR_PROVIDERS = {
  google: 'google',
  outlook: 'outlook',
  apple: 'apple',
} as const;

export type CalendarProviderId = keyof typeof CALENDAR_PROVIDERS;

/** Apple ID management URL; used for app-specific password setup and link text. */
export const APPLE_ID_BASE_URL = 'https://appleid.apple.com';

/** Display name for Apple ID link (derived from URL). */
export const APPLE_ID_DISPLAY_NAME = 'appleid.apple.com';

/** Placeholder for iCloud email input in Apple CalDAV setup. */
export const ICLOUD_EMAIL_PLACEHOLDER = 'your.email@icloud.com';

/** Edge gateway / worker-limit statuses worth one retry (546 = worker resource limit). */
export const CALDAV_TRANSIENT_STATUSES: ReadonlySet<number> = new Set([502, 503, 546]);

/** Fallback color when a discovered Apple calendar has no color (indigo-500). */
export const APPLE_CALENDAR_FALLBACK_COLOR = '#6366f1';

/** Title used when an imported calendar event has no SUMMARY. */
export const CALENDAR_UNTITLED_EVENT_TITLE = 'Untitled Event';

/** CalDAV import window — days before today to fetch (recurring series anchors). */
export const APPLE_CALDAV_SYNC_PAST_DAYS = 365;

/** CalDAV import window — days after today to fetch. */
export const APPLE_CALDAV_SYNC_FUTURE_DAYS = 365;

/** OAuth provider origins allowed for calendar postMessage (security allowlist). */
export const CALENDAR_OAUTH_ORIGINS = {
  google: 'https://accounts.google.com',
  microsoft: 'https://login.microsoftonline.com',
  apple: APPLE_ID_BASE_URL,
} as const;

/** PostMessage types from calendar OAuth callback popup. */
export const CALENDAR_OAUTH_MESSAGE_TYPES = {
  success: 'calendar-oauth-success',
  error: 'calendar-oauth-error',
} as const;

/** Display names for calendar providers (toasts, labels). */
export const CALENDAR_PROVIDER_DISPLAY_NAMES: Record<CalendarProviderId, string> = {
  google: 'Google',
  outlook: 'Outlook',
  apple: 'Apple',
};

/** Label for event source in UI (e.g. Apple → "iCloud"). */
export const CALENDAR_PROVIDER_EVENT_SOURCE_LABELS: Record<CalendarProviderId, string> = {
  google: 'Google',
  outlook: 'Outlook',
  apple: 'iCloud',
};

/** Settings panel: label for each provider toggle (e.g. "Google Calendar"). */
export const CALENDAR_SETTINGS_LABELS: Record<CalendarProviderId, string> = {
  google: 'Google Calendar',
  outlook: 'Outlook Calendar',
  apple: 'Apple Calendar',
};

/** Settings panel: section and button copy. */
export const CALENDAR_SETTINGS_UI = {
  sectionTitle: 'Calendar Integration',
  sectionSubtitle: 'Sync your tasks with external calendar services',
  /** Shown when Google or Outlook is connected (read-only: we only display calendar, we do not write). */
  viewOnlyMessage: 'Your calendar is shown in the app for scheduling. We only read your events; we don\'t add or change them.',
  /** Imported event times follow device timezone, not the task dialog timezone picker. */
  deviceTimezoneNote:
    'Imported calendar event times use your device timezone ({timezone}), not the timezone selected when creating tasks.',
  syncButtonLabel: 'Sync All Tasks',
  syncButtonSyncing: 'Syncing...',
  lastSyncedLabel: 'Last synced:',
  /** Pro upsell: title when calendar sync is gated. */
  proUpsellTitle: `Sync your tasks with Google, Outlook, and Apple Calendar with TaskZM Pro`,
  /** Pro upsell: bullet list (each item one line). */
  proUpsellBullets: [
    'Google Calendar OAuth sync',
    'Apple Calendar via Shortcuts',
    'Automatic sync when tasks are created or updated',
    'Manual sync all tasks',
  ],
} as const;
