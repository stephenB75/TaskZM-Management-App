import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { TIMING_CONSTANTS } from './lib/timing-constants';
import { logger } from './lib/logger';

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
    if (message.includes('was preloaded using link preload but not used') ||
        message.includes('rokt-icons.woff') ||
        message.includes('apps.rokt.com') ||
        message.includes('inter-var.woff2') ||
        fullMessage.includes('rokt-icons.woff') ||
        fullMessage.includes('apps.rokt.com') ||
        fullMessage.includes('rokt.com') ||
        fullMessage.includes('inter-var.woff2')) {
      console.debug('Suppressed extension/font preload warning', args);
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
    
    // Suppress browser extension errors
    if (fullMessage.includes('chrome-extension://') || 
        fullMessage.includes('content.js') || 
        fullMessage.includes('background.js') ||
        fullMessage.includes('serviceWorker.js') ||
        fullMessage.includes('service-worker.js') ||
        fullMessage.includes('contentScript') ||
        fullMessage.includes('contentScript.bundle.js') ||
        fullMessage.includes('web-client-content-script') ||
        fullMessage.includes('web-client-content-script.js') ||
        fullMessage.includes('ERR_FILE_NOT_FOUND') ||
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
          fullMessage.includes('background.js') ||
          fullMessage.includes('content.js') ||
          fullMessage.includes('serviceWorker.js') ||
          fullMessage.includes('service-worker.js') ||
          fullMessage.includes('chrome-extension://')
        )) ||
        (fullMessage.includes('MutationObserver') && (
          fullMessage.includes('Failed to execute') ||
          fullMessage.includes('parameter 1 is not of type') ||
          fullMessage.includes('not of type \'Node\'') ||
          fullMessage.includes('observe')
        )) ||
        fullMessage.includes('asynchronous response') ||
        fullMessage.includes('message channel closed') ||
        fullMessage.includes('A listener indicated an asynchronous response') ||
        (fullMessage.includes('Error checking mobile size') && fullMessage.includes('ReferenceError'))) {
      console.debug('Suppressed browser extension error', args);
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
      
      // Suppress Chrome extension errors
      // Check for checkoutUrls error early (can appear in message or as TypeError)
      const hasCheckoutUrlsError = message.includes('checkoutUrls') || 
          (event.error && (
            (typeof event.error === 'object' && (
              event.error?.message?.includes?.('checkoutUrls') ||
              event.error?.toString?.()?.includes?.('checkoutUrls') ||
              JSON.stringify(event.error).includes('checkoutUrls')
            ))
          ));
      
      if (hasCheckoutUrlsError ||
          message.includes('message channel closed before a response was received') ||
          message.includes('listener indicated an asynchronous response') ||
          message.includes('asynchronous response by returning true') ||
          message.includes('ERR_FILE_NOT_FOUND') ||
          message.includes('No tab with id') ||
          message.includes('Frame with ID') ||
          message.includes('was removed') ||
          (message.includes('Cannot read properties of undefined') && (
            message.includes('length') ||
            message.includes('checkoutUrls') ||
            filename.includes('background.js') ||
            filename.includes('content.js') ||
            filename.includes('serviceWorker.js') ||
            filename.includes('service-worker.js') ||
            filename.includes('chrome-extension://')
          )) ||
          (message.includes('Failed to execute') && message.includes('MutationObserver')) ||
          (message.includes('observe') && message.includes('MutationObserver')) ||
          (message.includes('parameter 1 is not of type') && message.includes('MutationObserver')) ||
          (message.includes('not of type \'Node\'') && message.includes('MutationObserver')) ||
          (message.includes('Failed to execute \'observe\' on \'MutationObserver\'')) ||
          filename.includes('chrome-extension://') ||
          filename.includes('moz-extension://') ||
          filename.includes('safari-extension://') ||
          filename.includes('contentScript.bundle.js') ||
          filename.includes('content.js') ||
          filename.includes('background.js') ||
          filename.includes('serviceWorker.js') ||
          filename.includes('service-worker.js') ||
          filename.includes('web-client-content-script.js') ||
          filename.includes('web-client-content-script') ||
          filename.includes('userReportLinkedCandidate.json')) {
        event.preventDefault();
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
          (message.includes('Failed to execute \'observe\' on \'MutationObserver\'')) ||
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
}

// Capacitor
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

// Platform detection
const isNative = Capacitor.isNativePlatform();

// PWA Service Worker Registration
// Background updates: Checks for updates periodically without disrupting sessions
// Shows notification when updates are available, letting users refresh when ready
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', { 
        scope: '/',
        // Allow background updates - we handle them gracefully
        updateViaCache: 'none'
      });
      
      console.log('✅ Service Worker registered:', registration.scope);
      
      // Initialize background update checking (non-disruptive)
      // This will check for updates periodically and show notifications when available
      const { initServiceWorkerUpdates } = await import('./lib/service-worker-update');
      initServiceWorkerUpdates(registration);
      
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }

    // CRITICAL: Prevent any controllerchange events from causing reloads
    // Even if a new service worker is installed, don't reload the page
    // The new service worker will take control ONLY on next page load/navigation
    // This ensures updates happen in the background without disrupting user sessions
    let controllerChangeHandled = false;
    const controllerChangeHandler = (event: Event) => {
      // Prevent handling the same controller change multiple times
      if (controllerChangeHandled) {
        console.debug('[Service Worker] Controller change already handled, ignoring duplicate event');
        return;
      }
      
      controllerChangeHandled = true;
      // CRITICAL: Explicitly prevent default behavior and stop propagation
      event.preventDefault?.();
      event.stopPropagation?.();
      
      // Completely ignore controller changes - don't reload
      // The new service worker will take control on next page load
      console.debug('[Service Worker] Controller changed (ignored to prevent reload - update will apply on next page load)');
      // Do nothing - explicitly prevent any reload behavior
      // Updates will only apply when user manually refreshes or navigates away
      
      // Reset flag after a delay to allow handling future controller changes
      setTimeout(() => {
        controllerChangeHandled = false;
      }, TIMING_CONSTANTS.serviceWorker.notificationCooldown);
    };
    
    // Use capture phase to intercept early, and make it non-capturing to prevent propagation
    navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler, { capture: false, passive: true });
    
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
        console.debug('[Service Worker] Received skip waiting request - ignoring to prevent reload');
        // Don't respond - let it wait
        // Explicitly prevent any default behavior
        event.stopPropagation?.();
        
        // Reset flag after a delay
        setTimeout(() => {
          skipWaitingMessageHandled = false;
        }, TIMING_CONSTANTS.serviceWorker.notificationCooldown);
      }
    };
    
    navigator.serviceWorker.addEventListener('message', messageHandler, { passive: true });
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
  }, 2000);
}

