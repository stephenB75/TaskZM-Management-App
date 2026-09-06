/**
 * Capacitor Push Notifications — APNs (iOS) / FCM (Android) registration and tap handling.
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { MOBILE_STORAGE_KEYS } from './mobile-constants';
import { NOTIFICATION_OPEN_TASK_EVENT } from './notification-constants';
import { getFromLocalStorage, saveToLocalStorage } from './utils';
import { logger } from './logger';

let pushHandlersRegistered = false;

export function isPushNotificationsPreferenceEnabled(): boolean {
  return getFromLocalStorage<boolean>(MOBILE_STORAGE_KEYS.pushNotificationsEnabled, true);
}

export function setPushNotificationsPreferenceEnabled(enabled: boolean): void {
  saveToLocalStorage(MOBILE_STORAGE_KEYS.pushNotificationsEnabled, enabled);
}

export function getStoredPushDeviceToken(): string | null {
  return getFromLocalStorage<string | null>(MOBILE_STORAGE_KEYS.pushDeviceToken, null);
}

function dispatchOpenTaskFromPush(taskId?: string): void {
  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_OPEN_TASK_EVENT, {
      detail: taskId ? { taskId } : {},
    }),
  );
}

function extractTaskIdFromPushData(data: Record<string, unknown> | undefined): string | undefined {
  if (!data) return undefined;
  const taskId = data.taskId ?? data.task_id;
  return typeof taskId === 'string' && taskId.length > 0 ? taskId : undefined;
}

/** Register push listeners and request permission (native only). */
export async function initNativePushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform() || pushHandlersRegistered) return;
  pushHandlersRegistered = true;

  await PushNotifications.addListener('registration', (token) => {
    saveToLocalStorage(MOBILE_STORAGE_KEYS.pushDeviceToken, token.value);
    logger.info('[Native] Push registration token received');
  });

  await PushNotifications.addListener('registrationError', (error) => {
    logger.warn('[Native] Push registration error', error);
  });

  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    logger.debug('[Native] Push notification received in foreground', notification.title);
  });

  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const taskId = extractTaskIdFromPushData(
      action.notification.data as Record<string, unknown> | undefined,
    );
    dispatchOpenTaskFromPush(taskId);
  });

  if (isPushNotificationsPreferenceEnabled()) {
    await registerForPushNotifications();
  }
}

export async function registerForPushNotifications(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    let permissions = await PushNotifications.checkPermissions();
    if (permissions.receive === 'prompt') {
      permissions = await PushNotifications.requestPermissions();
    }

    if (permissions.receive !== 'granted') {
      return false;
    }

    await PushNotifications.register();
    return true;
  } catch (error) {
    logger.warn('[Native] Push register failed', error);
    return false;
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await PushNotifications.removeAllListeners();
    pushHandlersRegistered = false;
    saveToLocalStorage(MOBILE_STORAGE_KEYS.pushDeviceToken, null);
  } catch (error) {
    logger.warn('[Native] Push unregister failed', error);
  }
}

export async function setPushNotificationsEnabled(enabled: boolean): Promise<boolean> {
  setPushNotificationsPreferenceEnabled(enabled);

  if (!Capacitor.isNativePlatform()) return false;

  if (!enabled) {
    saveToLocalStorage(MOBILE_STORAGE_KEYS.pushDeviceToken, null);
    return true;
  }

  if (!pushHandlersRegistered) {
    await initNativePushNotifications();
  }
  return registerForPushNotifications();
}
