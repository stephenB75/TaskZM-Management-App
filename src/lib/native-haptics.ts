/**
 * Native haptic feedback (Capacitor Haptics on iOS/Android; vibrate fallback on web).
 * iOS WebView does not support navigator.vibrate — use this instead of vibrate().
 */

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { NAV_BAR_HAPTIC_DURATION } from './layout-constants';

export async function triggerSelectionHaptic(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.selectionStart();
      await Haptics.selectionEnd();
    } catch {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch {
        // ignore — haptics unavailable
      }
    }
    return;
  }

  if ('vibrate' in navigator) {
    navigator.vibrate(NAV_BAR_HAPTIC_DURATION);
  }
}

export async function triggerImpactHaptic(style: ImpactStyle = ImpactStyle.Medium): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.impact({ style });
    } catch {
      // ignore
    }
    return;
  }

  if ('vibrate' in navigator) {
    navigator.vibrate(NAV_BAR_HAPTIC_DURATION * 2);
  }
}

export async function triggerSuccessHaptic(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      await triggerSelectionHaptic();
    }
    return;
  }

  if ('vibrate' in navigator) {
    navigator.vibrate([10, 30, 10]);
  }
}
