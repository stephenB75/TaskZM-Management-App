/**
 * Service Worker Update Manager
 * Handles background updates without disrupting user sessions
 * Shows notifications when updates are available, letting users refresh when ready
 */

import { toast } from './toast-wrapper';
import { TIMING_CONSTANTS } from './timing-constants';

const UPDATE_CHECK_INTERVAL = TIMING_CONSTANTS.serviceWorker.updateCheckInterval;
const UPDATE_NOTIFICATION_COOLDOWN = TIMING_CONSTANTS.serviceWorker.notificationCooldown;
const UPDATE_NOTIFICATION_DURATION = TIMING_CONSTANTS.serviceWorker.notificationDuration;
const UPDATE_NOTIFICATION_KEY = 'taskzm_update_available';

let updateCheckInterval: number | null = null;
let updateAvailableToastId: string | number | null = null;
let registration: ServiceWorkerRegistration | null = null;

/**
 * Initialize service worker update checking
 * Checks for updates periodically in the background
 * Updates will NEVER cause automatic page refreshes - only manual refresh applies updates
 */
export function initServiceWorkerUpdates(swRegistration: ServiceWorkerRegistration) {
  registration = swRegistration;
  
  // Check for updates immediately on load (non-blocking)
  checkForUpdates();
  
  // Set up periodic background checks (reduced frequency to minimize checks)
  updateCheckInterval = window.setInterval(() => {
    checkForUpdates();
  }, UPDATE_CHECK_INTERVAL);
  
  // Listen for updatefound event (new service worker detected)
  swRegistration.addEventListener('updatefound', () => {
    const newWorker = swRegistration.installing;
    if (newWorker) {
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker is installed and waiting
          // CRITICAL: Don't let it activate - it will wait until user manually refreshes
          // Show notification to user (non-blocking)
          showUpdateAvailableNotification();
          
          // Send message to new worker to ensure it waits
          // This prevents it from activating automatically
          // Use a MessageChannel for reliable communication
          if (newWorker.state === 'installed') {
            const channel = new MessageChannel();
            channel.port1.onmessage = (event) => {
              if (event.data && event.data.type === 'ACK') {
                console.debug('[Service Worker Update] Confirmed new worker will wait');
              }
            };
            newWorker.postMessage({ type: 'SKIP_WAITING', skip: false }, [channel.port2]);
          }
        }
      });
    }
  });
  
  // Check for updates when page becomes visible (user returns to tab)
  // But only if enough time has passed (reduce frequency)
  let lastVisibilityCheck = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      // Only check if at least 5 minutes have passed since last check
      if (now - lastVisibilityCheck > 5 * 60 * 1000) {
        lastVisibilityCheck = now;
        checkForUpdates();
      }
    }
  });
}

/**
 * Check for service worker updates in the background
 * This is non-blocking and won't disrupt user sessions
 * Updates will be downloaded but will NOT activate until user manually refreshes
 */
function checkForUpdates() {
  if (!registration) return;
  
  // Check for updates in the background
  // The new service worker will install but wait (not activate)
  // It will only activate when user manually refreshes the page
  registration.update().catch((error) => {
    // Silently fail - update checking is non-critical
    console.debug('Service worker update check failed (non-critical):', error);
  });
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
    'Update available',
    {
      description: 'A new version is ready. Click to refresh when convenient.',
      duration: UPDATE_NOTIFICATION_DURATION,
      action: {
        label: 'Refresh Now',
        onClick: () => {
          // User chose to refresh - reload the page
          window.location.reload();
        },
      },
      onClick: () => {
        // Also allow clicking the toast itself to refresh
        window.location.reload();
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
