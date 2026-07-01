import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useTasks } from './TaskContext';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { getFromLocalStorage, saveToLocalStorage } from '../lib/utils';
import { playDueReminderChime } from '../lib/toast-sound';
import { logger } from '../lib/logger';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_STORAGE_KEYS,
  NOTIFICATION_TOAST_MESSAGES,
  NOTIFICATION_TAG_PREFIXES,
  NOTIFICATION_ERRORS,
  NOTIFICATION_INTERVALS,
} from '../lib/notification-constants';
import { TIMING_CONSTANTS } from '../lib/timing-constants';
import { createDefaultNotificationContext } from '../lib/context-defaults';
import {
  requestNotificationPermission as requestNativePermission,
  getNotificationPermission as getNativePermission,
  showNotification as showNativeNotification,
  isNativeNotificationsAvailable,
  syncScheduledTaskNotifications,
  buildOverdueNotificationPayload,
  buildDueSoonNotificationPayload,
  getOverdueTasks,
  getDueSoonTasks,
} from '../lib/native-notifications';
import { isEligibleForTaskNotification, isTaskOverdue, isTaskDueSoon } from '../lib/notification-task-filters';

interface NotificationSettings {
  enabled: boolean;
  showBadge: boolean;
  dueDateReminders: boolean;
  overdueAlerts: boolean;
  soundEnabled: boolean;
  reminderTime: number;
  checkInterval: number;
}

interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning' | 'loading';
  title: string;
  description?: string;
  timestamp: string;
  read: boolean;
}

