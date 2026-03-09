/**
 * Lazy load with retry on chunk load failure.
 * Handles "Failed to fetch dynamically imported module" / "Importing a module script failed"
 * (e.g. after deploy when chunk hash changes and the browser has stale index.html).
 * Retries the import; if all fail, attempts one automatic reload to fetch fresh assets, then rethrows if still failing.
 */
import { lazy, type LazyExoticComponent, type ComponentType } from 'react';

const RETRY_COUNT = 3;
const RETRY_DELAY_MS = 2000;
const CHUNK_ERROR_RELOAD_KEY = 'lazyChunkErrorReloadTime';
const CHUNK_ERROR_RELOAD_COOLDOWN_MS = 60_000; // Allow another reload attempt after 60s so we can recover if first reload still had stale assets

function isChunkLoadError(error: unknown): boolean {
  if (error instanceof TypeError) {
    const msg = error.message || '';
    return (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('Loading chunk') ||
      msg.includes('Loading CSS chunk') ||
      msg.includes('import()')
    );
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tryReloadOnceForChunkError(): boolean {
  try {
    if (typeof sessionStorage === 'undefined') return false;
    const last = sessionStorage.getItem(CHUNK_ERROR_RELOAD_KEY);
    const now = Date.now();
    if (last) {
      const elapsed = now - parseInt(last, 10);
      if (elapsed < CHUNK_ERROR_RELOAD_COOLDOWN_MS) return false; // Already reloaded recently, don't loop
    }
    sessionStorage.setItem(CHUNK_ERROR_RELOAD_KEY, String(now));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

/**
 * Wraps React.lazy() and retries the dynamic import on chunk load failure (e.g. stale cache after deploy).
 * On final failure, attempts one full page reload so the user gets fresh index.html and chunk URLs.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  retries: number = RETRY_COUNT
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await importFn();
      } catch (error) {
        lastError = error;
        if (attempt < retries && isChunkLoadError(error)) {
          await delay(RETRY_DELAY_MS);
          continue;
        }
        if (isChunkLoadError(error) && tryReloadOnceForChunkError()) {
          return new Promise(() => {});
        }
        throw error;
      }
    }
    throw lastError;
  }) as LazyExoticComponent<T>;
}
