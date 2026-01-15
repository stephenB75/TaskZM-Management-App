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
  
  // Check for updates after a delay (non-blocking, background only)
  // Use a delay to ensure it doesn't block initial page load
  // Note: Initial check will likely be skipped since page is visible
  setTimeout(() => {
    checkForUpdates();
  }, INITIAL_UPDATE_CHECK_DELAY);
  
  // Set up periodic background checks ONLY (no visibility change triggers)
  // This ensures updates are checked in the background without disrupting user sessions
  updateCheckInterval = window.setInterval(() => {
    checkForUpdates();
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
  
  // Track visibility changes to determine how long page has been hidden
  if (!document.hidden) {
    // Page is visible - update last visible time and skip update check
    lastVisibleTime = Date.now();
    console.debug('[Service Worker] Skipping update check (page is visible)');
    return;
  }
  
  // Page is hidden - check how long it's been hidden
  const hiddenDuration = Date.now() - lastVisibleTime;
  
  // CRITICAL: Only check for updates if page has been hidden for minimum duration
  // This prevents update checks during brief tab switches or accidental visibility changes
  // The page must be hidden for at least MIN_HIDDEN_TIME before we check for updates
  if (hiddenDuration >= MIN_HIDDEN_TIME) {
    // Page has been hidden long enough - safe to check for updates in the background
    // The update() call itself doesn't cause refreshes - it only checks for new versions
    // The new service worker will install but wait (not activate) due to our configuration
    // It will only activate when user manually refreshes the page
    registration.update().catch((error) => {
      // Silently fail - update checking is non-critical
      console.debug('Service worker update check failed (non-critical):', error);
    });
  } else {
    // Page hasn't been hidden long enough - skip update check
    // This prevents checks during brief tab switches or accidental visibility changes
    console.debug(`[Service Worker] Skipping update check (page hidden for only ${Math.round(hiddenDuration / 1000)}s, need ${Math.round(MIN_HIDDEN_TIME / 1000)}s)`);
  }
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
          (window.location as any).reload(true);
        },
      },
      onClick: () => {
        // Also allow clicking the toast itself to refresh
        // Use forced reload to bypass any reload prevention (user-initiated)
        (window.location as any).reload(true);
      },
    }
  );
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
