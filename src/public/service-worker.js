// TaskZM Service Worker - Offline Support & Caching
// IMPORTANT: This service worker is configured to NOT cause automatic page refreshes
// Updates will only apply on manual page refresh or navigation
const CACHE_NAME = 'taskzm-v2.0.1-b20261017-1'; // Increment version to force update on next deploy (match package.json)
const RUNTIME_CACHE = 'taskzm-runtime-v2.0.1-b20261017-1'; // Version-scoped so old JS chunks are purged on activate

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
            .filter((name) => {
              // Drop prior version caches and legacy unversioned runtime bucket
              if (name === CACHE_NAME || name === RUNTIME_CACHE) return false;
              if (name === 'taskzm-runtime') return true;
              return name.startsWith('taskzm-v') || name.startsWith('taskzm-runtime-v');
            })
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

// Fetch - network first, then cache. API/data URLs are never cached so stale data is not displayed.
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
  
  // Skip API and data requests (Supabase, Edge Functions) so stale data is never served from cache
  if (event.request.url.includes('supabase.co') || event.request.url.includes('/functions/')) {
    return;
  }

  // CRITICAL: Never cache the HTML document (index.html or navigate requests).
  // After a deploy, chunk filenames change (e.g. SettingsPanel-NewHash.js). If we cache the document,
  // a reload can serve stale HTML that references old chunks (404) and cause "Failed to fetch dynamically imported module".
  const isDocumentRequest = event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '' ||
    url.pathname.endsWith('/index.html');

  const isAppBundle =
    url.pathname.startsWith('/assets/') &&
    (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'));

  // JS/CSS bundles: always bypass browser HTTP cache and never store in RUNTIME_CACHE.
  // Immutable Cache-Control on /assets/* was causing stale Today Agenda chunks after deploy.
  if (isAppBundle) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() =>
        caches.match(event.request).then(
          (cached) =>
            cached ??
            new Response('Network error', {
              status: 408,
              statusText: 'Request Timeout',
              headers: { 'Content-Type': 'text/plain' },
            }),
        ),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful responses; never cache the document
        if (response && response.status === 200 &&
            response.type === 'basic' &&
            (url.protocol === 'http:' || url.protocol === 'https:') &&
            event.request.url.startsWith('http') &&
            !event.request.url.includes('supabase.co') &&
            !event.request.url.includes('/functions/') &&
            !isDocumentRequest &&
            !isAppBundle) {
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
        // For document requests, NEVER serve from cache on network failure.
        // Otherwise after a deploy, reload fetches new HTML -> fails -> we serve old HTML -> same old chunk URLs -> same chunk error.
        if (isDocumentRequest) {
          return new Response(
            '<!DOCTYPE html><html><body><p>Network error. Please check your connection and <a href="/">reload</a>.</p></body></html>',
            { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'text/html' } }
          );
        }
        // Network failed, try cache for non-document assets only
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
