const CACHE_NAME = 'cinemax-cache-v4';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-First strategy: Always fetch fresh assets/UI from server, fallback to cache only when offline
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip API routes, streaming, tmdb proxy
  if (e.request.url.includes('/api/') || e.request.url.includes('/tmdb/') || e.request.url.includes('/img/')) {
    return;
  }

  e.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(e.request);
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          }).catch(() => {});
        }
        return networkResponse;
      } catch (err) {
        // Fallback to cache when offline
        try {
          const cachedResponse = await caches.match(e.request);
          if (cachedResponse) return cachedResponse;
          if (e.request.mode === 'navigate') {
            const indexMatch = await caches.match('/index.html');
            if (indexMatch) return indexMatch;
          }
        } catch (cacheErr) {}

        // Always return a valid Response object, never undefined/null
        return new Response('Network error', {
          status: 408,
          statusText: 'Request Timeout',
          headers: { 'Content-Type': 'text/plain' },
        });
      }
    })()
  );
});
