/**
 * Capacitor Native Biometric — Face ID / Touch ID app lock on iOS and Android.
 */

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import {
  BiometryType,
  NativeBiometric,
} from '@capgo/capacitor-native-biometric';
import { MOBILE_STORAGE_KEYS } from './mobile-constants';
import { SETTINGS_PANEL_UI_TEXT } from './settings-panel-constants';
import { getFromLocalStorage, saveToLocalStorage } from './utils';
import { logger } from './logger';

const BIOMETRIC_SERVER_ID = 'taskzm.app.lock';

export function isBiometricLockEnabled(): boolean {
  return getFromLocalStorage<boolean>(MOBILE_STORAGE_KEYS.biometricLockEnabled, false);
}

export function setBiometricLockEnabled(enabled: boolean): void {
  saveToLocalStorage(MOBILE_STORAGE_KEYS.biometricLockEnabled, enabled);
}

export async function isBiometricHardwareAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const result = await NativeBiometric.isAvailable({ useFallback: true });
    return result.isAvailable;
  } catch {
    return false;
  }
}

export function getBiometricLabel(biometryType: BiometryType): string {
  switch (biometryType) {
    case BiometryType.FACE_ID:
    case BiometryType.FACE_AUTHENTICATION:
      return 'Face ID';
    case BiometryType.TOUCH_ID:
    case BiometryType.FINGERPRINT:
      return 'Touch ID';
    default:
      return 'Biometrics';
  }
}

export async function getBiometricTypeLabel(): Promise<string> {
  if (!Capacitor.isNativePlatform()) return 'Biometrics';

  try {
    const result = await NativeBiometric.isAvailable({ useFallback: true });
    return getBiometricLabel(result.biometryType);
  } catch {
    return 'Biometrics';
  }
}

export async function verifyBiometricIdentity(reason?: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;

  try {
    await NativeBiometric.verifyIdentity({
      reason: reason ?? SETTINGS_PANEL_UI_TEXT.security.biometricLock.label,
      title: 'TaskZM',
      useFallback: true,
    });
    return true;
  } catch (error) {
    logger.debug('[Native] Biometric verify failed', error);
    return false;
  }
}

/** Prompt biometrics before enabling app lock in Settings. */
export async function enableBiometricLockWithVerification(): Promise<boolean> {
  const available = await isBiometricHardwareAvailable();
  if (!available) return false;

  const verified = await verifyBiometricIdentity(
    SETTINGS_PANEL_UI_TEXT.security.biometricLock.enabled,
  );
  if (verified) {
    setBiometricLockEnabled(true);
  }
  return verified;
}

export function disableBiometricLock(): void {
  setBiometricLockEnabled(false);
}

let appLockListenersRegistered = false;

/** Track background transitions; consumers listen via onAppLockRequired callback. */
export function initNativeBiometricLockHandlers(onLockRequired: () => void): () => void {
  if (!Capacitor.isNativePlatform() || appLockListenersRegistered) {
    return () => undefined;
  }
  appLockListenersRegistered = true;

  let wentToBackground = false;

  const listenerPromise = App.addListener('appStateChange', ({ isActive }) => {
    if (!isBiometricLockEnabled()) return;

    if (!isActive) {
      wentToBackground = true;
      return;
    }

    if (wentToBackground) {
      wentToBackground = false;
      onLockRequired();
    }
  });

  return () => {
    void listenerPromise.then((handle) => handle.remove());
  };
}

/** No-op on web; satisfies plugin init for credential namespace. */
export function getBiometricServerId(): string {
  return BIOMETRIC_SERVER_ID;
}