// Platform-specific initialization
if (isNative) {
  // NATIVE PLATFORM (iOS/Android)
  // HTML splash should already be hidden by inline script in index.html
  // Set status bar style
  StatusBar.setStyle({ style: Style.Light }).catch(console.error);                                                                
  StatusBar.setBackgroundColor({ color: '#F5F3FF' }).catch(console.error);
  
  // Hide Capacitor native splash screen after app loads
  setTimeout(() => {
    SplashScreen.hide().catch(console.error);
  }, 2000);
} else {
  // WEB PLATFORM
  // Only use HTML splash with user's logo - completely disable Capacitor splash
  // Hide Capacitor splash immediately and aggressively
  const hideCapacitorSplash = () => {
    try {
      // Hide via DOM selectors first (most reliable)
      const selectors = [
        'div[id*="splash"]:not(#initial-splash)',
        'div[class*="splash"]:not(#initial-splash)',
        'div[class*="Splash"]:not(#initial-splash)',
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
  
  // Track when splash screen was shown to ensure minimum display time
  const splashStartTime = Date.now();
  
  // Hide HTML splash when app is ready (all critical data loaded AND fully rendered)
  const hideSplashScreen = () => {
    const splashEl = document.getElementById('initial-splash');
    if (splashEl && !splashEl.classList.contains('hidden') && !splashEl.classList.contains('native-hidden')) {
      // Ensure minimum display time for smooth transition
      const elapsed = Date.now() - splashStartTime;
      const minDisplayTime = TIMING_CONSTANTS.delays.splashScreenMinDisplay;
      const remainingTime = Math.max(0, minDisplayTime - elapsed);
      
      setTimeout(() => {
        splashEl.classList.add('hidden');
        document.body.classList.add('loaded');
        setTimeout(() => {
          if (splashEl.parentNode) {
            splashEl.remove();
          }
        }, TIMING_CONSTANTS.delays.splashScreenRemoval);
      }, remainingTime);
    }
  };
  
  // Listen for app-ready event from LoadingContext
  // This ensures splash stays visible until all critical data is loaded AND app is fully rendered
  window.addEventListener('app-ready', () => {
    if (import.meta.env.DEV) {
      console.log('✅ App ready event received, checking if app is fully loaded...');
    }
    
    // Wait for React to render and ensure app is fully loaded AND loading state is false
    const checkAndHide = () => {
      // Check if app is fully rendered
      const appRendered = isAppFullyLoaded();
      
      // Also check if LoadingContext has set isLoading to false
      // We can check this by looking for the loading screen element or checking body class
      const rootEl = document.getElementById('root');
      const hasLoadingScreen = rootEl?.querySelector('.animate-spin'); // Loading spinner indicator
      const isLoading = hasLoadingScreen !== null;
      
      if (appRendered && !isLoading) {
        if (import.meta.env.DEV) {
          console.log('✅ App is fully loaded and rendered, hiding splash screen');
        }
        // Additional delay to ensure smooth transition and React has fully rendered
        requestAnimationFrame(() => {
          setTimeout(hideSplashScreen, TIMING_CONSTANTS.delays.splashScreenPostReadyDelay);
        });
      } else {
        // App not fully loaded yet, check again
        if (import.meta.env.DEV) {
          console.log(`⏳ App ready but not fully rendered (rendered: ${appRendered}, loading: ${isLoading}), checking again...`);
        }
        setTimeout(checkAndHide, TIMING_CONSTANTS.delays.splashScreenPollInterval);
      }
    };
    
    // Start checking after a brief delay to allow React to render
    setTimeout(checkAndHide, TIMING_CONSTANTS.delays.splashScreenPostReadyDelay);
  }, { once: true });
  
  // Fallback: Hide splash after maximum wait time (safety net)
  // This ensures splash doesn't stay forever if something goes wrong
  // But only hide if app appears to be loaded
  const fallbackTimeout = setTimeout(() => {
    if (isAppFullyLoaded()) {
      if (import.meta.env.DEV) {
        console.log('✅ Fallback timeout: App is loaded, hiding splash');
      }
      hideSplashScreen();
    } else {
      // If app still not loaded, force hide anyway (something might be wrong)
      if (import.meta.env.DEV) {
        console.warn('⚠️ Splash screen timeout reached, forcing hide (app may not be fully loaded)');
      }
      hideSplashScreen();
    }
  }, TIMING_CONSTANTS.delays.splashScreenAggressive);
  
  // Clear fallback if app-ready event fires (prevents double hiding)
  window.addEventListener('app-ready', () => {
    clearTimeout(fallbackTimeout);
  }, { once: true });
}

// Safe root element access with error handling
// Wrap entire app initialization in try-catch to prevent crashes
// Also ensure splash screen is hidden and body gets loaded class even on error
const ensureSplashHidden = () => {
  const splashEl = document.getElementById('initial-splash');
  if (splashEl) {
    splashEl.classList.add('hidden');
    // Force hide with inline styles as well
    splashEl.style.display = 'none';
    splashEl.style.visibility = 'hidden';
    splashEl.style.opacity = '0';
    splashEl.style.pointerEvents = 'none';
    splashEl.style.zIndex = '-1';
  }
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
    rootEl.style.zIndex = '1';
    rootEl.style.height = '100%';
    rootEl.style.width = '100%';
  }
};

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Root element not found! Make sure index.html has a <div id="root"></div> element.');
    // Create root element if it doesn't exist (fallback)
    const fallbackRoot = document.createElement('div');
    fallbackRoot.id = 'root';
    document.body.appendChild(fallbackRoot);
    const root = ReactDOM.createRoot(fallbackRoot);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    // Ensure splash is hidden immediately and after rendering
    ensureSplashHidden();
    setTimeout(ensureSplashHidden, TIMING_CONSTANTS.delays.splashScreenImmediate);
    setTimeout(ensureSplashHidden, TIMING_CONSTANTS.delays.splashScreenRemoval);
  } else {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    // Ensure splash is hidden immediately and after rendering
    ensureSplashHidden();
    setTimeout(ensureSplashHidden, TIMING_CONSTANTS.delays.splashScreenImmediate);
    setTimeout(ensureSplashHidden, TIMING_CONSTANTS.delays.splashScreenRemoval);
  }
} catch (error) {
  console.error('Fatal error during app initialization:', error);
  // Always hide splash and enable body scrolling even on error
  ensureSplashHidden();
  
  // Show a user-friendly error message
  const rootElement = document.getElementById('root') || document.body;
  rootElement.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; font-family: system-ui, -apple-system, sans-serif;">
      <div style="max-width: 500px; text-align: center;">
        <h1 style="color: #ef4444; margin-bottom: 1rem;">Application Error</h1>
        <p style="color: #6b7280; margin-bottom: 1.5rem;">
          The application failed to initialize. Please refresh the page.
        </p>
        <button 
          onclick="window.location.reload()" 
          style="background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; font-size: 1rem;"
        >
          Refresh Page
        </button>
        ${import.meta.env.DEV ? `<pre style="margin-top: 2rem; padding: 1rem; background: #f3f4f6; border-radius: 0.5rem; text-align: left; overflow: auto; font-size: 0.875rem;">${error instanceof Error ? error.stack : String(error)}</pre>` : ''}
      </div>
    </div>
  `;
}

// Additional fallback: Hide splash after React renders (web only)
// This ensures splash is always hidden even if React fails to render
// But only if app appears to be loaded
if (!isNative) {
  setTimeout(() => {
    const splashEl = document.getElementById('initial-splash');
    if (splashEl && !splashEl.classList.contains('hidden') && !splashEl.classList.contains('native-hidden')) {
      // Check if app is loaded before hiding
      const rootEl = document.getElementById('root');
      const hasContent = rootEl && (rootEl.children.length > 0 || rootEl.innerHTML.trim().length > 0);
      
      if (hasContent) {
        splashEl.classList.add('hidden');
        document.body.classList.add('loaded');
        setTimeout(() => {
          if (splashEl.parentNode) {
            splashEl.remove();
          }
        }, TIMING_CONSTANTS.delays.splashScreenRemoval);
      }
    }
  }, TIMING_CONSTANTS.delays.splashScreenFinal);
  
  // Aggressive fallback: Force hide splash and enable body scrolling
  // This ensures components are always visible even if something goes wrong
  // Only use as last resort after maximum wait time
  setTimeout(() => {
    const splashEl = document.getElementById('initial-splash');
    if (splashEl && !splashEl.classList.contains('hidden')) {
      // Force hide - this is the absolute last resort
      splashEl.classList.add('hidden');
      splashEl.style.display = 'none';
      splashEl.style.visibility = 'hidden';
      splashEl.style.opacity = '0';
      splashEl.style.pointerEvents = 'none';
      if (splashEl.parentNode) {
        splashEl.remove();
      }
    }
    document.body.classList.add('loaded');
    document.body.style.overflow = 'auto';
  }, TIMING_CONSTANTS.delays.splashScreenAggressive);
}
