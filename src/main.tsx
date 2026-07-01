import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { TIMING_CONSTANTS } from './lib/timing-constants';
import { logger } from './lib/logger';
import { checkBrowserAIStatus } from './lib/browser-ai-api';
import { BROWSER_AI_CONFIG } from './lib/ai-config';
import { COLOR_BACKGROUND_LIGHT } from './lib/color-theme';
import { APP_VERSION } from './lib/version';
import { purgeAppCachesIfVersionChanged } from './lib/service-worker-update';

// Suppress browser extension errors that are not from our code
if (typeof window !== 'undefined') {
  // Suppress Supabase GoTrueClient warning (informational, not an error)
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    const fullMessage = args.map(a => String(a)).join(' ');
    
    if (message.includes('Multiple GoTrueClient instances') || 
        message.includes('GoTrueClient instances detected')) {
      // Suppress this specific warning - we've fixed it by using a shared client
      console.debug('Suppressed GoTrueClient warning (using shared client)', args);
      return;
    }
    // Suppress RevenueCat "No available adapters" warning for Web Billing
    // This is expected on web - Web Billing doesn't use adapters (it's a hosted checkout)
    if (message.includes('No available adapters') ||
        message.includes('no available adapters')) {
      // Only suppress in production - log in dev for debugging
      if (import.meta.env.DEV) {
        console.debug('Suppressed RevenueCat adapter warning (expected for Web Billing on web platform)', args);
      }
      return;
    }
    // Suppress preload warnings from extensions (Rokt, shopping extensions, etc.) and missing font files
    // Check both the first argument and the full message string
    const lowerMessage = message.toLowerCase();
    const lowerFullMessage = fullMessage.toLowerCase();
    if (lowerMessage.includes('was preloaded using link preload but not used') ||
        lowerMessage.includes('preloaded using link preload') ||
        lowerMessage.includes('rokt-icons.woff') ||
        lowerMessage.includes('apps.rokt.com') ||
        lowerMessage.includes('inter-var.woff2') ||
        lowerMessage.includes('taskzm-logo.png') ||
        lowerFullMessage.includes('rokt-icons.woff') ||
        lowerFullMessage.includes('apps.rokt.com') ||
        lowerFullMessage.includes('rokt.com') ||
        lowerFullMessage.includes('inter-var.woff2') ||
        lowerFullMessage.includes('taskzm-logo.png') ||
        (lowerFullMessage.includes('the resource') && (lowerFullMessage.includes('rokt') || lowerFullMessage.includes('apps.rokt.com'))) ||
        (lowerFullMessage.includes('preload') && (lowerFullMessage.includes('rokt') || lowerFullMessage.includes('apps.rokt.com'))) ||
        (lowerFullMessage.includes('not used within a few seconds') && (lowerFullMessage.includes('rokt') || lowerFullMessage.includes('apps.rokt.com'))) ||
        (lowerFullMessage.includes('window\'s load event') && lowerFullMessage.includes('rokt'))) {
      // Completely suppress - these are from browser extensions, not our app
      return;
    }
    // Suppress performance violation warnings from browser extensions and app animations
    // These are expected from animation libraries (Framer Motion, etc.) and heavy initial renders
    // Pattern: [Violation] 'requestAnimationFrame' handler took XXXms
    if (message.includes('[Violation]') ||
        message.includes('handler took') ||
        message.includes("'requestAnimationFrame'") ||
        fullMessage.includes('[Violation]') ||
        fullMessage.includes('handler took') ||
        fullMessage.includes("'requestAnimationFrame'") ||
        fullMessage.includes('requestAnimationFrame') ||
        fullMessage.includes('vendor-CC_ZIGTP') ||
        fullMessage.includes('web-client-content-script') ||
        fullMessage.includes('inner.html') ||
        (fullMessage.includes('index-') && fullMessage.includes('handler took'))) {
      console.debug('Suppressed performance violation warning (expected from animations)', args);
      return;
    }
    originalWarn.apply(console, args);
  };

  // Suppress CSP violations and network errors from extensions and handled API calls
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    const fullMessage = args.map(a => String(a)).join(' ');
    
    // Suppress CSP violations from extensions
    if (message.includes('violates the following Content Security Policy') &&
        (message.includes('roktinternal.com') || 
         message.includes('chrome-extension://') ||
         message.includes('moz-extension://'))) {
      console.debug('Suppressed extension CSP violation', args);
      return;
    }
    
    // Suppress 404 errors from workspace API calls (handled gracefully)
    if ((message.includes('404') || fullMessage.includes('404')) && 
        (fullMessage.includes('folders') || fullMessage.includes('team') || fullMessage.includes('members') || fullMessage.includes('supabase.co') || fullMessage.includes('make-server'))) {
      // Silently suppress - these are expected for new workspaces
      return;
    }
    
    // Suppress browser extension errors - check more aggressively
    const isExtensionFile = fullMessage.includes('chrome-extension://') || 
        fullMessage.includes('content.js') || 
        fullMessage.includes('background.js') ||
        fullMessage.includes('serviceWorker.js') ||
        fullMessage.includes('service-worker.js') ||
        fullMessage.includes('contentScript') ||
        fullMessage.includes('contentScript.bundle.js') ||
        fullMessage.includes('web-client-content-script') ||
        fullMessage.includes('web-client-content-script.js') ||
        fullMessage.includes('userReportLinkedCandidate');
    
    if (isExtensionFile ||
        fullMessage.includes('ERR_FILE_NOT_FOUND') ||
        fullMessage.includes('net::ERR_FILE_NOT_FOUND') ||
        fullMessage.includes('userReportLinkedCandidate') ||
        fullMessage.includes('checkoutUrls') ||
        fullMessage.includes('No tab with id') ||
        fullMessage.includes('Frame with ID') ||
        fullMessage.includes('Frame with ID 0') ||
        fullMessage.includes('was removed') ||
        (fullMessage.includes('Cannot read properties of undefined') && (
          fullMessage.includes('checkoutUrls') ||
          fullMessage.includes('reading \'length\'') ||
          fullMessage.includes('reading \'checkoutUrls\'') ||
          isExtensionFile
        )) ||
        (fullMessage.includes('MutationObserver') && (
          fullMessage.includes('Failed to execute') ||
          fullMessage.includes('parameter 1 is not of type') ||
          fullMessage.includes('not of type \'Node\'') ||
          fullMessage.includes('not of type "Node"') ||
          fullMessage.includes('observe') ||
          fullMessage.includes('Failed to execute \'observe\'')
        )) ||
        fullMessage.includes('asynchronous response') ||
        fullMessage.includes('message channel closed') ||
        fullMessage.includes('A listener indicated an asynchronous response') ||
        fullMessage.includes('listener indicated an asynchronous response by returning true') ||
        (fullMessage.includes('Error checking mobile size') && fullMessage.includes('ReferenceError'))) {
      // Completely silent - these are browser extension errors, not app errors
      return;
    }
    
    
    // Suppress service worker errors from extensions
    if ((message.includes('Failed to convert value to') || fullMessage.includes('Failed to convert value to')) &&
        (fullMessage.includes('service-worker.js') || fullMessage.includes('serviceWorker.js') ||
         fullMessage.includes('chrome-extension://'))) {
      console.debug('Suppressed extension service worker error', args);
      return;
    }
    
    originalError.apply(console, args);
  };

  window.addEventListener('error', (event) => {
    // Suppress Chrome extension async message errors
    if (event.message) {
      const message = event.message.toString();
      const filename = event.filename?.toString() || '';
      const target = (event.target as any)?.src || (event.target as any)?.href || '';
      const fullContext = `${message} ${filename} ${target}`.toLowerCase();
      
      // Suppress Chrome extension errors
      // Check for checkoutUrls error early (can appear in message or as TypeError)
      const hasCheckoutUrlsError = message.includes('checkoutUrls') || 
          fullContext.includes('checkouturls') ||
          (event.error && (
            (typeof event.error === 'object' && (
              event.error?.message?.includes?.('checkoutUrls') ||
              event.error?.toString?.()?.includes?.('checkoutUrls') ||
              JSON.stringify(event.error).includes('checkoutUrls')
            ))
          ));
      
      // Check for extension-related errors more broadly
      const isExtensionError = filename.includes('chrome-extension://') ||
          filename.includes('moz-extension://') ||
          filename.includes('safari-extension://') ||
          filename.includes('contentScript.bundle.js') ||
          filename.includes('content.js') ||
          filename.includes('background.js') ||
          filename.includes('serviceWorker.js') ||
          filename.includes('service-worker.js') ||
          filename.includes('web-client-content-script.js') ||
          filename.includes('web-client-content-script') ||
          filename.includes('userReportLinkedCandidate') ||
          target.includes('chrome-extension://') ||
          target.includes('userReportLinkedCandidate') ||
          fullContext.includes('chrome-extension://') ||
          fullContext.includes('contentscript') ||
          fullContext.includes('userreportlinkedcandidate');
      
      if (hasCheckoutUrlsError ||
          isExtensionError ||
          message.includes('message channel closed before a response was received') ||
          message.includes('listener indicated an asynchronous response') ||
          message.includes('asynchronous response by returning true') ||
          message.includes('ERR_FILE_NOT_FOUND') ||
          message.includes('net::ERR_FILE_NOT_FOUND') ||
          message.includes('No tab with id') ||
          message.includes('Frame with ID') ||
          message.includes('was removed') ||
          (message.includes('Cannot read properties of undefined') && (
            message.includes('length') ||
            message.includes('checkoutUrls') ||
            isExtensionError
          )) ||
          (message.includes('Failed to execute') && message.includes('MutationObserver')) ||
          (message.includes('observe') && message.includes('MutationObserver')) ||
          (message.includes('parameter 1 is not of type') && message.includes('MutationObserver')) ||
          (message.includes('not of type \'Node\'') && message.includes('MutationObserver')) ||
          (message.includes('not of type "Node"') && message.includes('MutationObserver')) ||
          (message.includes('Failed to execute \'observe\' on \'MutationObserver\'')) ||
          (message.includes('Failed to execute "observe" on "MutationObserver"'))) {
        event.preventDefault();
        event.stopPropagation();
        // Completely silent - these are browser extension errors, not app errors
        return false;
      }
      
      // Suppress expected 404 network errors from API calls (folders, team members)
      // These are handled gracefully by returning empty arrays
      if ((message.includes('404') || message.includes('Not Found') || message.includes('Failed to load resource')) && 
          (filename.includes('folders') || filename.includes('team') || filename.includes('members') || filename.includes('supabase.co') || filename.includes('index-') || filename.includes('make-server'))) {
        event.preventDefault();
        // Completely silent - these are expected for new workspaces
        return false;
      }
      
      // Suppress network errors from fetch calls that result in 404s
      // These appear as errors in the console but are handled gracefully
      if (filename.includes('index-') && (message.includes('404') || message.includes('Not Found'))) {
        // Check if it's a workspace-related endpoint
        if (filename.includes('supabase.co') || filename.includes('make-server') || filename.includes('folders') || filename.includes('team') || filename.includes('members')) {
          event.preventDefault();
          return false;
        }
      }
      
      // Suppress initialization errors ONLY from browser extensions
      // Don't suppress errors from our own code
      if (message.includes('Cannot access') && message.includes('before initialization')) {
        // Only suppress if it's clearly from a browser extension
        const isExtensionError = filename.includes('chrome-extension://') || 
                                filename.includes('moz-extension://') ||
                                filename.includes('safari-extension://') ||
                                filename.includes('contentScript.bundle.js') ||
                                filename.includes('web-client-content-script');
        
        // Also suppress if it's from vendor bundles (third-party code, not ours)
        // BUT: If ErrorBoundary caught it, it's a real error that should be shown
        const isVendorError = filename.includes('vendor-') && 
                             !filename.includes('src/') &&
                             !filename.includes('index.html') &&
                             !filename.includes('index-'); // Don't suppress our own bundled code
        
        if (isExtensionError || isVendorError) {
          event.preventDefault();
          // Only log in development - completely silent in production
          if (import.meta.env.DEV) {
            console.debug('Suppressed initialization error (from extension or vendor code)', {
              message,
              filename,
              source: isExtensionError ? 'extension' : 'vendor'
            });
          }
          return false;
        }
        
        // For our own code (index-*.js files), don't suppress - let ErrorBoundary handle it
        // This helps identify real issues
        if (filename.includes('index-') && !filename.includes('chrome-extension://')) {
          // This is from our bundled code - let it through to ErrorBoundary
          console.error('Initialization error in app code (will be caught by ErrorBoundary):', {
            message,
            filename
          });
          // Don't suppress - let ErrorBoundary handle it
          return;
        }
        
        // For other cases, log a warning but don't suppress
        if (import.meta.env.DEV) {
          console.warn('Initialization error detected (not suppressed - may indicate a real issue):', {
            message,
            filename
          });
        }
      }
    }
  });
  
  // Also catch unhandled promise rejections from extensions
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason) {
      const message = typeof event.reason === 'object' && event.reason?.message
        ? event.reason.message.toString()
        : event.reason.toString?.() ?? '';
      
      const stack = typeof event.reason === 'object' && event.reason?.stack
        ? event.reason.stack.toString()
        : '';
      
      // Check error object properties for checkoutUrls
      const hasCheckoutUrlsError = message.includes('checkoutUrls') || 
          (typeof event.reason === 'object' && (
            event.reason?.message?.includes?.('checkoutUrls') ||
            event.reason?.toString?.()?.includes?.('checkoutUrls') ||
            JSON.stringify(event.reason).includes('checkoutUrls')
          ));
      
      // Suppress checkoutUrls errors from browser extensions (check early)
      if (hasCheckoutUrlsError) {
        event.preventDefault();
        return false;
      }
      
      // Suppress extension-related promise rejections
      // Check for async message channel errors (common from extensions)
      const isAsyncMessageError = message.includes('message channel closed before a response was received') ||
          message.includes('listener indicated an asynchronous response') ||
          message.includes('asynchronous response by returning true') ||
          message.includes('A listener indicated an asynchronous response');
      
      // Check for MutationObserver errors from extensions
      const isMutationObserverError = (message.includes('Failed to execute') && message.includes('MutationObserver')) ||
          (message.includes('observe') && message.includes('MutationObserver')) ||
          (message.includes('parameter 1 is not of type') && message.includes('MutationObserver')) ||
          (message.includes('not of type \'Node\'') && message.includes('MutationObserver')) ||
          (message.includes('not of type "Node"') && message.includes('MutationObserver')) ||
          (message.includes('Failed to execute \'observe\' on \'MutationObserver\'')) ||
          (message.includes('Failed to execute "observe" on "MutationObserver"')) ||
          (message.includes('MutationObserver') && message.includes('parameter 1'));
      
      // Check if error is from browser extension files
      const isExtensionFile = stack.includes('content.js') ||
          stack.includes('background.js') ||
          stack.includes('serviceWorker.js') ||
          stack.includes('service-worker.js') ||
          stack.includes('contentScript') ||
          stack.includes('contentScript.bundle.js') ||
          stack.includes('web-client-content-script') ||
          stack.includes('web-client-content-script.js') ||
          stack.includes('userReportLinkedCandidate') ||
          message.includes('chrome-extension://') ||
          message.includes('moz-extension://') ||
          message.includes('safari-extension://');
      
      // Check for Frame errors from extensions
      const isFrameError = message.includes('Frame with ID') ||
          (message.includes('Frame with ID 0') && message.includes('was removed')) ||
          (message.includes('was removed') && isExtensionFile);
      
      // Check for undefined property errors from extensions
      const isUndefinedPropertyError = message.includes('Cannot read properties of undefined') && (
          message.includes('checkoutUrls') ||
          message.includes('reading \'length\'') ||
          message.includes('reading \'checkoutUrls\'') ||
          isExtensionFile
      );
      
      if (isAsyncMessageError ||
          isMutationObserverError ||
          isFrameError ||
          message.includes('checkoutUrls') ||
          message.includes('No tab with id') ||
          message.includes('ERR_FILE_NOT_FOUND') ||
          isUndefinedPropertyError ||
          isExtensionFile) {
        event.preventDefault();
        // Completely silent - these are browser extension errors, not app errors
        return false;
      }
      
      // Suppress expected 404 network errors from API calls (folders, team members)
      // These are handled gracefully by returning empty arrays
      if ((message.includes('404') || message.includes('Not Found') || message.includes('Failed to load resource')) && 
          (stack.includes('folders') || stack.includes('team') || stack.includes('members') || stack.includes('supabase.co') || stack.includes('api.ts') || stack.includes('index-') || stack.includes('make-server'))) {
        event.preventDefault();
        // Completely silent - these are expected for new workspaces
        return false;
      }
      
      // Suppress expected 404 errors from API calls (folders, team members)
      // These are handled gracefully by returning empty arrays
      if ((message.includes('404') || message.includes('Not Found')) && 
          (message.includes('folders') || message.includes('team') || message.includes('members') || message.includes('supabase.co') || message.includes('make-server'))) {
        event.preventDefault();
        // Completely silent - these are expected for new workspaces
        return false;
      }
      
      // Suppress initialization errors in promise rejections ONLY from extensions
      if (message.includes('Cannot access') && message.includes('before initialization')) {
        // Only suppress if it's clearly from an extension or vendor code
        const isExtensionError = message.includes('chrome-extension://') || 
                                message.includes('moz-extension://') ||
                                message.includes('contentScript') ||
                                stack.includes('content.js') ||
                                stack.includes('contentScript');
        
        if (isExtensionError) {
          event.preventDefault();
          // Only log in development - completely silent in production
          if (import.meta.env.DEV) {
            console.debug('Suppressed initialization error in promise rejection (from extension)');
          }
          return false;
        }
      }
    }
  });
  
  // Suppress network errors from browser extensions
  // These appear as failed resource loads, not console errors
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    try {
      const response = await originalFetch.apply(this, args);
      return response;
    } catch (error: any) {
      // Suppress network errors from browser extensions
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
      const errorMessage = error?.message || String(error) || '';
      
      if (url.includes('chrome-extension://') ||
          url.includes('userReportLinkedCandidate') ||
          url.includes('moz-extension://') ||
          url.includes('safari-extension://') ||
          errorMessage.includes('chrome-extension://') ||
          errorMessage.includes('userReportLinkedCandidate')) {
        // Silently suppress - these are extension errors, not app errors
        // Return a rejected promise that won't be logged
        return Promise.reject(new Error('Extension network error (suppressed)'));
      }
      throw error;
    }
  };
  
  // Also suppress network errors that appear in the console from failed resource loads
  // These are logged by the browser itself, so we intercept them via error events
  // (already handled above in window.addEventListener('error'))
  
  // Check Browser AI API availability on startup
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      const browserAIStatus = checkBrowserAIStatus();
      if (browserAIStatus.available) {
        logger.info('✅ Browser AI API is available - enhanced AI features enabled');
      } else {
        logger.debug('ℹ️ Browser AI API not available - using local processing');
      }
    }, BROWSER_AI_CONFIG.STATUS_CHECK_DELAY_MS); // Check after delay to allow Browser AI API to initialize
  }
}

