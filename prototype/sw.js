// Service Worker for OITH PWA
const CACHE_NAME = 'oith-v10';

// Install event - skip waiting to activate immediately
self.addEventListener('install', event => {
  console.log('OITH: Service Worker installing');
  self.skipWaiting();
});

// Activate event - claim clients and clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          console.log('OITH: Removing cache', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - prefer network, safe fallback to cache or simple offline response
self.addEventListener('fetch', event => {
  event.respondWith((async () => {
    try {
      // Try live network first
      return await fetch(event.request);
    } catch (err) {
      console.warn('OITH SW: Network fetch failed, trying cache:', err);
      const cached = await caches.match(event.request);
      if (cached) {
        return cached;
      }
      // Always return a valid Response object so the browser doesn't error
      return new Response('Offline and no cached version available.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  })());
});
