/**
 * Toast notification constants.
 * Used by toast-wrapper and Toaster; no hardcoded values in toast logic.
 */

/** Notification sound when user adds a task (Web Audio API params) */
export const NOTIFICATION_SOUND = {
  frequencyHz: 880,
  durationMs: 150,
  volume: 0.25,
  /** Gain ramp target (near zero) for exponentialRampToValueAtTime. */
  gainRampEnd: 0.001,
} as const;

/** Prefix for stored toast notification IDs */
export const TOAST_STORAGE_ID_PREFIX = 'toast_';

/** Maximum number of toasts to keep in storage (newest first) */
export const MAX_STORED_TOASTS = 100;
