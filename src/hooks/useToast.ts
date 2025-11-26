/**
 * useToast Hook
 * Provides toast notifications that automatically store in the notification panel
 * 
 * Usage:
 * const { toast } = useToast();
 * toast.success('Task completed!');
 */

import { useNotifications } from '../contexts/NotificationContext';
import { toast as sonnerToast } from 'sonner';

export function useToast() {
  const { addToastNotification } = useNotifications();

  const toast = {
    success: (message: string, options?: { description?: string; duration?: number; [key: string]: any }) => {
      addToastNotification('success', message, options?.description);
      return sonnerToast.success(message, options);
    },
    
    error: (message: string, options?: { description?: string; duration?: number; [key: string]: any }) => {
      addToastNotification('error', message, options?.description);
      return sonnerToast.error(message, options);
    },
    
    info: (message: string, options?: { description?: string; duration?: number; [key: string]: any }) => {
      addToastNotification('info', message, options?.description);
      return sonnerToast.info(message, options);
    },
    
    warning: (message: string, options?: { description?: string; duration?: number; [key: string]: any }) => {
      addToastNotification('warning', message, options?.description);
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
      return sonnerToast.promise(promise, {
        ...options,
        success: (data: T) => {
          const successMsg = typeof options.success === 'function' ? options.success(data) : (options.success || 'Success');
          addToastNotification('success', successMsg);
          return successMsg;
        },
        error: (error: any) => {
          const errorMsg = typeof options.error === 'function' ? options.error(error) : (options.error || 'Error occurred');
          addToastNotification('error', errorMsg);
          return errorMsg;
        },
      });
    },
  };

  return { toast };
}

