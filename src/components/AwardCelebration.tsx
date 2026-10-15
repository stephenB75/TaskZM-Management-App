import React, { useEffect, useCallback, useRef } from "react";
import { useAwards } from "../contexts/AwardContext";
import { useNotifications } from "../contexts/NotificationContext";
import {
  deliverAchievementUnlock,
  getCelebrationTier,
} from "../lib/achievement-notifications";
import {
  TOAST_DURATION_EXTRA_LONG_MS,
  TOAST_DURATION_LONG_MS,
} from "../lib/layout-constants";
import type { Award } from "../types";
import { showAchievementNotification } from "../lib/native-notifications";
import { NOTIFICATION_TAG_PREFIXES } from "../lib/notification-constants";

export function AwardCelebration() {
  const { celebrationQueue, dismissCelebration } = useAwards();
  const {
    settings,
    permission,
    requestPermission,
    updateBadge,
  } = useNotifications();
  const currentAward = celebrationQueue[0];
  const processingRef = useRef(false);

  const playCelebrationSound = useCallback(() => {
    const userHasInteracted =
      typeof navigator !== "undefined" && !!(navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } }).userActivation?.hasBeenActive;

    if (!userHasInteracted || !settings.soundEnabled) return;

    void (async () => {
      try {
        const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;

        const audioContext = new AudioContextClass();
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }
        if (audioContext.state !== "running") return;

        const now = audioContext.currentTime;
        const frequencies = [523.25, 659.25, 783.99];
        frequencies.forEach((freq, i) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.frequency.value = freq;
          oscillator.type = "sine";
          const startTime = now + i * 0.1;
          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
          oscillator.start(startTime);
          oscillator.stop(startTime + 0.3);
        });
      } catch {
        // Audio unavailable — skip silently
      }
    })();
  }, [settings.soundEnabled]);

  const showAwardNotification = useCallback((award: Award) => {
    void showAchievementNotification({
      awardId: award.id,
      awardName: award.name,
      tag: `${NOTIFICATION_TAG_PREFIXES.award}${award.id}`,
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!currentAward || processingRef.current) {
      if (!currentAward) {
        processingRef.current = false;
      }
      return;
    }

    processingRef.current = true;
    const tier = getCelebrationTier(currentAward.rarity);
    const dismissDelay = tier === "elevated" ? TOAST_DURATION_EXTRA_LONG_MS : TOAST_DURATION_LONG_MS;

    void deliverAchievementUnlock({
      award: currentAward,
      settings,
      permission,
      requestPermission,
      updateBadge,
      playCelebrationSound,
      onInAppCelebration: showAwardNotification,
    });

    const timer = setTimeout(() => {
      dismissCelebration();
      setTimeout(() => {
        processingRef.current = false;
      }, 200);
    }, dismissDelay);

    return () => {
      clearTimeout(timer);
      processingRef.current = false;
    };
  }, [
    currentAward,
    dismissCelebration,
    settings,
    permission,
    requestPermission,
    updateBadge,
    playCelebrationSound,
    showAwardNotification,
  ]);

  return null;
}
