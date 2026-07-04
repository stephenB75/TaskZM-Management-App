/**
 * Unified achievement unlock delivery — in-app celebration, haptics, background alerts, badge.
 */

import type { Award, UserAward } from '../types';
import { isAppInForeground } from './app-visibility';
import { getFromLocalStorage, saveToLocalStorage } from './utils';
import { triggerCelebrationHaptic } from './native-haptics';
import { showAchievementNotification } from './native-notifications';
import { toast } from './toast-wrapper';
import {
  NOTIFICATION_MESSAGES,
  NOTIFICATION_STORAGE_KEYS,
  NOTIFICATION_TAG_PREFIXES,
  type NotificationSettings,
} from './notification-constants';

export type CelebrationTier = 'standard' | 'elevated';

export function getCelebrationTier(rarity: Award['rarity']): CelebrationTier {
  return rarity === 'epic' || rarity === 'legendary' ? 'elevated' : 'standard';
}

export function getUnreadAwardCount(userId: string | null | undefined): number {
  if (!userId) return 0;

  const earned = getFromLocalStorage<UserAward[]>(`awards_${userId}`, []);
  if (earned.length === 0) return 0;

  const lastSeen = new Set(
    getFromLocalStorage<string[]>(NOTIFICATION_STORAGE_KEYS.lastSeenAwards, []),
  );

  return earned.filter((entry) => !lastSeen.has(entry.awardId)).length;
}

export interface DeliverAchievementUnlockOptions {
  award: Award;
  settings: NotificationSettings;
  permission: NotificationPermission;
  requestPermission: () => Promise<boolean>;
  updateBadge: () => void;
  onInAppCelebration: (award: Award, tier: CelebrationTier) => void;
  playCelebrationSound: () => void;
}

function maybePromptForAchievementNotifications(
  permission: NotificationPermission,
  settings: NotificationSettings,
  requestPermission: () => Promise<boolean>,
): void {
  if (permission !== 'default') return;
  if (!settings.achievementBackgroundAlerts) return;

  const promptShown = getFromLocalStorage<boolean>(
    NOTIFICATION_STORAGE_KEYS.achievementPermissionPromptShown,
    false,
  );
  if (promptShown) return;

  saveToLocalStorage(NOTIFICATION_STORAGE_KEYS.achievementPermissionPromptShown, true);

  toast.info(NOTIFICATION_MESSAGES.achievementPermissionPrompt, {
    duration: 8000,
    action: {
      label: NOTIFICATION_MESSAGES.achievementPermissionEnable,
      onClick: () => {
        void requestPermission();
      },
    },
  });
}

export async function deliverAchievementUnlock(
  options: DeliverAchievementUnlockOptions,
): Promise<void> {
  const {
    award,
    settings,
    permission,
    requestPermission,
    updateBadge,
    onInAppCelebration,
    playCelebrationSound,
  } = options;

  updateBadge();

  if (!settings.enabled || !settings.achievementCelebrations) {
    return;
  }

  const tier = getCelebrationTier(award.rarity);
  const inForeground = isAppInForeground();

  if (inForeground) {
    if (settings.achievementHaptics) {
      void triggerCelebrationHaptic(award.rarity);
    }
    if (settings.soundEnabled) {
      playCelebrationSound();
    }
    onInAppCelebration(award, tier);
    maybePromptForAchievementNotifications(permission, settings, requestPermission);
    return;
  }

  if (settings.achievementBackgroundAlerts && permission === 'granted') {
    await showAchievementNotification({
      awardId: award.id,
      awardName: award.name,
      tag: `${NOTIFICATION_TAG_PREFIXES.award}${award.id}`,
    }).catch(() => undefined);
  }
}
