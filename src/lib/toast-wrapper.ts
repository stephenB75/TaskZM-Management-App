/**
 * Toast Wrapper — drop-in replacement for sonner's `toast`.
 *
 * Every message is stored for the notification panel ("Updates"). On native iOS/Android
 * nothing renders in-app: the message is delivered as a system notification instead.
 * On web it falls through to sonner.
 *
 * import { toast } from '../lib/toast-wrapper';
 */

import type { ReactNode } from 'react';
import { toast as sonnerToast } from 'sonner';
import { getFromLocalStorage, saveToLocalStorage } from './utils';
import { NOTIFICATION_STORAGE_KEYS } from './notification-constants';
import { playNotificationSound } from './toast-sound';
import { MAX_STORED_TOASTS, TOAST_STORAGE_ID_PREFIX } from './toast-constants';
import { getPlatform } from './platform';
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
      read: false,
    };
    saveToLocalStorage(NOTIFICATION_STORAGE_KEYS.toastNotifications, [entry, ...stored].slice(0, MAX_STORED_TOASTS));
  } catch (error) {
    logger.warn('Failed to store toast notification:', error);
  }
};

const isNative = () => getPlatform().isNative;

let nativeToastCounter = 0;
const nextNativeId = (): ToastId => `native-toast-${++nativeToastCounter}`;

function deliverNative(title: string, description?: string): void {
  void showNotification({ title, body: description || title }).catch((error) => {
    logger.error('Failed to deliver native notification:', error);
  });
}

function emit(variant: ToastVariant, message: ToastMessage, options?: ToastOptions): ToastId {
  const title = asText(message) ?? '';
  const description = asText(options?.description);
  if (title) addToastToStorage(variant, title, description);

  if (isNative()) {
    if (title) deliverNative(title, description);
    return options?.id ?? nextNativeId();
  }

  if (options?.playSound) playNotificationSound();
  return sonnerToast[variant](message, options);
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

  /** Progress states are transient; on native the follow-up success/error becomes the notification. */
  loading: (message: ToastMessage, options?: ToastOptions): ToastId =>
    isNative() ? options?.id ?? nextNativeId() : sonnerToast.loading(message, options),

  custom: (...args: Parameters<typeof sonnerToast.custom>): ToastId =>
    isNative() ? nextNativeId() : sonnerToast.custom(...args),

  dismiss: (toastId?: ToastId) => (isNative() ? toastId : sonnerToast.dismiss(toastId)),

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
    const successText = (data: T) =>
      typeof options.success === 'function' ? options.success(data) : options.success || 'Success';
    const errorText = (error: any) =>
      typeof options.error === 'function' ? options.error(error) : options.error || 'Error occurred';

    if (isNative()) {
      run.then(
        (data) => emit('success', successText(data)),
        (error) => emit('error', errorText(error)),
      );
      return run;
    }

    return sonnerToast.promise(run, {
      ...options,
      success: (data: T) => {
        const text = successText(data);
        addToastToStorage('success', text);
        return text;
      },
      error: (error: any) => {
        const text = errorText(error);
        addToastToStorage('error', text);
        return text;
      },
    });
  },
});
