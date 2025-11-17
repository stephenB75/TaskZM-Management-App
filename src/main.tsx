import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

// Suppress browser extension errors that are not from our code
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    // Suppress Chrome extension async message errors
    if (event.message) {
      const message = event.message.toString();
      const filename = event.filename?.toString() || '';
      
      // Suppress Chrome extension errors
      if (message.includes('message channel closed before a response was received') ||
          message.includes('checkoutUrls') ||
          filename.includes('chrome-extension://') ||
          filename.includes('contentScript.bundle.js')) {
        event.preventDefault();
        console.debug('Suppressed browser extension error (non-critical)');
        return false;
      }
      
      // Suppress initialization errors from bundled code (may be from extensions)
      if (message.includes('Cannot access') && message.includes('before initialization')) {
        const isExtensionError = filename.includes('chrome-extension://') || 
                                filename.includes('contentScript') ||
                                filename.includes('vendor-');
        if (isExtensionError) {
          event.preventDefault();
          console.debug('Suppressed extension initialization error (non-critical)');
          return false;
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
      if (message.includes('message channel closed before a response was received') ||
          message.includes('checkoutUrls') ||
          message.includes('chrome-extension://')) {
        event.preventDefault();
        console.debug('Suppressed browser extension promise rejection (non-critical)');
        return false;
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
  setTimeout(hideCapacitorSplash, 0);
  setTimeout(hideCapacitorSplash, 10);
  setTimeout(hideCapacitorSplash, 50);
  setTimeout(hideCapacitorSplash, 100);
  setTimeout(hideCapacitorSplash, 200);
  
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
      setTimeout(hideSplashScreen, 2500);
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

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
