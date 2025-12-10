/**
 * Apple Calendar Two-Way Sync via Shortcuts
 * 
 * This approach uses Apple Shortcuts to enable bidirectional sync:
 * 
 * 1. TaskZM → Apple Calendar:
 *    - Shortcut fetches tasks from TaskZM API
 *    - Creates/updates calendar events
 * 
 * 2. Apple Calendar → TaskZM:
 *    - Shortcut reads calendar events
 *    - POSTs them to TaskZM API endpoint
 * 
 * Benefits:
 * - Native calendar access via Shortcuts
 * - No CalDAV URL issues
 * - Bidirectional sync
 * - Can run on schedule via Shortcuts automations
 */

export const TASKZM_SHORTCUT_NAME = 'TaskZM Sync';

/**
 * API endpoint paths for calendar sync
 */
export const CALENDAR_SYNC_ENDPOINTS = {
  // Get tasks to sync TO Apple Calendar
  getTasks: '/api/calendar/tasks',
  // Receive events FROM Apple Calendar
  postEvents: '/api/calendar/events',
  // Get sync status
  status: '/api/calendar/status',
};

/**
 * Generate the API URL for the shortcut to call
 */
export function getAPIBaseURL(): string {
  // Use the current origin for the API
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

/**
 * Calendar event format expected from Apple Shortcuts
 */
export interface AppleCalendarEvent {
  id?: string;           // Apple Calendar event ID
  title: string;
  startDate: string;     // ISO format
  endDate: string;       // ISO format
  notes?: string;
  location?: string;
  calendarName?: string;
  isAllDay?: boolean;
}

/**
 * Task format to send to Apple Shortcuts
 */
export interface TaskForCalendar {
  id: string;
  title: string;
  description?: string;
  scheduledDate: string;  // ISO format
  endDate: string;        // ISO format (calculated from duration)
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
}

/**
 * Convert a task to calendar event format
 */
export function taskToCalendarEvent(task: {
  id: string;
  title: string;
  description?: string;
  scheduledDate?: string | Date | null;
  dueDate?: string | Date | null;
  estimatedTime?: number;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
}): TaskForCalendar | null {
  const startDateValue = task.scheduledDate || task.dueDate;
  if (!startDateValue) return null;

  const startDate = new Date(startDateValue);
  if (isNaN(startDate.getTime())) return null;

  const durationMinutes = task.estimatedTime || 30;
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    scheduledDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    priority: task.priority,
    status: task.status,
  };
}

/**
 * Generate the Shortcut download/setup URL
 * This will be an iCloud link to a pre-made shortcut
 */
export function getShortcutDownloadURL(): string | null {
  // This should be set to your actual iCloud shortcut link
  // Return null if not configured yet
  const configuredURL = localStorage.getItem('taskzm_shortcut_url');
  return configuredURL || null;
}

/**
 * Set the Shortcut download URL (for admin configuration)
 */
export function setShortcutDownloadURL(url: string): void {
  localStorage.setItem('taskzm_shortcut_url', url);
}

/**
 * Check if Apple Calendar sync is configured
 */
export function isAppleSyncConfigured(): boolean {
  return localStorage.getItem('apple_calendar_enabled') === 'true';
}

/**
 * Enable/disable Apple Calendar sync
 */
export function setAppleSyncEnabled(enabled: boolean): void {
  localStorage.setItem('apple_calendar_enabled', enabled ? 'true' : 'false');
}

/**
 * Generate a sync token for the shortcut to authenticate
 */
export function generateSyncToken(userId: string): string {
  // In production, this should be a proper JWT or API key
  // For now, we'll use a simple encoding
  const payload = {
    userId,
    type: 'calendar_sync',
    exp: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
  };
  return btoa(JSON.stringify(payload));
}

/**
 * Validate a sync token
 */
export function validateSyncToken(token: string): { valid: boolean; userId?: string } {
  try {
    const payload = JSON.parse(atob(token));
    if (payload.type !== 'calendar_sync') return { valid: false };
    if (payload.exp < Date.now()) return { valid: false };
    return { valid: true, userId: payload.userId };
  } catch {
    return { valid: false };
  }
}

