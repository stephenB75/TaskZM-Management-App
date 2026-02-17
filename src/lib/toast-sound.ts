/**
 * Play short notification sounds (task created, task complete, due reminder).
 * Uses Web Audio API and constants only; no hardcoded values.
 */

import { MILLISECONDS_PER_SECOND } from './business-constants';
import {
  NOTIFICATION_SOUND,
  TASK_COMPLETE_SOUND,
  DUE_REMINDER_CHIME,
} from './toast-constants';

type SoundConfig = {
  frequencyHz: number;
  durationMs: number;
  volume: number;
  gainRampEnd: number;
};

function playSoundFromConfig(config: SoundConfig): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const durationSec = config.durationMs / MILLISECONDS_PER_SECOND;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = config.frequencyHz;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(config.volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(config.gainRampEnd, ctx.currentTime + durationSec);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + durationSec);
  } catch {
    // Ignore: AudioContext may require user gesture or be blocked
  }
}

/**
 * Plays the task-created notification sound (e.g. when user adds a task).
 * Safe to call from any context; no-op if AudioContext is unavailable or user gesture required.
 */
export function playNotificationSound(): void {
  playSoundFromConfig(NOTIFICATION_SOUND);
}

/**
 * Plays the task-complete sound (e.g. when user marks a task complete, with confetti).
 */
export function playTaskCompleteSound(): void {
  playSoundFromConfig(TASK_COMPLETE_SOUND);
}

/**
 * Plays the due-reminder chime when a task is due or upcoming.
 */
export function playDueReminderChime(): void {
  playSoundFromConfig(DUE_REMINDER_CHIME);
}
