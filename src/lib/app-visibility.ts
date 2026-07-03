/**
 * App foreground / background detection for notification routing.
 * System notifications when backgrounded; in-app toasts when foregrounded.
 */

/** True when the user can see the app (tab focused or native app in foreground). */
export function isAppInForeground(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState === 'visible' && !document.hidden;
}

/** True when OS/browser push-style notifications should be used instead of in-app toasts. */
export function shouldUseSystemNotification(): boolean {
  return !isAppInForeground();
}
