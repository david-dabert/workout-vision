// mt1wyjm6 is replaced at build time by vite plugin — ensures browser detects new SW on each deploy
const BUILD_VERSION = 'mt1wyjm6';
const APP_CACHE = `workoutvision-app-${BUILD_VERSION}`;
const MEDIAPIPE_CACHE = 'workoutvision-mediapipe-v1';

const KNOWN_CACHES = [APP_CACHE, MEDIAPIPE_CACHE];

// Activate immediately on install, don't wait for old SW to release.
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Claim all clients and clean up old caches on activate.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !KNOWN_CACHES.includes(key))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Also allow explicit skip-waiting from the main thread.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // MediaPipe model + WASM files: cache-first (versioned, immutable, large).
  // Matches CDN-hosted .tflite, .wasm, .task files and the vision JS loader.
  if (
    url.hostname === 'cdn.jsdelivr.net' ||
    url.hostname === 'storage.googleapis.com'
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(MEDIAPIPE_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Same-origin app assets: network-first so deploys land immediately,
  // with cache fallback for offline use.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(APP_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
});
