/**
 * Capacitor Push Notifications — APNs (iOS) / FCM (Android) registration and tap handling.
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { MOBILE_STORAGE_KEYS } from './mobile-constants';
import { NOTIFICATION_OPEN_TASK_EVENT, IOS_APNS_KEY_ID } from './notification-constants';
import { getFromLocalStorage, saveToLocalStorage } from './utils';
import { logger } from './logger';
import { getPlatform } from './platform';
import {
  registerPushDeviceToken,
  unregisterPushDeviceToken,
  type PushRegistrationPreferences,
} from './api';

let pushHandlersRegistered = false;
let latestPushPreferences: PushRegistrationPreferences | null = null;

/** True when the server confirmed it delivers due-soon/overdue alerts to this device. */
export function isServerPushRemindersActive(): boolean {
  return getFromLocalStorage<boolean>(MOBILE_STORAGE_KEYS.pushServerReminders, false);
}

/**
 * Upload this device's APNs token with current reminder preferences and timezone.
 * Safe to call repeatedly (login, settings change, new token); no-ops until both are known.
 */
export async function syncPushRegistration(preferences?: PushRegistrationPreferences): Promise<void> {
  if (preferences) latestPushPreferences = preferences;
  const platform = getPlatform();
  if (!platform.isNative || !platform.isIOS) return;

  if (!latestPushPreferences || !isPushNotificationsPreferenceEnabled()) return;

  const token = getStoredPushDeviceToken();
  if (!token) {
    // Logout clears the cached token; re-registering fires the 'registration' listener, which calls back here.
    if (pushHandlersRegistered) await registerForPushNotifications();
    return;
  }

  const result = await registerPushDeviceToken({
    token,
    platform: 'ios',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    preferences: latestPushPreferences,
  });
  saveToLocalStorage(MOBILE_STORAGE_KEYS.pushServerReminders, result.success && result.serverReminders);
}

/** Stop server pushes to this device (logout or push disabled). */
export async function removePushRegistrationFromServer(): Promise<void> {
  saveToLocalStorage(MOBILE_STORAGE_KEYS.pushServerReminders, false);
  const token = getStoredPushDeviceToken();
  if (token) await unregisterPushDeviceToken(token);
}

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
    void syncPushRegistration();
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
    logger.info('[Native] Push registration requested', { apnsKeyId: IOS_APNS_KEY_ID });
    return true;
  } catch (error) {
    logger.warn('[Native] Push register failed', error);
    return false;
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await removePushRegistrationFromServer();
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
    await removePushRegistrationFromServer();
    saveToLocalStorage(MOBILE_STORAGE_KEYS.pushDeviceToken, null);
    return true;
  }

  if (!pushHandlersRegistered) {
    await initNativePushNotifications();
  }
  return registerForPushNotifications();
}
