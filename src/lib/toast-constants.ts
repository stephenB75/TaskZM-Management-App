/**
 * Toast notification constants.
 * Used by toast-wrapper and Toaster; no hardcoded values in toast logic.
 */

import {
  IOS_NATIVE_TOAST_TOP_MIN_PX,
} from './layout-constants';

/** Notification sound when user creates a task (Web Audio API params) */
export const NOTIFICATION_SOUND = {
  frequencyHz: 880,
  durationMs: 150,
  volume: 0.25,
  /** Gain ramp target (near zero) for exponentialRampToValueAtTime. */
  gainRampEnd: 0.001,
} as const;

/** Sound when user marks a task complete (plays with confetti) */
export const TASK_COMPLETE_SOUND = {
  frequencyHz: 1047,
  durationMs: 200,
  volume: 0.2,
  gainRampEnd: 0.001,
} as const;

/** Chime for due/upcoming task reminders */
export const DUE_REMINDER_CHIME = {
  frequencyHz: 659,
  durationMs: 120,
  volume: 0.2,
  gainRampEnd: 0.001,
} as const;

/** Sound when user marks a subtask complete on a task card */
export const SUBTASK_COMPLETE_SOUND = {
  frequencyHz: 523,
  durationMs: 80,
  volume: 0.18,
  gainRampEnd: 0.001,
} as const;

/** Prefix for stored toast notification IDs */
export const TOAST_STORAGE_ID_PREFIX = 'toast_';

/** Maximum number of toasts to keep in storage (newest first) */
export const MAX_STORED_TOASTS = 100;

/** Toaster placement — pair with env(safe-area-inset-*) for native notch / Dynamic Island. */
export const TOAST_LAYOUT = {
  topOffsetRem: '1rem',
  toastGapPx: 8,
  topWithSafeArea: 'calc(1rem + env(safe-area-inset-top, 0px))',
  /** Native iOS: ensure clearance below status bar / Dynamic Island when env() reports 0. */
  topNativeIosWithFallback: `max(calc(1rem + env(safe-area-inset-top, 0px)), calc(1rem + ${IOS_NATIVE_TOAST_TOP_MIN_PX}px))`,
  horizontalSafeAreaLeft: 'env(safe-area-inset-left, 0px)',
  horizontalSafeAreaRight: 'env(safe-area-inset-right, 0px)',
} as const;

/** Sonner toast close (×) control — compact on mobile; global touch-target rules must not inflate this. */
export const TOAST_CLOSE_BUTTON = {
  sizePx: 20,
  sizeMobilePx: 16,
  iconSizePx: 12,
  iconSizeMobilePx: 10,
} as const;

/** Sonner `offset` / `mobileOffset` props (Sonner v2 uses --offset-top / --mobile-offset-top). */
export function getToastViewportOffset(top: string = TOAST_LAYOUT.topWithSafeArea) {
  return {
    top,
    left: TOAST_LAYOUT.horizontalSafeAreaLeft,
    right: TOAST_LAYOUT.horizontalSafeAreaRight,
  } as const;
}
