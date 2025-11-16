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

interface NotificationSettings {
  enabled: boolean;
  showBadge: boolean;
  dueDateReminders: boolean;
  overdueAlerts: boolean;
  reminderTime: number; // minutes before due date
  checkInterval: number; // minutes between checks
}

interface NotificationContextType {
  permission: NotificationPermission;
  settings: NotificationSettings;
  badgeCount: number;
  requestPermission: () => Promise<boolean>;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  updateBadge: () => void;
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

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      toast.error(NOTIFICATION_TOAST_MESSAGES.notSupported);
      return false;
    }

    if (Notification.permission === 'granted') {
      setPermission('granted');
      return true;
    }

    if (Notification.permission === 'denied') {
      toast.error(NOTIFICATION_TOAST_MESSAGES.blocked);
      setPermission('denied');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
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

      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      const overdueTasks = tasks.filter(task => {
        if (task.status === 'done' || !task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < today;
      });

      const dueSoonTasks = tasks.filter(task => {
        if (task.status === 'done' || !task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        const reminderTime = new Date(now.getTime() + settings.reminderTime * 60 * 1000);
        return dueDate >= now && dueDate <= reminderTime;
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
        const badgePromise = (navigator as any).setAppBadge(count);
        if (badgePromise && typeof badgePromise.catch === 'function') {
          badgePromise.catch((err: Error) => {
            // Only log if it's not a known limitation (e.g., browser doesn't support badges)
            if (err.name !== 'NotSupportedError' && err.name !== 'TypeError') {
              logger.warn('Failed to set app badge:', err);
            }
          });
        } else {
          logger.debug('App badge set successfully:', count);
        }
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
            (navigator as any).setAppBadge(0).catch((err: Error) => {
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
  const checkAndNotify = useCallback(() => {
    if (!settings.enabled) {
      logger.debug('Notifications disabled, skipping check');
      return;
    }

    if (permission !== 'granted') {
      logger.debug('Notification permission not granted:', permission);
      return;
    }

    if (!user) {
      logger.debug('No user, skipping notifications');
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

    // Check for overdue tasks
    if (settings.overdueAlerts) {
      const overdueTasks = tasks.filter(task => {
        if (task.status === 'done' || !task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const isOverdue = dueDate < today;
        const alreadyNotified = notifiedTasks.has(`${NOTIFICATION_TAG_PREFIXES.overdue}${task.id}`);
        return isOverdue && !alreadyNotified;
      });

      logger.debug('Overdue tasks found:', overdueTasks.length);

      overdueTasks.forEach(task => {
        try {
          const dueDateText = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '';
          const notification = new Notification(NOTIFICATION_TITLES.taskOverdue, {
            body: NOTIFICATION_MESSAGES.taskWasDue(task.title, dueDateText),
            icon: NOTIFICATION_ICONS.default,
            badge: NOTIFICATION_ICONS.badge,
            tag: `${NOTIFICATION_TAG_PREFIXES.overdue}${task.id}`,
            requireInteraction: false,
          });
          
          logger.debug('Notification sent for overdue task:', task.id, task.title);
          notifiedTasks.add(`${NOTIFICATION_TAG_PREFIXES.overdue}${task.id}`);
        } catch (error) {
          logger.error('Failed to show notification:', error);
        }
      });
    }

    // Check for tasks due soon
    if (settings.dueDateReminders) {
      const reminderTime = new Date(now.getTime() + settings.reminderTime * 60 * 1000);
      
      const dueSoonTasks = tasks.filter(task => {
        if (task.status === 'done' || !task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        const isDueSoon = dueDate >= now && dueDate <= reminderTime;
        const alreadyNotified = notifiedTasks.has(`${NOTIFICATION_TAG_PREFIXES.reminder}${task.id}`);
        return isDueSoon && !alreadyNotified;
      });

      logger.debug('Due soon tasks found:', dueSoonTasks.length);

      dueSoonTasks.forEach(task => {
        try {
          const dueDate = new Date(task.dueDate!);
          const timeUntil = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60));
          const timeText = timeUntil < NOTIFICATION_TIME_FORMATS.minutesThreshold 
            ? NOTIFICATION_MESSAGES.timeMinutes(timeUntil)
            : NOTIFICATION_MESSAGES.timeHours(Math.round(timeUntil / 60));
          
          const notification = new Notification(NOTIFICATION_TITLES.taskDueSoon, {
            body: NOTIFICATION_MESSAGES.taskDueIn(task.title, timeText),
            icon: NOTIFICATION_ICONS.default,
            badge: NOTIFICATION_ICONS.badge,
            tag: `${NOTIFICATION_TAG_PREFIXES.reminder}${task.id}`,
            requireInteraction: false,
          });
          
          logger.debug('Notification sent for due soon task:', task.id, task.title, timeText);
          notifiedTasks.add(`${NOTIFICATION_TAG_PREFIXES.reminder}${task.id}`);
        } catch (error) {
          logger.error('Failed to show notification:', error);
        }
      });
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
        
        // Keep if task still exists and is not done
        if (task && task.dueDate) {
          cleanedTasks.add(taskKey);
        }
      }
    });

    saveToLocalStorage(NOTIFICATION_STORAGE_KEYS.notifiedTasks, Array.from(cleanedTasks));
  }, [tasks, settings, permission, user]);

  // Update badge when tasks or settings change
  useEffect(() => {
    updateBadge();
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
    }, settings.checkInterval * 60 * 1000);

    return () => clearInterval(interval);
  }, [settings, permission, checkAndNotify]);

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

