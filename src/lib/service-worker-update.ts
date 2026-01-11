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
 */
export function initServiceWorkerUpdates(swRegistration: ServiceWorkerRegistration) {
  registration = swRegistration;
  
  // Check for updates immediately on load (non-blocking)
  checkForUpdates();
  
  // Set up periodic background checks
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
          // Show notification to user (non-blocking)
          showUpdateAvailableNotification();
        }
      });
    }
  });
  
  // Check for updates when page becomes visible (user returns to tab)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Check for updates when user returns to the app
      checkForUpdates();
    }
  });
}

/**
 * Check for service worker updates in the background
 * This is non-blocking and won't disrupt user sessions
 */
function checkForUpdates() {
  if (!registration) return;
  
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
