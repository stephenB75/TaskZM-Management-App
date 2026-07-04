/**
 * Native share sheet — Web Share API on iOS WKWebView; Capacitor-friendly fallback.
 */

import { Capacitor } from '@capacitor/core';

export interface NativeSharePayload {
  title?: string;
  text?: string;
  url?: string;
}

export async function shareWithNativeSheet(payload: NativeSharePayload): Promise<boolean> {
  const shareData: ShareData = {
    title: payload.title,
    text: payload.text,
    url: payload.url,
  };

  if (typeof navigator.share !== 'function') {
    return false;
  }

  try {
    if (typeof navigator.canShare === 'function' && !navigator.canShare(shareData)) {
      return false;
    }
    await navigator.share(shareData);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return false;
    }
    if (Capacitor.isNativePlatform()) {
      console.warn('[Native] Share failed', error);
    }
    return false;
  }
}
