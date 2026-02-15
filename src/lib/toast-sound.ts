/**
 * Play a short notification sound (e.g. when user adds a task).
 * Uses Web Audio API and constants only; no hardcoded values.
 */

import { MILLISECONDS_PER_SECOND } from './business-constants';
import { NOTIFICATION_SOUND } from './toast-constants';

/**
 * Plays the configured notification sound once.
 * Safe to call from any context; no-op if AudioContext is unavailable or user gesture required.
 */
export function playNotificationSound(): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const durationSec = NOTIFICATION_SOUND.durationMs / MILLISECONDS_PER_SECOND;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = NOTIFICATION_SOUND.frequencyHz;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(NOTIFICATION_SOUND.volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(NOTIFICATION_SOUND.gainRampEnd, ctx.currentTime + durationSec);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + durationSec);
  } catch {
    // Ignore: AudioContext may require user gesture or be blocked
  }
}
