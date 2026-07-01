/**
 * Platform Detection Utilities
 * Safely detects if running on native mobile platform or web
 */

import { logger } from './logger';
import { APP_VERSION } from './version';

export interface PlatformInfo {
  isNative: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isWeb: boolean;
  platform: 'ios' | 'android' | 'web';
}

/**
 * Detect the current platform
 * Safe to call even if Capacitor is not loaded
 */
export function getPlatform(): PlatformInfo {
  try {
    // Check if Capacitor is available
    const Capacitor = (window as any).Capacitor;
    
    if (!Capacitor) {
      // Capacitor not loaded, we're on web
      return {
        isNative: false,
        isIOS: false,
        isAndroid: false,
        isWeb: true,
        platform: 'web'
      };
    }

    const isNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform();

    return {
      isNative,
      isIOS: platform === 'ios',
      isAndroid: platform === 'android',
      isWeb: platform === 'web',
      platform: platform as 'ios' | 'android' | 'web'
    };
  } catch (error) {
    // Fallback to web if any error
    logger.warn('Platform detection failed, defaulting to web:', error);
    return {
      isNative: false,
      isIOS: false,
      isAndroid: false,
      isWeb: true,
      platform: 'web'
    };
  }
}

/**
 * Check if running on native mobile platform
 */
export function isNativePlatform(): boolean {
  return getPlatform().isNative;
}

/**
 * Check if running on iOS
 */
export function isIOS(): boolean {
  return getPlatform().isIOS;
}

/**
 * Check if running on Android
 */
export function isAndroid(): boolean {
  return getPlatform().isAndroid;
}

/**
 * Check if running on web
 */
export function isWeb(): boolean {
  return getPlatform().isWeb;
}

/**
 * Get platform-specific styles
 */
export function getPlatformStyles() {
  const platform = getPlatform();
  
  return {
    // Add safe area padding for iOS notch/home indicator
    paddingTop: platform.isIOS ? 'env(safe-area-inset-top)' : '0',
    paddingBottom: platform.isIOS ? 'env(safe-area-inset-bottom)' : '0',
    // Adjust for Android navigation bar
    marginBottom: platform.isAndroid ? '8px' : '0'
  };
}

/**
 * Get platform name for display
 */
export function getPlatformName(): string {
  const platform = getPlatform();
  if (platform.isIOS) return 'iOS';
  if (platform.isAndroid) return 'Android';
  return 'Web';
}

/**
 * Check if device has touch capability
 */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Get app version based on platform (sync; uses centralized APP_VERSION).
 */
export function getAppVersion(): string {
  return APP_VERSION;
}
