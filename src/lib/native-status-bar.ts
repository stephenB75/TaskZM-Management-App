/**
 * Capacitor Status Bar — edge-to-edge overlay + theme-aware style on iOS/Android.
 */

import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import {
  COLOR_BACKGROUND_DARK_COLOR,
  COLOR_BACKGROUND_LIGHT,
} from './color-theme';

export async function configureNativeStatusBarOverlay(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch (error) {
    console.warn('[Native] StatusBar overlay failed', error);
  }
}

export async function syncNativeStatusBarTheme(isDark: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({
      color: isDark ? COLOR_BACKGROUND_DARK_COLOR : COLOR_BACKGROUND_LIGHT,
    });
  } catch (error) {
    console.warn('[Native] StatusBar theme sync failed', error);
  }
}
