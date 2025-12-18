import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useTasks } from './TaskContext';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { getFromLocalStorage, saveToLocalStorage } from '../lib/utils';
import { logger } from '../lib/logger';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_STORAGE_KEYS,
  NOTIFICATION_ICONS,
  NOTIFICATION_TOAST_MESSAGES,
  NOTIFICATION_TITLES,
  NOTIFICATION_MESSAGES,
  NOTIFICATION_TAG_PREFIXES,
  NOTIFICATION_ERRORS,
  NOTIFICATION_TIME_FORMATS,
  NOTIFICATION_INTERVALS,
} from '../lib/notification-constants';
import { TIMING_CONSTANTS } from '../lib/timing-constants';
import {
  requestNotificationPermission as requestNativePermission,
  getNotificationPermission as getNativePermission,
  showNotification as showNativeNotification,
  isNativeNotificationsAvailable,
} from '../lib/native-notifications';

interface NotificationSettings {
  enabled: boolean;
  showBadge: boolean;
  dueDateReminders: boolean;
  overdueAlerts: boolean;
  reminderTime: number; // minutes before due date
  checkInterval: number; // minutes between checks
}

interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning' | 'loading';
  title: string;
  description?: string;
  timestamp: string; // ISO string for localStorage compatibility
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
  const [settings, setSettings] = useState<NotificationSettings>(() => 
    getFromLocalStorage<NotificationSettings>(NOTIFICATION_STORAGE_KEYS.settings, DEFAULT_NOTIFICATION_SETTINGS as NotificationSettings)
  );
  const [badgeCount, setBadgeCount] = useState(0);

  // Check notification permission on mount (works for both browser and native)
  useEffect(() => {
    const checkPermission = async () => {
      const currentPermission = await getNativePermission();
      setPermission(currentPermission);
    };
    checkPermission();
  }, []);

  // Request notification permission (works for both browser and native)
  const requestPermission = useCallback(async (): Promise<boolean> => {
    // Check if native notifications are available
    const isNative = await isNativeNotificationsAvailable();
    
    if (!isNative && !('Notification' in window)) {
      toast.error(NOTIFICATION_TOAST_MESSAGES.notSupported);
      return false;
    }

    // Check current permission
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
      } else {
        toast.error(NOTIFICATION_TOAST_MESSAGES.permissionDenied);
        return false;
      }
    } catch (error) {
      logger.error('Error requesting notification permission:', error);
      toast.error(NOTIFICATION_TOAST_MESSAGES.requestFailed);
      return false;
    }
  }, []);

  // Check if Badge API is available and supported
  const isBadgeAPIAvailable = useCallback(() => {
    return (
      'navigator' in window &&
      'setAppBadge' in navigator &&
      typeof (navigator as any).setAppBadge === 'function'
    );
  }, []);

  // Check if app is installed as PWA (standalone mode)
  const isStandalone = useCallback(() => {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  }, []);

  // Update badge count
  const updateBadge = useCallback(() => {
    const count = (() => {
      if (!settings.showBadge) {
        return 0;
      }

      // Get dismissed notifications from localStorage
      const dismissedNotificationsArray = getFromLocalStorage<string[]>(NOTIFICATION_STORAGE_KEYS.dismissedNotifications, []);
      const dismissedNotifications = new Set(dismissedNotificationsArray);

      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      // Check tasks with dueDate OR scheduledDate
      const overdueTasks = tasks.filter(task => {
        if (task.status === 'done') return false;
        
        // Check if notification for this task was dismissed
        const notificationId = `overdue_${task.id}`;
        if (dismissedNotifications.has(notificationId)) return false;
        
        // Check dueDate first
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          if (dueDate < today) return true;
        }
        
        // Check scheduledDate if no dueDate
        if (task.scheduledDate && !task.dueDate) {
          const scheduledDate = new Date(task.scheduledDate);
          scheduledDate.setHours(0, 0, 0, 0);
          if (scheduledDate < today) return true;
        }
        
        return false;
      });

      const dueSoonTasks = tasks.filter(task => {
        if (task.status === 'done') return false;
        
        // Check if notification for this task was dismissed
        const notificationId = `due-soon_${task.id}`;
        if (dismissedNotifications.has(notificationId)) return false;
        
        const reminderTime = new Date(now.getTime() + settings.reminderTime * 60 * 1000);
        
        // Check dueDate first
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          return dueDate >= now && dueDate <= reminderTime;
        }
        
        // Check scheduledDate if no dueDate
        if (task.scheduledDate && !task.dueDate) {
          const scheduledDate = new Date(task.scheduledDate);
          return scheduledDate >= now && scheduledDate <= reminderTime;
        }
        
        return false;
      });

      const overdueCount = settings.overdueAlerts ? overdueTasks.length : 0;
      const dueSoonCount = settings.dueDateReminders ? dueSoonTasks.length : 0;
      const totalCount = overdueCount + dueSoonCount;

      logger.debug('Badge update:', {
        overdueCount,
        dueSoonCount,
        totalCount,
        showBadge: settings.showBadge,
        overdueAlerts: settings.overdueAlerts,
        dueDateReminders: settings.dueDateReminders,
      });

      return totalCount;
    })();
    
    setBadgeCount(count);

    // Update app badge if API is available
    // Badge API works in secure contexts (HTTPS) and doesn't require PWA installation
    // but works better when installed
    if (isBadgeAPIAvailable()) {
      try {
        // Use Promise.resolve to handle both sync and async badge APIs
        const badgePromise = Promise.resolve((navigator as any).setAppBadge(count));
        badgePromise
          .then(() => {
            logger.debug('App badge set successfully:', count);
          })
          .catch((err: Error) => {
            // Only log if it's not a known limitation (e.g., browser doesn't support badges)
            if (err.name !== 'NotSupportedError' && err.name !== 'TypeError') {
              logger.warn('Failed to set app badge:', err);
            } else {
              logger.debug('Badge API not supported:', err.name);
            }
          });
      } catch (error) {
        // Log badge API errors for debugging
        logger.debug('Badge API error:', error);
      }
    } else {
      logger.debug('Badge API not available');
    }
  }, [tasks, settings, isBadgeAPIAvailable]);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      saveToLocalStorage(NOTIFICATION_STORAGE_KEYS.settings, updated);
      
      // If disabling, clear badge
      if (!updated.enabled || !updated.showBadge) {
        setBadgeCount(0);
        if (isBadgeAPIAvailable()) {
          try {
            Promise.resolve((navigator as any).setAppBadge(0))
              .then(() => {
                logger.debug('App badge cleared successfully');
              })
              .catch((err: Error) => {
                logger.debug('Failed to clear app badge:', err);
              });
          } catch (error) {
            logger.debug('Badge API not available:', error);
          }
        }
      } else {
        // Settings changed, update badge
        updateBadge();
      }
      
      return updated;
    });
  }, [isBadgeAPIAvailable, updateBadge]);

  // Check for due/overdue tasks and show notifications
  const checkAndNotify = useCallback(async () => {
    if (!settings.enabled) {
      logger.debug('Notifications disabled, skipping check');
      return;
    }

    if (permission !== 'granted') {
      logger.debug('Notification permission not granted:', permission);
      logger.warn('Notifications enabled but permission not granted. Current permission:', permission);
      return;
    }

    if (!user) {
      logger.debug('No user, skipping notifications');
      return;
    }

    // Verify notification API is available (browser or native)
    const isNative = await isNativeNotificationsAvailable();
    if (!isNative && !('Notification' in window)) {
      logger.error('Notification API not available');
      return;
    }

    const now = new Date();
    const notifiedTasksArray = getFromLocalStorage<string[]>(NOTIFICATION_STORAGE_KEYS.notifiedTasks, []);
    const notifiedTasks = new Set(notifiedTasksArray);

    logger.debug('Checking notifications:', {
      enabled: settings.enabled,
      permission,
      hasUser: !!user,
      totalTasks: tasks.length,
      overdueAlerts: settings.overdueAlerts,
      dueDateReminders: settings.dueDateReminders,
    });

    // Track notification counts
    let overdueCount = 0;
    let dueSoonCount = 0;

    // Check for overdue tasks (check both dueDate and scheduledDate)
    if (settings.overdueAlerts) {
      const overdueTasks = tasks.filter(task => {
        if (task.status === 'done') return false;
        
        let targetDate: Date | null = null;
        
        // Check dueDate first
        if (task.dueDate) {
          targetDate = new Date(task.dueDate);
        } else if (task.scheduledDate) {
          // Check scheduledDate if no dueDate
          targetDate = new Date(task.scheduledDate);
        }
        
        if (!targetDate) return false;
        
        targetDate.setHours(0, 0, 0, 0);
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const isOverdue = targetDate < today;
        const alreadyNotified = notifiedTasks.has(`${NOTIFICATION_TAG_PREFIXES.overdue}${task.id}`);
        return isOverdue && !alreadyNotified;
      });

      logger.debug('Overdue tasks found:', overdueTasks.length);
      overdueCount = overdueTasks.length;

      // Use Promise.allSettled to handle all notifications in parallel
      await Promise.allSettled(
        overdueTasks.map(async (task) => {
        try {
          // Use dueDate if available, otherwise use scheduledDate
          const dateToUse = task.dueDate || task.scheduledDate;
          const dateText = dateToUse ? new Date(dateToUse).toLocaleDateString() : '';
            
            await showNativeNotification({
              title: NOTIFICATION_TITLES.taskOverdue,
            body: NOTIFICATION_MESSAGES.taskWasDue(task.title, dateText),
            tag: `${NOTIFICATION_TAG_PREFIXES.overdue}${task.id}`,
            requireInteraction: false,
              data: { taskId: task.id, type: 'overdue' },
            });
          
          logger.debug('Notification sent for overdue task:', task.id, task.title);
          notifiedTasks.add(`${NOTIFICATION_TAG_PREFIXES.overdue}${task.id}`);
        } catch (error) {
          logger.error('Failed to show notification:', error);
            toast.error('Failed to show notification. Please check your notification settings.');
        }
        })
      );
    }

    // Check for tasks due soon (check both dueDate and scheduledDate)
    if (settings.dueDateReminders) {
      const reminderTime = new Date(now.getTime() + settings.reminderTime * 60 * 1000);
      
      const dueSoonTasks = tasks.filter(task => {
        if (task.status === 'done') return false;
        
        let targetDate: Date | null = null;
        
        // Check dueDate first
        if (task.dueDate) {
          targetDate = new Date(task.dueDate);
        } else if (task.scheduledDate) {
          // Check scheduledDate if no dueDate
          targetDate = new Date(task.scheduledDate);
        }
        
        if (!targetDate) return false;
        
        const isDueSoon = targetDate >= now && targetDate <= reminderTime;
        const alreadyNotified = notifiedTasks.has(`${NOTIFICATION_TAG_PREFIXES.reminder}${task.id}`);
        return isDueSoon && !alreadyNotified;
      });

      logger.debug('Due soon tasks found:', dueSoonTasks.length);
      dueSoonCount = dueSoonTasks.length;

      // Use Promise.allSettled to handle all notifications in parallel
      await Promise.allSettled(
        dueSoonTasks.map(async (task) => {
        try {
          // Use dueDate if available, otherwise use scheduledDate
          const dateToUse = task.dueDate || task.scheduledDate;
          if (!dateToUse) return;
          
          const targetDate = new Date(dateToUse);
          const timeUntil = Math.round((targetDate.getTime() - now.getTime()) / (1000 * 60));
          
          // Distinguish between "due now" (within 5 minutes) and "upcoming" (more than 5 minutes away)
          const isDueNow = timeUntil <= 5;
          const timeText = timeUntil < NOTIFICATION_TIME_FORMATS.minutesThreshold 
            ? NOTIFICATION_MESSAGES.timeMinutes(timeUntil)
            : NOTIFICATION_MESSAGES.timeHours(Math.round(timeUntil / 60));
          
            await showNativeNotification({
              title: isDueNow ? NOTIFICATION_TITLES.taskDueNow : NOTIFICATION_TITLES.taskUpcoming,
              body: isDueNow 
                ? NOTIFICATION_MESSAGES.taskDueNow(task.title)
                : NOTIFICATION_MESSAGES.taskUpcoming(task.title, timeText),
              tag: `${NOTIFICATION_TAG_PREFIXES.reminder}${task.id}`,
              requireInteraction: isDueNow, // Require interaction for tasks due now
              data: { taskId: task.id, type: isDueNow ? 'dueNow' : 'upcoming' },
            });
          
          logger.debug('Notification sent for due soon task:', task.id, task.title, isDueNow ? 'due now' : timeText);
          notifiedTasks.add(`${NOTIFICATION_TAG_PREFIXES.reminder}${task.id}`);
        } catch (error) {
          logger.error('Failed to show notification:', error);
            toast.error('Failed to show notification. Please check your notification settings.');
        }
        })
      );
    }

    // Clean up old notifications (older than 24 hours or for completed tasks)
    const cleanedTasks = new Set<string>();
    notifiedTasks.forEach(taskKey => {
      const parts = taskKey.split('_');
      if (parts.length >= 2) {
        const taskId = parts.slice(1).join('_');
        const task = tasks.find(t => t.id === taskId);
        
        // Remove if task is completed or doesn't exist
        if (!task || task.status === 'done') {
          return; // Don't add to cleanedTasks (removes it)
        }
        
        // Keep if task still exists and is not done (check both dueDate and scheduledDate)
        if (task && (task.dueDate || task.scheduledDate)) {
          cleanedTasks.add(taskKey);
        }
      }
    });

    saveToLocalStorage(NOTIFICATION_STORAGE_KEYS.notifiedTasks, Array.from(cleanedTasks));
    
    // Log summary
    const totalNotifications = overdueCount + dueSoonCount;
    if (totalNotifications > 0) {
      logger.info(`Notification check complete: ${totalNotifications} notification(s) sent`, {
        overdue: overdueCount,
        dueSoon: dueSoonCount,
      });
    } else {
      logger.debug('Notification check complete: No notifications needed');
    }
  }, [tasks, settings, permission, user]);

  // Update badge when tasks or settings change
  useEffect(() => {
    // Small delay to ensure task status updates are complete
    const timeoutId = setTimeout(() => {
      updateBadge();
    }, TIMING_CONSTANTS.delays.notificationCheck);
    
    return () => clearTimeout(timeoutId);
  }, [tasks, settings, updateBadge]);

  // Update badge when app becomes visible (handles tab switching, app focus)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // App became visible, update badge
        updateBadge();
      }
    };

    const handleFocus = () => {
      // App gained focus, update badge
      updateBadge();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [updateBadge]);

  // Check for notifications when tasks change (in addition to periodic checks)
  useEffect(() => {
    if (!settings.enabled || permission !== 'granted' || !user) return;
    
    // Trigger notification check when tasks change
    // This ensures immediate notifications when tasks are added/updated
    // Use a small delay to batch multiple task updates
    const timeoutId = setTimeout(() => {
      checkAndNotify();
    }, NOTIFICATION_INTERVALS.taskUpdateDelay);
    
    return () => clearTimeout(timeoutId);
  }, [tasks, settings.enabled, permission, user, checkAndNotify]);

  // Periodic check for notifications
  useEffect(() => {
    if (!settings.enabled || permission !== 'granted') return;

    // Initial check
    checkAndNotify();

    // Set up interval
    const interval = setInterval(() => {
      checkAndNotify();
    }, settings.checkInterval * TIMING_CONSTANTS.timeConversions.minutesToMs);

    return () => clearInterval(interval);
  }, [settings, permission, checkAndNotify]);

  // Toast notification management
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
    
    // Add to beginning of array (newest first)
    const updated = [newNotification, ...toastNotifications];
    
    // Keep only last 100 notifications to prevent storage bloat
    const trimmed = updated.slice(0, 100);
    
    saveToLocalStorage(NOTIFICATION_STORAGE_KEYS.toastNotifications, trimmed);
    updateBadge(); // Update badge count
  }, [updateBadge]);

  const getToastNotifications = useCallback((): ToastNotification[] => {
    return getFromLocalStorage<ToastNotification[]>(NOTIFICATION_STORAGE_KEYS.toastNotifications, []);
  }, []);

  const markToastAsRead = useCallback((id: string) => {
    const toastNotifications = getFromLocalStorage<ToastNotification[]>(NOTIFICATION_STORAGE_KEYS.toastNotifications, []);
    const updated = toastNotifications.map(n => n.id === id ? { ...n, read: true } : n);
    saveToLocalStorage(NOTIFICATION_STORAGE_KEYS.toastNotifications, updated);
    updateBadge(); // Update badge count
  }, [updateBadge]);

  const clearToastNotification = useCallback((id: string) => {
    const toastNotifications = getFromLocalStorage<ToastNotification[]>(NOTIFICATION_STORAGE_KEYS.toastNotifications, []);
    const updated = toastNotifications.filter(n => n.id !== id);
    saveToLocalStorage(NOTIFICATION_STORAGE_KEYS.toastNotifications, updated);
    updateBadge(); // Update badge count
  }, [updateBadge]);

  // Don't auto-request - wait for user interaction
  // Permission will be requested when user clicks "Enable Notifications" button

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
    throw new Error(NOTIFICATION_ERRORS.contextError);
  }
  return context;
}