// Capacitor
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { initNativeAppHandlers } from './lib/native-app';
import { initNativeNotificationHandlers } from './lib/native-notifications';
import { ensureNativeBuildIsCurrent } from './lib/native-cache';

// Platform detection
const isNative = Capacitor.isNativePlatform();

if (isNative) {
  initNativeAppHandlers();
  initNativeNotificationHandlers();
}

// In dev, unregister any existing service worker and clear runtime caches so Vite HMR
// always serves the latest Today Agenda (and other) chunks — stale SW caused "no change" reports.
if ('serviceWorker' in navigator && import.meta.env.DEV) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      void registration.unregister();
    });
  });
  if ('caches' in window) {
    void caches.keys().then((keys) => {
      keys.forEach((key) => {
        void caches.delete(key);
      });
    });
  }
}

// PWA Service Worker Registration
// Background updates: Checks for updates periodically without disrupting sessions
// Shows notification when updates are available, letting users refresh when ready
// Only register in production — dev HMR must not serve stale cached chunks from RUNTIME_CACHE
if ('serviceWorker' in navigator && import.meta.env.PROD && !isNative) {
  window.addEventListener('load', async () => {
    const didPurgeCaches = await purgeAppCachesIfVersionChanged(APP_VERSION);
    if (didPurgeCaches) {
      logger.info(`[App] Purged stale caches after version change → ${APP_VERSION}`);
    }

    let registration: ServiceWorkerRegistration | null = null;
    try {
      registration = await navigator.serviceWorker.register('/service-worker.js', { 
        scope: '/',
        // CRITICAL: Use 'all' instead of 'none' to prevent immediate update checks
        // 'none' can cause the service worker to check for updates immediately on registration
        // 'all' allows caching but prevents aggressive update checks
        updateViaCache: 'all'
      });
      
      console.log('✅ Service Worker registered:', registration.scope);
      
      // CRITICAL: Don't check for updates immediately on registration
      // Wait a bit to ensure the page is fully loaded and user is not disrupted
      // Initialize background update checking (non-disruptive) after a delay
      setTimeout(async () => {
        if (registration) {
          const { initServiceWorkerUpdates } = await import('./lib/service-worker-update');
          initServiceWorkerUpdates(registration);
        }
      }, TIMING_CONSTANTS.serviceWorker.postRegisterInitDelay);
      
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }

    // CRITICAL: Prevent any controllerchange events from causing reloads
    // Even if a new service worker is installed, don't reload the page
    // The new service worker will take control ONLY on next page load/navigation
    // This ensures updates happen in the background without disrupting user sessions
    let controllerChangeHandled = false;
    let preventReloadFlag = true; // Global flag to prevent any automatic reloads
    let controllerChangeCount = 0; // Track controller changes for debugging
    
    // Store preventReloadFlag globally so it persists across scopes
    (window as any).__preventAutoReload = true;
    
    const controllerChangeHandler = (event: Event) => {
      controllerChangeCount++;
      
      // Prevent handling the same controller change multiple times
      if (controllerChangeHandled) {
        console.debug(`[Service Worker] Controller change #${controllerChangeCount} already handled, ignoring duplicate event`);
        return;
      }
      
      controllerChangeHandled = true;
      
      // CRITICAL: Prevent reload by setting flag and stopping event
      preventReloadFlag = true;
      (window as any).__preventAutoReload = true; // Set global flag
      
      // CRITICAL: Stop all event propagation immediately
      if (event.preventDefault) {
        event.preventDefault();
      }
      if (event.stopPropagation) {
        event.stopPropagation();
      }
      if (event.stopImmediatePropagation) {
        event.stopImmediatePropagation();
      }
      
      // CRITICAL: Explicitly prevent any reload attempts
      // Clear any pending reload timeouts
      if ((window as any).__reloadTimeout) {
        clearTimeout((window as any).__reloadTimeout);
        (window as any).__reloadTimeout = null;
      }
      
      // CRITICAL: Block any navigation attempts
      // Some browsers may try to navigate/reload on controller change
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      // Temporarily override history methods to prevent navigation
      history.pushState = function(...args) {
        console.debug('[Service Worker] Blocked pushState during controller change');
        return;
      };
      history.replaceState = function(...args) {
        console.debug('[Service Worker] Blocked replaceState during controller change');
        return;
      };
      
      // Restore history methods after a short delay
      setTimeout(() => {
        history.pushState = originalPushState;
        history.replaceState = originalReplaceState;
      }, TIMING_CONSTANTS.serviceWorker.controllerChangeHistoryRestoreDelay);
      
      // Completely ignore controller changes - don't reload
      // The new service worker will take control on next page load
      console.debug(`[Service Worker] Controller change #${controllerChangeCount} detected and blocked (update will apply on next manual refresh)`);
      
      // Reset flag after a delay to allow handling future controller changes
      setTimeout(() => {
        controllerChangeHandled = false;
      }, TIMING_CONSTANTS.serviceWorker.notificationCooldown);
    };
    
    // CRITICAL: Use non-passive listener so we can actually prevent the reload
    // Capture phase to intercept early before any other handlers
    // Add multiple listeners to catch all possible event paths
    navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler, { capture: true, passive: false });
    navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler, { capture: false, passive: false });
    
    // Additional safeguard: Listen for service worker state changes
    if (registration?.installing) {
      registration.installing.addEventListener('statechange', (event) => {
        const worker = event.target as ServiceWorker;
        if (worker && worker.state === 'activated' && navigator.serviceWorker.controller !== worker) {
          console.debug('[Service Worker] New worker activated but controller not changed - preventing reload');
          preventReloadFlag = true;
          (window as any).__preventAutoReload = true;
        }
      });
    }
    
    // Additional safeguard: Override window.location.reload to prevent automatic reloads
    // Use Object.defineProperty instead of direct assignment (location.reload is read-only)
    const originalReload = window.location.reload.bind(window.location);
    let reloadOverrideActive = true;
    let reloadAttemptCount = 0;
    
    // Enhanced reload blocker with stack trace logging for debugging
    const blockReload = (reason: string) => {
      reloadAttemptCount++;
      const stack = new Error().stack;
      console.debug(`[Service Worker] Blocked automatic reload #${reloadAttemptCount} - ${reason}`, {
        preventReloadFlag,
        globalPreventFlag: (window as any).__preventAutoReload,
        userInitiated: (window as any).__userInitiatedReload,
        stack: stack?.split('\n').slice(0, 5).join('\n'), // First 5 stack frames
      });
      preventReloadFlag = true;
      (window as any).__preventAutoReload = true;
    };
    
    try {
      Object.defineProperty(window.location, 'reload', {
        value: function(forcedReload?: boolean) {
          // Check if this is a user-initiated reload (from update notification button)
          const isUserInitiated = (window as any).__userInitiatedReload === true;
          
          // Check global flag as well
          const globalPreventFlag = (window as any).__preventAutoReload !== false;
          
          // CRITICAL: Only allow reload if explicitly called by user action (not automatic)
          // forcedReload === true alone is NOT enough - must be user-initiated
          if (isUserInitiated && (forcedReload === true || !globalPreventFlag)) {
            // User-initiated reload - allow it
            console.debug('[Service Worker] Allowing user-initiated reload');
            // Clear the flag after allowing reload
            (window as any).__userInitiatedReload = false;
            (window as any).__preventAutoReload = false; // Allow this reload
            originalReload(forcedReload);
          } else {
            // Automatic reload attempt - block it
            blockReload('automatic reload detected - update will apply on next manual refresh');
          }
        },
        writable: false,
        configurable: true,
      });
    } catch (error) {
      // If defineProperty fails (some browsers), fall back to storing original and intercepting calls
      console.debug('[Service Worker] Using fallback reload override method');
      (window as any).__originalLocationReload = originalReload;
      (window as any).__locationReloadOverride = function(forcedReload?: boolean) {
        // Check if this is a user-initiated reload (from update notification button)
        const isUserInitiated = (window as any).__userInitiatedReload === true;
        const currentPreventFlag = (window as any).__preventReloadFlag !== false;
        
        if (isUserInitiated && (!currentPreventFlag || forcedReload === true)) {
          // User-initiated reload - allow it
          console.debug('[Service Worker] Allowing user-initiated reload (fallback method)');
          (window as any).__userInitiatedReload = false;
          (window as any).__preventReloadFlag = false; // Allow reload
          originalReload(forcedReload);
        } else {
          blockReload('automatic reload detected (fallback method)');
          (window as any).__preventReloadFlag = true;
        }
      };
      
      // Also override any direct calls to location.reload
      // Mark when reload is called
      const originalReloadWrapper = function(forcedReload?: boolean) {
        (window as any).__locationReloadCalled = true;
        (window as any).__locationReloadOverride(forcedReload);
      };
      
      // Try to override location.reload in multiple ways
      try {
        Object.defineProperty(window.location, 'reload', {
          value: originalReloadWrapper,
          writable: false,
          configurable: true,
        });
      } catch (e) {
        // Fallback already set above
      }
    }
    
    // Additional safeguard: Listen for messages from service worker
    // If service worker tries to activate, tell it to wait
    let skipWaitingMessageHandled = false;
    const messageHandler = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SKIP_WAITING') {
        // Prevent handling the same message multiple times
        if (skipWaitingMessageHandled) {
          console.debug('[Service Worker] Skip waiting message already handled, ignoring duplicate');
          return;
        }
        
        skipWaitingMessageHandled = true;
        // CRITICAL: Explicitly prevent any reload behavior
        // Service worker is asking to activate - tell it to wait
        preventReloadFlag = true; // Ensure reload prevention is active
        console.debug('[Service Worker] Received skip waiting request - ignoring to prevent reload');
        // Don't respond - let it wait
        // Explicitly prevent any default behavior
        event.preventDefault?.();
        event.stopPropagation?.();
        event.stopImmediatePropagation?.();
        
        // Reset flag after a delay
        setTimeout(() => {
          skipWaitingMessageHandled = false;
        }, TIMING_CONSTANTS.serviceWorker.notificationCooldown);
      }
    };
    
    // Use non-passive listener to prevent reload
    navigator.serviceWorker.addEventListener('message', messageHandler, { capture: true, passive: false });
    
    // CRITICAL: Additional safeguard - prevent any navigation-based reloads
    // Intercept popstate and hashchange events that might trigger reloads
    // Also intercept beforeunload which some browsers use to trigger refreshes
    const preventNavigationReload = (event: Event) => {
      // Only prevent if it's an automatic reload (not user-initiated)
      if ((window as any).__preventAutoReload && !(window as any).__userInitiatedReload) {
        console.debug('[Service Worker] Blocked navigation-based reload attempt', { type: event.type });
        if (event.preventDefault) {
          event.preventDefault();
        }
        if (event.stopPropagation) {
          event.stopPropagation();
        }
        if (event.stopImmediatePropagation) {
          event.stopImmediatePropagation();
        }
        return false; // For beforeunload events
      }
    };
    
    // Listen for navigation events that might trigger reloads
    window.addEventListener('popstate', preventNavigationReload, { capture: true, passive: false });
    window.addEventListener('hashchange', preventNavigationReload, { capture: true, passive: false });
    window.addEventListener('beforeunload', preventNavigationReload, { capture: true, passive: false });
    
    // CRITICAL: Additional browser-specific protection
    // Some browsers may use different mechanisms to trigger refreshes
    // Intercept all possible reload triggers
    const originalAssign = window.location.assign.bind(window.location);
    const originalReplace = window.location.replace.bind(window.location);
    
    try {
      Object.defineProperty(window.location, 'assign', {
        value: function(url: string) {
          if ((window as any).__preventAutoReload && !(window as any).__userInitiatedReload) {
            console.debug('[Service Worker] Blocked location.assign() - automatic navigation prevented');
            return;
          }
          originalAssign(url);
        },
        writable: false,
        configurable: true,
      });
      
      Object.defineProperty(window.location, 'replace', {
        value: function(url: string) {
          if ((window as any).__preventAutoReload && !(window as any).__userInitiatedReload) {
            console.debug('[Service Worker] Blocked location.replace() - automatic navigation prevented');
            return;
          }
          originalReplace(url);
        },
        writable: false,
        configurable: true,
      });
    } catch (error) {
      // Fallback: Store original methods
      (window as any).__originalLocationAssign = originalAssign;
      (window as any).__originalLocationReplace = originalReplace;
    }
  });
}

