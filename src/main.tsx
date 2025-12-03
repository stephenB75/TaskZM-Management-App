import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { TIMING_CONSTANTS } from './lib/timing-constants';

// Suppress browser extension errors that are not from our code
if (typeof window !== 'undefined') {
  // Suppress Supabase GoTrueClient warning (informational, not an error)
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const message = args[0]?.toString() || '';
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
    // Suppress preload warnings from extensions
    if (message.includes('was preloaded using link preload but not used') ||
        message.includes('rokt-icons.woff')) {
      console.debug('Suppressed extension preload warning', args);
      return;
    }
    originalWarn.apply(console, args);
  };

  // Suppress CSP violations from extensions
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    // Suppress CSP violations from extensions
    if (message.includes('violates the following Content Security Policy') &&
        (message.includes('roktinternal.com') || 
         message.includes('chrome-extension://') ||
         message.includes('moz-extension://'))) {
      console.debug('Suppressed extension CSP violation', args);
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
      if (message.includes('message channel closed before a response was received') ||
          message.includes('listener indicated an asynchronous response') ||
          message.includes('asynchronous response by returning true') ||
          message.includes('checkoutUrls') ||
          message.includes('ERR_FILE_NOT_FOUND') ||
          (message.includes('Failed to execute') && message.includes('MutationObserver')) ||
          (message.includes('observe') && message.includes('MutationObserver')) ||
          (message.includes('parameter 1 is not of type') && message.includes('MutationObserver')) ||
          (message.includes('not of type \'Node\'') && message.includes('MutationObserver')) ||
          filename.includes('chrome-extension://') ||
          filename.includes('moz-extension://') ||
          filename.includes('safari-extension://') ||
          filename.includes('contentScript.bundle.js') ||
          filename.includes('content.js') ||
          filename.includes('web-client-content-script.js') ||
          filename.includes('web-client-content-script') ||
          filename.includes('userReportLinkedCandidate.json')) {
        event.preventDefault();
        // Completely silent - these are browser extension errors, not app errors
        return false;
      }
      
      // Suppress expected 404 network errors from API calls (folders, team members)
      // These are handled gracefully by returning empty arrays
      if ((message.includes('404') || message.includes('Not Found')) && 
          (filename.includes('folders') || filename.includes('team') || filename.includes('members') || filename.includes('supabase.co'))) {
        event.preventDefault();
        // Completely silent - these are expected for new workspaces
        return false;
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
      
      // Suppress extension-related promise rejections
      if (message.includes('message channel closed before a response was received') ||
          message.includes('listener indicated an asynchronous response') ||
          message.includes('asynchronous response by returning true') ||
          message.includes('checkoutUrls') ||
          message.includes('chrome-extension://') ||
          message.includes('moz-extension://') ||
          message.includes('safari-extension://') ||
          message.includes('ERR_FILE_NOT_FOUND') ||
          (message.includes('Failed to execute') && message.includes('MutationObserver')) ||
          (message.includes('observe') && message.includes('MutationObserver')) ||
          (message.includes('parameter 1 is not of type') && message.includes('MutationObserver')) ||
          (message.includes('not of type \'Node\'') && message.includes('MutationObserver')) ||
          stack.includes('content.js') ||
          stack.includes('contentScript') ||
          stack.includes('contentScript.bundle.js') ||
          stack.includes('web-client-content-script') ||
          stack.includes('web-client-content-script.js') ||
          stack.includes('userReportLinkedCandidate')) {
        event.preventDefault();
        // Completely silent - these are browser extension errors, not app errors
        return false;
      }
      
      // Suppress expected 404 errors from API calls (folders, team members)
      // These are handled gracefully by returning empty arrays
      if ((message.includes('404') || message.includes('Not Found')) && 
          (message.includes('folders') || message.includes('team') || message.includes('members') || message.includes('supabase.co'))) {
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
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js', { scope: '/' })
      .then((registration) => {
        console.log('✅ Service Worker registered:', registration.scope);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('🔄 New service worker available. Refresh to update.');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
      });

    // Handle service worker updates
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('🔄 Service worker updated. Reloading...');
      window.location.reload();
    });
  });
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
  
  // Hide HTML splash when React app is ready (with longer delay for content to load)
  const hideSplashScreen = () => {
    const splashEl = document.getElementById('initial-splash');
    if (splashEl && !splashEl.classList.contains('hidden') && !splashEl.classList.contains('native-hidden')) {
      splashEl.classList.add('hidden');
      document.body.classList.add('loaded');
      setTimeout(() => {
        if (splashEl.parentNode) {
          splashEl.remove();
        }
      }, 500);
    }
  };
  
  // Wait for React to mount and content to load before hiding splash
  // Increased timing to give content more time to load
  const hideWhenReady = () => {
    // Wait for React to render
    requestAnimationFrame(() => {
      // Give extra time for content to load (increased from 400ms to 2500ms)
      setTimeout(hideSplashScreen, TIMING_CONSTANTS.delays.splashScreen[2]);
    });
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideWhenReady);
  } else {
    hideWhenReady();
  }
  
  // Fallback: Hide splash after React renders (increased from 1000ms to 3000ms)
  setTimeout(() => {
    hideSplashScreen();
  }, 3000);
}

// Safe root element access with error handling
// Wrap entire app initialization in try-catch to prevent crashes
try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Root element not found! Make sure index.html has a <div id="root"></div> element.');
    // Create root element if it doesn't exist (fallback)
    const fallbackRoot = document.createElement('div');
    fallbackRoot.id = 'root';
    document.body.appendChild(fallbackRoot);
    ReactDOM.createRoot(fallbackRoot).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } else {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
} catch (error) {
  console.error('Fatal error during app initialization:', error);
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
if (!isNative) {
  // Use a longer timeout as final fallback (increased from 2000ms to 3500ms)
  setTimeout(() => {
    const splashEl = document.getElementById('initial-splash');
    if (splashEl && !splashEl.classList.contains('hidden') && !splashEl.classList.contains('native-hidden')) {
      splashEl.classList.add('hidden');
      document.body.classList.add('loaded');
      setTimeout(() => {
        if (splashEl.parentNode) {
          splashEl.remove();
        }
      }, 500);
    }
  }, 3500);
}
