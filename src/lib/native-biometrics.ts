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

/** The Face ID sheet resigns the app's active state; lock handlers must ignore that transition. */
let biometricPromptActive = false;
let verifyInFlight: Promise<boolean> | null = null;

export function verifyBiometricIdentity(reason?: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(true);
  if (verifyInFlight) return verifyInFlight;

  biometricPromptActive = true;
  verifyInFlight = NativeBiometric.verifyIdentity({
    reason: reason ?? SETTINGS_PANEL_UI_TEXT.security.biometricLock.label,
    title: 'TaskZM',
    useFallback: true,
  })
    .then(() => true)
    .catch((error) => {
      logger.debug('[Native] Biometric verify failed', error);
      return false;
    })
    .finally(() => {
      biometricPromptActive = false;
      verifyInFlight = null;
    });
  return verifyInFlight;
}

export type EnableBiometricLockResult = 'enabled' | 'unavailable' | 'cancelled';

/** Prompt biometrics before enabling app lock in Settings. */
export async function enableBiometricLockWithVerification(): Promise<EnableBiometricLockResult> {
  const available = await isBiometricHardwareAvailable();
  if (!available) return 'unavailable';

  const verified = await verifyBiometricIdentity(
    SETTINGS_PANEL_UI_TEXT.security.biometricLock.confirmReason,
  );
  if (!verified) return 'cancelled';
  setBiometricLockEnabled(true);
  return 'enabled';
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

  // 'pause'/'resume' fire on real background transitions only (not Control Center or the Face ID sheet).
  const pausePromise = App.addListener('pause', () => {
    if (!isBiometricLockEnabled() || biometricPromptActive) return;
    wentToBackground = true;
  });
  const resumePromise = App.addListener('resume', () => {
    if (!wentToBackground) return;
    wentToBackground = false;
    if (isBiometricLockEnabled() && !biometricPromptActive) onLockRequired();
  });

  return () => {
    void pausePromise.then((handle) => handle.remove());
    void resumePromise.then((handle) => handle.remove());
    appLockListenersRegistered = false;
  };
}

/** No-op on web; satisfies plugin init for credential namespace. */
export function getBiometricServerId(): string {
  return BIOMETRIC_SERVER_ID;
}