// PWA Verification (development only)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  // Delay verification to ensure service worker has time to register
  setTimeout(async () => {
    try {
      const { logPWAStatus } = await import('./lib/pwa-verification');
      await logPWAStatus();
    } catch (error) {
      // Silently fail if verification module has issues
      console.debug('PWA verification skipped:', error);
    }
  }, TIMING_CONSTANTS.delays.splashScreenFallback);
}

// Platform-specific initialization
if (isNative) {
  // NATIVE PLATFORM (iOS/Android)
  // Edge-to-edge webview with viewport-fit=cover; safe-area CSS handles Dynamic Island / notch
  StatusBar.setOverlaysWebView({ overlay: true }).catch(console.error);
  StatusBar.setStyle({ style: Style.Light }).catch(console.error);
  StatusBar.setBackgroundColor({ color: COLOR_BACKGROUND_LIGHT }).catch(console.error);
  
  // Hide Capacitor native splash screen after app loads
  setTimeout(() => {
    SplashScreen.hide().catch(console.error);
  }, TIMING_CONSTANTS.delays.splashScreenFallback);
} else {
  // WEB PLATFORM
  // Use React splash screen only - hide HTML splash immediately
  // Hide Capacitor splash immediately and aggressively
  const hideCapacitorSplash = () => {
    try {
      // Hide via DOM selectors first (most reliable)
      const selectors = [
        'div[id*="splash"]',
        'div[class*="splash"]',
        'div[class*="Splash"]',
        '.capacitor-splash',
        '#capacitor-splash',
        '[data-capacitor-splash]'
      ];
      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el: Element) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.display = 'none';
            htmlEl.style.visibility = 'hidden';
            htmlEl.style.opacity = '0';
            htmlEl.style.pointerEvents = 'none';
          });
        } catch (e) {}
      });
      
      // Hide via Capacitor API
      if (typeof window !== 'undefined') {
        const win = window as any;
        if (win.Capacitor) {
          // Try via Plugins
          if (win.Capacitor.Plugins && win.Capacitor.Plugins.SplashScreen) {
            win.Capacitor.Plugins.SplashScreen.hide({ fadeOutDuration: 0 }).catch(() => {});
          }
          // Try direct access
          if (win.Capacitor.SplashScreen) {
            win.Capacitor.SplashScreen.hide({ fadeOutDuration: 0 }).catch(() => {});
          }
        }
      }
      // Also try the imported SplashScreen
      SplashScreen.hide({ fadeOutDuration: 0 }).catch(() => {});
    } catch (e) {
      // Ignore - Capacitor may not be available on web
    }
  };
  
  // Hide immediately
  hideCapacitorSplash();
  
  // Hide again after short delays to catch any late-loading Capacitor instances
  setTimeout(hideCapacitorSplash, TIMING_CONSTANTS.delays.splashScreen[0]);
  setTimeout(hideCapacitorSplash, TIMING_CONSTANTS.delays.splashScreen[1]);
  setTimeout(hideCapacitorSplash, 50); // Not in constants array, keeping as-is
  setTimeout(hideCapacitorSplash, TIMING_CONSTANTS.delays.splashScreen[1]);
  setTimeout(hideCapacitorSplash, TIMING_CONSTANTS.delays.splashScreen[1]);
  
  // Check if app is fully loaded and rendered AND interactive
  // This function checks multiple conditions to ensure the app is truly ready for user interaction
  const isAppFullyLoaded = (): boolean => {
    // Check if root element exists and has content
    const rootEl = document.getElementById('root');
    if (!rootEl) {
      return false;
    }
    
    // Check if React has rendered (root should have React content)
    // Require more content to ensure React has fully rendered
    const innerHTML = rootEl.innerHTML.trim();
    const hasReactContent = rootEl.children.length > 0 ||
                           innerHTML.length > TIMING_CONSTANTS.delays.splashScreenMinContentLength;
    
    if (!hasReactContent) {
      return false;
    }
    
    // Check if LoadingContext indicates app is ready (isLoading should be false)
    // Note: We don't check for React loading screen elements here because the React loading screen
    // is controlled by isLoading state, which is checked separately. The HTML splash should hide
    // as soon as React is ready to show its loading screen.
    // The React loading screen will handle showing/hiding based on isLoading state.
    
    // Check if app content is visible and interactive
    // Look for interactive elements (buttons, links, etc.) to ensure app is ready
    // Also check for actual app content (not just empty divs)
    const hasInteractiveElements = rootEl.querySelector('button, a, [role="button"], input, select, textarea, [data-testid], [onclick]') !== null;
    if (!hasInteractiveElements) {
      return false; // No interactive elements yet, app not ready
    }
    
    // Additional check: Ensure we have meaningful content (not just empty containers)
    // Look for text content or specific app elements
    const hasMeaningfulContent = innerHTML.length > TIMING_CONSTANTS.delays.splashScreenMinContentLength || // At least min content length
                                 rootEl.querySelector('[class*="sidebar"], [class*="dashboard"], [class*="kanban"], [class*="view"], [class*="panel"]') !== null ||
                                 rootEl.querySelector('nav, header, main, section, aside') !== null ||
                                 rootEl.querySelector('[id*="sidebar"], [id*="dashboard"], [id*="kanban"]') !== null;
    
    if (!hasMeaningfulContent) {
      return false; // Not enough content yet
    }
    
    // App is ready when: has content, has interactive elements, and has meaningful content
    // Note: We don't check for React loading screen here because it's controlled by isLoading state
    // The HTML splash should hide as soon as React is ready, and React will show its own loading screen if needed
    return hasReactContent && hasInteractiveElements && hasMeaningfulContent;
  };
  
  
  // React splash screen handles all loading states - no HTML splash screen needed
}

