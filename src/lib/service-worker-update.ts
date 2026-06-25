/**
 * Service Worker Update Manager
 * Handles background updates without disrupting user sessions
 * Shows notifications when updates are available, letting users refresh when ready
 */

import { toast } from './toast-wrapper';
import { TIMING_CONSTANTS } from './timing-constants';
import { NOTIFICATION_STORAGE_KEYS, NOTIFICATION_TOAST_MESSAGES } from './notification-constants';

const UPDATE_CHECK_INTERVAL = TIMING_CONSTANTS.serviceWorker.updateCheckInterval;
const UPDATE_NOTIFICATION_COOLDOWN = TIMING_CONSTANTS.serviceWorker.notificationCooldown;
const UPDATE_NOTIFICATION_DURATION = TIMING_CONSTANTS.serviceWorker.notificationDuration;
// REMOVED: UPDATE_VISIBILITY_CHECK_INTERVAL - no longer checking on visibility changes
const UPDATE_NOTIFICATION_KEY = NOTIFICATION_STORAGE_KEYS.updateAvailable;
const INITIAL_UPDATE_CHECK_DELAY = TIMING_CONSTANTS.serviceWorker.initialUpdateCheckDelay;
const MIN_HIDDEN_TIME = TIMING_CONSTANTS.serviceWorker.minHiddenTime;

let updateCheckInterval: number | null = null;
let updateAvailableToastId: string | number | null = null;
let registration: ServiceWorkerRegistration | null = null;
let lastVisibleTime: number = Date.now(); // Track when page was last visible

/**
 * Initialize service worker update checking
 * Checks for updates periodically in the background
 * Updates will NEVER cause automatic page refreshes - only manual refresh applies updates
 */
export function initServiceWorkerUpdates(swRegistration: ServiceWorkerRegistration) {
  registration = swRegistration;
  
  // Initialize last visible time to current time
  lastVisibleTime = Date.now();
  
  // Track visibility changes to update lastVisibleTime
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      // Page became visible - update last visible time
      lastVisibleTime = Date.now();
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // CRITICAL: Don't check for updates immediately
  // Wait longer to ensure page is fully loaded and user session is established
  // Initial check will be skipped since page is visible, but we still delay to be safe
  setTimeout(() => {
    // Only check if page is still hidden (unlikely on initial load)
    // This ensures we never check for updates when user is actively using the app
    if (document.hidden) {
      checkForUpdates();
    }
  }, Math.max(INITIAL_UPDATE_CHECK_DELAY, 30000)); // Wait at least 30 seconds
  
  // Set up periodic background checks ONLY (no visibility change triggers)
  // This ensures updates are checked in the background without disrupting user sessions
  // CRITICAL: Only check when page is hidden - never when visible
  // ENHANCED: Double-check visibility before calling checkForUpdates to prevent any race conditions
  updateCheckInterval = window.setInterval(() => {
    // CRITICAL: Only check for updates when page is hidden
    // Never check when user is actively using the app
    // Double-check visibility to prevent race conditions
    if (document.hidden && !document.hasFocus()) {
      // Page is hidden AND not focused - safe to check for updates
      checkForUpdates();
    } else {
      // Page is visible or focused - update last visible time and skip check
      lastVisibleTime = Date.now();
    }
  }, UPDATE_CHECK_INTERVAL);
  
  // Listen for updatefound event (new service worker detected)
  // CRITICAL: Only handle this once per update to prevent multiple notifications
  let updateFoundHandled = false;
  swRegistration.addEventListener('updatefound', () => {
    // Prevent handling the same update multiple times
    if (updateFoundHandled) {
      console.debug('[Service Worker Update] Update already being handled, ignoring duplicate event');
      return;
    }
    
    const newWorker = swRegistration.installing;
    if (newWorker) {
      updateFoundHandled = true;
      
      newWorker.addEventListener('statechange', () => {
        // Only handle 'installed' state once
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker is installed and waiting
          // CRITICAL: Don't let it activate - it will wait until user manually refreshes
          // Show notification to user (non-blocking) - but only once
          showUpdateAvailableNotification();
          
          // Send message to new worker to ensure it waits
          // This prevents it from activating automatically
          // Use a MessageChannel for reliable communication
          const channel = new MessageChannel();
          channel.port1.onmessage = (event) => {
            if (event.data && event.data.type === 'ACK') {
              console.debug('[Service Worker Update] Confirmed new worker will wait');
            }
          };
          newWorker.postMessage({ type: 'SKIP_WAITING', skip: false }, [channel.port2]);
          
          // Reset flag after a delay to allow handling future updates
          setTimeout(() => {
            updateFoundHandled = false;
          }, UPDATE_NOTIFICATION_COOLDOWN);
        }
      });
    }
  });
  
  // REMOVED: Visibility change handler for update checks
  // Update checks should ONLY happen in the background via interval
  // This prevents any refresh behavior when user clicks back to the app
  // Updates will be checked periodically in the background without user interaction
}

