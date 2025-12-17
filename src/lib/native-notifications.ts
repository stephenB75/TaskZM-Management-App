/**
 * Native Notification Helper
 * Provides unified interface for browser and native (iOS/Android) notifications
 */

import { getPlatform } from './platform';
import { logger } from './logger';
import { NOTIFICATION_TITLES, NOTIFICATION_MESSAGES, NOTIFICATION_ICONS } from './notification-constants';

interface NotificationOptions {
  title: string;
  body: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: any;
}

/**
 * Check if native notifications are available (Capacitor Local Notifications)
 */
export async function isNativeNotificationsAvailable(): Promise<boolean> {
  const platform = getPlatform();
  if (!platform.isNative) return false;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    return !!LocalNotifications;
  } catch (error) {
    logger.debug('Local Notifications plugin not available:', error);
    return false;
  }
}

/**
 * Request notification permission (works for both browser and native)
 */
export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'default'> {
  const platform = getPlatform();

  // Native platforms (iOS/Android)
  if (platform.isNative) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const result = await LocalNotifications.requestPermissions();
      
      if (result.display === 'granted') {
        return 'granted';
      } else if (result.display === 'denied') {
        return 'denied';
      }
      return 'default';
    } catch (error) {
      logger.error('Error requesting native notification permission:', error);
      return 'default';
    }
  }

  // Web/PWA - use browser Notification API
  if (!('Notification' in window)) {
    return 'default';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  try {
    const result = await Notification.requestPermission();
    return result as 'granted' | 'denied' | 'default';
  } catch (error) {
    logger.error('Error requesting browser notification permission:', error);
    return 'default';
  }
}

/**
 * Check current notification permission status
 */
export async function getNotificationPermission(): Promise<'granted' | 'denied' | 'default'> {
  const platform = getPlatform();

  // Native platforms
  if (platform.isNative) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const result = await LocalNotifications.checkPermissions();
      return result.display as 'granted' | 'denied' | 'default';
    } catch (error) {
      logger.debug('Could not check native notification permission:', error);
      return 'default';
    }
  }

  // Web/PWA
  if (!('Notification' in window)) {
    return 'default';
  }

  return Notification.permission as 'granted' | 'denied' | 'default';
}

/**
 * Show a notification (uses native on iOS/Android, browser on web)
 */
export async function showNotification(options: NotificationOptions): Promise<void> {
  const platform = getPlatform();

  // Native platforms (iOS/Android)
  if (platform.isNative) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      // Generate unique ID for the notification
      const notificationId = Date.now();
      
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: options.title,
            body: options.body,
            sound: 'default',
            attachments: undefined,
            actionTypeId: '',
            extra: options.data || {},
            // iOS specific
            ...(platform.isIOS && {
              summary: options.title,
            }),
            // Android specific
            ...(platform.isAndroid && {
              smallIcon: 'ic_stat_icon_config_sample',
              iconColor: '#9D87C3', // App theme color
            }),
          },
        ],
      });

      logger.debug('Native notification sent:', options.title);
    } catch (error) {
      logger.error('Failed to show native notification:', error);
      throw error;
    }
    return;
  }

  // Web/PWA - use browser Notification API
  if (!('Notification' in window)) {
    throw new Error('Notifications are not supported in this browser');
  }

  if (Notification.permission !== 'granted') {
    throw new Error('Notification permission not granted');
  }

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: NOTIFICATION_ICONS.default,
      badge: NOTIFICATION_ICONS.badge,
      tag: options.tag,
      requireInteraction: options.requireInteraction || false,
      data: options.data,
    });

    // Handle notification click - focus the app window
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    logger.debug('Browser notification sent:', options.title);
  } catch (error) {
    logger.error('Failed to show browser notification:', error);
    throw error;
  }
}

/**
 * Cancel a notification by tag (web) or ID (native)
 */
export async function cancelNotification(tagOrId: string | number): Promise<void> {
  const platform = getPlatform();

  if (platform.isNative) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.cancel({
        notifications: [{ id: Number(tagOrId) }],
      });
    } catch (error) {
      logger.debug('Could not cancel native notification:', error);
    }
  } else {
    // Browser notifications are automatically managed by the browser
    // We can't programmatically cancel them by tag
    logger.debug('Browser notifications cannot be cancelled programmatically');
  }
}

/**
 * Cancel all notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  const platform = getPlatform();

  if (platform.isNative) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.cancelAll();
    } catch (error) {
      logger.debug('Could not cancel all native notifications:', error);
    }
  } else {
    // Browser notifications are automatically managed
    logger.debug('Browser notifications cannot be cancelled programmatically');
  }
}