// Safe root element access with error handling
// Wrap entire app initialization in try-catch to prevent crashes
// Ensure body gets loaded class and root is visible even on error
const ensureAppReady = () => {
  document.body.classList.add('loaded');
  // Force enable scrolling
  document.body.style.overflow = 'auto';
  // Ensure root element is visible
  const rootEl = document.getElementById('root');
  if (rootEl) {
    rootEl.style.display = 'block';
    rootEl.style.visibility = 'visible';
    rootEl.style.opacity = '1';
    rootEl.style.position = 'relative';
    rootEl.style.height = '100%';
    rootEl.style.width = '100%';
  }
};

function renderApp(): void {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Root element not found! Make sure index.html has a <div id="root"></div> element.');
    const fallbackRoot = document.createElement('div');
    fallbackRoot.id = 'root';
    document.body.appendChild(fallbackRoot);
    const root = ReactDOM.createRoot(fallbackRoot);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    return;
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

async function bootstrapApp(): Promise<void> {
  if (isNative) {
    try {
      const needsReload = await ensureNativeBuildIsCurrent();
      if (needsReload) {
        (window as any).__userInitiatedReload = true;
        window.location.reload();
        return;
      }
    } catch (error) {
      logger.warn('[Native] Build cache check failed — continuing startup', error);
    }
  }

  try {
    renderApp();
  } catch (error) {
    console.error('Fatal error during app initialization:', error);
    ensureAppReady();

    const rootElement = document.getElementById('root') || document.body;
    rootElement.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; font-family: system-ui, -apple-system, sans-serif;">
      <div style="max-width: 500px; text-align: center;">
        <h1 style="color: #ef4444; margin-bottom: 1rem;">Application Error</h1>
        <p style="color: #6b7280; margin-bottom: 1.5rem;">
          The application failed to initialize. Please refresh the page.
        </p>
        <button 
          onclick="window.__userInitiatedReload = true; window.location.reload();" 
          style="background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; font-size: 1rem;"
        >
          Refresh Page
        </button>
        ${import.meta.env.DEV ? `<pre style="margin-top: 2rem; padding: 1rem; background: #f3f4f6; border-radius: 0.5rem; text-align: left; overflow: auto; font-size: 0.875rem;">${error instanceof Error ? error.stack : String(error)}</pre>` : ''}
      </div>
    </div>
  `;
  }
}

void bootstrapApp();

// Ensure body is ready after React renders (web only)
if (!isNative) {
  setTimeout(() => {
    ensureAppReady();
  }, TIMING_CONSTANTS.delays.splashScreenFinal);
}
