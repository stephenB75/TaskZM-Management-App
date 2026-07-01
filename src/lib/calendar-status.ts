/**
 * Calendar connection status helpers (shared by CalendarContext and useCalendarEvents).
 */

export interface CalendarConnectionStatus {
  google: boolean;
  outlook: boolean;
  apple: boolean;
}

export type CalendarProviderKey = 'google' | 'apple' | 'outlook';

/** Normalize backend / stored JSON to CalendarConnectionStatus. */
export function normalizeCalendarStatus(data: unknown): CalendarConnectionStatus {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    return {
      google: Boolean(o.google === true || o.google_connected === true),
      outlook: Boolean(o.outlook === true || o.outlook_connected === true),
      apple: Boolean(o.apple === true || o.apple_connected === true),
    };
  }
  return { google: false, outlook: false, apple: false };
}

export function hasConnectedCalendarProvider(status: CalendarConnectionStatus): boolean {
  return status.google || status.outlook || status.apple;
}

export function getActiveCalendarProviders(status: CalendarConnectionStatus): CalendarProviderKey[] {
  const active: CalendarProviderKey[] = [];
  if (status.google) active.push('google');
  if (status.apple) active.push('apple');
  if (status.outlook) active.push('outlook');
  return active;
}

/** Read long-lived calendar_status from localStorage (survives short API status cache). */
export function readPersistedCalendarStatus(userId: string | undefined): CalendarConnectionStatus | null {
  if (!userId) return null;
  try {
    const stored = localStorage.getItem(`calendar_status_${userId}`);
    if (!stored) return null;
    return normalizeCalendarStatus(JSON.parse(stored));
  } catch {
    return null;
  }
}

/** Merge context status with persisted status so fetches run when UI cache is stale false. */
export function resolveCalendarProvidersForFetch(
  contextStatus: CalendarConnectionStatus,
  userId: string | undefined,
): CalendarProviderKey[] {
  const fromContext = getActiveCalendarProviders(contextStatus);
  if (fromContext.length > 0) return fromContext;

  const persisted = readPersistedCalendarStatus(userId);
  if (persisted) return getActiveCalendarProviders(persisted);

  return [];
}
