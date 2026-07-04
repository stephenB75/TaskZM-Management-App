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

/** Haptic feedback scaled to achievement rarity (native + web vibrate fallback). */
export async function triggerCelebrationHaptic(rarity: 'common' | 'rare' | 'epic' | 'legendary'): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      if (rarity === 'legendary') {
        await Haptics.impact({ style: ImpactStyle.Heavy });
        await Haptics.notification({ type: NotificationType.Success });
      } else if (rarity === 'epic') {
        await Haptics.impact({ style: ImpactStyle.Medium });
        await Haptics.notification({ type: NotificationType.Success });
      } else {
        await Haptics.notification({ type: NotificationType.Success });
      }
    } catch {
      await triggerSelectionHaptic();
    }
    return;
  }

  if ('vibrate' in navigator) {
    if (rarity === 'legendary') {
      navigator.vibrate([15, 40, 15, 40, 20]);
    } else if (rarity === 'epic') {
      navigator.vibrate([10, 35, 15]);
    } else {
      navigator.vibrate([10, 30, 10]);
    }
  }
}
