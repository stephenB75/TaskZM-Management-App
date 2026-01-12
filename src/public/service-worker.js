// TaskZM Service Worker - Offline Support & Caching
// IMPORTANT: This service worker is configured to NOT cause automatic page refreshes
// Updates will only apply on manual page refresh or navigation
const CACHE_NAME = 'taskzm-v2.7.4'; // Increment version to force update on next deploy
const RUNTIME_CACHE = 'taskzm-runtime';

// Core files to cache immediately
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/taskzm-logo.png', // Preload splash logo
];

// Install - cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache each asset individually to handle failures gracefully
      return Promise.allSettled(
        CORE_ASSETS.map((asset) => 
          cache.add(asset).catch((err) => {
            // Silently ignore individual asset cache failures
            return null;
          })
        )
      );
    })
  );
  // CRITICAL: Don't skip waiting - force the service worker to wait indefinitely
  // This prevents it from activating and causing page refreshes
  // The new service worker will only activate when the user manually refreshes
  // self.skipWaiting(); // DISABLED - service worker will wait until next page load
});

// Activate - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => caches.delete(name))
        );
      }),
      // CRITICAL: NEVER claim clients - this prevents automatic page refreshes
      // The new service worker will only take control when:
      // 1. All pages are closed, OR
      // 2. User manually refreshes the page
      // We explicitly do NOT call self.clients.claim() to prevent any automatic activation
      // This ensures updates happen in the background without disrupting user sessions
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
        if (clients.length > 0) {
          // Don't claim clients - let them continue with old service worker
          // This prevents automatic refreshes
          console.log('[Service Worker] New version installed but waiting - will activate on next page load');
        }
        // CRITICAL: Never call self.clients.claim() - even if no clients
        // This ensures the service worker waits until manual refresh
        return Promise.resolve();
      })
    ])
  );
});

// Fetch - network first, then cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip non-HTTP/HTTPS requests (chrome-extension, etc.)
  let url;
  try {
    url = new URL(event.request.url);
  } catch (e) {
    // Invalid URL, skip
    return;
  }
  
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }
  
  // Skip Supabase API calls (always use network)
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful responses with valid schemes
        // Double-check the request URL is valid before attempting to cache
        if (response && response.status === 200 && 
            response.type === 'basic' &&
            (url.protocol === 'http:' || url.protocol === 'https:') &&
            event.request.url.startsWith('http')) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            try {
              // Verify the request is cacheable before attempting to put
              if (event.request.url && 
                  !event.request.url.startsWith('chrome-extension:') &&
                  !event.request.url.startsWith('moz-extension:') &&
                  responseClone instanceof Response) {
                cache.put(event.request, responseClone).catch((err) => {
                  // Silently ignore cache errors (non-critical)
                });
              }
            } catch (error) {
              // Silently ignore cache errors
            }
          }).catch(() => {
            // Ignore cache open errors
          });
        }
        return response;
      })
      .catch((error) => {
        // Network failed, try cache
        // For URLs with query parameters, try matching without query string
        const urlWithoutQuery = event.request.url.split('?')[0];
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Try matching without query string
          if (urlWithoutQuery !== event.request.url) {
            return caches.match(urlWithoutQuery);
          }
          // If still no match, return a proper error response instead of undefined
          return new Response('Network error', { 
            status: 408, 
            statusText: 'Request Timeout',
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});

// Background sync for offline task creation
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

async function syncTasks() {
  // This would sync offline-created tasks when back online
  console.log('Background sync: Syncing tasks...');
}

// Push notifications (future feature)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'TaskZM';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: data.url || '/'
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});

// CRITICAL: Listen for messages from the page
// If the page tells us to wait, we'll stay in waiting state
// This prevents automatic activation and page refreshes
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    // Page is telling us whether to skip waiting
    // If skip is false, we stay in waiting state (don't activate)
    if (event.data.skip === false) {
      console.log('[Service Worker] Received wait instruction - staying in waiting state');
      // Don't call skipWaiting() - stay in waiting state
      return;
    }
  }
  
  // For any other messages, respond to keep the channel open
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage({ type: 'ACK', received: true });
  }
});
