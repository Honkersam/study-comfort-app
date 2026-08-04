const CACHE_NAME = 'study-comfort-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Network first policy for HTML and scripts so updates are instant
  if (e.request.mode === 'navigate' || e.request.destination === 'document' || e.request.destination === 'script') {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
          return response;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Cache first, fallback to network for assets
    e.respondWith(
      caches.match(e.request).then((response) => {
        return response || fetch(e.request);
      })
    );
  }
});
