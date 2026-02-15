/**
 * Toast Wrapper
 * Wraps sonner toast functions to also store notifications in the notification panel
 * 
 * Usage: Import this instead of 'sonner' to automatically store notifications
 * import { toast } from '../lib/toast-wrapper';
 */

import { toast as sonnerToast } from 'sonner';
import { getFromLocalStorage, saveToLocalStorage } from './utils';
import { NOTIFICATION_STORAGE_KEYS } from './notification-constants';
import { playNotificationSound } from './toast-sound';
import { MAX_STORED_TOASTS, TOAST_STORAGE_ID_PREFIX } from './toast-constants';

interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
  timestamp: string; // Store as ISO string for localStorage
  read: boolean;
}

// Helper function to add toast notification to storage
const addToastToStorage = (type: 'success' | 'error' | 'info' | 'warning', title: string, description?: string) => {
  try {
    const toastNotifications = getFromLocalStorage<ToastNotification[]>(NOTIFICATION_STORAGE_KEYS.toastNotifications, []);
    const newNotification: ToastNotification = {
      id: `${TOAST_STORAGE_ID_PREFIX}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      description,
      timestamp: new Date().toISOString(),
      read: false,
    };

    const updated = [newNotification, ...toastNotifications];
    const trimmed = updated.slice(0, MAX_STORED_TOASTS);
    
    saveToLocalStorage(NOTIFICATION_STORAGE_KEYS.toastNotifications, trimmed);
  } catch (error) {
    console.error('Failed to store toast notification:', error);
  }
};

// Wrapped toast functions that show popup AND store in notification panel
export const toast = {
  success: (message: string, options?: { description?: string; duration?: number; playSound?: boolean; [key: string]: any }) => {
    if (options?.playSound) playNotificationSound();
    addToastToStorage('success', message, options?.description);
    return sonnerToast.success(message, options);
  },
  
  error: (message: string, options?: { description?: string; duration?: number; [key: string]: any }) => {
    addToastToStorage('error', message, options?.description);
    return sonnerToast.error(message, options);
  },
  
  info: (message: string, options?: { description?: string; duration?: number; [key: string]: any }) => {
    addToastToStorage('info', message, options?.description);
    return sonnerToast.info(message, options);
  },
  
  warning: (message: string, options?: { description?: string; duration?: number; [key: string]: any }) => {
    addToastToStorage('warning', message, options?.description);
    return sonnerToast.warning(message, options);
  },
  
  loading: (message: string, options?: { description?: string; duration?: number; [key: string]: any }) => {
    // Loading toasts are temporary, don't store them
    return sonnerToast.loading(message, options);
  },
  
  dismiss: (toastId?: string | number) => {
    return sonnerToast.dismiss(toastId);
  },
  
  promise: <T,>(promise: Promise<T> | (() => Promise<T>), options: { loading?: string; success?: string | ((data: T) => string); error?: string | ((error: any) => string); [key: string]: any }) => {
    // For promise toasts, store the success/error messages
    const promiseResult = sonnerToast.promise(promise, {
      ...options,
      success: (data: T) => {
        const successMsg = typeof options.success === 'function' ? options.success(data) : (options.success || 'Success');
        addToastToStorage('success', successMsg);
        return successMsg;
      },
      error: (error: any) => {
        const errorMsg = typeof options.error === 'function' ? options.error(error) : (options.error || 'Error occurred');
        addToastToStorage('error', errorMsg);
        return errorMsg;
      },
    });
    return promiseResult;
  },
  
  // Expose all other sonner methods
  ...sonnerToast,
};

