/**
 * Capacitor Keyboard — hide chrome when typing (iOS tab-bar pattern).
 */

import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

const KEYBOARD_OPEN_ATTR = 'data-keyboard-open';
const KEYBOARD_HEIGHT_VAR = '--native-keyboard-height';
/** Visual-viewport shrink larger than this is treated as an on-screen keyboard (not browser chrome). */
const WEB_KEYBOARD_MIN_INSET_PX = 120;

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

/** Mobile browsers: derive keyboard height from the visual viewport. */
function initWebKeyboardHandlers(): void {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const update = () => {
    const inset = window.innerHeight - viewport.height - viewport.offsetTop;
    const pinchZoomed = viewport.scale > 1;
    setKeyboardOpen(!pinchZoomed && inset > WEB_KEYBOARD_MIN_INSET_PX, inset);
  };
  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
}

/** Register keyboard show/hide listeners once. */
export function initNativeKeyboardHandlers(): void {
  if (keyboardListenersRegistered) return;
  keyboardListenersRegistered = true;
  if (!Capacitor.isNativePlatform()) {
    initWebKeyboardHandlers();
    return;
  }

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
