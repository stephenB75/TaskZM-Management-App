/**
 * Lazy load with retry on chunk load failure.
 * Handles "Failed to fetch dynamically imported module" (e.g. after deploy when chunk hash changes).
 * Retries the import a few times with delay; if all fail, rethrows so ErrorBoundary can show "Please refresh".
 */
import { lazy, type LazyExoticComponent, type ComponentType } from 'react';

const RETRY_COUNT = 2;
const RETRY_DELAY_MS = 1500;

function isChunkLoadError(error: unknown): boolean {
  if (error instanceof TypeError) {
    const msg = error.message || '';
    return (
      msg.includes('Failed to fetch dynamically imported module') ||
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

/**
 * Wraps React.lazy() and retries the dynamic import on chunk load failure (e.g. stale cache after deploy).
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
        throw error;
      }
    }
    throw lastError;
  }) as LazyExoticComponent<T>;
}