/**
 * Check for service worker updates in the background
 * This is non-blocking and won't disrupt user sessions
 * Updates will be downloaded but will NOT activate until user manually refreshes
 * 
 * IMPORTANT: This function is ONLY called from background intervals (not on visibility changes)
 * The update check itself is safe - it only checks for updates, doesn't cause refreshes
 * The service worker is configured to wait and not activate automatically
 * 
 * CRITICAL: Added additional safeguards to prevent any refresh behavior
 * - Only checks when page is hidden
 * - Requires minimum hidden time before checking (prevents checks during brief tab switches)
 */
function checkForUpdates() {
  if (!registration) return;
  
  // CRITICAL: NEVER check for updates when page is visible or focused
  // This prevents any refresh behavior during active user sessions
  // ENHANCED: Double-check both hidden and focus state to prevent race conditions
  if (!document.hidden || document.hasFocus()) {
    // Page is visible or focused - update last visible time and skip update check
    lastVisibleTime = Date.now();
    return;
  }
  
  // Page is hidden - check how long it's been hidden
  const hiddenDuration = Date.now() - lastVisibleTime;
  
  // CRITICAL: Only check for updates if page has been hidden for minimum duration
  // This prevents update checks during brief tab switches or accidental visibility changes
  // The page must be hidden for at least MIN_HIDDEN_TIME before we check for updates
  // ENHANCED: Also verify page is still hidden before calling update() to prevent race conditions
  if (hiddenDuration >= MIN_HIDDEN_TIME && document.hidden && !document.hasFocus()) {
    // Page has been hidden long enough AND is still hidden - safe to check for updates in the background
    // The update() call itself doesn't cause refreshes - it only checks for new versions
    // The new service worker will install but wait (not activate) due to our configuration
    // It will only activate when user manually refreshes the page
    registration.update().catch((error) => {
      // Silently fail - update checking is non-critical
      // Suppress error logging to avoid console noise
    });
  }
  // If page hasn't been hidden long enough or is now visible, silently skip (expected behavior)
}

/**
 * Show a notification when an update is available
 * User can choose to refresh when ready
 */
function showUpdateAvailableNotification() {
  // Only show notification once per update
  const lastNotification = sessionStorage.getItem(UPDATE_NOTIFICATION_KEY);
  const now = Date.now();
  
  // Don't show notification if we've already shown it recently
  if (lastNotification && (now - parseInt(lastNotification)) < UPDATE_NOTIFICATION_COOLDOWN) {
    return;
  }
  
  // Store notification timestamp
  sessionStorage.setItem(UPDATE_NOTIFICATION_KEY, now.toString());
  
  // Dismiss any existing update notification
  if (updateAvailableToastId) {
    toast.dismiss(updateAvailableToastId);
  }
  
  // Show new notification with action button
  // Sonner supports action buttons via the action option
  updateAvailableToastId = toast.info(
    NOTIFICATION_TOAST_MESSAGES.updateAvailable,
    {
      description: NOTIFICATION_TOAST_MESSAGES.updateAvailableDescription,
      duration: UPDATE_NOTIFICATION_DURATION,
      action: {
        label: NOTIFICATION_TOAST_MESSAGES.updateAvailableAction,
        onClick: () => {
          // User chose to refresh - reload the page
          // Use forced reload to bypass any reload prevention (user-initiated)
          // Store flag to indicate this is user-initiated
          (window as any).__userInitiatedReload = true;
          window.location.reload();
        },
      },
      onClick: () => {
        // Also allow clicking the toast itself to refresh
        // Use forced reload to bypass any reload prevention (user-initiated)
        // Store flag to indicate this is user-initiated
        (window as any).__userInitiatedReload = true;
        window.location.reload();
      },
    }
  );
}

/**
 * When APP_VERSION changes, purge Cache Storage and unregister service workers so
 * immutable /assets/* HTTP cache and RUNTIME_CACHE cannot serve stale Today Agenda chunks.
 * Returns true if caches were purged (caller may want a reload on next paint).
 */
export async function purgeAppCachesIfVersionChanged(currentVersion: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const versionKey = NOTIFICATION_STORAGE_KEYS.appVersion;
  const storedVersion = localStorage.getItem(versionKey);

  if (storedVersion === currentVersion) {
    return false;
  }

  localStorage.setItem(versionKey, currentVersion);

  if (storedVersion == null) {
    return false;
  }

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  return true;
}

/**
 * Clean up update checking
 */
export function cleanupServiceWorkerUpdates() {
  if (updateCheckInterval !== null) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
  
  if (updateAvailableToastId) {
    toast.dismiss(updateAvailableToastId);
    updateAvailableToastId = null;
  }
  
  registration = null;
}
