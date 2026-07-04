/**
 * Full-screen biometric lock overlay (Face ID / Touch ID) on native iOS/Android.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Icon } from './Icon';
import { Button } from './ui/button';
import {
  getBiometricTypeLabel,
  isBiometricLockEnabled,
  initNativeBiometricLockHandlers,
  verifyBiometricIdentity,
} from '../lib/native-biometrics';
import { SETTINGS_PANEL_UI_TEXT } from '../lib/settings-panel-constants';
import { Z_INDEX } from '../lib/layout-constants';

export function BiometricLockScreen() {
  const [locked, setLocked] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Face ID');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const attemptUnlock = useCallback(async () => {
    setErrorMessage(null);
    const verified = await verifyBiometricIdentity();
    if (verified) {
      setLocked(false);
      return;
    }
    setErrorMessage(SETTINGS_PANEL_UI_TEXT.security.biometricLock.verifyFailed);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    void getBiometricTypeLabel().then(setBiometricLabel);

    const sessionStarted = sessionStorage.getItem('taskzm_lock_session_started');
    if (!sessionStarted && isBiometricLockEnabled()) {
      sessionStorage.setItem('taskzm_lock_session_started', '1');
      setLocked(true);
      void attemptUnlock();
    } else if (!sessionStarted) {
      sessionStorage.setItem('taskzm_lock_session_started', '1');
    }

    const removeListener = initNativeBiometricLockHandlers(() => {
      if (!isBiometricLockEnabled()) return;
      setLocked(true);
      void attemptUnlock();
    });

    return removeListener;
  }, [attemptUnlock]);

  if (!locked) return null;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md px-6"
      style={{ zIndex: Z_INDEX.NAV_BAR + 100 }}
      role="dialog"
      aria-modal="true"
      aria-label="App locked"
    >
      <div
        className="flex flex-col items-center gap-6 max-w-sm text-center"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="rounded-full p-5 bg-primary/10">
          <Icon name="lock" size={40} className="text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">TaskZM is locked</h2>
          <p className="text-sm text-muted-foreground">
            Use {biometricLabel} to continue.
          </p>
        </div>
        {errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : null}
        <Button type="button" onClick={() => void attemptUnlock()} className="min-w-[200px]">
          Unlock with {biometricLabel}
        </Button>
      </div>
    </div>
  );
}
