/**
 * Capacitor Keyboard — hide chrome when typing (iOS tab-bar pattern).
 */

import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

const KEYBOARD_OPEN_ATTR = 'data-keyboard-open';
const KEYBOARD_HEIGHT_VAR = '--native-keyboard-height';

let keyboardListenersRegistered = false;

function setKeyboardOpen(isOpen: boolean, height = 0): void {
  const root = document.documentElement;
  if (!root) return;

  if (isOpen) {
    root.setAttribute(KEYBOARD_OPEN_ATTR, 'true');
    root.style.setProperty(KEYBOARD_HEIGHT_VAR, `${Math.max(0, height)}px`);
  } else {
    root.removeAttribute(KEYBOARD_OPEN_ATTR);
    root.style.setProperty(KEYBOARD_HEIGHT_VAR, '0px');
  }
}

/** Register keyboard show/hide listeners once (native only). */
export function initNativeKeyboardHandlers(): void {
  if (!Capacitor.isNativePlatform() || keyboardListenersRegistered) return;
  keyboardListenersRegistered = true;

  void Keyboard.addListener('keyboardWillShow', (info) => {
    setKeyboardOpen(true, info.keyboardHeight);
  });

  void Keyboard.addListener('keyboardDidShow', (info) => {
    setKeyboardOpen(true, info.keyboardHeight);
  });

  void Keyboard.addListener('keyboardWillHide', () => {
    setKeyboardOpen(false);
  });

  void Keyboard.addListener('keyboardDidHide', () => {
    setKeyboardOpen(false);
  });
}

export function isNativeKeyboardOpen(): boolean {
  return document.documentElement?.getAttribute(KEYBOARD_OPEN_ATTR) === 'true';
}
