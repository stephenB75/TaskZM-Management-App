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
  // Don't skip waiting - let old service worker finish before activating new one
  // This prevents automatic page refreshes when service worker updates
  // self.skipWaiting(); // DISABLED to prevent automatic refreshes
});

// Activate - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Don't claim clients immediately - let them continue with old service worker
  // This prevents automatic page refreshes when service worker updates
  // New service worker will take control on next page load/navigation
  // self.clients.claim(); // DISABLED to prevent automatic refreshes
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
