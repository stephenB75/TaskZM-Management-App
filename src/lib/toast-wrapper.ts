/**
 * Toast Wrapper — keeps the familiar `toast.*` call sites without any in-app pop-ups.
 *
 * Every message is stored for the notification panel ("Updates") and delivered as a system
 * notification (iOS/Android local notification; on web only when permitted and the app is
 * in the background).
 *
 * import { toast } from '../lib/toast-wrapper';
 */

import type { ReactNode } from 'react';
import { getFromLocalStorage, saveToLocalStorage } from './utils';
import { NOTIFICATION_ALERT_VARIANTS, NOTIFICATION_STORAGE_KEYS, NOTIFICATION_STORED_EVENT } from './notification-constants';
import { MAX_STORED_TOASTS, TOAST_STORAGE_ID_PREFIX } from './toast-constants';
import { showNotification } from './native-notifications';
import { logger } from './logger';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';
type ToastMessage = string | ReactNode;
type ToastOptions = { description?: ToastMessage; duration?: number; playSound?: boolean; id?: string | number; [key: string]: any };
type ToastId = string | number;

interface ToastNotification {
  id: string;
  type: ToastVariant;
  title: string;
  description?: string;
  timestamp: string;
  read: boolean;
}

const asText = (value: ToastMessage | undefined): string | undefined =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;

const addToastToStorage = (type: ToastVariant, title: string, description?: string) => {
  try {
    const stored = getFromLocalStorage<ToastNotification[]>(NOTIFICATION_STORAGE_KEYS.toastNotifications, []);
    const entry: ToastNotification = {
      id: `${TOAST_STORAGE_ID_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      type,
      title,
      description,
      timestamp: new Date().toISOString(),
      read: !NOTIFICATION_ALERT_VARIANTS.has(type),
    };
    saveToLocalStorage(NOTIFICATION_STORAGE_KEYS.toastNotifications, [entry, ...stored].slice(0, MAX_STORED_TOASTS));
    window.dispatchEvent(new CustomEvent(NOTIFICATION_STORED_EVENT));
  } catch (error) {
    logger.warn('Failed to store toast notification:', error);
  }
};

let toastCounter = 0;
const nextId = (): ToastId => `toast-${++toastCounter}`;

function emit(variant: ToastVariant, message: ToastMessage, options?: ToastOptions): ToastId {
  const title = asText(message) ?? '';
  const description = asText(options?.description);
  if (title) {
    addToastToStorage(variant, title, description);
    void showNotification({ title, body: description || title }).catch((error) => {
      logger.debug('System notification not delivered:', error);
    });
  }
  return options?.id ?? nextId();
}

function baseToast(message: ToastMessage, options?: ToastOptions): ToastId {
  return emit('info', message, options);
}

export const toast = Object.assign(baseToast, {
  success: (message: ToastMessage, options?: ToastOptions) => emit('success', message, options),
  error: (message: ToastMessage, options?: ToastOptions) => emit('error', message, options),
  info: (message: ToastMessage, options?: ToastOptions) => emit('info', message, options),
  warning: (message: ToastMessage, options?: ToastOptions) => emit('warning', message, options),
  message: (message: ToastMessage, options?: ToastOptions) => emit('info', message, options),

  /** Progress states are transient; the follow-up success/error becomes the notification. */
  loading: (_message: ToastMessage, options?: ToastOptions): ToastId => options?.id ?? nextId(),
  custom: (..._args: unknown[]): ToastId => nextId(),
  dismiss: (toastId?: ToastId) => toastId,

  promise: <T,>(
    promise: Promise<T> | (() => Promise<T>),
    options: {
      loading?: string;
      success?: string | ((data: T) => string);
      error?: string | ((error: any) => string);
      [key: string]: any;
    },
  ) => {
    const run = typeof promise === 'function' ? promise() : promise;
    run.then(
      (data) => emit('success', typeof options.success === 'function' ? options.success(data) : options.success || 'Success'),
      (error) => emit('error', typeof options.error === 'function' ? options.error(error) : options.error || 'Error occurred'),
    );
    return run;
  },
});
