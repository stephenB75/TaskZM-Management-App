import React, { useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useAwards } from "../contexts/AwardContext";
import { useNotifications } from "../contexts/NotificationContext";
import { useIsMobile } from "./ui/use-mobile";
import { Icon } from "./Icon";
import {
  deliverAchievementUnlock,
  getCelebrationTier,
  type CelebrationTier,
} from "../lib/achievement-notifications";
import {
  TOAST_DURATION_EXTRA_LONG_MS,
  TOAST_DURATION_LONG_MS,
} from "../lib/layout-constants";
import type { Award } from "../types";
import { getPlatform } from "../lib/platform";
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
  const isMobile = useIsMobile();
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

  const showAwardToast = useCallback((award: Award, tier: CelebrationTier) => {
    if (getPlatform().isNative) {
      void showAchievementNotification({
        awardId: award.id,
        awardName: award.name,
        tag: `${NOTIFICATION_TAG_PREFIXES.award}${award.id}`,
      }).catch(() => undefined);
      return;
    }
    const iconName = getCategoryIconName(award.category);
    const color = getRarityColor(award.rarity);
    const isElevated = tier === "elevated";
    const duration = isElevated ? TOAST_DURATION_EXTRA_LONG_MS : TOAST_DURATION_LONG_MS;

    toast.custom(
      (t) => (
        <div
          className={`w-full bg-white dark:bg-card rounded-2xl shadow-xl border border-gray-200 dark:border-border overflow-hidden ${
            isElevated ? "max-w-md ring-2 ring-offset-2 ring-offset-background" : "max-w-sm"
          }`}
          style={{
            boxShadow: `0 ${isElevated ? 8 : 4}px ${isElevated ? 28 : 20}px ${color}${isElevated ? "35" : "20"}`,
            ...(isElevated ? { borderColor: `${color}40` } : {}),
          }}
        >
          <div className={`relative ${isElevated ? "p-5" : "p-4"}`}>
            <div
              className="absolute inset-0 opacity-5"
              style={{
                background: `linear-gradient(135deg, ${color} 0%, transparent 100%)`,
              }}
            />

            <div className="relative flex items-start gap-3">
              <div
                className={`flex-shrink-0 rounded-xl flex items-center justify-center ${
                  isElevated ? "w-12 h-12" : "w-10 h-10"
                }`}
                style={{ backgroundColor: `${color}15` }}
              >
                <Icon
                  name={iconName}
                  size={isElevated ? 24 : 20}
                  weight="duotone"
                  style={{ color }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-60">
                    {isElevated ? "Major achievement" : "Achievement"}
                  </span>
                  <span
                    className="text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${color}20`, color }}
                  >
                    {award.rarity}
                  </span>
                </div>
                <div
                  className={`font-semibold text-gray-900 dark:text-white mb-0.5 ${
                    isElevated ? "text-lg" : ""
                  }`}
                >
                  {award.name}
                </div>
                <div className="text-sm text-gray-600 dark:text-muted-foreground">
                  {award.description}
                </div>
              </div>
            </div>
          </div>

          <div
            className={`${isElevated ? "h-1.5" : "h-1"}`}
            style={{
              background: `linear-gradient(90deg, ${color} 0%, transparent 100%)`,
              opacity: isElevated ? 0.5 : 0.3,
            }}
          />
        </div>
      ),
      {
        duration,
        position: isMobile ? "top-center" : "bottom-right",
      },
    );
  }, [isMobile]);

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
      onInAppCelebration: showAwardToast,
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
    showAwardToast,
  ]);

  return null;
}

function getCategoryIconName(category: string): string {
  switch (category) {
    case "completion":
      return "target";
    case "streak":
      return "trending-up";
    case "focus":
      return "zap";
    case "special":
    case "speed":
      return "sparkles";
    default:
      return "award";
  }
}

function getRarityColor(rarity: string): string {
  switch (rarity) {
    case "legendary":
      return "rgb(245, 158, 11)";
    case "epic":
      return "rgb(168, 85, 247)";
    case "rare":
      return "rgb(59, 130, 246)";
    default:
      return "rgb(100, 116, 139)";
  }
}
