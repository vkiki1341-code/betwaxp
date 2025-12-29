const CACHE_NAME = 'betxpesa-v4';
const urlsToCache = [
  'index.html',
  'favicon.ico',
];

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache opened');
        return cache.addAll(urlsToCache.filter(url => url.endsWith('.html')));
      })
      .catch(err => console.log('Cache installation error:', err))
  );
  self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Network first with cache fallback
self.addEventListener('fetch', event => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests differently
  if (request.url.includes('/api/') || request.url.includes('supabase')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone the response
          const clonedResponse = response.clone();
          
          // Cache successful API responses
          if (response.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, clonedResponse);
            });
          }
          
          return response;
        })
        .catch(async () => {
          // Return cached response if network fails; if none, return a proper 504 Response
          const cached = await caches.match(request);
          if (cached) return cached;
          const headers = new Headers({ 'Content-Type': 'application/json' });
          const body = JSON.stringify({ error: 'Network failed', url: request.url });
          return new Response(body, { status: 504, statusText: 'Gateway Timeout', headers });
        })
    );
  } else {
    // For static assets, use cache first strategy
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            return response;
          }

          return fetch(request).then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            // Clone the response
            const clonedResponse = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(request, clonedResponse);
              });

            return response;
          });
        })
        .catch(async () => {
          // For navigation requests (HTML documents), return offline shell if available
          if (request.destination === 'document') {
            const offline = await caches.match('index.html');
            if (offline) return offline;
          }
          // For scripts/styles/assets, return a 504 to avoid wrong MIME type
          return new Response('', { status: 504, statusText: 'Gateway Timeout' });
        })
    );
  }
});

// Background Sync for notifications
self.addEventListener('sync', event => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(
      fetch('/api/sync-notifications')
        .then(() => console.log('Notifications synced'))
        .catch(err => console.log('Sync failed:', err))
    );
  }
});

// Push Notifications
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'BetXPesa';
  const options = {
    body: data.message,
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    tag: 'betxpesa-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(clientList => {
        // Check if there's already a window/tab open with the target URL
        for (let client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window/tab
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});
