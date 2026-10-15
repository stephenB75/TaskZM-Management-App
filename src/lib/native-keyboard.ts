/**
 * Capacitor Keyboard — hide chrome when typing (iOS tab-bar pattern).
 * While the keyboard is open, CSS shrinks the app shell by --native-keyboard-height
 * so the focused field sits above the keyboard instead of behind it.
 */

import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { KEYBOARD_FOCUS_SCROLL_DELAY_MS } from './timing-constants';

const KEYBOARD_OPEN_ATTR = 'data-keyboard-open';
const KEYBOARD_HEIGHT_VAR = '--native-keyboard-height';
/** Visual-viewport shrink larger than this is treated as an on-screen keyboard (not browser chrome). */
const WEB_KEYBOARD_MIN_INSET_PX = 120;

let keyboardListenersRegistered = false;
let focusScrollTimer: ReturnType<typeof setTimeout> | null = null;

function isTextField(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color'].includes(el.type);
  }
  return false;
}

/** After the shell shrinks, bring the focused field into the visible area of its scroll container. */
function revealFocusedField(): void {
  if (focusScrollTimer) clearTimeout(focusScrollTimer);
  focusScrollTimer = setTimeout(() => {
    focusScrollTimer = null;
    const active = document.activeElement;
    if (isTextField(active)) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, KEYBOARD_FOCUS_SCROLL_DELAY_MS);
}

function setKeyboardOpen(isOpen: boolean, height = 0): void {
  const root = document.documentElement;
  if (!root) return;

  if (isOpen) {
    const wasOpen = root.getAttribute(KEYBOARD_OPEN_ATTR) === 'true';
    root.setAttribute(KEYBOARD_OPEN_ATTR, 'true');
    root.style.setProperty(KEYBOARD_HEIGHT_VAR, `${Math.max(0, height)}px`);
    if (!wasOpen) revealFocusedField();
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
    const inset = window.innerHeight - viewport.height;
    const pinchZoomed = viewport.scale > 1;
    const open = !pinchZoomed && inset > WEB_KEYBOARD_MIN_INSET_PX;
    setKeyboardOpen(open, inset);
    // The shell already fits above the keyboard; undo the browser's page pan so its top stays visible.
    if (open && (window.scrollY !== 0 || viewport.offsetTop !== 0)) window.scrollTo(0, 0);
  };
  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
}

/** Register keyboard show/hide listeners once. */
export function initNativeKeyboardHandlers(): void {
  if (keyboardListenersRegistered) return;
  keyboardListenersRegistered = true;

  document.addEventListener('focusin', (event) => {
    if (isNativeKeyboardOpen() && isTextField(event.target as Element)) revealFocusedField();
  });

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
