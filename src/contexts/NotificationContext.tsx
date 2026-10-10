import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useTasks } from './TaskContext';
import { useAuth } from './AuthContext';
import { toast } from '../lib/toast-wrapper';
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
  NOTIFICATION_FOREGROUND_DELIVERED_EVENT,
  NATIVE_PLUGINS_READY_EVENT,
  type NotificationSettings,
} from '../lib/notification-constants';
import { getUnreadAwardCount } from '../lib/achievement-notifications';
import { TIMING_CONSTANTS } from '../lib/timing-constants';
import { createDefaultNotificationContext } from '../lib/context-defaults';
import {
  requestNotificationPermission as requestNativePermission,
  getNotificationPermission as getNativePermission,
  getWebNotificationPermission,
  showNotification as showNativeNotification,
  isNativeNotificationsAvailable,
  syncScheduledTaskNotifications,
  buildOverdueNotificationPayload,
  buildDueSoonNotificationPayload,
  getOverdueTasks,
  getDueSoonTasks,
} from '../lib/native-notifications';
import {
  syncWebScheduledTaskNotifications,
  clearWebScheduledTaskNotifications,
} from '../lib/web-scheduled-notifications';
import { getPlatform } from '../lib/platform';
import { syncPushRegistration } from '../lib/native-push-notifications';
import { isAppIconBadgeSupported, setAppIconBadgeCount, flushPendingAppIconBadgeCount } from '../lib/app-icon-badge';
import { isAppInForeground } from '../lib/app-visibility';
import { isEligibleForTaskDueReminder, isEligibleForTaskOverdueAlert, isTaskOverdue, isTaskDueSoon, pruneStaleTaskNotificationKeys } from '../lib/notification-task-filters';

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
  refreshPermission: () => Promise<NotificationPermission>;
  enableNotifications: () => Promise<boolean>;
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
      achievementCelebrations:
        stored.achievementCelebrations ?? DEFAULT_NOTIFICATION_SETTINGS.achievementCelebrations,
      achievementHaptics:
        stored.achievementHaptics ?? DEFAULT_NOTIFICATION_SETTINGS.achievementHaptics,
      achievementBackgroundAlerts:
        stored.achievementBackgroundAlerts ?? DEFAULT_NOTIFICATION_SETTINGS.achievementBackgroundAlerts,
      includeAchievementsInBadge:
        stored.includeAchievementsInBadge ?? DEFAULT_NOTIFICATION_SETTINGS.includeAchievementsInBadge,
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

  const refreshPermission = useCallback(async (): Promise<NotificationPermission> => {
    const currentPermission = await getNativePermission();
    setPermission(currentPermission);
    return currentPermission;
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const platform = getPlatform();

    if (!platform.isNative && !('Notification' in window)) {
      toast.error(NOTIFICATION_TOAST_MESSAGES.notSupported);
      return false;
    }

    if (!platform.isNative) {
      const syncPermission = getWebNotificationPermission();
      if (syncPermission === 'granted') {
        setPermission('granted');
        return true;
      }
      if (syncPermission === 'denied') {
        toast.error(NOTIFICATION_TOAST_MESSAGES.blocked);
        setPermission('denied');
        return false;
      }
    }

    try {
      const result = await requestNativePermission();
      setPermission(result);

      if (result === 'granted') {
        toast.success(NOTIFICATION_TOAST_MESSAGES.enabled);
        return true;
      }
      if (result === 'denied') {
        toast.error(NOTIFICATION_TOAST_MESSAGES.blocked);
      } else {
        toast.error(NOTIFICATION_TOAST_MESSAGES.permissionDenied);
      }
      return false;
    } catch (error) {
      logger.error('Error requesting notification permission:', error);
      toast.error(NOTIFICATION_TOAST_MESSAGES.requestFailed);
      return false;
    }
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
      const unreadAwardCount =
        settings.includeAchievementsInBadge ? getUnreadAwardCount(user?.id) : 0;

      return overdueCount + dueSoonCount + unreadAwardCount;
    })();

    setBadgeCount(count);

    if (isAppIconBadgeSupported()) {
      void setAppIconBadgeCount(count);
    }
  }, [tasks, settings, user]);

  const syncTaskSchedules = useCallback(async () => {
    await syncScheduledTaskNotifications(tasks, settings, permission);
    syncWebScheduledTaskNotifications(tasks, settings, permission);
  }, [tasks, settings, permission]);

  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      saveToLocalStorage(NOTIFICATION_STORAGE_KEYS.settings, updated);

      if (!updated.enabled || !updated.showBadge) {
        setBadgeCount(0);
        if (isAppIconBadgeSupported()) {
          void setAppIconBadgeCount(0);
        }
      }

      return updated;
    });
  }, []);

  const enableNotifications = useCallback(async (): Promise<boolean> => {
    const granted = await requestPermission();
    if (granted) {
      updateSettings({ enabled: true });
      return true;
    }
    return false;
  }, [requestPermission, updateSettings]);

  useEffect(() => {
    updateBadge();
  }, [tasks, settings, updateBadge]);

  useEffect(() => {
    const dismissed = getFromLocalStorage<string[]>(NOTIFICATION_STORAGE_KEYS.dismissedNotifications, []);
    const notified = getFromLocalStorage<string[]>(NOTIFICATION_STORAGE_KEYS.notifiedTasks, []);
    const prunedDismissed = pruneStaleTaskNotificationKeys(dismissed, tasks);
    const prunedNotified = pruneStaleTaskNotificationKeys(notified, tasks);
    if (prunedDismissed.length !== dismissed.length) {
      saveToLocalStorage(NOTIFICATION_STORAGE_KEYS.dismissedNotifications, prunedDismissed);
    }
    if (prunedNotified.length !== notified.length) {
      saveToLocalStorage(NOTIFICATION_STORAGE_KEYS.notifiedTasks, prunedNotified);
    }
  }, [tasks]);

  useEffect(() => {
    void syncTaskSchedules();
    return () => {
      clearWebScheduledTaskNotifications();
    };
  }, [syncTaskSchedules]);

  const syncTaskSchedulesRef = useRef(syncTaskSchedules);
  syncTaskSchedulesRef.current = syncTaskSchedules;

  useEffect(() => {
    if (!user?.id) return;
    void syncPushRegistration({
      enabled: settings.enabled,
      dueDateReminders: settings.dueDateReminders,
      overdueAlerts: settings.overdueAlerts,
      reminderTime: settings.reminderTime,
    }).then(() => syncTaskSchedulesRef.current());
  }, [user?.id, settings.enabled, settings.dueDateReminders, settings.overdueAlerts, settings.reminderTime]);

  useEffect(() => {
    const handleNativePluginsReady = () => {
      flushPendingAppIconBadgeCount();
      updateBadge();
      if (permission === 'granted') {
        void syncTaskSchedules();
      }
    };

    window.addEventListener(NATIVE_PLUGINS_READY_EVENT, handleNativePluginsReady);
    return () => {
      window.removeEventListener(NATIVE_PLUGINS_READY_EVENT, handleNativePluginsReady);
    };
  }, [permission, syncTaskSchedules, updateBadge]);

  useEffect(() => {
    const handleForegroundNativeDelivery = (event: Event) => {
      const { title, body, variant } = (event as CustomEvent<{ title: string; body: string; variant: 'overdue' | 'reminder' }>).detail;
      if (!settings.enabled) return;
      if (getPlatform().isNative) return;
      if (settings.soundEnabled) playDueReminderChime();
      if (variant === 'overdue') {
        toast.warning(title, { description: body });
      } else {
        toast.info(title, { description: body });
      }
    };

    window.addEventListener(NOTIFICATION_FOREGROUND_DELIVERED_EVENT, handleForegroundNativeDelivery);
    return () => {
      window.removeEventListener(NOTIFICATION_FOREGROUND_DELIVERED_EVENT, handleForegroundNativeDelivery);
    };
  }, [settings.enabled, settings.soundEnabled]);

  const deliverTaskAlert = useCallback(
    async (payload: ReturnType<typeof buildOverdueNotificationPayload>, variant: 'overdue' | 'reminder') => {
      if (settings.soundEnabled) playDueReminderChime();

      if (getPlatform().isNative || !isAppInForeground()) {
        await showNativeNotification(payload);
        return;
      }

      if (variant === 'overdue') {
        toast.warning(payload.title, { description: payload.body });
      } else {
        toast.info(payload.title, { description: payload.body });
      }
    },
    [settings.soundEnabled],
  );

  const checkAndNotify = useCallback(async () => {
    if (!settings.enabled) return;
    if (!user) return;

    const inForeground = isAppInForeground();
    const isNative = await isNativeNotificationsAvailable();

    // Background/system delivery requires OS permission; in-app toasts do not.
    if (!inForeground) {
      if (permission !== 'granted') return;
      if (!isNative && !('Notification' in window)) return;
    }

    const now = new Date();
    const notifiedTasksArray = getFromLocalStorage<string[]>(NOTIFICATION_STORAGE_KEYS.notifiedTasks, []);
    const notifiedTasks = new Set(notifiedTasksArray);
    const dismissedNotificationsArray = getFromLocalStorage<string[]>(
      NOTIFICATION_STORAGE_KEYS.dismissedNotifications,
      [],
    );
    const dismissedNotifications = new Set(dismissedNotificationsArray);

    let overdueCount = 0;
    let dueSoonCount = 0;

    if (settings.overdueAlerts) {
      const overdueTasks = getOverdueTasks(tasks, { dismissedNotificationIds: dismissedNotifications, now }).filter(
        task => !notifiedTasks.has(`${NOTIFICATION_TAG_PREFIXES.overdue}${task.id}`),
      );

      overdueCount = overdueTasks.length;

      await Promise.allSettled(
        overdueTasks.map(async (task) => {
          try {
            await deliverTaskAlert(buildOverdueNotificationPayload(task), 'overdue');
            notifiedTasks.add(`${NOTIFICATION_TAG_PREFIXES.overdue}${task.id}`);
          } catch (error) {
            logger.error('Failed to show notification:', error);
            toast.error('Failed to show notification. Please check your notification settings.');
          }
        }),
      );
    }

    if (settings.dueDateReminders) {
      const dueSoonTasks = getDueSoonTasks(tasks, settings.reminderTime, {
        dismissedNotificationIds: dismissedNotifications,
        now,
      }).filter(
        task => !notifiedTasks.has(`${NOTIFICATION_TAG_PREFIXES.reminder}${task.id}`),
      );

      dueSoonCount = dueSoonTasks.length;

      await Promise.allSettled(
        dueSoonTasks.map(async (task) => {
          try {
            await deliverTaskAlert(buildDueSoonNotificationPayload(task, now), 'reminder');
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
        if (!task || task.status === 'done') return;
        if (taskKey.startsWith(NOTIFICATION_TAG_PREFIXES.overdue) && !isEligibleForTaskOverdueAlert(task)) return;
        if (taskKey.startsWith(NOTIFICATION_TAG_PREFIXES.reminder) && !isEligibleForTaskDueReminder(task)) return;
        if (dismissedNotifications.has(`overdue_${taskId}`) || dismissedNotifications.has(`due-soon_${taskId}`)) {
          return;
        }
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
  }, [tasks, settings, permission, user, deliverTaskAlert]);

  useEffect(() => {
    const timeoutId = setTimeout(() => updateBadge(), TIMING_CONSTANTS.delays.notificationCheck);
    return () => clearTimeout(timeoutId);
  }, [tasks, settings, updateBadge]);

  useEffect(() => {
    const refreshOnResume = () => {
      const run = async () => {
        const currentPermission = await refreshPermission();
        updateBadge();
        if (currentPermission === 'granted') {
          await syncTaskSchedules();
        }
      };
      if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback(
          () => {
            void run();
          },
          { timeout: TIMING_CONSTANTS.timeouts.idleCallback },
        );
      } else {
        setTimeout(() => {
          void run();
        }, TIMING_CONSTANTS.delays.badgeUpdateFallback);
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshOnResume();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', refreshOnResume);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', refreshOnResume);
    };
  }, [refreshPermission, updateBadge, syncTaskSchedules]);

  useEffect(() => {
    if (!user || !settings.enabled) return;
    if (permission !== 'default') return;

    const platform = getPlatform();

    if (platform.isNative) {
      void requestPermission().then((granted) => {
        if (granted) {
          void syncTaskSchedules();
        }
      });
      return;
    }

    const promptShown = getFromLocalStorage<boolean>(
      NOTIFICATION_STORAGE_KEYS.taskSystemAlertsPermissionPromptShown,
      false,
    );
    if (promptShown) return;

    saveToLocalStorage(NOTIFICATION_STORAGE_KEYS.taskSystemAlertsPermissionPromptShown, true);

    toast.info(NOTIFICATION_TOAST_MESSAGES.taskSystemAlertsPrompt, {
      duration: TIMING_CONSTANTS.timeouts.notificationDueNow,
      action: {
        label: NOTIFICATION_TOAST_MESSAGES.taskSystemAlertsEnable,
        onClick: () => {
          void requestPermission().then((granted) => {
            if (granted) {
              void syncTaskSchedules();
            }
          });
        },
      },
    });
  }, [user, settings.enabled, permission, requestPermission, syncTaskSchedules]);

  useEffect(() => {
    if (!settings.enabled || !user) return;
    const timeoutId = setTimeout(() => checkAndNotify(), NOTIFICATION_INTERVALS.taskUpdateDelay);
    return () => clearTimeout(timeoutId);
  }, [tasks, settings.enabled, permission, user, checkAndNotify]);

  useEffect(() => {
    if (!settings.enabled || !user) return;

    if (permission === 'granted') {
      checkAndNotify();
      const interval = setInterval(
        () => checkAndNotify(),
        NOTIFICATION_INTERVALS.defaultCheckInterval,
      );
      return () => clearInterval(interval);
    }

    if (!isAppInForeground()) return;

    checkAndNotify();
    const interval = setInterval(
      () => checkAndNotify(),
      NOTIFICATION_INTERVALS.defaultCheckInterval,
    );
    return () => clearInterval(interval);
  }, [settings, permission, user, checkAndNotify]);

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
        refreshPermission,
        enableNotifications,
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