interface NotificationContextType {
  permission: NotificationPermission;
  settings: NotificationSettings;
  badgeCount: number;
  requestPermission: () => Promise<boolean>;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  updateBadge: () => void;
  addToastNotification: (type: 'success' | 'error' | 'info' | 'warning', title: string, description?: string) => void;
  getToastNotifications: () => ToastNotification[];
  markToastAsRead: (id: string) => void;
  clearToastNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { tasks } = useTasks();
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    const stored = getFromLocalStorage<NotificationSettings>(
      NOTIFICATION_STORAGE_KEYS.settings,
      DEFAULT_NOTIFICATION_SETTINGS as NotificationSettings,
    );
    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...stored,
      soundEnabled: stored.soundEnabled ?? DEFAULT_NOTIFICATION_SETTINGS.soundEnabled,
    };
  });
  const [badgeCount, setBadgeCount] = useState(0);

  useEffect(() => {
    const checkPermission = async () => {
      const currentPermission = await getNativePermission();
      setPermission(currentPermission);
    };
    checkPermission();
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const isNative = await isNativeNotificationsAvailable();

    if (!isNative && !('Notification' in window)) {
      toast.error(NOTIFICATION_TOAST_MESSAGES.notSupported);
      return false;
    }

    const currentPermission = await getNativePermission();
    if (currentPermission === 'granted') {
      setPermission('granted');
      return true;
    }

    if (currentPermission === 'denied') {
      toast.error(NOTIFICATION_TOAST_MESSAGES.blocked);
      setPermission('denied');
      return false;
    }

    try {
      const result = await requestNativePermission();
      setPermission(result);

      if (result === 'granted') {
        toast.success(NOTIFICATION_TOAST_MESSAGES.enabled);
        return true;
      }
      toast.error(NOTIFICATION_TOAST_MESSAGES.permissionDenied);
      return false;
    } catch (error) {
      logger.error('Error requesting notification permission:', error);
      toast.error(NOTIFICATION_TOAST_MESSAGES.requestFailed);
      return false;
    }
  }, []);

  const isBadgeAPIAvailable = useCallback(() => {
    return (
      'navigator' in window &&
      'setAppBadge' in navigator &&
      typeof (navigator as Navigator & { setAppBadge?: (count: number) => Promise<void> }).setAppBadge === 'function'
    );
  }, []);

  const updateBadge = useCallback(() => {
    const dismissedNotificationsArray = getFromLocalStorage<string[]>(
      NOTIFICATION_STORAGE_KEYS.dismissedNotifications,
      [],
    );
    const dismissedNotifications = new Set(dismissedNotificationsArray);
    const now = new Date();

    const count = (() => {
      if (!settings.showBadge) return 0;

      const overdueCount = settings.overdueAlerts
        ? getOverdueTasks(tasks, { dismissedNotificationIds: dismissedNotifications, now }).length
        : 0;
      const dueSoonCount = settings.dueDateReminders
        ? getDueSoonTasks(tasks, settings.reminderTime, { dismissedNotificationIds: dismissedNotifications, now }).length
        : 0;

      return overdueCount + dueSoonCount;
    })();

    setBadgeCount(count);

    if (isBadgeAPIAvailable()) {
      try {
        Promise.resolve((navigator as Navigator & { setAppBadge: (count: number) => Promise<void> }).setAppBadge(count))
          .then(() => logger.debug('App badge set successfully:', count))
          .catch((err: Error) => {
            if (err.name !== 'NotSupportedError' && err.name !== 'TypeError') {
              logger.warn('Failed to set app badge:', err);
            }
          });
      } catch (error) {
        logger.debug('Badge API error:', error);
      }
    }
  }, [tasks, settings, isBadgeAPIAvailable]);

  const syncNativeSchedule = useCallback(async () => {
    await syncScheduledTaskNotifications(tasks, settings, permission);
  }, [tasks, settings, permission]);

  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      saveToLocalStorage(NOTIFICATION_STORAGE_KEYS.settings, updated);

      if (!updated.enabled || !updated.showBadge) {
        setBadgeCount(0);
        if (isBadgeAPIAvailable()) {
          Promise.resolve((navigator as Navigator & { setAppBadge: (count: number) => Promise<void> }).setAppBadge(0)).catch(
            () => undefined,
          );
        }
      }

      return updated;
    });
  }, [isBadgeAPIAvailable]);

  useEffect(() => {
    updateBadge();
  }, [tasks, settings, updateBadge]);

  useEffect(() => {
    void syncNativeSchedule();
  }, [syncNativeSchedule]);

  const checkAndNotify = useCallback(async () => {
    if (!settings.enabled) return;
    if (permission !== 'granted') return;
    if (!user) return;

    const isNative = await isNativeNotificationsAvailable();
    if (!isNative && !('Notification' in window)) return;

    const now = new Date();
    const notifiedTasksArray = getFromLocalStorage<string[]>(NOTIFICATION_STORAGE_KEYS.notifiedTasks, []);
    const notifiedTasks = new Set(notifiedTasksArray);

    let overdueCount = 0;
    let dueSoonCount = 0;

    if (settings.overdueAlerts) {
      const overdueTasks = getOverdueTasks(tasks, { now }).filter(
        task => !notifiedTasks.has(`${NOTIFICATION_TAG_PREFIXES.overdue}${task.id}`),
      );

      overdueCount = overdueTasks.length;

      await Promise.allSettled(
        overdueTasks.map(async (task) => {
          try {
            if (settings.soundEnabled) playDueReminderChime();
            await showNativeNotification(buildOverdueNotificationPayload(task));
            notifiedTasks.add(`${NOTIFICATION_TAG_PREFIXES.overdue}${task.id}`);
          } catch (error) {
            logger.error('Failed to show notification:', error);
            toast.error('Failed to show notification. Please check your notification settings.');
          }
        }),
      );
    }

    if (settings.dueDateReminders) {
      const dueSoonTasks = getDueSoonTasks(tasks, settings.reminderTime, { now }).filter(
        task => !notifiedTasks.has(`${NOTIFICATION_TAG_PREFIXES.reminder}${task.id}`),
      );

      dueSoonCount = dueSoonTasks.length;

      await Promise.allSettled(
        dueSoonTasks.map(async (task) => {
          try {
            if (settings.soundEnabled) playDueReminderChime();
            await showNativeNotification(buildDueSoonNotificationPayload(task, now));
            notifiedTasks.add(`${NOTIFICATION_TAG_PREFIXES.reminder}${task.id}`);
          } catch (error) {
            logger.error('Failed to show notification:', error);
            toast.error('Failed to show notification. Please check your notification settings.');
          }
        }),
      );
    }

    const cleanedTasks = new Set<string>();
    notifiedTasks.forEach(taskKey => {
      const parts = taskKey.split('_');
      if (parts.length >= 2) {
        const taskId = parts.slice(1).join('_');
        const task = tasks.find(t => t.id === taskId);
        if (!task || task.status === 'done' || !isEligibleForTaskNotification(task)) return;
        if (taskKey.startsWith(NOTIFICATION_TAG_PREFIXES.overdue) && !isTaskOverdue(task, now)) return;
        if (taskKey.startsWith(NOTIFICATION_TAG_PREFIXES.reminder) && !isTaskDueSoon(task, settings.reminderTime, now)) {
          return;
        }
        cleanedTasks.add(taskKey);
      }
    });

    saveToLocalStorage(NOTIFICATION_STORAGE_KEYS.notifiedTasks, Array.from(cleanedTasks));

    const totalNotifications = overdueCount + dueSoonCount;
    if (totalNotifications > 0) {
      logger.info(`Notification check complete: ${totalNotifications} notification(s) sent`, {
        overdue: overdueCount,
        dueSoon: dueSoonCount,
      });
    }
  }, [tasks, settings, permission, user]);

  useEffect(() => {
    const timeoutId = setTimeout(() => updateBadge(), TIMING_CONSTANTS.delays.notificationCheck);
    return () => clearTimeout(timeoutId);
  }, [tasks, settings, updateBadge]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if ('requestIdleCallback' in window) {
          (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback(
            () => updateBadge(),
            { timeout: TIMING_CONSTANTS.timeouts.idleCallback },
          );
        } else {
          setTimeout(() => updateBadge(), TIMING_CONSTANTS.delays.badgeUpdateFallback);
        }
      }
    };

    const handleFocus = () => {
      if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback(
          () => updateBadge(),
          { timeout: TIMING_CONSTANTS.timeouts.idleCallback },
        );
      } else {
        setTimeout(() => updateBadge(), TIMING_CONSTANTS.delays.badgeUpdateFallback);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [updateBadge]);

  useEffect(() => {
    if (!settings.enabled || permission !== 'granted' || !user) return;
    const timeoutId = setTimeout(() => checkAndNotify(), NOTIFICATION_INTERVALS.taskUpdateDelay);
    return () => clearTimeout(timeoutId);
  }, [tasks, settings.enabled, permission, user, checkAndNotify]);

  useEffect(() => {
    if (!settings.enabled || permission !== 'granted') return;

    checkAndNotify();
    const interval = setInterval(
      () => checkAndNotify(),
      settings.checkInterval * TIMING_CONSTANTS.timeConversions.minutesToMs,
    );
    return () => clearInterval(interval);
  }, [settings, permission, checkAndNotify]);

  const addToastNotification = useCallback((type: 'success' | 'error' | 'info' | 'warning', title: string, description?: string) => {
    const toastNotifications = getFromLocalStorage<ToastNotification[]>(NOTIFICATION_STORAGE_KEYS.toastNotifications, []);
    const newNotification: ToastNotification = {
      id: `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      description,
      timestamp: new Date().toISOString(),
      read: false,
    };
    const trimmed = [newNotification, ...toastNotifications].slice(0, 100);
    saveToLocalStorage(NOTIFICATION_STORAGE_KEYS.toastNotifications, trimmed);
    updateBadge();
  }, [updateBadge]);

  const getToastNotifications = useCallback((): ToastNotification[] => {
    return getFromLocalStorage<ToastNotification[]>(NOTIFICATION_STORAGE_KEYS.toastNotifications, []);
  }, []);

  const markToastAsRead = useCallback((id: string) => {
    const toastNotifications = getFromLocalStorage<ToastNotification[]>(NOTIFICATION_STORAGE_KEYS.toastNotifications, []);
    saveToLocalStorage(
      NOTIFICATION_STORAGE_KEYS.toastNotifications,
      toastNotifications.map(n => (n.id === id ? { ...n, read: true } : n)),
    );
    updateBadge();
  }, [updateBadge]);

  const clearToastNotification = useCallback((id: string) => {
    const toastNotifications = getFromLocalStorage<ToastNotification[]>(NOTIFICATION_STORAGE_KEYS.toastNotifications, []);
    saveToLocalStorage(
      NOTIFICATION_STORAGE_KEYS.toastNotifications,
      toastNotifications.filter(n => n.id !== id),
    );
    updateBadge();
  }, [updateBadge]);

  return (
    <NotificationContext.Provider
      value={{
        permission,
        settings,
        badgeCount,
        requestPermission,
        updateSettings,
        updateBadge,
        addToastNotification,
        getToastNotifications,
        markToastAsRead,
        clearToastNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    if (import.meta.env.DEV) {
      console.warn('useNotifications called outside NotificationProvider (likely HMR issue), returning default');
      return createDefaultNotificationContext();
    }
    throw new Error(NOTIFICATION_ERRORS.contextError);
  }
  return context;
}
